// Copyright (c) 2017 Uber Technologies, Inc.
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

package rpcmetrics

import "sync"

// normalizedEndpoints is a cache for endpointName -> safeName mappings.
type normalizedEndpoints struct {
	names       map[string]string
	maxSize     int
	defaultName string
	normalizer  NameNormalizer
	mux         sync.RWMutex
}

func newNormalizedEndpoints(maxSize int, normalizer NameNormalizer) *normalizedEndpoints {
	return &normalizedEndpoints{
		maxSize:    maxSize,
		normalizer: normalizer,
		names:      make(map[string]string, maxSize),
	}
}

// normalize looks up the name in the cache, if not found it uses normalizer
// to convert the name to a safe name. If called with more than maxSize unique
// names it returns "" for all other names beyond those already cached.
func (n *normalizedEndpoints) normalize(name string) string {
	n.mux.RLock()
	norm, ok := n.names[name]
	l := len(n.names)
	n.mux.RUnlock()
	if ok {
		return norm
	}
	if l >= n.maxSize {
		return ""
	}
	return n.normalizeWithLock(name)
}

func (n *normalizedEndpoints) normalizeWithLock(name string) string {
	norm := n.normalizer.Normalize(name)
	n.mux.Lock()
	defer n.mux.Unlock()
	// cache may have grown while we were not holding the lock
	if len(n.names) >= n.maxSize {
		return ""
	}
	n.names[name] = norm
	return norm
}
