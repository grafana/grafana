// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/mitchellh/mapstructure"
)

const (
	ServiceDefaults    string = "service-defaults"
	ProxyDefaults      string = "proxy-defaults"
	ServiceRouter      string = "service-router"
	ServiceSplitter    string = "service-splitter"
	ServiceResolver    string = "service-resolver"
	IngressGateway     string = "ingress-gateway"
	TerminatingGateway string = "terminating-gateway"
	ServiceIntentions  string = "service-intentions"
	MeshConfig         string = "mesh"
	ExportedServices   string = "exported-services"
	SamenessGroup      string = "sameness-group"
	RateLimitIPConfig  string = "control-plane-request-limit"

	ProxyConfigGlobal     string = "global"
	MeshConfigMesh        string = "mesh"
	APIGateway            string = "api-gateway"
	TCPRoute              string = "tcp-route"
	FileSystemCertificate string = "file-system-certificate"
	InlineCertificate     string = "inline-certificate"
	HTTPRoute             string = "http-route"
	JWTProvider           string = "jwt-provider"
)

const (
	BuiltinAWSLambdaExtension         string = "builtin/aws/lambda"
	BuiltinExtAuthzExtension          string = "builtin/ext-authz"
	BuiltinLuaExtension               string = "builtin/lua"
	BuiltinOTELAccessLoggingExtension string = "builtin/otel-access-logging"
	BuiltinPropertyOverrideExtension  string = "builtin/property-override"
	BuiltinWasmExtension              string = "builtin/wasm"
	// BuiltinValidateExtension should not be exposed directly or accepted as a valid configured
	// extension type, as it is only used indirectly via troubleshooting tools. It is included here
	// for common reference alongside other builtin extensions.
	BuiltinValidateExtension string = "builtin/proxy/validate"
)

type ConfigEntry interface {
	GetKind() string
	GetName() string
	GetPartition() string
	GetNamespace() string
	GetMeta() map[string]string
	GetCreateIndex() uint64
	GetModifyIndex() uint64
}

type MeshGatewayMode string

const (
	// MeshGatewayModeDefault represents no specific mode and should
	// be used to indicate that a different layer of the configuration
	// chain should take precedence
	MeshGatewayModeDefault MeshGatewayMode = ""

	// MeshGatewayModeNone represents that the Upstream Connect connections
	// should be direct and not flow through a mesh gateway.
	MeshGatewayModeNone MeshGatewayMode = "none"

	// MeshGatewayModeLocal represents that the Upstream Connect connections
	// should be made to a mesh gateway in the local datacenter.
	MeshGatewayModeLocal MeshGatewayMode = "local"

	// MeshGatewayModeRemote represents that the Upstream Connect connections
	// should be made to a mesh gateway in a remote datacenter.
	MeshGatewayModeRemote MeshGatewayMode = "remote"
)

// MeshGatewayConfig controls how Mesh Gateways are used for upstream Connect
// services
type MeshGatewayConfig struct {
	// Mode is the mode that should be used for the upstream connection.
	Mode MeshGatewayMode `json:",omitempty"`
}

type ProxyMode string

const (
	// ProxyModeDefault represents no specific mode and should
	// be used to indicate that a different layer of the configuration
	// chain should take precedence
	ProxyModeDefault ProxyMode = ""

	// ProxyModeTransparent represents that inbound and outbound application
	// traffic is being captured and redirected through the proxy.
	ProxyModeTransparent ProxyMode = "transparent"

	// ProxyModeDirect represents that the proxy's listeners must be dialed directly
	// by the local application and other proxies.
	ProxyModeDirect ProxyMode = "direct"
)

type TransparentProxyConfig struct {
	// The port of the listener where outbound application traffic is being redirected to.
	OutboundListenerPort int `json:",omitempty" alias:"outbound_listener_port"`

	// DialedDirectly indicates whether transparent proxies can dial this proxy instance directly.
	// The discovery chain is not considered when dialing a service instance directly.
	// This setting is useful when addressing stateful services, such as a database cluster with a leader node.
	DialedDirectly bool `json:",omitempty" alias:"dialed_directly"`
}

type MutualTLSMode string

const (
	// MutualTLSModeDefault represents no specific mode and should
	// be used to indicate that a different layer of the configuration
	// chain should take precedence.
	MutualTLSModeDefault MutualTLSMode = ""

	// MutualTLSModeStrict requires mTLS for incoming traffic.
	MutualTLSModeStrict MutualTLSMode = "strict"

	// MutualTLSModePermissive allows incoming non-mTLS traffic.
	MutualTLSModePermissive MutualTLSMode = "permissive"
)

// ExposeConfig describes HTTP paths to expose through Envoy outside of Connect.
// Users can expose individual paths and/or all HTTP/GRPC paths for checks.
type ExposeConfig struct {
	// Checks defines whether paths associated with Consul checks will be exposed.
	// This flag triggers exposing all HTTP and GRPC check paths registered for the service.
	Checks bool `json:",omitempty"`

	// Paths is the list of paths exposed through the proxy.
	Paths []ExposePath `json:",omitempty"`
}

// EnvoyExtension has configuration for an extension that patches Envoy resources.
type EnvoyExtension struct {
	Name          string
	Required      bool
	Arguments     map[string]interface{} `bexpr:"-"`
	ConsulVersion string
	EnvoyVersion  string
}

type ExposePath struct {
	// ListenerPort defines the port of the proxy's listener for exposed paths.
	ListenerPort int `json:",omitempty" alias:"listener_port"`

	// Path is the path to expose through the proxy, ie. "/metrics."
	Path string `json:",omitempty"`

	// LocalPathPort is the port that the service is listening on for the given path.
	LocalPathPort int `json:",omitempty" alias:"local_path_port"`

	// Protocol describes the upstream's service protocol.
	// Valid values are "http" and "http2", defaults to "http"
	Protocol string `json:",omitempty"`

	// ParsedFromCheck is set if this path was parsed from a registered check
	ParsedFromCheck bool
}

type LogSinkType string

const (
	DefaultLogSinkType LogSinkType = ""
	FileLogSinkType    LogSinkType = "file"
	StdErrLogSinkType  LogSinkType = "stderr"
	StdOutLogSinkType  LogSinkType = "stdout"
)

// AccessLogsConfig contains the associated default settings for all Envoy instances within the datacenter or partition
type AccessLogsConfig struct {
	// Enabled turns off all access logging
	Enabled bool `json:",omitempty" alias:"enabled"`

	// DisableListenerLogs turns off just listener logs for connections rejected by Envoy because they don't
	// have a matching listener filter.
	DisableListenerLogs bool `json:",omitempty" alias:"disable_listener_logs"`

	// Type selects the output for logs: "file", "stderr". "stdout"
	Type LogSinkType `json:",omitempty" alias:"type"`

	// Path is the output file to write logs
	Path string `json:",omitempty" alias:"path"`

	// The presence of one format string or the other implies the access log string encoding.
	// Defining Both is invalid.
	JSONFormat string `json:",omitempty" alias:"json_format"`
	TextFormat string `json:",omitempty" alias:"text_format"`
}

type UpstreamConfiguration struct {
	// Overrides is a slice of per-service configuration. The name field is
	// required.
	Overrides []*UpstreamConfig `json:",omitempty"`

	// Defaults contains default configuration for all upstreams of a given
	// service. The name field must be empty.
	Defaults *UpstreamConfig `json:",omitempty"`
}

type UpstreamConfig struct {
	// Name is only accepted within service-defaults.upstreamConfig.overrides .
	Name string `json:",omitempty"`

	// Partition is only accepted within service-defaults.upstreamConfig.overrides .
	Partition string `json:",omitempty"`

	// Namespace is only accepted within service-defaults.upstreamConfig.overrides .
	Namespace string `json:",omitempty"`

	// Peer is only accepted within service-defaults.upstreamConfig.overrides .
	Peer string `json:",omitempty"`

	// EnvoyListenerJSON is a complete override ("escape hatch") for the upstream's
	// listener.
	//
	// Note: This escape hatch is NOT compatible with the discovery chain and
	// will be ignored if a discovery chain is active.
	EnvoyListenerJSON string `json:",omitempty" alias:"envoy_listener_json"`

	// EnvoyClusterJSON is a complete override ("escape hatch") for the upstream's
	// cluster. The Connect client TLS certificate and context will be injected
	// overriding any TLS settings present.
	//
	// Note: This escape hatch is NOT compatible with the discovery chain and
	// will be ignored if a discovery chain is active.
	EnvoyClusterJSON string `json:",omitempty" alias:"envoy_cluster_json"`

	// Protocol describes the upstream's service protocol. Valid values are "tcp",
	// "http" and "grpc". Anything else is treated as tcp. The enables protocol
	// aware features like per-request metrics and connection pooling, tracing,
	// routing etc.
	Protocol string `json:",omitempty"`

	// ConnectTimeoutMs is the number of milliseconds to timeout making a new
	// connection to this upstream. Defaults to 5000 (5 seconds) if not set.
	ConnectTimeoutMs int `json:",omitempty" alias:"connect_timeout_ms"`

	// Limits are the set of limits that are applied to the proxy for a specific upstream of a
	// service instance.
	Limits *UpstreamLimits `json:",omitempty"`

	// PassiveHealthCheck configuration determines how upstream proxy instances will
	// be monitored for removal from the load balancing pool.
	PassiveHealthCheck *PassiveHealthCheck `json:",omitempty" alias:"passive_health_check"`

	// MeshGatewayConfig controls how Mesh Gateways are configured and used
	MeshGateway MeshGatewayConfig `json:",omitempty" alias:"mesh_gateway" `

	// BalanceOutboundConnections indicates that the proxy should attempt to evenly distribute
	// outbound connections across worker threads. Only used by envoy proxies.
	BalanceOutboundConnections string `json:",omitempty" alias:"balance_outbound_connections"`
}

// DestinationConfig represents a virtual service, i.e. one that is external to Consul
type DestinationConfig struct {
	// Addresses of the endpoint; hostname or IP
	Addresses []string `json:",omitempty"`

	// Port allowed within this endpoint
	Port int `json:",omitempty"`
}

type PassiveHealthCheck struct {
	// Interval between health check analysis sweeps. Each sweep may remove
	// hosts or return hosts to the pool.
	Interval time.Duration `json:",omitempty"`

	// MaxFailures is the count of consecutive failures that results in a host
	// being removed from the pool.
	MaxFailures uint32 `alias:"max_failures"`

	// EnforcingConsecutive5xx is the % chance that a host will be actually ejected
	// when an outlier status is detected through consecutive 5xx.
	// This setting can be used to disable ejection or to ramp it up slowly.
	EnforcingConsecutive5xx *uint32 `json:",omitempty" alias:"enforcing_consecutive_5xx"`

	// The maximum % of an upstream cluster that can be ejected due to outlier detection.
	// Defaults to 10% but will eject at least one host regardless of the value.
	MaxEjectionPercent *uint32 `json:",omitempty" alias:"max_ejection_percent"`

	// The base time that a host is ejected for. The real time is equal to the base time
	// multiplied by the number of times the host has been ejected and is capped by
	// max_ejection_time (Default 300s). Defaults to 30000ms or 30s.
	BaseEjectionTime *time.Duration `json:",omitempty" alias:"base_ejection_time"`
}

// UpstreamLimits describes the limits that are associated with a specific
// upstream of a service instance.
type UpstreamLimits struct {
	// MaxConnections is the maximum number of connections the local proxy can
	// make to the upstream service.
	MaxConnections *int `alias:"max_connections"`

	// MaxPendingRequests is the maximum number of requests that will be queued
	// waiting for an available connection. This is mostly applicable to HTTP/1.1
	// clusters since all HTTP/2 requests are streamed over a single
	// connection.
	MaxPendingRequests *int `alias:"max_pending_requests"`

	// MaxConcurrentRequests is the maximum number of in-flight requests that will be allowed
	// to the upstream cluster at a point in time. This is mostly applicable to HTTP/2
	// clusters since all HTTP/1.1 requests are limited by MaxConnections.
	MaxConcurrentRequests *int `alias:"max_concurrent_requests"`
}

// RateLimits is rate limiting configuration that is applied to
// inbound traffic for a service.
// Rate limiting is a Consul enterprise feature.
type RateLimits struct {
	InstanceLevel InstanceLevelRateLimits `alias:"instance_level"`
}

// InstanceLevelRateLimits represents rate limit configuration
// that are applied per service instance.
type InstanceLevelRateLimits struct {
	// RequestsPerSecond is the average number of requests per second that can be
	// made without being throttled. This field is required if RequestsMaxBurst
	// is set. The allowed number of requests may exceed RequestsPerSecond up to
	// the value specified in RequestsMaxBurst.
	//
	// Internally, this is the refill rate of the token bucket used for rate limiting.
	RequestsPerSecond int `alias:"requests_per_second"`

	// RequestsMaxBurst is the maximum number of requests that can be sent
	// in a burst. Should be equal to or greater than RequestsPerSecond.
	// If unset, defaults to RequestsPerSecond.
	//
	// Internally, this is the maximum size of the token bucket used for rate limiting.
	RequestsMaxBurst int `alias:"requests_max_burst"`

	// Routes is a list of rate limits applied to specific routes.
	// For a given request, the first matching route will be applied, if any
	// Overrides any top-level configuration.
	Routes []InstanceLevelRouteRateLimits
}

// InstanceLevelRouteRateLimits represents rate limit configuration
// applied to a route matching one of PathExact/PathPrefix/PathRegex.
type InstanceLevelRouteRateLimits struct {
	PathExact  string `alias:"path_exact"`
	PathPrefix string `alias:"path_prefix"`
	PathRegex  string `alias:"path_regex"`

	RequestsPerSecond int `alias:"requests_per_second"`
	RequestsMaxBurst  int `alias:"requests_max_burst"`
}

type ServiceConfigEntry struct {
	Kind                      string
	Name                      string
	Partition                 string                  `json:",omitempty"`
	Namespace                 string                  `json:",omitempty"`
	Protocol                  string                  `json:",omitempty"`
	Mode                      ProxyMode               `json:",omitempty"`
	TransparentProxy          *TransparentProxyConfig `json:",omitempty" alias:"transparent_proxy"`
	MutualTLSMode             MutualTLSMode           `json:",omitempty" alias:"mutual_tls_mode"`
	MeshGateway               MeshGatewayConfig       `json:",omitempty" alias:"mesh_gateway"`
	Expose                    ExposeConfig            `json:",omitempty"`
	ExternalSNI               string                  `json:",omitempty" alias:"external_sni"`
	UpstreamConfig            *UpstreamConfiguration  `json:",omitempty" alias:"upstream_config"`
	Destination               *DestinationConfig      `json:",omitempty"`
	MaxInboundConnections     int                     `json:",omitempty" alias:"max_inbound_connections"`
	LocalConnectTimeoutMs     int                     `json:",omitempty" alias:"local_connect_timeout_ms"`
	LocalRequestTimeoutMs     int                     `json:",omitempty" alias:"local_request_timeout_ms"`
	BalanceInboundConnections string                  `json:",omitempty" alias:"balance_inbound_connections"`
	RateLimits                *RateLimits             `json:",omitempty" alias:"rate_limits"`
	EnvoyExtensions           []EnvoyExtension        `json:",omitempty" alias:"envoy_extensions"`
	Meta                      map[string]string       `json:",omitempty"`
	CreateIndex               uint64
	ModifyIndex               uint64
}

func (s *ServiceConfigEntry) GetKind() string            { return s.Kind }
func (s *ServiceConfigEntry) GetName() string            { return s.Name }
func (s *ServiceConfigEntry) GetPartition() string       { return s.Partition }
func (s *ServiceConfigEntry) GetNamespace() string       { return s.Namespace }
func (s *ServiceConfigEntry) GetMeta() map[string]string { return s.Meta }
func (s *ServiceConfigEntry) GetCreateIndex() uint64     { return s.CreateIndex }
func (s *ServiceConfigEntry) GetModifyIndex() uint64     { return s.ModifyIndex }

type ProxyConfigEntry struct {
	Kind                 string
	Name                 string
	Partition            string                               `json:",omitempty"`
	Namespace            string                               `json:",omitempty"`
	Mode                 ProxyMode                            `json:",omitempty"`
	TransparentProxy     *TransparentProxyConfig              `json:",omitempty" alias:"transparent_proxy"`
	MutualTLSMode        MutualTLSMode                        `json:",omitempty" alias:"mutual_tls_mode"`
	Config               map[string]interface{}               `json:",omitempty"`
	MeshGateway          MeshGatewayConfig                    `json:",omitempty" alias:"mesh_gateway"`
	Expose               ExposeConfig                         `json:",omitempty"`
	AccessLogs           *AccessLogsConfig                    `json:",omitempty" alias:"access_logs"`
	EnvoyExtensions      []EnvoyExtension                     `json:",omitempty" alias:"envoy_extensions"`
	FailoverPolicy       *ServiceResolverFailoverPolicy       `json:",omitempty" alias:"failover_policy"`
	PrioritizeByLocality *ServiceResolverPrioritizeByLocality `json:",omitempty" alias:"prioritize_by_locality"`

	Meta        map[string]string `json:",omitempty"`
	CreateIndex uint64
	ModifyIndex uint64
}

func (p *ProxyConfigEntry) GetKind() string            { return p.Kind }
func (p *ProxyConfigEntry) GetName() string            { return ProxyConfigGlobal }
func (p *ProxyConfigEntry) GetPartition() string       { return p.Partition }
func (p *ProxyConfigEntry) GetNamespace() string       { return p.Namespace }
func (p *ProxyConfigEntry) GetMeta() map[string]string { return p.Meta }
func (p *ProxyConfigEntry) GetCreateIndex() uint64     { return p.CreateIndex }
func (p *ProxyConfigEntry) GetModifyIndex() uint64     { return p.ModifyIndex }

func makeConfigEntry(kind, name string) (ConfigEntry, error) {
	switch kind {
	case ServiceDefaults:
		return &ServiceConfigEntry{Kind: kind, Name: name}, nil
	case ProxyDefaults:
		return &ProxyConfigEntry{Kind: kind, Name: name}, nil
	case ServiceRouter:
		return &ServiceRouterConfigEntry{Kind: kind, Name: name}, nil
	case ServiceSplitter:
		return &ServiceSplitterConfigEntry{Kind: kind, Name: name}, nil
	case ServiceResolver:
		return &ServiceResolverConfigEntry{Kind: kind, Name: name}, nil
	case IngressGateway:
		return &IngressGatewayConfigEntry{Kind: kind, Name: name}, nil
	case TerminatingGateway:
		return &TerminatingGatewayConfigEntry{Kind: kind, Name: name}, nil
	case ServiceIntentions:
		return &ServiceIntentionsConfigEntry{Kind: kind, Name: name}, nil
	case MeshConfig:
		return &MeshConfigEntry{}, nil
	case ExportedServices:
		return &ExportedServicesConfigEntry{Name: name}, nil
	case SamenessGroup:
		return &SamenessGroupConfigEntry{Kind: kind, Name: name}, nil
	case APIGateway:
		return &APIGatewayConfigEntry{Kind: kind, Name: name}, nil
	case TCPRoute:
		return &TCPRouteConfigEntry{Kind: kind, Name: name}, nil
	case FileSystemCertificate:
		return &FileSystemCertificateConfigEntry{Kind: kind, Name: name}, nil
	case InlineCertificate:
		return &InlineCertificateConfigEntry{Kind: kind, Name: name}, nil
	case HTTPRoute:
		return &HTTPRouteConfigEntry{Kind: kind, Name: name}, nil
	case RateLimitIPConfig:
		return &RateLimitIPConfigEntry{Kind: kind, Name: name}, nil
	case JWTProvider:
		return &JWTProviderConfigEntry{Kind: kind, Name: name}, nil
	default:
		return nil, fmt.Errorf("invalid config entry kind: %s", kind)
	}
}

func MakeConfigEntry(kind, name string) (ConfigEntry, error) {
	return makeConfigEntry(kind, name)
}

// DecodeConfigEntry will decode the result of using json.Unmarshal of a config
// entry into a map[string]interface{}.
//
// Important caveats:
//
// - This will NOT work if the map[string]interface{} was produced using HCL
// decoding as that requires more extensive parsing to work around the issues
// with map[string][]interface{} that arise.
//
// - This will only decode fields using their camel case json field
// representations.
func DecodeConfigEntry(raw map[string]interface{}) (ConfigEntry, error) {
	var entry ConfigEntry

	kindVal, ok := raw["Kind"]
	if !ok {
		kindVal, ok = raw["kind"]
	}
	if !ok {
		return nil, fmt.Errorf("Payload does not contain a kind/Kind key at the top level")
	}

	if kindStr, ok := kindVal.(string); ok {
		newEntry, err := makeConfigEntry(kindStr, "")
		if err != nil {
			return nil, err
		}
		entry = newEntry
	} else {
		return nil, fmt.Errorf("Kind value in payload is not a string")
	}

	decodeConf := &mapstructure.DecoderConfig{
		DecodeHook: mapstructure.ComposeDecodeHookFunc(
			mapstructure.StringToTimeDurationHookFunc(),
			mapstructure.StringToTimeHookFunc(time.RFC3339),
		),
		Result:           &entry,
		WeaklyTypedInput: true,
	}

	decoder, err := mapstructure.NewDecoder(decodeConf)
	if err != nil {
		return nil, err
	}

	return entry, decoder.Decode(raw)
}

func DecodeConfigEntryFromJSON(data []byte) (ConfigEntry, error) {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	return DecodeConfigEntry(raw)
}

func decodeConfigEntrySlice(raw []map[string]interface{}) ([]ConfigEntry, error) {
	var entries []ConfigEntry
	for _, rawEntry := range raw {
		entry, err := DecodeConfigEntry(rawEntry)
		if err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// ConfigEntries can be used to query the Config endpoints
type ConfigEntries struct {
	c *Client
}

// Config returns a handle to the Config endpoints
func (c *Client) ConfigEntries() *ConfigEntries {
	return &ConfigEntries{c}
}

func (conf *ConfigEntries) Get(kind string, name string, q *QueryOptions) (ConfigEntry, *QueryMeta, error) {
	if kind == "" || name == "" {
		return nil, nil, fmt.Errorf("Both kind and name parameters must not be empty")
	}

	entry, err := makeConfigEntry(kind, name)
	if err != nil {
		return nil, nil, err
	}

	r := conf.c.newRequest("GET", fmt.Sprintf("/v1/config/%s/%s", kind, name))
	r.setQueryOptions(q)
	rtt, resp, err := conf.c.doRequest(r)
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

	if err := decodeBody(resp, entry); err != nil {
		return nil, nil, err
	}

	return entry, qm, nil
}

func (conf *ConfigEntries) List(kind string, q *QueryOptions) ([]ConfigEntry, *QueryMeta, error) {
	if kind == "" {
		return nil, nil, fmt.Errorf("The kind parameter must not be empty")
	}

	r := conf.c.newRequest("GET", fmt.Sprintf("/v1/config/%s", kind))
	r.setQueryOptions(q)
	rtt, resp, err := conf.c.doRequest(r)
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

	var raw []map[string]interface{}
	if err := decodeBody(resp, &raw); err != nil {
		return nil, nil, err
	}

	entries, err := decodeConfigEntrySlice(raw)
	if err != nil {
		return nil, nil, err
	}

	return entries, qm, nil
}

func (conf *ConfigEntries) Set(entry ConfigEntry, w *WriteOptions) (bool, *WriteMeta, error) {
	return conf.set(entry, nil, w)
}

func (conf *ConfigEntries) CAS(entry ConfigEntry, index uint64, w *WriteOptions) (bool, *WriteMeta, error) {
	return conf.set(entry, map[string]string{"cas": strconv.FormatUint(index, 10)}, w)
}

func (conf *ConfigEntries) set(entry ConfigEntry, params map[string]string, w *WriteOptions) (bool, *WriteMeta, error) {
	r := conf.c.newRequest("PUT", "/v1/config")
	r.setWriteOptions(w)
	for param, value := range params {
		r.params.Set(param, value)
	}
	r.obj = entry
	rtt, resp, err := conf.c.doRequest(r)
	if err != nil {
		return false, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return false, nil, err
	}

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, resp.Body); err != nil {
		return false, nil, fmt.Errorf("Failed to read response: %v", err)
	}
	res := strings.Contains(buf.String(), "true")

	wm := &WriteMeta{RequestTime: rtt}
	return res, wm, nil
}

func (conf *ConfigEntries) Delete(kind string, name string, w *WriteOptions) (*WriteMeta, error) {
	_, wm, err := conf.delete(kind, name, nil, w)
	return wm, err
}

// DeleteCAS performs a Check-And-Set deletion of the given config entry, and
// returns true if it was successful. If the provided index no longer matches
// the entry's ModifyIndex (i.e. it was modified by another process) then the
// operation will fail and return false.
func (conf *ConfigEntries) DeleteCAS(kind, name string, index uint64, w *WriteOptions) (bool, *WriteMeta, error) {
	return conf.delete(kind, name, map[string]string{"cas": strconv.FormatUint(index, 10)}, w)
}

func (conf *ConfigEntries) delete(kind, name string, params map[string]string, w *WriteOptions) (bool, *WriteMeta, error) {
	if kind == "" || name == "" {
		return false, nil, fmt.Errorf("Both kind and name parameters must not be empty")
	}

	r := conf.c.newRequest("DELETE", fmt.Sprintf("/v1/config/%s/%s", kind, name))
	r.setWriteOptions(w)
	for param, value := range params {
		r.params.Set(param, value)
	}

	rtt, resp, err := conf.c.doRequest(r)
	if err != nil {
		return false, nil, err
	}
	defer closeResponseBody(resp)

	if err := requireOK(resp); err != nil {
		return false, nil, err
	}

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, resp.Body); err != nil {
		return false, nil, fmt.Errorf("Failed to read response: %v", err)
	}

	res := strings.Contains(buf.String(), "true")
	wm := &WriteMeta{RequestTime: rtt}
	return res, wm, nil
}
