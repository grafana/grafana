// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

// Status can be used to query the Status endpoints
type Status struct {
	c *Client
}

// Status returns a handle to the status endpoints
func (c *Client) Status() *Status {
	return &Status{c}
}

// Leader is used to query for a known leader
func (s *Status) LeaderWithQueryOptions(q *QueryOptions) (string, error) {
	r := s.c.newRequest("GET", "/v1/status/leader")

	if q != nil {
		r.setQueryOptions(q)
	}

	_, resp, err := s.c.doRequest(r)
	if err != nil {
		return "", err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return "", err
	}

	var leader string
	if err := decodeBody(resp, &leader); err != nil {
		return "", err
	}
	return leader, nil
}

func (s *Status) Leader() (string, error) {
	return s.LeaderWithQueryOptions(nil)
}

// Peers is used to query for a known raft peers
func (s *Status) PeersWithQueryOptions(q *QueryOptions) ([]string, error) {
	r := s.c.newRequest("GET", "/v1/status/peers")

	if q != nil {
		r.setQueryOptions(q)
	}

	_, resp, err := s.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	var peers []string
	if err := decodeBody(resp, &peers); err != nil {
		return nil, err
	}
	return peers, nil
}

func (s *Status) Peers() ([]string, error) {
	return s.PeersWithQueryOptions(nil)
}
