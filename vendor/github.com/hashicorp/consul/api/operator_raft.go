// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

// RaftServer has information about a server in the Raft configuration.
type RaftServer struct {
	// ID is the unique ID for the server. These are currently the same
	// as the address, but they will be changed to a real GUID in a future
	// release of Consul.
	ID string

	// Node is the node name of the server, as known by Consul, or this
	// will be set to "(unknown)" otherwise.
	Node string

	// Address is the IP:port of the server, used for Raft communications.
	Address string

	// Leader is true if this server is the current cluster leader.
	Leader bool

	// Protocol version is the raft protocol version used by the server
	ProtocolVersion string

	// Voter is true if this server has a vote in the cluster. This might
	// be false if the server is staging and still coming online, or if
	// it's a non-voting server, which will be added in a future release of
	// Consul.
	Voter bool

	// LastIndex is the last log index this server has a record of in its Raft log.
	LastIndex uint64
}

// RaftConfiguration is returned when querying for the current Raft configuration.
type RaftConfiguration struct {
	// Servers has the list of servers in the Raft configuration.
	Servers []*RaftServer

	// Index has the Raft index of this configuration.
	Index uint64
}

// TransferLeaderResponse is returned when querying for the current Raft configuration.
type TransferLeaderResponse struct {
	Success bool
}

// RaftGetConfiguration is used to query the current Raft peer set.
func (op *Operator) RaftGetConfiguration(q *QueryOptions) (*RaftConfiguration, error) {
	r := op.c.newRequest("GET", "/v1/operator/raft/configuration")
	r.setQueryOptions(q)
	_, resp, err := op.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	var out RaftConfiguration
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// RaftLeaderTransfer is used to transfer the current raft leader to another node
// Optionally accepts a non-empty id of another node to transfer leadership to.
func (op *Operator) RaftLeaderTransfer(id string, q *QueryOptions) (*TransferLeaderResponse, error) {
	r := op.c.newRequest("POST", "/v1/operator/raft/transfer-leader")
	r.setQueryOptions(q)

	if id != "" {
		r.params.Set("id", id)
	}
	_, resp, err := op.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	var out TransferLeaderResponse
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// RaftRemovePeerByAddress is used to kick a stale peer (one that it in the Raft
// quorum but no longer known to Serf or the catalog) by address in the form of
// "IP:port".
func (op *Operator) RaftRemovePeerByAddress(address string, q *WriteOptions) error {
	r := op.c.newRequest("DELETE", "/v1/operator/raft/peer")
	r.setWriteOptions(q)

	r.params.Set("address", address)

	_, resp, err := op.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// RaftRemovePeerByID is used to kick a stale peer (one that it in the Raft
// quorum but no longer known to Serf or the catalog) by ID.
func (op *Operator) RaftRemovePeerByID(id string, q *WriteOptions) error {
	r := op.c.newRequest("DELETE", "/v1/operator/raft/peer")
	r.setWriteOptions(q)

	r.params.Set("id", id)

	_, resp, err := op.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}
