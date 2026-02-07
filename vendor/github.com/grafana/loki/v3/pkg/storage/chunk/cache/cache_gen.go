package cache

import (
	"context"

	"github.com/grafana/loki/v3/pkg/logqlmodel/stats"
)

type contextKey int

// cacheGenContextKey is used for setting a Cache Generation number in context.
const cacheGenContextKey contextKey = 0

// GenNumMiddleware adds gen number to keys from context. Expected size of gen numbers is upto 2 digits.
// If we start seeing problems with keys exceeding length limit, we need to look into resetting gen numbers.
type GenNumMiddleware struct {
	downstreamCache Cache
}

// NewCacheGenNumMiddleware creates a new GenNumMiddleware.
func NewCacheGenNumMiddleware(downstreamCache Cache) Cache {
	return &GenNumMiddleware{downstreamCache}
}

// Store adds cache gen number to keys before calling Store method of downstream cache.
func (c GenNumMiddleware) Store(ctx context.Context, keys []string, buf [][]byte) error {
	keys = addCacheGenNumToCacheKeys(ctx, keys)
	return c.downstreamCache.Store(ctx, keys, buf)
}

// Fetch adds cache gen number to keys before calling Fetch method of downstream cache.
// It also removes gen number before responding back with found and missing keys to make sure consumer of response gets to see same keys.
func (c GenNumMiddleware) Fetch(ctx context.Context, keys []string) (found []string, bufs [][]byte, missing []string, err error) {
	keys = addCacheGenNumToCacheKeys(ctx, keys)

	found, bufs, missing, err = c.downstreamCache.Fetch(ctx, keys)

	found = removeCacheGenNumFromKeys(ctx, found)
	missing = removeCacheGenNumFromKeys(ctx, missing)

	return
}

// Stop calls Stop method of downstream cache.
func (c GenNumMiddleware) Stop() {
	c.downstreamCache.Stop()
}

func (c GenNumMiddleware) GetCacheType() stats.CacheType {
	return c.downstreamCache.GetCacheType()
}

// InjectCacheGenNumber returns a derived context containing the cache gen.
func InjectCacheGenNumber(ctx context.Context, cacheGen string) context.Context {
	return context.WithValue(ctx, interface{}(cacheGenContextKey), cacheGen)
}

// ExtractCacheGenNumber gets the cache gen from the context.
func ExtractCacheGenNumber(ctx context.Context) string {
	cacheGenNumber, ok := ctx.Value(cacheGenContextKey).(string)
	if !ok {
		return ""
	}
	return cacheGenNumber
}

// addCacheGenNumToCacheKeys adds gen number to keys as prefix.
func addCacheGenNumToCacheKeys(ctx context.Context, keys []string) []string {
	cacheGen := ExtractCacheGenNumber(ctx)
	if cacheGen == "" {
		return keys
	}

	prefixedKeys := make([]string, len(keys))

	for i := range keys {
		prefixedKeys[i] = cacheGen + keys[i]
	}

	return prefixedKeys
}

// removeCacheGenNumFromKeys removes prefixed gen number from keys.
func removeCacheGenNumFromKeys(ctx context.Context, keys []string) []string {
	cacheGen := ExtractCacheGenNumber(ctx)
	if cacheGen == "" {
		return keys
	}

	unprefixedKeys := make([]string, len(keys))
	cacheGenPrefixLen := len(cacheGen)

	for i := range keys {
		unprefixedKeys[i] = keys[i][cacheGenPrefixLen:]
	}

	return unprefixedKeys
}
