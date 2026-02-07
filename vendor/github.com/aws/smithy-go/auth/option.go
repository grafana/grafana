package auth

import "github.com/aws/smithy-go"

type (
	authOptionsKey struct{}
)

// Option represents a possible authentication method for an operation.
type Option struct {
	SchemeID           string
	IdentityProperties smithy.Properties
	SignerProperties   smithy.Properties
}

// GetAuthOptions gets auth Options from Properties.
func GetAuthOptions(p *smithy.Properties) ([]*Option, bool) {
	v, ok := p.Get(authOptionsKey{}).([]*Option)
	return v, ok
}

// SetAuthOptions sets auth Options on Properties.
func SetAuthOptions(p *smithy.Properties, options []*Option) {
	p.Set(authOptionsKey{}, options)
}
