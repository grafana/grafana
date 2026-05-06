package theine

import (
	"context"
	"errors"

	"github.com/Yiling-J/theine-go/internal"
)

func validateBuilder[K comparable, V any](options internal.StoreOptions[K, V]) error {
	if options.MaxSize <= 0 {
		return errors.New("size must be positive")
	}
	return nil
}

func validateLoadingBuilder[K comparable, V any](options internal.StoreOptions[K, V]) error {
	if err := validateBuilder(options); err != nil {
		return err
	}
	if options.Loader == nil {
		return errors.New("loader function required")
	}
	return nil
}

func validateHybridBuilder[K comparable, V any](options internal.StoreOptions[K, V]) error {
	if err := validateBuilder(options); err != nil {
		return err
	}
	if options.SecondaryCache == nil {
		return errors.New("secondary cache required")
	}
	if options.Workers <= 0 {
		return errors.New("workers must be positive")
	}
	return nil
}

func validateLoadingHybridBuilder[K comparable, V any](options internal.StoreOptions[K, V]) error {
	if err := validateLoadingBuilder(options); err != nil {
		return err
	}
	if err := validateHybridBuilder(options); err != nil {
		return err
	}
	return nil
}

type Builder[K comparable, V any] struct {
	options internal.StoreOptions[K, V]
}

func NewBuilder[K comparable, V any](maxsize int64) *Builder[K, V] {
	b := &Builder[K, V]{}
	b.options.MaxSize = maxsize
	return b
}

// Cost adds dynamic cost function to builder.
// There is a default cost function which always return 1.
func (b *Builder[K, V]) Cost(cost func(v V) int64) *Builder[K, V] {
	b.options.Cost = cost
	return b
}

// Doorkeeper enables/disables doorkeeper.
// Doorkeeper will drop Set if they are not in bloomfilter yet.
func (b *Builder[K, V]) Doorkeeper(enabled bool) *Builder[K, V] {
	b.options.Doorkeeper = enabled
	return b
}

// UseEntryPool enables/disables reusing evicted entries through a sync pool.
// This can significantly reduce memory allocation under heavy concurrent writes,
// but it may lead to occasional race conditions. Theine updates its policy asynchronously,
// so when an Update event is processed, the corresponding entry might have already been reused.
// Theine will compare the key again, but this does not completely eliminate the risk of a race.
func (b *Builder[K, V]) UseEntryPool(enabled bool) *Builder[K, V] {
	b.options.EntryPool = enabled
	return b
}

// RemovalListener adds remove callback function to builder.
// This function is called when entry in cache is evicted/expired/deleted.
func (b *Builder[K, V]) RemovalListener(listener func(key K, value V, reason RemoveReason)) *Builder[K, V] {
	b.options.Listener = listener
	return b
}

// Build builds a cache client from builder.
func (b *Builder[K, V]) Build() (*Cache[K, V], error) {
	if err := validateBuilder(b.options); err != nil {
		return nil, err
	}
	store := internal.NewStore(&b.options)
	return &Cache[K, V]{store: store}, nil
}

// Add loading function and switch to LoadingBuilder.
func (b *Builder[K, V]) Loading(
	loader func(ctx context.Context, key K) (Loaded[V], error),
) *LoadingBuilder[K, V] {
	if loader != nil {
		b.options.Loader = func(ctx context.Context, key K) (internal.Loaded[V], error) {
			v, err := loader(ctx, key)
			return internal.Loaded[V]{Value: v.Value, Cost: v.Cost, TTL: v.TTL}, err
		}
	}
	return &LoadingBuilder[K, V]{
		options: b.options,
	}
}

// Add secondary cache and switch to HybridBuilder.
func (b *Builder[K, V]) Hybrid(cache internal.SecondaryCache[K, V]) *HybridBuilder[K, V] {
	b.options.SecondaryCache = cache
	b.options.Workers = 2
	b.options.Probability = 1
	return &HybridBuilder[K, V]{
		options: b.options,
	}
}

// BuildWithLoader builds a loading cache client from builder with custom loader function.
func (b *Builder[K, V]) BuildWithLoader(loader func(ctx context.Context, key K) (Loaded[V], error)) (*LoadingCache[K, V], error) {
	if b.options.MaxSize <= 0 {
		return nil, errors.New("size must be positive")
	}
	if loader == nil {
		return nil, errors.New("loader function required")
	}
	store := internal.NewStore(&b.options)
	loadingStore := internal.NewLoadingStore(store)
	loadingStore.Loader(func(ctx context.Context, key K) (internal.Loaded[V], error) {
		v, err := loader(ctx, key)
		return internal.Loaded[V]{Value: v.Value, Cost: v.Cost, TTL: v.TTL}, err
	})
	return &LoadingCache[K, V]{store: loadingStore}, nil
}

type LoadingBuilder[K comparable, V any] struct {
	options internal.StoreOptions[K, V]
}

// Add secondary cache and switch to HybridLoadingBuilder.
func (b *LoadingBuilder[K, V]) Hybrid(cache internal.SecondaryCache[K, V]) *HybridLoadingBuilder[K, V] {
	b.options.SecondaryCache = cache
	b.options.Workers = 2
	b.options.Probability = 1
	return &HybridLoadingBuilder[K, V]{
		options: b.options,
	}
}

// Build builds a cache client from builder.
func (b *LoadingBuilder[K, V]) Build() (*LoadingCache[K, V], error) {
	if err := validateLoadingBuilder(b.options); err != nil {
		return nil, err
	}
	store := internal.NewStore(&b.options)
	loadingStore := internal.NewLoadingStore(store)
	loadingStore.Loader(func(ctx context.Context, key K) (internal.Loaded[V], error) {
		v, err := b.options.Loader(ctx, key)
		return internal.Loaded[V]{Value: v.Value, Cost: v.Cost, TTL: v.TTL}, err
	})
	return &LoadingCache[K, V]{store: loadingStore}, nil
}

type HybridBuilder[K comparable, V any] struct {
	options internal.StoreOptions[K, V]
}

func (b *HybridBuilder[K, V]) validate() error {
	if b.options.SecondaryCache == nil {
		return errors.New("secondary cache required")
	}
	if b.options.Workers <= 0 {
		return errors.New("workers must be positive")
	}
	return nil
}

// Set secondary cache workers.
// Worker will send evicted entries to secondary cache.
func (b *HybridBuilder[K, V]) Workers(w int) *HybridBuilder[K, V] {
	b.options.Workers = w
	return b
}

// Set acceptance probability. The value has to be in the range of [0, 1].
func (b *HybridBuilder[K, V]) AdmProbability(p float32) *HybridBuilder[K, V] {
	b.options.Probability = p
	return b
}

// Add loading function and switch to HybridLoadingBuilder.
func (b *HybridBuilder[K, V]) Loading(
	loader func(ctx context.Context, key K) (Loaded[V], error),
) *HybridLoadingBuilder[K, V] {
	if loader != nil {
		b.options.Loader = func(ctx context.Context, key K) (internal.Loaded[V], error) {
			v, err := loader(ctx, key)
			return internal.Loaded[V]{Value: v.Value, Cost: v.Cost, TTL: v.TTL}, err
		}
	}
	return &HybridLoadingBuilder[K, V]{
		options: b.options,
	}
}

// Build builds a cache client from builder.
func (b *HybridBuilder[K, V]) Build() (*HybridCache[K, V], error) {
	if err := b.validate(); err != nil {
		return nil, err
	}
	store := internal.NewStore(&b.options)
	return &HybridCache[K, V]{store: store}, nil
}

type HybridLoadingBuilder[K comparable, V any] struct {
	options internal.StoreOptions[K, V]
}

// Build builds a cache client from builder.
func (b *HybridLoadingBuilder[K, V]) Build() (*HybridLoadingCache[K, V], error) {
	if err := validateLoadingHybridBuilder(b.options); err != nil {
		return nil, err
	}
	store := internal.NewStore(&b.options)
	loadingStore := internal.NewLoadingStore(store)
	loadingStore.Loader(func(ctx context.Context, key K) (internal.Loaded[V], error) {
		v, err := b.options.Loader(ctx, key)
		return internal.Loaded[V]{Value: v.Value, Cost: v.Cost, TTL: v.TTL}, err
	})
	return &HybridLoadingCache[K, V]{store: loadingStore}, nil
}
