package rueidis

import (
	"container/list"
	"context"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/redis/rueidis/internal/cmds"
)

const (
	entrySize    = int(unsafe.Sizeof(cacheEntry{})) + int(unsafe.Sizeof(&cacheEntry{}))
	keyCacheSize = int(unsafe.Sizeof(keyCache{})) + int(unsafe.Sizeof(&keyCache{}))
	elementSize  = int(unsafe.Sizeof(list.Element{})) + int(unsafe.Sizeof(&list.Element{}))
	stringSSize  = int(unsafe.Sizeof(""))

	entryBaseSize = (keyCacheSize + entrySize + elementSize + stringSSize*2) * 3 / 2
	entryMinSize  = entryBaseSize + messageStructSize

	moveThreshold = uint32(1024 - 1)
)

type cacheEntry struct {
	err  error
	ch   chan struct{}
	kc   *keyCache
	cmd  string
	val  RedisMessage
	size int
}

func (e *cacheEntry) Wait(ctx context.Context) (RedisMessage, error) {
	if ch := ctx.Done(); ch == nil {
		<-e.ch
	} else {
		select {
		case <-ch:
			return RedisMessage{}, ctx.Err()
		case <-e.ch:
		}
	}
	return e.val, e.err
}

type keyCache struct {
	cache map[string]*list.Element
	key   string
	hits  uint32
	miss  uint32
}

var _ CacheStore = (*lru)(nil)

type lru struct {
	store map[string]*keyCache
	list  *list.List
	mu    sync.RWMutex
	size  int
	max   int
}

func newLRU(opt CacheStoreOption) CacheStore {
	return &lru{
		max:   opt.CacheSizeEachConn,
		store: make(map[string]*keyCache),
		list:  list.New(),
	}
}

func (c *lru) Flight(key, cmd string, ttl time.Duration, now time.Time) (v RedisMessage, ce CacheEntry) {
	var ok bool
	var kc *keyCache
	var ele, back *list.Element
	var e *cacheEntry

	c.mu.RLock()
	if kc, ok = c.store[key]; ok {
		if ele = kc.cache[cmd]; ele != nil {
			e = ele.Value.(*cacheEntry)
			v = e.val
			back = c.list.Back()
		}
	}
	c.mu.RUnlock()

	if e != nil && (v.typ == 0 || v.relativePTTL(now) > 0) {
		hits := atomic.AddUint32(&kc.hits, 1)
		if ele != back && hits&moveThreshold == 0 {
			c.mu.Lock()
			if c.list != nil {
				c.list.MoveToBack(ele)
			}
			c.mu.Unlock()
		}
		return v, e
	}

	v = RedisMessage{}
	e = nil

	c.mu.Lock()
	if kc, ok = c.store[key]; !ok {
		if c.store == nil {
			goto ret
		}
		kc = &keyCache{cache: make(map[string]*list.Element, 1), key: key}
		c.store[key] = kc
	}
	if ele = kc.cache[cmd]; ele != nil {
		if e = ele.Value.(*cacheEntry); e.val.typ == 0 || e.val.relativePTTL(now) > 0 {
			atomic.AddUint32(&kc.hits, 1)
			v = e.val
			c.list.MoveToBack(ele)
			ce = e
			goto ret
		} else {
			c.list.Remove(ele)
			c.size -= e.size
		}
	}
	atomic.AddUint32(&kc.miss, 1)
	v.setExpireAt(now.Add(ttl).UnixMilli())
	kc.cache[cmd] = c.list.PushBack(&cacheEntry{cmd: cmd, kc: kc, val: v, ch: make(chan struct{})})
ret:
	c.mu.Unlock()
	return v, ce
}

func (c *lru) Flights(now time.Time, multi []CacheableTTL, results []RedisResult, entries map[int]CacheEntry) (missed []int) {
	var moves []*list.Element

	c.mu.RLock()
	for i, ct := range multi {
		key, cmd := cmds.CacheKey(ct.Cmd)
		if kc, ok := c.store[key]; ok {
			if ele := kc.cache[cmd]; ele != nil {
				e := ele.Value.(*cacheEntry)
				v := e.val
				if v.typ == 0 {
					entries[i] = e
				} else if v.relativePTTL(now) > 0 {
					results[i] = newResult(v, nil)
				} else {
					goto miss1
				}
				if atomic.AddUint32(&kc.hits, 1)&moveThreshold == 0 {
					if moves == nil {
						moves = make([]*list.Element, 0, len(multi))
					}
					moves = append(moves, ele)
				}
				continue
			}
		}
	miss1:
		if missed == nil {
			missed = make([]int, 0, len(multi))
		}
		missed = append(missed, i)
	}
	c.mu.RUnlock()

	if len(moves) > 0 {
		c.mu.Lock()
		if c.list != nil {
			for _, ele := range moves {
				c.list.MoveToBack(ele)
			}
		}
		c.mu.Unlock()
	}

	if len(missed) == 0 {
		return missed
	}

	j := 0
	c.mu.Lock()
	if c.store == nil {
		c.mu.Unlock()
		return missed
	}
	for _, i := range missed {
		key, cmd := cmds.CacheKey(multi[i].Cmd)
		kc, ok := c.store[key]
		if !ok {
			kc = &keyCache{cache: make(map[string]*list.Element, 1), key: key}
			c.store[key] = kc
		}
		if ele := kc.cache[cmd]; ele != nil {
			e := ele.Value.(*cacheEntry)
			v := e.val
			if v.typ == 0 {
				entries[i] = e
			} else if v.relativePTTL(now) > 0 {
				results[i] = newResult(v, nil)
			} else {
				c.list.Remove(ele)
				c.size -= e.size
				goto miss2
			}
			atomic.AddUint32(&kc.hits, 1)
			c.list.MoveToBack(ele)
			continue
		}
	miss2:
		atomic.AddUint32(&kc.miss, 1)
		v := RedisMessage{}
		v.setExpireAt(now.Add(multi[i].TTL).UnixMilli())
		kc.cache[cmd] = c.list.PushBack(&cacheEntry{cmd: cmd, kc: kc, val: v, ch: make(chan struct{})})
		missed[j] = i
		j++
	}
	c.mu.Unlock()
	return missed[:j]
}

func (c *lru) Update(key, cmd string, value RedisMessage) (pxat int64) {
	var ch chan struct{}
	c.mu.Lock()
	if kc, ok := c.store[key]; ok {
		if ele := kc.cache[cmd]; ele != nil {
			if e := ele.Value.(*cacheEntry); e.val.typ == 0 {
				pxat = value.getExpireAt()
				cpttl := e.val.getExpireAt()
				if cpttl < pxat || pxat == 0 {
					// server side ttl should only shorten client side ttl
					pxat = cpttl
					value.setExpireAt(pxat)
				}
				e.val = value
				e.size = entryBaseSize + 2*(len(key)+len(cmd)) + value.approximateSize()
				c.size += e.size
				ch = e.ch
			}

			ele = c.list.Front()
			for c.size > c.max && ele != nil {
				if e := ele.Value.(*cacheEntry); e.val.typ != 0 { // do not delete pending entries
					kc := e.kc
					if delete(kc.cache, e.cmd); len(kc.cache) == 0 {
						delete(c.store, kc.key)
					}
					c.list.Remove(ele)
					c.size -= e.size
				}
				ele = ele.Next()
			}
		}
	}
	c.mu.Unlock()
	if ch != nil {
		close(ch)
	}
	return
}

func (c *lru) Cancel(key, cmd string, err error) {
	var ch chan struct{}
	c.mu.Lock()
	if kc, ok := c.store[key]; ok {
		if ele := kc.cache[cmd]; ele != nil {
			if e := ele.Value.(*cacheEntry); e.val.typ == 0 {
				e.err = err
				ch = e.ch
				if delete(kc.cache, cmd); len(kc.cache) == 0 {
					delete(c.store, key)
				}
				c.list.Remove(ele)
			}
		}
	}
	c.mu.Unlock()
	if ch != nil {
		close(ch)
	}
}

func (c *lru) GetTTL(key, cmd string) (ttl time.Duration) {
	c.mu.Lock()
	if kc, ok := c.store[key]; ok && kc.cache[cmd] != nil {
		ttl = time.Duration(kc.cache[cmd].Value.(*cacheEntry).val.relativePTTL(time.Now())) * time.Millisecond
	}
	if ttl <= 0 {
		ttl = -2
	}
	c.mu.Unlock()
	return
}

func (c *lru) purge(key string, kc *keyCache) {
	if kc != nil {
		for cmd, ele := range kc.cache {
			if ele != nil {
				e := ele.Value.(*cacheEntry)
				if e.val.typ == 0 { // do not delete pending entries
					continue
				}
				c.list.Remove(ele)
				c.size -= e.size
			}
			if delete(kc.cache, cmd); len(kc.cache) == 0 {
				delete(c.store, key)
			}
		}
	}
}

func (c *lru) Delete(keys []RedisMessage) {
	c.mu.Lock()
	if keys == nil {
		for key, kc := range c.store {
			c.purge(key, kc)
		}
	} else {
		for _, k := range keys {
			c.purge(k.string, c.store[k.string])
		}
	}
	c.mu.Unlock()
}

func (c *lru) Close(err error) {
	c.mu.Lock()
	for _, kc := range c.store {
		for _, ele := range kc.cache {
			if ele != nil {
				if e := ele.Value.(*cacheEntry); e.val.typ == 0 {
					e.err = err
					close(e.ch)
				}
			}
		}
	}
	c.store = nil
	c.list = nil
	c.mu.Unlock()
}
