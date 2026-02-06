// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"net"
	"strconv"
)

type Weights struct {
	Passing int
	Warning int
}

type Node struct {
	ID              string
	Node            string
	Address         string
	Datacenter      string
	TaggedAddresses map[string]string
	Meta            map[string]string
	CreateIndex     uint64
	ModifyIndex     uint64
	Partition       string    `json:",omitempty"`
	PeerName        string    `json:",omitempty"`
	Locality        *Locality `json:",omitempty"`
}

type ServiceAddress struct {
	Address string
	Port    int
}

type CatalogService struct {
	ID                       string
	Node                     string
	Address                  string
	Datacenter               string
	TaggedAddresses          map[string]string
	NodeMeta                 map[string]string
	ServiceID                string
	ServiceName              string
	ServiceAddress           string
	ServiceTaggedAddresses   map[string]ServiceAddress
	ServiceTags              []string
	ServiceMeta              map[string]string
	ServicePort              int
	ServiceWeights           Weights
	ServiceEnableTagOverride bool
	ServiceProxy             *AgentServiceConnectProxyConfig
	ServiceLocality          *Locality `json:",omitempty"`
	CreateIndex              uint64
	Checks                   HealthChecks
	ModifyIndex              uint64
	Namespace                string `json:",omitempty"`
	Partition                string `json:",omitempty"`
}

type CatalogNode struct {
	Node     *Node
	Services map[string]*AgentService
}

type CatalogNodeServiceList struct {
	Node     *Node
	Services []*AgentService
}

type CatalogRegistration struct {
	ID              string
	Node            string
	Address         string
	TaggedAddresses map[string]string
	NodeMeta        map[string]string
	Datacenter      string
	Service         *AgentService
	Check           *AgentCheck
	Checks          HealthChecks
	SkipNodeUpdate  bool
	Partition       string    `json:",omitempty"`
	Locality        *Locality `json:",omitempty"`
}

type CatalogDeregistration struct {
	Node       string
	Address    string `json:",omitempty"` // Obsolete.
	Datacenter string
	ServiceID  string
	CheckID    string
	Namespace  string `json:",omitempty"`
	Partition  string `json:",omitempty"`
}

type CompoundServiceName struct {
	Name string

	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`
}

// GatewayService associates a gateway with a linked service.
// It also contains service-specific gateway configuration like ingress listener port and protocol.
type GatewayService struct {
	Gateway      CompoundServiceName
	Service      CompoundServiceName
	GatewayKind  ServiceKind
	Port         int      `json:",omitempty"`
	Protocol     string   `json:",omitempty"`
	Hosts        []string `json:",omitempty"`
	CAFile       string   `json:",omitempty"`
	CertFile     string   `json:",omitempty"`
	KeyFile      string   `json:",omitempty"`
	SNI          string   `json:",omitempty"`
	FromWildcard bool     `json:",omitempty"`
}

// Catalog can be used to query the Catalog endpoints
type Catalog struct {
	c *Client
}

// Catalog returns a handle to the catalog endpoints
func (c *Client) Catalog() *Catalog {
	return &Catalog{c}
}

func (c *Catalog) Register(reg *CatalogRegistration, q *WriteOptions) (*WriteMeta, error) {
	r := c.c.newRequest("PUT", "/v1/catalog/register")
	r.setWriteOptions(q)
	r.obj = reg
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

func (c *Catalog) Deregister(dereg *CatalogDeregistration, q *WriteOptions) (*WriteMeta, error) {
	r := c.c.newRequest("PUT", "/v1/catalog/deregister")
	r.setWriteOptions(q)
	r.obj = dereg
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

// Datacenters is used to query for all the known datacenters
func (c *Catalog) Datacenters() ([]string, error) {
	r := c.c.newRequest("GET", "/v1/catalog/datacenters")
	_, resp, err := c.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	var out []string
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Nodes is used to query all the known nodes
func (c *Catalog) Nodes(q *QueryOptions) ([]*Node, *QueryMeta, error) {
	r := c.c.newRequest("GET", "/v1/catalog/nodes")
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

	var out []*Node
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// Services is used to query for all known services
func (c *Catalog) Services(q *QueryOptions) (map[string][]string, *QueryMeta, error) {
	r := c.c.newRequest("GET", "/v1/catalog/services")
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

	var out map[string][]string
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// Service is used to query catalog entries for a given service
func (c *Catalog) Service(service, tag string, q *QueryOptions) ([]*CatalogService, *QueryMeta, error) {
	var tags []string
	if tag != "" {
		tags = []string{tag}
	}
	return c.service(service, tags, q, false)
}

// Supports multiple tags for filtering
func (c *Catalog) ServiceMultipleTags(service string, tags []string, q *QueryOptions) ([]*CatalogService, *QueryMeta, error) {
	return c.service(service, tags, q, false)
}

// Connect is used to query catalog entries for a given Connect-enabled service
func (c *Catalog) Connect(service, tag string, q *QueryOptions) ([]*CatalogService, *QueryMeta, error) {
	var tags []string
	if tag != "" {
		tags = []string{tag}
	}
	return c.service(service, tags, q, true)
}

// Supports multiple tags for filtering
func (c *Catalog) ConnectMultipleTags(service string, tags []string, q *QueryOptions) ([]*CatalogService, *QueryMeta, error) {
	return c.service(service, tags, q, true)
}

func (c *Catalog) service(service string, tags []string, q *QueryOptions, connect bool) ([]*CatalogService, *QueryMeta, error) {
	path := "/v1/catalog/service/" + service
	if connect {
		path = "/v1/catalog/connect/" + service
	}
	r := c.c.newRequest("GET", path)
	r.setQueryOptions(q)
	if len(tags) > 0 {
		for _, tag := range tags {
			r.params.Add("tag", tag)
		}
	}
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

	var out []*CatalogService
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// Node is used to query for service information about a single node
func (c *Catalog) Node(node string, q *QueryOptions) (*CatalogNode, *QueryMeta, error) {
	r := c.c.newRequest("GET", "/v1/catalog/node/"+node)
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

	var out *CatalogNode
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// NodeServiceList is used to query for service information about a single node. It differs from
// the Node function only in its return type which will contain a list of services as opposed to
// a map of service ids to services. This different structure allows for using the wildcard specifier
// '*' for the Namespace in the QueryOptions.
func (c *Catalog) NodeServiceList(node string, q *QueryOptions) (*CatalogNodeServiceList, *QueryMeta, error) {
	r := c.c.newRequest("GET", "/v1/catalog/node-services/"+node)
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

	var out *CatalogNodeServiceList
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// GatewayServices is used to query the services associated with an ingress gateway or terminating gateway.
func (c *Catalog) GatewayServices(gateway string, q *QueryOptions) ([]*GatewayService, *QueryMeta, error) {
	r := c.c.newRequest("GET", "/v1/catalog/gateway-services/"+gateway)
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

	var out []*GatewayService
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

func ParseServiceAddr(addrPort string) (ServiceAddress, error) {
	port := 0
	host, portStr, err := net.SplitHostPort(addrPort)
	if err == nil {
		port, err = strconv.Atoi(portStr)
	}
	return ServiceAddress{Address: host, Port: port}, err
}
