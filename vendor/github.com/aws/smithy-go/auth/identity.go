package auth

import (
	"context"
	"time"

	"github.com/aws/smithy-go"
)

// Identity contains information that identifies who the user making the
// request is.
type Identity interface {
	Expiration() time.Time
}

// IdentityResolver defines the interface through which an Identity is
// retrieved.
type IdentityResolver interface {
	GetIdentity(context.Context, smithy.Properties) (Identity, error)
}

// IdentityResolverOptions defines the interface through which an entity can be
// queried to retrieve an IdentityResolver for a given auth scheme.
type IdentityResolverOptions interface {
	GetIdentityResolver(schemeID string) IdentityResolver
}

// AnonymousIdentity is a sentinel to indicate no identity.
type AnonymousIdentity struct{}

var _ Identity = (*AnonymousIdentity)(nil)

// Expiration returns the zero value for time, as anonymous identity never
// expires.
func (*AnonymousIdentity) Expiration() time.Time {
	return time.Time{}
}

// AnonymousIdentityResolver returns AnonymousIdentity.
type AnonymousIdentityResolver struct{}

var _ IdentityResolver = (*AnonymousIdentityResolver)(nil)

// GetIdentity returns AnonymousIdentity.
func (*AnonymousIdentityResolver) GetIdentity(_ context.Context, _ smithy.Properties) (Identity, error) {
	return &AnonymousIdentity{}, nil
}
