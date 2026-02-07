package customizations

import (
	"context"
	"fmt"

	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	internalauthsmithy "github.com/aws/aws-sdk-go-v2/internal/auth/smithy"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/auth"
	"github.com/aws/smithy-go/logging"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// ExpressSigner signs requests for the sigv4-s3express auth scheme.
//
// This signer respects the aws.auth#sigv4 properties for signing name and
// region.
type ExpressSigner struct {
	Signer     v4.HTTPSigner
	Logger     logging.Logger
	LogSigning bool
}

var _ (smithyhttp.Signer) = (*ExpressSigner)(nil)

// SignRequest signs the request with the provided identity.
func (v *ExpressSigner) SignRequest(ctx context.Context, r *smithyhttp.Request, identity auth.Identity, props smithy.Properties) error {
	ca, ok := identity.(*internalauthsmithy.CredentialsAdapter)
	if !ok {
		return fmt.Errorf("unexpected identity type: %T", identity)
	}

	name, ok := smithyhttp.GetSigV4SigningName(&props)
	if !ok {
		return fmt.Errorf("sigv4 signing name is required for s3express variant")
	}

	region, ok := smithyhttp.GetSigV4SigningRegion(&props)
	if !ok {
		return fmt.Errorf("sigv4 signing region is required for s3express variant")
	}

	hash := v4.GetPayloadHash(ctx)

	r.Header.Set(headerAmzSessionToken, ca.Credentials.SessionToken)
	err := v.Signer.SignHTTP(ctx, ca.Credentials, r.Request, hash, name, region, sdk.NowTime(), func(o *v4.SignerOptions) {
		o.DisableSessionToken = true

		o.DisableURIPathEscaping, _ = smithyhttp.GetDisableDoubleEncoding(&props)

		o.Logger = v.Logger
		o.LogSigning = v.LogSigning
	})
	if err != nil {
		return fmt.Errorf("sign http: %v", err)
	}

	return nil
}
