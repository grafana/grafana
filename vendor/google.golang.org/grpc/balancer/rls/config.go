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

package rls

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"google.golang.org/grpc/balancer"
	"google.golang.org/grpc/balancer/rls/internal/keys"
	"google.golang.org/grpc/internal"
	"google.golang.org/grpc/internal/pretty"
	rlspb "google.golang.org/grpc/internal/proto/grpc_lookup_v1"
	"google.golang.org/grpc/resolver"
	"google.golang.org/grpc/serviceconfig"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/durationpb"
)

const (
	// Default max_age if not specified (or greater than this value) in the
	// service config.
	maxMaxAge = 5 * time.Minute
	// Upper limit for cache_size since we don't fully trust the service config.
	maxCacheSize = 5 * 1024 * 1024 * 8 // 5MB in bytes
	// Default lookup_service_timeout if not specified in the service config.
	defaultLookupServiceTimeout = 10 * time.Second
	// Default value for targetNameField in the child policy config during
	// service config validation.
	dummyChildPolicyTarget = "target_name_to_be_filled_in_later"
)

// lbConfig is the internal representation of the RLS LB policy's config.
type lbConfig struct {
	serviceconfig.LoadBalancingConfig

	cacheSizeBytes       int64 // Keep this field 64-bit aligned.
	kbMap                keys.BuilderMap
	lookupService        string
	lookupServiceTimeout time.Duration
	maxAge               time.Duration
	staleAge             time.Duration
	defaultTarget        string

	childPolicyName             string
	childPolicyConfig           map[string]json.RawMessage
	childPolicyTargetField      string
	controlChannelServiceConfig string
}

func (lbCfg *lbConfig) Equal(other *lbConfig) bool {
	return lbCfg.kbMap.Equal(other.kbMap) &&
		lbCfg.lookupService == other.lookupService &&
		lbCfg.lookupServiceTimeout == other.lookupServiceTimeout &&
		lbCfg.maxAge == other.maxAge &&
		lbCfg.staleAge == other.staleAge &&
		lbCfg.cacheSizeBytes == other.cacheSizeBytes &&
		lbCfg.defaultTarget == other.defaultTarget &&
		lbCfg.childPolicyName == other.childPolicyName &&
		lbCfg.childPolicyTargetField == other.childPolicyTargetField &&
		lbCfg.controlChannelServiceConfig == other.controlChannelServiceConfig &&
		childPolicyConfigEqual(lbCfg.childPolicyConfig, other.childPolicyConfig)
}

func childPolicyConfigEqual(a, b map[string]json.RawMessage) bool {
	if (b == nil) != (a == nil) {
		return false
	}
	if len(b) != len(a) {
		return false
	}
	for k, jsonA := range a {
		jsonB, ok := b[k]
		if !ok {
			return false
		}
		if !bytes.Equal(jsonA, jsonB) {
			return false
		}
	}
	return true
}

// This struct resembles the JSON representation of the loadBalancing config
// and makes it easier to unmarshal.
type lbConfigJSON struct {
	RouteLookupConfig                json.RawMessage
	RouteLookupChannelServiceConfig  json.RawMessage
	ChildPolicy                      []map[string]json.RawMessage
	ChildPolicyConfigTargetFieldName string
}

// ParseConfig parses the JSON load balancer config provided into an
// internal form or returns an error if the config is invalid.
//
//	 When parsing a config update, the following validations are performed:
//	 - routeLookupConfig:
//	   - grpc_keybuilders field:
//	     - must have at least one entry
//	     - must not have two entries with the same `Name`
//	     - within each entry:
//	       - must have at least one `Name`
//	       - must not have a `Name` with the `service` field unset or empty
//	       - within each `headers` entry:
//	         - must not have `required_match` set
//	         - must not have `key` unset or empty
//	       - across all `headers`, `constant_keys` and `extra_keys` fields:
//	         - must not have the same `key` specified twice
//	         - no `key` must be the empty string
//	   - `lookup_service` field must be set and must parse as a target URI
//	   - if `max_age` > 5m, it should be set to 5 minutes
//	   - if `stale_age` > `max_age`, ignore it
//	   - if `stale_age` is set, then `max_age` must also be set
//	   - ignore `valid_targets` field
//	   - `cache_size_bytes` field must have a value greater than 0, and if its
//	     value is greater than 5M, we cap it at 5M
//
//	- routeLookupChannelServiceConfig:
//	  - if specified, must parse as valid service config
//
//	- childPolicy:
//	  - must find a valid child policy with a valid config
//
//	- childPolicyConfigTargetFieldName:
//	  - must be set and non-empty
func (rlsBB) ParseConfig(c json.RawMessage) (serviceconfig.LoadBalancingConfig, error) {
	if logger.V(2) {
		logger.Infof("Received JSON service config: %v", pretty.ToJSON(c))
	}

	cfgJSON := &lbConfigJSON{}
	if err := json.Unmarshal(c, cfgJSON); err != nil {
		return nil, fmt.Errorf("rls: json unmarshal failed for service config %+v: %v", string(c), err)
	}

	m := protojson.UnmarshalOptions{DiscardUnknown: true}
	rlsProto := &rlspb.RouteLookupConfig{}
	if err := m.Unmarshal(cfgJSON.RouteLookupConfig, rlsProto); err != nil {
		return nil, fmt.Errorf("rls: bad RouteLookupConfig proto %+v: %v", string(cfgJSON.RouteLookupConfig), err)
	}
	lbCfg, err := parseRLSProto(rlsProto)
	if err != nil {
		return nil, err
	}

	if sc := string(cfgJSON.RouteLookupChannelServiceConfig); sc != "" {
		parsed := internal.ParseServiceConfig.(func(string) *serviceconfig.ParseResult)(sc)
		if parsed.Err != nil {
			return nil, fmt.Errorf("rls: bad control channel service config %q: %v", sc, parsed.Err)
		}
		lbCfg.controlChannelServiceConfig = sc
	}

	if cfgJSON.ChildPolicyConfigTargetFieldName == "" {
		return nil, fmt.Errorf("rls: childPolicyConfigTargetFieldName field is not set in service config %+v", string(c))
	}
	name, config, err := parseChildPolicyConfigs(cfgJSON.ChildPolicy, cfgJSON.ChildPolicyConfigTargetFieldName)
	if err != nil {
		return nil, err
	}
	lbCfg.childPolicyName = name
	lbCfg.childPolicyConfig = config
	lbCfg.childPolicyTargetField = cfgJSON.ChildPolicyConfigTargetFieldName
	return lbCfg, nil
}

func parseRLSProto(rlsProto *rlspb.RouteLookupConfig) (*lbConfig, error) {
	// Validations specified on the `grpc_keybuilders` field are performed here.
	kbMap, err := keys.MakeBuilderMap(rlsProto)
	if err != nil {
		return nil, err
	}

	// `lookup_service` field must be set and must parse as a target URI.
	lookupService := rlsProto.GetLookupService()
	if lookupService == "" {
		return nil, fmt.Errorf("rls: empty lookup_service in route lookup config %+v", rlsProto)
	}
	parsedTarget, err := url.Parse(lookupService)
	if err != nil {
		// url.Parse() fails if scheme is missing. Retry with default scheme.
		parsedTarget, err = url.Parse(resolver.GetDefaultScheme() + ":///" + lookupService)
		if err != nil {
			return nil, fmt.Errorf("rls: invalid target URI in lookup_service %s", lookupService)
		}
	}
	if parsedTarget.Scheme == "" {
		parsedTarget.Scheme = resolver.GetDefaultScheme()
	}
	if resolver.Get(parsedTarget.Scheme) == nil {
		return nil, fmt.Errorf("rls: unregistered scheme in lookup_service %s", lookupService)
	}

	lookupServiceTimeout, err := convertDuration(rlsProto.GetLookupServiceTimeout())
	if err != nil {
		return nil, fmt.Errorf("rls: failed to parse lookup_service_timeout in route lookup config %+v: %v", rlsProto, err)
	}
	if lookupServiceTimeout == 0 {
		lookupServiceTimeout = defaultLookupServiceTimeout
	}

	// Validations performed here:
	// - if `max_age` > 5m, it should be set to 5 minutes
	//   only if stale age is not set
	// - if `stale_age` > `max_age`, ignore it
	// - if `stale_age` is set, then `max_age` must also be set
	maxAgeSet := false
	maxAge, err := convertDuration(rlsProto.GetMaxAge())
	if err != nil {
		return nil, fmt.Errorf("rls: failed to parse max_age in route lookup config %+v: %v", rlsProto, err)
	}
	if maxAge == 0 {
		maxAge = maxMaxAge
	} else {
		maxAgeSet = true
	}

	staleAgeSet := false
	staleAge, err := convertDuration(rlsProto.GetStaleAge())
	if err != nil {
		return nil, fmt.Errorf("rls: failed to parse staleAge in route lookup config %+v: %v", rlsProto, err)
	}
	if staleAge == 0 {
		staleAge = maxMaxAge
	} else {
		staleAgeSet = true
	}

	if staleAgeSet && !maxAgeSet {
		return nil, fmt.Errorf("rls: stale_age is set, but max_age is not in route lookup config %+v", rlsProto)
	}
	if staleAge > maxMaxAge {
		staleAge = maxMaxAge
	}
	if !staleAgeSet && maxAge > maxMaxAge {
		maxAge = maxMaxAge
	}
	if staleAge > maxAge {
		staleAge = maxAge
	}

	// `cache_size_bytes` field must have a value greater than 0, and if its
	// value is greater than 5M, we cap it at 5M
	cacheSizeBytes := rlsProto.GetCacheSizeBytes()
	if cacheSizeBytes <= 0 {
		return nil, fmt.Errorf("rls: cache_size_bytes must be set to a non-zero value: %+v", rlsProto)
	}
	if cacheSizeBytes > maxCacheSize {
		logger.Info("rls: cache_size_bytes %v is too large, setting it to: %v", cacheSizeBytes, maxCacheSize)
		cacheSizeBytes = maxCacheSize
	}
	return &lbConfig{
		kbMap:                kbMap,
		lookupService:        lookupService,
		lookupServiceTimeout: lookupServiceTimeout,
		maxAge:               maxAge,
		staleAge:             staleAge,
		cacheSizeBytes:       cacheSizeBytes,
		defaultTarget:        rlsProto.GetDefaultTarget(),
	}, nil
}

// parseChildPolicyConfigs iterates through the list of child policies and picks
// the first registered policy and validates its config.
func parseChildPolicyConfigs(childPolicies []map[string]json.RawMessage, targetFieldName string) (string, map[string]json.RawMessage, error) {
	for i, config := range childPolicies {
		if len(config) != 1 {
			return "", nil, fmt.Errorf("rls: invalid childPolicy: entry %v does not contain exactly 1 policy/config pair: %q", i, config)
		}

		var name string
		var rawCfg json.RawMessage
		for name, rawCfg = range config {
		}
		builder := balancer.Get(name)
		if builder == nil {
			continue
		}
		parser, ok := builder.(balancer.ConfigParser)
		if !ok {
			return "", nil, fmt.Errorf("rls: childPolicy %q with config %q does not support config parsing", name, string(rawCfg))
		}

		// To validate child policy configs we do the following:
		// - unmarshal the raw JSON bytes of the child policy config into a map
		// - add an entry with key set to `target_field_name` and a dummy value
		// - marshal the map back to JSON and parse the config using the parser
		// retrieved previously
		var childConfig map[string]json.RawMessage
		if err := json.Unmarshal(rawCfg, &childConfig); err != nil {
			return "", nil, fmt.Errorf("rls: json unmarshal failed for child policy config %q: %v", string(rawCfg), err)
		}
		childConfig[targetFieldName], _ = json.Marshal(dummyChildPolicyTarget)
		jsonCfg, err := json.Marshal(childConfig)
		if err != nil {
			return "", nil, fmt.Errorf("rls: json marshal failed for child policy config {%+v}: %v", childConfig, err)
		}
		if _, err := parser.ParseConfig(jsonCfg); err != nil {
			return "", nil, fmt.Errorf("rls: childPolicy config validation failed: %v", err)
		}
		return name, childConfig, nil
	}
	return "", nil, fmt.Errorf("rls: invalid childPolicy config: no supported policies found in %+v", childPolicies)
}

func convertDuration(d *durationpb.Duration) (time.Duration, error) {
	if d == nil {
		return 0, nil
	}
	return d.AsDuration(), d.CheckValid()
}
