package rueidis

import (
	"time"

	"github.com/redis/rueidis/internal/util"
)

var (
	resultsp = util.NewPool(func(capacity int) *redisresults {
		return &redisresults{s: make([]RedisResult, 0, capacity)}
	})
	mgetcmdsp = util.NewPool(func(capacity int) *mgetcmds {
		return &mgetcmds{s: make([]Completed, 0, capacity)}
	})
	retryp = util.NewPool(func(capacity int) *retry {
		return &retry{
			cIndexes: make([]int, 0, capacity),
			commands: make([]Completed, 0, capacity),
		}
	})
	mgetcachecmdsp = util.NewPool(func(capacity int) *mgetcachecmds {
		return &mgetcachecmds{s: make([]CacheableTTL, 0, capacity)}
	})
	retrycachep = util.NewPool(func(capacity int) *retrycache {
		return &retrycache{
			cIndexes: make([]int, 0, capacity),
			commands: make([]CacheableTTL, 0, capacity),
		}
	})
	batchcachep = util.NewPool(func(capacity int) *batchcache {
		return &batchcache{
			cIndexes: make([]int, 0, capacity),
			commands: make([]CacheableTTL, 0, capacity),
		}
	})
	batchcachemaps = util.NewPool(func(capacity int) *batchcachemap {
		return &batchcachemap{m: make(map[uint16]*batchcache, capacity), n: capacity}
	})
	muxslotsp = util.NewPool(func(capacity int) *muxslots {
		return &muxslots{s: make([]int, 0, capacity)}
	})
	connretryp = util.NewPool(func(capacity int) *connretry {
		return &connretry{m: make(map[conn]*retry, capacity), n: capacity}
	})
	conncountp = util.NewPool(func(capacity int) *conncount {
		return &conncount{m: make(map[conn]int, capacity), n: capacity}
	})
	connretrycachep = util.NewPool(func(capacity int) *connretrycache {
		return &connretrycache{m: make(map[conn]*retrycache, capacity), n: capacity}
	})
)

type muxslots struct {
	s []int
}

func (r *muxslots) Capacity() int {
	return cap(r.s)
}

func (r *muxslots) ResetLen(n int) {
	clear(r.s)
	r.s = r.s[:n]
}

func (r *muxslots) LessThen(n int) bool {
	count := 0
	for _, value := range r.s {
		if value > 0 {
			if count++; count == n {
				return false
			}
		}
	}
	return true
}

type redisresults struct {
	s []RedisResult
}

func (r *redisresults) Capacity() int {
	return cap(r.s)
}

func (r *redisresults) ResetLen(n int) {
	clear(r.s)
	r.s = r.s[:n]
}

type cacheentries struct {
	e map[int]CacheEntry
	c int
}

func (c *cacheentries) Capacity() int {
	return c.c
}

func (c *cacheentries) ResetLen(n int) {
	clear(c.e)
}

var entriesp = util.NewPool(func(capacity int) *cacheentries {
	return &cacheentries{e: make(map[int]CacheEntry, capacity), c: capacity}
})

type mgetcachecmds struct {
	s []CacheableTTL
}

func (r *mgetcachecmds) Capacity() int {
	return cap(r.s)
}

func (r *mgetcachecmds) ResetLen(n int) {
	clear(r.s)
	r.s = r.s[:n]
}

type mgetcmds struct {
	s []Completed
}

func (r *mgetcmds) Capacity() int {
	return cap(r.s)
}

func (r *mgetcmds) ResetLen(n int) {
	clear(r.s)
	r.s = r.s[:n]
}

type retry struct {
	cIndexes []int
	commands []Completed
	aIndexes []int
	cAskings []Completed
}

func (r *retry) Capacity() int {
	return cap(r.commands)
}

func (r *retry) ResetLen(n int) {
	clear(r.cIndexes)
	clear(r.commands)
	clear(r.aIndexes)
	clear(r.cAskings)
	r.cIndexes = r.cIndexes[:n]
	r.commands = r.commands[:n]
	r.aIndexes = r.aIndexes[:0]
	r.cAskings = r.cAskings[:0]
}

type retrycache struct {
	cIndexes []int
	commands []CacheableTTL
	aIndexes []int
	cAskings []CacheableTTL
}

func (r *retrycache) Capacity() int {
	return cap(r.commands)
}

func (r *retrycache) ResetLen(n int) {
	clear(r.cIndexes)
	clear(r.commands)
	clear(r.aIndexes)
	clear(r.cAskings)
	r.cIndexes = r.cIndexes[:n]
	r.commands = r.commands[:n]
	r.aIndexes = r.aIndexes[:0]
	r.cAskings = r.cAskings[:0]
}

type batchcache struct {
	cIndexes []int
	commands []CacheableTTL
}

func (r *batchcache) Capacity() int {
	return cap(r.commands)
}

func (r *batchcache) ResetLen(n int) {
	clear(r.cIndexes)
	clear(r.commands)
	r.cIndexes = r.cIndexes[:n]
	r.commands = r.commands[:n]
}

type batchcachemap struct {
	m map[uint16]*batchcache
	n int
}

func (r *batchcachemap) Capacity() int {
	return r.n
}

func (r *batchcachemap) ResetLen(n int) {
	clear(r.m)
}

type conncount struct {
	m map[conn]int
	n int
}

func (r *conncount) Capacity() int {
	return r.n
}

func (r *conncount) ResetLen(n int) {
	clear(r.m)
}

type connretry struct {
	m          map[conn]*retry
	n          int
	RetryDelay time.Duration // NOTE: This is not thread-safe.
	Redirects  uint32        // NOTE: This is not thread-safe.
}

func (r *connretry) Capacity() int {
	return r.n
}

func (r *connretry) ResetLen(n int) {
	clear(r.m)
	r.Redirects = 0
	r.RetryDelay = time.Duration(-1) // No retry.
}

type connretrycache struct {
	m          map[conn]*retrycache
	n          int
	RetryDelay time.Duration // NOTE: This is not thread-safe.
	Redirects  uint32        // NOTE: This is not thread-safe.
}

func (r *connretrycache) Capacity() int {
	return r.n
}

func (r *connretrycache) ResetLen(n int) {
	clear(r.m)
	r.Redirects = 0
	r.RetryDelay = time.Duration(-1) // No retry.
}
