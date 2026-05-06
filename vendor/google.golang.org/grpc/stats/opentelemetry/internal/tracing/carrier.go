/*
 *
 * Copyright 2024 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// Package tracing implements the OpenTelemetry carrier for context propagation
// in gRPC tracing.
package tracing

import (
	"context"

	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/metadata"
)

var logger = grpclog.Component("otel-plugin")

// IncomingCarrier is a TextMapCarrier that uses incoming `context.Context` to
// retrieve any propagated key-value pairs in text format.
type IncomingCarrier struct {
	ctx context.Context
}

// NewIncomingCarrier creates a new `IncomingCarrier` with the given context.
// The incoming carrier should be used with propagator's `Extract()` method in
// the incoming rpc path.
func NewIncomingCarrier(ctx context.Context) *IncomingCarrier {
	return &IncomingCarrier{ctx: ctx}
}

// Get returns the string value associated with the passed key from the
// carrier's incoming context metadata.
//
// It returns an empty string if the key is not present in the carrier's
// context or if the value associated with the key is empty.
//
// If multiple values are present for a key, it returns the last one.
func (c *IncomingCarrier) Get(key string) string {
	values := metadata.ValueFromIncomingContext(c.ctx, key)
	if len(values) == 0 {
		return ""
	}
	return values[len(values)-1]
}

// Set just logs an error. It implements the `TextMapCarrier` interface but
// should not be used with `IncomingCarrier`.
func (c *IncomingCarrier) Set(string, string) {
	logger.Error("Set() should not be used with IncomingCarrier.")
}

// Keys returns the keys stored in the carrier's context metadata. It returns
// keys from incoming context metadata.
func (c *IncomingCarrier) Keys() []string {
	md, ok := metadata.FromIncomingContext(c.ctx)
	if !ok {
		return nil
	}
	keys := make([]string, 0, len(md))
	for key := range md {
		keys = append(keys, key)
	}
	return keys
}

// Context returns the underlying context associated with the
// `IncomingCarrier“.
func (c *IncomingCarrier) Context() context.Context {
	return c.ctx
}

// OutgoingCarrier is a TextMapCarrier that uses outgoing `context.Context` to
// store any propagated key-value pairs in text format.
type OutgoingCarrier struct {
	ctx context.Context
}

// NewOutgoingCarrier creates a new Carrier with the given context. The
// outgoing carrier should be used with propagator's `Inject()` method in the
// outgoing rpc path.
func NewOutgoingCarrier(ctx context.Context) *OutgoingCarrier {
	return &OutgoingCarrier{ctx: ctx}
}

// Get just logs an error and returns an empty string. It implements the
// `TextMapCarrier` interface but should not be used with `OutgoingCarrier`.
func (c *OutgoingCarrier) Get(string) string {
	logger.Error("Get() should not be used with `OutgoingCarrier`")
	return ""
}

// Set stores the key-value pair in the carrier's outgoing context metadata.
//
// If the key already exists, given value is appended to the last.
func (c *OutgoingCarrier) Set(key, value string) {
	c.ctx = metadata.AppendToOutgoingContext(c.ctx, key, value)
}

// Keys returns the keys stored in the carrier's context metadata. It returns
// keys from outgoing context metadata.
func (c *OutgoingCarrier) Keys() []string {
	md, ok := metadata.FromOutgoingContext(c.ctx)
	if !ok {
		return nil
	}
	keys := make([]string, 0, len(md))
	for key := range md {
		keys = append(keys, key)
	}
	return keys
}

// Context returns the underlying context associated with the
// `OutgoingCarrier“.
func (c *OutgoingCarrier) Context() context.Context {
	return c.ctx
}
