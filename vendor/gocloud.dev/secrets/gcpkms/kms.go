// Copyright 2018 The Go Cloud Development Kit Authors
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

// Package gcpkms provides a secrets implementation backed by Google Cloud KMS.
// Use OpenKeeper to construct a *secrets.Keeper.
//
// # URLs
//
// For secrets.OpenKeeper, gcpkms registers for the scheme "gcpkms".
// The default URL opener will create a connection using use default
// credentials from the environment, as described in
// https://cloud.google.com/docs/authentication/production.
// To customize the URL opener, or for more details on the URL format,
// see URLOpener.
// See https://gocloud.dev/concepts/urls/ for background information.
//
// # As
//
// gcpkms exposes the following type for As:
//   - Error: *google.golang.org/grpc/status.Status
package gcpkms // import "gocloud.dev/secrets/gcpkms"

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"sync"

	cloudkms "cloud.google.com/go/kms/apiv1"
	"cloud.google.com/go/kms/apiv1/kmspb"
	"github.com/google/wire"
	"gocloud.dev/gcerrors"
	"gocloud.dev/gcp"
	"gocloud.dev/internal/gcerr"
	"gocloud.dev/internal/useragent"
	"gocloud.dev/secrets"
	"google.golang.org/api/option"
	"google.golang.org/grpc/status"
)

// endPoint is the address to access Google Cloud KMS API.
const endPoint = "cloudkms.googleapis.com:443"

// Dial returns a client to use with Cloud KMS and a clean-up function to close
// the client after used.
func Dial(ctx context.Context, ts gcp.TokenSource) (*cloudkms.KeyManagementClient, func(), error) {
	c, err := cloudkms.NewKeyManagementClient(ctx, option.WithTokenSource(ts), useragent.ClientOption("secrets"))
	return c, func() { c.Close() }, err
}

func init() {
	secrets.DefaultURLMux().RegisterKeeper(Scheme, new(lazyCredsOpener))
}

// Set holds Wire providers for this package.
var Set = wire.NewSet(
	Dial,
	wire.Struct(new(URLOpener), "Client"),
)

// lazyCredsOpener obtains Application Default Credentials on the first call
// lazyCredsOpener obtains Application Default Credentials on the first call
// to OpenKeeperURL.
type lazyCredsOpener struct {
	init   sync.Once
	opener *URLOpener
	err    error
}

func (o *lazyCredsOpener) OpenKeeperURL(ctx context.Context, u *url.URL) (*secrets.Keeper, error) {
	o.init.Do(func() {
		creds, err := gcp.DefaultCredentials(ctx)
		if err != nil {
			o.err = err
			return
		}
		client, _, err := Dial(ctx, creds.TokenSource)
		if err != nil {
			o.err = err
			return
		}
		o.opener = &URLOpener{Client: client}
	})
	if o.err != nil {
		return nil, fmt.Errorf("open keeper %v: %v", u, o.err)
	}
	return o.opener.OpenKeeperURL(ctx, u)
}

// Scheme is the URL scheme gcpkms registers its URLOpener under on secrets.DefaultMux.
const Scheme = "gcpkms"

// URLOpener opens GCP KMS URLs like
// "gcpkms://projects/[PROJECT_ID]/locations/[LOCATION]/keyRings/[KEY_RING]/cryptoKeys/[KEY]".
//
// The URL host+path are used as the key resource ID; see
// https://cloud.google.com/kms/docs/object-hierarchy#key for more details.
//
// No query parameters are supported.
type URLOpener struct {
	// Client must be non-nil and be authenticated with "cloudkms" scope or equivalent.
	Client *cloudkms.KeyManagementClient

	// Options specifies the default options to pass to OpenKeeper.
	Options KeeperOptions
}

// OpenKeeperURL opens the GCP KMS URLs.
func (o *URLOpener) OpenKeeperURL(ctx context.Context, u *url.URL) (*secrets.Keeper, error) {
	for param := range u.Query() {
		return nil, fmt.Errorf("open keeper %v: invalid query parameter %q", u, param)
	}
	return OpenKeeper(o.Client, path.Join(u.Host, u.Path), &o.Options), nil
}

// OpenKeeper returns a *secrets.Keeper that uses Google Cloud KMS.
// You can use KeyResourceID to construct keyResourceID from its parts,
// or provide the whole string if you have it (e.g., from the GCP console).
// See https://cloud.google.com/kms/docs/object-hierarchy#key for more details.
// See the package documentation for an example.
func OpenKeeper(client *cloudkms.KeyManagementClient, keyResourceID string, opts *KeeperOptions) *secrets.Keeper {
	return secrets.NewKeeper(&keeper{
		keyResourceID: keyResourceID,
		client:        client,
	})
}

// KeyResourceID constructs a key resourceID for GCP KMS.
// See https://cloud.google.com/kms/docs/object-hierarchy#key for more details.
func KeyResourceID(projectID, location, keyRing, key string) string {
	return fmt.Sprintf("projects/%s/locations/%s/keyRings/%s/cryptoKeys/%s",
		projectID, location, keyRing, key)
}

// keeper implements driver.Keeper.
type keeper struct {
	keyResourceID string
	client        *cloudkms.KeyManagementClient
}

// Decrypt decrypts the ciphertext using the key constructed from ki.
func (k *keeper) Decrypt(ctx context.Context, ciphertext []byte) ([]byte, error) {
	req := &kmspb.DecryptRequest{
		Name:       k.keyResourceID,
		Ciphertext: ciphertext,
	}
	resp, err := k.client.Decrypt(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp.GetPlaintext(), nil
}

// Encrypt encrypts the plaintext into a ciphertext.
func (k *keeper) Encrypt(ctx context.Context, plaintext []byte) ([]byte, error) {
	req := &kmspb.EncryptRequest{
		Name:      k.keyResourceID,
		Plaintext: plaintext,
	}
	resp, err := k.client.Encrypt(ctx, req)
	if err != nil {
		return nil, err
	}
	return resp.GetCiphertext(), nil
}

// Close implements driver.Keeper.Close.
func (k *keeper) Close() error { return nil }

// ErrorAs implements driver.Keeper.ErrorAs.
func (k *keeper) ErrorAs(err error, i any) bool {
	s, ok := status.FromError(err)
	if !ok {
		return false
	}
	p, ok := i.(**status.Status)
	if !ok {
		return false
	}
	*p = s
	return true
}

// ErrorCode implements driver.ErrorCode.
func (k *keeper) ErrorCode(err error) gcerrors.ErrorCode {
	return gcerr.GRPCCode(err)
}

// KeeperOptions controls Keeper behaviors.
// It is provided for future extensibility.
type KeeperOptions struct{}
