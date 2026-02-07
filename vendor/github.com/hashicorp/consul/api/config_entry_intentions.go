// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import "time"

type ServiceIntentionsConfigEntry struct {
	Kind      string
	Name      string
	Partition string `json:",omitempty"`
	Namespace string `json:",omitempty"`

	Sources []*SourceIntention
	JWT     *IntentionJWTRequirement `json:",omitempty"`

	Meta map[string]string `json:",omitempty"`

	CreateIndex uint64
	ModifyIndex uint64
}

type SourceIntention struct {
	Name          string
	Peer          string                 `json:",omitempty"`
	Partition     string                 `json:",omitempty"`
	Namespace     string                 `json:",omitempty"`
	SamenessGroup string                 `json:",omitempty" alias:"sameness_group"`
	Action        IntentionAction        `json:",omitempty"`
	Permissions   []*IntentionPermission `json:",omitempty"`
	Precedence    int
	Type          IntentionSourceType
	Description   string `json:",omitempty"`

	LegacyID         string            `json:",omitempty" alias:"legacy_id"`
	LegacyMeta       map[string]string `json:",omitempty" alias:"legacy_meta"`
	LegacyCreateTime *time.Time        `json:",omitempty" alias:"legacy_create_time"`
	LegacyUpdateTime *time.Time        `json:",omitempty" alias:"legacy_update_time"`
}

func (e *ServiceIntentionsConfigEntry) GetKind() string            { return e.Kind }
func (e *ServiceIntentionsConfigEntry) GetName() string            { return e.Name }
func (e *ServiceIntentionsConfigEntry) GetPartition() string       { return e.Partition }
func (e *ServiceIntentionsConfigEntry) GetNamespace() string       { return e.Namespace }
func (e *ServiceIntentionsConfigEntry) GetMeta() map[string]string { return e.Meta }
func (e *ServiceIntentionsConfigEntry) GetCreateIndex() uint64     { return e.CreateIndex }
func (e *ServiceIntentionsConfigEntry) GetModifyIndex() uint64     { return e.ModifyIndex }

type IntentionPermission struct {
	Action IntentionAction
	HTTP   *IntentionHTTPPermission `json:",omitempty"`
	JWT    *IntentionJWTRequirement `json:",omitempty"`
}

type IntentionHTTPPermission struct {
	PathExact  string `json:",omitempty" alias:"path_exact"`
	PathPrefix string `json:",omitempty" alias:"path_prefix"`
	PathRegex  string `json:",omitempty" alias:"path_regex"`

	Header []IntentionHTTPHeaderPermission `json:",omitempty"`

	Methods []string `json:",omitempty"`
}

type IntentionHTTPHeaderPermission struct {
	Name       string
	Present    bool   `json:",omitempty"`
	Exact      string `json:",omitempty"`
	Prefix     string `json:",omitempty"`
	Suffix     string `json:",omitempty"`
	Contains   string `json:",omitempty"`
	Regex      string `json:",omitempty"`
	Invert     bool   `json:",omitempty"`
	IgnoreCase bool   `json:",omitempty" alias:"ignore_case"`
}

type IntentionJWTRequirement struct {
	// Providers is a list of providers to consider when verifying a JWT.
	Providers []*IntentionJWTProvider `json:",omitempty"`
}

type IntentionJWTProvider struct {
	// Name is the name of the JWT provider. There MUST be a corresponding
	// "jwt-provider" config entry with this name.
	Name string `json:",omitempty"`

	// VerifyClaims is a list of additional claims to verify in a JWT's payload.
	VerifyClaims []*IntentionJWTClaimVerification `json:",omitempty" alias:"verify_claims"`
}

type IntentionJWTClaimVerification struct {
	// Path is the path to the claim in the token JSON.
	Path []string `json:",omitempty"`

	// Value is the expected value at the given path:
	// - If the type at the path is a list then we verify
	//   that this value is contained in the list.
	//
	// - If the type at the path is a string then we verify
	//   that this value matches.
	Value string `json:",omitempty"`
}
