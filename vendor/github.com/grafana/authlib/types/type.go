package types

import (
	"errors"
	"fmt"
	"strings"
)

var (
	ErrInvalidTypedID = errors.New("auth.identity.invalid-typed-id")
)

// The type of identity
// +enum
type IdentityType string

const (
	TypeUser            IdentityType = "user"
	TypeAPIKey          IdentityType = "api-key"
	TypeServiceAccount  IdentityType = "service-account"
	TypeAnonymous       IdentityType = "anonymous"
	TypeRenderService   IdentityType = "render"
	TypeUnauthenticated IdentityType = "unauthenticated"
	TypeAccessPolicy    IdentityType = "access-policy"
	TypeProvisioning    IdentityType = "provisioning"
	TypePublic          IdentityType = "public"
	TypeEmpty           IdentityType = ""
)

func (n IdentityType) String() string {
	return string(n)
}

func NewTypeID(typ IdentityType, identifier string) string {
	return fmt.Sprintf("%s:%s", typ, identifier)
}

func ParseTypeID(str string) (IdentityType, string, error) {
	parts := strings.Split(str, ":")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("expected id to have 2 parts: %w", ErrInvalidTypedID)
	}

	typ, err := ParseType(parts[0])
	if err != nil {
		return "", "", fmt.Errorf("got invalid type: %w", err)
	}

	return typ, parts[1], nil
}

func ParseType(str string) (IdentityType, error) {
	switch str {
	case string(TypeUser):
		return TypeUser, nil
	case string(TypeAPIKey):
		return TypeAPIKey, nil
	case string(TypeServiceAccount):
		return TypeServiceAccount, nil
	case string(TypeAnonymous):
		return TypeAnonymous, nil
	case string(TypeRenderService):
		return TypeRenderService, nil
	case string(TypeUnauthenticated):
		return TypeUnauthenticated, nil
	case string(TypeAccessPolicy):
		return TypeAccessPolicy, nil
	case string(TypePublic):
		return TypePublic, nil
	default:
		return "", ErrInvalidTypedID
	}
}

// IsIdentityType returns true if type matches any expected identity type
func IsIdentityType(typ IdentityType, expected ...IdentityType) bool {
	for _, e := range expected {
		if typ == e {
			return true
		}
	}
	return false
}
