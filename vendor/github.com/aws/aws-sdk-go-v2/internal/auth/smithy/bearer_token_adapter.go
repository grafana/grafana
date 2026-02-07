package smithy

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/auth"
	"github.com/aws/smithy-go/auth/bearer"
)

// BearerTokenAdapter adapts smithy bearer.Token to smithy auth.Identity.
type BearerTokenAdapter struct {
	Token bearer.Token
}

var _ auth.Identity = (*BearerTokenAdapter)(nil)

// Expiration returns the time of expiration for the token.
func (v *BearerTokenAdapter) Expiration() time.Time {
	return v.Token.Expires
}

// BearerTokenProviderAdapter adapts smithy bearer.TokenProvider to smithy
// auth.IdentityResolver.
type BearerTokenProviderAdapter struct {
	Provider bearer.TokenProvider
}

var _ (auth.IdentityResolver) = (*BearerTokenProviderAdapter)(nil)

// GetIdentity retrieves a bearer token using the underlying provider.
func (v *BearerTokenProviderAdapter) GetIdentity(ctx context.Context, _ smithy.Properties) (
	auth.Identity, error,
) {
	token, err := v.Provider.RetrieveBearerToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("get token: %w", err)
	}

	return &BearerTokenAdapter{Token: token}, nil
}
