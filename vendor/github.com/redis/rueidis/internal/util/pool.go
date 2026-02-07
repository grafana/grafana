package util

import (
	"sync"
)

type Container interface {
	Capacity() int
	ResetLen(n int)
}

func NewPool[T Container](fn func(capacity int) T) *Pool[T] {
	return &Pool[T]{fn: fn}
}

type Pool[T Container] struct {
	sp sync.Pool
	fn func(capacity int) T
}

func (p *Pool[T]) Get(length, capacity int) T {
	s, ok := p.sp.Get().(T)
	if !ok {
		s = p.fn(capacity)
	} else if s.Capacity() < capacity {
		p.sp.Put(s)
		s = p.fn(capacity)
	}
	s.ResetLen(length)
	return s
}

func (p *Pool[T]) Put(s T) {
	s.ResetLen(0)
	p.sp.Put(s)
}
