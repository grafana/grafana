package http

import (
	"context"

	smithy "github.com/aws/smithy-go"
	"github.com/aws/smithy-go/auth"
)

// NewAnonymousScheme returns the anonymous HTTP auth scheme.
func NewAnonymousScheme() AuthScheme {
	return &authScheme{
		schemeID: auth.SchemeIDAnonymous,
		signer:   &nopSigner{},
	}
}

// authScheme is parameterized to generically implement the exported AuthScheme
// interface
type authScheme struct {
	schemeID string
	signer   Signer
}

var _ AuthScheme = (*authScheme)(nil)

func (s *authScheme) SchemeID() string {
	return s.schemeID
}

func (s *authScheme) IdentityResolver(o auth.IdentityResolverOptions) auth.IdentityResolver {
	return o.GetIdentityResolver(s.schemeID)
}

func (s *authScheme) Signer() Signer {
	return s.signer
}

type nopSigner struct{}

var _ Signer = (*nopSigner)(nil)

func (*nopSigner) SignRequest(context.Context, *Request, auth.Identity, smithy.Properties) error {
	return nil
}
