package smithy

import (
	"context"
	"fmt"

	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	internalcontext "github.com/aws/aws-sdk-go-v2/internal/context"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/auth"
	"github.com/aws/smithy-go/logging"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// V4SignerAdapter adapts v4.HTTPSigner to smithy http.Signer.
type V4SignerAdapter struct {
	Signer     v4.HTTPSigner
	Logger     logging.Logger
	LogSigning bool
}

var _ (smithyhttp.Signer) = (*V4SignerAdapter)(nil)

// SignRequest signs the request with the provided identity.
func (v *V4SignerAdapter) SignRequest(ctx context.Context, r *smithyhttp.Request, identity auth.Identity, props smithy.Properties) error {
	ca, ok := identity.(*CredentialsAdapter)
	if !ok {
		return fmt.Errorf("unexpected identity type: %T", identity)
	}

	name, ok := smithyhttp.GetSigV4SigningName(&props)
	if !ok {
		return fmt.Errorf("sigv4 signing name is required")
	}

	region, ok := smithyhttp.GetSigV4SigningRegion(&props)
	if !ok {
		return fmt.Errorf("sigv4 signing region is required")
	}

	hash := v4.GetPayloadHash(ctx)
	signingTime := sdk.NowTime()
	skew := internalcontext.GetAttemptSkewContext(ctx)
	signingTime = signingTime.Add(skew)
	err := v.Signer.SignHTTP(ctx, ca.Credentials, r.Request, hash, name, region, signingTime, func(o *v4.SignerOptions) {
		o.DisableURIPathEscaping, _ = smithyhttp.GetDisableDoubleEncoding(&props)

		o.Logger = v.Logger
		o.LogSigning = v.LogSigning
	})
	if err != nil {
		return fmt.Errorf("sign http: %w", err)
	}

	return nil
}
