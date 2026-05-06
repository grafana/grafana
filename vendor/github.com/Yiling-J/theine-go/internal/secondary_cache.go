package internal

import (
	"errors"
	"sync"
	"sync/atomic"

	"github.com/Yiling-J/theine-go/internal/clock"
)

type Serializer[T any] interface {
	Marshal(v T) ([]byte, error)
	Unmarshal(raw []byte, v *T) error
}

type SecondaryCacheItem[K comparable, V any] struct {
	entry  *Entry[K, V]
	reason RemoveReason
	shard  *Shard[K, V]
}

type SecondaryCache[K comparable, V any] interface {
	Get(key K) (value V, cost int64, expire int64, ok bool, err error)
	Set(key K, value V, cost int64, expire int64) error
	Delete(key K) error
	HandleAsyncError(err error)
}

// used in test only
type SimpleMapSecondary[K comparable, V any] struct {
	m          map[K]*Entry[K, V]
	ErrCounter atomic.Uint64
	mu         sync.Mutex
	ErrMode    bool
}

func NewSimpleMapSecondary[K comparable, V any]() *SimpleMapSecondary[K, V] {
	return &SimpleMapSecondary[K, V]{
		m: make(map[K]*Entry[K, V]),
	}
}

func (s *SimpleMapSecondary[K, V]) Get(key K) (value V, cost int64, expire int64, ok bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	e, ok := s.m[key]
	if !ok {
		return
	}
	return e.value, e.weight.Load(), e.expire.Load(), true, nil
}

func (s *SimpleMapSecondary[K, V]) Set(key K, value V, cost int64, expire int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.ErrMode {
		return errors.New("err")
	}

	e := &Entry[K, V]{
		value: value,
	}
	e.weight.Store(cost)

	s.m[key] = e
	s.m[key].expire.Store(expire)
	return nil
}

func (s *SimpleMapSecondary[K, V]) Delete(key K) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.m[key]; !ok {
		return nil
	}
	delete(s.m, key)
	return nil
}

func (s *SimpleMapSecondary[K, V]) SetClock(clock *clock.Clock) {
}

func (s *SimpleMapSecondary[K, V]) HandleAsyncError(err error) {
	if err != nil {
		s.ErrCounter.Add(1)
	}
}
