package gocql

import (
	"github.com/gocql/gocql/internal/lru"
	"sync"
)

const defaultMaxPreparedStmts = 1000

// preparedLRU is the prepared statement cache
type preparedLRU struct {
	mu  sync.Mutex
	lru *lru.Cache
}

// Max adjusts the maximum size of the cache and cleans up the oldest records if
// the new max is lower than the previous value. Not concurrency safe.
func (p *preparedLRU) max(max int) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for p.lru.Len() > max {
		p.lru.RemoveOldest()
	}
	p.lru.MaxEntries = max
}

func (p *preparedLRU) clear() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for p.lru.Len() > 0 {
		p.lru.RemoveOldest()
	}
}

func (p *preparedLRU) add(key string, val *inflightPrepare) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.lru.Add(key, val)
}

func (p *preparedLRU) remove(key string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.lru.Remove(key)
}

func (p *preparedLRU) execIfMissing(key string, fn func(lru *lru.Cache) *inflightPrepare) (*inflightPrepare, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	val, ok := p.lru.Get(key)
	if ok {
		return val.(*inflightPrepare), true
	}

	return fn(p.lru), false
}

func (p *preparedLRU) keyFor(addr, keyspace, statement string) string {
	// TODO: maybe use []byte for keys?
	return addr + keyspace + statement
}
