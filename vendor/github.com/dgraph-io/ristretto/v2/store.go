/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package ristretto

import (
	"sync"
	"time"
)

type updateFn[V any] func(cur, prev V) bool

// TODO: Do we need this to be a separate struct from Item?
type storeItem[V any] struct {
	key        uint64
	conflict   uint64
	value      V
	expiration time.Time
}

// store is the interface fulfilled by all hash map implementations in this
// file. Some hash map implementations are better suited for certain data
// distributions than others, so this allows us to abstract that out for use
// in Ristretto.
//
// Every store is safe for concurrent usage.
type store[V any] interface {
	// Get returns the value associated with the key parameter.
	Get(uint64, uint64) (V, bool)
	// Expiration returns the expiration time for this key.
	Expiration(uint64) time.Time
	// Set adds the key-value pair to the Map or updates the value if it's
	// already present. The key-value pair is passed as a pointer to an
	// item object.
	Set(*Item[V])
	// Del deletes the key-value pair from the Map.
	Del(uint64, uint64) (uint64, V)
	// Update attempts to update the key with a new value and returns true if
	// successful.
	Update(*Item[V]) (V, bool)
	// Cleanup removes items that have an expired TTL.
	Cleanup(policy *defaultPolicy[V], onEvict func(item *Item[V]))
	// Clear clears all contents of the store.
	Clear(onEvict func(item *Item[V]))
	SetShouldUpdateFn(f updateFn[V])
}

// newStore returns the default store implementation.
func newStore[V any]() store[V] {
	return newShardedMap[V]()
}

const numShards uint64 = 256

type shardedMap[V any] struct {
	shards    []*lockedMap[V]
	expiryMap *expirationMap[V]
}

func newShardedMap[V any]() *shardedMap[V] {
	sm := &shardedMap[V]{
		shards:    make([]*lockedMap[V], int(numShards)),
		expiryMap: newExpirationMap[V](),
	}
	for i := range sm.shards {
		sm.shards[i] = newLockedMap[V](sm.expiryMap)
	}
	return sm
}

func (m *shardedMap[V]) SetShouldUpdateFn(f updateFn[V]) {
	for i := range m.shards {
		m.shards[i].setShouldUpdateFn(f)
	}
}

func (sm *shardedMap[V]) Get(key, conflict uint64) (V, bool) {
	return sm.shards[key%numShards].get(key, conflict)
}

func (sm *shardedMap[V]) Expiration(key uint64) time.Time {
	return sm.shards[key%numShards].Expiration(key)
}

func (sm *shardedMap[V]) Set(i *Item[V]) {
	if i == nil {
		// If item is nil make this Set a no-op.
		return
	}

	sm.shards[i.Key%numShards].Set(i)
}

func (sm *shardedMap[V]) Del(key, conflict uint64) (uint64, V) {
	return sm.shards[key%numShards].Del(key, conflict)
}

func (sm *shardedMap[V]) Update(newItem *Item[V]) (V, bool) {
	return sm.shards[newItem.Key%numShards].Update(newItem)
}

func (sm *shardedMap[V]) Cleanup(policy *defaultPolicy[V], onEvict func(item *Item[V])) {
	sm.expiryMap.cleanup(sm, policy, onEvict)
}

func (sm *shardedMap[V]) Clear(onEvict func(item *Item[V])) {
	for i := uint64(0); i < numShards; i++ {
		sm.shards[i].Clear(onEvict)
	}
	sm.expiryMap.clear()
}

type lockedMap[V any] struct {
	sync.RWMutex
	data         map[uint64]storeItem[V]
	em           *expirationMap[V]
	shouldUpdate updateFn[V]
}

func newLockedMap[V any](em *expirationMap[V]) *lockedMap[V] {
	return &lockedMap[V]{
		data: make(map[uint64]storeItem[V]),
		em:   em,
		shouldUpdate: func(cur, prev V) bool {
			return true
		},
	}
}

func (m *lockedMap[V]) setShouldUpdateFn(f updateFn[V]) {
	m.shouldUpdate = f
}

func (m *lockedMap[V]) get(key, conflict uint64) (V, bool) {
	m.RLock()
	item, ok := m.data[key]
	m.RUnlock()
	if !ok {
		return zeroValue[V](), false
	}
	if conflict != 0 && (conflict != item.conflict) {
		return zeroValue[V](), false
	}

	// Handle expired items.
	if !item.expiration.IsZero() && time.Now().After(item.expiration) {
		return zeroValue[V](), false
	}
	return item.value, true
}

func (m *lockedMap[V]) Expiration(key uint64) time.Time {
	m.RLock()
	defer m.RUnlock()
	return m.data[key].expiration
}

func (m *lockedMap[V]) Set(i *Item[V]) {
	if i == nil {
		// If the item is nil make this Set a no-op.
		return
	}

	m.Lock()
	defer m.Unlock()
	item, ok := m.data[i.Key]

	if ok {
		// The item existed already. We need to check the conflict key and reject the
		// update if they do not match. Only after that the expiration map is updated.
		if i.Conflict != 0 && (i.Conflict != item.conflict) {
			return
		}
		if m.shouldUpdate != nil && !m.shouldUpdate(i.Value, item.value) {
			return
		}
		m.em.update(i.Key, i.Conflict, item.expiration, i.Expiration)
	} else {
		// The value is not in the map already. There's no need to return anything.
		// Simply add the expiration map.
		m.em.add(i.Key, i.Conflict, i.Expiration)
	}

	m.data[i.Key] = storeItem[V]{
		key:        i.Key,
		conflict:   i.Conflict,
		value:      i.Value,
		expiration: i.Expiration,
	}
}

func (m *lockedMap[V]) Del(key, conflict uint64) (uint64, V) {
	m.Lock()
	defer m.Unlock()
	item, ok := m.data[key]
	if !ok {
		return 0, zeroValue[V]()
	}
	if conflict != 0 && (conflict != item.conflict) {
		return 0, zeroValue[V]()
	}

	if !item.expiration.IsZero() {
		m.em.del(key, item.expiration)
	}

	delete(m.data, key)
	return item.conflict, item.value
}

func (m *lockedMap[V]) Update(newItem *Item[V]) (V, bool) {
	m.Lock()
	defer m.Unlock()
	item, ok := m.data[newItem.Key]
	if !ok {
		return zeroValue[V](), false
	}
	if newItem.Conflict != 0 && (newItem.Conflict != item.conflict) {
		return zeroValue[V](), false
	}
	if m.shouldUpdate != nil && !m.shouldUpdate(newItem.Value, item.value) {
		return item.value, false
	}

	m.em.update(newItem.Key, newItem.Conflict, item.expiration, newItem.Expiration)
	m.data[newItem.Key] = storeItem[V]{
		key:        newItem.Key,
		conflict:   newItem.Conflict,
		value:      newItem.Value,
		expiration: newItem.Expiration,
	}

	return item.value, true
}

func (m *lockedMap[V]) Clear(onEvict func(item *Item[V])) {
	m.Lock()
	defer m.Unlock()
	i := &Item[V]{}
	if onEvict != nil {
		for _, si := range m.data {
			i.Key = si.key
			i.Conflict = si.conflict
			i.Value = si.value
			onEvict(i)
		}
	}
	m.data = make(map[uint64]storeItem[V])
}
