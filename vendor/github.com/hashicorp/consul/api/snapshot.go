// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"io"
)

// Snapshot can be used to query the /v1/snapshot endpoint to take snapshots of
// Consul's internal state and restore snapshots for disaster recovery.
type Snapshot struct {
	c *Client
}

// Snapshot returns a handle that exposes the snapshot endpoints.
func (c *Client) Snapshot() *Snapshot {
	return &Snapshot{c}
}

// Save requests a new snapshot and provides an io.ReadCloser with the snapshot
// data to save. If this doesn't return an error, then it's the responsibility
// of the caller to close it. Only a subset of the QueryOptions are supported:
// Datacenter, AllowStale, and Token.
func (s *Snapshot) Save(q *QueryOptions) (io.ReadCloser, *QueryMeta, error) {
	r := s.c.newRequest("GET", "/v1/snapshot")
	r.setQueryOptions(q)

	rtt, resp, err := s.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt
	return resp.Body, qm, nil
}

// Restore streams in an existing snapshot and attempts to restore it.
func (s *Snapshot) Restore(q *WriteOptions, in io.Reader) error {
	r := s.c.newRequest("PUT", "/v1/snapshot")
	r.body = in
	r.header.Set("Content-Type", "application/octet-stream")
	r.setWriteOptions(q)
	_, resp, err := s.c.doRequest(r)
	if err != nil {
		return err
	}
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}
