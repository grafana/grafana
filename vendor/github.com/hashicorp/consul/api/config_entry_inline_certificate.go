// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

// InlineCertificateConfigEntry -- TODO stub
type InlineCertificateConfigEntry struct {
	// Kind of the config entry. This should be set to api.InlineCertificate.
	Kind string

	// Name is used to match the config entry with its associated tcp-route
	// service. This should match the name provided in the service definition.
	Name string

	// Certificate is the public certificate component of an x509 key pair encoded in raw PEM format.
	Certificate string
	// PrivateKey is the private key component of an x509 key pair encoded in raw PEM format.
	PrivateKey string `alias:"private_key"`

	Meta map[string]string `json:",omitempty"`

	// CreateIndex is the Raft index this entry was created at. This is a
	// read-only field.
	CreateIndex uint64

	// ModifyIndex is used for the Check-And-Set operations and can also be fed
	// back into the WaitIndex of the QueryOptions in order to perform blocking
	// queries.
	ModifyIndex uint64

	// Partition is the partition the config entry is associated with.
	// Partitioning is a Consul Enterprise feature.
	Partition string `json:",omitempty"`

	// Namespace is the namespace the config entry is associated with.
	// Namespacing is a Consul Enterprise feature.
	Namespace string `json:",omitempty"`
}

func (a *InlineCertificateConfigEntry) GetKind() string            { return InlineCertificate }
func (a *InlineCertificateConfigEntry) GetName() string            { return a.Name }
func (a *InlineCertificateConfigEntry) GetPartition() string       { return a.Partition }
func (a *InlineCertificateConfigEntry) GetNamespace() string       { return a.Namespace }
func (a *InlineCertificateConfigEntry) GetMeta() map[string]string { return a.Meta }
func (a *InlineCertificateConfigEntry) GetCreateIndex() uint64     { return a.CreateIndex }
func (a *InlineCertificateConfigEntry) GetModifyIndex() uint64     { return a.ModifyIndex }
