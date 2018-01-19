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

package client

// Different parameter keys and values used by the system
const (
	// S1 instructions
	sampledParam     = "sampled"
	server1NameParam = "s1name"
	// S1->S2 instructions
	server2NameParam      = "s2name"
	server2TransportParam = "s2transport"
	// S2->S3 instructions
	server3NameParam      = "s3name"
	server3TransportParam = "s3transport"

	transportHTTP     = "http"
	transportTChannel = "tchannel"
	transportDummy    = "dummy"

	behaviorTrace = "trace"

	// RoleS1 is the name of the role for server S1
	RoleS1 = "S1"

	// RoleS2 is the name of the role for server S2
	RoleS2 = "S2"

	// RoleS3 is the name of the role for server S3
	RoleS3 = "S3"
)
