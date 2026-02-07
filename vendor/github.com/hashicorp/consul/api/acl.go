// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/mitchellh/mapstructure"
)

const (
	// ACLClientType is the client type token
	ACLClientType = "client"

	// ACLManagementType is the management type token
	ACLManagementType = "management"

	// ACLTemplatedPolicy names
	ACLTemplatedPolicyServiceName     = "builtin/service"
	ACLTemplatedPolicyNodeName        = "builtin/node"
	ACLTemplatedPolicyDNSName         = "builtin/dns"
	ACLTemplatedPolicyNomadServerName = "builtin/nomad-server"
	ACLTemplatedPolicyAPIGatewayName  = "builtin/api-gateway"
	ACLTemplatedPolicyNomadClientName = "builtin/nomad-client"
)

type ACLLink struct {
	ID   string
	Name string
}

type ACLTokenPolicyLink = ACLLink
type ACLTokenRoleLink = ACLLink

// ACLToken represents an ACL Token
type ACLToken struct {
	CreateIndex       uint64
	ModifyIndex       uint64
	AccessorID        string
	SecretID          string
	Description       string
	Policies          []*ACLTokenPolicyLink `json:",omitempty"`
	Roles             []*ACLTokenRoleLink   `json:",omitempty"`
	ServiceIdentities []*ACLServiceIdentity `json:",omitempty"`
	NodeIdentities    []*ACLNodeIdentity    `json:",omitempty"`
	TemplatedPolicies []*ACLTemplatedPolicy `json:",omitempty"`
	Local             bool
	AuthMethod        string        `json:",omitempty"`
	ExpirationTTL     time.Duration `json:",omitempty"`
	ExpirationTime    *time.Time    `json:",omitempty"`
	CreateTime        time.Time     `json:",omitempty"`
	Hash              []byte        `json:",omitempty"`

	// DEPRECATED (ACL-Legacy-Compat)
	// Rules are an artifact of legacy tokens deprecated in Consul 1.4
	Rules string `json:"-"`

	// Namespace is the namespace the ACLToken is associated with.
	// Namespaces are a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Partition is the partition the ACLToken is associated with.
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// AuthMethodNamespace is the namespace the token's AuthMethod is associated with.
	// Namespacing is a Consul Enterprise feature.
	AuthMethodNamespace string `json:",omitempty"`
}

type ACLTokenExpanded struct {
	ExpandedPolicies []ACLPolicy
	ExpandedRoles    []ACLRole

	NamespaceDefaultPolicyIDs []string
	NamespaceDefaultRoleIDs   []string

	AgentACLDefaultPolicy string
	AgentACLDownPolicy    string
	ResolvedByAgent       string

	ACLToken
}

type ACLTokenListEntry struct {
	CreateIndex       uint64
	ModifyIndex       uint64
	AccessorID        string
	SecretID          string
	Description       string
	Policies          []*ACLTokenPolicyLink `json:",omitempty"`
	Roles             []*ACLTokenRoleLink   `json:",omitempty"`
	ServiceIdentities []*ACLServiceIdentity `json:",omitempty"`
	NodeIdentities    []*ACLNodeIdentity    `json:",omitempty"`
	TemplatedPolicies []*ACLTemplatedPolicy `json:",omitempty"`
	Local             bool
	AuthMethod        string     `json:",omitempty"`
	ExpirationTime    *time.Time `json:",omitempty"`
	CreateTime        time.Time
	Hash              []byte
	Legacy            bool `json:"-"` // DEPRECATED

	// Namespace is the namespace the ACLTokenListEntry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Partition is the partition the ACLTokenListEntry is associated with.
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// AuthMethodNamespace is the namespace the token's AuthMethod is associated with.
	// Namespacing is a Consul Enterprise feature.
	AuthMethodNamespace string `json:",omitempty"`
}

// ACLEntry is used to represent a legacy ACL token
// The legacy tokens are deprecated.
type ACLEntry struct {
	CreateIndex uint64
	ModifyIndex uint64
	ID          string
	Name        string
	Type        string
	Rules       string
}

// ACLReplicationStatus is used to represent the status of ACL replication.
type ACLReplicationStatus struct {
	Enabled              bool
	Running              bool
	SourceDatacenter     string
	ReplicationType      string
	ReplicatedIndex      uint64
	ReplicatedRoleIndex  uint64
	ReplicatedTokenIndex uint64
	LastSuccess          time.Time
	LastError            time.Time
	LastErrorMessage     string
}

// ACLServiceIdentity represents a high-level grant of all necessary privileges
// to assume the identity of the named Service in the Catalog and within
// Connect.
type ACLServiceIdentity struct {
	ServiceName string
	Datacenters []string `json:",omitempty"`
}

// ACLNodeIdentity represents a high-level grant of all necessary privileges
// to assume the identity of the named Node in the Catalog and within Connect.
type ACLNodeIdentity struct {
	NodeName   string
	Datacenter string
}

// ACLTemplatedPolicy represents a template used to generate a `synthetic` policy
// given some input variables.
type ACLTemplatedPolicy struct {
	TemplateName      string
	TemplateVariables *ACLTemplatedPolicyVariables `json:",omitempty"`

	// Datacenters are an artifact of Nodeidentity & ServiceIdentity.
	// It is used to facilitate the future migration away from both
	Datacenters []string `json:",omitempty"`
}

type ACLTemplatedPolicyResponse struct {
	TemplateName string
	Schema       string
	Template     string
	Description  string
}

type ACLTemplatedPolicyVariables struct {
	Name string
}

// ACLPolicy represents an ACL Policy.
type ACLPolicy struct {
	ID          string
	Name        string
	Description string
	Rules       string
	Datacenters []string
	Hash        []byte
	CreateIndex uint64
	ModifyIndex uint64

	// Namespace is the namespace the ACLPolicy is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Partition is the partition the ACLPolicy is associated with.
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`
}

type ACLPolicyListEntry struct {
	ID          string
	Name        string
	Description string
	Datacenters []string
	Hash        []byte
	CreateIndex uint64
	ModifyIndex uint64

	// Namespace is the namespace the ACLPolicyListEntry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Partition is the partition the ACLPolicyListEntry is associated with.
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`
}

type ACLRolePolicyLink = ACLLink

// ACLRole represents an ACL Role.
type ACLRole struct {
	ID                string
	Name              string
	Description       string
	Policies          []*ACLRolePolicyLink  `json:",omitempty"`
	ServiceIdentities []*ACLServiceIdentity `json:",omitempty"`
	NodeIdentities    []*ACLNodeIdentity    `json:",omitempty"`
	TemplatedPolicies []*ACLTemplatedPolicy `json:",omitempty"`
	Hash              []byte
	CreateIndex       uint64
	ModifyIndex       uint64

	// Namespace is the namespace the ACLRole is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Partition is the partition the ACLRole is associated with.
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`
}

// BindingRuleBindType is the type of binding rule mechanism used.
type BindingRuleBindType string

const (
	// BindingRuleBindTypeService binds to a service identity with the given name.
	BindingRuleBindTypeService BindingRuleBindType = "service"

	// BindingRuleBindTypeRole binds to pre-existing roles with the given name.
	BindingRuleBindTypeRole BindingRuleBindType = "role"

	// BindingRuleBindTypeNode binds to a node identity with given name.
	BindingRuleBindTypeNode BindingRuleBindType = "node"

	// BindingRuleBindTypePolicy binds to a specific policy with given name.
	BindingRuleBindTypePolicy BindingRuleBindType = "policy"

	// BindingRuleBindTypeTemplatedPolicy binds to a templated policy with given template name and variables.
	BindingRuleBindTypeTemplatedPolicy BindingRuleBindType = "templated-policy"
)

type ACLBindingRule struct {
	ID          string
	Description string
	AuthMethod  string
	Selector    string
	BindType    BindingRuleBindType
	BindName    string
	BindVars    *ACLTemplatedPolicyVariables `json:",omitempty"`

	CreateIndex uint64
	ModifyIndex uint64

	// Namespace is the namespace the ACLBindingRule is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Partition is the partition the ACLBindingRule is associated with.
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`
}

type ACLAuthMethod struct {
	Name        string
	Type        string
	DisplayName string        `json:",omitempty"`
	Description string        `json:",omitempty"`
	MaxTokenTTL time.Duration `json:",omitempty"`

	// TokenLocality defines the kind of token that this auth method produces.
	// This can be either 'local' or 'global'. If empty 'local' is assumed.
	TokenLocality string `json:",omitempty"`

	// Configuration is arbitrary configuration for the auth method. This
	// should only contain primitive values and containers (such as lists and
	// maps).
	Config map[string]interface{}

	CreateIndex uint64
	ModifyIndex uint64

	// NamespaceRules apply only on auth methods defined in the default namespace.
	// Namespacing is a Consul Enterprise feature.
	NamespaceRules []*ACLAuthMethodNamespaceRule `json:",omitempty"`

	// Namespace is the namespace the ACLAuthMethod is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Partition is the partition the ACLAuthMethod is associated with.
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`
}

type ACLTokenFilterOptions struct {
	AuthMethod  string `json:",omitempty"`
	Policy      string `json:",omitempty"`
	Role        string `json:",omitempty"`
	ServiceName string `json:",omitempty"`
}

func (m *ACLAuthMethod) MarshalJSON() ([]byte, error) {
	type Alias ACLAuthMethod
	exported := &struct {
		MaxTokenTTL string `json:",omitempty"`
		*Alias
	}{
		MaxTokenTTL: m.MaxTokenTTL.String(),
		Alias:       (*Alias)(m),
	}
	if m.MaxTokenTTL == 0 {
		exported.MaxTokenTTL = ""
	}

	return json.Marshal(exported)
}

func (m *ACLAuthMethod) UnmarshalJSON(data []byte) error {
	type Alias ACLAuthMethod
	aux := &struct {
		MaxTokenTTL string
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	var err error
	if aux.MaxTokenTTL != "" {
		if m.MaxTokenTTL, err = time.ParseDuration(aux.MaxTokenTTL); err != nil {
			return err
		}
	}

	return nil
}

type ACLAuthMethodNamespaceRule struct {
	// Selector is an expression that matches against verified identity
	// attributes returned from the auth method during login.
	Selector string `json:",omitempty"`

	// BindNamespace is the target namespace of the binding. Can be lightly
	// templated using HIL ${foo} syntax from available field names.
	//
	// If empty it's created in the same namespace as the auth method.
	BindNamespace string `json:",omitempty"`
}

type ACLAuthMethodListEntry struct {
	Name        string
	Type        string
	DisplayName string        `json:",omitempty"`
	Description string        `json:",omitempty"`
	MaxTokenTTL time.Duration `json:",omitempty"`

	// TokenLocality defines the kind of token that this auth method produces.
	// This can be either 'local' or 'global'. If empty 'local' is assumed.
	TokenLocality string `json:",omitempty"`
	CreateIndex   uint64
	ModifyIndex   uint64

	// Namespace is the namespace the ACLAuthMethodListEntry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// Partition is the partition the ACLAuthMethodListEntry is associated with.
	// Partitions are a Consul Enterprise feature.
	Partition string `json:",omitempty"`
}

// This is nearly identical to the ACLAuthMethod MarshalJSON
func (m *ACLAuthMethodListEntry) MarshalJSON() ([]byte, error) {
	type Alias ACLAuthMethodListEntry
	exported := &struct {
		MaxTokenTTL string `json:",omitempty"`
		*Alias
	}{
		MaxTokenTTL: m.MaxTokenTTL.String(),
		Alias:       (*Alias)(m),
	}
	if m.MaxTokenTTL == 0 {
		exported.MaxTokenTTL = ""
	}

	return json.Marshal(exported)
}

// This is nearly identical to the ACLAuthMethod UnmarshalJSON
func (m *ACLAuthMethodListEntry) UnmarshalJSON(data []byte) error {
	type Alias ACLAuthMethodListEntry
	aux := &struct {
		MaxTokenTTL string
		*Alias
	}{
		Alias: (*Alias)(m),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	var err error
	if aux.MaxTokenTTL != "" {
		if m.MaxTokenTTL, err = time.ParseDuration(aux.MaxTokenTTL); err != nil {
			return err
		}
	}

	return nil
}

// ParseKubernetesAuthMethodConfig takes a raw config map and returns a parsed
// KubernetesAuthMethodConfig.
func ParseKubernetesAuthMethodConfig(raw map[string]interface{}) (*KubernetesAuthMethodConfig, error) {
	var config KubernetesAuthMethodConfig
	decodeConf := &mapstructure.DecoderConfig{
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

// KubernetesAuthMethodConfig is the config for the built-in Consul auth method
// for Kubernetes.
type KubernetesAuthMethodConfig struct {
	Host              string `json:",omitempty"`
	CACert            string `json:",omitempty"`
	ServiceAccountJWT string `json:",omitempty"`
}

// RenderToConfig converts this into a map[string]interface{} suitable for use
// in the ACLAuthMethod.Config field.
func (c *KubernetesAuthMethodConfig) RenderToConfig() map[string]interface{} {
	return map[string]interface{}{
		"Host":              c.Host,
		"CACert":            c.CACert,
		"ServiceAccountJWT": c.ServiceAccountJWT,
	}
}

// OIDCAuthMethodConfig is the config for the built-in Consul auth method for
// OIDC and JWT.
type OIDCAuthMethodConfig struct {
	// common for type=oidc and type=jwt
	JWTSupportedAlgs    []string          `json:",omitempty"`
	BoundAudiences      []string          `json:",omitempty"`
	ClaimMappings       map[string]string `json:",omitempty"`
	ListClaimMappings   map[string]string `json:",omitempty"`
	OIDCDiscoveryURL    string            `json:",omitempty"`
	OIDCDiscoveryCACert string            `json:",omitempty"`
	// just for type=oidc
	OIDCClientID        string   `json:",omitempty"`
	OIDCClientSecret    string   `json:",omitempty"`
	OIDCScopes          []string `json:",omitempty"`
	OIDCACRValues       []string `json:",omitempty"`
	AllowedRedirectURIs []string `json:",omitempty"`
	VerboseOIDCLogging  bool     `json:",omitempty"`
	// just for type=jwt
	JWKSURL              string        `json:",omitempty"`
	JWKSCACert           string        `json:",omitempty"`
	JWTValidationPubKeys []string      `json:",omitempty"`
	BoundIssuer          string        `json:",omitempty"`
	ExpirationLeeway     time.Duration `json:",omitempty"`
	NotBeforeLeeway      time.Duration `json:",omitempty"`
	ClockSkewLeeway      time.Duration `json:",omitempty"`
}

// RenderToConfig converts this into a map[string]interface{} suitable for use
// in the ACLAuthMethod.Config field.
func (c *OIDCAuthMethodConfig) RenderToConfig() map[string]interface{} {
	return map[string]interface{}{
		// common for type=oidc and type=jwt
		"JWTSupportedAlgs":    c.JWTSupportedAlgs,
		"BoundAudiences":      c.BoundAudiences,
		"ClaimMappings":       c.ClaimMappings,
		"ListClaimMappings":   c.ListClaimMappings,
		"OIDCDiscoveryURL":    c.OIDCDiscoveryURL,
		"OIDCDiscoveryCACert": c.OIDCDiscoveryCACert,
		// just for type=oidc
		"OIDCClientID":        c.OIDCClientID,
		"OIDCClientSecret":    c.OIDCClientSecret,
		"OIDCScopes":          c.OIDCScopes,
		"OIDCACRValues":       c.OIDCACRValues,
		"AllowedRedirectURIs": c.AllowedRedirectURIs,
		"VerboseOIDCLogging":  c.VerboseOIDCLogging,
		// just for type=jwt
		"JWKSURL":              c.JWKSURL,
		"JWKSCACert":           c.JWKSCACert,
		"JWTValidationPubKeys": c.JWTValidationPubKeys,
		"BoundIssuer":          c.BoundIssuer,
		"ExpirationLeeway":     c.ExpirationLeeway,
		"NotBeforeLeeway":      c.NotBeforeLeeway,
		"ClockSkewLeeway":      c.ClockSkewLeeway,
	}
}

type ACLLoginParams struct {
	AuthMethod  string
	BearerToken string
	Meta        map[string]string `json:",omitempty"`
}

type ACLOIDCAuthURLParams struct {
	AuthMethod  string
	RedirectURI string
	ClientNonce string
	Meta        map[string]string `json:",omitempty"`
}

// ACL can be used to query the ACL endpoints
type ACL struct {
	c *Client
}

// ACL returns a handle to the ACL endpoints
func (c *Client) ACL() *ACL {
	return &ACL{c}
}

// BootstrapRequest is used for when operators provide an ACL Bootstrap Token
type BootstrapRequest struct {
	BootstrapSecret string
}

// Bootstrap is used to perform a one-time ACL bootstrap operation on a cluster
// to get the first management token.
func (a *ACL) Bootstrap() (*ACLToken, *WriteMeta, error) {
	return a.BootstrapWithToken("")
}

// BootstrapWithToken is used to get the initial bootstrap token or pass in the one that was provided in the API
func (a *ACL) BootstrapWithToken(btoken string) (*ACLToken, *WriteMeta, error) {
	r := a.c.newRequest("PUT", "/v1/acl/bootstrap")
	if btoken != "" {
		r.obj = &BootstrapRequest{
			BootstrapSecret: btoken,
		}
	}
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLToken
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, wm, nil
}

// Create is used to generate a new token with the given parameters
//
// Deprecated: Use TokenCreate instead.
func (a *ACL) Create(acl *ACLEntry, q *WriteOptions) (string, *WriteMeta, error) {
	r := a.c.newRequest("PUT", "/v1/acl/create")
	r.setWriteOptions(q)
	r.obj = acl
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return "", nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return "", nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	var out struct{ ID string }
	if err := decodeBody(resp, &out); err != nil {
		return "", nil, err
	}
	return out.ID, wm, nil
}

// Update is used to update the rules of an existing token
//
// Deprecated: Use TokenUpdate instead.
func (a *ACL) Update(acl *ACLEntry, q *WriteOptions) (*WriteMeta, error) {
	r := a.c.newRequest("PUT", "/v1/acl/update")
	r.setWriteOptions(q)
	r.obj = acl
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// Destroy is used to destroy a given ACL token ID
//
// Deprecated: Use TokenDelete instead.
func (a *ACL) Destroy(id string, q *WriteOptions) (*WriteMeta, error) {
	r := a.c.newRequest("PUT", "/v1/acl/destroy/"+id)
	r.setWriteOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	closeResponseBody(resp)

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// Clone is used to return a new token cloned from an existing one
//
// Deprecated: Use TokenClone instead.
func (a *ACL) Clone(id string, q *WriteOptions) (string, *WriteMeta, error) {
	r := a.c.newRequest("PUT", "/v1/acl/clone/"+id)
	r.setWriteOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return "", nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return "", nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	var out struct{ ID string }
	if err := decodeBody(resp, &out); err != nil {
		return "", nil, err
	}
	return out.ID, wm, nil
}

// Info is used to query for information about an ACL token
//
// Deprecated: Use TokenRead instead.
func (a *ACL) Info(id string, q *QueryOptions) (*ACLEntry, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/info/"+id)
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

	var entries []*ACLEntry
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	if len(entries) > 0 {
		return entries[0], qm, nil
	}
	return nil, qm, nil
}

// List is used to get all the ACL tokens
//
// Deprecated: Use TokenList instead.
func (a *ACL) List(q *QueryOptions) ([]*ACLEntry, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/list")
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

	var entries []*ACLEntry
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// Replication returns the status of the ACL replication process in the datacenter
func (a *ACL) Replication(q *QueryOptions) (*ACLReplicationStatus, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/replication")
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

	var entries *ACLReplicationStatus
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// TokenCreate creates a new ACL token. If either the AccessorID or SecretID fields
// of the ACLToken structure are empty they will be filled in by Consul.
func (a *ACL) TokenCreate(token *ACLToken, q *WriteOptions) (*ACLToken, *WriteMeta, error) {
	r := a.c.newRequest("PUT", "/v1/acl/token")
	r.setWriteOptions(q)
	r.obj = token
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLToken
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// TokenUpdate updates a token in place without modifying its AccessorID or SecretID. A valid
// AccessorID must be set in the ACLToken structure passed to this function but the SecretID may
// be omitted and will be filled in by Consul with its existing value.
func (a *ACL) TokenUpdate(token *ACLToken, q *WriteOptions) (*ACLToken, *WriteMeta, error) {
	if token.AccessorID == "" {
		return nil, nil, fmt.Errorf("Must specify an AccessorID for Token Updating")
	}
	r := a.c.newRequest("PUT", "/v1/acl/token/"+token.AccessorID)
	r.setWriteOptions(q)
	r.obj = token
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLToken
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// TokenClone will create a new token with the same policies and locality as the original
// token but will have its own auto-generated AccessorID and SecretID as well having the
// description passed to this function. The accessorID parameter must be a valid Accessor ID
// of an existing token.
func (a *ACL) TokenClone(accessorID string, description string, q *WriteOptions) (*ACLToken, *WriteMeta, error) {
	if accessorID == "" {
		return nil, nil, fmt.Errorf("Must specify a token AccessorID for Token Cloning")
	}

	r := a.c.newRequest("PUT", "/v1/acl/token/"+accessorID+"/clone")
	r.setWriteOptions(q)
	r.obj = struct{ Description string }{description}
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLToken
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// TokenDelete removes a single ACL token. The accessorID parameter must be a valid
// Accessor ID of an existing token.
func (a *ACL) TokenDelete(accessorID string, q *WriteOptions) (*WriteMeta, error) {
	r := a.c.newRequest("DELETE", "/v1/acl/token/"+accessorID)
	r.setWriteOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	closeResponseBody(resp)

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// TokenRead retrieves the full token details. The accessorID parameter must be a valid
// Accessor ID of an existing token.
func (a *ACL) TokenRead(accessorID string, q *QueryOptions) (*ACLToken, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/token/"+accessorID)
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

	var out ACLToken
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// TokenReadExpanded retrieves the full token details, as well as the contents of any policies affecting the token.
// The accessorID parameter must be a valid Accessor ID of an existing token.
func (a *ACL) TokenReadExpanded(accessorID string, q *QueryOptions) (*ACLTokenExpanded, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/token/"+accessorID)
	r.setQueryOptions(q)
	r.params.Set("expanded", "true")
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

	var out ACLTokenExpanded
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// TokenReadSelf retrieves the full token details of the token currently
// assigned to the API Client. In this manner its possible to read a token
// by its Secret ID.
func (a *ACL) TokenReadSelf(q *QueryOptions) (*ACLToken, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/token/self")
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

	var out ACLToken
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// TokenList lists all tokens. The listing does not contain any SecretIDs as those
// may only be retrieved by a call to TokenRead.
func (a *ACL) TokenList(q *QueryOptions) ([]*ACLTokenListEntry, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/tokens")
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

	var entries []*ACLTokenListEntry
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// TokenListFiltered lists all tokens that match the given filter options.
// The listing does not contain any SecretIDs as those may only be retrieved by a call to TokenRead.
func (a *ACL) TokenListFiltered(t ACLTokenFilterOptions, q *QueryOptions) ([]*ACLTokenListEntry, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/tokens")
	r.setQueryOptions(q)

	if t.AuthMethod != "" {
		r.params.Set("authmethod", t.AuthMethod)
	}
	if t.Policy != "" {
		r.params.Set("policy", t.Policy)
	}
	if t.Role != "" {
		r.params.Set("role", t.Role)
	}
	if t.ServiceName != "" {
		r.params.Set("servicename", t.ServiceName)
	}

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

	var entries []*ACLTokenListEntry
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// PolicyCreate will create a new policy. It is not allowed for the policy parameters
// ID field to be set as this will be generated by Consul while processing the request.
func (a *ACL) PolicyCreate(policy *ACLPolicy, q *WriteOptions) (*ACLPolicy, *WriteMeta, error) {
	if policy.ID != "" {
		return nil, nil, fmt.Errorf("Cannot specify an ID in Policy Creation")
	}
	r := a.c.newRequest("PUT", "/v1/acl/policy")
	r.setWriteOptions(q)
	r.obj = policy
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLPolicy
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// PolicyUpdate updates a policy. The ID field of the policy parameter must be set to an
// existing policy ID
func (a *ACL) PolicyUpdate(policy *ACLPolicy, q *WriteOptions) (*ACLPolicy, *WriteMeta, error) {
	if policy.ID == "" {
		return nil, nil, fmt.Errorf("Must specify an ID in Policy Update")
	}

	r := a.c.newRequest("PUT", "/v1/acl/policy/"+policy.ID)
	r.setWriteOptions(q)
	r.obj = policy
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLPolicy
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// PolicyDelete deletes a policy given its ID.
func (a *ACL) PolicyDelete(policyID string, q *WriteOptions) (*WriteMeta, error) {
	r := a.c.newRequest("DELETE", "/v1/acl/policy/"+policyID)
	r.setWriteOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// PolicyRead retrieves the policy details including the rule set.
func (a *ACL) PolicyRead(policyID string, q *QueryOptions) (*ACLPolicy, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/policy/"+policyID)
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

	var out ACLPolicy
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// PolicyReadByName retrieves the policy details including the rule set with name.
func (a *ACL) PolicyReadByName(policyName string, q *QueryOptions) (*ACLPolicy, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/policy/name/"+url.QueryEscape(policyName))
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	found, resp, err := requireNotFoundOrOK(resp)
	if err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if !found {
		return nil, qm, nil
	}

	var out ACLPolicy
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// PolicyList retrieves a listing of all policies. The listing does not include the
// rules for any policy as those should be retrieved by subsequent calls to PolicyRead.
func (a *ACL) PolicyList(q *QueryOptions) ([]*ACLPolicyListEntry, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/policies")
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

	var entries []*ACLPolicyListEntry
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// RulesTranslate translates the legacy rule syntax into the current syntax.
//
// Deprecated: Support for the legacy syntax translation has been removed.
// This function always returns an error.
func (a *ACL) RulesTranslate(rules io.Reader) (string, error) {
	return "", fmt.Errorf("Legacy ACL rules were deprecated in Consul 1.4")
}

// RulesTranslateToken translates the rules associated with the legacy syntax
// into the current syntax and returns the results.
//
// Deprecated: Support for the legacy syntax translation has been removed.
// This function always returns an error.
func (a *ACL) RulesTranslateToken(tokenID string) (string, error) {
	return "", fmt.Errorf("Legacy ACL tokens and rules were deprecated in Consul 1.4")
}

// RoleCreate will create a new role. It is not allowed for the role parameters
// ID field to be set as this will be generated by Consul while processing the request.
func (a *ACL) RoleCreate(role *ACLRole, q *WriteOptions) (*ACLRole, *WriteMeta, error) {
	if role.ID != "" {
		return nil, nil, fmt.Errorf("Cannot specify an ID in Role Creation")
	}

	r := a.c.newRequest("PUT", "/v1/acl/role")
	r.setWriteOptions(q)
	r.obj = role
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLRole
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// RoleUpdate updates a role. The ID field of the role parameter must be set to an
// existing role ID
func (a *ACL) RoleUpdate(role *ACLRole, q *WriteOptions) (*ACLRole, *WriteMeta, error) {
	if role.ID == "" {
		return nil, nil, fmt.Errorf("Must specify an ID in Role Update")
	}

	r := a.c.newRequest("PUT", "/v1/acl/role/"+role.ID)
	r.setWriteOptions(q)
	r.obj = role
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLRole
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// RoleDelete deletes a role given its ID.
func (a *ACL) RoleDelete(roleID string, q *WriteOptions) (*WriteMeta, error) {
	r := a.c.newRequest("DELETE", "/v1/acl/role/"+roleID)
	r.setWriteOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	closeResponseBody(resp)

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// RoleRead retrieves the role details (by ID). Returns nil if not found.
func (a *ACL) RoleRead(roleID string, q *QueryOptions) (*ACLRole, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/role/"+roleID)
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	found, resp, err := requireNotFoundOrOK(resp)
	if err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if !found {
		return nil, qm, nil
	}

	var out ACLRole
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// RoleReadByName retrieves the role details (by name). Returns nil if not found.
func (a *ACL) RoleReadByName(roleName string, q *QueryOptions) (*ACLRole, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/role/name/"+url.QueryEscape(roleName))
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	found, resp, err := requireNotFoundOrOK(resp)
	if err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if !found {
		return nil, qm, nil
	}

	var out ACLRole
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// RoleList retrieves a listing of all roles. The listing does not include some
// metadata for the role as those should be retrieved by subsequent calls to
// RoleRead.
func (a *ACL) RoleList(q *QueryOptions) ([]*ACLRole, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/roles")
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

	var entries []*ACLRole
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// AuthMethodCreate will create a new auth method.
func (a *ACL) AuthMethodCreate(method *ACLAuthMethod, q *WriteOptions) (*ACLAuthMethod, *WriteMeta, error) {
	if method.Name == "" {
		return nil, nil, fmt.Errorf("Must specify a Name in Auth Method Creation")
	}

	r := a.c.newRequest("PUT", "/v1/acl/auth-method")
	r.setWriteOptions(q)
	r.obj = method
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLAuthMethod
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// AuthMethodUpdate updates an auth method.
func (a *ACL) AuthMethodUpdate(method *ACLAuthMethod, q *WriteOptions) (*ACLAuthMethod, *WriteMeta, error) {
	if method.Name == "" {
		return nil, nil, fmt.Errorf("Must specify a Name in Auth Method Update")
	}

	r := a.c.newRequest("PUT", "/v1/acl/auth-method/"+url.QueryEscape(method.Name))
	r.setWriteOptions(q)
	r.obj = method
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLAuthMethod
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// AuthMethodDelete deletes an auth method given its Name.
func (a *ACL) AuthMethodDelete(methodName string, q *WriteOptions) (*WriteMeta, error) {
	if methodName == "" {
		return nil, fmt.Errorf("Must specify a Name in Auth Method Delete")
	}

	r := a.c.newRequest("DELETE", "/v1/acl/auth-method/"+url.QueryEscape(methodName))
	r.setWriteOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	closeResponseBody(resp)

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// AuthMethodRead retrieves the auth method. Returns nil if not found.
func (a *ACL) AuthMethodRead(methodName string, q *QueryOptions) (*ACLAuthMethod, *QueryMeta, error) {
	if methodName == "" {
		return nil, nil, fmt.Errorf("Must specify a Name in Auth Method Read")
	}

	r := a.c.newRequest("GET", "/v1/acl/auth-method/"+url.QueryEscape(methodName))
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	found, resp, err := requireNotFoundOrOK(resp)
	if err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if !found {
		return nil, qm, nil
	}

	var out ACLAuthMethod
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// AuthMethodList retrieves a listing of all auth methods. The listing does not
// include some metadata for the auth method as those should be retrieved by
// subsequent calls to AuthMethodRead.
func (a *ACL) AuthMethodList(q *QueryOptions) ([]*ACLAuthMethodListEntry, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/auth-methods")
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

	var entries []*ACLAuthMethodListEntry
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// BindingRuleCreate will create a new binding rule. It is not allowed for the
// binding rule parameter's ID field to be set as this will be generated by
// Consul while processing the request.
func (a *ACL) BindingRuleCreate(rule *ACLBindingRule, q *WriteOptions) (*ACLBindingRule, *WriteMeta, error) {
	if rule.ID != "" {
		return nil, nil, fmt.Errorf("Cannot specify an ID in Binding Rule Creation")
	}

	r := a.c.newRequest("PUT", "/v1/acl/binding-rule")
	r.setWriteOptions(q)
	r.obj = rule
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLBindingRule
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// BindingRuleUpdate updates a binding rule. The ID field of the role binding
// rule parameter must be set to an existing binding rule ID.
func (a *ACL) BindingRuleUpdate(rule *ACLBindingRule, q *WriteOptions) (*ACLBindingRule, *WriteMeta, error) {
	if rule.ID == "" {
		return nil, nil, fmt.Errorf("Must specify an ID in Binding Rule Update")
	}

	r := a.c.newRequest("PUT", "/v1/acl/binding-rule/"+rule.ID)
	r.setWriteOptions(q)
	r.obj = rule
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLBindingRule
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, wm, nil
}

// BindingRuleDelete deletes a binding rule given its ID.
func (a *ACL) BindingRuleDelete(bindingRuleID string, q *WriteOptions) (*WriteMeta, error) {
	r := a.c.newRequest("DELETE", "/v1/acl/binding-rule/"+bindingRuleID)
	r.setWriteOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// BindingRuleRead retrieves the binding rule details. Returns nil if not found.
func (a *ACL) BindingRuleRead(bindingRuleID string, q *QueryOptions) (*ACLBindingRule, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/binding-rule/"+bindingRuleID)
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	found, resp, err := requireNotFoundOrOK(resp)
	if err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if !found {
		return nil, qm, nil
	}

	var out ACLBindingRule
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// BindingRuleList retrieves a listing of all binding rules.
func (a *ACL) BindingRuleList(methodName string, q *QueryOptions) ([]*ACLBindingRule, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/binding-rules")
	if methodName != "" {
		r.params.Set("authmethod", methodName)
	}
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

	var entries []*ACLBindingRule
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// Login is used to exchange auth method credentials for a newly-minted Consul Token.
func (a *ACL) Login(auth *ACLLoginParams, q *WriteOptions) (*ACLToken, *WriteMeta, error) {
	r := a.c.newRequest("POST", "/v1/acl/login")
	r.setWriteOptions(q)
	r.obj = auth

	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLToken
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, wm, nil
}

// Logout is used to destroy a Consul Token created via Login().
func (a *ACL) Logout(q *WriteOptions) (*WriteMeta, error) {
	r := a.c.newRequest("POST", "/v1/acl/logout")
	r.setWriteOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	closeResponseBody(resp)

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// OIDCAuthURL requests an authorization URL to start an OIDC login flow.
func (a *ACL) OIDCAuthURL(auth *ACLOIDCAuthURLParams, q *WriteOptions) (string, *WriteMeta, error) {
	if auth.AuthMethod == "" {
		return "", nil, fmt.Errorf("Must specify an auth method name")
	}

	r := a.c.newRequest("POST", "/v1/acl/oidc/auth-url")
	r.setWriteOptions(q)
	r.obj = auth

	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return "", nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return "", nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	var out aclOIDCAuthURLResponse
	if err := decodeBody(resp, &out); err != nil {
		return "", nil, err
	}
	return out.AuthURL, wm, nil
}

type aclOIDCAuthURLResponse struct {
	AuthURL string
}

type ACLOIDCCallbackParams struct {
	AuthMethod  string
	State       string
	Code        string
	ClientNonce string
}

// OIDCCallback is the callback endpoint to complete an OIDC login.
func (a *ACL) OIDCCallback(auth *ACLOIDCCallbackParams, q *WriteOptions) (*ACLToken, *WriteMeta, error) {
	if auth.AuthMethod == "" {
		return nil, nil, fmt.Errorf("Must specify an auth method name")
	}

	r := a.c.newRequest("POST", "/v1/acl/oidc/callback")
	r.setWriteOptions(q)
	r.obj = auth

	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLToken
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, wm, nil
}

// TemplatedPolicyReadByName retrieves the templated policy details (by name). Returns nil if not found.
func (a *ACL) TemplatedPolicyReadByName(templateName string, q *QueryOptions) (*ACLTemplatedPolicyResponse, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/templated-policy/name/"+templateName)
	r.setQueryOptions(q)
	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	found, resp, err := requireNotFoundOrOK(resp)
	if err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if !found {
		return nil, qm, nil
	}

	var out ACLTemplatedPolicyResponse
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}

	return &out, qm, nil
}

// TemplatedPolicyList retrieves a listing of all templated policies.
func (a *ACL) TemplatedPolicyList(q *QueryOptions) (map[string]ACLTemplatedPolicyResponse, *QueryMeta, error) {
	r := a.c.newRequest("GET", "/v1/acl/templated-policies")
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

	var entries map[string]ACLTemplatedPolicyResponse
	if err := decodeBody(resp, &entries); err != nil {
		return nil, nil, err
	}
	return entries, qm, nil
}

// TemplatedPolicyPreview is used to preview the policy rendered by the templated policy.
func (a *ACL) TemplatedPolicyPreview(tp *ACLTemplatedPolicy, q *WriteOptions) (*ACLPolicy, *WriteMeta, error) {
	r := a.c.newRequest("POST", "/v1/acl/templated-policy/preview/"+tp.TemplateName)
	r.setWriteOptions(q)
	r.obj = tp.TemplateVariables

	rtt, resp, err := a.c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}
	wm := &WriteMeta{RequestTime: rtt}
	var out ACLPolicy
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, wm, nil
}
