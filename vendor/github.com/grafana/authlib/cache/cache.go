package cache

import (
	"context"
	"errors"
	"time"

	gocache "github.com/patrickmn/go-cache"
)

const (
	NoExpiration      = gocache.NoExpiration
	DefaultExpiration = gocache.DefaultExpiration
)

var (
	ErrNotFound = errors.New("not found")
	ErrRead     = errors.New("could not read value at cache key")
)

// Cache allows the caller to set, get and delete items in the cache.
type Cache interface {
	// Get gets the cache value as an byte array
	Get(ctx context.Context, key string) ([]byte, error)

	// Set saves the value as an byte array. if `expire` is set to zero it will use the cache default expiration time.
	Set(ctx context.Context, key string, value []byte, expire time.Duration) error

	// Delete object from cache
	Delete(ctx context.Context, key string) error
}

type LocalCache struct {
	c *gocache.Cache
}

type Config struct {
	Expiry          time.Duration
	CleanupInterval time.Duration
}

func NewLocalCache(cfg Config) *LocalCache {
	return &LocalCache{c: gocache.New(cfg.Expiry, cfg.CleanupInterval)}
}

func (lc *LocalCache) Get(ctx context.Context, key string) ([]byte, error) {
	v, ok := lc.c.Get(key)
	if !ok {
		return nil, ErrNotFound
	}

	vA, ok := v.([]byte)
	if !ok {
		return nil, ErrRead
	}

	return vA, nil
}

func (lc *LocalCache) Set(ctx context.Context, key string, data []byte, exp time.Duration) error {
	lc.c.Set(key, data, exp)
	return nil
}

func (lc *LocalCache) Delete(ctx context.Context, key string) error {
	lc.c.Delete(key)
	return nil
}
