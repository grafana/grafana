package http

import (
	"context"

	smithy "github.com/aws/smithy-go"
	"github.com/aws/smithy-go/auth"
)

// AuthScheme defines an HTTP authentication scheme.
type AuthScheme interface {
	SchemeID() string
	IdentityResolver(auth.IdentityResolverOptions) auth.IdentityResolver
	Signer() Signer
}

// Signer defines the interface through which HTTP requests are supplemented
// with an Identity.
type Signer interface {
	SignRequest(context.Context, *Request, auth.Identity, smithy.Properties) error
}
