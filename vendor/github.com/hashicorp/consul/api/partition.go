// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"fmt"
	"time"
)

// Partition is the configuration of a single admin partition. Admin Partitions are a Consul Enterprise feature.
type Partition struct {
	// Name is the name of the Partition.
	Name string `json:"Name"`

	// Description is where the user puts any information they want
	// about the admin partition. It is not used internally.
	Description string `json:"Description,omitempty"`

	// DeletedAt is the time when the Partition was marked for deletion
	// This is nullable so that we can omit if empty when encoding in JSON
	DeletedAt *time.Time `json:"DeletedAt,omitempty" alias:"deleted_at"`

	// CreateIndex is the Raft index at which the Partition was created
	CreateIndex uint64 `json:"CreateIndex,omitempty"`

	// ModifyIndex is the latest Raft index at which the Partition was modified.
	ModifyIndex uint64 `json:"ModifyIndex,omitempty"`

	// DisableGossip will not enable a gossip pool for the partition
	DisableGossip bool `json:"DisableGossip,omitempty"`
}

// PartitionDefaultName is the default partition value.
const PartitionDefaultName = "default"

// Partitions can be used to manage Partitions in Consul Enterprise.
type Partitions struct {
	c *Client
}

// Operator returns a handle to the operator endpoints.
func (c *Client) Partitions() *Partitions {
	return &Partitions{c}
}

func (p *Partitions) Create(ctx context.Context, partition *Partition, q *WriteOptions) (*Partition, *WriteMeta, error) {
	if partition.Name == "" {
		return nil, nil, fmt.Errorf("Must specify a Name for Partition creation")
	}

	r := p.c.newRequest("PUT", "/v1/partition")
	r.setWriteOptions(q)
	r.ctx = ctx
	r.obj = partition
	rtt, resp, err := p.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	var out Partition
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

func (p *Partitions) Update(ctx context.Context, partition *Partition, q *WriteOptions) (*Partition, *WriteMeta, error) {
	if partition.Name == "" {
		return nil, nil, fmt.Errorf("Must specify a Name for Partition updating")
	}

	r := p.c.newRequest("PUT", "/v1/partition/"+partition.Name)
	r.setWriteOptions(q)
	r.ctx = ctx
	r.obj = partition
	rtt, resp, err := p.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	var out Partition
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

func (p *Partitions) Read(ctx context.Context, name string, q *QueryOptions) (*Partition, *QueryMeta, error) {
	var out Partition
	r := p.c.newRequest("GET", "/v1/partition/"+name)
	r.setQueryOptions(q)
	r.ctx = ctx
	rtt, resp, err := p.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	found, resp, err := requireNotFoundOrOK(resp)
	if err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if !found {
		return nil, qm, nil
	}

	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, qm, nil
}

func (p *Partitions) Delete(ctx context.Context, name string, q *WriteOptions) (*WriteMeta, error) {
	r := p.c.newRequest("DELETE", "/v1/partition/"+name)
	r.setWriteOptions(q)
	r.ctx = ctx
	rtt, resp, err := p.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

func (p *Partitions) List(ctx context.Context, q *QueryOptions) ([]*Partition, *QueryMeta, error) {
	var out []*Partition
	r := p.c.newRequest("GET", "/v1/partitions")
	r.setQueryOptions(q)
	r.ctx = ctx
	rtt, resp, err := p.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}
