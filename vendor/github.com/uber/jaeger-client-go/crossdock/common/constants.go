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

package common

const (
	// DefaultClientPortHTTP is the port where the client (controller) runs
	DefaultClientPortHTTP = "8080"

	// DefaultServerPortHTTP is the port where HTTP server runs
	DefaultServerPortHTTP = "8081"

	// DefaultServerPortTChannel is the port where TChannel server runs
	DefaultServerPortTChannel = "8082"

	// DefaultServiceName is the service name used by TChannel server
	DefaultServiceName = "go"

	// DefaultTracerServiceName is the service name used by the tracer
	DefaultTracerServiceName = "crossdock-go"
)
