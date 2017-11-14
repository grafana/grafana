// Copyright (c) 2012 The gocql Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gocql

import (
	"sync"
	"sync/atomic"
)

type Node interface {
	Pick(qry *Query) *Conn
	Close()
}

type RoundRobin struct {
	pool []Node
	pos  uint32
	mu   sync.RWMutex
}

func NewRoundRobin() *RoundRobin {
	return &RoundRobin{}
}

func (r *RoundRobin) AddNode(node Node) {
	r.mu.Lock()
	r.pool = append(r.pool, node)
	r.mu.Unlock()
}

func (r *RoundRobin) RemoveNode(node Node) {
	r.mu.Lock()
	n := len(r.pool)
	for i := 0; i < n; i++ {
		if r.pool[i] == node {
			r.pool[i], r.pool[n-1] = r.pool[n-1], r.pool[i]
			r.pool = r.pool[:n-1]
			break
		}
	}
	r.mu.Unlock()
}

func (r *RoundRobin) Size() int {
	r.mu.RLock()
	n := len(r.pool)
	r.mu.RUnlock()
	return n
}

func (r *RoundRobin) Pick(qry *Query) *Conn {
	pos := atomic.AddUint32(&r.pos, 1)
	var node Node
	r.mu.RLock()
	if len(r.pool) > 0 {
		node = r.pool[pos%uint32(len(r.pool))]
	}
	r.mu.RUnlock()
	if node == nil {
		return nil
	}
	return node.Pick(qry)
}

func (r *RoundRobin) Close() {
	r.mu.Lock()
	for i := 0; i < len(r.pool); i++ {
		r.pool[i].Close()
	}
	r.pool = nil
	r.mu.Unlock()
}
