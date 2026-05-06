// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import "time"

// TCPRouteConfigEntry -- TODO stub
type TCPRouteConfigEntry struct {
	// Kind of the config entry. This should be set to api.TCPRoute.
	Kind string

	// Name is used to match the config entry with its associated tcp-route
	// service. This should match the name provided in the service definition.
	Name string

	// Parents is a list of gateways that this route should be bound to.
	Parents []ResourceReference
	// Services is a list of TCP-based services that this should route to.
	// Currently, this must specify at maximum one service.
	Services []TCPService

	Meta map[string]string `json:",omitempty"`

	// Status is the asynchronous status which a TCPRoute propagates to the user.
	Status ConfigEntryStatus

	// CreateIndex is the Raft index this entry was created at. This is a
	// read-only field.
	CreateIndex uint64

	// ModifyIndex is used for the Check-And-Set operations and can also be fed
	// back into the WaitIndex of the QueryOptions in order to perform blocking
	// queries.
	ModifyIndex uint64

	// Partition is the partition the config entry is associated with.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the config entry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`
}

func (a *TCPRouteConfigEntry) GetKind() string            { return TCPRoute }
func (a *TCPRouteConfigEntry) GetName() string            { return a.Name }
func (a *TCPRouteConfigEntry) GetPartition() string       { return a.Partition }
func (a *TCPRouteConfigEntry) GetNamespace() string       { return a.Namespace }
func (a *TCPRouteConfigEntry) GetMeta() map[string]string { return a.Meta }
func (a *TCPRouteConfigEntry) GetCreateIndex() uint64     { return a.CreateIndex }
func (a *TCPRouteConfigEntry) GetModifyIndex() uint64     { return a.ModifyIndex }

// TCPService is a service reference for a TCPRoute
type TCPService struct {
	Name string

	// Partition is the partition the config entry is associated with.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the config entry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`
}

// HTTPRouteConfigEntry manages the configuration for a HTTP route
// with the given name.
type HTTPRouteConfigEntry struct {
	// Kind of the config entry. This should be set to api.HTTPRoute.
	Kind string

	// Name is used to match the config entry with its associated http-route.
	Name string

	// Parents is a list of gateways that this route should be bound to
	Parents []ResourceReference
	// Rules are a list of HTTP-based routing rules that this route should
	// use for constructing a routing table.
	Rules []HTTPRouteRule
	// Hostnames are the hostnames for which this HTTPRoute should respond to requests.
	Hostnames []string

	Meta map[string]string `json:",omitempty"`

	// CreateIndex is the Raft index this entry was created at. This is a
	// read-only field.
	CreateIndex uint64

	// ModifyIndex is used for the Check-And-Set operations and can also be fed
	// back into the WaitIndex of the QueryOptions in order to perform blocking
	// queries.
	ModifyIndex uint64

	// Partition is the partition the config entry is associated with.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the config entry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Status is the asynchronous status which an HTTPRoute propagates to the user.
	Status ConfigEntryStatus
}

func (r *HTTPRouteConfigEntry) GetKind() string            { return HTTPRoute }
func (r *HTTPRouteConfigEntry) GetName() string            { return r.Name }
func (r *HTTPRouteConfigEntry) GetPartition() string       { return r.Partition }
func (r *HTTPRouteConfigEntry) GetNamespace() string       { return r.Namespace }
func (r *HTTPRouteConfigEntry) GetMeta() map[string]string { return r.Meta }
func (r *HTTPRouteConfigEntry) GetCreateIndex() uint64     { return r.CreateIndex }
func (r *HTTPRouteConfigEntry) GetModifyIndex() uint64     { return r.ModifyIndex }

// HTTPMatch specifies the criteria that should be
// used in determining whether or not a request should
// be routed to a given set of services.
type HTTPMatch struct {
	Headers []HTTPHeaderMatch
	Method  HTTPMatchMethod
	Path    HTTPPathMatch
	Query   []HTTPQueryMatch
}

// HTTPMatchMethod specifies which type of HTTP verb should
// be used for matching a given request.
type HTTPMatchMethod string

const (
	HTTPMatchMethodAll     HTTPMatchMethod = ""
	HTTPMatchMethodConnect HTTPMatchMethod = "CONNECT"
	HTTPMatchMethodDelete  HTTPMatchMethod = "DELETE"
	HTTPMatchMethodGet     HTTPMatchMethod = "GET"
	HTTPMatchMethodHead    HTTPMatchMethod = "HEAD"
	HTTPMatchMethodOptions HTTPMatchMethod = "OPTIONS"
	HTTPMatchMethodPatch   HTTPMatchMethod = "PATCH"
	HTTPMatchMethodPost    HTTPMatchMethod = "POST"
	HTTPMatchMethodPut     HTTPMatchMethod = "PUT"
	HTTPMatchMethodTrace   HTTPMatchMethod = "TRACE"
)

// HTTPHeaderMatchType specifies how header matching criteria
// should be applied to a request.
type HTTPHeaderMatchType string

const (
	HTTPHeaderMatchExact             HTTPHeaderMatchType = "exact"
	HTTPHeaderMatchPrefix            HTTPHeaderMatchType = "prefix"
	HTTPHeaderMatchPresent           HTTPHeaderMatchType = "present"
	HTTPHeaderMatchRegularExpression HTTPHeaderMatchType = "regex"
	HTTPHeaderMatchSuffix            HTTPHeaderMatchType = "suffix"
)

// HTTPHeaderMatch specifies how a match should be done
// on a request's headers.
type HTTPHeaderMatch struct {
	Match HTTPHeaderMatchType
	Name  string
	Value string
}

// HTTPPathMatchType specifies how path matching criteria
// should be applied to a request.
type HTTPPathMatchType string

const (
	HTTPPathMatchExact             HTTPPathMatchType = "exact"
	HTTPPathMatchPrefix            HTTPPathMatchType = "prefix"
	HTTPPathMatchRegularExpression HTTPPathMatchType = "regex"
)

// HTTPPathMatch specifies how a match should be done
// on a request's path.
type HTTPPathMatch struct {
	Match HTTPPathMatchType
	Value string
}

// HTTPQueryMatchType specifies how querys matching criteria
// should be applied to a request.
type HTTPQueryMatchType string

const (
	HTTPQueryMatchExact             HTTPQueryMatchType = "exact"
	HTTPQueryMatchPresent           HTTPQueryMatchType = "present"
	HTTPQueryMatchRegularExpression HTTPQueryMatchType = "regex"
)

// HTTPQueryMatch specifies how a match should be done
// on a request's query parameters.
type HTTPQueryMatch struct {
	Match HTTPQueryMatchType
	Name  string
	Value string
}

// HTTPFilters specifies a list of filters used to modify a request
// before it is routed to an upstream.
type HTTPFilters struct {
	Headers       []HTTPHeaderFilter
	URLRewrite    *URLRewrite
	RetryFilter   *RetryFilter
	TimeoutFilter *TimeoutFilter
	JWT           *JWTFilter
}

// HTTPResponseFilters specifies a list of filters used to modify a
// response returned by an upstream
type HTTPResponseFilters struct {
	Headers []HTTPHeaderFilter
}

// HTTPHeaderFilter specifies how HTTP headers should be modified.
type HTTPHeaderFilter struct {
	Add    map[string]string
	Remove []string
	Set    map[string]string
}

type URLRewrite struct {
	Path string
}

type RetryFilter struct {
	NumRetries            uint32
	RetryOn               []string
	RetryOnStatusCodes    []uint32
	RetryOnConnectFailure bool
}

type TimeoutFilter struct {
	RequestTimeout time.Duration
	IdleTimeout    time.Duration
}

// JWTFilter specifies the JWT configuration for a route
type JWTFilter struct {
	Providers []*APIGatewayJWTProvider `json:",omitempty"`
}

// HTTPRouteRule specifies the routing rules used to determine what upstream
// service an HTTP request is routed to.
type HTTPRouteRule struct {
	// Filters is a list of HTTP-based filters used to modify a request prior
	// to routing it to the upstream service
	Filters HTTPFilters
	// ResponseFilters is a list of HTTP-based filters used to modify a response
	// returned by the upstream service
	ResponseFilters HTTPResponseFilters
	// Matches specified the matching criteria used in the routing table. If a
	// request matches the given HTTPMatch configuration, then traffic is routed
	// to services specified in the Services field.
	Matches []HTTPMatch
	// Services is a list of HTTP-based services to route to if the request matches
	// the rules specified in the Matches field.
	Services []HTTPService
}

// HTTPService is a service reference for HTTP-based routing rules
type HTTPService struct {
	Name string
	// Weight is an arbitrary integer used in calculating how much
	// traffic should be sent to the given service.
	Weight int

	// Filters is a list of HTTP-based filters used to modify a request prior
	// to routing it to the upstream service
	Filters HTTPFilters

	// ResponseFilters is a list of HTTP-based filters used to modify the
	// response returned from the upstream service
	ResponseFilters HTTPResponseFilters

	// Partition is the partition the config entry is associated with.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the config entry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`
}
