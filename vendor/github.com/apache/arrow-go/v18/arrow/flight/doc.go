// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package flight contains server and client implementations for the Arrow Flight RPC
//
// Here we list best practices and common pitfalls for Arrow Flight usage.
//
// GRPC
//
// When using gRPC for transport all client methods take an optional list
// of gRPC CallOptions: https://pkg.go.dev/google.golang.org/grpc#CallOption.
// Additional headers can be used or read via
// https://pkg.go.dev/google.golang.org/grpc@v1.48.0/metadata with the context.
// Also see available gRPC keys
// (https://grpc.github.io/grpc/cpp/group__grpc__arg__keys.html) and a list of
// best gRPC practices (https://grpc.io/docs/guides/performance/#general).
//
// Re-use clients whenever possible
//
// Closing clients causes gRPC to close and clean up connections which can take
// several seconds per connection. This will stall server and client threads if
// done too frequently. Client reuse will avoid this issue.
//
// Don’t round-robin load balance
//
// Round robin balancing can cause every client to have an open connection to
// every server causing an unexpected number of open connections and a depletion
// of resources.
//
// Debugging
//
// Use netstat to see the number of open connections.
// For debug use env GODEBUG=http2debug=1 or GODEBUG=http2debug=2 for verbose
// http2 logs (using 2 is more verbose with frame dumps). This will print the
// initial headers (on both sides) so you can see if grpc established the
// connection or not. It will also print when a message is sent, so you can tell
// if the connection is open or not.
//
// Note: "connect" isn't really a connect and we’ve observed that gRPC does not
// give you the actual error until you first try to make a call. This can cause
// error being reported at unexpected times.
//
// Excessive traffic
//
// There are basically two ways to handle excessive traffic:
// * unbounded goroutines -> everyone gets serviced, but it might take forever.
// This is what you are seeing now. Default behaviour.
// * bounded thread pool -> Reject connections / requests when under load, and have
// clients retry with backoff. This also gives an opportunity to retry with a
// different node. Not everyone gets serviced but quality of service stays consistent.
// Can be set with https://pkg.go.dev/google.golang.org/grpc#NumStreamWorkers
//
// Closing unresponsive connections
//
// * Connection timeout (https://pkg.go.dev/context#WithTimeout) or
// (https://pkg.go.dev/context#WithCancel) can be set via context.Context.
// * There is a long standing ticket for a per-write/per-read timeout instead of a per
// call timeout (https://issues.apache.org/jira/browse/ARROW-6062), but this is not
// (easily) possible to implement with the blocking gRPC API. For now one can also do
// something like set up a background thread that calls cancel() on a timer and have
// the main thread reset the timer every time a write operation completes successfully
// (that means one needs to use to_batches() + write_batch and not write_table).

package flight
