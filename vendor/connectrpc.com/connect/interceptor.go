// Copyright 2021-2024 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package connect

import (
	"context"
)

// UnaryFunc is the generic signature of a unary RPC. Interceptors may wrap
// Funcs.
//
// The type of the request and response structs depend on the codec being used.
// When using Protobuf, request.Any() and response.Any() will always be
// [proto.Message] implementations.
type UnaryFunc func(context.Context, AnyRequest) (AnyResponse, error)

// StreamingClientFunc is the generic signature of a streaming RPC from the client's
// perspective. Interceptors may wrap StreamingClientFuncs.
type StreamingClientFunc func(context.Context, Spec) StreamingClientConn

// StreamingHandlerFunc is the generic signature of a streaming RPC from the
// handler's perspective. Interceptors may wrap StreamingHandlerFuncs.
type StreamingHandlerFunc func(context.Context, StreamingHandlerConn) error

// An Interceptor adds logic to a generated handler or client, like the
// decorators or middleware you may have seen in other libraries. Interceptors
// may replace the context, mutate requests and responses, handle errors,
// retry, recover from panics, emit logs and metrics, or do nearly anything
// else.
//
// The returned functions must be safe to call concurrently.
type Interceptor interface {
	WrapUnary(UnaryFunc) UnaryFunc
	WrapStreamingClient(StreamingClientFunc) StreamingClientFunc
	WrapStreamingHandler(StreamingHandlerFunc) StreamingHandlerFunc
}

// UnaryInterceptorFunc is a simple Interceptor implementation that only
// wraps unary RPCs. It has no effect on streaming RPCs.
type UnaryInterceptorFunc func(UnaryFunc) UnaryFunc

// WrapUnary implements [Interceptor] by applying the interceptor function.
func (f UnaryInterceptorFunc) WrapUnary(next UnaryFunc) UnaryFunc { return f(next) }

// WrapStreamingClient implements [Interceptor] with a no-op.
func (f UnaryInterceptorFunc) WrapStreamingClient(next StreamingClientFunc) StreamingClientFunc {
	return next
}

// WrapStreamingHandler implements [Interceptor] with a no-op.
func (f UnaryInterceptorFunc) WrapStreamingHandler(next StreamingHandlerFunc) StreamingHandlerFunc {
	return next
}

// A chain composes multiple interceptors into one.
type chain struct {
	interceptors []Interceptor
}

// newChain composes multiple interceptors into one.
func newChain(interceptors []Interceptor) *chain {
	// We usually wrap in reverse order to have the first interceptor from
	// the slice act first. Rather than doing this dance repeatedly, reverse the
	// interceptor order now.
	var chain chain
	for i := len(interceptors) - 1; i >= 0; i-- {
		if interceptor := interceptors[i]; interceptor != nil {
			chain.interceptors = append(chain.interceptors, interceptor)
		}
	}
	return &chain
}

func (c *chain) WrapUnary(next UnaryFunc) UnaryFunc {
	for _, interceptor := range c.interceptors {
		next = interceptor.WrapUnary(next)
	}
	return next
}

func (c *chain) WrapStreamingClient(next StreamingClientFunc) StreamingClientFunc {
	for _, interceptor := range c.interceptors {
		next = interceptor.WrapStreamingClient(next)
	}
	return next
}

func (c *chain) WrapStreamingHandler(next StreamingHandlerFunc) StreamingHandlerFunc {
	for _, interceptor := range c.interceptors {
		next = interceptor.WrapStreamingHandler(next)
	}
	return next
}
