package authn

import (
	"errors"
	"fmt"
)

var (
	ErrFetchingSigningKey = errors.New("unable to fetch signing keys")

	// Private error we wrap all other exported errors with
	errInvalidToken         = errors.New("invalid token")
	ErrParseToken           = fmt.Errorf("%w: failed to parse as jwt token", errInvalidToken)
	ErrExpiredToken         = fmt.Errorf("%w: expired token", errInvalidToken)
	ErrInvalidTokenType     = fmt.Errorf("%w: invalid token type", errInvalidToken)
	ErrInvalidSigningKey    = fmt.Errorf("%w: unrecognized signing key", errInvalidToken)
	ErrInvalidAudience      = fmt.Errorf("%w: invalid audience", errInvalidToken)
	ErrMissingRequiredToken = fmt.Errorf("%w: missing required token", errInvalidToken)

	ErrMissingConfig           = errors.New("missing config")
	ErrMissingNamespace        = errors.New("missing required namespace")
	ErrMissingAudiences        = errors.New("missing required audiences")
	ErrInvalidExchangeResponse = errors.New("invalid exchange response")
)

func IsUnauthenticatedErr(err error) bool {
	return errors.Is(err, errInvalidToken)
}
