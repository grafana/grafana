// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

// keyringRequest is used for performing Keyring operations
type keyringRequest struct {
	Key string
}

// KeyringResponse is returned when listing the gossip encryption keys
type KeyringResponse struct {
	// Whether this response is for a WAN ring
	WAN bool

	// The datacenter name this request corresponds to
	Datacenter string

	// Segment has the network segment this request corresponds to.
	Segment string

	// Partition has the admin partition this request corresponds to.
	Partition string `json:",omitempty"`

	// Messages has information or errors from serf
	Messages map[string]string `json:",omitempty"`

	// A map of the encryption keys to the number of nodes they're installed on
	Keys map[string]int

	// A map of the encryption primary keys to the number of nodes they're installed on
	PrimaryKeys map[string]int

	// The total number of nodes in this ring
	NumNodes int
}

// KeyringInstall is used to install a new gossip encryption key into the cluster
func (op *Operator) KeyringInstall(key string, q *WriteOptions) error {
	r := op.c.newRequest("POST", "/v1/operator/keyring")
	r.setWriteOptions(q)
	r.obj = keyringRequest{
		Key: key,
	}
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

// KeyringList is used to list the gossip keys installed in the cluster
func (op *Operator) KeyringList(q *QueryOptions) ([]*KeyringResponse, error) {
	r := op.c.newRequest("GET", "/v1/operator/keyring")
	r.setQueryOptions(q)
	_, resp, err := op.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	var out []*KeyringResponse
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// KeyringRemove is used to remove a gossip encryption key from the cluster
func (op *Operator) KeyringRemove(key string, q *WriteOptions) error {
	r := op.c.newRequest("DELETE", "/v1/operator/keyring")
	r.setWriteOptions(q)
	r.obj = keyringRequest{
		Key: key,
	}
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

// KeyringUse is used to change the active gossip encryption key
func (op *Operator) KeyringUse(key string, q *WriteOptions) error {
	r := op.c.newRequest("PUT", "/v1/operator/keyring")
	r.setWriteOptions(q)
	r.obj = keyringRequest{
		Key: key,
	}
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
