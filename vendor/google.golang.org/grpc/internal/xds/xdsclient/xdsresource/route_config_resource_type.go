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
	// RouteConfigTypeName represents the transport agnostic name for the
	// route config resource.
	RouteConfigTypeName = "RouteConfigResource"
)

// routeConfigResourceDecoder is an implementation of the xdsclient.Decoder
// interface for route configuration resources.
type routeConfigResourceDecoder struct {
	bootstrapConfig *bootstrap.Config
}

func (d *routeConfigResourceDecoder) Decode(resource *xdsclient.AnyProto, opts xdsclient.DecodeOptions) (*xdsclient.DecodeResult, error) {
	name, rc, err := unmarshalRouteConfigResource(resource.ToAny(), &opts)
	if name == "" {
		// Name is unset only when protobuf deserialization fails.
		return nil, err
	}
	if err != nil {
		// Protobuf deserialization succeeded, but resource validation failed.
		return &xdsclient.DecodeResult{
			Name:     name,
			Resource: &RouteConfigResourceData{Resource: RouteConfigUpdate{}},
		}, err
	}

	return &xdsclient.DecodeResult{
		Name:     name,
		Resource: &RouteConfigResourceData{Resource: rc},
	}, nil
}

// RouteConfigResourceData is an implementation of the xdsclient.ResourceData
// interface for route configuration resources.
type RouteConfigResourceData struct {
	Resource RouteConfigUpdate
}

// Equal returns true if other is equal to er.
func (r *RouteConfigResourceData) Equal(other xdsclient.ResourceData) bool {
	if other == nil {
		return false
	}
	return bytes.Equal(r.Bytes(), other.Bytes())
}

// Bytes returns the protobuf serialized bytes of the route config resource proto.
func (r *RouteConfigResourceData) Bytes() []byte {
	return r.Resource.Raw.GetValue()
}

// RouteConfigWatcher wraps the callbacks to be invoked for different
// events corresponding to the route configuration resource being watched. gRFC
// A88 contains an exhaustive list of what method is invoked under what
// conditions.
type RouteConfigWatcher interface {
	// ResourceChanged indicates a new version of the resource is available.
	ResourceChanged(resource *RouteConfigUpdate, done func())

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

type delegatingRouteConfigWatcher struct {
	watcher RouteConfigWatcher
}

func (d *delegatingRouteConfigWatcher) ResourceChanged(data xdsclient.ResourceData, onDone func()) {
	rc := data.(*RouteConfigResourceData)
	d.watcher.ResourceChanged(&rc.Resource, onDone)
}

func (d *delegatingRouteConfigWatcher) ResourceError(err error, onDone func()) {
	d.watcher.ResourceError(err, onDone)
}

func (d *delegatingRouteConfigWatcher) AmbientError(err error, onDone func()) {
	d.watcher.AmbientError(err, onDone)
}

// WatchRouteConfig uses xDS to discover the configuration associated with the
// provided route configuration resource name.
func WatchRouteConfig(p Producer, name string, w RouteConfigWatcher) (cancel func()) {
	return p.WatchResource(version.V3RouteConfigURL, name, &delegatingRouteConfigWatcher{watcher: w})
}

// NewRouteConfigResourceTypeDecoder returns a xdsclient.Decoder that wraps
// the xdsresource.routeConfigType.
func NewRouteConfigResourceTypeDecoder(bc *bootstrap.Config) xdsclient.Decoder {
	return &routeConfigResourceDecoder{bootstrapConfig: bc}
}
