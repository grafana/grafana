package authn

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"google.golang.org/grpc/metadata"

	"github.com/grafana/authlib/types"
)

// TokenProvider is used to extract tokens.
type TokenProvider interface {
	AccessToken(ctx context.Context) (string, bool)
	IDToken(ctx context.Context) (string, bool)
}

func NewHTTPTokenProvider(r *http.Request) HTTPTokenProvider {
	return HTTPTokenProvider{r}
}

// HTTPTokenProvider extract tokens from a http.Request.
// For access token it will try to extract it from `X-Access-Token` header.
// For id token it will try to extract it from `X-Grafana-id` header.
type HTTPTokenProvider struct {
	r *http.Request
}

func (p HTTPTokenProvider) AccessToken(_ context.Context) (string, bool) {
	// Strip the 'Bearer' prefix if it exists.
	token := strings.TrimPrefix(p.r.Header.Get(httpHeaderAccessToken), "Bearer ")
	return token, len(token) > 0

}

func (p HTTPTokenProvider) IDToken(_ context.Context) (string, bool) {
	// Strip the 'Bearer' prefix if it exists.
	token := strings.TrimPrefix(p.r.Header.Get(httpHeaderIDToken), "Bearer ")
	return token, len(token) > 0
}

func NewGRPCTokenProvider(md metadata.MD) GRPCTokenProvider {
	return GRPCTokenProvider{md}
}

// GRPCTokenProvider extract tokens from grpc metadata.
// For access token it will try to extract it using `X-Access-Token` key.
// For id token it will try to extract it using `X-Grafana-id` key.
type GRPCTokenProvider struct {
	md metadata.MD
}

func (p GRPCTokenProvider) AccessToken(_ context.Context) (string, bool) {
	values := p.md.Get(metadataKeyAccessToken)
	if len(values) == 0 {
		return "", false
	}

	token := values[0]
	return token, len(token) > 0
}

func (p GRPCTokenProvider) IDToken(_ context.Context) (string, bool) {
	// FIXME: we should use the same key as we do over http.
	values := p.md.Get(metadataKeyIDTokenMetadata)
	if len(values) == 0 {
		return "", false
	}

	token := values[0]
	return token, len(token) > 0
}

// Authenticator is used to authenticate request using the provided TokenProvider.
type Authenticator interface {
	Authenticate(ctx context.Context, provider TokenProvider) (types.AuthInfo, error)
}

var _ Authenticator = (*DefaultAuthenticator)(nil)

func NewDefaultAuthenticator(at *AccessTokenVerifier, id *IDTokenVerifier) *DefaultAuthenticator {
	return &DefaultAuthenticator{at, id}
}

// DefaultAuthenticator will try to authenticate using both access token and id token.
// Authnetication can be done with only a access token or with both access token and id token.
type DefaultAuthenticator struct {
	at *AccessTokenVerifier
	id *IDTokenVerifier
}

func (a *DefaultAuthenticator) Authenticate(ctx context.Context, provider TokenProvider) (types.AuthInfo, error) {
	atToken, ok := provider.AccessToken(ctx)
	if !ok {
		return nil, ErrMissingRequiredToken
	}

	atClaims, err := a.at.Verify(ctx, atToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify access token: %w", err)
	}

	idToken, ok := provider.IDToken(ctx)
	if !ok {
		return NewAccessTokenAuthInfo(*atClaims), nil
	}

	idClaims, err := a.id.Verify(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify id token: %w", err)
	}

	// verify that access token can operate in the same namespace as id token
	if !types.NamespaceMatches(atClaims.Rest.Namespace, idClaims.Rest.Namespace) {
		return nil, errors.New("namespace mismatch")
	}

	return NewIDTokenAuthInfo(*atClaims, idClaims), nil
}

var _ Authenticator = (*AccessTokenAuthenticator)(nil)

func NewAccessTokenAuthenticator(at *AccessTokenVerifier) *AccessTokenAuthenticator {
	return &AccessTokenAuthenticator{at}
}

// AccessTokenAuthenticator will authenticate using only the access token.
type AccessTokenAuthenticator struct {
	at *AccessTokenVerifier
}

func (a *AccessTokenAuthenticator) Authenticate(ctx context.Context, provider TokenProvider) (types.AuthInfo, error) {
	token, ok := provider.AccessToken(ctx)
	if !ok {
		return nil, ErrMissingRequiredToken
	}

	claims, err := a.at.Verify(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("failed to verify access token: %w", err)
	}

	return NewAccessTokenAuthInfo(*claims), nil
}
