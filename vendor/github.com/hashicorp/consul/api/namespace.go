// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"encoding/json"
	"fmt"
	"time"
)

// Namespace is the configuration of a single namespace. Namespacing is a Consul Enterprise feature.
type Namespace struct {
	// Name is the name of the Namespace. It must be unique and
	// must be a DNS hostname. There are also other reserved names
	// that may not be used.
	Name string `json:"Name"`

	// Description is where the user puts any information they want
	// about the namespace. It is not used internally.
	Description string `json:"Description,omitempty"`

	// ACLs is the configuration of ACLs for this namespace. It has its
	// own struct so that we can add more to it in the future.
	// This is nullable so that we can omit if empty when encoding in JSON
	ACLs *NamespaceACLConfig `json:"ACLs,omitempty"`

	// Meta is a map that can be used to add kv metadata to the namespace definition
	Meta map[string]string `json:"Meta,omitempty"`

	// DeletedAt is the time when the Namespace was marked for deletion
	// This is nullable so that we can omit if empty when encoding in JSON
	DeletedAt *time.Time `json:"DeletedAt,omitempty" alias:"deleted_at"`

	// Partition which contains the Namespace.
	Partition string `json:"Partition,omitempty"`

	// CreateIndex is the Raft index at which the Namespace was created
	CreateIndex uint64 `json:"CreateIndex,omitempty"`

	// ModifyIndex is the latest Raft index at which the Namespace was modified.
	ModifyIndex uint64 `json:"ModifyIndex,omitempty"`
}

func (n *Namespace) UnmarshalJSON(data []byte) error {
	type Alias Namespace
	aux := struct {
		DeletedAtSnake *time.Time `json:"deleted_at"`
		*Alias
	}{
		Alias: (*Alias)(n),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	if n.DeletedAt == nil && aux.DeletedAtSnake != nil {
		n.DeletedAt = aux.DeletedAtSnake
	}

	return nil
}

// NamespaceACLConfig is the Namespace specific ACL configuration container
type NamespaceACLConfig struct {
	// PolicyDefaults is the list of policies that should be used for the parent authorizer
	// of all tokens in the associated namespace.
	PolicyDefaults []ACLLink `json:"PolicyDefaults" alias:"policy_defaults"`
	// RoleDefaults is the list of roles that should be used for the parent authorizer
	// of all tokens in the associated namespace.
	RoleDefaults []ACLLink `json:"RoleDefaults" alias:"role_defaults"`
}

func (n *NamespaceACLConfig) UnmarshalJSON(data []byte) error {
	type Alias NamespaceACLConfig
	aux := struct {
		PolicyDefaultsSnake []ACLLink `json:"policy_defaults"`
		RoleDefaultsSnake   []ACLLink `json:"role_defaults"`
		*Alias
	}{
		Alias: (*Alias)(n),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	if n.PolicyDefaults == nil {
		for _, pd := range aux.PolicyDefaultsSnake {
			n.PolicyDefaults = append(n.PolicyDefaults, pd)
		}
	}
	if n.RoleDefaults == nil {
		for _, pd := range aux.RoleDefaultsSnake {
			n.RoleDefaults = append(n.RoleDefaults, pd)
		}
	}
	return nil
}

// Namespaces can be used to manage Namespaces in Consul Enterprise..
type Namespaces struct {
	c *Client
}

// Namespaces returns a handle to the namespaces endpoints.
func (c *Client) Namespaces() *Namespaces {
	return &Namespaces{c}
}

func (n *Namespaces) Create(ns *Namespace, q *WriteOptions) (*Namespace, *WriteMeta, error) {
	if ns.Name == "" {
		return nil, nil, fmt.Errorf("Must specify a Name for Namespace creation")
	}

	r := n.c.newRequest("PUT", "/v1/namespace")
	r.setWriteOptions(q)
	r.obj = ns
	rtt, resp, err := n.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	var out Namespace
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

func (n *Namespaces) Update(ns *Namespace, q *WriteOptions) (*Namespace, *WriteMeta, error) {
	if ns.Name == "" {
		return nil, nil, fmt.Errorf("Must specify a Name for Namespace updating")
	}

	r := n.c.newRequest("PUT", "/v1/namespace/"+ns.Name)
	r.setWriteOptions(q)
	r.obj = ns
	rtt, resp, err := n.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	var out Namespace
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

func (n *Namespaces) Read(name string, q *QueryOptions) (*Namespace, *QueryMeta, error) {
	var out Namespace
	r := n.c.newRequest("GET", "/v1/namespace/"+name)
	r.setQueryOptions(q)
	rtt, resp, err := n.c.doRequest(r)
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

func (n *Namespaces) Delete(name string, q *WriteOptions) (*WriteMeta, error) {
	r := n.c.newRequest("DELETE", "/v1/namespace/"+name)
	r.setWriteOptions(q)
	rtt, resp, err := n.c.doRequest(r)
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

func (n *Namespaces) List(q *QueryOptions) ([]*Namespace, *QueryMeta, error) {
	var out []*Namespace
	r := n.c.newRequest("GET", "/v1/namespaces")
	r.setQueryOptions(q)
	rtt, resp, err := n.c.doRequest(r)
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
