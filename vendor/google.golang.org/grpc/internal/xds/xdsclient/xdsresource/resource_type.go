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

// Package xdsresource implements the xDS data model layer.
//
// Provides resource-type specific functionality to unmarshal xDS protos into
// internal data structures that contain only fields gRPC is interested in.
// These internal data structures are passed to components in the xDS stack
// (resolver/balancers/server) that have expressed interest in receiving
// updates to specific resources.
package xdsresource

import (
	"google.golang.org/grpc/internal/xds/bootstrap"
	"google.golang.org/grpc/internal/xds/clients/xdsclient"
	"google.golang.org/protobuf/types/known/anypb"
)

// Producer contains a single method to discover resource configuration from a
// remote management server using xDS APIs.
//
// The xdsclient package provides a concrete implementation of this interface.
type Producer interface {
	// WatchResource uses xDS to discover the resource associated with the
	// provided resource name. The resource type implementation determines how
	// xDS responses are are deserialized and validated, as received from the
	// xDS management server. Upon receipt of a response from the management
	// server, an appropriate callback on the watcher is invoked.
	WatchResource(typeURL, resourceName string, watcher xdsclient.ResourceWatcher) (cancel func())
}

// ResourceWatcher is notified of the resource updates and errors that are
// received by the xDS client from the management server.
//
// All methods contain a done parameter which should be called when processing
// of the update has completed.  For example, if processing a resource requires
// watching new resources, registration of those new watchers should be
// completed before done is called, which can happen after the ResourceWatcher
// method has returned. Failure to call done will prevent the xDS client from
// providing future ResourceWatcher notifications.
type ResourceWatcher interface {
	// ResourceChanged indicates a new version of the resource is available.
	ResourceChanged(resourceData ResourceData, done func())

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

// TODO: Once the implementation is complete, rename this interface as
// ResourceType and get rid of the existing ResourceType enum.

// Type wraps all resource-type specific functionality. Each supported resource
// type will provide an implementation of this interface.
type Type interface {
	// TypeURL is the xDS type URL of this resource type for v3 transport.
	TypeURL() string

	// TypeName identifies resources in a transport protocol agnostic way. This
	// can be used for logging/debugging purposes, as well in cases where the
	// resource type name is to be uniquely identified but the actual
	// functionality provided by the resource type is not required.
	//
	// TODO: once Type is renamed to ResourceType, rename TypeName to
	// ResourceTypeName.
	TypeName() string

	// AllResourcesRequiredInSotW indicates whether this resource type requires
	// that all resources be present in every SotW response from the server. If
	// true, a response that does not include a previously seen resource will be
	// interpreted as a deletion of that resource.
	AllResourcesRequiredInSotW() bool

	// Decode deserializes and validates an xDS resource serialized inside the
	// provided `Any` proto, as received from the xDS management server.
	//
	// If protobuf deserialization fails or resource validation fails,
	// returns a non-nil error. Otherwise, returns a fully populated
	// DecodeResult.
	Decode(*DecodeOptions, *anypb.Any) (*DecodeResult, error)
}

// ResourceData contains the configuration data sent by the xDS management
// server, associated with the resource being watched. Every resource type must
// provide an implementation of this interface to represent the configuration
// received from the xDS management server.
type ResourceData interface {
	// RawEqual returns true if the passed in resource data is equal to that of
	// the receiver, based on the underlying raw protobuf message.
	RawEqual(ResourceData) bool

	// ToJSON returns a JSON string representation of the resource data.
	ToJSON() string

	Raw() *anypb.Any
}

// DecodeOptions wraps the options required by ResourceType implementation for
// decoding configuration received from the xDS management server.
type DecodeOptions struct {
	// BootstrapConfig contains the complete bootstrap configuration passed to
	// the xDS client. This contains useful data for resource validation.
	BootstrapConfig *bootstrap.Config
	// ServerConfig contains the server config (from the above bootstrap
	// configuration) of the xDS server from which the current resource, for
	// which Decode() is being invoked, was received.
	ServerConfig *bootstrap.ServerConfig
}

// DecodeResult is the result of a decode operation.
type DecodeResult struct {
	// Name is the name of the resource being watched.
	Name string
	// Resource contains the configuration associated with the resource being
	// watched.
	Resource ResourceData
}
