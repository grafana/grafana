// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"fmt"
	"time"
)

// PeeringState enumerates all the states a peering can be in
type PeeringState string

const (
	// PeeringStateUndefined represents an unset value for PeeringState during
	// writes.
	PeeringStateUndefined PeeringState = "UNDEFINED"

	// PeeringStatePending means the peering was created by generating a peering token.
	// Peerings stay in a pending state until the peer uses the token to dial
	// the local cluster.
	PeeringStatePending PeeringState = "PENDING"

	// PeeringStateEstablishing means the peering is being established from a peering token.
	// This is the initial state for dialing peers.
	PeeringStateEstablishing PeeringState = "ESTABLISHING"

	// PeeringStateActive means that the peering connection is active and
	// healthy.
	PeeringStateActive PeeringState = "ACTIVE"

	// PeeringStateFailing means the peering connection has been interrupted
	// but has not yet been terminated.
	PeeringStateFailing PeeringState = "FAILING"

	// PeeringStateDeleting means a peering was marked for deletion and is in the process
	// of being deleted.
	PeeringStateDeleting PeeringState = "DELETING"

	// PeeringStateTerminated means the peering relationship has been removed.
	PeeringStateTerminated PeeringState = "TERMINATED"
)

type PeeringRemoteInfo struct {
	// Partition is the remote peer's partition.
	Partition string
	// Datacenter is the remote peer's datacenter.
	Datacenter string
	Locality   *Locality `json:",omitempty"`
}

// Locality identifies where a given entity is running.
type Locality struct {
	// Region is region the zone belongs to.
	Region string

	// Zone is the zone the entity is running in.
	Zone string
}

type Peering struct {
	// ID is a datacenter-scoped UUID for the peering.
	ID string
	// Name is the local alias for the peering relationship.
	Name string
	// Partition is the local partition connecting to the peer.
	Partition string `json:",omitempty"`
	// DeletedAt is the time when the Peering was marked for deletion
	DeletedAt *time.Time `json:",omitempty" alias:"deleted_at"`
	// Meta is a mapping of some string value to any other string value
	Meta map[string]string `json:",omitempty"`
	// State is one of the valid PeeringState values to represent the status of
	// peering relationship.
	State PeeringState
	// PeerID is the ID that our peer assigned to this peering. This ID is to
	// be used when dialing the peer, so that it can know who dialed it.
	PeerID string `json:",omitempty"`
	// PeerCAPems contains all the CA certificates for the remote peer.
	PeerCAPems []string `json:",omitempty"`
	// PeerServerName is the name of the remote server as it relates to TLS.
	PeerServerName string `json:",omitempty"`
	// PeerServerAddresses contains all the connection addresses for the remote peer.
	PeerServerAddresses []string `json:",omitempty"`
	// StreamStatus contains information computed on read based on the state of the stream.
	StreamStatus PeeringStreamStatus
	// CreateIndex is the Raft index at which the Peering was created.
	CreateIndex uint64
	// ModifyIndex is the latest Raft index at which the Peering was modified.
	ModifyIndex uint64
	// Remote contains metadata for the remote peer.
	Remote PeeringRemoteInfo
}

type PeeringStreamStatus struct {
	// ImportedServices is the list of services imported from this peering.
	ImportedServices []string
	// ExportedServices is the list of services exported to this peering.
	ExportedServices []string
	// LastHeartbeat represents when the last heartbeat message was received.
	LastHeartbeat *time.Time
	// LastReceive represents when any message was last received, regardless of success or error.
	LastReceive *time.Time
	// LastSend represents when any message was last sent, regardless of success or error.
	LastSend *time.Time
}

type PeeringReadResponse struct {
	Peering *Peering
}

type PeeringGenerateTokenRequest struct {
	// PeerName is the name of the remote peer.
	PeerName string
	// Partition to be peered.
	Partition string `json:",omitempty"`
	// Meta is a mapping of some string value to any other string value
	Meta map[string]string `json:",omitempty"`
	// ServerExternalAddresses is a list of addresses to put into the generated token. This could be used to specify
	// load balancer(s) or external IPs to reach the servers from the dialing side, and will override any server
	// addresses obtained from the "consul" service.
	ServerExternalAddresses []string `json:",omitempty"`
}

type PeeringGenerateTokenResponse struct {
	// PeeringToken is an opaque string provided to the remote peer for it to complete
	// the peering initialization handshake.
	PeeringToken string
}

type PeeringEstablishRequest struct {
	// Name of the remote peer.
	PeerName string
	// The peering token returned from the peer's GenerateToken endpoint.
	PeeringToken string `json:",omitempty"`
	// Partition to be peered.
	Partition string `json:",omitempty"`
	// Meta is a mapping of some string value to any other string value
	Meta map[string]string `json:",omitempty"`
}

type PeeringEstablishResponse struct {
}

type PeeringListRequest struct {
	// future proofing in case we extend List functionality
}

type Peerings struct {
	c *Client
}

// Peerings returns a handle to the operator endpoints.
func (c *Client) Peerings() *Peerings {
	return &Peerings{c: c}
}

func (p *Peerings) Read(ctx context.Context, name string, q *QueryOptions) (*Peering, *QueryMeta, error) {
	if name == "" {
		return nil, nil, fmt.Errorf("peering name cannot be empty")
	}

	req := p.c.newRequest("GET", fmt.Sprintf("/v1/peering/%s", name))
	req.setQueryOptions(q)
	req.ctx = ctx

	rtt, resp, err := p.c.doRequest(req)
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

	var out Peering
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

func (p *Peerings) Delete(ctx context.Context, name string, q *WriteOptions) (*WriteMeta, error) {
	if name == "" {
		return nil, fmt.Errorf("peering name cannot be empty")
	}

	req := p.c.newRequest("DELETE", fmt.Sprintf("/v1/peering/%s", name))
	req.setWriteOptions(q)
	req.ctx = ctx

	rtt, resp, err := p.c.doRequest(req)
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

// TODO(peering): verify this is the ultimate signature we want
func (p *Peerings) GenerateToken(ctx context.Context, g PeeringGenerateTokenRequest, wq *WriteOptions) (*PeeringGenerateTokenResponse, *WriteMeta, error) {
	if g.PeerName == "" {
		return nil, nil, fmt.Errorf("peer name cannot be empty")
	}

	req := p.c.newRequest("POST", fmt.Sprint("/v1/peering/token"))
	req.setWriteOptions(wq)
	req.ctx = ctx
	req.obj = g

	rtt, resp, err := p.c.doRequest(req)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}

	var out PeeringGenerateTokenResponse
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// TODO(peering): verify this is the ultimate signature we want
func (p *Peerings) Establish(ctx context.Context, i PeeringEstablishRequest, wq *WriteOptions) (*PeeringEstablishResponse, *WriteMeta, error) {
	req := p.c.newRequest("POST", fmt.Sprint("/v1/peering/establish"))
	req.setWriteOptions(wq)
	req.ctx = ctx
	req.obj = i

	rtt, resp, err := p.c.doRequest(req)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}

	var out PeeringEstablishResponse
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

func (p *Peerings) List(ctx context.Context, q *QueryOptions) ([]*Peering, *QueryMeta, error) {
	req := p.c.newRequest("GET", "/v1/peerings")
	req.setQueryOptions(q)
	req.ctx = ctx

	rtt, resp, err := p.c.doRequest(req)
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

	var out []*Peering
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return out, qm, nil
}
