// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import "errors"

// ErrSecretNotFound is returned by KVv1 and KVv2 wrappers to indicate that the
// secret is missing at the given location.
var ErrSecretNotFound = errors.New("secret not found")

// A KVSecret is a key-value secret returned by Vault's KV secrets engine,
// and is the most basic type of secret stored in Vault.
//
// Data contains the key-value pairs of the secret itself,
// while Metadata contains a subset of metadata describing
// this particular version of the secret.
// The Metadata field for a KV v1 secret will always be nil, as
// metadata is only supported starting in KV v2.
//
// The Raw field can be inspected for information about the lease,
// and passed to a LifetimeWatcher object for periodic renewal.
type KVSecret struct {
	Data            map[string]interface{}
	VersionMetadata *KVVersionMetadata
	CustomMetadata  map[string]interface{}
	Raw             *Secret
}

// KVv1 is used to return a client for reads and writes against
// a KV v1 secrets engine in Vault.
//
// The mount path is the location where the target KV secrets engine resides
// in Vault.
//
// While v1 is not necessarily deprecated, Vault development servers tend to
// use v2 as the version of the KV secrets engine, as this is what's mounted
// by default when a server is started in -dev mode. See the kvv2 struct.
//
// Learn more about the KV secrets engine here:
// https://developer.hashicorp.com/vault/docs/secrets/kv
func (c *Client) KVv1(mountPath string) *KVv1 {
	return &KVv1{c: c, mountPath: mountPath}
}

// KVv2 is used to return a client for reads and writes against
// a KV v2 secrets engine in Vault.
//
// The mount path is the location where the target KV secrets engine resides
// in Vault.
//
// Vault development servers tend to have "secret" as the mount path,
// as these are the default settings when a server is started in -dev mode.
//
// Learn more about the KV secrets engine here:
// https://developer.hashicorp.com/vault/docs/secrets/kv
func (c *Client) KVv2(mountPath string) *KVv2 {
	return &KVv2{c: c, mountPath: mountPath}
}
