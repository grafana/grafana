// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"time"
)

const (
	DiscoveryTypeStrictDNS   ClusterDiscoveryType = "STRICT_DNS"
	DiscoveryTypeStatic      ClusterDiscoveryType = "STATIC"
	DiscoveryTypeLogicalDNS  ClusterDiscoveryType = "LOGICAL_DNS"
	DiscoveryTypeEDS         ClusterDiscoveryType = "EDS"
	DiscoveryTypeOriginalDST ClusterDiscoveryType = "ORIGINAL_DST"
)

type JWTProviderConfigEntry struct {
	// Kind is the kind of configuration entry and must be "jwt-provider".
	Kind string `json:",omitempty"`

	// Name is the name of the provider being configured.
	Name string `json:",omitempty"`

	// JSONWebKeySet defines a JSON Web Key Set, its location on disk, or the
	// means with which to fetch a key set from a remote server.
	JSONWebKeySet *JSONWebKeySet `json:",omitempty" alias:"json_web_key_set"`

	// Issuer is the entity that must have issued the JWT.
	// This value must match the "iss" claim of the token.
	Issuer string `json:",omitempty"`

	// Audiences is the set of audiences the JWT is allowed to access.
	// If specified, all JWTs verified with this provider must address
	// at least one of these to be considered valid.
	Audiences []string `json:",omitempty"`

	// Locations where the JWT will be present in requests.
	// Envoy will check all of these locations to extract a JWT.
	// If no locations are specified Envoy will default to:
	// 1. Authorization header with Bearer schema:
	//    "Authorization: Bearer <token>"
	// 2. access_token query parameter.
	Locations []*JWTLocation `json:",omitempty"`

	// Forwarding defines rules for forwarding verified JWTs to the backend.
	Forwarding *JWTForwardingConfig `json:",omitempty"`

	// ClockSkewSeconds specifies the maximum allowable time difference
	// from clock skew when validating the "exp" (Expiration) and "nbf"
	// (Not Before) claims.
	//
	// Default value is 30 seconds.
	ClockSkewSeconds int `json:",omitempty" alias:"clock_skew_seconds"`

	// CacheConfig defines configuration for caching the validation
	// result for previously seen JWTs. Caching results can speed up
	// verification when individual tokens are expected to be handled
	// multiple times.
	CacheConfig *JWTCacheConfig `json:",omitempty" alias:"cache_config"`

	Meta map[string]string `json:",omitempty"`

	// CreateIndex is the Raft index this entry was created at. This is a
	// read-only field.
	CreateIndex uint64 `json:",omitempty"`

	// ModifyIndex is used for the Check-And-Set operations and can also be fed
	// back into the WaitIndex of the QueryOptions in order to perform blocking
	// queries.
	ModifyIndex uint64 `json:",omitempty"`

	// Partition is the partition the JWTProviderConfigEntry applies to.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the JWTProviderConfigEntry applies to.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`
}

// JWTLocation is a location where the JWT could be present in requests.
//
// Only one of Header, QueryParam, or Cookie can be specified.
type JWTLocation struct {
	// Header defines how to extract a JWT from an HTTP request header.
	Header *JWTLocationHeader `json:",omitempty"`

	// QueryParam defines how to extract a JWT from an HTTP request
	// query parameter.
	QueryParam *JWTLocationQueryParam `json:",omitempty" alias:"query_param"`

	// Cookie defines how to extract a JWT from an HTTP request cookie.
	Cookie *JWTLocationCookie `json:",omitempty"`
}

// JWTLocationHeader defines how to extract a JWT from an HTTP
// request header.
type JWTLocationHeader struct {
	// Name is the name of the header containing the token.
	Name string `json:",omitempty"`

	// ValuePrefix is an optional prefix that precedes the token in the
	// header value.
	// For example, "Bearer " is a standard value prefix for a header named
	// "Authorization", but the prefix is not part of the token itself:
	// "Authorization: Bearer <token>"
	ValuePrefix string `json:",omitempty" alias:"value_prefix"`

	// Forward defines whether the header with the JWT should be
	// forwarded after the token has been verified. If false, the
	// header will not be forwarded to the backend.
	//
	// Default value is false.
	Forward bool `json:",omitempty"`
}

// JWTLocationQueryParam defines how to extract a JWT from an HTTP request query parameter.
type JWTLocationQueryParam struct {
	// Name is the name of the query param containing the token.
	Name string `json:",omitempty"`
}

// JWTLocationCookie defines how to extract a JWT from an HTTP request cookie.
type JWTLocationCookie struct {
	// Name is the name of the cookie containing the token.
	Name string `json:",omitempty"`
}

type JWTForwardingConfig struct {
	// HeaderName is a header name to use when forwarding a verified
	// JWT to the backend. The verified JWT could have been extracted
	// from any location (query param, header, or cookie).
	//
	// The header value will be base64-URL-encoded, and will not be
	// padded unless PadForwardPayloadHeader is true.
	HeaderName string `json:",omitempty" alias:"header_name"`

	// PadForwardPayloadHeader determines whether padding should be added
	// to the base64 encoded token forwarded with ForwardPayloadHeader.
	//
	// Default value is false.
	PadForwardPayloadHeader bool `json:",omitempty" alias:"pad_forward_payload_header"`
}

// JSONWebKeySet defines a key set, its location on disk, or the
// means with which to fetch a key set from a remote server.
//
// Exactly one of Local or Remote must be specified.
type JSONWebKeySet struct {
	// Local specifies a local source for the key set.
	Local *LocalJWKS `json:",omitempty"`

	// Remote specifies how to fetch a key set from a remote server.
	Remote *RemoteJWKS `json:",omitempty"`
}

// LocalJWKS specifies a location for a local JWKS.
//
// Only one of String and Filename can be specified.
type LocalJWKS struct {
	// JWKS contains a base64 encoded JWKS.
	JWKS string `json:",omitempty"`

	// Filename configures a location on disk where the JWKS can be
	// found. If specified, the file must be present on the disk of ALL
	// proxies with intentions referencing this provider.
	Filename string `json:",omitempty"`
}

// RemoteJWKS specifies how to fetch a JWKS from a remote server.
type RemoteJWKS struct {
	// URI is the URI of the server to query for the JWKS.
	URI string `json:",omitempty"`

	// RequestTimeoutMs is the number of milliseconds to
	// time out when making a request for the JWKS.
	RequestTimeoutMs int `json:",omitempty" alias:"request_timeout_ms"`

	// CacheDuration is the duration after which cached keys
	// should be expired.
	//
	// Default value is 5 minutes.
	CacheDuration time.Duration `json:",omitempty" alias:"cache_duration"`

	// FetchAsynchronously indicates that the JWKS should be fetched
	// when a client request arrives. Client requests will be paused
	// until the JWKS is fetched.
	// If false, the proxy listener will wait for the JWKS to be
	// fetched before being activated.
	//
	// Default value is false.
	FetchAsynchronously bool `json:",omitempty" alias:"fetch_asynchronously"`

	// RetryPolicy defines a retry policy for fetching JWKS.
	//
	// There is no retry by default.
	RetryPolicy *JWKSRetryPolicy `json:",omitempty" alias:"retry_policy"`

	// JWKSCluster defines how the specified Remote JWKS URI is to be fetched.
	JWKSCluster *JWKSCluster `json:",omitempty" alias:"jwks_cluster"`
}

type JWKSCluster struct {
	// DiscoveryType refers to the service discovery type to use for resolving the cluster.
	//
	// This defaults to STRICT_DNS.
	// Other options include STATIC, LOGICAL_DNS, EDS or ORIGINAL_DST.
	DiscoveryType ClusterDiscoveryType `json:",omitempty" alias:"discovery_type"`

	// TLSCertificates refers to the data containing certificate authority certificates to use
	// in verifying a presented peer certificate.
	// If not specified and a peer certificate is presented it will not be verified.
	//
	// Must be either CaCertificateProviderInstance or TrustedCA.
	TLSCertificates *JWKSTLSCertificate `json:",omitempty" alias:"tls_certificates"`

	// The timeout for new network connections to hosts in the cluster.
	// If not set, a default value of 5s will be used.
	ConnectTimeout time.Duration `json:",omitempty" alias:"connect_timeout"`
}

type ClusterDiscoveryType string

// JWKSTLSCertificate refers to the data containing certificate authority certificates to use
// in verifying a presented peer certificate.
// If not specified and a peer certificate is presented it will not be verified.
//
// Must be either CaCertificateProviderInstance or TrustedCA.
type JWKSTLSCertificate struct {
	// CaCertificateProviderInstance Certificate provider instance for fetching TLS certificates.
	CaCertificateProviderInstance *JWKSTLSCertProviderInstance `json:",omitempty" alias:"ca_certificate_provider_instance"`

	// TrustedCA defines TLS certificate data containing certificate authority certificates
	// to use in verifying a presented peer certificate.
	//
	// Exactly one of Filename, EnvironmentVariable, InlineString or InlineBytes must be specified.
	TrustedCA *JWKSTLSCertTrustedCA `json:",omitempty" alias:"trusted_ca"`
}

// JWKSTLSCertTrustedCA defines TLS certificate data containing certificate authority certificates
// to use in verifying a presented peer certificate.
//
// Exactly one of Filename, EnvironmentVariable, InlineString or InlineBytes must be specified.
type JWKSTLSCertTrustedCA struct {
	Filename            string `json:",omitempty" alias:"filename"`
	EnvironmentVariable string `json:",omitempty" alias:"environment_variable"`
	InlineString        string `json:",omitempty" alias:"inline_string"`
	InlineBytes         []byte `json:",omitempty" alias:"inline_bytes"`
}

type JWKSTLSCertProviderInstance struct {
	// InstanceName refers to the certificate provider instance name
	//
	// The default value is "default".
	InstanceName string `json:",omitempty" alias:"instance_name"`

	// CertificateName is used to specify certificate instances or types. For example, "ROOTCA" to specify
	// a root-certificate (validation context) or "example.com" to specify a certificate for a
	// particular domain.
	//
	// The default value is the empty string.
	CertificateName string `json:",omitempty" alias:"certificate_name"`
}

type JWKSRetryPolicy struct {
	// NumRetries is the number of times to retry fetching the JWKS.
	// The retry strategy uses jittered exponential backoff with
	// a base interval of 1s and max of 10s.
	//
	// Default value is 0.
	NumRetries int `json:",omitempty" alias:"num_retries"`

	// Backoff policy
	//
	// Defaults to Envoy's backoff policy
	RetryPolicyBackOff *RetryPolicyBackOff `json:",omitempty" alias:"retry_policy_back_off"`
}

type RetryPolicyBackOff struct {
	// BaseInterval to be used for the next back off computation
	//
	// The default value from envoy is 1s
	BaseInterval time.Duration `json:",omitempty" alias:"base_interval"`

	// MaxInternal to be used to specify the maximum interval between retries.
	// Optional but should be greater or equal to BaseInterval.
	//
	// Defaults to 10 times BaseInterval
	MaxInterval time.Duration `json:",omitempty" alias:"max_interval"`
}

type JWTCacheConfig struct {
	// Size specifies the maximum number of JWT verification
	// results to cache.
	//
	// Defaults to 0, meaning that JWT caching is disabled.
	Size int `json:",omitempty"`
}

func (e *JWTProviderConfigEntry) GetKind() string {
	return JWTProvider
}

func (e *JWTProviderConfigEntry) GetName() string            { return e.Name }
func (e *JWTProviderConfigEntry) GetMeta() map[string]string { return e.Meta }
func (e *JWTProviderConfigEntry) GetCreateIndex() uint64     { return e.CreateIndex }
func (e *JWTProviderConfigEntry) GetModifyIndex() uint64     { return e.ModifyIndex }
func (e *JWTProviderConfigEntry) GetPartition() string       { return e.Partition }
func (e *JWTProviderConfigEntry) GetNamespace() string       { return e.Namespace }
