package cmap

import "sync"

func NewMap[K comparable, V any]() *Map[K, V] {
	return &Map[K, V]{
		m:  make(map[K]V),
		mu: sync.RWMutex{},
	}
}

type Map[K comparable, V any] struct {
	m  map[K]V
	mu sync.RWMutex
}

func (m *Map[K, V]) Get(key K) (V, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	v, exists := m.m[key]
	return v, exists
}

func (m *Map[K, V]) Set(key K, v V) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.m[key] = v

}

func (m *Map[K, V]) Del(key K) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.m, key)
}

func (m *Map[K, V]) Foreach(f func(key K, v V) error) error {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for k, v := range m.m {
		if err := f(k, v); err != nil {
			return err
		}
	}
	return nil
}

func (m *Map[K, V]) FindForeach(f func(key K, v V) bool) (K, V, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for k, v := range m.m {
		if f(k, v) {
			return k, v, true
		}
	}
	var (
		k K
		v V
	)
	return k, v, false
}
