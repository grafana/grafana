// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
)

// ServiceKind is the kind of service being registered.
type ServiceKind string

const (
	// ServiceKindTypical is a typical, classic Consul service. This is
	// represented by the absence of a value. This was chosen for ease of
	// backwards compatibility: existing services in the catalog would
	// default to the typical service.
	ServiceKindTypical ServiceKind = ""

	// ServiceKindConnectProxy is a proxy for the Connect feature. This
	// service proxies another service within Consul and speaks the connect
	// protocol.
	ServiceKindConnectProxy ServiceKind = "connect-proxy"

	// ServiceKindMeshGateway is a Mesh Gateway for the Connect feature. This
	// service will proxy connections based off the SNI header set by other
	// connect proxies
	ServiceKindMeshGateway ServiceKind = "mesh-gateway"

	// ServiceKindTerminatingGateway is a Terminating Gateway for the Connect
	// feature. This service will proxy connections to services outside the mesh.
	ServiceKindTerminatingGateway ServiceKind = "terminating-gateway"

	// ServiceKindIngressGateway is an Ingress Gateway for the Connect feature.
	// This service will ingress connections based of configuration defined in
	// the ingress-gateway config entry.
	ServiceKindIngressGateway ServiceKind = "ingress-gateway"

	// ServiceKindAPIGateway is an API Gateway for the Connect feature.
	// This service will ingress connections based of configuration defined in
	// the api-gateway config entry.
	ServiceKindAPIGateway ServiceKind = "api-gateway"
)

// UpstreamDestType is the type of upstream discovery mechanism.
type UpstreamDestType string

const (
	// UpstreamDestTypeService discovers instances via healthy service lookup.
	UpstreamDestTypeService UpstreamDestType = "service"

	// UpstreamDestTypePreparedQuery discovers instances via prepared query
	// execution.
	UpstreamDestTypePreparedQuery UpstreamDestType = "prepared_query"
)

// AgentCheck represents a check known to the agent
type AgentCheck struct {
	Node        string
	CheckID     string
	Name        string
	Status      string
	Notes       string
	Output      string
	ServiceID   string
	ServiceName string
	Type        string
	ExposedPort int
	Definition  HealthCheckDefinition
	Namespace   string `json:",omitempty"`
	Partition   string `json:",omitempty"`
}

// AgentWeights represent optional weights for a service
type AgentWeights struct {
	Passing int
	Warning int
}

// AgentService represents a service known to the agent
type AgentService struct {
	Kind              ServiceKind `json:",omitempty"`
	ID                string
	Service           string
	Tags              []string
	Meta              map[string]string
	Port              int
	Address           string
	SocketPath        string                    `json:",omitempty"`
	TaggedAddresses   map[string]ServiceAddress `json:",omitempty"`
	Weights           AgentWeights
	EnableTagOverride bool
	CreateIndex       uint64                          `json:",omitempty" bexpr:"-"`
	ModifyIndex       uint64                          `json:",omitempty" bexpr:"-"`
	ContentHash       string                          `json:",omitempty" bexpr:"-"`
	Proxy             *AgentServiceConnectProxyConfig `json:",omitempty"`
	Connect           *AgentServiceConnect            `json:",omitempty"`
	PeerName          string                          `json:",omitempty"`
	// NOTE: If we ever set the ContentHash outside of singular service lookup then we may need
	// to include the Namespace in the hash. When we do, then we are in for lots of fun with tests.
	// For now though, ignoring it works well enough.
	Namespace string `json:",omitempty" bexpr:"-" hash:"ignore"`
	Partition string `json:",omitempty" bexpr:"-" hash:"ignore"`
	// Datacenter is only ever returned and is ignored if presented.
	Datacenter string    `json:",omitempty" bexpr:"-" hash:"ignore"`
	Locality   *Locality `json:",omitempty" bexpr:"-" hash:"ignore"`
}

// AgentServiceChecksInfo returns information about a Service and its checks
type AgentServiceChecksInfo struct {
	AggregatedStatus string
	Service          *AgentService
	Checks           HealthChecks
}

// AgentServiceConnect represents the Connect configuration of a service.
type AgentServiceConnect struct {
	Native         bool                      `json:",omitempty"`
	SidecarService *AgentServiceRegistration `json:",omitempty" bexpr:"-"`
}

// AgentServiceConnectProxyConfig is the proxy configuration in a connect-proxy
// ServiceDefinition or response.
type AgentServiceConnectProxyConfig struct {
	EnvoyExtensions        []EnvoyExtension        `json:",omitempty"`
	DestinationServiceName string                  `json:",omitempty"`
	DestinationServiceID   string                  `json:",omitempty"`
	LocalServiceAddress    string                  `json:",omitempty"`
	LocalServicePort       int                     `json:",omitempty"`
	LocalServiceSocketPath string                  `json:",omitempty"`
	Mode                   ProxyMode               `json:",omitempty"`
	TransparentProxy       *TransparentProxyConfig `json:",omitempty"`
	Config                 map[string]interface{}  `json:",omitempty" bexpr:"-"`
	Upstreams              []Upstream              `json:",omitempty"`
	MeshGateway            MeshGatewayConfig       `json:",omitempty"`
	Expose                 ExposeConfig            `json:",omitempty"`
	AccessLogs             *AccessLogsConfig       `json:",omitempty"`
}

const (
	// MemberTagKeyACLMode is the key used to indicate what ACL mode the agent is
	// operating in. The values of this key will be one of the MemberACLMode constants
	// with the key not being present indicating ACLModeUnknown.
	MemberTagKeyACLMode = "acls"

	// MemberTagRole is the key used to indicate that the member is a server or not.
	MemberTagKeyRole = "role"

	// MemberTagValueRoleServer is the value of the MemberTagKeyRole used to indicate
	// that the member represents a Consul server.
	MemberTagValueRoleServer = "consul"

	// MemberTagValueRoleClient is the value of the MemberTagKeyRole used to indicate
	// that the member represents a Consul client.
	MemberTagValueRoleClient = "node"

	// MemberTagKeyDatacenter is the key used to indicate which datacenter this member is in.
	MemberTagKeyDatacenter = "dc"

	// MemberTagKeySegment is the key name of the tag used to indicate which network
	// segment this member is in.
	// Network Segments are a Consul Enterprise feature.
	MemberTagKeySegment = "segment"

	// MemberTagKeyPartition is the key name of the tag used to indicate which partition
	// this member is in.
	// Partitions are a Consul Enterprise feature.
	MemberTagKeyPartition = "ap"

	// MemberTagKeyBootstrap is the key name of the tag used to indicate whether this
	// agent was started with the "bootstrap" configuration enabled
	MemberTagKeyBootstrap = "bootstrap"
	// MemberTagValueBootstrap is the value of the MemberTagKeyBootstrap key when the
	// agent was started with the "bootstrap" configuration enabled.
	MemberTagValueBootstrap = "1"

	// MemberTagKeyBootstrapExpect is the key name of the tag used to indicate whether
	// this agent was started with the "bootstrap_expect" configuration set to a non-zero
	// value. The value of this key will be the string for of that configuration value.
	MemberTagKeyBootstrapExpect = "expect"

	// MemberTagKeyUseTLS is the key name of the tag used to indicate whther this agent
	// was configured to use TLS.
	MemberTagKeyUseTLS = "use_tls"
	// MemberTagValueUseTLS is the value of the MemberTagKeyUseTLS when the agent was
	// configured to use TLS. Any other value indicates that it was not setup in
	// that manner.
	MemberTagValueUseTLS = "1"

	// MemberTagKeyReadReplica is the key used to indicate that the member is a read
	// replica server (will remain a Raft non-voter).
	// Read Replicas are a Consul Enterprise feature.
	MemberTagKeyReadReplica = "read_replica"
	// MemberTagValueReadReplica is the value of the MemberTagKeyReadReplica key when
	// the member is in fact a read-replica. Any other value indicates that it is not.
	// Read Replicas are a Consul Enterprise feature.
	MemberTagValueReadReplica = "1"
)

type MemberACLMode string

const (
	// ACLModeDisables indicates that ACLs are disabled for this agent
	ACLModeDisabled MemberACLMode = "0"
	// ACLModeEnabled indicates that ACLs are enabled and operating in new ACL
	// mode (v1.4.0+ ACLs)
	ACLModeEnabled MemberACLMode = "1"
	// ACLModeLegacy has been deprecated, and will be treated as ACLModeUnknown.
	ACLModeLegacy MemberACLMode = "2" // DEPRECATED
	// ACLModeUnkown is used to indicate that the AgentMember.Tags didn't advertise
	// an ACL mode at all. This is the case for Consul versions before v1.4.0 and
	// should be treated the same as ACLModeLegacy.
	ACLModeUnknown MemberACLMode = "3"
)

// AgentMember represents a cluster member known to the agent
type AgentMember struct {
	Name string
	Addr string
	Port uint16
	Tags map[string]string
	// Status of the Member which corresponds to  github.com/hashicorp/serf/serf.MemberStatus
	// Value is one of:
	//
	// 	  AgentMemberNone    = 0
	//	  AgentMemberAlive   = 1
	//	  AgentMemberLeaving = 2
	//	  AgentMemberLeft    = 3
	//	  AgentMemberFailed  = 4
	Status      int
	ProtocolMin uint8
	ProtocolMax uint8
	ProtocolCur uint8
	DelegateMin uint8
	DelegateMax uint8
	DelegateCur uint8
}

// ACLMode returns the ACL mode this agent is operating in.
func (m *AgentMember) ACLMode() MemberACLMode {
	mode := m.Tags[MemberTagKeyACLMode]

	// the key may not have existed but then an
	// empty string will be returned and we will
	// handle that in the default case of the switch
	switch MemberACLMode(mode) {
	case ACLModeDisabled:
		return ACLModeDisabled
	case ACLModeEnabled:
		return ACLModeEnabled
	default:
		return ACLModeUnknown
	}
}

// IsConsulServer returns true when this member is a Consul server.
func (m *AgentMember) IsConsulServer() bool {
	return m.Tags[MemberTagKeyRole] == MemberTagValueRoleServer
}

// AllSegments is used to select for all segments in MembersOpts.
const AllSegments = "_all"

// MembersOpts is used for querying member information.
type MembersOpts struct {
	// WAN is whether to show members from the WAN.
	WAN bool

	// Segment is the LAN segment to show members for. Setting this to the
	// AllSegments value above will show members in all segments.
	Segment string

	Filter string
}

// AgentServiceRegistration is used to register a new service
type AgentServiceRegistration struct {
	Kind              ServiceKind               `json:",omitempty"`
	ID                string                    `json:",omitempty"`
	Name              string                    `json:",omitempty"`
	Tags              []string                  `json:",omitempty"`
	Port              int                       `json:",omitempty"`
	Address           string                    `json:",omitempty"`
	SocketPath        string                    `json:",omitempty"`
	TaggedAddresses   map[string]ServiceAddress `json:",omitempty"`
	EnableTagOverride bool                      `json:",omitempty"`
	Meta              map[string]string         `json:",omitempty"`
	Weights           *AgentWeights             `json:",omitempty"`
	Check             *AgentServiceCheck
	Checks            AgentServiceChecks
	Proxy             *AgentServiceConnectProxyConfig `json:",omitempty"`
	Connect           *AgentServiceConnect            `json:",omitempty"`
	Namespace         string                          `json:",omitempty" bexpr:"-" hash:"ignore"`
	Partition         string                          `json:",omitempty" bexpr:"-" hash:"ignore"`
	Locality          *Locality                       `json:",omitempty" bexpr:"-" hash:"ignore"`
}

// ServiceRegisterOpts is used to pass extra options to the service register.
type ServiceRegisterOpts struct {
	// Missing healthchecks will be deleted from the agent.
	// Using this parameter allows to idempotently register a service and its checks without
	// having to manually deregister checks.
	ReplaceExistingChecks bool

	// Token is used to provide a per-request ACL token
	// which overrides the agent's default token.
	Token string

	// ctx is an optional context pass through to the underlying HTTP
	// request layer. Use WithContext() to set the context.
	ctx context.Context
}

// WithContext sets the context to be used for the request on a new ServiceRegisterOpts,
// and returns the opts.
func (o ServiceRegisterOpts) WithContext(ctx context.Context) ServiceRegisterOpts {
	o.ctx = ctx
	return o
}

// AgentCheckRegistration is used to register a new check
type AgentCheckRegistration struct {
	ID        string `json:",omitempty"`
	Name      string `json:",omitempty"`
	Notes     string `json:",omitempty"`
	ServiceID string `json:",omitempty"`
	AgentServiceCheck
	Namespace string `json:",omitempty"`
	Partition string `json:",omitempty"`
}

// AgentServiceCheck is used to define a node or service level check
type AgentServiceCheck struct {
	CheckID                string              `json:",omitempty"`
	Name                   string              `json:",omitempty"`
	Args                   []string            `json:"ScriptArgs,omitempty"`
	DockerContainerID      string              `json:",omitempty"`
	Shell                  string              `json:",omitempty"` // Only supported for Docker.
	Interval               string              `json:",omitempty"`
	Timeout                string              `json:",omitempty"`
	TTL                    string              `json:",omitempty"`
	HTTP                   string              `json:",omitempty"`
	Header                 map[string][]string `json:",omitempty"`
	Method                 string              `json:",omitempty"`
	Body                   string              `json:",omitempty"`
	TCP                    string              `json:",omitempty"`
	TCPUseTLS              bool                `json:",omitempty"`
	UDP                    string              `json:",omitempty"`
	Status                 string              `json:",omitempty"`
	Notes                  string              `json:",omitempty"`
	TLSServerName          string              `json:",omitempty"`
	TLSSkipVerify          bool                `json:",omitempty"`
	GRPC                   string              `json:",omitempty"`
	GRPCUseTLS             bool                `json:",omitempty"`
	H2PING                 string              `json:",omitempty"`
	H2PingUseTLS           bool                `json:",omitempty"`
	AliasNode              string              `json:",omitempty"`
	AliasService           string              `json:",omitempty"`
	SuccessBeforePassing   int                 `json:",omitempty"`
	FailuresBeforeWarning  int                 `json:",omitempty"`
	FailuresBeforeCritical int                 `json:",omitempty"`

	// In Consul 0.7 and later, checks that are associated with a service
	// may also contain this optional DeregisterCriticalServiceAfter field,
	// which is a timeout in the same Go time format as Interval and TTL. If
	// a check is in the critical state for more than this configured value,
	// then its associated service (and all of its associated checks) will
	// automatically be deregistered.
	DeregisterCriticalServiceAfter string `json:",omitempty"`
}
type AgentServiceChecks []*AgentServiceCheck

// AgentToken is used when updating ACL tokens for an agent.
type AgentToken struct {
	Token string
}

// Metrics info is used to store different types of metric values from the agent.
type MetricsInfo struct {
	Timestamp string
	Gauges    []GaugeValue
	Points    []PointValue
	Counters  []SampledValue
	Samples   []SampledValue
}

// GaugeValue stores one value that is updated as time goes on, such as
// the amount of memory allocated.
type GaugeValue struct {
	Name   string
	Value  float32
	Labels map[string]string
}

// PointValue holds a series of points for a metric.
type PointValue struct {
	Name   string
	Points []float32
}

// SampledValue stores info about a metric that is incremented over time,
// such as the number of requests to an HTTP endpoint.
type SampledValue struct {
	Name   string
	Count  int
	Sum    float64
	Min    float64
	Max    float64
	Mean   float64
	Stddev float64
	Labels map[string]string
}

// AgentAuthorizeParams are the request parameters for authorizing a request.
type AgentAuthorizeParams struct {
	Target           string
	ClientCertURI    string
	ClientCertSerial string
}

// AgentAuthorize is the response structure for Connect authorization.
type AgentAuthorize struct {
	Authorized bool
	Reason     string
}

// ConnectProxyConfig is the response structure for agent-local proxy
// configuration.
type ConnectProxyConfig struct {
	ProxyServiceID    string
	TargetServiceID   string
	TargetServiceName string
	ContentHash       string
	Config            map[string]interface{} `bexpr:"-"`
	Upstreams         []Upstream
}

// Upstream is the response structure for a proxy upstream configuration.
type Upstream struct {
	DestinationType      UpstreamDestType `json:",omitempty"`
	DestinationPartition string           `json:",omitempty"`
	DestinationNamespace string           `json:",omitempty"`
	DestinationPeer      string           `json:",omitempty"`
	DestinationName      string
	Datacenter           string                 `json:",omitempty"`
	LocalBindAddress     string                 `json:",omitempty"`
	LocalBindPort        int                    `json:",omitempty"`
	LocalBindSocketPath  string                 `json:",omitempty"`
	LocalBindSocketMode  string                 `json:",omitempty"`
	Config               map[string]interface{} `json:",omitempty" bexpr:"-"`
	MeshGateway          MeshGatewayConfig      `json:",omitempty"`
	CentrallyConfigured  bool                   `json:",omitempty" bexpr:"-"`
}

// Agent can be used to query the Agent endpoints
type Agent struct {
	c *Client

	// cache the node name
	nodeName string
}

// Agent returns a handle to the agent endpoints
func (c *Client) Agent() *Agent {
	return &Agent{c: c}
}

// Self is used to query the agent we are speaking to for
// information about itself
func (a *Agent) Self() (map[string]map[string]interface{}, error) {
	r := a.c.newRequest("GET", "/v1/agent/self")
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	var out map[string]map[string]interface{}
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Host is used to retrieve information about the host the
// agent is running on such as CPU, memory, and disk. Requires
// a operator:read ACL token.
func (a *Agent) Host() (map[string]interface{}, error) {
	r := a.c.newRequest("GET", "/v1/agent/host")
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	var out map[string]interface{}
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Version is used to retrieve information about the running Consul version and build.
func (a *Agent) Version() (map[string]interface{}, error) {
	r := a.c.newRequest("GET", "/v1/agent/version")
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	var out map[string]interface{}
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Metrics is used to query the agent we are speaking to for
// its current internal metric data
func (a *Agent) Metrics() (*MetricsInfo, error) {
	r := a.c.newRequest("GET", "/v1/agent/metrics")
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	var out *MetricsInfo
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// MetricsStream returns an io.ReadCloser which will emit a stream of metrics
// until the context is cancelled. The metrics are json encoded.
// The caller is responsible for closing the returned io.ReadCloser.
func (a *Agent) MetricsStream(ctx context.Context) (io.ReadCloser, error) {
	r := a.c.newRequest("GET", "/v1/agent/metrics/stream")
	r.ctx = ctx
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	return resp.Body, nil
}

// Reload triggers a configuration reload for the agent we are connected to.
func (a *Agent) Reload() error {
	r := a.c.newRequest("PUT", "/v1/agent/reload")
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// NodeName is used to get the node name of the agent
func (a *Agent) NodeName() (string, error) {
	if a.nodeName != "" {
		return a.nodeName, nil
	}
	info, err := a.Self()
	if err != nil {
		return "", err
	}
	name := info["Config"]["NodeName"].(string)
	a.nodeName = name
	return name, nil
}

// Checks returns the locally registered checks
func (a *Agent) Checks() (map[string]*AgentCheck, error) {
	return a.ChecksWithFilter("")
}

// ChecksWithFilter returns a subset of the locally registered checks that match
// the given filter expression
func (a *Agent) ChecksWithFilter(filter string) (map[string]*AgentCheck, error) {
	return a.ChecksWithFilterOpts(filter, nil)
}

// ChecksWithFilterOpts returns a subset of the locally registered checks that match
// the given filter expression and QueryOptions.
func (a *Agent) ChecksWithFilterOpts(filter string, q *QueryOptions) (map[string]*AgentCheck, error) {
	r := a.c.newRequest("GET", "/v1/agent/checks")
	r.setQueryOptions(q)
	r.filterQuery(filter)
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	var out map[string]*AgentCheck
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// Services returns the locally registered services
func (a *Agent) Services() (map[string]*AgentService, error) {
	return a.ServicesWithFilter("")
}

// ServicesWithFilter returns a subset of the locally registered services that match
// the given filter expression
func (a *Agent) ServicesWithFilter(filter string) (map[string]*AgentService, error) {
	return a.ServicesWithFilterOpts(filter, nil)
}

// ServicesWithFilterOpts returns a subset of the locally registered services that match
// the given filter expression and QueryOptions.
func (a *Agent) ServicesWithFilterOpts(filter string, q *QueryOptions) (map[string]*AgentService, error) {
	r := a.c.newRequest("GET", "/v1/agent/services")
	r.setQueryOptions(q)
	r.filterQuery(filter)
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	var out map[string]*AgentService
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}

	return out, nil
}

// AgentHealthServiceByID returns for a given serviceID: the aggregated health status, the service definition or an error if any
// - If the service is not found, will return status (critical, nil, nil)
// - If the service is found, will return (critical|passing|warning), AgentServiceChecksInfo, nil)
// - In all other cases, will return an error
func (a *Agent) AgentHealthServiceByID(serviceID string) (string, *AgentServiceChecksInfo, error) {
	return a.AgentHealthServiceByIDOpts(serviceID, nil)
}

func (a *Agent) AgentHealthServiceByIDOpts(serviceID string, q *QueryOptions) (string, *AgentServiceChecksInfo, error) {
	path := fmt.Sprintf("/v1/agent/health/service/id/%v", serviceID)
	r := a.c.newRequest("GET", path)
	r.setQueryOptions(q)
	r.params.Add("format", "json")
	r.header.Set("Accept", "application/json")
	// not a lot of value in wrapping the doRequest call in a requireHttpCodes call
	// we manipulate the resp body  and the require calls "swallow" the content on err
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return "", nil, err
	}
	defer closeResponseBody(resp)
	// Service not Found
	if resp.StatusCode == http.StatusNotFound {
		return HealthCritical, nil, nil
	}
	var out *AgentServiceChecksInfo
	if err := decodeBody(resp, &out); err != nil {
		return HealthCritical, out, err
	}
	switch resp.StatusCode {
	case http.StatusOK:
		return HealthPassing, out, nil
	case http.StatusTooManyRequests:
		return HealthWarning, out, nil
	case http.StatusServiceUnavailable:
		return HealthCritical, out, nil
	}
	return HealthCritical, out, fmt.Errorf("Unexpected Error Code %v for %s", resp.StatusCode, path)
}

// AgentHealthServiceByName returns for a given service name: the aggregated health status for all services
// having the specified name.
// - If no service is not found, will return status (critical, [], nil)
// - If the service is found, will return (critical|passing|warning), []api.AgentServiceChecksInfo, nil)
// - In all other cases, will return an error
func (a *Agent) AgentHealthServiceByName(service string) (string, []AgentServiceChecksInfo, error) {
	return a.AgentHealthServiceByNameOpts(service, nil)
}

func (a *Agent) AgentHealthServiceByNameOpts(service string, q *QueryOptions) (string, []AgentServiceChecksInfo, error) {
	path := fmt.Sprintf("/v1/agent/health/service/name/%v", service)
	r := a.c.newRequest("GET", path)
	r.setQueryOptions(q)
	r.params.Add("format", "json")
	r.header.Set("Accept", "application/json")
	// not a lot of value in wrapping the doRequest call in a requireHttpCodes call
	// we manipulate the resp body  and the require calls "swallow" the content on err
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return "", nil, err
	}
	defer closeResponseBody(resp)
	// Service not Found
	if resp.StatusCode == http.StatusNotFound {
		return HealthCritical, nil, nil
	}
	var out []AgentServiceChecksInfo
	if err := decodeBody(resp, &out); err != nil {
		return HealthCritical, out, err
	}
	switch resp.StatusCode {
	case http.StatusOK:
		return HealthPassing, out, nil
	case http.StatusTooManyRequests:
		return HealthWarning, out, nil
	case http.StatusServiceUnavailable:
		return HealthCritical, out, nil
	}
	return HealthCritical, out, fmt.Errorf("Unexpected Error Code %v for %s", resp.StatusCode, path)
}

// Service returns a locally registered service instance and allows for
// hash-based blocking.
//
// Note that this uses an unconventional blocking mechanism since it's
// agent-local state. That means there is no persistent raft index so we block
// based on object hash instead.
func (a *Agent) Service(serviceID string, q *QueryOptions) (*AgentService, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/agent/service/"+serviceID)
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
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

	var out *AgentService
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return out, qm, nil
}

// Members returns the known gossip members. The WAN
// flag can be used to query a server for WAN members.
func (a *Agent) Members(wan bool) ([]*AgentMember, error) {
	r := a.c.newRequest("GET", "/v1/agent/members")
	if wan {
		r.params.Set("wan", "1")
	}
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	var out []*AgentMember
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// MembersOpts returns the known gossip members and can be passed
// additional options for WAN/segment filtering.
func (a *Agent) MembersOpts(opts MembersOpts) ([]*AgentMember, error) {
	r := a.c.newRequest("GET", "/v1/agent/members")
	r.params.Set("segment", opts.Segment)
	if opts.WAN {
		r.params.Set("wan", "1")
	}

	if opts.Filter != "" {
		r.params.Set("filter", opts.Filter)
	}

	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	var out []*AgentMember
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ServiceRegister is used to register a new service with
// the local agent
func (a *Agent) ServiceRegister(service *AgentServiceRegistration) error {
	opts := ServiceRegisterOpts{
		ReplaceExistingChecks: false,
	}

	return a.serviceRegister(service, opts)
}

// ServiceRegister is used to register a new service with
// the local agent and can be passed additional options.
func (a *Agent) ServiceRegisterOpts(service *AgentServiceRegistration, opts ServiceRegisterOpts) error {
	return a.serviceRegister(service, opts)
}

func (a *Agent) serviceRegister(service *AgentServiceRegistration, opts ServiceRegisterOpts) error {
	r := a.c.newRequest("PUT", "/v1/agent/service/register")
	r.obj = service
	r.ctx = opts.ctx
	if opts.ReplaceExistingChecks {
		r.params.Set("replace-existing-checks", "true")
	}
	if opts.Token != "" {
		r.header.Set("X-Consul-Token", opts.Token)
	}
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// ServiceDeregister is used to deregister a service with
// the local agent
func (a *Agent) ServiceDeregister(serviceID string) error {
	r := a.c.newRequest("PUT", "/v1/agent/service/deregister/"+serviceID)
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// ServiceDeregisterOpts is used to deregister a service with
// the local agent with QueryOptions.
func (a *Agent) ServiceDeregisterOpts(serviceID string, q *QueryOptions) error {
	r := a.c.newRequest("PUT", "/v1/agent/service/deregister/"+serviceID)
	r.setQueryOptions(q)
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// PassTTL is used to set a TTL check to the passing state.
//
// DEPRECATION NOTICE: This interface is deprecated in favor of UpdateTTL().
// The client interface will be removed in 0.8 or changed to use
// UpdateTTL()'s endpoint and the server endpoints will be removed in 0.9.
func (a *Agent) PassTTL(checkID, note string) error {
	return a.updateTTL(checkID, note, "pass")
}

// WarnTTL is used to set a TTL check to the warning state.
//
// DEPRECATION NOTICE: This interface is deprecated in favor of UpdateTTL().
// The client interface will be removed in 0.8 or changed to use
// UpdateTTL()'s endpoint and the server endpoints will be removed in 0.9.
func (a *Agent) WarnTTL(checkID, note string) error {
	return a.updateTTL(checkID, note, "warn")
}

// FailTTL is used to set a TTL check to the failing state.
//
// DEPRECATION NOTICE: This interface is deprecated in favor of UpdateTTL().
// The client interface will be removed in 0.8 or changed to use
// UpdateTTL()'s endpoint and the server endpoints will be removed in 0.9.
func (a *Agent) FailTTL(checkID, note string) error {
	return a.updateTTL(checkID, note, "fail")
}

// updateTTL is used to update the TTL of a check. This is the internal
// method that uses the old API that's present in Consul versions prior to
// 0.6.4. Since Consul didn't have an analogous "update" API before it seemed
// ok to break this (former) UpdateTTL in favor of the new UpdateTTL below,
// but keep the old Pass/Warn/Fail methods using the old API under the hood.
//
// DEPRECATION NOTICE: This interface is deprecated in favor of UpdateTTL().
// The client interface will be removed in 0.8 and the server endpoints will
// be removed in 0.9.
func (a *Agent) updateTTL(checkID, note, status string) error {
	switch status {
	case "pass":
	case "warn":
	case "fail":
	default:
		return fmt.Errorf("Invalid status: %s", status)
	}
	endpoint := fmt.Sprintf("/v1/agent/check/%s/%s", status, checkID)
	r := a.c.newRequest("PUT", endpoint)
	r.params.Set("note", note)
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// checkUpdate is the payload for a PUT for a check update.
type checkUpdate struct {
	// Status is one of the api.Health* states: HealthPassing
	// ("passing"), HealthWarning ("warning"), or HealthCritical
	// ("critical").
	Status string

	// Output is the information to post to the UI for operators as the
	// output of the process that decided to hit the TTL check. This is
	// different from the note field that's associated with the check
	// itself.
	Output string
}

// UpdateTTL is used to update the TTL of a check. This uses the newer API
// that was introduced in Consul 0.6.4 and later. We translate the old status
// strings for compatibility (though a newer version of Consul will still be
// required to use this API).
func (a *Agent) UpdateTTL(checkID, output, status string) error {
	return a.UpdateTTLOpts(checkID, output, status, nil)
}

func (a *Agent) UpdateTTLOpts(checkID, output, status string, q *QueryOptions) error {
	switch status {
	case "pass", HealthPassing:
		status = HealthPassing
	case "warn", HealthWarning:
		status = HealthWarning
	case "fail", HealthCritical:
		status = HealthCritical
	default:
		return fmt.Errorf("Invalid status: %s", status)
	}

	endpoint := fmt.Sprintf("/v1/agent/check/update/%s", checkID)
	r := a.c.newRequest("PUT", endpoint)
	r.setQueryOptions(q)
	r.obj = &checkUpdate{
		Status: status,
		Output: output,
	}

	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// CheckRegister is used to register a new check with
// the local agent
func (a *Agent) CheckRegister(check *AgentCheckRegistration) error {
	return a.CheckRegisterOpts(check, nil)
}

// CheckRegisterOpts is used to register a new check with
// the local agent using query options
func (a *Agent) CheckRegisterOpts(check *AgentCheckRegistration, q *QueryOptions) error {
	r := a.c.newRequest("PUT", "/v1/agent/check/register")
	r.setQueryOptions(q)
	r.obj = check
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// CheckDeregister is used to deregister a check with
// the local agent
func (a *Agent) CheckDeregister(checkID string) error {
	return a.CheckDeregisterOpts(checkID, nil)
}

// CheckDeregisterOpts is used to deregister a check with
// the local agent using query options
func (a *Agent) CheckDeregisterOpts(checkID string, q *QueryOptions) error {
	r := a.c.newRequest("PUT", "/v1/agent/check/deregister/"+checkID)
	r.setQueryOptions(q)
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// Join is used to instruct the agent to attempt a join to
// another cluster member
func (a *Agent) Join(addr string, wan bool) error {
	r := a.c.newRequest("PUT", "/v1/agent/join/"+addr)
	if wan {
		r.params.Set("wan", "1")
	}
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// Leave is used to have the agent gracefully leave the cluster and shutdown
func (a *Agent) Leave() error {
	r := a.c.newRequest("PUT", "/v1/agent/leave")
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

type ForceLeaveOpts struct {
	// Prune indicates if we should remove a failed agent from the list of
	// members in addition to ejecting it.
	Prune bool

	// WAN indicates that the request should exclusively target the WAN pool.
	WAN bool
}

// ForceLeave is used to have the agent eject a failed node
func (a *Agent) ForceLeave(node string) error {
	return a.ForceLeaveOpts(node, ForceLeaveOpts{})
}

// ForceLeavePrune is used to have an a failed agent removed
// from the list of members
func (a *Agent) ForceLeavePrune(node string) error {
	return a.ForceLeaveOpts(node, ForceLeaveOpts{Prune: true})
}

// ForceLeaveOpts is used to have the agent eject a failed node or remove it
// completely from the list of members.
//
// DEPRECATED - Use ForceLeaveOptions instead.
func (a *Agent) ForceLeaveOpts(node string, opts ForceLeaveOpts) error {
	return a.ForceLeaveOptions(node, opts, nil)
}

// ForceLeaveOptions is used to have the agent eject a failed node or remove it
// completely from the list of members. Allows usage of QueryOptions on-top of ForceLeaveOpts
func (a *Agent) ForceLeaveOptions(node string, opts ForceLeaveOpts, q *QueryOptions) error {
	r := a.c.newRequest("PUT", "/v1/agent/force-leave/"+node)
	r.setQueryOptions(q)
	if opts.Prune {
		r.params.Set("prune", "1")
	}
	if opts.WAN {
		r.params.Set("wan", "1")
	}
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// ConnectAuthorize is used to authorize an incoming connection
// to a natively integrated Connect service.
func (a *Agent) ConnectAuthorize(auth *AgentAuthorizeParams) (*AgentAuthorize, error) {
	r := a.c.newRequest("POST", "/v1/agent/connect/authorize")
	r.obj = auth
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	var out AgentAuthorize
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ConnectCARoots returns the list of roots.
func (a *Agent) ConnectCARoots(q *QueryOptions) (*CARootList, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/agent/connect/ca/roots")
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
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

	var out CARootList
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, qm, nil
}

// ConnectCALeaf gets the leaf certificate for the given service ID.
func (a *Agent) ConnectCALeaf(serviceID string, q *QueryOptions) (*LeafCert, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/agent/connect/ca/leaf/"+serviceID)
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
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

	var out LeafCert
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, qm, nil
}

// EnableServiceMaintenance toggles service maintenance mode on
// for the given service ID.
func (a *Agent) EnableServiceMaintenance(serviceID, reason string) error {
	return a.EnableServiceMaintenanceOpts(serviceID, reason, nil)
}

func (a *Agent) EnableServiceMaintenanceOpts(serviceID, reason string, q *QueryOptions) error {
	r := a.c.newRequest("PUT", "/v1/agent/service/maintenance/"+serviceID)
	r.setQueryOptions(q)
	r.params.Set("enable", "true")
	r.params.Set("reason", reason)
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// DisableServiceMaintenance toggles service maintenance mode off
// for the given service ID.
func (a *Agent) DisableServiceMaintenance(serviceID string) error {
	return a.DisableServiceMaintenanceOpts(serviceID, nil)
}

func (a *Agent) DisableServiceMaintenanceOpts(serviceID string, q *QueryOptions) error {
	r := a.c.newRequest("PUT", "/v1/agent/service/maintenance/"+serviceID)
	r.setQueryOptions(q)
	r.params.Set("enable", "false")
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// EnableNodeMaintenance toggles node maintenance mode on for the
// agent we are connected to.
func (a *Agent) EnableNodeMaintenance(reason string) error {
	r := a.c.newRequest("PUT", "/v1/agent/maintenance")
	r.params.Set("enable", "true")
	r.params.Set("reason", reason)
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// DisableNodeMaintenance toggles node maintenance mode off for the
// agent we are connected to.
func (a *Agent) DisableNodeMaintenance() error {
	r := a.c.newRequest("PUT", "/v1/agent/maintenance")
	r.params.Set("enable", "false")
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return err
	}
	return nil
}

// Monitor returns a channel which will receive streaming logs from the agent
// Providing a non-nil stopCh can be used to close the connection and stop the
// log stream. An empty string will be sent down the given channel when there's
// nothing left to stream, after which the caller should close the stopCh.
func (a *Agent) Monitor(loglevel string, stopCh <-chan struct{}, q *QueryOptions) (chan string, error) {
	return a.monitor(loglevel, false, stopCh, q)
}

// MonitorJSON is like Monitor except it returns logs in JSON format.
func (a *Agent) MonitorJSON(loglevel string, stopCh <-chan struct{}, q *QueryOptions) (chan string, error) {
	return a.monitor(loglevel, true, stopCh, q)
}

func (a *Agent) monitor(loglevel string, logJSON bool, stopCh <-chan struct{}, q *QueryOptions) (chan string, error) {
	r := a.c.newRequest("GET", "/v1/agent/monitor")
	r.setQueryOptions(q)
	if loglevel != "" {
		r.params.Add("loglevel", loglevel)
	}
	if logJSON {
		r.params.Set("logjson", "true")
	}
	_, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	logCh := make(chan string, 64)
	go func() {
		defer closeResponseBody(resp)
		scanner := bufio.NewScanner(resp.Body)
		for {
			select {
			case <-stopCh:
				close(logCh)
				return
			default:
			}
			if scanner.Scan() {
				// An empty string signals to the caller that
				// the scan is done, so make sure we only emit
				// that when the scanner says it's done, not if
				// we happen to ingest an empty line.
				if text := scanner.Text(); text != "" {
					logCh <- text
				} else {
					logCh <- " "
				}
			} else {
				logCh <- ""
			}
		}
	}()
	return logCh, nil
}

// UpdateACLToken updates the agent's "acl_token". See updateToken for more
// details. Deprecated in Consul 1.4.
//
// DEPRECATED (ACL-Legacy-Compat) - Prefer UpdateDefaultACLToken for v1.4.3 and above
func (a *Agent) UpdateACLToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return nil, fmt.Errorf("Legacy ACL Tokens were deprecated in Consul 1.4")
}

// UpdateACLAgentToken updates the agent's "acl_agent_token". See updateToken
// for more details. Deprecated in Consul 1.4.
//
// DEPRECATED (ACL-Legacy-Compat) - Prefer UpdateAgentACLToken for v1.4.3 and above
func (a *Agent) UpdateACLAgentToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return nil, fmt.Errorf("Legacy ACL Tokens were deprecated in Consul 1.4")
}

// UpdateACLAgentMasterToken updates the agent's "acl_agent_master_token". See
// updateToken for more details. Deprecated in Consul 1.4.
//
// DEPRECATED (ACL-Legacy-Compat) - Prefer UpdateAgentMasterACLToken for v1.4.3 and above
func (a *Agent) UpdateACLAgentMasterToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return nil, fmt.Errorf("Legacy ACL Tokens were deprecated in Consul 1.4")
}

// UpdateACLReplicationToken updates the agent's "acl_replication_token". See
// updateToken for more details. Deprecated in Consul 1.4.
//
// DEPRECATED (ACL-Legacy-Compat) - Prefer UpdateReplicationACLToken for v1.4.3 and above
func (a *Agent) UpdateACLReplicationToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return nil, fmt.Errorf("Legacy ACL Tokens were deprecated in Consul 1.4")
}

// UpdateDefaultACLToken updates the agent's "default" token. See updateToken
// for more details
func (a *Agent) UpdateDefaultACLToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return a.updateTokenFallback(token, q, "default", "acl_token")
}

// UpdateAgentACLToken updates the agent's "agent" token. See updateToken
// for more details
func (a *Agent) UpdateAgentACLToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return a.updateTokenFallback(token, q, "agent", "acl_agent_token")
}

// UpdateAgentRecoveryACLToken updates the agent's "agent_recovery" token. See updateToken
// for more details.
func (a *Agent) UpdateAgentRecoveryACLToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return a.updateTokenFallback(token, q, "agent_recovery", "agent_master", "acl_agent_master_token")
}

// UpdateAgentMasterACLToken updates the agent's "agent_master" token. See updateToken
// for more details.
//
// DEPRECATED - Prefer UpdateAgentRecoveryACLToken for v1.11 and above.
func (a *Agent) UpdateAgentMasterACLToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return a.updateTokenFallback(token, q, "agent_master", "acl_agent_master_token")
}

// UpdateReplicationACLToken updates the agent's "replication" token. See updateToken
// for more details
func (a *Agent) UpdateReplicationACLToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return a.updateTokenFallback(token, q, "replication", "acl_replication_token")
}

// UpdateConfigFileRegistrationToken updates the agent's "replication" token. See updateToken
// for more details
func (a *Agent) UpdateConfigFileRegistrationToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return a.updateToken("config_file_service_registration", token, q)
}

func (a *Agent) UpdateDNSToken(token string, q *WriteOptions) (*WriteMeta, error) {
	return a.updateToken("dns", token, q)
}

// updateToken can be used to update one of an agent's ACL tokens after the agent has
// started. The tokens are may not be persisted, so will need to be updated again if
// the agent is restarted unless the agent is configured to persist them.
func (a *Agent) updateToken(target, token string, q *WriteOptions) (*WriteMeta, error) {
	meta, _, err := a.updateTokenOnce(target, token, q)
	return meta, err
}

func (a *Agent) updateTokenFallback(token string, q *WriteOptions, targets ...string) (*WriteMeta, error) {
	if len(targets) == 0 {
		panic("targets must not be empty")
	}

	var (
		meta *WriteMeta
		err  error
	)
	for _, target := range targets {
		var status int
		meta, status, err = a.updateTokenOnce(target, token, q)
		if err == nil && status != http.StatusNotFound {
			return meta, err
		}
	}
	return meta, err
}

func (a *Agent) updateTokenOnce(target, token string, q *WriteOptions) (*WriteMeta, int, error) {
	r := a.c.newRequest("PUT", fmt.Sprintf("/v1/agent/token/%s", target))
	r.setWriteOptions(q)
	r.obj = &AgentToken{Token: token}

	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, 500, err
	}
	defer closeResponseBody(resp)
	wm := &WriteMeta{RequestTime: rtt}
	if err := requireOK(resp); err != nil {
		var statusE StatusError
		if errors.As(err, &statusE) {
			return wm, statusE.Code, statusE
		}
		return nil, 0, err
	}
	return wm, resp.StatusCode, nil
}
