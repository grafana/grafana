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

	"google.golang.org/grpc/internal/xds/bootstrap"
	xdsclient "google.golang.org/grpc/internal/xds/clients/xdsclient"
	"google.golang.org/grpc/internal/xds/xdsclient/xdsresource/version"
)

const (
	// EndpointsResourceTypeName represents the transport agnostic name for the
	// endpoint resource.
	EndpointsResourceTypeName = "EndpointsResource"
)

// endpointsResourceDecoder is an implementation of the xdsclient.Decoder
// interface for endpoints resources.
type endpointsResourceDecoder struct {
	bootstrapConfig *bootstrap.Config
}

func (d *endpointsResourceDecoder) Decode(resource *xdsclient.AnyProto, _ xdsclient.DecodeOptions) (*xdsclient.DecodeResult, error) {
	name, endpoints, err := unmarshalEndpointsResource(resource.ToAny())
	if name == "" {
		// Name is unset only when protobuf deserialization fails.
		return nil, err
	}
	if err != nil {
		// Protobuf deserialization succeeded, but resource validation failed.
		return &xdsclient.DecodeResult{
			Name:     name,
			Resource: &ListenerResourceData{Resource: ListenerUpdate{}},
		}, err
	}

	return &xdsclient.DecodeResult{
		Name:     name,
		Resource: &EndpointsResourceData{Resource: endpoints},
	}, nil
}

// EndpointsResourceData is an implementation of the xdsclient.ResourceData
// interface for endpoints resources.
type EndpointsResourceData struct {
	Resource EndpointsUpdate
}

// Equal returns true if other is equal to e.
func (e *EndpointsResourceData) Equal(other xdsclient.ResourceData) bool {
	if other == nil {
		return false
	}
	return bytes.Equal(e.Bytes(), other.Bytes())
}

// Bytes returns the protobuf serialized bytes of the listener resource proto.
func (e *EndpointsResourceData) Bytes() []byte {
	return e.Resource.Raw.GetValue()
}

// EndpointsWatcher wraps the callbacks to be invoked for different
// events corresponding to the endpoints resource being watched. gRFC A88
// contains an exhaustive list of what method is invoked under what conditions.
type EndpointsWatcher interface {
	// ResourceChanged indicates a new version of the resource is available.
	ResourceChanged(resource *EndpointsUpdate, done func())

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

type delegatingEndpointsWatcher struct {
	watcher EndpointsWatcher
}

func (d *delegatingEndpointsWatcher) ResourceChanged(data xdsclient.ResourceData, onDone func()) {
	e := data.(*EndpointsResourceData)
	d.watcher.ResourceChanged(&e.Resource, onDone)
}

func (d *delegatingEndpointsWatcher) ResourceError(err error, onDone func()) {
	d.watcher.ResourceError(err, onDone)
}

func (d *delegatingEndpointsWatcher) AmbientError(err error, onDone func()) {
	d.watcher.AmbientError(err, onDone)
}

// WatchEndpoints uses xDS to discover the configuration associated with the
// provided endpoints resource name.
func WatchEndpoints(p Producer, name string, w EndpointsWatcher) (cancel func()) {
	return p.WatchResource(version.V3EndpointsURL, name, &delegatingEndpointsWatcher{watcher: w})
}

// NewEndpointsResourceTypeDecoder returns a xdsclient.Decoder that wraps
// the xdsresource.endpointsType.
func NewEndpointsResourceTypeDecoder(bc *bootstrap.Config) xdsclient.Decoder {
	return &endpointsResourceDecoder{bootstrapConfig: bc}
}
