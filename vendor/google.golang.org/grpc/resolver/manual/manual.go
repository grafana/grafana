/*
 *
 * Copyright 2017 gRPC authors.
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

// Package manual defines a resolver that can be used to manually send resolved
// addresses to ClientConn.
package manual

import (
	"strconv"
	"time"

	"google.golang.org/grpc/resolver"
)

// NewBuilderWithScheme creates a new test resolver builder with the given scheme.
func NewBuilderWithScheme(scheme string) *Resolver {
	return &Resolver{
		scheme: scheme,
	}
}

// Resolver is also a resolver builder.
// It's build() function always returns itself.
type Resolver struct {
	scheme string

	// Fields actually belong to the resolver.
	cc             resolver.ClientConn
	bootstrapAddrs []resolver.Address
}

// InitialAddrs adds resolved addresses to the resolver so that
// NewAddress doesn't need to be explicitly called after Dial.
func (r *Resolver) InitialAddrs(addrs []resolver.Address) {
	r.bootstrapAddrs = addrs
}

// Build returns itself for Resolver, because it's both a builder and a resolver.
func (r *Resolver) Build(target resolver.Target, cc resolver.ClientConn, opts resolver.BuildOption) (resolver.Resolver, error) {
	r.cc = cc
	if r.bootstrapAddrs != nil {
		r.NewAddress(r.bootstrapAddrs)
	}
	return r, nil
}

// Scheme returns the test scheme.
func (r *Resolver) Scheme() string {
	return r.scheme
}

// ResolveNow is a noop for Resolver.
func (*Resolver) ResolveNow(o resolver.ResolveNowOption) {}

// Close is a noop for Resolver.
func (*Resolver) Close() {}

// NewAddress calls cc.NewAddress.
func (r *Resolver) NewAddress(addrs []resolver.Address) {
	r.cc.NewAddress(addrs)
}

// NewServiceConfig calls cc.NewServiceConfig.
func (r *Resolver) NewServiceConfig(sc string) {
	r.cc.NewServiceConfig(sc)
}

// GenerateAndRegisterManualResolver generates a random scheme and a Resolver
// with it. It also regieter this Resolver.
// It returns the Resolver and a cleanup function to unregister it.
func GenerateAndRegisterManualResolver() (*Resolver, func()) {
	scheme := strconv.FormatInt(time.Now().UnixNano(), 36)
	r := NewBuilderWithScheme(scheme)
	resolver.Register(r)
	return r, func() { resolver.UnregisterForTesting(scheme) }
}
