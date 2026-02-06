package v4a

import (
	"context"
	"fmt"
	"time"

	internalcontext "github.com/aws/aws-sdk-go-v2/internal/context"

	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/auth"
	"github.com/aws/smithy-go/logging"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// CredentialsAdapter adapts v4a.Credentials to smithy auth.Identity.
type CredentialsAdapter struct {
	Credentials Credentials
}

var _ auth.Identity = (*CredentialsAdapter)(nil)

// Expiration returns the time of expiration for the credentials.
func (v *CredentialsAdapter) Expiration() time.Time {
	return v.Credentials.Expires
}

// CredentialsProviderAdapter adapts v4a.CredentialsProvider to
// auth.IdentityResolver.
type CredentialsProviderAdapter struct {
	Provider CredentialsProvider
}

var _ (auth.IdentityResolver) = (*CredentialsProviderAdapter)(nil)

// GetIdentity retrieves v4a credentials using the underlying provider.
func (v *CredentialsProviderAdapter) GetIdentity(ctx context.Context, _ smithy.Properties) (
	auth.Identity, error,
) {
	creds, err := v.Provider.RetrievePrivateKey(ctx)
	if err != nil {
		return nil, fmt.Errorf("get credentials: %w", err)
	}

	return &CredentialsAdapter{Credentials: creds}, nil
}

// SignerAdapter adapts v4a.HTTPSigner to smithy http.Signer.
type SignerAdapter struct {
	Signer     HTTPSigner
	Logger     logging.Logger
	LogSigning bool
}

var _ (smithyhttp.Signer) = (*SignerAdapter)(nil)

// SignRequest signs the request with the provided identity.
func (v *SignerAdapter) SignRequest(ctx context.Context, r *smithyhttp.Request, identity auth.Identity, props smithy.Properties) error {
	ca, ok := identity.(*CredentialsAdapter)
	if !ok {
		return fmt.Errorf("unexpected identity type: %T", identity)
	}

	name, ok := smithyhttp.GetSigV4SigningName(&props)
	if !ok {
		return fmt.Errorf("sigv4a signing name is required")
	}

	regions, ok := smithyhttp.GetSigV4ASigningRegions(&props)
	if !ok {
		return fmt.Errorf("sigv4a signing region is required")
	}

	hash := v4.GetPayloadHash(ctx)
	signingTime := sdk.NowTime()
	if skew := internalcontext.GetAttemptSkewContext(ctx); skew != 0 {
		signingTime.Add(skew)
	}
	err := v.Signer.SignHTTP(ctx, ca.Credentials, r.Request, hash, name, regions, signingTime, func(o *SignerOptions) {
		o.DisableURIPathEscaping, _ = smithyhttp.GetDisableDoubleEncoding(&props)

		o.Logger = v.Logger
		o.LogSigning = v.LogSigning
	})
	if err != nil {
		return fmt.Errorf("sign http: %w", err)
	}

	return nil
}
