// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"fmt"
	"io"
	"strconv"
)

// Debug can be used to query the /debug/pprof endpoints to gather
// profiling information about the target agent.Debug
//
// The agent must have enable_debug set to true for profiling to be enabled
// and for these endpoints to function.
type Debug struct {
	c *Client
}

// Debug returns a handle that exposes the internal debug endpoints.
func (c *Client) Debug() *Debug {
	return &Debug{c}
}

// Heap returns a pprof heap dump
func (d *Debug) Heap() ([]byte, error) {
	r := d.c.newRequest("GET", "/debug/pprof/heap")
	_, resp, err := d.c.doRequest(r)
	if err != nil {
		return nil, fmt.Errorf("error making request: %s", err)
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	// We return a raw response because we're just passing through a response
	// from the pprof handlers
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error decoding body: %s", err)
	}

	return body, nil
}

// Profile returns a pprof CPU profile for the specified number of seconds
func (d *Debug) Profile(seconds int) ([]byte, error) {
	r := d.c.newRequest("GET", "/debug/pprof/profile")

	// Capture a profile for the specified number of seconds
	r.params.Set("seconds", strconv.Itoa(seconds))

	_, resp, err := d.c.doRequest(r)
	if err != nil {
		return nil, fmt.Errorf("error making request: %s", err)
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	// We return a raw response because we're just passing through a response
	// from the pprof handlers
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error decoding body: %s", err)
	}

	return body, nil
}

// PProf returns a pprof profile for the specified number of seconds. The caller
// is responsible for closing the returned io.ReadCloser once all bytes are read.
func (d *Debug) PProf(ctx context.Context, name string, seconds int) (io.ReadCloser, error) {
	r := d.c.newRequest("GET", "/debug/pprof/"+name)
	r.ctx = ctx

	// Capture a profile for the specified number of seconds
	r.params.Set("seconds", strconv.Itoa(seconds))

	_, resp, err := d.c.doRequest(r)
	if err != nil {
		return nil, fmt.Errorf("error making request: %s", err)
	}
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	return resp.Body, nil
}

// Trace returns an execution trace
func (d *Debug) Trace(seconds int) ([]byte, error) {
	r := d.c.newRequest("GET", "/debug/pprof/trace")

	// Capture a trace for the specified number of seconds
	r.params.Set("seconds", strconv.Itoa(seconds))

	_, resp, err := d.c.doRequest(r)
	if err != nil {
		return nil, fmt.Errorf("error making request: %s", err)
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	// We return a raw response because we're just passing through a response
	// from the pprof handlers
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error decoding body: %s", err)
	}

	return body, nil
}

// Goroutine returns a pprof goroutine profile
func (d *Debug) Goroutine() ([]byte, error) {
	r := d.c.newRequest("GET", "/debug/pprof/goroutine")

	_, resp, err := d.c.doRequest(r)
	if err != nil {
		return nil, fmt.Errorf("error making request: %s", err)
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	// We return a raw response because we're just passing through a response
	// from the pprof handlers
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error decoding body: %s", err)
	}

	return body, nil
}
