// Copyright 2017, Google LLC All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// AUTO-GENERATED CODE. DO NOT EDIT.

package debugger

import (
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	clouddebuggerpb "google.golang.org/genproto/googleapis/devtools/clouddebugger/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// Controller2CallOptions contains the retry settings for each method of Controller2Client.
type Controller2CallOptions struct {
	RegisterDebuggee       []gax.CallOption
	ListActiveBreakpoints  []gax.CallOption
	UpdateActiveBreakpoint []gax.CallOption
}

func defaultController2ClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("clouddebugger.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultController2CallOptions() *Controller2CallOptions {
	retry := map[[2]string][]gax.CallOption{
		{"default", "idempotent"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.DeadlineExceeded,
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    100 * time.Millisecond,
					Max:        60000 * time.Millisecond,
					Multiplier: 1.3,
				})
			}),
		},
	}
	return &Controller2CallOptions{
		RegisterDebuggee:       retry[[2]string{"default", "non_idempotent"}],
		ListActiveBreakpoints:  retry[[2]string{"default", "idempotent"}],
		UpdateActiveBreakpoint: retry[[2]string{"default", "idempotent"}],
	}
}

// Controller2Client is a client for interacting with Stackdriver Debugger API.
type Controller2Client struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	controller2Client clouddebuggerpb.Controller2Client

	// The call options for this service.
	CallOptions *Controller2CallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewController2Client creates a new controller2 client.
//
// The Controller service provides the API for orchestrating a collection of
// debugger agents to perform debugging tasks. These agents are each attached
// to a process of an application which may include one or more replicas.
//
// The debugger agents register with the Controller to identify the application
// being debugged, the Debuggee. All agents that register with the same data,
// represent the same Debuggee, and are assigned the same debuggee_id.
//
// The debugger agents call the Controller to retrieve  the list of active
// Breakpoints. Agents with the same debuggee_id get the same breakpoints
// list. An agent that can fulfill the breakpoint request updates the
// Controller with the breakpoint result. The controller selects the first
// result received and discards the rest of the results.
// Agents that poll again for active breakpoints will no longer have
// the completed breakpoint in the list and should remove that breakpoint from
// their attached process.
//
// The Controller service does not provide a way to retrieve the results of
// a completed breakpoint. This functionality is available using the Debugger
// service.
func NewController2Client(ctx context.Context, opts ...option.ClientOption) (*Controller2Client, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultController2ClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &Controller2Client{
		conn:        conn,
		CallOptions: defaultController2CallOptions(),

		controller2Client: clouddebuggerpb.NewController2Client(conn),
	}
	c.SetGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *Controller2Client) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *Controller2Client) Close() error {
	return c.conn.Close()
}

// SetGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *Controller2Client) SetGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// RegisterDebuggee registers the debuggee with the controller service.
//
// All agents attached to the same application must call this method with
// exactly the same request content to get back the same stable debuggee_id.
// Agents should call this method again whenever google.rpc.Code.NOT_FOUND
// is returned from any controller method.
//
// This protocol allows the controller service to disable debuggees, recover
// from data loss, or change the debuggee_id format. Agents must handle
// debuggee_id value changing upon re-registration.
func (c *Controller2Client) RegisterDebuggee(ctx context.Context, req *clouddebuggerpb.RegisterDebuggeeRequest, opts ...gax.CallOption) (*clouddebuggerpb.RegisterDebuggeeResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.RegisterDebuggee[0:len(c.CallOptions.RegisterDebuggee):len(c.CallOptions.RegisterDebuggee)], opts...)
	var resp *clouddebuggerpb.RegisterDebuggeeResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.controller2Client.RegisterDebuggee(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListActiveBreakpoints returns the list of all active breakpoints for the debuggee.
//
// The breakpoint specification (location, condition, and expressions
// fields) is semantically immutable, although the field values may
// change. For example, an agent may update the location line number
// to reflect the actual line where the breakpoint was set, but this
// doesn't change the breakpoint semantics.
//
// This means that an agent does not need to check if a breakpoint has changed
// when it encounters the same breakpoint on a successive call.
// Moreover, an agent should remember the breakpoints that are completed
// until the controller removes them from the active list to avoid
// setting those breakpoints again.
func (c *Controller2Client) ListActiveBreakpoints(ctx context.Context, req *clouddebuggerpb.ListActiveBreakpointsRequest, opts ...gax.CallOption) (*clouddebuggerpb.ListActiveBreakpointsResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListActiveBreakpoints[0:len(c.CallOptions.ListActiveBreakpoints):len(c.CallOptions.ListActiveBreakpoints)], opts...)
	var resp *clouddebuggerpb.ListActiveBreakpointsResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.controller2Client.ListActiveBreakpoints(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateActiveBreakpoint updates the breakpoint state or mutable fields.
// The entire Breakpoint message must be sent back to the controller service.
//
// Updates to active breakpoint fields are only allowed if the new value
// does not change the breakpoint specification. Updates to the location,
// condition and expressions fields should not alter the breakpoint
// semantics. These may only make changes such as canonicalizing a value
// or snapping the location to the correct line of code.
func (c *Controller2Client) UpdateActiveBreakpoint(ctx context.Context, req *clouddebuggerpb.UpdateActiveBreakpointRequest, opts ...gax.CallOption) (*clouddebuggerpb.UpdateActiveBreakpointResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.UpdateActiveBreakpoint[0:len(c.CallOptions.UpdateActiveBreakpoint):len(c.CallOptions.UpdateActiveBreakpoint)], opts...)
	var resp *clouddebuggerpb.UpdateActiveBreakpointResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.controller2Client.UpdateActiveBreakpoint(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
