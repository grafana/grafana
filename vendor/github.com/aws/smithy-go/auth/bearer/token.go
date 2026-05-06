package bearer

import (
	"context"
	"time"
)

// Token provides a type wrapping a bearer token and expiration metadata.
type Token struct {
	Value string

	CanExpire bool
	Expires   time.Time
}

// Expired returns if the token's Expires time is before or equal to the time
// provided. If CanExpires is false, Expired will always return false.
func (t Token) Expired(now time.Time) bool {
	if !t.CanExpire {
		return false
	}
	now = now.Round(0)
	return now.Equal(t.Expires) || now.After(t.Expires)
}

// TokenProvider provides interface for retrieving bearer tokens.
type TokenProvider interface {
	RetrieveBearerToken(context.Context) (Token, error)
}

// TokenProviderFunc provides a helper utility to wrap a function as a type
// that implements the TokenProvider interface.
type TokenProviderFunc func(context.Context) (Token, error)

// RetrieveBearerToken calls the wrapped function, returning the Token or
// error.
func (fn TokenProviderFunc) RetrieveBearerToken(ctx context.Context) (Token, error) {
	return fn(ctx)
}

// StaticTokenProvider provides a utility for wrapping a static bearer token
// value within an implementation of a token provider.
type StaticTokenProvider struct {
	Token Token
}

// RetrieveBearerToken returns the static token specified.
func (s StaticTokenProvider) RetrieveBearerToken(context.Context) (Token, error) {
	return s.Token, nil
}
