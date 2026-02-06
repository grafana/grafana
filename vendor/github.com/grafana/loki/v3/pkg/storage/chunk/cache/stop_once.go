package cache

import "sync"

type stopOnce struct {
	once sync.Once
	Cache
}

// StopOnce wraps a Cache and ensures its only stopped once.
func StopOnce(cache Cache) Cache {
	return &stopOnce{
		Cache: cache,
	}
}

func (s *stopOnce) Stop() {
	s.once.Do(func() {
		s.Cache.Stop()
	})
}
