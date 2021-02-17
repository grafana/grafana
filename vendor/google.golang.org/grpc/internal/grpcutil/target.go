/*
 *
 * Copyright 2020 gRPC authors.
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

// Package grpcutil provides a bunch of utility functions to be used across the
// gRPC codebase.
package grpcutil

import (
	"strings"

	"google.golang.org/grpc/resolver"
)

// split2 returns the values from strings.SplitN(s, sep, 2).
// If sep is not found, it returns ("", "", false) instead.
func split2(s, sep string) (string, string, bool) {
	spl := strings.SplitN(s, sep, 2)
	if len(spl) < 2 {
		return "", "", false
	}
	return spl[0], spl[1], true
}

// ParseTarget splits target into a resolver.Target struct containing scheme,
// authority and endpoint.
//
// If target is not a valid scheme://authority/endpoint, it returns {Endpoint:
// target}.
func ParseTarget(target string) (ret resolver.Target) {
	var ok bool
	ret.Scheme, ret.Endpoint, ok = split2(target, "://")
	if !ok {
		return resolver.Target{Endpoint: target}
	}
	ret.Authority, ret.Endpoint, ok = split2(ret.Endpoint, "/")
	if !ok {
		return resolver.Target{Endpoint: target}
	}
	return ret
}
