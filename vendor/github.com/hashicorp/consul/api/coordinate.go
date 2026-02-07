// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"github.com/hashicorp/serf/coordinate"
)

// CoordinateEntry represents a node and its associated network coordinate.
type CoordinateEntry struct {
	Node      string
	Segment   string
	Partition string `json:",omitempty"`
	Coord     *coordinate.Coordinate
}

// CoordinateDatacenterMap has the coordinates for servers in a given datacenter
// and area. Network coordinates are only compatible within the same area.
type CoordinateDatacenterMap struct {
	Datacenter  string
	AreaID      string
	Coordinates []CoordinateEntry
}

// Coordinate can be used to query the coordinate endpoints
type Coordinate struct {
	c *Client
}

// Coordinate returns a handle to the coordinate endpoints
func (c *Client) Coordinate() *Coordinate {
	return &Coordinate{c}
}

// Datacenters is used to return the coordinates of all the servers in the WAN
// pool.
func (c *Coordinate) Datacenters() ([]*CoordinateDatacenterMap, error) {
	r := c.c.newRequest("GET", "/v1/coordinate/datacenters")
	_, resp, err := c.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	var out []*CoordinateDatacenterMap
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Nodes is used to return the coordinates of all the nodes in the LAN pool.
func (c *Coordinate) Nodes(q *QueryOptions) ([]*CoordinateEntry, *QueryMeta, error) {
	r := c.c.newRequest("GET", "/v1/coordinate/nodes")
	r.setQueryOptions(q)
	rtt, resp, err := c.c.doRequest(r)
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

	var out []*CoordinateEntry
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// Update inserts or updates the LAN coordinate of a node.
func (c *Coordinate) Update(coord *CoordinateEntry, q *WriteOptions) (*WriteMeta, error) {
	r := c.c.newRequest("PUT", "/v1/coordinate/update")
	r.setWriteOptions(q)
	r.obj = coord
	rtt, resp, err := c.c.doRequest(r)
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

// Node is used to return the coordinates of a single node in the LAN pool.
func (c *Coordinate) Node(node string, q *QueryOptions) ([]*CoordinateEntry, *QueryMeta, error) {
	r := c.c.newRequest("GET", "/v1/coordinate/node/"+node)
	r.setQueryOptions(q)
	rtt, resp, err := c.c.doRequest(r)
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

	var out []*CoordinateEntry
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}
