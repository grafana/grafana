package authn

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
)

type IDTokenClaims struct {
	// Identifier is the unique ID of the of entity
	Identifier string `json:"identifier"`
	// The type of the entity.
	Type types.IdentityType `json:"type"`
	// Namespace takes the form of '<type>-<id>', '*' means all namespaces.
	// Type can be either org or stack.
	Namespace string `json:"namespace"`
	// AuthenticatedBy is the method used to authenticate the identity.
	AuthenticatedBy string `json:"authenticatedBy,omitempty"`
	Email           string `json:"email,omitempty"`
	EmailVerified   bool   `json:"email_verified,omitempty"`
	// Username of the user (login attribute on the Identity)
	Username string `json:"username,omitempty"`
	// Display name of the user (name attribute if it is set, otherwise the login or email)
	DisplayName string `json:"name,omitempty"`
	// Basic role of entity (Viewer, Editor, Admin)
	Role string `json:"role,omitempty"`
}

// Helper for the id
func (c IDTokenClaims) getTypedUID() string {
	return fmt.Sprintf("%s:%s", c.Type, c.Identifier)
}

func (c IDTokenClaims) getK8sName() string {
	if c.DisplayName != "" {
		return c.DisplayName
	}
	if c.Username != "" {
		return c.Username
	}
	if c.Email != "" {
		return c.Email
	}
	return c.Identifier
}

func NewIDTokenVerifier(cfg VerifierConfig, keys KeyRetriever) *IDTokenVerifier {
	return &IDTokenVerifier{
		v: NewVerifier[IDTokenClaims](cfg, TokenTypeID, keys),
	}
}

func NewUnsafeIDTokenVerifier(cfg VerifierConfig) *IDTokenVerifier {
	return &IDTokenVerifier{
		v: NewUnsafeVerifier[IDTokenClaims](cfg, TokenTypeID),
	}
}

// IDTokenVerifier is a convenient wrapper around `Verifier`
// used to verify grafana issued id tokens.
type IDTokenVerifier struct {
	v Verifier[IDTokenClaims]
}

func (e *IDTokenVerifier) Verify(ctx context.Context, token string) (*Claims[IDTokenClaims], error) {
	return e.v.Verify(ctx, token)
}
