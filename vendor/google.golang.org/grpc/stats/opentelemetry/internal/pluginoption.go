/*
 * Copyright 2024 gRPC authors.
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

// Package internal defines the PluginOption interface.
package internal

import (
	"google.golang.org/grpc/metadata"
)

// SetPluginOption sets the plugin option on Options.
var SetPluginOption any // func(*Options, PluginOption)

// PluginOption is the interface which represents a plugin option for the
// OpenTelemetry instrumentation component. This plugin option emits labels from
// metadata and also creates metadata containing labels. These labels are
// intended to be added to applicable OpenTelemetry metrics recorded in the
// OpenTelemetry instrumentation component.
//
// In the future, we hope to stabilize and expose this API to allow plugins to
// inject labels of their choosing into metrics recorded.
type PluginOption interface {
	// GetMetadata creates a MD with metadata exchange labels.
	GetMetadata() metadata.MD
	// GetLabels emits labels to be attached to metrics for the RPC that
	// contains the provided incomingMetadata.
	GetLabels(incomingMetadata metadata.MD) map[string]string
}
