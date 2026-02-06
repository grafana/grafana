// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"encoding/json"
	"fmt"
	"time"
)

// DiscoveryChain can be used to query the discovery-chain endpoints
type DiscoveryChain struct {
	c *Client
}

// DiscoveryChain returns a handle to the discovery-chain endpoints
func (c *Client) DiscoveryChain() *DiscoveryChain {
	return &DiscoveryChain{c}
}

func (d *DiscoveryChain) Get(name string, opts *DiscoveryChainOptions, q *QueryOptions) (*DiscoveryChainResponse, *QueryMeta, error) {
	if name == "" {
		return nil, nil, fmt.Errorf("Name parameter must not be empty")
	}

	method := "GET"
	if opts != nil && opts.requiresPOST() {
		method = "POST"
	}

	r := d.c.newRequest(method, fmt.Sprintf("/v1/discovery-chain/%s", name))
	r.setQueryOptions(q)

	if opts != nil {
		if opts.EvaluateInDatacenter != "" {
			r.params.Set("compile-dc", opts.EvaluateInDatacenter)
		}
	}

	if method == "POST" {
		r.obj = opts
	}
	rtt, resp, err := d.c.doRequest(r)
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

	var out DiscoveryChainResponse

	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

type DiscoveryChainOptions struct {
	EvaluateInDatacenter string `json:"-"`

	// OverrideMeshGateway allows for the mesh gateway setting to be overridden
	// for any resolver in the compiled chain.
	OverrideMeshGateway MeshGatewayConfig `json:",omitempty"`

	// OverrideProtocol allows for the final protocol for the chain to be
	// altered.
	//
	// - If the chain ordinarily would be TCP and an L7 protocol is passed here
	// the chain will not include Routers or Splitters.
	//
	// - If the chain ordinarily would be L7 and TCP is passed here the chain
	// will not include Routers or Splitters.
	OverrideProtocol string `json:",omitempty"`

	// OverrideConnectTimeout allows for the ConnectTimeout setting to be
	// overridden for any resolver in the compiled chain.
	OverrideConnectTimeout time.Duration `json:",omitempty"`
}

func (o *DiscoveryChainOptions) requiresPOST() bool {
	if o == nil {
		return false
	}
	return o.OverrideMeshGateway.Mode != "" ||
		o.OverrideProtocol != "" ||
		o.OverrideConnectTimeout != 0
}

type DiscoveryChainResponse struct {
	Chain *CompiledDiscoveryChain
}

type CompiledDiscoveryChain struct {
	ServiceName string
	Namespace   string
	Datacenter  string

	// CustomizationHash is a unique hash of any data that affects the
	// compilation of the discovery chain other than config entries or the
	// name/namespace/datacenter evaluation criteria.
	//
	// If set, this value should be used to prefix/suffix any generated load
	// balancer data plane objects to avoid sharing customized and
	// non-customized versions.
	CustomizationHash string

	// Default indicates if this discovery chain is based on no
	// service-resolver, service-splitter, or service-router config entries.
	Default bool

	// Protocol is the overall protocol shared by everything in the chain.
	Protocol string

	// ServiceMeta is the metadata from the underlying service-defaults config
	// entry for the service named ServiceName.
	ServiceMeta map[string]string

	// StartNode is the first key into the Nodes map that should be followed
	// when walking the discovery chain.
	StartNode string

	// Nodes contains all nodes available for traversal in the chain keyed by a
	// unique name.  You can walk this by starting with StartNode.
	//
	// NOTE: The names should be treated as opaque values and are only
	// guaranteed to be consistent within a single compilation.
	Nodes map[string]*DiscoveryGraphNode

	// Targets is a list of all targets used in this chain.
	//
	// NOTE: The names should be treated as opaque values and are only
	// guaranteed to be consistent within a single compilation.
	Targets map[string]*DiscoveryTarget
}

const (
	DiscoveryGraphNodeTypeRouter   = "router"
	DiscoveryGraphNodeTypeSplitter = "splitter"
	DiscoveryGraphNodeTypeResolver = "resolver"
)

// DiscoveryGraphNode is a single node in the compiled discovery chain.
type DiscoveryGraphNode struct {
	Type string
	Name string // this is NOT necessarily a service

	// fields for Type==router
	Routes []*DiscoveryRoute

	// fields for Type==splitter
	Splits []*DiscoverySplit

	// fields for Type==resolver
	Resolver *DiscoveryResolver

	// shared by Type==resolver || Type==splitter
	LoadBalancer *LoadBalancer `json:",omitempty"`
}

// compiled form of ServiceRoute
type DiscoveryRoute struct {
	Definition *ServiceRoute
	NextNode   string
}

// compiled form of ServiceSplit
type DiscoverySplit struct {
	Weight   float32
	NextNode string
}

// compiled form of ServiceResolverConfigEntry
type DiscoveryResolver struct {
	Default        bool
	ConnectTimeout time.Duration
	Target         string
	Failover       *DiscoveryFailover
}

func (r *DiscoveryResolver) MarshalJSON() ([]byte, error) {
	type Alias DiscoveryResolver
	exported := &struct {
		ConnectTimeout string `json:",omitempty"`
		*Alias
	}{
		ConnectTimeout: r.ConnectTimeout.String(),
		Alias:          (*Alias)(r),
	}
	if r.ConnectTimeout == 0 {
		exported.ConnectTimeout = ""
	}

	return json.Marshal(exported)
}

func (r *DiscoveryResolver) UnmarshalJSON(data []byte) error {
	type Alias DiscoveryResolver
	aux := &struct {
		ConnectTimeout string
		*Alias
	}{
		Alias: (*Alias)(r),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	var err error
	if aux.ConnectTimeout != "" {
		if r.ConnectTimeout, err = time.ParseDuration(aux.ConnectTimeout); err != nil {
			return err
		}
	}
	return nil
}

// compiled form of ServiceResolverFailover
type DiscoveryFailover struct {
	Targets []string
	Policy  ServiceResolverFailoverPolicy `json:",omitempty"`
}

// DiscoveryTarget represents all of the inputs necessary to use a resolver
// config entry to execute a catalog query to generate a list of service
// instances during discovery.
type DiscoveryTarget struct {
	ID string

	Service       string
	ServiceSubset string
	Namespace     string
	Datacenter    string

	MeshGateway    MeshGatewayConfig
	Subset         ServiceResolverSubset
	ConnectTimeout time.Duration
	External       bool
	SNI            string
	Name           string
}

func (t *DiscoveryTarget) MarshalJSON() ([]byte, error) {
	type Alias DiscoveryTarget
	exported := &struct {
		ConnectTimeout string `json:",omitempty"`
		*Alias
	}{
		ConnectTimeout: t.ConnectTimeout.String(),
		Alias:          (*Alias)(t),
	}
	if t.ConnectTimeout == 0 {
		exported.ConnectTimeout = ""
	}

	return json.Marshal(exported)
}

func (t *DiscoveryTarget) UnmarshalJSON(data []byte) error {
	type Alias DiscoveryTarget
	aux := &struct {
		ConnectTimeout string
		*Alias
	}{
		Alias: (*Alias)(t),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	var err error
	if aux.ConnectTimeout != "" {
		if t.ConnectTimeout, err = time.ParseDuration(aux.ConnectTimeout); err != nil {
			return err
		}
	}
	return nil
}
