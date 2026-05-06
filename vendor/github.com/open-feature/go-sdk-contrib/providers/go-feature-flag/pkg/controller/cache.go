package controller

import (
	"fmt"
	"github.com/bluele/gcache"
	of "github.com/open-feature/go-sdk/openfeature"
	"hash/fnv"
	"time"
)

const defaultCacheSize = 10000
const defaultCacheTTL = 1 * time.Minute

type Cache struct {
	internalCache    gcache.Cache
	maxEventInMemory int64
	ttl              time.Duration
	disabled         bool
}

// NewCache creates a new cache with the given options.
func NewCache(cacheSize int, ttl time.Duration, disabled bool) *Cache {
	if cacheSize == 0 {
		cacheSize = defaultCacheSize
	}
	if ttl == 0 {
		ttl = defaultCacheTTL
	}
	c := &Cache{
		ttl:      ttl,
		disabled: disabled,
	}
	if cacheSize > 0 && !disabled {
		c.internalCache = gcache.New(cacheSize).
			LRU().
			Build()
	}
	return c
}

// GetBool returns the boolean value of the flag from the cache.
func (c *Cache) GetBool(flag string, evalCtx of.FlattenedContext) (*of.BoolResolutionDetail, error) {
	if c.disabled || c.internalCache == nil {
		return nil, nil
	}
	cacheValue, err := c.internalCache.Get(c.buildCacheKey(flag, evalCtx))
	if err != nil {
		return nil, err
	}
	if value, ok := cacheValue.(of.BoolResolutionDetail); ok {
		return &value, nil
	}
	return nil, fmt.Errorf("unexpected type in cache (expecting bool)")
}

// GetString returns the string value of the flag from the cache.
func (c *Cache) GetString(flag string, evalCtx of.FlattenedContext) (*of.StringResolutionDetail, error) {
	if c.disabled || c.internalCache == nil {
		return nil, nil
	}
	cacheValue, err := c.internalCache.Get(c.buildCacheKey(flag, evalCtx))
	if err != nil {
		return nil, err
	}
	if value, ok := cacheValue.(of.StringResolutionDetail); ok {
		return &value, nil
	}
	return nil, fmt.Errorf("unexpected type in cache (expecting string)")
}

// GetFloat returns the float value of the flag from the cache.
func (c *Cache) GetFloat(flag string, evalCtx of.FlattenedContext) (*of.FloatResolutionDetail, error) {
	if c.disabled || c.internalCache == nil {
		return nil, nil
	}
	cacheValue, err := c.internalCache.Get(c.buildCacheKey(flag, evalCtx))
	if err != nil {
		return nil, err
	}
	if value, ok := cacheValue.(of.FloatResolutionDetail); ok {
		return &value, nil
	}
	return nil, fmt.Errorf("unexpected type in cache (expecting float)")
}

// GetInt returns the int value of the flag from the cache.
func (c *Cache) GetInt(flag string, evalCtx of.FlattenedContext) (*of.IntResolutionDetail, error) {
	if c.disabled || c.internalCache == nil {
		return nil, nil
	}
	cacheValue, err := c.internalCache.Get(c.buildCacheKey(flag, evalCtx))
	if err != nil {
		return nil, err
	}
	if value, ok := cacheValue.(of.IntResolutionDetail); ok {
		return &value, nil
	}
	return nil, fmt.Errorf("unexpected type in cache (expecting int)")
}

// GetInterface returns the interface value of the flag from the cache.
func (c *Cache) GetInterface(flag string, evalCtx of.FlattenedContext) (*of.InterfaceResolutionDetail, error) {
	if c.disabled || c.internalCache == nil {
		return nil, nil
	}
	cacheValue, err := c.internalCache.Get(c.buildCacheKey(flag, evalCtx))
	if err != nil {
		return nil, err
	}
	if value, ok := cacheValue.(of.InterfaceResolutionDetail); ok {
		return &value, nil
	}
	return nil, fmt.Errorf("unexpected type in cache (expecting interface)")
}

// Set sets the value of the flag in the cache.
func (c *Cache) Set(flag string, evalCtx of.FlattenedContext, value interface{}) error {
	if c.disabled || c.internalCache == nil {
		return nil
	}
	if c.ttl >= 0 {
		return c.internalCache.SetWithExpire(c.buildCacheKey(flag, evalCtx), value, c.ttl)
	}
	return c.internalCache.Set(c.buildCacheKey(flag, evalCtx), value)
}

func (c *Cache) Purge() {
	if c.internalCache != nil {
		c.internalCache.Purge()
	}
}

// buildCacheKey builds a cache key from the flag and evaluation context.
func (c *Cache) buildCacheKey(flag string, evalCtx of.FlattenedContext) uint32 {
	key := fmt.Sprintf("%s-%+v", flag, evalCtx)
	h := fnv.New32a()
	_, _ = h.Write([]byte(key))
	return h.Sum32()
}
