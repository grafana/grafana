// Copyright (c) 2023 Alexey Mayshev. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package otter

import (
	"errors"
	"time"

	"github.com/maypok86/otter/internal/core"
)

const (
	unsetCapacity = -1
)

var (
	// ErrIllegalCapacity means that a non-positive capacity has been passed to the NewBuilder.
	ErrIllegalCapacity = errors.New("capacity should be positive")
	// ErrIllegalInitialCapacity means that a non-positive capacity has been passed to the Builder.InitialCapacity.
	ErrIllegalInitialCapacity = errors.New("initial capacity should be positive")
	// ErrNilCostFunc means that a nil cost func has been passed to the Builder.Cost.
	ErrNilCostFunc = errors.New("setCostFunc func should not be nil")
	// ErrIllegalTTL means that a non-positive ttl has been passed to the Builder.WithTTL.
	ErrIllegalTTL = errors.New("ttl should be positive")
)

type baseOptions[K comparable, V any] struct {
	capacity         int
	initialCapacity  int
	statsEnabled     bool
	withCost         bool
	costFunc         func(key K, value V) uint32
	deletionListener func(key K, value V, cause DeletionCause)
}

func (o *baseOptions[K, V]) collectStats() {
	o.statsEnabled = true
}

func (o *baseOptions[K, V]) setCostFunc(costFunc func(key K, value V) uint32) {
	o.costFunc = costFunc
	o.withCost = true
}

func (o *baseOptions[K, V]) setInitialCapacity(initialCapacity int) {
	o.initialCapacity = initialCapacity
}

func (o *baseOptions[K, V]) setDeletionListener(deletionListener func(key K, value V, cause DeletionCause)) {
	o.deletionListener = deletionListener
}

func (o *baseOptions[K, V]) validate() error {
	if o.initialCapacity <= 0 && o.initialCapacity != unsetCapacity {
		return ErrIllegalInitialCapacity
	}
	if o.costFunc == nil {
		return ErrNilCostFunc
	}
	return nil
}

func (o *baseOptions[K, V]) toConfig() core.Config[K, V] {
	var initialCapacity *int
	if o.initialCapacity != unsetCapacity {
		initialCapacity = &o.initialCapacity
	}
	return core.Config[K, V]{
		Capacity:         o.capacity,
		InitialCapacity:  initialCapacity,
		StatsEnabled:     o.statsEnabled,
		CostFunc:         o.costFunc,
		WithCost:         o.withCost,
		DeletionListener: o.deletionListener,
	}
}

type constTTLOptions[K comparable, V any] struct {
	baseOptions[K, V]
	ttl time.Duration
}

func (o *constTTLOptions[K, V]) validate() error {
	if o.ttl <= 0 {
		return ErrIllegalTTL
	}
	return o.baseOptions.validate()
}

func (o *constTTLOptions[K, V]) toConfig() core.Config[K, V] {
	c := o.baseOptions.toConfig()
	c.TTL = &o.ttl
	return c
}

type variableTTLOptions[K comparable, V any] struct {
	baseOptions[K, V]
}

func (o *variableTTLOptions[K, V]) toConfig() core.Config[K, V] {
	c := o.baseOptions.toConfig()
	c.WithVariableTTL = true
	return c
}

// Builder is a one-shot builder for creating a cache instance.
type Builder[K comparable, V any] struct {
	baseOptions[K, V]
}

// MustBuilder creates a builder and sets the future cache capacity.
//
// Panics if capacity <= 0.
func MustBuilder[K comparable, V any](capacity int) *Builder[K, V] {
	b, err := NewBuilder[K, V](capacity)
	if err != nil {
		panic(err)
	}
	return b
}

// NewBuilder creates a builder and sets the future cache capacity.
//
// Returns an error if capacity <= 0.
func NewBuilder[K comparable, V any](capacity int) (*Builder[K, V], error) {
	if capacity <= 0 {
		return nil, ErrIllegalCapacity
	}

	return &Builder[K, V]{
		baseOptions: baseOptions[K, V]{
			capacity:        capacity,
			initialCapacity: unsetCapacity,
			statsEnabled:    false,
			costFunc: func(key K, value V) uint32 {
				return 1
			},
		},
	}, nil
}

// CollectStats determines whether statistics should be calculated when the cache is running.
//
// By default, statistics calculating is disabled.
func (b *Builder[K, V]) CollectStats() *Builder[K, V] {
	b.collectStats()
	return b
}

// InitialCapacity sets the minimum total size for the internal data structures. Providing a large enough estimate
// at construction time avoids the need for expensive resizing operations later, but setting this
// value unnecessarily high wastes memory.
func (b *Builder[K, V]) InitialCapacity(initialCapacity int) *Builder[K, V] {
	b.setInitialCapacity(initialCapacity)
	return b
}

// Cost sets a function to dynamically calculate the cost of an item.
//
// By default, this function always returns 1.
func (b *Builder[K, V]) Cost(costFunc func(key K, value V) uint32) *Builder[K, V] {
	b.setCostFunc(costFunc)
	return b
}

// DeletionListener specifies a listener instance that caches should notify each time an entry is deleted for any
// DeletionCause cause. The cache will invoke this listener in the background goroutine
// after the entry's deletion operation has completed.
func (b *Builder[K, V]) DeletionListener(deletionListener func(key K, value V, cause DeletionCause)) *Builder[K, V] {
	b.setDeletionListener(deletionListener)
	return b
}

// WithTTL specifies that each item should be automatically removed from the cache once a fixed duration
// has elapsed after the item's creation.
func (b *Builder[K, V]) WithTTL(ttl time.Duration) *ConstTTLBuilder[K, V] {
	return &ConstTTLBuilder[K, V]{
		constTTLOptions[K, V]{
			baseOptions: b.baseOptions,
			ttl:         ttl,
		},
	}
}

// WithVariableTTL specifies that each item should be automatically removed from the cache once a duration has
// elapsed after the item's creation. Items are expired based on the custom ttl specified for each item separately.
//
// You should prefer WithTTL to this option whenever possible.
func (b *Builder[K, V]) WithVariableTTL() *VariableTTLBuilder[K, V] {
	return &VariableTTLBuilder[K, V]{
		variableTTLOptions[K, V]{
			baseOptions: b.baseOptions,
		},
	}
}

// Build creates a configured cache or
// returns an error if invalid parameters were passed to the builder.
func (b *Builder[K, V]) Build() (Cache[K, V], error) {
	if err := b.validate(); err != nil {
		return Cache[K, V]{}, err
	}

	return newCache(b.toConfig()), nil
}

// ConstTTLBuilder is a one-shot builder for creating a cache instance.
type ConstTTLBuilder[K comparable, V any] struct {
	constTTLOptions[K, V]
}

// CollectStats determines whether statistics should be calculated when the cache is running.
//
// By default, statistics calculating is disabled.
func (b *ConstTTLBuilder[K, V]) CollectStats() *ConstTTLBuilder[K, V] {
	b.collectStats()
	return b
}

// InitialCapacity sets the minimum total size for the internal data structures. Providing a large enough estimate
// at construction time avoids the need for expensive resizing operations later, but setting this
// value unnecessarily high wastes memory.
func (b *ConstTTLBuilder[K, V]) InitialCapacity(initialCapacity int) *ConstTTLBuilder[K, V] {
	b.setInitialCapacity(initialCapacity)
	return b
}

// Cost sets a function to dynamically calculate the cost of an item.
//
// By default, this function always returns 1.
func (b *ConstTTLBuilder[K, V]) Cost(costFunc func(key K, value V) uint32) *ConstTTLBuilder[K, V] {
	b.setCostFunc(costFunc)
	return b
}

// DeletionListener specifies a listener instance that caches should notify each time an entry is deleted for any
// DeletionCause cause. The cache will invoke this listener in the background goroutine
// after the entry's deletion operation has completed.
func (b *ConstTTLBuilder[K, V]) DeletionListener(deletionListener func(key K, value V, cause DeletionCause)) *ConstTTLBuilder[K, V] {
	b.setDeletionListener(deletionListener)
	return b
}

// Build creates a configured cache or
// returns an error if invalid parameters were passed to the builder.
func (b *ConstTTLBuilder[K, V]) Build() (Cache[K, V], error) {
	if err := b.validate(); err != nil {
		return Cache[K, V]{}, err
	}

	return newCache(b.toConfig()), nil
}

// VariableTTLBuilder is a one-shot builder for creating a cache instance.
type VariableTTLBuilder[K comparable, V any] struct {
	variableTTLOptions[K, V]
}

// CollectStats determines whether statistics should be calculated when the cache is running.
//
// By default, statistics calculating is disabled.
func (b *VariableTTLBuilder[K, V]) CollectStats() *VariableTTLBuilder[K, V] {
	b.collectStats()
	return b
}

// InitialCapacity sets the minimum total size for the internal data structures. Providing a large enough estimate
// at construction time avoids the need for expensive resizing operations later, but setting this
// value unnecessarily high wastes memory.
func (b *VariableTTLBuilder[K, V]) InitialCapacity(initialCapacity int) *VariableTTLBuilder[K, V] {
	b.setInitialCapacity(initialCapacity)
	return b
}

// Cost sets a function to dynamically calculate the cost of an item.
//
// By default, this function always returns 1.
func (b *VariableTTLBuilder[K, V]) Cost(costFunc func(key K, value V) uint32) *VariableTTLBuilder[K, V] {
	b.setCostFunc(costFunc)
	return b
}

// DeletionListener specifies a listener instance that caches should notify each time an entry is deleted for any
// DeletionCause cause. The cache will invoke this listener in the background goroutine
// after the entry's deletion operation has completed.
func (b *VariableTTLBuilder[K, V]) DeletionListener(deletionListener func(key K, value V, cause DeletionCause)) *VariableTTLBuilder[K, V] {
	b.setDeletionListener(deletionListener)
	return b
}

// Build creates a configured cache or
// returns an error if invalid parameters were passed to the builder.
func (b *VariableTTLBuilder[K, V]) Build() (CacheWithVariableTTL[K, V], error) {
	if err := b.validate(); err != nil {
		return CacheWithVariableTTL[K, V]{}, err
	}

	return newCacheWithVariableTTL(b.toConfig()), nil
}
