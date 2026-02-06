package auth

import (
	"github.com/aws/smithy-go/auth"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// HTTPAuthScheme is the SDK's internal implementation of smithyhttp.AuthScheme
// for pre-existing implementations where the signer was added to client
// config. SDK clients will key off of this type and ensure per-operation
// updates to those signers persist on the scheme itself.
type HTTPAuthScheme struct {
	schemeID string
	signer   smithyhttp.Signer
}

var _ smithyhttp.AuthScheme = (*HTTPAuthScheme)(nil)

// NewHTTPAuthScheme returns an auth scheme instance with the given config.
func NewHTTPAuthScheme(schemeID string, signer smithyhttp.Signer) *HTTPAuthScheme {
	return &HTTPAuthScheme{
		schemeID: schemeID,
		signer:   signer,
	}
}

// SchemeID identifies the auth scheme.
func (s *HTTPAuthScheme) SchemeID() string {
	return s.schemeID
}

// IdentityResolver gets the identity resolver for the auth scheme.
func (s *HTTPAuthScheme) IdentityResolver(o auth.IdentityResolverOptions) auth.IdentityResolver {
	return o.GetIdentityResolver(s.schemeID)
}

// Signer gets the signer for the auth scheme.
func (s *HTTPAuthScheme) Signer() smithyhttp.Signer {
	return s.signer
}

// WithSigner returns a new instance of the auth scheme with the updated signer.
func (s *HTTPAuthScheme) WithSigner(signer smithyhttp.Signer) *HTTPAuthScheme {
	return NewHTTPAuthScheme(s.schemeID, signer)
}
