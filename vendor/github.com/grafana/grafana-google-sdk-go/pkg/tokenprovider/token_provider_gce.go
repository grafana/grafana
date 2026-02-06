package tokenprovider

import (
	"context"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/impersonate"
)

type gceSource struct {
	cacheKey string
	scopes   []string
}

type impersonatedGceSource struct {
	cacheKey        string
	scopes          []string
	TargetPrincipal string
	Delegates       []string
	Subject         string
}

// NewGceAccessTokenProvider returns a token provider for gce authentication
func NewGceAccessTokenProvider(cfg Config) TokenProvider {
	return &tokenProviderImpl{
		tokenSource: &gceSource{
			cacheKey: createCacheKey("gce", &cfg),
			scopes:   cfg.Scopes,
		},
		cache: map[string]oauth2.Token{},
	}
}

// NewImpersonatedGceAccessTokenProvider returns a token provider for an impersonated service account when using gce authentication
func NewImpersonatedGceAccessTokenProvider(cfg Config) TokenProvider {
	return &tokenProviderImpl{
		tokenSource: &impersonatedGceSource{
			cacheKey:        createCacheKey("gce", &cfg),
			scopes:          append(cfg.Scopes, "https://www.googleapis.com/auth/cloud-platform"),
			TargetPrincipal: cfg.TargetPrincipal,
			Subject:         cfg.Subject,
			Delegates:       cfg.Delegates,
		},
		cache: map[string]oauth2.Token{},
	}
}

func (source *gceSource) getCacheKey() string {
	return source.cacheKey
}

func (source *gceSource) getToken(ctx context.Context) (*oauth2.Token, error) {
	tokenSource, err := google.DefaultTokenSource(ctx, source.scopes...)
	if err != nil {
		return nil, err
	}
	return tokenSource.Token()
}

func (source *impersonatedGceSource) getCacheKey() string {
	return source.cacheKey
}

func (source *impersonatedGceSource) getToken(ctx context.Context) (*oauth2.Token, error) {
	tokenSource, err := impersonate.CredentialsTokenSource(ctx, impersonate.CredentialsConfig{
		TargetPrincipal: source.TargetPrincipal,
		Scopes:          source.scopes,
		Delegates:       source.Delegates,
		Subject:         source.Subject,
	})
	if err != nil {
		return nil, err
	}
	return tokenSource.Token()
}
