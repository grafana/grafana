package internal

import (
	"bytes"
	"context"
	"encoding/gob"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"runtime"
	"sync"
	"time"

	"github.com/zeebo/xxh3"

	"github.com/Yiling-J/theine-go/internal/bf"
	"github.com/Yiling-J/theine-go/internal/hasher"
	"github.com/Yiling-J/theine-go/internal/xruntime"
)

type RemoveReason uint8

const (
	REMOVED RemoveReason = iota
	EVICTED
	EXPIRED
)

var (
	VersionMismatch    = errors.New("version mismatch")
	ErrCacheClosed     = errors.New("cache is closed")
	RoundedParallelism int
	ShardCount         int
	StripedBufferSize  int
	WriteChanSize      int
	WriteBufferSize    int
)

func init() {
	parallelism := xruntime.Parallelism()
	RoundedParallelism = int(RoundUpPowerOf2(parallelism))
	ShardCount = 4 * RoundedParallelism
	StripedBufferSize = 4 * RoundedParallelism
	WriteChanSize = 64 * RoundedParallelism
	WriteBufferSize = 128
}

type Shard[K comparable, V any] struct {
	hashmap   map[K]*Entry[K, V]
	dookeeper *bf.Bloomfilter
	// singleflight group used in loading cache, avoid load same key multiple times concurrently
	group *Group[K, Loaded[V]]
	// singleflight group used in secondary cache, avoid get same key from secondary cache multiple times concurrently
	vgroup *Group[K, V]
	// used to reset dookeeper
	counter uint
	// A read/write mutex that locks the shard when accessing the shard's hashmap.
	// This mutex is used for read, write, delete on the shard's hashmap, update some entry fields,
	// as well as for shard close operations. The policy has its own mutex and does not hold this lock, except in one case:
	// The policy has its own mutex and does not hold this lock, except in one case:
	// when the policy or timing wheel evicts entries, this mutex is also acquired
	// because the hashmap needs to be updated.
	mu     *RBMutex
	closed bool
}

func NewShard[K comparable, V any](doorkeeper bool) *Shard[K, V] {
	s := &Shard[K, V]{
		hashmap: make(map[K]*Entry[K, V]),
		group:   NewGroup[K, Loaded[V]](),
		vgroup:  NewGroup[K, V](),
		mu:      NewRBMutex(),
	}
	if doorkeeper {
		s.dookeeper = bf.New(0.01)
	}
	return s
}

func (s *Shard[K, V]) set(key K, entry *Entry[K, V]) {
	if s.closed {
		return
	}
	s.hashmap[key] = entry
	if s.dookeeper != nil {
		ds := 20 * len(s.hashmap)
		if ds > s.dookeeper.Capacity {
			s.dookeeper.EnsureCapacity(ds)
		}
	}
}

func (s *Shard[K, V]) get(key K) (entry *Entry[K, V], ok bool) {
	if s.closed {
		return nil, false
	}
	entry, ok = s.hashmap[key]
	return
}

func (s *Shard[K, V]) delete(entry *Entry[K, V]) bool {
	if s.closed {
		return false
	}
	var deleted bool
	exist, ok := s.hashmap[entry.key]
	if ok && exist == entry {
		delete(s.hashmap, exist.key)
		deleted = true
	}
	return deleted
}

func (s *Shard[K, V]) len() int {
	return len(s.hashmap)
}

type Store[K comparable, V any] struct {
	entryPool         *sync.Pool
	writeChan         chan WriteBufItem[K, V]
	writeBuffer       []WriteBufItem[K, V]
	hasher            *hasher.Hasher[K]
	removalListener   func(key K, value V, reason RemoveReason)
	removalCallback   func(kv dequeKV[K, V], reason RemoveReason) error
	kvBuilder         func(entry *Entry[K, V]) dequeKV[K, V]
	policy            *TinyLfu[K, V]
	timerwheel        *TimerWheel[K, V]
	stripedBuffer     []*Buffer[K, V]
	mask              uint32
	cost              func(V) int64
	shards            []*Shard[K, V]
	cap               uint
	shardCount        uint
	policyMu          sync.Mutex
	doorkeeper        bool
	closed            bool
	secondaryCache    SecondaryCache[K, V]
	secondaryCacheBuf chan SecondaryCacheItem[K, V]
	probability       float32
	rg                *rand.Rand
	ctx               context.Context
	cancel            context.CancelFunc
	maintenanceTicker *time.Ticker
	waitChan          chan bool
}

type StoreOptions[K comparable, V any] struct {
	MaxSize        int64                                               // max size of the cache store
	Doorkeeper     bool                                                // use doorkeeper or not
	EntryPool      bool                                                // enable entry pool or not, entry pool is a sync pool and can reduce memory allocations under heavy write loads
	Listener       func(key K, value V, reason RemoveReason)           // entry evicted callback function
	Cost           func(v V) int64                                     // entry cost function, default is 1
	SecondaryCache SecondaryCache[K, V]                                // the SecondaryCache instance to use
	Workers        int                                                 // count of SecondaryCache sync workers
	Probability    float32                                             // SecondaryCache acceptance probability
	StringKeyFunc  func(k K) string                                    // a function to handle struct with string hash bug before Go 1.24
	Loader         func(ctx context.Context, key K) (Loaded[V], error) // load function used in loading cache
}

// New returns a new data struct with the specified capacity
func NewStore[K comparable, V any](options *StoreOptions[K, V]) *Store[K, V] {
	hasher := hasher.NewHasher(options.StringKeyFunc)
	shardCount := 1
	for shardCount < runtime.GOMAXPROCS(0)*2 {
		shardCount *= 2
	}
	if shardCount < 16 {
		shardCount = 16
	}
	if shardCount > 128 {
		shardCount = 128
	}

	costfn := func(v V) int64 { return 1 }
	if options.Cost != nil {
		costfn = options.Cost
	}

	stripedBuffer := make([]*Buffer[K, V], 0, StripedBufferSize)
	for i := 0; i < StripedBufferSize; i++ {
		stripedBuffer = append(stripedBuffer, NewBuffer[K, V]())
	}

	s := &Store[K, V]{
		cap:           uint(options.MaxSize),
		hasher:        hasher,
		policy:        NewTinyLfu[K, V](uint(options.MaxSize), hasher),
		stripedBuffer: stripedBuffer,
		mask:          uint32(StripedBufferSize - 1),
		writeChan:     make(chan WriteBufItem[K, V], WriteChanSize),
		writeBuffer:   make([]WriteBufItem[K, V], 0, WriteBufferSize),
		shardCount:    uint(shardCount),
		doorkeeper:    options.Doorkeeper,
		kvBuilder: func(entry *Entry[K, V]) dequeKV[K, V] {
			return dequeKV[K, V]{
				k: entry.key,
				v: entry.value,
			}
		},
		removalListener: options.Listener,
		cost:            costfn,
		secondaryCache:  options.SecondaryCache,
		probability:     options.Probability,
		waitChan:        make(chan bool),
	}
	if options.EntryPool {
		s.entryPool = &sync.Pool{New: func() any { return &Entry[K, V]{} }}
	}

	s.removalCallback = func(kv dequeKV[K, V], reason RemoveReason) error {
		if s.removalListener != nil {
			s.removalListener(kv.k, kv.v, reason)
		}
		return nil
	}

	s.shards = make([]*Shard[K, V], 0, s.shardCount)
	for i := 0; i < int(s.shardCount); i++ {
		s.shards = append(s.shards, NewShard[K, V](options.Doorkeeper))
	}
	s.policy.removeCallback = func(entry *Entry[K, V]) {
		s.removeEntry(entry, EVICTED)
	}

	s.ctx, s.cancel = context.WithCancel(context.Background())
	s.timerwheel = NewTimerWheel[K, V](uint(options.MaxSize))
	s.timerwheel.clock.RefreshNowCache()

	go s.maintenance()
	if s.secondaryCache != nil {
		s.secondaryCacheBuf = make(chan SecondaryCacheItem[K, V], 256)
		for i := 0; i < options.Workers; i++ {
			go s.processSecondary()
		}
		s.rg = rand.New(rand.New(rand.NewSource(0)))
	}
	return s
}

type shardEntry[K comparable, V any] struct {
	entry *Entry[K, V]
	value V
}

func (s *Store[K, V]) getFromShard(key K, hash uint64, shard *Shard[K, V]) (shardEntry[K, V], bool) {
	tk := shard.mu.RLock()
	defer shard.mu.RUnlock(tk)
	entry, ok := shard.get(key)
	var value V
	if ok {
		expire := entry.expire.Load()
		var expired bool
		if expire != 0 {
			// Cached now is refreshed every second by ticker.
			// However, since tickers aren't guaranteed to be precise
			// https://github.com/golang/go/issues/45632
			// relax this to 30 seconds. If the entry's expiration time is
			// less than 30 seconds compared to the cached now,
			// refetch the accurate now and compare again.
			nowCached := s.timerwheel.clock.NowNanoCached()
			if expire-nowCached <= 0 {
				expired = true
			} else if expire-nowCached < 30*1e9 {
				now := s.timerwheel.clock.NowNano()
				expired = (expire-now <= 0)
			} else {
				expired = false
			}
		}

		if expired {
			ok = false
		} else {
			value = entry.value
		}
	}
	return shardEntry[K, V]{
		entry: entry,
		value: value,
	}, ok
}

func (s *Store[K, V]) Get(key K) (V, bool) {
	h, index := s.index(key)
	shard := s.shards[index]
	shardEntry, ok := s.getFromShard(key, h, shard)
	if ok {
		s.policy.hits.Add(1)
	} else {
		s.policy.misses.Add(1)
		return shardEntry.value, false
	}

	idx := s.getReadBufferIdx()
	var send ReadBufItem[K, V]
	send.hash = h
	send.entry = shardEntry.entry

	pb := s.stripedBuffer[idx].Add(send)
	if pb != nil {
		s.drainRead(pb.Returned)
		s.stripedBuffer[idx].Free()
	}
	return shardEntry.value, ok
}

func (s *Store[K, V]) GetWithSecodary(key K) (V, bool, error) {
	h, index := s.index(key)
	shard := s.shards[index]
	shardEntry, ok := s.getFromShard(key, h, shard)
	if ok {
		return shardEntry.value, true, nil
	}

	var result setShardResult[K, V]
	var entryCost int64
	var entryExpire int64
	value, err, _ := shard.vgroup.Do(key, func() (v V, err error) {
		// load and store should be atomic
		shard.mu.Lock()
		defer shard.mu.Unlock()
		v, cost, expire, ok, err := s.secondaryCache.Get(key)
		if err != nil {
			return v, err
		}
		if !ok {
			return v, &NotFound{}
		}
		if expire <= s.timerwheel.clock.NowNano() {
			err = s.secondaryCache.Delete(key)
			if err == nil {
				err = &NotFound{}
			}
			return v, err
		}

		// insert to cache
		result = s.setShardWithoutLock(shard, h, key, v, cost, expire, true)
		entryCost = cost
		entryExpire = expire
		return v, err
	})

	var notFound *NotFound
	if errors.As(err, &notFound) {
		return value, false, nil
	}
	if err != nil {
		return value, false, err
	}
	if result.entry != nil {
		s.toPolicy(result, shard, h, entryCost, entryExpire, true)
	}
	return value, true, nil
}

func (s *Store[K, V]) policyNewEntry(hash uint64, shard *Shard[K, V], cost int64, entry *Entry[K, V], fromNVM bool) {
	s.writeChan <- WriteBufItem[K, V]{
		code: NEW, entry: entry, hash: hash, fromNVM: fromNVM, costChange: cost,
	}
}

func (s *Store[K, V]) policyUpdateEntry(entry *Entry[K, V], hash uint64, cost, old int64, reschedule bool) {
	// create/update events order might change due to race,
	// send cost change in event and apply them to entry policy weight
	// so different order still works.
	costChange := cost - old
	s.writeChan <- WriteBufItem[K, V]{
		entry: entry, code: UPDATE, costChange: costChange, rechedule: reschedule,
		hash: hash,
	}
}

type setShardResult[K comparable, V any] struct {
	entry      *Entry[K, V]
	oldCost    int64 // the old entry cost when updating entry
	exists     bool
	success    bool
	reschedule bool
}

func (s *Store[K, V]) setShard(shard *Shard[K, V], hash uint64, key K, value V, cost int64, expire int64, nvmClean bool) setShardResult[K, V] {
	shard.mu.Lock()
	defer shard.mu.Unlock()
	return s.setShardWithoutLock(shard, hash, key, value, cost, expire, nvmClean)
}

func (s *Store[K, V]) setShardWithoutLock(shard *Shard[K, V], hash uint64, key K, value V, cost int64, expire int64, nvmClean bool) setShardResult[K, V] {
	result := setShardResult[K, V]{success: true}
	if shard.closed {
		return result
	}
	exist, ok := shard.get(key)
	result.entry = exist
	result.exists = ok

	if ok && expire > 0 {
		old := exist.expire.Swap(expire)
		if old != expire {
			result.reschedule = true
		}
	}

	if ok {
		exist.value = value
		old := exist.weight.Swap(cost)
		result.oldCost = old
		return result
	}

	if s.doorkeeper {
		if shard.counter > uint(shard.dookeeper.Capacity) {
			shard.dookeeper.Reset()
			shard.counter = 0
		}
		hit := shard.dookeeper.Insert(hash)
		if !hit {
			shard.counter += 1
			result.success = false
			return result
		}
	}
	var entry *Entry[K, V]

	if s.entryPool != nil {
		entry = s.entryPool.Get().(*Entry[K, V])
		if entry.key == key {
			// put back and create an entry manually
			// because same key reuse might cause race condition
			s.entryPool.Put(entry)
			entry = &Entry[K, V]{}
		}
	} else {
		entry = &Entry[K, V]{}
	}

	entry.key = key
	entry.value = value
	entry.expire.Store(expire)
	entry.weight.Store(cost)
	entry.policyWeight = 0
	shard.set(entry.key, entry)
	result.entry = entry
	result.exists = false
	return result
}

func (s *Store[K, V]) toPolicy(result setShardResult[K, V], shard *Shard[K, V], hash uint64, cost, expire int64, nvmClean bool) {
	// shard closed or rejected by doorkeeper
	if result.entry == nil {
		return
	}
	if result.exists {
		s.policyUpdateEntry(result.entry, hash, cost, result.oldCost, result.reschedule)
	} else {
		s.policyNewEntry(hash, shard, cost, result.entry, nvmClean)
	}
}

func (s *Store[K, V]) setInternal(key K, value V, cost int64, expire int64, nvmClean bool) (*Shard[K, V], *Entry[K, V], bool) {
	h, index := s.index(key)
	shard := s.shards[index]
	result := s.setShard(shard, h, key, value, cost, expire, nvmClean)
	s.toPolicy(result, shard, h, cost, expire, nvmClean)
	return shard, result.entry, result.success
}

func (s *Store[K, V]) Set(key K, value V, cost int64, ttl time.Duration) bool {
	if cost == 0 {
		cost = s.cost(value)
	}
	if cost > int64(s.cap) {
		return false
	}
	var expire int64
	if ttl != 0 {
		expire = s.timerwheel.clock.ExpireNano(ttl)
	}
	_, _, ok := s.setInternal(key, value, cost, expire, false)
	return ok
}

type dequeKV[K comparable, V any] struct {
	k K
	v V
}

func (s *Store[K, V]) Delete(key K) {
	h, index := s.index(key)
	shard := s.shards[index]
	shard.mu.Lock()
	entry, ok := shard.get(key)
	if ok {
		shard.delete(entry)
	}
	shard.mu.Unlock()
	if ok {
		s.writeChan <- WriteBufItem[K, V]{entry: entry, code: REMOVE, hash: h}
	}
}

func (s *Store[K, V]) DeleteWithSecondary(key K) error {
	_, index := s.index(key)
	shard := s.shards[index]
	shard.mu.Lock()
	entry, ok := shard.get(key)
	if ok {
		shard.delete(entry)
		if s.secondaryCache != nil {
			err := s.secondaryCache.Delete(key)
			if err != nil {
				shard.mu.Unlock()
				return err
			}
		}
	}
	shard.mu.Unlock()
	if ok {
		s.writeChan <- WriteBufItem[K, V]{entry: entry, code: REMOVE}
	}
	return nil
}

func (s *Store[K, V]) Len() int {
	total := 0
	for _, s := range s.shards {
		tk := s.mu.RLock()
		total += s.len()
		s.mu.RUnlock(tk)
	}
	return total
}

func (s *Store[K, V]) EstimatedSize() int {
	s.policyMu.Lock()
	total := s.policy.window.Len() + s.policy.slru.protected.Len() + s.policy.slru.probation.Len()
	s.policyMu.Unlock()
	return total
}

func (s *Store[K, V]) index(key K) (uint64, int) {
	base := s.hasher.Hash(key)
	return base, int(base & uint64(s.shardCount-1))
}

func (s *Store[K, V]) postDelete(entry *Entry[K, V]) {
	if s.entryPool != nil {
		var zero V
		entry.value = zero
		entry.flag = Flag{}
		s.entryPool.Put(entry)
	}
}

// remove entry from cache/policy/timingwheel and add back to pool
// this method must be used with policy mutex together
func (s *Store[K, V]) removeEntry(entry *Entry[K, V], reason RemoveReason) {
	entry.flag.SetRemoved(true)
	_, index := s.index(entry.key)
	shard := s.shards[index]

	if reason == EXPIRED {
		// entry might updated already
		// update expire filed are protected by shard mutex
		if entry.expire.Load() > s.timerwheel.clock.NowNano() {
			return
		}
	}

	if prev := entry.meta.prev; prev != nil {
		s.policy.Remove(entry, false)
	}
	if entry.meta.wheelPrev != nil {
		s.timerwheel.deschedule(entry)
	}

	switch reason {
	case EVICTED, EXPIRED:
		if reason == EVICTED && !entry.flag.IsFromNVM() && s.secondaryCache != nil {
			var rn float32 = 1
			if s.probability < 1 {
				rn = s.rg.Float32()
			}

			if rn <= s.probability {
				select {
				case s.secondaryCacheBuf <- SecondaryCacheItem[K, V]{
					entry:  entry,
					reason: reason,
					shard:  shard,
				}:
					return
				default:
				}
			}
		}
		shard.mu.Lock()
		deleted := shard.delete(entry)
		shard.mu.Unlock()
		if deleted {
			k, v := entry.key, entry.value
			if s.removalListener != nil {
				s.removalListener(k, v, reason)
			}
			s.postDelete(entry)
		}

	// already removed from shard map
	case REMOVED:
		entry.flag.SetDeleted(true)
		kv := s.kvBuilder(entry)
		_ = s.removalCallback(kv, reason)
	}
}

func (s *Store[K, V]) drainRead(buffer []ReadBufItem[K, V]) {
	s.policyMu.Lock()
	for _, e := range buffer {
		// recheck hash if entry pool enabled to avoid race
		if s.entryPool != nil {
			hh := s.hasher.Hash(e.entry.key)
			if hh != e.hash {
				continue
			}
		}
		if e.entry.flag.IsRemoved() {
			continue
		}

		s.policy.Access(e)
	}
	s.policyMu.Unlock()
}

func (s *Store[K, V]) sinkWrite(item WriteBufItem[K, V]) {
	entry := item.entry
	if entry == nil {
		return
	}

	// entry removed by API explicitly will not resue by sync pool,
	// so all events can be ignored except the REMOVE one.
	if entry.flag.IsDeleted() {
		return
	}
	if item.code == REMOVE {
		entry.flag.SetDeleted(true)
	}

	if item.fromNVM {
		entry.flag.SetFromNVM(item.fromNVM)
	}

	// ignore removed entries, except code NEW
	// which will reset removed flag
	if entry.flag.IsRemoved() && item.code != NEW {
		return
	}

	// lock free because store API never read/modify entry metadata
	switch item.code {
	case NEW:
		entry.flag.SetRemoved(false)
		if expire := entry.expire.Load(); expire != 0 {
			if expire <= s.timerwheel.clock.NowNano() {
				s.removeEntry(entry, EXPIRED)
				return
			} else {
				s.timerwheel.schedule(entry)
			}
		}
		s.policy.sketch.Add(item.hash)
		entry.policyWeight += item.costChange
		s.policy.Set(entry)

	case REMOVE:
		s.removeEntry(entry, REMOVED)
	case EVICTE:
		s.removeEntry(entry, EVICTED)
	case UPDATE:
		// recheck hash if entry pool enabled to avoid race
		if s.entryPool != nil {
			hh := s.hasher.Hash(entry.key)
			if hh != item.hash {
				return
			}
		}

		// update entry policy weight
		entry.policyWeight += item.costChange

		if item.rechedule {
			s.timerwheel.schedule(entry)
		}

		// create/update race
		if entry.meta.prev == nil {
			return
		}

		if item.costChange != 0 {
			// update policy weight
			s.policy.UpdateCost(entry, item.costChange)
		}
	}
	item.entry = nil
}

func (s *Store[K, V]) drainWrite() {
	var wait bool
	for _, item := range s.writeBuffer {
		if item.code == WAIT {
			wait = true
			continue
		}
		s.sinkWrite(item)
	}

	s.writeBuffer = s.writeBuffer[:0]
	if wait {
		s.waitChan <- true
	}
}

func (s *Store[K, V]) maintenance() {
	go func() {
		s.policyMu.Lock()
		s.maintenanceTicker = time.NewTicker(time.Second)
		s.policyMu.Unlock()

		for {
			select {
			case <-s.ctx.Done():
				s.maintenanceTicker.Stop()
				return
			case <-s.maintenanceTicker.C:
				s.policyMu.Lock()
				s.timerwheel.clock.RefreshNowCache()
				if s.closed {
					s.policyMu.Unlock()
					return
				}
				s.timerwheel.advance(0, s.removeEntry)
				s.maintenanceTicker.Reset(time.Second)
				s.policyMu.Unlock()
			}
		}
	}()

	// continuously receive the first item from the buffered channel.
	// avoid a busy loop while still processing data in batches.
	for {
		select {
		case <-s.ctx.Done():
			return
		case first := <-s.writeChan:
			s.writeBuffer = append(s.writeBuffer, first)
		loop:
			for i := 0; i < WriteBufferSize-1; i++ {
				select {
				case item, ok := <-s.writeChan:
					if !ok {
						return
					}
					s.writeBuffer = append(s.writeBuffer, item)
				default:
					break loop
				}
			}

			s.policyMu.Lock()
			s.drainWrite()
			s.policyMu.Unlock()
		}
	}
}

func (s *Store[K, V]) Range(f func(key K, value V) bool) {
	now := s.timerwheel.clock.NowNano()
	for _, shard := range s.shards {
		tk := shard.mu.RLock()
		for _, entry := range shard.hashmap {
			expire := entry.expire.Load()
			if expire != 0 && expire <= now {
				continue
			}
			if !f(entry.key, entry.value) {
				shard.mu.RUnlock(tk)
				return
			}
		}
		shard.mu.RUnlock(tk)
	}
}

// used in test
func (s *Store[K, V]) RangeEntry(f func(entry *Entry[K, V])) {
	for _, shard := range s.shards {
		tk := shard.mu.RLock()
		for _, entry := range shard.hashmap {
			f(entry)
		}
		shard.mu.RUnlock(tk)
	}
}

func (s *Store[K, V]) Stats() Stats {
	return newStats(s.policy.hits.Value(), s.policy.misses.Value())
}

// Close waits for all current read and write operations to complete,
// then clears the hashmap and shuts down the maintenance goroutine.
// After the cache is closed, Get will always return (nil, false),
// and Set will have no effect.
// For loading cache, Get will return ErrCacheClosed after closing.
func (s *Store[K, V]) Close() {
	for _, shard := range s.shards {
		shard.mu.Lock()
		shard.closed = true
		shard.hashmap = map[K]*Entry[K, V]{}
		shard.mu.Unlock()
	}
	s.policyMu.Lock()
	s.closed = true
	s.cancel()
	s.policyMu.Unlock()
}

func (s *Store[K, V]) getReadBufferIdx() int {
	return int(xruntime.Fastrand() & s.mask)
}

type StoreMeta struct {
	Version   uint64
	StartNano int64
	Total     int
}

func (m *StoreMeta) Persist(writer io.Writer, blockEncoder *gob.Encoder) error {
	buffer := bytes.NewBuffer(make([]byte, 0, BlockBufferSize))
	block := NewBlock[*StoreMeta](1, buffer, blockEncoder)
	_, err := block.Write(m)
	if err != nil {
		return err
	}
	err = block.Save()
	if err != nil {
		return err
	}
	return nil
}

func (s *Store[K, V]) Persist(version uint64, writer io.Writer) error {
	blockEncoder := gob.NewEncoder(writer)
	s.policyMu.Lock()
	defer s.policyMu.Unlock()

	var total int
	for _, s := range s.shards {
		token := s.mu.RLock()
		total += s.len()
		defer s.mu.RUnlock(token)
	}

	meta := &StoreMeta{
		Version:   version,
		StartNano: s.timerwheel.clock.Start.UnixNano(),
		Total:     total,
	}
	err := meta.Persist(writer, blockEncoder)
	if err != nil {
		return err
	}
	err = s.policy.window.Persist(writer, blockEncoder, s.policy.sketch, s.hasher, 2)
	if err != nil {
		return err
	}
	// write protected first, so if cache size changed
	// when restore, protected entries write to new cache first
	err = s.policy.slru.protected.Persist(writer, blockEncoder, s.policy.sketch, s.hasher, 4)
	if err != nil {
		return err
	}
	err = s.policy.slru.probation.Persist(writer, blockEncoder, s.policy.sketch, s.hasher, 3)
	if err != nil {
		return err
	}

	// write end block
	block := NewBlock[int](255, bytes.NewBuffer(make([]byte, 0)), blockEncoder)
	_, err = block.Write(1)
	if err != nil {
		return err
	}
	return block.Save()
}

func (s *Store[K, V]) insertSimple(entry *Entry[K, V]) {
	_, index := s.index(entry.key)
	s.shards[index].set(entry.key, entry)
	if entry.expire.Load() != 0 {
		s.timerwheel.schedule(entry)
	}
}

func (s *Store[K, V]) processSecondary() {
	for item := range s.secondaryCacheBuf {
		tk := item.shard.mu.RLock()
		// first double check key still exists in map,
		// not exist means key already deleted by Delete API
		_, exist := item.shard.get(item.entry.key)
		if exist {
			err := s.secondaryCache.Set(
				item.entry.key, item.entry.value,
				item.entry.weight.Load(), item.entry.expire.Load(),
			)
			item.shard.mu.RUnlock(tk)
			if err != nil {
				s.secondaryCache.HandleAsyncError(err)
				continue
			}
			if item.reason == EVICTED {
				item.shard.mu.Lock()
				deleted := item.shard.delete(item.entry)
				item.shard.mu.Unlock()
				if deleted {
					s.policyMu.Lock()
					s.postDelete(item.entry)
					s.policyMu.Unlock()
				}
			}
		} else {
			item.shard.mu.RUnlock(tk)
		}
	}
}

// Wait blocks until the write channel is drained.
func (s *Store[K, V]) Wait() {
	s.writeChan <- WriteBufItem[K, V]{code: WAIT}
	<-s.waitChan
}

func (s *Store[K, V]) Recover(version uint64, reader io.Reader) error {
	blockDecoder := gob.NewDecoder(reader)
	block := &DataBlock[any]{}
	s.policyMu.Lock()
	defer s.policyMu.Unlock()
	for {
		// reset block first
		block.Data = nil
		block.Type = 0
		block.CheckSum = 0

		err := blockDecoder.Decode(block)
		if err != nil {
			return err
		}
		if block.CheckSum != xxh3.Hash(block.Data) {
			return errors.New("checksum mismatch")
		}

		reader := bytes.NewReader(block.Data)
		if block.Type == 255 {
			break
		}
		switch block.Type {
		case 1: // metadata
			metaDecoder := gob.NewDecoder(reader)
			m := &StoreMeta{}
			err = metaDecoder.Decode(m)
			if err != nil {
				return err
			}
			if m.Version != version {
				return VersionMismatch
			}
			s.timerwheel.clock.SetStart(m.StartNano)
			s.policy.sketch.EnsureCapacity(uint(m.Total))
		case 2: // window lru
			entryDecoder := gob.NewDecoder(reader)
			for {
				pentry := &Pentry[K, V]{}
				err := entryDecoder.Decode(pentry)
				if errors.Is(err, io.EOF) {
					break
				}
				if err != nil {
					return err
				}
				expire := pentry.Expire
				if expire != 0 && expire < s.timerwheel.clock.NowNano() {
					continue
				}
				if s.policy.window.Len() < int(s.policy.window.capacity) {
					entry := pentry.entry()
					s.policy.window.PushBack(entry)
					s.insertSimple(entry)
					if pentry.Frequency > 0 {
						s.policy.sketch.Addn(s.hasher.Hash(entry.key), pentry.Frequency)
					}
					s.policy.weightedSize += uint(entry.policyWeight)
				}
			}
		case 3: // main-probation
			entryDecoder := gob.NewDecoder(reader)
			for {
				pentry := &Pentry[K, V]{}
				err := entryDecoder.Decode(pentry)
				if errors.Is(err, io.EOF) {
					break
				}
				if err != nil {
					return err
				}
				expire := pentry.Expire
				if expire != 0 && expire < s.timerwheel.clock.NowNano() {
					continue
				}
				l1 := s.policy.slru.protected
				l2 := s.policy.slru.probation
				if l1.len+l2.len < int64(s.policy.slru.maxsize) {
					entry := pentry.entry()
					l2.PushBack(entry)
					s.insertSimple(entry)
					if pentry.Frequency > 0 {
						s.policy.sketch.Addn(s.hasher.Hash(entry.key), pentry.Frequency)
					}
					s.policy.weightedSize += uint(entry.policyWeight)
				}
			}
		case 4: // main protected
			entryDecoder := gob.NewDecoder(reader)
			for {
				pentry := &Pentry[K, V]{}
				err := entryDecoder.Decode(pentry)
				if errors.Is(err, io.EOF) {
					break
				}
				if err != nil {
					return err
				}
				expire := pentry.Expire
				if expire != 0 && expire < s.timerwheel.clock.NowNano() {
					continue
				}
				l := s.policy.slru.protected
				if l.len < int64(l.capacity) {
					entry := pentry.entry()
					l.PushBack(entry)
					s.insertSimple(entry)
					if pentry.Frequency > 0 {
						s.policy.sketch.Addn(s.hasher.Hash(entry.key), pentry.Frequency)
					}
					s.policy.weightedSize += uint(entry.policyWeight)
				}
			}
		}
	}
	return nil
}

type debugInfo struct {
	WeightedSize         int64
	WindowWeight         int64
	WindowWeightField    int64
	WindowCount          int64
	ProbationWeight      int64
	ProbationWeightField int64
	ProbationCount       int64
	ProtectedWeight      int64
	ProtectedWeightField int64
	ProtectedCount       int64
}

func (i debugInfo) String() string {
	final := ""
	final += fmt.Sprintf("policy weighted size %d\n", i.WeightedSize)
	final += fmt.Sprintf("total items in window list %d\n", i.WindowCount)
	final += fmt.Sprintf("sum of weight of window list %v\n", i.WindowWeight)
	final += fmt.Sprintf("total items in probation list %d\n", i.ProbationCount)
	final += fmt.Sprintf("sum of wieght of probation list %d\n", i.ProbationWeight)
	final += fmt.Sprintf("total items in protected list %d\n", i.ProtectedCount)
	final += fmt.Sprintf("sum of wieght of protected list %d\n", i.ProtectedWeight)
	final += fmt.Sprintf("total items %d\n", i.WindowCount+i.ProbationCount+i.ProtectedCount)
	return final
}

func (i debugInfo) TotalCount() int64 {
	return i.WindowCount + i.ProbationCount + i.ProtectedCount
}

func (i debugInfo) TotalWeight() int64 {
	tw := i.WindowWeight
	tw += i.ProbationWeight
	tw += i.ProtectedWeight
	return tw
}

// used for test, only
func (s *Store[K, V]) DebugInfo() debugInfo {
	var windowSum int64
	var windowCount int64
	s.policy.window.rangef(func(e *Entry[K, V]) {
		windowSum += e.policyWeight
		windowCount += 1
	})

	var probationSum int64
	var probationCount int64
	s.policy.slru.probation.rangef(func(e *Entry[K, V]) {
		probationSum += e.policyWeight
		probationCount += 1
	})

	var protectedSum int64
	var protectedCount int64
	s.policy.slru.protected.rangef(func(e *Entry[K, V]) {
		protectedCount += 1
		protectedSum += e.policyWeight
	})

	return debugInfo{
		WeightedSize:         int64(s.policy.weightedSize),
		WindowWeight:         windowSum,
		WindowWeightField:    int64(s.policy.window.Len()),
		WindowCount:          windowCount,
		ProbationWeight:      probationSum,
		ProbationWeightField: int64(s.policy.slru.probation.Len()),
		ProbationCount:       probationCount,
		ProtectedWeight:      protectedSum,
		ProtectedWeightField: int64(s.policy.slru.protected.Len()),
		ProtectedCount:       protectedCount,
	}
}

type Loaded[V any] struct {
	Value V
	Cost  int64
	TTL   time.Duration
}

type LoadingStore[K comparable, V any] struct {
	loader func(ctx context.Context, key K) (Loaded[V], error)
	*Store[K, V]
}

func NewLoadingStore[K comparable, V any](store *Store[K, V]) *LoadingStore[K, V] {
	return &LoadingStore[K, V]{
		Store: store,
	}
}

func (s *LoadingStore[K, V]) Loader(loader func(ctx context.Context, key K) (Loaded[V], error)) {
	s.loader = loader
}

func (s *LoadingStore[K, V]) Get(ctx context.Context, key K) (V, error) {
	h, index := s.index(key)
	shard := s.shards[index]
	shardEntry, ok := s.getFromShard(key, h, shard)
	if !ok {
		s.policy.misses.Add(1)
		var result setShardResult[K, V]
		var entryCost int64
		var entryExpire int64
		loaded, err, _ := shard.group.Do(key, func() (Loaded[V], error) {
			// load and store should be atomic
			shard.mu.Lock()
			defer shard.mu.Unlock()
			if shard.closed {
				return Loaded[V]{}, ErrCacheClosed
			}

			// first try get from secondary cache
			if s.secondaryCache != nil {
				vs, cost, expire, ok, err := s.secondaryCache.Get(key)
				var notFound *NotFound
				if err != nil && !errors.As(err, &notFound) {
					return Loaded[V]{}, err
				}
				if ok {
					result = s.setShardWithoutLock(shard, h, key, vs, cost, expire, true)
					entryCost = cost
					entryExpire = expire
					return Loaded[V]{Value: vs}, nil
				}
			}

			loaded, err := s.loader(ctx, key)
			var expire int64
			if loaded.TTL != 0 {
				expire = s.timerwheel.clock.ExpireNano(loaded.TTL)
			}
			if loaded.Cost == 0 {
				loaded.Cost = s.cost(loaded.Value)
			}

			if err == nil {
				result = s.setShardWithoutLock(shard, h, key, loaded.Value, loaded.Cost, expire, false)
				entryCost = loaded.Cost
				entryExpire = expire
			}
			return loaded, err
		})
		if result.entry != nil {
			s.toPolicy(result, shard, h, entryCost, entryExpire, true)
		}
		return loaded.Value, err
	} else {
		s.policy.hits.Add(1)
		idx := s.getReadBufferIdx()
		var send ReadBufItem[K, V]
		send.hash = h
		send.entry = shardEntry.entry

		pb := s.stripedBuffer[idx].Add(send)
		if pb != nil {
			s.drainRead(pb.Returned)
			s.stripedBuffer[idx].Free()
		}
	}
	return shardEntry.value, nil
}

type NotFound struct{}

func (e *NotFound) Error() string {
	return "not found"
}
