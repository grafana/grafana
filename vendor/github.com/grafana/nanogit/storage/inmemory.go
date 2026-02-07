package storage

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
)

type InMemoryStorageOption func(*InMemoryStorage)

func WithTTL(ttl time.Duration) InMemoryStorageOption {
	return func(s *InMemoryStorage) {
		s.ttl = ttl
	}
}

type InMemoryStorage struct {
	objects    map[string]*protocol.PackfileObject
	lastAccess map[string]time.Time
	ttl        time.Duration
	mu         sync.RWMutex
}

func NewInMemoryStorage(ctx context.Context, opts ...InMemoryStorageOption) *InMemoryStorage {
	s := &InMemoryStorage{
		objects:    make(map[string]*protocol.PackfileObject),
		lastAccess: make(map[string]time.Time),
	}

	for _, opt := range opts {
		opt(s)
	}

	if s.ttl > 0 {
		s.cleanUpRoutine(ctx, s.ttl)
	}

	return s
}

func (s *InMemoryStorage) Get(key hash.Hash) (*protocol.PackfileObject, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	keyStr := key.String()
	obj, ok := s.objects[keyStr]
	if ok {
		if s.ttl > 0 {
			s.lastAccess[keyStr] = time.Now()
		}
	}
	return obj, ok
}

func (s *InMemoryStorage) GetByType(key hash.Hash, objType protocol.ObjectType) (*protocol.PackfileObject, bool) {
	obj, ok := s.Get(key)
	if !ok {
		return nil, false
	}

	if obj.Type != objType {
		return nil, false
	}

	return obj, true
}

// LastAccess returns the last access time for a given key.
// If the key doesn't exist or TTL is not enabled, returns zero time and false.
func (s *InMemoryStorage) LastAccess(key hash.Hash) (time.Time, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.ttl == 0 {
		return time.Time{}, false
	}

	t, ok := s.lastAccess[key.String()]
	return t, ok
}

func (s *InMemoryStorage) GetAllKeys() []hash.Hash {
	s.mu.RLock()
	defer s.mu.RUnlock()

	keys := make([]hash.Hash, 0, len(s.objects))
	for key := range s.objects {
		keys = append(keys, hash.MustFromHex(key))
	}
	return keys
}

func (s *InMemoryStorage) Add(objs ...*protocol.PackfileObject) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for _, obj := range objs {
		key := obj.Hash.String()
		s.objects[key] = obj
		if s.ttl > 0 {
			s.lastAccess[key] = now
		}
	}
}

func (s *InMemoryStorage) Delete(key hash.Hash) {
	s.mu.Lock()
	defer s.mu.Unlock()

	keyStr := key.String()
	delete(s.objects, keyStr)
	if s.ttl > 0 {
		delete(s.lastAccess, keyStr)
	}
}

func (s *InMemoryStorage) Len() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.objects)
}

// Cleanup removes objects that haven't been accessed within the TTL period.
func (s *InMemoryStorage) Cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for key, lastAccess := range s.lastAccess {
		if now.Sub(lastAccess) > s.ttl {
			delete(s.objects, key)
			if s.ttl > 0 {
				delete(s.lastAccess, key)
			}
		}
	}
}

// cleanUpRoutine starts a background goroutine that periodically cleans up expired objects.
func (s *InMemoryStorage) cleanUpRoutine(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.Cleanup()
			}
		}
	}()
}
