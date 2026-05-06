// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"encoding/json"
)

// MeshConfigEntry manages the global configuration for all service mesh
// proxies.
type MeshConfigEntry struct {
	// Partition is the partition the MeshConfigEntry applies to.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the MeshConfigEntry applies to.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// TransparentProxy applies configuration specific to proxies
	// in transparent mode.
	TransparentProxy TransparentProxyMeshConfig `alias:"transparent_proxy"`

	// AllowEnablingPermissiveMutualTLS must be true in order to allow setting
	// MutualTLSMode=permissive in either service-defaults or proxy-defaults.
	AllowEnablingPermissiveMutualTLS bool `json:",omitempty" alias:"allow_enabling_permissive_mutual_tls"`

	// ValidateClusters controls whether the clusters the route table refers to are validated. The default value is
	// false. When set to false and a route refers to a cluster that does not exist, the route table loads and routing
	// to a non-existent cluster results in a 404. When set to true and the route is set to a cluster that do not exist,
	// the route table will not load. For more information, refer to
	// [HTTP route configuration in the Envoy docs](https://www.envoyproxy.io/docs/envoy/latest/api-v3/config/route/v3/route.proto#envoy-v3-api-field-config-route-v3-routeconfiguration-validate-clusters)
	// for more details.
	ValidateClusters bool `json:",omitempty" alias:"validate_clusters"`

	TLS *MeshTLSConfig `json:",omitempty"`

	HTTP *MeshHTTPConfig `json:",omitempty"`

	Peering *PeeringMeshConfig `json:",omitempty"`

	Meta map[string]string `json:",omitempty"`

	// CreateIndex is the Raft index this entry was created at. This is a
	// read-only field.
	CreateIndex uint64

	// ModifyIndex is used for the Check-And-Set operations and can also be fed
	// back into the WaitIndex of the QueryOptions in order to perform blocking
	// queries.
	ModifyIndex uint64
}

type TransparentProxyMeshConfig struct {
	MeshDestinationsOnly bool `alias:"mesh_destinations_only"`
}

type MeshTLSConfig struct {
	Incoming *MeshDirectionalTLSConfig `json:",omitempty"`
	Outgoing *MeshDirectionalTLSConfig `json:",omitempty"`
}

type MeshDirectionalTLSConfig struct {
	TLSMinVersion string   `json:",omitempty" alias:"tls_min_version"`
	TLSMaxVersion string   `json:",omitempty" alias:"tls_max_version"`
	CipherSuites  []string `json:",omitempty" alias:"cipher_suites"`
}

type MeshHTTPConfig struct {
	SanitizeXForwardedClientCert bool `alias:"sanitize_x_forwarded_client_cert"`
	// Incoming configures settings for incoming HTTP traffic to mesh proxies.
	Incoming *MeshDirectionalHTTPConfig `json:",omitempty"`
}

// MeshDirectionalHTTPConfig holds mesh configuration specific to HTTP
// requests for a given traffic direction.
type MeshDirectionalHTTPConfig struct {
	RequestNormalization *RequestNormalizationMeshConfig `json:",omitempty" alias:"request_normalization"`
}

type PeeringMeshConfig struct {
	PeerThroughMeshGateways bool `json:",omitempty" alias:"peer_through_mesh_gateways"`
}

// RequestNormalizationMeshConfig contains options pertaining to the
// normalization of HTTP requests processed by mesh proxies.
type RequestNormalizationMeshConfig struct {
	// InsecureDisablePathNormalization sets the value of the \`normalize_path\` option in the Envoy listener's
	// `HttpConnectionManager`. The default value is \`false\`. When set to \`true\` in Consul, \`normalize_path\` is
	// set to \`false\` for the Envoy proxy. This parameter disables the normalization of request URL paths according to
	// RFC 3986, conversion of \`\\\` to \`/\`, and decoding non-reserved %-encoded characters. When using L7 intentions
	// with path match rules, we recommend enabling path normalization in order to avoid match rule circumvention with
	// non-normalized path values.
	InsecureDisablePathNormalization bool `json:",omitempty" alias:"insecure_disable_path_normalization"`
	// MergeSlashes sets the value of the \`merge_slashes\` option in the Envoy listener's \`HttpConnectionManager\`.
	// The default value is \`false\`. This option controls the normalization of request URL paths by merging
	// consecutive \`/\` characters. This normalization is not part of RFC 3986. When using L7 intentions with path
	// match rules, we recommend enabling this setting to avoid match rule circumvention through non-normalized path
	// values, unless legitimate service traffic depends on allowing for repeat \`/\` characters, or upstream services
	// are configured to differentiate between single and multiple slashes.
	MergeSlashes bool `json:",omitempty" alias:"merge_slashes"`
	// PathWithEscapedSlashesAction sets the value of the \`path_with_escaped_slashes_action\` option in the Envoy
	// listener's \`HttpConnectionManager\`. The default value of this option is empty, which is equivalent to
	// \`IMPLEMENTATION_SPECIFIC_DEFAULT\`. This parameter controls the action taken in response to request URL paths
	// with escaped slashes in the path. When using L7 intentions with path match rules, we recommend enabling this
	// setting to avoid match rule circumvention through non-normalized path values, unless legitimate service traffic
	// depends on allowing for escaped \`/\` or \`\\\` characters, or upstream services are configured to differentiate
	// between escaped and unescaped slashes. Refer to the Envoy documentation for more information on available
	// options.
	PathWithEscapedSlashesAction string `json:",omitempty" alias:"path_with_escaped_slashes_action"`
	// HeadersWithUnderscoresAction sets the value of the \`headers_with_underscores_action\` option in the Envoy
	// listener's \`HttpConnectionManager\` under \`common_http_protocol_options\`. The default value of this option is
	// empty, which is equivalent to \`ALLOW\`. Refer to the Envoy documentation for more information on available
	// options.
	HeadersWithUnderscoresAction string `json:",omitempty" alias:"headers_with_underscores_action"`
}

func (e *MeshConfigEntry) GetKind() string            { return MeshConfig }
func (e *MeshConfigEntry) GetName() string            { return MeshConfigMesh }
func (e *MeshConfigEntry) GetPartition() string       { return e.Partition }
func (e *MeshConfigEntry) GetNamespace() string       { return e.Namespace }
func (e *MeshConfigEntry) GetMeta() map[string]string { return e.Meta }
func (e *MeshConfigEntry) GetCreateIndex() uint64     { return e.CreateIndex }
func (e *MeshConfigEntry) GetModifyIndex() uint64     { return e.ModifyIndex }

// MarshalJSON adds the Kind field so that the JSON can be decoded back into the
// correct type.
func (e *MeshConfigEntry) MarshalJSON() ([]byte, error) {
	type Alias MeshConfigEntry
	source := &struct {
		Kind string
		*Alias
	}{
		Kind:  MeshConfig,
		Alias: (*Alias)(e),
	}
	return json.Marshal(source)
}
