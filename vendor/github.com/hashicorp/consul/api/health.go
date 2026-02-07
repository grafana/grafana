// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const (
	// HealthAny is special, and is used as a wild card,
	// not as a specific state.
	HealthAny      = "any"
	HealthPassing  = "passing"
	HealthWarning  = "warning"
	HealthCritical = "critical"
	HealthMaint    = "maintenance"
)

const (
	serviceHealth = "service"
	connectHealth = "connect"
	ingressHealth = "ingress"
)

const (
	// NodeMaint is the special key set by a node in maintenance mode.
	NodeMaint = "_node_maintenance"

	// ServiceMaintPrefix is the prefix for a service in maintenance mode.
	ServiceMaintPrefix = "_service_maintenance:"
)

// HealthCheck is used to represent a single check
type HealthCheck struct {
	Node        string
	CheckID     string
	Name        string
	Status      string
	Notes       string
	Output      string
	ServiceID   string
	ServiceName string
	ServiceTags []string
	Type        string
	Namespace   string `json:",omitempty"`
	Partition   string `json:",omitempty"`
	ExposedPort int
	PeerName    string `json:",omitempty"`

	Definition HealthCheckDefinition

	CreateIndex uint64
	ModifyIndex uint64
}

// HealthCheckDefinition is used to store the details about
// a health check's execution.
type HealthCheckDefinition struct {
	HTTP                                   string
	Header                                 map[string][]string
	Method                                 string
	Body                                   string
	TLSServerName                          string
	TLSSkipVerify                          bool
	TCP                                    string
	TCPUseTLS                              bool
	UDP                                    string
	GRPC                                   string
	OSService                              string
	GRPCUseTLS                             bool
	IntervalDuration                       time.Duration `json:"-"`
	TimeoutDuration                        time.Duration `json:"-"`
	DeregisterCriticalServiceAfterDuration time.Duration `json:"-"`

	// DEPRECATED in Consul 1.4.1. Use the above time.Duration fields instead.
	Interval                       ReadableDuration
	Timeout                        ReadableDuration
	DeregisterCriticalServiceAfter ReadableDuration
}

func (d *HealthCheckDefinition) MarshalJSON() ([]byte, error) {
	type Alias HealthCheckDefinition
	out := &struct {
		Interval                       string
		Timeout                        string
		DeregisterCriticalServiceAfter string
		*Alias
	}{
		Interval:                       d.Interval.String(),
		Timeout:                        d.Timeout.String(),
		DeregisterCriticalServiceAfter: d.DeregisterCriticalServiceAfter.String(),
		Alias:                          (*Alias)(d),
	}

	if d.IntervalDuration != 0 {
		out.Interval = d.IntervalDuration.String()
	} else if d.Interval != 0 {
		out.Interval = d.Interval.String()
	}
	if d.TimeoutDuration != 0 {
		out.Timeout = d.TimeoutDuration.String()
	} else if d.Timeout != 0 {
		out.Timeout = d.Timeout.String()
	}
	if d.DeregisterCriticalServiceAfterDuration != 0 {
		out.DeregisterCriticalServiceAfter = d.DeregisterCriticalServiceAfterDuration.String()
	} else if d.DeregisterCriticalServiceAfter != 0 {
		out.DeregisterCriticalServiceAfter = d.DeregisterCriticalServiceAfter.String()
	}

	return json.Marshal(out)
}

func (t *HealthCheckDefinition) UnmarshalJSON(data []byte) (err error) {
	type Alias HealthCheckDefinition
	aux := &struct {
		IntervalDuration                       interface{}
		TimeoutDuration                        interface{}
		DeregisterCriticalServiceAfterDuration interface{}
		*Alias
	}{
		Alias: (*Alias)(t),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	// Parse the values into both the time.Duration and old ReadableDuration fields.

	if aux.IntervalDuration == nil {
		t.IntervalDuration = time.Duration(t.Interval)
	} else {
		switch v := aux.IntervalDuration.(type) {
		case string:
			if t.IntervalDuration, err = time.ParseDuration(v); err != nil {
				return err
			}
		case float64:
			t.IntervalDuration = time.Duration(v)
		}
		t.Interval = ReadableDuration(t.IntervalDuration)
	}

	if aux.TimeoutDuration == nil {
		t.TimeoutDuration = time.Duration(t.Timeout)
	} else {
		switch v := aux.TimeoutDuration.(type) {
		case string:
			if t.TimeoutDuration, err = time.ParseDuration(v); err != nil {
				return err
			}
		case float64:
			t.TimeoutDuration = time.Duration(v)
		}
		t.Timeout = ReadableDuration(t.TimeoutDuration)
	}
	if aux.DeregisterCriticalServiceAfterDuration == nil {
		t.DeregisterCriticalServiceAfterDuration = time.Duration(t.DeregisterCriticalServiceAfter)
	} else {
		switch v := aux.DeregisterCriticalServiceAfterDuration.(type) {
		case string:
			if t.DeregisterCriticalServiceAfterDuration, err = time.ParseDuration(v); err != nil {
				return err
			}
		case float64:
			t.DeregisterCriticalServiceAfterDuration = time.Duration(v)
		}
		t.DeregisterCriticalServiceAfter = ReadableDuration(t.DeregisterCriticalServiceAfterDuration)
	}

	return nil
}

// HealthChecks is a collection of HealthCheck structs.
type HealthChecks []*HealthCheck

// AggregatedStatus returns the "best" status for the list of health checks.
// Because a given entry may have many service and node-level health checks
// attached, this function determines the best representative of the status as
// as single string using the following heuristic:
//
//	maintenance > critical > warning > passing
func (c HealthChecks) AggregatedStatus() string {
	var passing, warning, critical, maintenance bool
	for _, check := range c {
		id := check.CheckID
		if id == NodeMaint || strings.HasPrefix(id, ServiceMaintPrefix) {
			maintenance = true
			continue
		}

		switch check.Status {
		case HealthPassing:
			passing = true
		case HealthWarning:
			warning = true
		case HealthCritical:
			critical = true
		default:
			return ""
		}
	}

	switch {
	case maintenance:
		return HealthMaint
	case critical:
		return HealthCritical
	case warning:
		return HealthWarning
	case passing:
		return HealthPassing
	default:
		return HealthPassing
	}
}

// ServiceEntry is used for the health service endpoint
type ServiceEntry struct {
	Node    *Node
	Service *AgentService
	Checks  HealthChecks
}

// Health can be used to query the Health endpoints
type Health struct {
	c *Client
}

// Health returns a handle to the health endpoints
func (c *Client) Health() *Health {
	return &Health{c}
}

// Node is used to query for checks belonging to a given node
func (h *Health) Node(node string, q *QueryOptions) (HealthChecks, *QueryMeta, error) {
	r := h.c.newRequest("GET", "/v1/health/node/"+node)
	r.setQueryOptions(q)
	rtt, resp, err := h.c.doRequest(r)
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

	var out HealthChecks
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// Checks is used to return the checks associated with a service
func (h *Health) Checks(service string, q *QueryOptions) (HealthChecks, *QueryMeta, error) {
	r := h.c.newRequest("GET", "/v1/health/checks/"+service)
	r.setQueryOptions(q)
	rtt, resp, err := h.c.doRequest(r)
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

	var out HealthChecks
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// Service is used to query health information along with service info
// for a given service. It can optionally do server-side filtering on a tag
// or nodes with passing health checks only.
func (h *Health) Service(service, tag string, passingOnly bool, q *QueryOptions) ([]*ServiceEntry, *QueryMeta, error) {
	var tags []string
	if tag != "" {
		tags = []string{tag}
	}
	return h.service(service, tags, passingOnly, q, serviceHealth)
}

func (h *Health) ServiceMultipleTags(service string, tags []string, passingOnly bool, q *QueryOptions) ([]*ServiceEntry, *QueryMeta, error) {
	return h.service(service, tags, passingOnly, q, serviceHealth)
}

// Connect is equivalent to Service except that it will only return services
// which are Connect-enabled and will returns the connection address for Connect
// client's to use which may be a proxy in front of the named service. If
// passingOnly is true only instances where both the service and any proxy are
// healthy will be returned.
func (h *Health) Connect(service, tag string, passingOnly bool, q *QueryOptions) ([]*ServiceEntry, *QueryMeta, error) {
	var tags []string
	if tag != "" {
		tags = []string{tag}
	}
	return h.service(service, tags, passingOnly, q, connectHealth)
}

func (h *Health) ConnectMultipleTags(service string, tags []string, passingOnly bool, q *QueryOptions) ([]*ServiceEntry, *QueryMeta, error) {
	return h.service(service, tags, passingOnly, q, connectHealth)
}

// Ingress is equivalent to Connect except that it will only return associated
// ingress gateways for the requested service.
func (h *Health) Ingress(service string, passingOnly bool, q *QueryOptions) ([]*ServiceEntry, *QueryMeta, error) {
	var tags []string
	return h.service(service, tags, passingOnly, q, ingressHealth)
}

func (h *Health) service(service string, tags []string, passingOnly bool, q *QueryOptions, healthType string) ([]*ServiceEntry, *QueryMeta, error) {
	var path string
	switch healthType {
	case connectHealth:
		path = "/v1/health/connect/" + service
	case ingressHealth:
		path = "/v1/health/ingress/" + service
	default:
		path = "/v1/health/service/" + service
	}

	r := h.c.newRequest("GET", path)
	r.setQueryOptions(q)
	if len(tags) > 0 {
		for _, tag := range tags {
			r.params.Add("tag", tag)
		}
	}
	if passingOnly {
		r.params.Set(HealthPassing, "1")
	}
	rtt, resp, err := h.c.doRequest(r)
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

	var out []*ServiceEntry
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}

// State is used to retrieve all the checks in a given state.
// The wildcard "any" state can also be used for all checks.
func (h *Health) State(state string, q *QueryOptions) (HealthChecks, *QueryMeta, error) {
	switch state {
	case HealthAny:
	case HealthWarning:
	case HealthCritical:
	case HealthPassing:
	default:
		return nil, nil, fmt.Errorf("Unsupported state: %v", state)
	}
	r := h.c.newRequest("GET", "/v1/health/state/"+state)
	r.setQueryOptions(q)
	rtt, resp, err := h.c.doRequest(r)
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

	var out HealthChecks
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}
