// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"encoding/json"
)

// ExportedServicesConfigEntry manages the exported services for a single admin partition.
// Admin Partitions are a Consul Enterprise feature.
type ExportedServicesConfigEntry struct {
	// Name is the name of the partition the ExportedServicesConfigEntry applies to.
	// Partitioning is a Consul Enterprise feature.
	Name string `json:",omitempty"`

	// Partition is the partition where the ExportedServicesConfigEntry is stored.
	// If the partition does not match the name, the name will overwrite the partition.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Services is a list of services to be exported and the list of partitions
	// to expose them to.
	Services []ExportedService `json:",omitempty"`

	Meta map[string]string `json:",omitempty"`

	// CreateIndex is the Raft index this entry was created at. This is a
	// read-only field.
	CreateIndex uint64

	// ModifyIndex is used for the Check-And-Set operations and can also be fed
	// back into the WaitIndex of the QueryOptions in order to perform blocking
	// queries.
	ModifyIndex uint64
}

// ExportedService manages the exporting of a service in the local partition to
// other partitions.
type ExportedService struct {
	// Name is the name of the service to be exported.
	Name string

	// Namespace is the namespace to export the service from.
	Namespace string `json:",omitempty"`

	// Consumers is a list of downstream consumers of the service to be exported.
	Consumers []ServiceConsumer `json:",omitempty"`
}

// ServiceConsumer represents a downstream consumer of the service to be exported.
// At most one of Partition or Peer must be specified.
type ServiceConsumer struct {
	// Partition is the admin partition to export the service to.
	Partition string `json:",omitempty"`

	// Peer is the name of the peer to export the service to.
	Peer string `json:",omitempty" alias:"peer_name"`

	// SamenessGroup is the name of the sameness group to export the service to.
	SamenessGroup string `json:",omitempty" alias:"sameness_group"`
}

func (e *ExportedServicesConfigEntry) GetKind() string            { return ExportedServices }
func (e *ExportedServicesConfigEntry) GetName() string            { return e.Name }
func (e *ExportedServicesConfigEntry) GetPartition() string       { return e.Name }
func (e *ExportedServicesConfigEntry) GetNamespace() string       { return "" }
func (e *ExportedServicesConfigEntry) GetMeta() map[string]string { return e.Meta }
func (e *ExportedServicesConfigEntry) GetCreateIndex() uint64     { return e.CreateIndex }
func (e *ExportedServicesConfigEntry) GetModifyIndex() uint64     { return e.ModifyIndex }

// MarshalJSON adds the Kind field so that the JSON can be decoded back into the
// correct type.
func (e *ExportedServicesConfigEntry) MarshalJSON() ([]byte, error) {
	type Alias ExportedServicesConfigEntry
	source := &struct {
		Kind string
		*Alias
	}{
		Kind:  ExportedServices,
		Alias: (*Alias)(e),
	}
	return json.Marshal(source)
}
