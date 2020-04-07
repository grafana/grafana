// Copyright (c) 2019 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaeger

import "sync"

// SpanAllocator abstraction of managign span allocations
type SpanAllocator interface {
	Get() *Span
	Put(*Span)
}

type syncPollSpanAllocator struct {
	spanPool sync.Pool
}

func newSyncPollSpanAllocator() SpanAllocator {
	return &syncPollSpanAllocator{
		spanPool: sync.Pool{New: func() interface{} {
			return &Span{}
		}},
	}
}

func (pool *syncPollSpanAllocator) Get() *Span {
	return pool.spanPool.Get().(*Span)
}

func (pool *syncPollSpanAllocator) Put(span *Span) {
	span.reset()
	pool.spanPool.Put(span)
}

type simpleSpanAllocator struct{}

func (pool simpleSpanAllocator) Get() *Span {
	return &Span{}
}

func (pool simpleSpanAllocator) Put(span *Span) {
	// @comment https://github.com/jaegertracing/jaeger-client-go/pull/381#issuecomment-475904351
	// since finished spans are not reused, no need to reset them
	// span.reset()
}
