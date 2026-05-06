package config

import (
	"time"
)

type CacheSettings struct {
	CheckCacheLimit                    uint32
	CacheControllerEnabled             bool
	CacheControllerTTL                 time.Duration
	CheckQueryCacheEnabled             bool
	CheckQueryCacheTTL                 time.Duration
	CheckIteratorCacheEnabled          bool
	CheckIteratorCacheMaxResults       uint32
	CheckIteratorCacheTTL              time.Duration
	ListObjectsIteratorCacheEnabled    bool
	ListObjectsIteratorCacheMaxResults uint32
	ListObjectsIteratorCacheTTL        time.Duration
	SharedIteratorEnabled              bool
	SharedIteratorLimit                uint32
	SharedIteratorTTL                  time.Duration
}

func NewDefaultCacheSettings() CacheSettings {
	return CacheSettings{
		CheckCacheLimit:                    DefaultCheckCacheLimit,
		CacheControllerEnabled:             DefaultCacheControllerEnabled,
		CacheControllerTTL:                 DefaultCacheControllerTTL,
		CheckQueryCacheEnabled:             DefaultCheckQueryCacheEnabled,
		CheckQueryCacheTTL:                 DefaultCheckQueryCacheTTL,
		CheckIteratorCacheEnabled:          DefaultCheckIteratorCacheEnabled,
		CheckIteratorCacheMaxResults:       DefaultCheckIteratorCacheMaxResults,
		CheckIteratorCacheTTL:              DefaultCheckIteratorCacheTTL,
		ListObjectsIteratorCacheEnabled:    DefaultListObjectsIteratorCacheEnabled,
		ListObjectsIteratorCacheMaxResults: DefaultListObjectsIteratorCacheMaxResults,
		ListObjectsIteratorCacheTTL:        DefaultListObjectsIteratorCacheTTL,
		SharedIteratorEnabled:              DefaultSharedIteratorEnabled,
		SharedIteratorLimit:                DefaultSharedIteratorLimit,
		SharedIteratorTTL:                  DefaultSharedIteratorTTL,
	}
}

func (c CacheSettings) ShouldCreateNewCache() bool {
	return c.ShouldCacheCheckQueries() || c.ShouldCacheCheckIterators() || c.ShouldCacheListObjectsIterators()
}

func (c CacheSettings) ShouldCreateCacheController() bool {
	return c.ShouldCreateNewCache() && c.CacheControllerEnabled
}

func (c CacheSettings) ShouldCacheCheckQueries() bool {
	return c.CheckCacheLimit > 0 && c.CheckQueryCacheEnabled
}

func (c CacheSettings) ShouldCacheCheckIterators() bool {
	return c.CheckCacheLimit > 0 && c.CheckIteratorCacheEnabled
}

func (c CacheSettings) ShouldCacheListObjectsIterators() bool {
	return c.ListObjectsIteratorCacheEnabled && c.ListObjectsIteratorCacheMaxResults > 0
}

func (c CacheSettings) ShouldCreateShadowNewCache() bool {
	return c.ShouldCreateNewCache()
}

// ShouldCreateShadowCacheController determines if a new shadow cache controller should be created.
// A shadow cache controller is created if the cache controller is enabled.
func (c CacheSettings) ShouldCreateShadowCacheController() bool {
	return c.ShouldCreateCacheController()
}

// ShouldShadowCacheListObjectsIterators returns true if a shadow cache for list objects iterators should be created.
// A shadow cache for list objects iterators is created if list objects iterators caching is enabled.
func (c CacheSettings) ShouldShadowCacheListObjectsIterators() bool {
	return c.ShouldCacheListObjectsIterators()
}
