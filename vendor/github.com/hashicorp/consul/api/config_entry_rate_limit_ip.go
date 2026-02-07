// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

type ReadWriteRatesConfig struct {
	ReadRate  float64 `alias:"read_rate"`
	WriteRate float64 `alias:"write_rate"`
}

type RateLimitIPConfigEntry struct {
	// Kind of the config entry. This will be set to structs.RateLimitIPConfig
	Kind string
	Name string
	Mode string // {permissive, enforcing, disabled}

	Meta map[string]string `json:",omitempty"`
	// overall limits
	ReadRate  float64 `alias:"read_rate"`
	WriteRate float64 `alias:"write_rate"`

	//limits specific to a type of call
	ACL             *ReadWriteRatesConfig `json:",omitempty"` //	OperationCategoryACL             OperationCategory = "ACL"
	Catalog         *ReadWriteRatesConfig `json:",omitempty"` //   OperationCategoryCatalog         OperationCategory = "Catalog"
	ConfigEntry     *ReadWriteRatesConfig `json:",omitempty"` //   OperationCategoryConfigEntry     OperationCategory = "ConfigEntry"
	ConnectCA       *ReadWriteRatesConfig `json:",omitempty"` //   OperationCategoryConnectCA       OperationCategory = "ConnectCA"
	Coordinate      *ReadWriteRatesConfig `json:",omitempty"` //   OperationCategoryCoordinate      OperationCategory = "Coordinate"
	DiscoveryChain  *ReadWriteRatesConfig `json:",omitempty"` //   OperationCategoryDiscoveryChain  OperationCategory = "DiscoveryChain"
	ServerDiscovery *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryServerDiscovery OperationCategory = "ServerDiscovery"
	Health          *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryHealth          OperationCategory = "Health"
	Intention       *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryIntention       OperationCategory = "Intention"
	KV              *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryKV              OperationCategory = "KV"
	Tenancy         *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryPartition        OperationCategory = "Tenancy"
	PreparedQuery   *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryPreparedQuery   OperationCategory = "PreparedQuery"
	Session         *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategorySession         OperationCategory = "Session"
	Txn             *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryTxn             OperationCategory = "Txn"
	AutoConfig      *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryAutoConfig      OperationCategory = "AutoConfig"
	FederationState *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryFederationState OperationCategory = "FederationState"
	Internal        *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryInternal        OperationCategory = "Internal"
	PeerStream      *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryPeerStream      OperationCategory = "PeerStream"
	Peering         *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryPeering         OperationCategory = "Peering"
	DataPlane       *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryDataPlane       OperationCategory = "DataPlane"
	DNS             *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryDNS             OperationCategory = "DNS"
	Subscribe       *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategorySubscribe       OperationCategory = "Subscribe"
	Resource        *ReadWriteRatesConfig `json:",omitempty"` //  OperationCategoryResource        OperationCategory = "Resource"

	// Partition is the partition the config entry is associated with.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the config entry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`

	// CreateIndex is the Raft index this entry was created at. This is a
	// read-only field.
	CreateIndex uint64

	// ModifyIndex is used for the Check-And-Set operations and can also be fed
	// back into the WaitIndex of the QueryOptions in order to perform blocking
	// queries.
	ModifyIndex uint64
}

func (r *RateLimitIPConfigEntry) GetKind() string {
	return RateLimitIPConfig
}
func (r *RateLimitIPConfigEntry) GetName() string {
	if r == nil {
		return ""
	}
	return r.Name
}
func (r *RateLimitIPConfigEntry) GetPartition() string {
	return r.Partition
}
func (r *RateLimitIPConfigEntry) GetNamespace() string {
	return r.Namespace
}
func (r *RateLimitIPConfigEntry) GetMeta() map[string]string {
	if r == nil {
		return nil
	}
	return r.Meta
}
func (r *RateLimitIPConfigEntry) GetCreateIndex() uint64 {
	return r.CreateIndex
}
func (r *RateLimitIPConfigEntry) GetModifyIndex() uint64 {
	return r.ModifyIndex
}
