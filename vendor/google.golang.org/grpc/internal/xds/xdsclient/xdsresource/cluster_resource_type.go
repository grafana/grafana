/*
 *
 * Copyright 2022 gRPC authors.
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

import (
	"bytes"
	"fmt"

	"google.golang.org/grpc/internal/xds/bootstrap"
	xdsclient "google.golang.org/grpc/internal/xds/clients/xdsclient"
	"google.golang.org/grpc/internal/xds/xdsclient/xdsresource/version"
)

const (
	// ClusterResourceTypeName represents the transport agnostic name for the
	// cluster resource.
	ClusterResourceTypeName = "ClusterResource"
)

// clusterResourceDecoder is an implementation of the xdsclient.Decoder
// interface for listener resources.
type clusterResourceDecoder struct {
	bootstrapConfig *bootstrap.Config
	serverConfigs   map[xdsclient.ServerConfig]*bootstrap.ServerConfig
}

func (d *clusterResourceDecoder) Decode(resource *xdsclient.AnyProto, opts xdsclient.DecodeOptions) (*xdsclient.DecodeResult, error) {
	serverCfg, ok := d.serverConfigs[*opts.ServerConfig]
	if !ok {
		return nil, fmt.Errorf("no server config found for {%+v}", opts.ServerConfig)
	}
	name, cluster, err := unmarshalClusterResource(resource.ToAny(), serverCfg)
	if name == "" {
		// Name is unset only when protobuf deserialization fails.
		return nil, err
	}
	if err != nil {
		// Protobuf deserialization succeeded, but resource validation failed.
		return &xdsclient.DecodeResult{
			Name:     name,
			Resource: &ClusterResourceData{Resource: ClusterUpdate{}},
		}, err
	}

	// Perform extra validation here.
	if err := securityConfigValidator(d.bootstrapConfig, cluster.SecurityCfg); err != nil {
		return &xdsclient.DecodeResult{
			Name:     name,
			Resource: &ClusterResourceData{Resource: ClusterUpdate{}},
		}, err
	}

	return &xdsclient.DecodeResult{
		Name:     name,
		Resource: &ClusterResourceData{Resource: cluster},
	}, nil
}

// ClusterResourceData wraps the configuration of a Cluster resource as received
// from the management server.
type ClusterResourceData struct {
	Resource ClusterUpdate
}

// Equal returns true if other is equal to c.
func (c *ClusterResourceData) Equal(other xdsclient.ResourceData) bool {
	if other == nil {
		return false
	}
	return bytes.Equal(c.Bytes(), other.Bytes())
}

// Bytes returns the protobuf serialized bytes of the cluster resource proto.
func (c *ClusterResourceData) Bytes() []byte {
	return c.Resource.Raw.GetValue()
}

// ClusterWatcher wraps the callbacks to be invoked for different events
// corresponding to the cluster resource being watched. gRFC A88 contains an
// exhaustive list of what method is invoked under what conditions.
type ClusterWatcher interface {
	// ResourceChanged indicates a new version of the resource is available.
	ResourceChanged(resource *ClusterUpdate, done func())

	// ResourceError indicates an error occurred while trying to fetch or
	// decode the associated resource. The previous version of the resource
	// should be considered invalid.
	ResourceError(err error, done func())

	// AmbientError indicates an error occurred after a resource has been
	// received that should not modify the use of that resource but may provide
	// useful information about the state of the XDSClient for debugging
	// purposes. The previous version of the resource should still be
	// considered valid.
	AmbientError(err error, done func())
}

type delegatingClusterWatcher struct {
	watcher ClusterWatcher
}

func (d *delegatingClusterWatcher) ResourceChanged(data xdsclient.ResourceData, onDone func()) {
	c := data.(*ClusterResourceData)
	d.watcher.ResourceChanged(&c.Resource, onDone)
}

func (d *delegatingClusterWatcher) ResourceError(err error, onDone func()) {
	d.watcher.ResourceError(err, onDone)
}

func (d *delegatingClusterWatcher) AmbientError(err error, onDone func()) {
	d.watcher.AmbientError(err, onDone)
}

// WatchCluster uses xDS to discover the configuration associated with the
// provided cluster resource name.
func WatchCluster(p Producer, name string, w ClusterWatcher) (cancel func()) {
	return p.WatchResource(version.V3ClusterURL, name, &delegatingClusterWatcher{watcher: w})
}

// NewClusterResourceTypeDecoder returns a xdsclient.Decoder that wraps
// the xdsresource.clusterType.
func NewClusterResourceTypeDecoder(bc *bootstrap.Config, gServerCfgMap map[xdsclient.ServerConfig]*bootstrap.ServerConfig) xdsclient.Decoder {
	return &clusterResourceDecoder{bootstrapConfig: bc, serverConfigs: gServerCfgMap}
}
