// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

type FileSystemCertificateConfigEntry struct {
	// Kind of the config entry. This should be set to api.FileSystemCertificate.
	Kind string

	Name string

	// Certificate is the path to a client certificate to use for TLS connections.
	Certificate string `json:",omitempty" alias:"certificate"`

	// PrivateKey is the path to a private key to use for TLS connections.
	PrivateKey string `json:",omitempty" alias:"private_key"`

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

func (a *FileSystemCertificateConfigEntry) GetKind() string            { return FileSystemCertificate }
func (a *FileSystemCertificateConfigEntry) GetName() string            { return a.Name }
func (a *FileSystemCertificateConfigEntry) GetPartition() string       { return a.Partition }
func (a *FileSystemCertificateConfigEntry) GetNamespace() string       { return a.Namespace }
func (a *FileSystemCertificateConfigEntry) GetMeta() map[string]string { return a.Meta }
func (a *FileSystemCertificateConfigEntry) GetCreateIndex() uint64     { return a.CreateIndex }
func (a *FileSystemCertificateConfigEntry) GetModifyIndex() uint64     { return a.ModifyIndex }
