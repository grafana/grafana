package tokenprovider

import (
	"context"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"
	"google.golang.org/api/impersonate"
	"google.golang.org/api/option"
)

type jwtSource struct {
	cacheKey string
	conf     jwt.Config
}

type impersonatedJwtSource struct {
	cacheKey        string
	conf            jwt.Config
	TargetPrincipal string
	Subject         string
	Delegates       []string
}

// NewJwtAccessTokenProvider returns a token provider for jwt file authentication
func NewJwtAccessTokenProvider(cfg Config) TokenProvider {
	return &tokenProviderImpl{
		tokenSource: &jwtSource{
			cacheKey: createCacheKey("jwt", &cfg),
			conf: jwt.Config{
				Email:      cfg.JwtTokenConfig.Email,
				PrivateKey: cfg.JwtTokenConfig.PrivateKey,
				TokenURL:   cfg.JwtTokenConfig.URI,
				Scopes:     cfg.Scopes,
			},
		},
		cache: map[string]oauth2.Token{},
	}
}

// NewJwtAccessTokenProvider returns a token provider for an impersonated service account when using jwt file authentication
func NewImpersonatedJwtAccessTokenProvider(cfg Config) TokenProvider {
	return &tokenProviderImpl{
		tokenSource: &impersonatedJwtSource{
			cacheKey: createCacheKey("jwt", &cfg),
			conf: jwt.Config{
				Email:      cfg.JwtTokenConfig.Email,
				PrivateKey: cfg.JwtTokenConfig.PrivateKey,
				TokenURL:   cfg.JwtTokenConfig.URI,
				Scopes:     append(cfg.Scopes, "https://www.googleapis.com/auth/cloud-platform"),
			},
			TargetPrincipal: cfg.TargetPrincipal,
			Subject:         cfg.Subject,
			Delegates:       cfg.Delegates,
		},
		cache: map[string]oauth2.Token{},
	}
}

func (source *jwtSource) getCacheKey() string {
	return source.cacheKey
}

func (source *jwtSource) getToken(ctx context.Context) (*oauth2.Token, error) {
	return getTokenSource(ctx, &source.conf).Token()
}

func (source *impersonatedJwtSource) getCacheKey() string {
	return source.cacheKey
}

func (source *impersonatedJwtSource) getToken(ctx context.Context) (*oauth2.Token, error) {
	baseTokenSource := getTokenSource(ctx, &source.conf)
	tokenSource, err := impersonate.CredentialsTokenSource(ctx, impersonate.CredentialsConfig{
		TargetPrincipal: source.TargetPrincipal,
		Scopes:          source.conf.Scopes,
		Subject:         source.Subject,
		Delegates:       source.Delegates,
	}, option.WithTokenSource(baseTokenSource))
	if err != nil {
		return nil, err
	}
	return tokenSource.Token()
}

// getTokenSource returns a TokenSource.
// Stubbable by tests.
var getTokenSource = func(ctx context.Context, conf *jwt.Config) oauth2.TokenSource {
	return conf.TokenSource(ctx)
}
