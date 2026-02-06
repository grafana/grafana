package ring

import (
	"fmt"
	"math"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
)

// shuffleShardCacheStorage is a generic interface for cache storage.
// This abstracts the difference between map-based and LRU-based storage.
type shuffleShardCacheStorage[V any] interface {
	get(key subringCacheKey) (V, bool)
	set(key subringCacheKey, value V)
	len() int
}

// partitionRingShuffleShardCache delegates storage operations to two generic cache storage implementations.
// All cache operations are protected by a mutex to ensure thread-safety for compound operations
// like check-then-act patterns (e.g., in setSubringWithLookback).
type partitionRingShuffleShardCache struct {
	mtx                  sync.RWMutex
	cacheWithoutLookback shuffleShardCacheStorage[*PartitionRing]
	cacheWithLookback    shuffleShardCacheStorage[cachedSubringWithLookback[*PartitionRing]]
}

// newPartitionRingShuffleShardCache creates a new partition ring shuffle shard cache.
// If size <= 0 an unbounded map-based cache is used.
// If size > 0, an LRU cache with the specified size is used.
func newPartitionRingShuffleShardCache(size int) (*partitionRingShuffleShardCache, error) {
	var cacheWithoutLookback shuffleShardCacheStorage[*PartitionRing]
	var cacheWithLookback shuffleShardCacheStorage[cachedSubringWithLookback[*PartitionRing]]

	if size > 0 {
		var err error
		cacheWithoutLookback, err = newLRUCacheStorage[*PartitionRing](size)
		if err != nil {
			return nil, fmt.Errorf("failed to create without lookback cache: %w", err)
		}
		cacheWithLookback, err = newLRUCacheStorage[cachedSubringWithLookback[*PartitionRing]](size)
		if err != nil {
			return nil, fmt.Errorf("failed to create with lookback cache: %w", err)
		}
	} else {
		cacheWithoutLookback = newMapCacheStorage[*PartitionRing]()
		cacheWithLookback = newMapCacheStorage[cachedSubringWithLookback[*PartitionRing]]()
	}

	return &partitionRingShuffleShardCache{
		cacheWithoutLookback: cacheWithoutLookback,
		cacheWithLookback:    cacheWithLookback,
	}, nil
}

func (r *partitionRingShuffleShardCache) setSubring(identifier string, size int, subring *PartitionRing) {
	if subring == nil {
		return
	}

	r.mtx.Lock()
	defer r.mtx.Unlock()

	r.cacheWithoutLookback.set(subringCacheKey{identifier: identifier, shardSize: size}, subring)
}

func (r *partitionRingShuffleShardCache) getSubring(identifier string, size int) *PartitionRing {
	r.mtx.RLock()
	defer r.mtx.RUnlock()

	cached, ok := r.cacheWithoutLookback.get(subringCacheKey{identifier: identifier, shardSize: size})
	if !ok {
		return nil
	}

	return cached
}

func (r *partitionRingShuffleShardCache) setSubringWithLookback(identifier string, size int, lookbackPeriod time.Duration, now time.Time, subring *PartitionRing) {
	if subring == nil {
		return
	}

	var (
		lookbackWindowStart                   = now.Add(-lookbackPeriod).Unix()
		validForLookbackWindowsStartingBefore = int64(math.MaxInt64)
	)

	for _, partition := range subring.desc.Partitions {
		stateChangedDuringLookbackWindow := partition.StateTimestamp >= lookbackWindowStart

		if stateChangedDuringLookbackWindow && partition.StateTimestamp < validForLookbackWindowsStartingBefore {
			validForLookbackWindowsStartingBefore = partition.StateTimestamp
		}
	}

	// Only update cache if subring's lookback window starts later than the previously cached subring for this identifier,
	// if there is one. This prevents cache thrashing due to different calls competing if their lookback windows start
	// before and after the time a partition state has changed.
	key := subringCacheKey{identifier: identifier, shardSize: size, lookbackPeriod: lookbackPeriod}

	r.mtx.Lock()
	defer r.mtx.Unlock()

	if existingEntry, haveCached := r.cacheWithLookback.get(key); !haveCached || existingEntry.validForLookbackWindowsStartingAfter < lookbackWindowStart {
		r.cacheWithLookback.set(key, cachedSubringWithLookback[*PartitionRing]{
			subring:                               subring,
			validForLookbackWindowsStartingAfter:  lookbackWindowStart,
			validForLookbackWindowsStartingBefore: validForLookbackWindowsStartingBefore,
		})
	}
}

func (r *partitionRingShuffleShardCache) getSubringWithLookback(identifier string, size int, lookbackPeriod time.Duration, now time.Time) *PartitionRing {
	r.mtx.RLock()
	defer r.mtx.RUnlock()

	cached, ok := r.cacheWithLookback.get(subringCacheKey{identifier: identifier, shardSize: size, lookbackPeriod: lookbackPeriod})
	if !ok {
		return nil
	}

	lookbackWindowStart := now.Add(-lookbackPeriod).Unix()
	if lookbackWindowStart < cached.validForLookbackWindowsStartingAfter || lookbackWindowStart > cached.validForLookbackWindowsStartingBefore {
		// The cached subring is not valid for the lookback window that has been requested.
		return nil
	}

	return cached.subring
}

// mapCacheStorage is a generic map-based implementation of shuffleShardCacheStorage.
// Note: This implementation does not have its own mutex because thread-safety is guaranteed
// by the mutex in partitionRingShuffleShardCache.
type mapCacheStorage[V any] struct {
	cache map[subringCacheKey]V
}

var _ shuffleShardCacheStorage[*PartitionRing] = (*mapCacheStorage[*PartitionRing])(nil)

func newMapCacheStorage[V any]() *mapCacheStorage[V] {
	return &mapCacheStorage[V]{
		cache: make(map[subringCacheKey]V),
	}
}

func (s *mapCacheStorage[V]) get(key subringCacheKey) (V, bool) { //nolint:unused
	cached, ok := s.cache[key]
	return cached, ok
}

func (s *mapCacheStorage[V]) set(key subringCacheKey, value V) { //nolint:unused
	s.cache[key] = value
}

func (s *mapCacheStorage[V]) len() int { //nolint:unused
	return len(s.cache)
}

// lruCacheStorage is a generic LRU-based implementation of shuffleShardCacheStorage.
type lruCacheStorage[V any] struct {
	cache *lru.Cache[subringCacheKey, V]
}

var _ shuffleShardCacheStorage[*PartitionRing] = (*lruCacheStorage[*PartitionRing])(nil)

func newLRUCacheStorage[V any](size int) (*lruCacheStorage[V], error) {
	cache, err := lru.New[subringCacheKey, V](size)
	if err != nil {
		return nil, err
	}
	return &lruCacheStorage[V]{cache: cache}, nil
}

func (s *lruCacheStorage[V]) get(key subringCacheKey) (V, bool) { //nolint:unused
	return s.cache.Get(key)
}

func (s *lruCacheStorage[V]) set(key subringCacheKey, value V) { //nolint:unused
	s.cache.Add(key, value)
}

func (s *lruCacheStorage[V]) len() int { //nolint:unused
	return s.cache.Len()
}
