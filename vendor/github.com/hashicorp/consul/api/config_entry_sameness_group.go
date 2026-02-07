// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

type SamenessGroupConfigEntry struct {
	Kind               string
	Name               string
	Partition          string `json:",omitempty"`
	DefaultForFailover bool   `json:",omitempty" alias:"default_for_failover"`
	IncludeLocal       bool   `json:",omitempty" alias:"include_local"`
	Members            []SamenessGroupMember
	Meta               map[string]string `json:",omitempty"`
	CreateIndex        uint64
	ModifyIndex        uint64
}

type SamenessGroupMember struct {
	Partition string `json:",omitempty"`
	Peer      string `json:",omitempty"`
}

func (s *SamenessGroupConfigEntry) GetKind() string            { return s.Kind }
func (s *SamenessGroupConfigEntry) GetName() string            { return s.Name }
func (s *SamenessGroupConfigEntry) GetPartition() string       { return s.Partition }
func (s *SamenessGroupConfigEntry) GetNamespace() string       { return "" }
func (s *SamenessGroupConfigEntry) GetCreateIndex() uint64     { return s.CreateIndex }
func (s *SamenessGroupConfigEntry) GetModifyIndex() uint64     { return s.ModifyIndex }
func (s *SamenessGroupConfigEntry) GetMeta() map[string]string { return s.Meta }
