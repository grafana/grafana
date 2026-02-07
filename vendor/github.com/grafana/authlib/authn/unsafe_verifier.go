package authn

import (
	"context"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
)

func NewUnsafeVerifier[T any](cfg VerifierConfig, typ TokenType) *UnsafeVerifierBase[T] {
	v := &UnsafeVerifierBase[T]{
		cfg:       cfg,
		tokenType: typ,
	}
	return v
}

type UnsafeVerifierBase[T any] struct {
	cfg       VerifierConfig
	tokenType TokenType
}

// Verify will parse and verify provided token, if `AllowedAudiences` was configured those will be validated as well.
func (v *UnsafeVerifierBase[T]) Verify(ctx context.Context, token string) (*Claims[T], error) {
	parsed, err := jwt.ParseSigned(token, tokenSignAlgs)
	if err != nil {
		return nil, ErrParseToken
	}

	if !validType(parsed, v.tokenType) {
		return nil, ErrInvalidTokenType
	}

	claims := Claims[T]{
		token: token, // hold on to the original token
	}

	if err := parsed.UnsafeClaimsWithoutVerification(&claims.Claims, &claims.Rest); err != nil {
		return nil, err
	}

	if err := claims.Validate(jwt.Expected{
		AnyAudience: jwt.Audience(v.cfg.AllowedAudiences),
		Time:        time.Now(),
	}); err != nil {
		return nil, mapErr(err)
	}

	return &claims, nil
}
