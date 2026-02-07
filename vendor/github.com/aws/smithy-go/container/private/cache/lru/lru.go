// Package lru implements [cache.Cache] with an LRU eviction policy.
//
// This implementation is NOT thread-safe.
//
// This package is designated as private and is intended for use only by the
// smithy client runtime. The exported API therein is not considered stable and
// is subject to breaking changes without notice.
package lru

import (
	"container/list"

	"github.com/aws/smithy-go/container/private/cache"
)

// New creates a new LRU cache with the given capacity.
func New(cap int) cache.Cache {
	return &lru{
		entries: make(map[interface{}]*list.Element, cap),
		cap:     cap,
		mru:     list.New(),
	}
}

type lru struct {
	entries map[interface{}]*list.Element
	cap     int

	mru *list.List // least-recently used is at the back
}

type element struct {
	key   interface{}
	value interface{}
}

func (l *lru) Get(k interface{}) (interface{}, bool) {
	e, ok := l.entries[k]
	if !ok {
		return nil, false
	}

	l.mru.MoveToFront(e)
	return e.Value.(*element).value, true
}

func (l *lru) Put(k interface{}, v interface{}) {
	if len(l.entries) == l.cap {
		l.evict()
	}

	ev := &element{
		key:   k,
		value: v,
	}
	e := l.mru.PushFront(ev)
	l.entries[k] = e
}

func (l *lru) evict() {
	e := l.mru.Remove(l.mru.Back())
	delete(l.entries, e.(*element).key)
}
