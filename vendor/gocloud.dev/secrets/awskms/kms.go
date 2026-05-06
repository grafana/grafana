// Copyright 2019 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package awskms provides a secrets implementation backed by AWS KMS.
// Use OpenKeeper to construct a *secrets.Keeper.
//
// # URLs
//
// For secrets.OpenKeeper, awskms registers for the scheme "awskms".
// The default URL opener will use an AWS session with the default credentials
// and configuration.
//
// To customize the URL opener, or for more details on the URL format,
// see URLOpener.
// See https://gocloud.dev/concepts/urls/ for background information.
//
// # As
//
// awskms exposes the following type for As:
//   - Error: any error type returned by the service, notably smithy.APIError
package awskms // import "gocloud.dev/secrets/awskms"

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/kms/types"
	"github.com/aws/smithy-go"
	"github.com/google/wire"
	gcaws "gocloud.dev/aws"
	"gocloud.dev/gcerrors"
	"gocloud.dev/internal/gcerr"
	"gocloud.dev/secrets"
)

func init() {
	secrets.DefaultURLMux().RegisterKeeper(Scheme, new(lazySessionOpener))
}

// Set holds Wire providers for this package.
var Set = wire.NewSet(
	Dial,
)

// Dial gets an AWS KMS service client using the AWS SDK V2.
func Dial(cfg aws.Config) (*kms.Client, error) {
	return kms.NewFromConfig(cfg), nil
}

var DialV2 = Dial

// lazySessionOpener obtains the AWS session from the environment on the first
// call to OpenKeeperURL.
type lazySessionOpener struct {
	init   sync.Once
	opener *URLOpener
	err    error
}

func (o *lazySessionOpener) OpenKeeperURL(ctx context.Context, u *url.URL) (*secrets.Keeper, error) {
	opener := &URLOpener{}
	return opener.OpenKeeperURL(ctx, u)
}

// Scheme is the URL scheme awskms registers its URLOpener under on secrets.DefaultMux.
const Scheme = "awskms"

// URLOpener opens AWS KMS URLs like "awskms://keyID" or "awskms:///keyID".
//
// The URL Host + Path are used as the key ID, which can be in the form of an
// Amazon Resource Name (ARN), alias name, or alias ARN. See
// https://docs.aws.amazon.com/kms/latest/developerguide/viewing-keys.html#find-cmk-id-arn
// for more details. Note that ARNs may contain ":" characters, which cannot be
// escaped in the Host part of a URL, so the "awskms:///<ARN>" form should be used.
//
// See https://pkg.go.dev/gocloud.dev/aws#V2ConfigFromURLParams.
//
// EncryptionContext key/value pairs can be provided by providing URL parameters prefixed
// with "context_"; e.g., "...&context_abc=foo&context_def=bar" would result in
// an EncryptionContext of {abc=foo, def=bar}.
// See https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#encrypt_context.
type URLOpener struct {
	// Options specifies the options to pass to OpenKeeper.
	// EncryptionContext parameters from the URL are merged in.
	Options KeeperOptions
}

// addEncryptionContextFromURLParams merges any EncryptionContext URL parameters from
// u into opts.EncryptionParameters.
// It removes the processed URL parameters from u.
func addEncryptionContextFromURLParams(opts *KeeperOptions, u url.Values) error {
	for k, vs := range u {
		if strings.HasPrefix(k, "context_") {
			if len(vs) != 1 {
				return fmt.Errorf("open keeper: EncryptionContext URL parameters %q must have exactly 1 value", k)
			}
			u.Del(k)
			if opts.EncryptionContext == nil {
				opts.EncryptionContext = map[string]string{}
			}
			opts.EncryptionContext[k[8:]] = vs[0]
		}
	}
	return nil
}

// OpenKeeperURL opens an AWS KMS Keeper based on u.
func (o *URLOpener) OpenKeeperURL(ctx context.Context, u *url.URL) (*secrets.Keeper, error) {
	// A leading "/" means the Host was empty; trim the slash.
	// This is so that awskms:///foo:bar results in "foo:bar" instead of
	// "/foo:bar".
	keyID := strings.TrimPrefix(path.Join(u.Host, u.Path), "/")

	queryParams := u.Query()
	opts := o.Options
	if err := addEncryptionContextFromURLParams(&opts, queryParams); err != nil {
		return nil, err
	}

	cfg, err := gcaws.V2ConfigFromURLParams(ctx, queryParams)
	if err != nil {
		return nil, fmt.Errorf("open keeper %v: %v", u, err)
	}
	client, err := Dial(cfg)
	if err != nil {
		return nil, err
	}
	return OpenKeeper(client, keyID, &opts), nil
}

// OpenKeeper returns a *secrets.Keeper that uses AWS KMS, using SDK v2.
// The key ID can be in the form of an Amazon Resource Name (ARN), alias
// name, or alias ARN. See
// https://docs.aws.amazon.com/kms/latest/developerguide/viewing-keys.html#find-cmk-id-arn
// for more details.
// See the package documentation for an example.
func OpenKeeper(client *kms.Client, keyID string, opts *KeeperOptions) *secrets.Keeper {
	if opts == nil {
		opts = &KeeperOptions{}
	}
	return secrets.NewKeeper(&keeper{
		keyID:  keyID,
		client: client,
		opts:   *opts,
	})
}

var OpenKeeperV2 = OpenKeeper

type keeper struct {
	keyID  string
	opts   KeeperOptions
	client *kms.Client
}

// Decrypt decrypts the ciphertext into a plaintext.
func (k *keeper) Decrypt(ctx context.Context, ciphertext []byte) ([]byte, error) {
	result, err := k.client.Decrypt(ctx, &kms.DecryptInput{
		CiphertextBlob:    ciphertext,
		EncryptionContext: k.opts.EncryptionContext,
	})
	if err != nil {
		return nil, err
	}
	return result.Plaintext, nil
}

// Encrypt encrypts the plaintext into a ciphertext.
func (k *keeper) Encrypt(ctx context.Context, plaintext []byte) ([]byte, error) {
	result, err := k.client.Encrypt(ctx, &kms.EncryptInput{
		KeyId:             aws.String(k.keyID),
		Plaintext:         plaintext,
		EncryptionContext: k.opts.EncryptionContext,
	})
	if err != nil {
		return nil, err
	}
	return result.CiphertextBlob, nil
}

// Close implements driver.Keeper.Close.
func (k *keeper) Close() error { return nil }

// ErrorAs implements driver.Keeper.ErrorAs.
func (k *keeper) ErrorAs(err error, i any) bool {
	return errors.As(err, i)
}

// ErrorCode implements driver.ErrorCode.
func (k *keeper) ErrorCode(err error) gcerrors.ErrorCode {
	var ae smithy.APIError
	if !errors.As(err, &ae) {
		return gcerr.Unknown
	}
	code := ae.ErrorCode()
	ec, ok := errorCodeMap[code]
	if !ok {
		return gcerr.Unknown
	}
	return ec
}

var errorCodeMap = map[string]gcerrors.ErrorCode{
	(&types.NotFoundException{}).ErrorCode():          gcerrors.NotFound,
	(&types.InvalidCiphertextException{}).ErrorCode(): gcerrors.InvalidArgument,
	(&types.InvalidKeyUsageException{}).ErrorCode():   gcerrors.InvalidArgument,
	(&types.KMSInternalException{}).ErrorCode():       gcerrors.Internal,
	(&types.KMSInvalidStateException{}).ErrorCode():   gcerrors.FailedPrecondition,
	(&types.DisabledException{}).ErrorCode():          gcerrors.PermissionDenied,
	(&types.InvalidGrantTokenException{}).ErrorCode(): gcerrors.PermissionDenied,
	(&types.KeyUnavailableException{}).ErrorCode():    gcerrors.ResourceExhausted,
	(&types.DependencyTimeoutException{}).ErrorCode(): gcerrors.DeadlineExceeded,
}

// KeeperOptions controls Keeper behaviors.
// It is provided for future extensibility.
type KeeperOptions struct {
	// EncryptionContext parameters.
	// See https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#encrypt_context.
	EncryptionContext map[string]string
}
