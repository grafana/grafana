// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"fmt"
	"time"

	"github.com/mitchellh/mapstructure"
)

// CAConfig is the structure for the Connect CA configuration.
type CAConfig struct {
	// Provider is the CA provider implementation to use.
	Provider string

	// Configuration is arbitrary configuration for the provider. This
	// should only contain primitive values and containers (such as lists
	// and maps).
	Config map[string]interface{}

	// State is read-only data that the provider might have persisted for use
	// after restart or leadership transition. For example this might include
	// UUIDs of resources it has created. Setting this when writing a
	// configuration is an error.
	State map[string]string

	// ForceWithoutCrossSigning indicates that the CA reconfiguration should go
	// ahead even if the current CA is unable to cross sign certificates. This
	// risks temporary connection failures during the rollout as new leafs will be
	// rejected by proxies that have not yet observed the new root cert but is the
	// only option if a CA that doesn't support cross signing needs to be
	// reconfigured or mirated away from.
	ForceWithoutCrossSigning bool

	CreateIndex uint64
	ModifyIndex uint64
}

// CommonCAProviderConfig is the common options available to all CA providers.
type CommonCAProviderConfig struct {
	LeafCertTTL      time.Duration
	RootCertTTL      time.Duration
	SkipValidate     bool
	CSRMaxPerSecond  float32
	CSRMaxConcurrent int
}

// ConsulCAProviderConfig is the config for the built-in Consul CA provider.
type ConsulCAProviderConfig struct {
	CommonCAProviderConfig `mapstructure:",squash"`

	PrivateKey          string
	RootCert            string
	IntermediateCertTTL time.Duration
}

// ParseConsulCAConfig takes a raw config map and returns a parsed
// ConsulCAProviderConfig.
func ParseConsulCAConfig(raw map[string]interface{}) (*ConsulCAProviderConfig, error) {
	var config ConsulCAProviderConfig
	decodeConf := &mapstructure.DecoderConfig{
		DecodeHook:       mapstructure.StringToTimeDurationHookFunc(),
		Result:           &config,
		WeaklyTypedInput: true,
	}

	decoder, err := mapstructure.NewDecoder(decodeConf)
	if err != nil {
		return nil, err
	}

	if err := decoder.Decode(raw); err != nil {
		return nil, fmt.Errorf("error decoding config: %s", err)
	}

	return &config, nil
}

// CARootList is the structure for the results of listing roots.
type CARootList struct {
	ActiveRootID string
	TrustDomain  string
	Roots        []*CARoot
}

// CARoot represents a root CA certificate that is trusted.
type CARoot struct {
	// ID is a globally unique ID (UUID) representing this CA root.
	ID string

	// Name is a human-friendly name for this CA root. This value is
	// opaque to Consul and is not used for anything internally.
	Name string

	// RootCertPEM is the PEM-encoded public certificate.
	RootCertPEM string `json:"RootCert"`

	// Active is true if this is the current active CA. This must only
	// be true for exactly one CA. For any method that modifies roots in the
	// state store, tests should be written to verify that multiple roots
	// cannot be active.
	Active bool

	CreateIndex uint64
	ModifyIndex uint64
}

// LeafCert is a certificate that has been issued by a Connect CA.
type LeafCert struct {
	// SerialNumber is the unique serial number for this certificate.
	// This is encoded in standard hex separated by :.
	SerialNumber string

	// CertPEM and PrivateKeyPEM are the PEM-encoded certificate and private
	// key for that cert, respectively. This should not be stored in the
	// state store, but is present in the sign API response.
	CertPEM       string `json:",omitempty"`
	PrivateKeyPEM string `json:",omitempty"`

	// Service is the name of the service for which the cert was issued.
	// ServiceURI is the cert URI value.
	Service    string
	ServiceURI string

	// ValidAfter and ValidBefore are the validity periods for the
	// certificate.
	ValidAfter  time.Time
	ValidBefore time.Time

	CreateIndex uint64
	ModifyIndex uint64
}

// CARoots queries the list of available roots.
func (h *Connect) CARoots(q *QueryOptions) (*CARootList, *QueryMeta, error) {
	r := h.c.newRequest("GET", "/v1/connect/ca/roots")
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

	var out CARootList
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, qm, nil
}

// CAGetConfig returns the current CA configuration.
func (h *Connect) CAGetConfig(q *QueryOptions) (*CAConfig, *QueryMeta, error) {
	r := h.c.newRequest("GET", "/v1/connect/ca/configuration")
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

	var out CAConfig
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, qm, nil
}

// CASetConfig sets the current CA configuration.
func (h *Connect) CASetConfig(conf *CAConfig, q *WriteOptions) (*WriteMeta, error) {
	r := h.c.newRequest("PUT", "/v1/connect/ca/configuration")
	r.setWriteOptions(q)
	r.obj = conf
	rtt, resp, err := h.c.doRequest(r)
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
