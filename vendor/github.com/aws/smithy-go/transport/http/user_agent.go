package http

import (
	"strings"
)

// UserAgentBuilder is a builder for a HTTP User-Agent string.
type UserAgentBuilder struct {
	sb strings.Builder
}

// NewUserAgentBuilder returns a new UserAgentBuilder.
func NewUserAgentBuilder() *UserAgentBuilder {
	return &UserAgentBuilder{sb: strings.Builder{}}
}

// AddKey adds the named component/product to the agent string
func (u *UserAgentBuilder) AddKey(key string) {
	u.appendTo(key)
}

// AddKeyValue adds the named key to the agent string with the given value.
func (u *UserAgentBuilder) AddKeyValue(key, value string) {
	u.appendTo(key + "/" + value)
}

// Build returns the constructed User-Agent string. May be called multiple times.
func (u *UserAgentBuilder) Build() string {
	return u.sb.String()
}

func (u *UserAgentBuilder) appendTo(value string) {
	if u.sb.Len() > 0 {
		u.sb.WriteRune(' ')
	}
	u.sb.WriteString(value)
}
