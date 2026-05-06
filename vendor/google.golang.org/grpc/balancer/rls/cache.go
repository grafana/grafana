/*
 *
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package rls

import (
	"container/list"
	"time"

	"github.com/google/uuid"
	estats "google.golang.org/grpc/experimental/stats"
	"google.golang.org/grpc/internal/backoff"
	internalgrpclog "google.golang.org/grpc/internal/grpclog"
	"google.golang.org/grpc/internal/grpcsync"
)

// cacheKey represents the key used to uniquely identify an entry in the data
// cache and in the pending requests map.
type cacheKey struct {
	// path is the full path of the incoming RPC request.
	path string
	// keys is a stringified version of the RLS request key map built using the
	// RLS keyBuilder. Since maps are not a type which is comparable in Go, it
	// cannot be part of the key for another map (entries in the data cache and
	// pending requests map are stored in maps).
	keys string
}

// cacheEntry wraps all the data to be stored in a data cache entry.
type cacheEntry struct {
	// childPolicyWrappers contains the list of child policy wrappers
	// corresponding to the targets returned by the RLS server for this entry.
	childPolicyWrappers []*childPolicyWrapper
	// headerData is received in the RLS response and is to be sent in the
	// X-Google-RLS-Data header for matching RPCs.
	headerData string
	// expiryTime is the absolute time at which this cache entry stops
	// being valid. When an RLS request succeeds, this is set to the current
	// time plus the max_age field from the LB policy config.
	expiryTime time.Time
	// staleTime is the absolute time after which this cache entry will be
	// proactively refreshed if an incoming RPC matches this entry. When an RLS
	// request succeeds, this is set to the current time plus the stale_age from
	// the LB policy config.
	staleTime time.Time
	// earliestEvictTime is the absolute time before which this entry should not
	// be evicted from the cache. When a cache entry is created, this is set to
	// the current time plus a default value of 5 seconds. This is required to
	// make sure that a new entry added to the cache is not evicted before the
	// RLS response arrives (usually when the cache is too small).
	earliestEvictTime time.Time

	// status stores the RPC status of the previous RLS request for this
	// entry. Picks for entries with a non-nil value for this field are failed
	// with the error stored here.
	status error
	// backoffState contains all backoff related state. When an RLS request
	// succeeds, backoffState is reset. This state moves between the data cache
	// and the pending requests map.
	backoffState *backoffState
	// backoffTime is the absolute time at which the backoff period for this
	// entry ends. When an RLS request fails, this is set to the current time
	// plus the backoff value returned by the backoffState. The backoff timer is
	// also setup with this value. No new RLS requests are sent out for this
	// entry until the backoff period ends.
	//
	// Set to zero time instant upon a successful RLS response.
	backoffTime time.Time
	// backoffExpiryTime is the absolute time at which an entry which has gone
	// through backoff stops being valid.  When an RLS request fails, this is
	// set to the current time plus twice the backoff time. The cache expiry
	// timer will only delete entries for which both expiryTime and
	// backoffExpiryTime are in the past.
	//
	// Set to zero time instant upon a successful RLS response.
	backoffExpiryTime time.Time

	// size stores the size of this cache entry. Used to enforce the cache size
	// specified in the LB policy configuration.
	size int64
}

// backoffState wraps all backoff related state associated with a cache entry.
type backoffState struct {
	// retries keeps track of the number of RLS failures, to be able to
	// determine the amount of time to backoff before the next attempt.
	retries int
	// bs is the exponential backoff implementation which returns the amount of
	// time to backoff, given the number of retries.
	bs backoff.Strategy
	// timer fires when the backoff period ends and incoming requests after this
	// will trigger a new RLS request.
	timer *time.Timer
}

// lru is a cache implementation with a least recently used eviction policy.
// Internally it uses a doubly linked list, with the least recently used element
// at the front of the list and the most recently used element at the back of
// the list. The value stored in this cache will be of type `cacheKey`.
//
// It is not safe for concurrent access.
type lru struct {
	ll *list.List

	// A map from the value stored in the lru to its underlying list element is
	// maintained to have a clean API. Without this, a subset of the lru's API
	// would accept/return cacheKey while another subset would accept/return
	// list elements.
	m map[cacheKey]*list.Element
}

// newLRU creates a new cache with a least recently used eviction policy.
func newLRU() *lru {
	return &lru{
		ll: list.New(),
		m:  make(map[cacheKey]*list.Element),
	}
}

func (l *lru) addEntry(key cacheKey) {
	e := l.ll.PushBack(key)
	l.m[key] = e
}

func (l *lru) makeRecent(key cacheKey) {
	e := l.m[key]
	l.ll.MoveToBack(e)
}

func (l *lru) removeEntry(key cacheKey) {
	e := l.m[key]
	l.ll.Remove(e)
	delete(l.m, key)
}

func (l *lru) getLeastRecentlyUsed() cacheKey {
	e := l.ll.Front()
	if e == nil {
		return cacheKey{}
	}
	return e.Value.(cacheKey)
}

// dataCache contains a cache of RLS data used by the LB policy to make routing
// decisions.
//
// The dataCache will be keyed by the request's path and keys, represented by
// the `cacheKey` type. It will maintain the cache keys in an `lru` and the
// cache data, represented by the `cacheEntry` type, in a native map.
//
// It is not safe for concurrent access.
type dataCache struct {
	maxSize         int64 // Maximum allowed size.
	currentSize     int64 // Current size.
	keys            *lru  // Cache keys maintained in lru order.
	entries         map[cacheKey]*cacheEntry
	logger          *internalgrpclog.PrefixLogger
	shutdown        *grpcsync.Event
	rlsServerTarget string

	// Read only after initialization.
	grpcTarget      string
	uuid            string
	metricsRecorder estats.MetricsRecorder
}

func newDataCache(size int64, logger *internalgrpclog.PrefixLogger, metricsRecorder estats.MetricsRecorder, grpcTarget string) *dataCache {
	return &dataCache{
		maxSize:         size,
		keys:            newLRU(),
		entries:         make(map[cacheKey]*cacheEntry),
		logger:          logger,
		shutdown:        grpcsync.NewEvent(),
		grpcTarget:      grpcTarget,
		uuid:            uuid.New().String(),
		metricsRecorder: metricsRecorder,
	}
}

// updateRLSServerTarget updates the RLS Server Target the RLS Balancer is
// configured with.
func (dc *dataCache) updateRLSServerTarget(rlsServerTarget string) {
	dc.rlsServerTarget = rlsServerTarget
}

// resize changes the maximum allowed size of the data cache.
//
// The return value indicates if an entry with a valid backoff timer was
// evicted. This is important to the RLS LB policy which would send a new picker
// on the channel to re-process any RPCs queued as a result of this backoff
// timer.
func (dc *dataCache) resize(size int64) (backoffCancelled bool) {
	if dc.shutdown.HasFired() {
		return false
	}

	backoffCancelled = false
	for dc.currentSize > size {
		key := dc.keys.getLeastRecentlyUsed()
		entry, ok := dc.entries[key]
		if !ok {
			// This should never happen.
			dc.logger.Errorf("cacheKey %+v not found in the cache while attempting to resize it", key)
			break
		}

		// When we encounter a cache entry whose minimum expiration time is in
		// the future, we abort the LRU pass, which may temporarily leave the
		// cache being too large. This is necessary to ensure that in cases
		// where the cache is too small, when we receive an RLS Response, we
		// keep the resulting cache entry around long enough for the pending
		// incoming requests to be re-processed through the new Picker. If we
		// didn't do this, then we'd risk throwing away each RLS response as we
		// receive it, in which case we would fail to actually route any of our
		// incoming requests.
		if entry.earliestEvictTime.After(time.Now()) {
			dc.logger.Warningf("cachekey %+v is too recent to be evicted. Stopping cache resizing for now", key)
			break
		}

		// Stop the backoff timer before evicting the entry.
		if entry.backoffState != nil && entry.backoffState.timer != nil {
			if entry.backoffState.timer.Stop() {
				entry.backoffState.timer = nil
				backoffCancelled = true
			}
		}
		dc.deleteAndCleanup(key, entry)
	}
	dc.maxSize = size
	return backoffCancelled
}

// evictExpiredEntries sweeps through the cache and deletes expired entries. An
// expired entry is one for which both the `expiryTime` and `backoffExpiryTime`
// fields are in the past.
//
// The return value indicates if any expired entries were evicted.
//
// The LB policy invokes this method periodically to purge expired entries.
func (dc *dataCache) evictExpiredEntries() bool {
	if dc.shutdown.HasFired() {
		return false
	}

	evicted := false
	for key, entry := range dc.entries {
		// Only evict entries for which both the data expiration time and
		// backoff expiration time fields are in the past.
		now := time.Now()
		if entry.expiryTime.After(now) || entry.backoffExpiryTime.After(now) {
			continue
		}
		dc.deleteAndCleanup(key, entry)
		evicted = true
	}
	return evicted
}

// resetBackoffState sweeps through the cache and for entries with a backoff
// state, the backoff timer is cancelled and the backoff state is reset. The
// return value indicates if any entries were mutated in this fashion.
//
// The LB policy invokes this method when the control channel moves from READY
// to TRANSIENT_FAILURE back to READY. See `monitorConnectivityState` method on
// the `controlChannel` type for more details.
func (dc *dataCache) resetBackoffState(newBackoffState *backoffState) bool {
	if dc.shutdown.HasFired() {
		return false
	}

	backoffReset := false
	for _, entry := range dc.entries {
		if entry.backoffState == nil {
			continue
		}
		if entry.backoffState.timer != nil {
			entry.backoffState.timer.Stop()
			entry.backoffState.timer = nil
		}
		entry.backoffState = &backoffState{bs: newBackoffState.bs}
		entry.backoffTime = time.Time{}
		entry.backoffExpiryTime = time.Time{}
		backoffReset = true
	}
	return backoffReset
}

// addEntry adds a cache entry for the given key.
//
// Return value backoffCancelled indicates if a cache entry with a valid backoff
// timer was evicted to make space for the current entry. This is important to
// the RLS LB policy which would send a new picker on the channel to re-process
// any RPCs queued as a result of this backoff timer.
//
// Return value ok indicates if entry was successfully added to the cache.
func (dc *dataCache) addEntry(key cacheKey, entry *cacheEntry) (backoffCancelled bool, ok bool) {
	if dc.shutdown.HasFired() {
		return false, false
	}

	// Handle the extremely unlikely case that a single entry is bigger than the
	// size of the cache.
	if entry.size > dc.maxSize {
		return false, false
	}
	dc.entries[key] = entry
	dc.currentSize += entry.size
	dc.keys.addEntry(key)
	// If the new entry makes the cache go over its configured size, remove some
	// old entries.
	if dc.currentSize > dc.maxSize {
		backoffCancelled = dc.resize(dc.maxSize)
	}
	cacheSizeMetric.Record(dc.metricsRecorder, dc.currentSize, dc.grpcTarget, dc.rlsServerTarget, dc.uuid)
	cacheEntriesMetric.Record(dc.metricsRecorder, int64(len(dc.entries)), dc.grpcTarget, dc.rlsServerTarget, dc.uuid)
	return backoffCancelled, true
}

// updateEntrySize updates the size of a cache entry and the current size of the
// data cache. An entry's size can change upon receipt of an RLS response.
func (dc *dataCache) updateEntrySize(entry *cacheEntry, newSize int64) {
	dc.currentSize -= entry.size
	entry.size = newSize
	dc.currentSize += entry.size
	cacheSizeMetric.Record(dc.metricsRecorder, dc.currentSize, dc.grpcTarget, dc.rlsServerTarget, dc.uuid)
}

func (dc *dataCache) getEntry(key cacheKey) *cacheEntry {
	if dc.shutdown.HasFired() {
		return nil
	}

	entry, ok := dc.entries[key]
	if !ok {
		return nil
	}
	dc.keys.makeRecent(key)
	return entry
}

func (dc *dataCache) removeEntryForTesting(key cacheKey) {
	entry, ok := dc.entries[key]
	if !ok {
		return
	}
	dc.deleteAndCleanup(key, entry)
}

// deleteAndCleanup performs actions required at the time of deleting an entry
// from the data cache.
// - the entry is removed from the map of entries
// - current size of the data cache is update
// - the key is removed from the LRU
func (dc *dataCache) deleteAndCleanup(key cacheKey, entry *cacheEntry) {
	delete(dc.entries, key)
	dc.currentSize -= entry.size
	dc.keys.removeEntry(key)
	cacheSizeMetric.Record(dc.metricsRecorder, dc.currentSize, dc.grpcTarget, dc.rlsServerTarget, dc.uuid)
	cacheEntriesMetric.Record(dc.metricsRecorder, int64(len(dc.entries)), dc.grpcTarget, dc.rlsServerTarget, dc.uuid)
}

func (dc *dataCache) stop() {
	for key, entry := range dc.entries {
		dc.deleteAndCleanup(key, entry)
	}
	dc.shutdown.Fire()
}
