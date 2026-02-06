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

// Package keys provides functionality required to build RLS request keys.
package keys

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	rlspb "google.golang.org/grpc/internal/proto/grpc_lookup_v1"
	"google.golang.org/grpc/metadata"
)

// BuilderMap maps from request path to the key builder for that path.
type BuilderMap map[string]builder

// MakeBuilderMap parses the provided RouteLookupConfig proto and returns a map
// from paths to key builders.
func MakeBuilderMap(cfg *rlspb.RouteLookupConfig) (BuilderMap, error) {
	kbs := cfg.GetGrpcKeybuilders()
	if len(kbs) == 0 {
		return nil, errors.New("rls: RouteLookupConfig does not contain any GrpcKeyBuilder")
	}

	bm := make(map[string]builder)
	for _, kb := range kbs {
		// Extract keys from `headers`, `constant_keys` and `extra_keys` fields
		// and populate appropriate values in the builder struct. Also ensure
		// that keys are not repeated.
		var matchers []matcher
		seenKeys := make(map[string]bool)
		constantKeys := kb.GetConstantKeys()
		for k := range kb.GetConstantKeys() {
			seenKeys[k] = true
		}
		for _, h := range kb.GetHeaders() {
			if h.GetRequiredMatch() {
				return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig has required_match field set {%+v}", kbs)
			}
			key := h.GetKey()
			if seenKeys[key] {
				return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig contains repeated key %q across headers, constant_keys and extra_keys {%+v}", key, kbs)
			}
			seenKeys[key] = true
			matchers = append(matchers, matcher{key: h.GetKey(), names: h.GetNames()})
		}
		if seenKeys[kb.GetExtraKeys().GetHost()] {
			return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig contains repeated key %q in extra_keys from constant_keys or headers {%+v}", kb.GetExtraKeys().GetHost(), kbs)
		}
		if seenKeys[kb.GetExtraKeys().GetService()] {
			return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig contains repeated key %q in extra_keys from constant_keys or headers {%+v}", kb.GetExtraKeys().GetService(), kbs)
		}
		if seenKeys[kb.GetExtraKeys().GetMethod()] {
			return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig contains repeated key %q in extra_keys from constant_keys or headers {%+v}", kb.GetExtraKeys().GetMethod(), kbs)
		}
		b := builder{
			headerKeys:   matchers,
			constantKeys: constantKeys,
			hostKey:      kb.GetExtraKeys().GetHost(),
			serviceKey:   kb.GetExtraKeys().GetService(),
			methodKey:    kb.GetExtraKeys().GetMethod(),
		}

		// Store the builder created above in the BuilderMap based on the value
		// of the `Names` field, which wraps incoming request's service and
		// method. Also, ensure that there are no repeated `Names` field.
		names := kb.GetNames()
		if len(names) == 0 {
			return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig does not contain any Name {%+v}", kbs)
		}
		for _, name := range names {
			if name.GetService() == "" {
				return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig contains a Name field with no Service {%+v}", kbs)
			}
			if strings.Contains(name.GetMethod(), `/`) {
				return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig contains a method with a slash {%+v}", kbs)
			}
			path := "/" + name.GetService() + "/" + name.GetMethod()
			if _, ok := bm[path]; ok {
				return nil, fmt.Errorf("rls: GrpcKeyBuilder in RouteLookupConfig contains repeated Name field {%+v}", kbs)
			}
			bm[path] = b
		}
	}
	return bm, nil
}

// KeyMap represents the RLS keys to be used for a request.
type KeyMap struct {
	// Map is the representation of an RLS key as a Go map. This is used when
	// an actual RLS request is to be sent out on the wire, since the
	// RouteLookupRequest proto expects a Go map.
	Map map[string]string
	// Str is the representation of an RLS key as a string, sorted by keys.
	// Since the RLS keys are part of the cache key in the request cache
	// maintained by the RLS balancer, and Go maps cannot be used as keys for
	// Go maps (the cache is implemented as a map), we need a stringified
	// version of it.
	Str string
}

// RLSKey builds the RLS keys to be used for the given request, identified by
// the request path and the request headers stored in metadata.
func (bm BuilderMap) RLSKey(md metadata.MD, host, path string) KeyMap {
	// The path passed in is of the form "/service/method". The keyBuilderMap is
	// indexed with keys of the form "/service/" or "/service/method". The service
	// that we set in the keyMap (to be sent out in the RLS request) should not
	// include any slashes though.
	i := strings.LastIndex(path, "/")
	service, method := path[:i+1], path[i+1:]
	b, ok := bm[path]
	if !ok {
		b, ok = bm[service]
		if !ok {
			return KeyMap{}
		}
	}

	kvMap := b.buildHeaderKeys(md)
	if b.hostKey != "" {
		kvMap[b.hostKey] = host
	}
	if b.serviceKey != "" {
		kvMap[b.serviceKey] = strings.Trim(service, "/")
	}
	if b.methodKey != "" {
		kvMap[b.methodKey] = method
	}
	for k, v := range b.constantKeys {
		kvMap[k] = v
	}
	return KeyMap{Map: kvMap, Str: mapToString(kvMap)}
}

// Equal reports whether bm and am represent equivalent BuilderMaps.
func (bm BuilderMap) Equal(am BuilderMap) bool {
	if (bm == nil) != (am == nil) {
		return false
	}
	if len(bm) != len(am) {
		return false
	}

	for key, bBuilder := range bm {
		aBuilder, ok := am[key]
		if !ok {
			return false
		}
		if !bBuilder.Equal(aBuilder) {
			return false
		}
	}
	return true
}

// builder provides the actual functionality of building RLS keys.
type builder struct {
	headerKeys   []matcher
	constantKeys map[string]string
	// The following keys mirror corresponding fields in `extra_keys`.
	hostKey    string
	serviceKey string
	methodKey  string
}

// Equal reports whether b and a represent equivalent key builders.
func (b builder) Equal(a builder) bool {
	if len(b.headerKeys) != len(a.headerKeys) {
		return false
	}
	// Protobuf serialization maintains the order of repeated fields. Matchers
	// are specified as a repeated field inside the KeyBuilder proto. If the
	// order changes, it means that the order in the protobuf changed. We report
	// this case as not being equal even though the builders could possibly be
	// functionally equal.
	for i, bMatcher := range b.headerKeys {
		aMatcher := a.headerKeys[i]
		if !bMatcher.Equal(aMatcher) {
			return false
		}
	}

	if len(b.constantKeys) != len(a.constantKeys) {
		return false
	}
	for k, v := range b.constantKeys {
		if a.constantKeys[k] != v {
			return false
		}
	}

	return b.hostKey == a.hostKey && b.serviceKey == a.serviceKey && b.methodKey == a.methodKey
}

// matcher helps extract a key from request headers based on a given name.
type matcher struct {
	// The key used in the keyMap sent as part of the RLS request.
	key string
	// List of header names which can supply the value for this key.
	names []string
}

// Equal reports if m and a are equivalent headerKeys.
func (m matcher) Equal(a matcher) bool {
	if m.key != a.key {
		return false
	}
	if len(m.names) != len(a.names) {
		return false
	}
	for i := 0; i < len(m.names); i++ {
		if m.names[i] != a.names[i] {
			return false
		}
	}
	return true
}

func (b builder) buildHeaderKeys(md metadata.MD) map[string]string {
	kvMap := make(map[string]string)
	if len(md) == 0 {
		return kvMap
	}
	for _, m := range b.headerKeys {
		for _, name := range m.names {
			if vals := md.Get(name); vals != nil {
				kvMap[m.key] = strings.Join(vals, ",")
				break
			}
		}
	}
	return kvMap
}

func mapToString(kv map[string]string) string {
	keys := make([]string, 0, len(kv))
	for k := range kv {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for i, k := range keys {
		if i != 0 {
			fmt.Fprint(&sb, ",")
		}
		fmt.Fprintf(&sb, "%s=%s", k, kv[k])
	}
	return sb.String()
}
