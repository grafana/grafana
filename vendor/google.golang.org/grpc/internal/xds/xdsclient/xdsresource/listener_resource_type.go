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
	"google.golang.org/grpc/internal/xds/clients/xdsclient"
	"google.golang.org/grpc/internal/xds/xdsclient/xdsresource/version"
)

// ListenerResourceTypeName is a human friendly name for the listener resource.
const ListenerResourceTypeName = "ListenerResource"

// listenerResourceDecoder is an implementation of the xdsclient.Decoder
// interface for listener resources.
type listenerResourceDecoder struct {
	bootstrapConfig *bootstrap.Config
}

func (d *listenerResourceDecoder) Decode(resource *xdsclient.AnyProto, opts xdsclient.DecodeOptions) (*xdsclient.DecodeResult, error) {
	name, listener, err := unmarshalListenerResource(resource.ToAny(), &opts)
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

	// Perform extra validation here.
	if err := listenerValidator(d.bootstrapConfig, listener); err != nil {
		return &xdsclient.DecodeResult{
			Name:     name,
			Resource: &ListenerResourceData{Resource: ListenerUpdate{}},
		}, err
	}

	return &xdsclient.DecodeResult{
		Name:     name,
		Resource: &ListenerResourceData{Resource: listener},
	}, nil
}

func securityConfigValidator(bc *bootstrap.Config, sc *SecurityConfig) error {
	if sc == nil {
		return nil
	}
	if sc.IdentityInstanceName != "" {
		if _, ok := bc.CertProviderConfigs()[sc.IdentityInstanceName]; !ok {
			return fmt.Errorf("identity certificate provider instance name %q missing in bootstrap configuration", sc.IdentityInstanceName)
		}
	}
	if sc.RootInstanceName != "" {
		if _, ok := bc.CertProviderConfigs()[sc.RootInstanceName]; !ok {
			return fmt.Errorf("root certificate provider instance name %q missing in bootstrap configuration", sc.RootInstanceName)
		}
	}
	return nil
}

func listenerValidator(bc *bootstrap.Config, lis ListenerUpdate) error {
	if lis.InboundListenerCfg == nil || lis.InboundListenerCfg.FilterChains == nil {
		return nil
	}
	return lis.InboundListenerCfg.FilterChains.Validate(func(fc *FilterChain) error {
		if fc == nil {
			return nil
		}
		return securityConfigValidator(bc, fc.SecurityCfg)
	})
}

// ListenerResourceData is an implementation of the xdsclient.ResourceData
// interface for listener resources.
type ListenerResourceData struct {
	Resource ListenerUpdate
}

// Equal returns true if other is equal to l.
func (l *ListenerResourceData) Equal(other xdsclient.ResourceData) bool {
	if other == nil {
		return false
	}
	return bytes.Equal(l.Bytes(), other.Bytes())
}

// Bytes returns the protobuf serialized bytes of the listener resource proto.
func (l *ListenerResourceData) Bytes() []byte {
	return l.Resource.Raw.GetValue()
}

// ListenerWatcher wraps the callbacks to be invoked for different
// events corresponding to the listener resource being watched. gRFC A88
// contains an exhaustive list of what method is invoked under what conditions.
type ListenerWatcher interface {
	// ResourceChanged indicates a new version of the resource is available.
	ResourceChanged(resource *ListenerUpdate, done func())

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

type delegatingListenerWatcher struct {
	watcher ListenerWatcher
}

func (d *delegatingListenerWatcher) ResourceChanged(data xdsclient.ResourceData, onDone func()) {
	l := data.(*ListenerResourceData)
	d.watcher.ResourceChanged(&l.Resource, onDone)
}
func (d *delegatingListenerWatcher) ResourceError(err error, onDone func()) {
	d.watcher.ResourceError(err, onDone)
}

func (d *delegatingListenerWatcher) AmbientError(err error, onDone func()) {
	d.watcher.AmbientError(err, onDone)
}

// WatchListener uses xDS to discover the configuration associated with the
// provided listener resource name.
func WatchListener(p Producer, name string, w ListenerWatcher) (cancel func()) {
	return p.WatchResource(version.V3ListenerURL, name, &delegatingListenerWatcher{watcher: w})
}

// NewListenerResourceTypeDecoder returns a xdsclient.Decoder that wraps
// the xdsresource.listenerType.
func NewListenerResourceTypeDecoder(bc *bootstrap.Config) xdsclient.Decoder {
	return &listenerResourceDecoder{bootstrapConfig: bc}
}
