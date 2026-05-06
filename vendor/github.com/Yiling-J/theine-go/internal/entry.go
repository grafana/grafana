package internal

import (
	"sync/atomic"
)

const (
	NEW int8 = iota
	REMOVE
	UPDATE
	EVICTE
	WAIT
)

type ReadBufItem[K comparable, V any] struct {
	entry *Entry[K, V]
	hash  uint64
}
type WriteBufItem[K comparable, V any] struct {
	entry      *Entry[K, V]
	costChange int64
	code       int8
	rechedule  bool
	fromNVM    bool
	hash       uint64
}

type MetaData[K comparable, V any] struct {
	prev      *Entry[K, V]
	next      *Entry[K, V]
	wheelPrev *Entry[K, V]
	wheelNext *Entry[K, V]
}

type Entry[K comparable, V any] struct {
	key          K              // Protected by the shard mutex.
	value        V              // Protected by the shard mutex.
	meta         MetaData[K, V] // Used in the timing wheel and policy LRU, protected by the policy mutex.
	weight       atomic.Int64   // Protected by the shard mutex.
	policyWeight int64          // Protected by the policy mutex.
	expire       atomic.Int64   // Protected by the shard mutex.
	flag         Flag           // Protected by the policy mutex.
}

// used in test only
func NewEntry[K comparable, V any](key K, value V, cost int64, expire int64) *Entry[K, V] {
	entry := &Entry[K, V]{
		key:   key,
		value: value,
	}
	entry.weight.Store(cost)
	entry.policyWeight = cost
	if expire > 0 {
		entry.expire.Store(expire)
	}
	return entry
}

func (e *Entry[K, V]) Next(listType uint8) *Entry[K, V] {
	switch listType {
	case LIST_PROBATION, LIST_PROTECTED, LIST_WINDOW:
		if p := e.meta.next; !p.flag.IsRoot() {
			return e.meta.next
		}
		return nil

	case WHEEL_LIST:
		if p := e.meta.wheelNext; !p.flag.IsRoot() {
			return e.meta.wheelNext
		}
		return nil
	}
	return nil
}

func (e *Entry[K, V]) Prev(listType uint8) *Entry[K, V] {
	switch listType {
	case LIST_PROBATION, LIST_PROTECTED, LIST_WINDOW:
		if p := e.meta.prev; !p.flag.IsRoot() {
			return e.meta.prev
		}
		return nil

	case WHEEL_LIST:
		if p := e.meta.wheelPrev; !p.flag.IsRoot() {
			return e.meta.wheelPrev
		}
		return nil
	}
	return nil
}

func (e *Entry[K, V]) PrevPolicy() *Entry[K, V] {
	if p := e.meta.prev; !p.flag.IsRoot() {
		return e.meta.prev
	}
	return nil
}

func (e *Entry[K, V]) PrevExpire() *Entry[K, V] {
	if p := e.meta.wheelPrev; !p.flag.IsRoot() {
		return e.meta.wheelPrev
	}
	return nil
}

func (e *Entry[K, V]) NextPolicy() *Entry[K, V] {
	if p := e.meta.next; !p.flag.IsRoot() {
		return e.meta.next
	}
	return nil
}

func (e *Entry[K, V]) NextExpire() *Entry[K, V] {
	if p := e.meta.wheelNext; !p.flag.IsRoot() {
		return e.meta.wheelNext
	}
	return nil
}

func (e *Entry[K, V]) prev(listType uint8) *Entry[K, V] {
	switch listType {
	case LIST_PROBATION, LIST_PROTECTED, LIST_WINDOW:
		return e.meta.prev
	case WHEEL_LIST:
		return e.meta.wheelPrev
	}
	return nil
}

func (e *Entry[K, V]) next(listType uint8) *Entry[K, V] {
	switch listType {
	case LIST_PROBATION, LIST_PROTECTED, LIST_WINDOW:
		return e.meta.next
	case WHEEL_LIST:
		return e.meta.wheelNext
	}
	return nil
}

func (e *Entry[K, V]) setPrev(entry *Entry[K, V], listType uint8) {
	switch listType {
	case LIST_PROBATION, LIST_PROTECTED, LIST_WINDOW:
		e.meta.prev = entry
	case WHEEL_LIST:
		e.meta.wheelPrev = entry
	}
}

func (e *Entry[K, V]) setNext(entry *Entry[K, V], listType uint8) {
	switch listType {
	case LIST_PROBATION, LIST_PROTECTED, LIST_WINDOW:
		e.meta.next = entry
	case WHEEL_LIST:
		e.meta.wheelNext = entry
	}
}

func (e *Entry[K, V]) pentry() *Pentry[K, V] {
	return &Pentry[K, V]{
		Key:          e.key,
		Value:        e.value,
		Weight:       e.weight.Load(),
		PolicyWeight: e.policyWeight,
		Expire:       e.expire.Load(),
		Flag:         e.flag,
	}
}

// entry for persistence
type Pentry[K comparable, V any] struct {
	Key          K
	Value        V
	Weight       int64
	PolicyWeight int64
	Expire       int64
	Frequency    int
	Flag         Flag
}

func (e *Pentry[K, V]) entry() *Entry[K, V] {
	en := &Entry[K, V]{
		key:   e.Key,
		value: e.Value,
	}
	en.weight.Store(e.Weight)
	en.expire.Store(e.Expire)
	en.flag = e.Flag
	en.policyWeight = e.PolicyWeight
	return en
}

func (e *Entry[K, V]) Weight() int64 {
	return e.weight.Load()
}

func (e *Entry[K, V]) PolicyWeight() int64 {
	return e.policyWeight
}

func (e *Entry[K, V]) Position() string {
	switch {
	case e.flag.IsWindow():
		return "WINDOW"
	case e.flag.IsProbation():
		return "PROBATION"
	case e.flag.IsProtected():
		return "PROTECTED"
	case e.flag.IsRemoved():
		return "REMOVED"
	}
	return "UNKNOWN"
}
