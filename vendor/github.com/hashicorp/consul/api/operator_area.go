// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

// The /v1/operator/area endpoints are available only in Consul Enterprise and
// interact with its network area subsystem. Network areas are used to link
// together Consul servers in different Consul datacenters. With network areas,
// Consul datacenters can be linked together in ways other than a fully-connected
// mesh, as is required for Consul's WAN.

import (
	"net"
	"time"
)

// Area defines a network area.
type Area struct {
	// ID is this identifier for an area (a UUID). This must be left empty
	// when creating a new area.
	ID string

	// PeerDatacenter is the peer Consul datacenter that will make up the
	// other side of this network area. Network areas always involve a pair
	// of datacenters: the datacenter where the area was created, and the
	// peer datacenter. This is required.
	PeerDatacenter string

	// RetryJoin specifies the address of Consul servers to join to, such as
	// an IPs or hostnames with an optional port number. This is optional.
	RetryJoin []string

	// UseTLS specifies whether gossip over this area should be encrypted with TLS
	// if possible.
	UseTLS bool
}

// AreaJoinResponse is returned when a join occurs and gives the result for each
// address.
type AreaJoinResponse struct {
	// The address that was joined.
	Address string

	// Whether or not the join was a success.
	Joined bool

	// If we couldn't join, this is the message with information.
	Error string
}

// SerfMember is a generic structure for reporting information about members in
// a Serf cluster. This is only used by the area endpoints right now, but this
// could be expanded to other endpoints in the future.
type SerfMember struct {
	// ID is the node identifier (a UUID).
	ID string

	// Name is the node name.
	Name string

	// Addr has the IP address.
	Addr net.IP

	// Port is the RPC port.
	Port uint16

	// Datacenter is the DC name.
	Datacenter string

	// Role is "client", "server", or "unknown".
	Role string

	// Build has the version of the Consul agent.
	Build string

	// Protocol is the protocol of the Consul agent.
	Protocol int

	// Status is the Serf health status "none", "alive", "leaving", "left",
	// or "failed".
	Status string

	// RTT is the estimated round trip time from the server handling the
	// request to the this member. This will be negative if no RTT estimate
	// is available.
	RTT time.Duration
}

// AreaCreate will create a new network area. The ID in the given structure must
// be empty and a generated ID will be returned on success.
func (op *Operator) AreaCreate(area *Area, q *WriteOptions) (string, *WriteMeta, error) {
	r := op.c.newRequest("POST", "/v1/operator/area")
	r.setWriteOptions(q)
	r.obj = area
	rtt, resp, err := op.c.doRequest(r)
	if err != nil {
		return "", nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return "", nil, err
	}

	wm := &WriteMeta{}
	wm.RequestTime = rtt

	var out struct{ ID string }
	if err := decodeBody(resp, &out); err != nil {
		return "", nil, err
	}
	return out.ID, wm, nil
}

// AreaUpdate will update the configuration of the network area with the given ID.
func (op *Operator) AreaUpdate(areaID string, area *Area, q *WriteOptions) (string, *WriteMeta, error) {
	r := op.c.newRequest("PUT", "/v1/operator/area/"+areaID)
	r.setWriteOptions(q)
	r.obj = area
	rtt, resp, err := op.c.doRequest(r)
	if err != nil {
		return "", nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return "", nil, err
	}

	wm := &WriteMeta{}
	wm.RequestTime = rtt

	var out struct{ ID string }
	if err := decodeBody(resp, &out); err != nil {
		return "", nil, err
	}
	return out.ID, wm, nil
}

// AreaGet returns a single network area.
func (op *Operator) AreaGet(areaID string, q *QueryOptions) ([]*Area, *QueryMeta, error) {
	var out []*Area
	qm, err := op.c.query("/v1/operator/area/"+areaID, &out, q)
	if err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// AreaList returns all the available network areas.
func (op *Operator) AreaList(q *QueryOptions) ([]*Area, *QueryMeta, error) {
	var out []*Area
	qm, err := op.c.query("/v1/operator/area", &out, q)
	if err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// AreaDelete deletes the given network area.
func (op *Operator) AreaDelete(areaID string, q *WriteOptions) (*WriteMeta, error) {
	r := op.c.newRequest("DELETE", "/v1/operator/area/"+areaID)
	r.setWriteOptions(q)
	rtt, resp, err := op.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	wm := &WriteMeta{}
	wm.RequestTime = rtt
	return wm, nil
}

// AreaJoin attempts to join the given set of join addresses to the given
// network area. See the Area structure for details about join addresses.
func (op *Operator) AreaJoin(areaID string, addresses []string, q *WriteOptions) ([]*AreaJoinResponse, *WriteMeta, error) {
	r := op.c.newRequest("PUT", "/v1/operator/area/"+areaID+"/join")
	r.setWriteOptions(q)
	r.obj = addresses
	rtt, resp, err := op.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	wm := &WriteMeta{}
	wm.RequestTime = rtt

	var out []*AreaJoinResponse
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, wm, nil
}

// AreaMembers lists the Serf information about the members in the given area.
func (op *Operator) AreaMembers(areaID string, q *QueryOptions) ([]*SerfMember, *QueryMeta, error) {
	var out []*SerfMember
	qm, err := op.c.query("/v1/operator/area/"+areaID+"/members", &out, q)
	if err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}
