/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package thrift

import (
	"bytes"
	"sync"
)

// pool is a generic sync.Pool wrapper with bells and whistles.
type pool[T any] struct {
	pool  sync.Pool
	reset func(*T)
}

// newPool creates a new pool.
//
// Both generate and reset are optional.
// Default generate is just new(T),
// When reset is nil we don't do any additional resetting when calling get.
func newPool[T any](generate func() *T, reset func(*T)) *pool[T] {
	if generate == nil {
		generate = func() *T {
			return new(T)
		}
	}
	return &pool[T]{
		pool: sync.Pool{
			New: func() interface{} {
				return generate()
			},
		},
		reset: reset,
	}
}

func (p *pool[T]) get() *T {
	r := p.pool.Get().(*T)
	if p.reset != nil {
		p.reset(r)
	}
	return r
}

func (p *pool[T]) put(r **T) {
	p.pool.Put(*r)
	*r = nil
}

var bufPool = newPool(nil, func(buf *bytes.Buffer) {
	buf.Reset()
})
