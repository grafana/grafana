/*
 *
 * Copyright 2025 gRPC authors.
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
 */

package xdsresource

import "google.golang.org/grpc/resolver"

// XDSConfig holds the complete gRPC client-side xDS configuration containing
// all necessary resources.
type XDSConfig struct {
	// Listener holds the listener configuration. It is guaranteed to be
	// non-nil.
	Listener *ListenerUpdate

	// RouteConfig holds the route configuration. It will be populated even if
	// the route configuration was inlined into the Listener resource. It is
	// guaranteed to be non-nil.
	RouteConfig *RouteConfigUpdate

	// VirtualHost is selected from the route configuration whose domain field
	// offers the best match against the provided dataplane authority. It is
	// guaranteed to be non-nil.
	VirtualHost *VirtualHost

	// Clusters is a map from cluster name to its configuration.
	Clusters map[string]*ClusterResult
}

// ClusterResult contains a cluster's configuration when a valid resource is
// received from the management server. It contains an error when:
//   - an invalid resource is received from the management server and
//     a valid resource was not already present or
//   - the cluster resource does not exist on the management server
type ClusterResult struct {
	Config ClusterConfig
	Err    error
}

// ClusterConfig contains configuration for a single cluster.
type ClusterConfig struct {
	// Cluster configuration for the cluster. This field is always set to a
	// non-nil value.
	Cluster *ClusterUpdate
	// EndpointConfig contains endpoint configuration for a leaf cluster. This
	// field is only set for EDS and LOGICAL_DNS clusters.
	EndpointConfig *EndpointConfig
	// AggregateConfig contains configuration for an aggregate cluster. This
	// field is only set for AGGREGATE clusters.
	AggregateConfig *AggregateConfig
}

// AggregateConfig holds the configuration for an aggregate cluster.
type AggregateConfig struct {
	// LeafClusters contains a prioritized list of names of the leaf clusters
	// for the cluster.
	LeafClusters []string
}

// EndpointConfig contains configuration corresponding to the endpoints in a
// cluster. Only one of EDSUpdate or DNSEndpoints will be populated based on the
// cluster type.
type EndpointConfig struct {
	// Endpoint configurartion for the EDS clusters.
	EDSUpdate *EndpointsUpdate
	// Endpoint configuration for the LOGICAL_DNS clusters.
	DNSEndpoints *DNSUpdate
	// ResolutionNote stores error encountered while obtaining endpoints data
	// for the cluster. It will contain a nil value when a valid endpoint data is
	// received. It contains an error when:
	//   - an invalid resource is received from the management server or
	//   - the endpoint resource does not exist on the management server
	ResolutionNote error
}

// DNSUpdate represents the result of a DNS resolution, containing a list of
// discovered endpoints.
type DNSUpdate struct {
	// Endpoints is the complete list of endpoints returned by the DNS resolver.
	Endpoints []resolver.Endpoint
}

// xdsConfigkey is the type used as the key to store XDSConfig in the Attributes
// field of resolver.State.
type xdsConfigkey struct{}

// SetXDSConfig returns a copy of state in which the Attributes field is updated
// with the XDSConfig.
func SetXDSConfig(state resolver.State, config *XDSConfig) resolver.State {
	state.Attributes = state.Attributes.WithValue(xdsConfigkey{}, config)
	return state
}

// XDSConfigFromResolverState returns XDSConfig stored as an attribute in the
// resolver state.
func XDSConfigFromResolverState(state resolver.State) *XDSConfig {
	if v := state.Attributes.Value(xdsConfigkey{}); v != nil {
		return v.(*XDSConfig)
	}
	return nil
}
