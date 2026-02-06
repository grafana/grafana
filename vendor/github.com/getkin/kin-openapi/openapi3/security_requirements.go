package openapi3

import (
	"context"
)

type SecurityRequirements []SecurityRequirement

func NewSecurityRequirements() *SecurityRequirements {
	return &SecurityRequirements{}
}

func (srs *SecurityRequirements) With(securityRequirement SecurityRequirement) *SecurityRequirements {
	*srs = append(*srs, securityRequirement)
	return srs
}

// Validate returns an error if SecurityRequirements does not comply with the OpenAPI spec.
func (srs SecurityRequirements) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	for _, security := range srs {
		if err := security.Validate(ctx); err != nil {
			return err
		}
	}
	return nil
}

// SecurityRequirement is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#security-requirement-object
type SecurityRequirement map[string][]string

func NewSecurityRequirement() SecurityRequirement {
	return make(SecurityRequirement)
}

func (security SecurityRequirement) Authenticate(provider string, scopes ...string) SecurityRequirement {
	if len(scopes) == 0 {
		scopes = []string{} // Forces the variable to be encoded as an array instead of null
	}
	security[provider] = scopes
	return security
}

// Validate returns an error if SecurityRequirement does not comply with the OpenAPI spec.
func (security *SecurityRequirement) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	return nil
}

// UnmarshalJSON sets SecurityRequirement to a copy of data.
func (security *SecurityRequirement) UnmarshalJSON(data []byte) (err error) {
	*security, _, err = unmarshalStringMap[[]string](data)
	return
}
