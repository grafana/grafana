// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"encoding/json"
	"time"

	"github.com/hashicorp/go-multierror"
)

type ServiceRouterConfigEntry struct {
	Kind      string
	Name      string
	Partition string `json:",omitempty"`
	Namespace string `json:",omitempty"`

	Routes []ServiceRoute `json:",omitempty"`

	Meta        map[string]string `json:",omitempty"`
	CreateIndex uint64
	ModifyIndex uint64
}

func (e *ServiceRouterConfigEntry) GetKind() string            { return e.Kind }
func (e *ServiceRouterConfigEntry) GetName() string            { return e.Name }
func (e *ServiceRouterConfigEntry) GetPartition() string       { return e.Partition }
func (e *ServiceRouterConfigEntry) GetNamespace() string       { return e.Namespace }
func (e *ServiceRouterConfigEntry) GetMeta() map[string]string { return e.Meta }
func (e *ServiceRouterConfigEntry) GetCreateIndex() uint64     { return e.CreateIndex }
func (e *ServiceRouterConfigEntry) GetModifyIndex() uint64     { return e.ModifyIndex }

type ServiceRoute struct {
	Match       *ServiceRouteMatch       `json:",omitempty"`
	Destination *ServiceRouteDestination `json:",omitempty"`
}

type ServiceRouteMatch struct {
	HTTP *ServiceRouteHTTPMatch `json:",omitempty"`
}

type ServiceRouteHTTPMatch struct {
	PathExact       string `json:",omitempty" alias:"path_exact"`
	PathPrefix      string `json:",omitempty" alias:"path_prefix"`
	PathRegex       string `json:",omitempty" alias:"path_regex"`
	CaseInsensitive bool   `json:",omitempty" alias:"case_insensitive"`

	Header     []ServiceRouteHTTPMatchHeader     `json:",omitempty"`
	QueryParam []ServiceRouteHTTPMatchQueryParam `json:",omitempty" alias:"query_param"`
	Methods    []string                          `json:",omitempty"`
}

type ServiceRouteHTTPMatchHeader struct {
	Name    string
	Present bool   `json:",omitempty"`
	Exact   string `json:",omitempty"`
	Prefix  string `json:",omitempty"`
	Suffix  string `json:",omitempty"`
	Regex   string `json:",omitempty"`
	Invert  bool   `json:",omitempty"`
}

type ServiceRouteHTTPMatchQueryParam struct {
	Name    string
	Present bool   `json:",omitempty"`
	Exact   string `json:",omitempty"`
	Regex   string `json:",omitempty"`
}

type ServiceRouteDestination struct {
	Service               string               `json:",omitempty"`
	ServiceSubset         string               `json:",omitempty" alias:"service_subset"`
	Namespace             string               `json:",omitempty"`
	Partition             string               `json:",omitempty"`
	PrefixRewrite         string               `json:",omitempty" alias:"prefix_rewrite"`
	RequestTimeout        time.Duration        `json:",omitempty" alias:"request_timeout"`
	IdleTimeout           time.Duration        `json:",omitempty" alias:"idle_timeout"`
	NumRetries            uint32               `json:",omitempty" alias:"num_retries"`
	RetryOnConnectFailure bool                 `json:",omitempty" alias:"retry_on_connect_failure"`
	RetryOnStatusCodes    []uint32             `json:",omitempty" alias:"retry_on_status_codes"`
	RetryOn               []string             `json:",omitempty" alias:"retry_on"`
	RequestHeaders        *HTTPHeaderModifiers `json:",omitempty" alias:"request_headers"`
	ResponseHeaders       *HTTPHeaderModifiers `json:",omitempty" alias:"response_headers"`
}

func (e *ServiceRouteDestination) MarshalJSON() ([]byte, error) {
	type Alias ServiceRouteDestination
	exported := &struct {
		RequestTimeout string `json:",omitempty"`
		IdleTimeout    string `json:",omitempty"`
		*Alias
	}{
		RequestTimeout: e.RequestTimeout.String(),
		IdleTimeout:    e.IdleTimeout.String(),
		Alias:          (*Alias)(e),
	}
	if e.RequestTimeout == 0 {
		exported.RequestTimeout = ""
	}
	if e.IdleTimeout == 0 {
		exported.IdleTimeout = ""
	}

	return json.Marshal(exported)
}

func (e *ServiceRouteDestination) UnmarshalJSON(data []byte) error {
	type Alias ServiceRouteDestination
	aux := &struct {
		RequestTimeout string
		IdleTimeout    string
		*Alias
	}{
		Alias: (*Alias)(e),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	var err error
	if aux.RequestTimeout != "" {
		if e.RequestTimeout, err = time.ParseDuration(aux.RequestTimeout); err != nil {
			return err
		}
	}
	if aux.IdleTimeout != "" {
		if e.IdleTimeout, err = time.ParseDuration(aux.IdleTimeout); err != nil {
			return err
		}
	}
	return nil
}

type ServiceSplitterConfigEntry struct {
	Kind      string
	Name      string
	Partition string `json:",omitempty"`
	Namespace string `json:",omitempty"`

	Splits []ServiceSplit `json:",omitempty"`

	Meta        map[string]string `json:",omitempty"`
	CreateIndex uint64
	ModifyIndex uint64
}

func (e *ServiceSplitterConfigEntry) GetKind() string            { return e.Kind }
func (e *ServiceSplitterConfigEntry) GetName() string            { return e.Name }
func (e *ServiceSplitterConfigEntry) GetPartition() string       { return e.Partition }
func (e *ServiceSplitterConfigEntry) GetNamespace() string       { return e.Namespace }
func (e *ServiceSplitterConfigEntry) GetMeta() map[string]string { return e.Meta }
func (e *ServiceSplitterConfigEntry) GetCreateIndex() uint64     { return e.CreateIndex }
func (e *ServiceSplitterConfigEntry) GetModifyIndex() uint64     { return e.ModifyIndex }

type ServiceSplit struct {
	Weight          float32
	Service         string               `json:",omitempty"`
	ServiceSubset   string               `json:",omitempty" alias:"service_subset"`
	Namespace       string               `json:",omitempty"`
	Partition       string               `json:",omitempty"`
	RequestHeaders  *HTTPHeaderModifiers `json:",omitempty" alias:"request_headers"`
	ResponseHeaders *HTTPHeaderModifiers `json:",omitempty" alias:"response_headers"`
}

type ServiceResolverConfigEntry struct {
	Kind      string
	Name      string
	Partition string `json:",omitempty"`
	Namespace string `json:",omitempty"`

	DefaultSubset  string                             `json:",omitempty" alias:"default_subset"`
	Subsets        map[string]ServiceResolverSubset   `json:",omitempty"`
	Redirect       *ServiceResolverRedirect           `json:",omitempty"`
	Failover       map[string]ServiceResolverFailover `json:",omitempty"`
	ConnectTimeout time.Duration                      `json:",omitempty" alias:"connect_timeout"`
	RequestTimeout time.Duration                      `json:",omitempty" alias:"request_timeout"`

	// PrioritizeByLocality controls whether the locality of services within the
	// local partition will be used to prioritize connectivity.
	PrioritizeByLocality *ServiceResolverPrioritizeByLocality `json:",omitempty" alias:"prioritize_by_locality"`

	// LoadBalancer determines the load balancing policy and configuration for services
	// issuing requests to this upstream service.
	LoadBalancer *LoadBalancer `json:",omitempty" alias:"load_balancer"`

	Meta        map[string]string `json:",omitempty"`
	CreateIndex uint64
	ModifyIndex uint64
}

func (e *ServiceResolverConfigEntry) MarshalJSON() ([]byte, error) {
	type Alias ServiceResolverConfigEntry
	exported := &struct {
		ConnectTimeout string `json:",omitempty"`
		RequestTimeout string `json:",omitempty"`
		*Alias
	}{
		ConnectTimeout: e.ConnectTimeout.String(),
		RequestTimeout: e.RequestTimeout.String(),
		Alias:          (*Alias)(e),
	}
	if e.ConnectTimeout == 0 {
		exported.ConnectTimeout = ""
	}
	if e.RequestTimeout == 0 {
		exported.RequestTimeout = ""
	}

	return json.Marshal(exported)
}

func (e *ServiceResolverConfigEntry) UnmarshalJSON(data []byte) error {
	type Alias ServiceResolverConfigEntry
	aux := &struct {
		ConnectTimeout string
		RequestTimeout string
		*Alias
	}{
		Alias: (*Alias)(e),
	}
	var err error
	if err = json.Unmarshal(data, &aux); err != nil {
		return err
	}
	var merr *multierror.Error
	if aux.ConnectTimeout != "" {
		if e.ConnectTimeout, err = time.ParseDuration(aux.ConnectTimeout); err != nil {
			merr = multierror.Append(merr, err)
		}
	}
	if aux.RequestTimeout != "" {
		if e.RequestTimeout, err = time.ParseDuration(aux.RequestTimeout); err != nil {
			merr = multierror.Append(merr, err)
		}
	}
	return merr.ErrorOrNil()
}

func (e *ServiceResolverConfigEntry) GetKind() string            { return e.Kind }
func (e *ServiceResolverConfigEntry) GetName() string            { return e.Name }
func (e *ServiceResolverConfigEntry) GetPartition() string       { return e.Partition }
func (e *ServiceResolverConfigEntry) GetNamespace() string       { return e.Namespace }
func (e *ServiceResolverConfigEntry) GetMeta() map[string]string { return e.Meta }
func (e *ServiceResolverConfigEntry) GetCreateIndex() uint64     { return e.CreateIndex }
func (e *ServiceResolverConfigEntry) GetModifyIndex() uint64     { return e.ModifyIndex }

type ServiceResolverSubset struct {
	Filter      string `json:",omitempty"`
	OnlyPassing bool   `json:",omitempty" alias:"only_passing"`
}

type ServiceResolverRedirect struct {
	Service       string `json:",omitempty"`
	ServiceSubset string `json:",omitempty" alias:"service_subset"`
	Namespace     string `json:",omitempty"`
	Partition     string `json:",omitempty"`
	Datacenter    string `json:",omitempty"`
	Peer          string `json:",omitempty"`
	SamenessGroup string `json:",omitempty" alias:"sameness_group"`
}

type ServiceResolverFailover struct {
	Service       string `json:",omitempty"`
	ServiceSubset string `json:",omitempty" alias:"service_subset"`
	// Referencing other partitions is not supported.
	Namespace     string                          `json:",omitempty"`
	Datacenters   []string                        `json:",omitempty"`
	Targets       []ServiceResolverFailoverTarget `json:",omitempty"`
	Policy        *ServiceResolverFailoverPolicy  `json:",omitempty"`
	SamenessGroup string                          `json:",omitempty" alias:"sameness_group"`
}

type ServiceResolverFailoverTarget struct {
	Service       string `json:",omitempty"`
	ServiceSubset string `json:",omitempty" alias:"service_subset"`
	Partition     string `json:",omitempty"`
	Namespace     string `json:",omitempty"`
	Datacenter    string `json:",omitempty"`
	Peer          string `json:",omitempty"`
}

type ServiceResolverFailoverPolicy struct {
	// Mode specifies the type of failover that will be performed. Valid values are
	// "sequential", "" (equivalent to "sequential") and "order-by-locality".
	Mode    string   `json:",omitempty"`
	Regions []string `json:",omitempty"`
}

type ServiceResolverPrioritizeByLocality struct {
	// Mode specifies the type of prioritization that will be performed
	// when selecting nodes in the local partition.
	// Valid values are: "" (default "none"), "none", and "failover".
	Mode string `json:",omitempty"`
}

// LoadBalancer determines the load balancing policy and configuration for services
// issuing requests to this upstream service.
type LoadBalancer struct {
	// Policy is the load balancing policy used to select a host
	Policy string `json:",omitempty"`

	// RingHashConfig contains configuration for the "ring_hash" policy type
	RingHashConfig *RingHashConfig `json:",omitempty" alias:"ring_hash_config"`

	// LeastRequestConfig contains configuration for the "least_request" policy type
	LeastRequestConfig *LeastRequestConfig `json:",omitempty" alias:"least_request_config"`

	// HashPolicies is a list of hash policies to use for hashing load balancing algorithms.
	// Hash policies are evaluated individually and combined such that identical lists
	// result in the same hash.
	// If no hash policies are present, or none are successfully evaluated,
	// then a random backend host will be selected.
	HashPolicies []HashPolicy `json:",omitempty" alias:"hash_policies"`
}

// RingHashConfig contains configuration for the "ring_hash" policy type
type RingHashConfig struct {
	// MinimumRingSize determines the minimum number of entries in the hash ring
	MinimumRingSize uint64 `json:",omitempty" alias:"minimum_ring_size"`

	// MaximumRingSize determines the maximum number of entries in the hash ring
	MaximumRingSize uint64 `json:",omitempty" alias:"maximum_ring_size"`
}

// LeastRequestConfig contains configuration for the "least_request" policy type
type LeastRequestConfig struct {
	// ChoiceCount determines the number of random healthy hosts from which to select the one with the least requests.
	ChoiceCount uint32 `json:",omitempty" alias:"choice_count"`
}

// HashPolicy defines which attributes will be hashed by hash-based LB algorithms
type HashPolicy struct {
	// Field is the attribute type to hash on.
	// Must be one of "header","cookie", or "query_parameter".
	// Cannot be specified along with SourceIP.
	Field string `json:",omitempty"`

	// FieldValue is the value to hash.
	// ie. header name, cookie name, URL query parameter name
	// Cannot be specified along with SourceIP.
	FieldValue string `json:",omitempty" alias:"field_value"`

	// CookieConfig contains configuration for the "cookie" hash policy type.
	CookieConfig *CookieConfig `json:",omitempty" alias:"cookie_config"`

	// SourceIP determines whether the hash should be of the source IP rather than of a field and field value.
	// Cannot be specified along with Field or FieldValue.
	SourceIP bool `json:",omitempty" alias:"source_ip"`

	// Terminal will short circuit the computation of the hash when multiple hash policies are present.
	// If a hash is computed when a Terminal policy is evaluated,
	// then that hash will be used and subsequent hash policies will be ignored.
	Terminal bool `json:",omitempty"`
}

// CookieConfig contains configuration for the "cookie" hash policy type.
// This is specified to have Envoy generate a cookie for a client on its first request.
type CookieConfig struct {
	// Generates a session cookie with no expiration.
	Session bool `json:",omitempty"`

	// TTL for generated cookies. Cannot be specified for session cookies.
	TTL time.Duration `json:",omitempty"`

	// The path to set for the cookie
	Path string `json:",omitempty"`
}

// HTTPHeaderModifiers is a set of rules for HTTP header modification that
// should be performed by proxies as the request passes through them. It can
// operate on either request or response headers depending on the context in
// which it is used.
type HTTPHeaderModifiers struct {
	// Add is a set of name -> value pairs that should be appended to the request
	// or response (i.e. allowing duplicates if the same header already exists).
	Add map[string]string `json:",omitempty"`

	// Set is a set of name -> value pairs that should be added to the request or
	// response, overwriting any existing header values of the same name.
	Set map[string]string `json:",omitempty"`

	// Remove is the set of header names that should be stripped from the request
	// or response.
	Remove []string `json:",omitempty"`
}
