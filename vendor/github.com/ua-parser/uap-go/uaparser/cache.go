package uaparser

import lru "github.com/hashicorp/golang-lru"

// cache caches user-agent properties.
// Without the cache, the parser performs hundreds of expensive regex operations,
// taking 10+ ms. This can lead to significant performance degradation when UA parsing is
// done on a per-request basis.
type cache struct {
	device    *lru.ARCCache
	os        *lru.ARCCache
	userAgent *lru.ARCCache
}

func newCache() *cache {
	var (
		c   cache
		err error
	)
	const cacheSize = 1024
	// NewARC only fails when cacheSize <= 0.
	// Also, returning an error up the stack would break the API.
	c.device, err = lru.NewARC(cacheSize)
	if err != nil {
		panic(err)
	}
	c.os, err = lru.NewARC(cacheSize)
	if err != nil {
		panic(err)
	}
	c.userAgent, err = lru.NewARC(cacheSize)
	if err != nil {
		panic(err)
	}
	return &c
}
