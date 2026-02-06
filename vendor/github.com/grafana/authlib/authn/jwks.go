package authn

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-jose/go-jose/v4"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/authlib/cache"
)

type KeyRetriever interface {
	Get(ctx context.Context, keyID string) (*jose.JSONWebKey, error)
}

type DefaultKeyRetrieverOption func(*DefaultKeyRetriever)

// WithHTTPClientKeyRetrieverOpt allows setting the HTTP client to be used by the key retriever.
func WithHTTPClientKeyRetrieverOpt(client *http.Client) DefaultKeyRetrieverOption {
	return func(c *DefaultKeyRetriever) {
		c.client = client
	}
}

func WithKeyRetrieverCache(cache cache.Cache) DefaultKeyRetrieverOption {
	return func(c *DefaultKeyRetriever) {
		c.c = cache
	}
}

const (
	cacheTTL             = 10 * time.Minute
	cacheCleanupInterval = 10 * time.Minute
)

func NewKeyRetriever(cfg KeyRetrieverConfig, opt ...DefaultKeyRetrieverOption) *DefaultKeyRetriever {
	s := &DefaultKeyRetriever{
		cfg:    cfg,
		c:      nil, // See below.
		client: http.DefaultClient,
		s:      &singleflight.Group{},
	}

	for _, o := range opt {
		o(s)
	}

	// If the options did not set the cache, create a new local cache.
	//
	// This has to be done this way because the cache that is created by
	// the cache.NewLocalCache function spawns a goroutine that cannot be
	// trivially stopped. It is set up to stop when the object is garbage
	// collected, but in the general case, the calling code will not have
	// control over that.
	if s.c == nil {
		s.c = cache.NewLocalCache(cache.Config{
			Expiry:          cacheTTL,
			CleanupInterval: cacheCleanupInterval,
		})
	}

	return s
}

type DefaultKeyRetriever struct {
	cfg    KeyRetrieverConfig
	client *http.Client
	s      *singleflight.Group
	c      cache.Cache
}

func (s *DefaultKeyRetriever) Get(ctx context.Context, keyID string) (*jose.JSONWebKey, error) {
	jwk, ok := s.getCachedItem(ctx, keyID)
	if !ok {
		_, err, _ := s.s.Do("fetch", func() (interface{}, error) {
			jwks, err := s.fetchJWKS(ctx)
			if err != nil {
				return nil, err
			}

			for i := range jwks.Keys {
				s.setCachedItem(ctx, jwks.Keys[i])
			}

			return nil, nil
		})

		if err != nil {
			return nil, err
		}

		jwk, ok = s.getCachedItem(ctx, keyID)
		if !ok {
			// Key still don't exist after a re-fetch.
			// Cache the invalid key to prevent re-fetch
			// for known invalid keys.
			s.setEmptyCacheItem(ctx, keyID)
		}
	}

	if jwk == nil {
		return nil, ErrInvalidSigningKey
	}

	return jwk, nil
}

func (s *DefaultKeyRetriever) fetchJWKS(ctx context.Context) (*jose.JSONWebKeySet, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", s.cfg.SigningKeysURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: request error", ErrFetchingSigningKey)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, ErrFetchingSigningKey
	}

	var jwks jose.JSONWebKeySet
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, fmt.Errorf("%w: unable to decode response", ErrFetchingSigningKey)
	}

	return &jwks, nil
}

func (s *DefaultKeyRetriever) getCachedItem(ctx context.Context, keyID string) (*jose.JSONWebKey, bool) {
	data, err := s.c.Get(ctx, keyID)
	// error is a noop for local cache
	if err != nil {
		return nil, false
	}

	// we cache invalid keys as a empty byte slice
	if len(data) == 0 {
		return nil, true
	}

	var jwk jose.JSONWebKey
	// We should not fail to decode the jwk, all items in the cache are gob encoded [jose.JSONWebKey].
	if err := json.NewDecoder(bytes.NewReader(data)).Decode(&jwk); err != nil {
		return nil, false
	}

	return &jwk, true
}

func (s *DefaultKeyRetriever) setCachedItem(ctx context.Context, key jose.JSONWebKey) {
	buf := bytes.Buffer{}
	if err := json.NewEncoder(&buf).Encode(&key); err != nil {
		return
	}

	// Set cannot fail when using local cache
	_ = s.c.Set(ctx, key.KeyID, buf.Bytes(), cache.NoExpiration)
}

func (s *DefaultKeyRetriever) setEmptyCacheItem(ctx context.Context, keyID string) {
	// Set cannot fail when using local cache
	_ = s.c.Set(ctx, keyID, []byte{}, cacheTTL)
}
