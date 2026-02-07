// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/mitchellh/mapstructure"
)

type KVv2 struct {
	c         *Client
	mountPath string
}

// KVMetadata is the full metadata for a given KV v2 secret.
type KVMetadata struct {
	CASRequired        bool                   `mapstructure:"cas_required"`
	CreatedTime        time.Time              `mapstructure:"created_time"`
	CurrentVersion     int                    `mapstructure:"current_version"`
	CustomMetadata     map[string]interface{} `mapstructure:"custom_metadata"`
	DeleteVersionAfter time.Duration          `mapstructure:"delete_version_after"`
	MaxVersions        int                    `mapstructure:"max_versions"`
	OldestVersion      int                    `mapstructure:"oldest_version"`
	UpdatedTime        time.Time              `mapstructure:"updated_time"`
	// Keys are stringified ints, e.g. "3". To get a sorted slice of version metadata, use GetVersionsAsList.
	Versions map[string]KVVersionMetadata `mapstructure:"versions"`
	Raw      *Secret
}

// KVMetadataPutInput is the subset of metadata that can be replaced for a
// KV v2 secret using the PutMetadata method.
//
// All fields should be explicitly provided, as any fields left unset in the
// struct will be reset to their zero value.
type KVMetadataPutInput struct {
	CASRequired        bool
	CustomMetadata     map[string]interface{}
	DeleteVersionAfter time.Duration
	MaxVersions        int
}

// KVMetadataPatchInput is the subset of metadata that can be manually modified for
// a KV v2 secret using the PatchMetadata method.
//
// The struct's fields are all pointers. A pointer to a field's zero
// value (e.g. false for *bool) implies that field should be reset to its
// zero value after update, whereas a field left as a nil pointer
// (e.g. nil for *bool) implies the field should remain unchanged.
//
// Since maps are already pointers, use an empty map to remove all
// custom metadata.
type KVMetadataPatchInput struct {
	CASRequired        *bool
	CustomMetadata     map[string]interface{}
	DeleteVersionAfter *time.Duration
	MaxVersions        *int
}

// KVVersionMetadata is a subset of metadata for a given version of a KV v2 secret.
type KVVersionMetadata struct {
	Version      int       `mapstructure:"version"`
	CreatedTime  time.Time `mapstructure:"created_time"`
	DeletionTime time.Time `mapstructure:"deletion_time"`
	Destroyed    bool      `mapstructure:"destroyed"`
}

// Currently supported options: WithOption, WithCheckAndSet, WithMethod
type KVOption func() (key string, value interface{})

const (
	KVOptionCheckAndSet    = "cas"
	KVOptionMethod         = "method"
	KVMergeMethodPatch     = "patch"
	KVMergeMethodReadWrite = "rw"
)

// WithOption can optionally be passed to provide generic options for a
// KV request. Valid keys and values depend on the type of request.
func WithOption(key string, value interface{}) KVOption {
	return func() (string, interface{}) {
		return key, value
	}
}

// WithCheckAndSet can optionally be passed to perform a check-and-set
// operation on a KV request. If not set, the write will be allowed.
// If cas is set to 0, a write will only be allowed if the key doesn't exist.
// If set to non-zero, the write will only be allowed if the key’s current
// version matches the version specified in the cas parameter.
func WithCheckAndSet(cas int) KVOption {
	return WithOption(KVOptionCheckAndSet, cas)
}

// WithMergeMethod can optionally be passed to dictate which type of
// patch to perform in a Patch request. If set to "patch", then an HTTP PATCH
// request will be issued. If set to "rw", then a read will be performed,
// then a local update, followed by a remote update. Defaults to "patch".
func WithMergeMethod(method string) KVOption {
	return WithOption(KVOptionMethod, method)
}

// Get returns the latest version of a secret from the KV v2 secrets engine.
//
// If the latest version has been deleted, an error will not be thrown, but
// the Data field on the returned secret will be nil, and the Metadata field
// will contain the deletion time.
func (kv *KVv2) Get(ctx context.Context, secretPath string) (*KVSecret, error) {
	pathToRead := fmt.Sprintf("%s/data/%s", kv.mountPath, secretPath)

	secret, err := kv.c.Logical().ReadWithContext(ctx, pathToRead)
	if err != nil {
		return nil, fmt.Errorf("error encountered while reading secret at %s: %w", pathToRead, err)
	}
	if secret == nil {
		return nil, fmt.Errorf("%w: at %s", ErrSecretNotFound, pathToRead)
	}

	kvSecret, err := extractDataAndVersionMetadata(secret)
	if err != nil {
		return nil, fmt.Errorf("error parsing secret at %s: %w", pathToRead, err)
	}

	kvSecret.CustomMetadata = extractCustomMetadata(secret)

	return kvSecret, nil
}

// GetVersion returns the data and metadata for a specific version of the
// given secret.
//
// If that version has been deleted, the Data field on the
// returned secret will be nil, and the Metadata field will contain the deletion time.
//
// GetVersionsAsList can provide a list of available versions sorted by
// version number, while the response from GetMetadata contains them as a map.
func (kv *KVv2) GetVersion(ctx context.Context, secretPath string, version int) (*KVSecret, error) {
	pathToRead := fmt.Sprintf("%s/data/%s", kv.mountPath, secretPath)

	queryParams := map[string][]string{"version": {strconv.Itoa(version)}}
	secret, err := kv.c.Logical().ReadWithDataWithContext(ctx, pathToRead, queryParams)
	if err != nil {
		return nil, err
	}
	if secret == nil {
		return nil, fmt.Errorf("%w: for version %d at %s", ErrSecretNotFound, version, pathToRead)
	}

	kvSecret, err := extractDataAndVersionMetadata(secret)
	if err != nil {
		return nil, fmt.Errorf("error parsing secret at %s: %w", pathToRead, err)
	}

	kvSecret.CustomMetadata = extractCustomMetadata(secret)

	return kvSecret, nil
}

// GetVersionsAsList returns a subset of the metadata for each version of the secret, sorted by version number.
func (kv *KVv2) GetVersionsAsList(ctx context.Context, secretPath string) ([]KVVersionMetadata, error) {
	pathToRead := fmt.Sprintf("%s/metadata/%s", kv.mountPath, secretPath)

	secret, err := kv.c.Logical().ReadWithContext(ctx, pathToRead)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, fmt.Errorf("%w: no metadata at %s", ErrSecretNotFound, pathToRead)
	}

	md, err := extractFullMetadata(secret)
	if err != nil {
		return nil, fmt.Errorf("unable to extract metadata from secret to determine versions: %w", err)
	}

	versionsList := make([]KVVersionMetadata, 0, len(md.Versions))
	for _, versionMetadata := range md.Versions {
		versionsList = append(versionsList, versionMetadata)
	}

	sort.Slice(versionsList, func(i, j int) bool { return versionsList[i].Version < versionsList[j].Version })
	return versionsList, nil
}

// GetMetadata returns the full metadata for a given secret, including a map of
// its existing versions and their respective creation/deletion times, etc.
func (kv *KVv2) GetMetadata(ctx context.Context, secretPath string) (*KVMetadata, error) {
	pathToRead := fmt.Sprintf("%s/metadata/%s", kv.mountPath, secretPath)

	secret, err := kv.c.Logical().ReadWithContext(ctx, pathToRead)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, fmt.Errorf("%w: no metadata at %s", ErrSecretNotFound, pathToRead)
	}

	md, err := extractFullMetadata(secret)
	if err != nil {
		return nil, fmt.Errorf("unable to extract metadata from secret: %w", err)
	}

	return md, nil
}

// Put inserts a key-value secret (e.g. {"password": "Hashi123"})
// into the KV v2 secrets engine.
//
// If the secret already exists, a new version will be created
// and the previous version can be accessed with the GetVersion method.
// GetMetadata can provide a list of available versions.
func (kv *KVv2) Put(ctx context.Context, secretPath string, data map[string]interface{}, opts ...KVOption) (*KVSecret, error) {
	pathToWriteTo := fmt.Sprintf("%s/data/%s", kv.mountPath, secretPath)

	wrappedData := map[string]interface{}{
		"data": data,
	}

	// Add options such as check-and-set, etc.
	// We leave this as an optional arg so that most users
	// can just pass plain key-value secret data without
	// having to remember to put the extra layer "data" in there.
	options := make(map[string]interface{})
	for _, opt := range opts {
		k, v := opt()
		options[k] = v
	}
	if len(opts) > 0 {
		wrappedData["options"] = options
	}

	secret, err := kv.c.Logical().WriteWithContext(ctx, pathToWriteTo, wrappedData)
	if err != nil {
		return nil, fmt.Errorf("error writing secret to %s: %w", pathToWriteTo, err)
	}
	if secret == nil {
		return nil, fmt.Errorf("%w: after writing to %s", ErrSecretNotFound, pathToWriteTo)
	}

	metadata, err := extractVersionMetadata(secret)
	if err != nil {
		return nil, fmt.Errorf("secret was written successfully, but unable to view version metadata from response: %w", err)
	}

	kvSecret := &KVSecret{
		Data:            nil, // secret.Data in this case is the metadata
		VersionMetadata: metadata,
		Raw:             secret,
	}

	kvSecret.CustomMetadata = extractCustomMetadata(secret)

	return kvSecret, nil
}

// PutMetadata can be used to fully replace a subset of metadata fields for a
// given KV v2 secret. All fields will replace the corresponding values on the Vault server.
// Any fields left as nil will reset the field on the Vault server back to its zero value.
//
// To only partially replace the values of these metadata fields, use PatchMetadata.
//
// This method can also be used to create a new secret with just metadata and no secret data yet.
func (kv *KVv2) PutMetadata(ctx context.Context, secretPath string, metadata KVMetadataPutInput) error {
	pathToWriteTo := fmt.Sprintf("%s/metadata/%s", kv.mountPath, secretPath)

	const (
		casRequiredKey        = "cas_required"
		deleteVersionAfterKey = "delete_version_after"
		maxVersionsKey        = "max_versions"
		customMetadataKey     = "custom_metadata"
	)

	// convert values to a map we can pass to Logical
	metadataMap := make(map[string]interface{})
	metadataMap[maxVersionsKey] = metadata.MaxVersions
	metadataMap[deleteVersionAfterKey] = metadata.DeleteVersionAfter.String()
	metadataMap[casRequiredKey] = metadata.CASRequired
	metadataMap[customMetadataKey] = metadata.CustomMetadata

	_, err := kv.c.Logical().WriteWithContext(ctx, pathToWriteTo, metadataMap)
	if err != nil {
		return fmt.Errorf("error writing secret metadata to %s: %w", pathToWriteTo, err)
	}

	return nil
}

// Patch additively updates the most recent version of a key-value secret,
// differentiating it from Put which will fully overwrite the previous data.
// Only the key-value pairs that are new or changing need to be provided.
//
// The WithMethod KVOption function can optionally be passed to dictate which
// kind of patch to perform, as older Vault server versions (pre-1.9.0) may
// only be able to use the old "rw" (read-then-write) style of partial update,
// whereas newer Vault servers can use the default value of "patch" if the
// client token's policy has the "patch" capability.
func (kv *KVv2) Patch(ctx context.Context, secretPath string, newData map[string]interface{}, opts ...KVOption) (*KVSecret, error) {
	// determine patch method
	var patchMethod string
	var ok bool
	for _, opt := range opts {
		k, v := opt()
		if k == "method" {
			patchMethod, ok = v.(string)
			if !ok {
				return nil, fmt.Errorf("unsupported type provided for option value; value for patch method should be string \"rw\" or \"patch\"")
			}
		}
	}

	// Determine which kind of patch to use,
	// the newer HTTP Patch style or the older read-then-write style
	var kvs *KVSecret
	var err error
	switch patchMethod {
	case "rw":
		kvs, err = readThenWrite(ctx, kv.c, kv.mountPath, secretPath, newData)
	case "patch":
		kvs, err = mergePatch(ctx, kv.c, kv.mountPath, secretPath, newData, opts...)
	case "":
		kvs, err = mergePatch(ctx, kv.c, kv.mountPath, secretPath, newData, opts...)
	default:
		return nil, fmt.Errorf("unsupported patch method provided; value for patch method should be string \"rw\" or \"patch\"")
	}
	if err != nil {
		return nil, fmt.Errorf("unable to perform patch: %w", err)
	}
	if kvs == nil {
		return nil, fmt.Errorf("no secret was written to %s", secretPath)
	}

	return kvs, nil
}

// PatchMetadata can be used to replace just a subset of a secret's
// metadata fields at a time, as opposed to PutMetadata which is used to
// completely replace all fields on the previous metadata.
func (kv *KVv2) PatchMetadata(ctx context.Context, secretPath string, metadata KVMetadataPatchInput) error {
	pathToWriteTo := fmt.Sprintf("%s/metadata/%s", kv.mountPath, secretPath)

	md, err := toMetadataMap(metadata)
	if err != nil {
		return fmt.Errorf("unable to create map for JSON merge patch request: %w", err)
	}

	_, err = kv.c.Logical().JSONMergePatch(ctx, pathToWriteTo, md)
	if err != nil {
		return fmt.Errorf("error patching metadata at %s: %w", pathToWriteTo, err)
	}

	return nil
}

// Delete deletes the most recent version of a secret from the KV v2
// secrets engine. To delete an older version, use DeleteVersions.
func (kv *KVv2) Delete(ctx context.Context, secretPath string) error {
	pathToDelete := fmt.Sprintf("%s/data/%s", kv.mountPath, secretPath)

	_, err := kv.c.Logical().DeleteWithContext(ctx, pathToDelete)
	if err != nil {
		return fmt.Errorf("error deleting secret at %s: %w", pathToDelete, err)
	}

	return nil
}

// DeleteVersions deletes the specified versions of a secret from the KV v2
// secrets engine. To delete the latest version of a secret, just use Delete.
func (kv *KVv2) DeleteVersions(ctx context.Context, secretPath string, versions []int) error {
	// verb and path are different when trying to delete past versions
	pathToDelete := fmt.Sprintf("%s/delete/%s", kv.mountPath, secretPath)

	if len(versions) == 0 {
		return nil
	}

	var versionsToDelete []string
	for _, version := range versions {
		versionsToDelete = append(versionsToDelete, strconv.Itoa(version))
	}
	versionsMap := map[string]interface{}{
		"versions": versionsToDelete,
	}
	_, err := kv.c.Logical().WriteWithContext(ctx, pathToDelete, versionsMap)
	if err != nil {
		return fmt.Errorf("error deleting secret at %s: %w", pathToDelete, err)
	}

	return nil
}

// DeleteMetadata deletes all versions and metadata of the secret at the
// given path.
func (kv *KVv2) DeleteMetadata(ctx context.Context, secretPath string) error {
	pathToDelete := fmt.Sprintf("%s/metadata/%s", kv.mountPath, secretPath)

	_, err := kv.c.Logical().DeleteWithContext(ctx, pathToDelete)
	if err != nil {
		return fmt.Errorf("error deleting secret metadata at %s: %w", pathToDelete, err)
	}

	return nil
}

// Undelete undeletes the given versions of a secret, restoring the data
// so that it can be fetched again with Get requests.
//
// A list of existing versions can be retrieved using the GetVersionsAsList method.
func (kv *KVv2) Undelete(ctx context.Context, secretPath string, versions []int) error {
	pathToUndelete := fmt.Sprintf("%s/undelete/%s", kv.mountPath, secretPath)

	data := map[string]interface{}{
		"versions": versions,
	}

	_, err := kv.c.Logical().WriteWithContext(ctx, pathToUndelete, data)
	if err != nil {
		return fmt.Errorf("error undeleting secret metadata at %s: %w", pathToUndelete, err)
	}

	return nil
}

// Destroy permanently removes the specified secret versions' data
// from the Vault server. If no secret exists at the given path, no
// action will be taken.
//
// A list of existing versions can be retrieved using the GetVersionsAsList method.
func (kv *KVv2) Destroy(ctx context.Context, secretPath string, versions []int) error {
	pathToDestroy := fmt.Sprintf("%s/destroy/%s", kv.mountPath, secretPath)

	data := map[string]interface{}{
		"versions": versions,
	}

	_, err := kv.c.Logical().WriteWithContext(ctx, pathToDestroy, data)
	if err != nil {
		return fmt.Errorf("error destroying secret metadata at %s: %w", pathToDestroy, err)
	}

	return nil
}

// Rollback can be used to roll a secret back to a previous
// non-deleted/non-destroyed version. That previous version becomes the
// next/newest version for the path.
func (kv *KVv2) Rollback(ctx context.Context, secretPath string, toVersion int) (*KVSecret, error) {
	// First, do a read to get the current version for check-and-set
	latest, err := kv.Get(ctx, secretPath)
	if err != nil {
		return nil, fmt.Errorf("unable to get latest version of secret: %w", err)
	}

	// Make sure a value already exists
	if latest == nil {
		return nil, fmt.Errorf("no secret was found: %w", err)
	}

	// Verify metadata found
	if latest.VersionMetadata == nil {
		return nil, fmt.Errorf("no metadata found; rollback can only be used on existing data")
	}

	// Now run it again and read the version we want to roll back to
	rollbackVersion, err := kv.GetVersion(ctx, secretPath, toVersion)
	if err != nil {
		return nil, fmt.Errorf("unable to get previous version %d of secret: %w", toVersion, err)
	}

	err = validateRollbackVersion(rollbackVersion)
	if err != nil {
		return nil, fmt.Errorf("invalid rollback version %d: %w", toVersion, err)
	}

	casVersion := latest.VersionMetadata.Version
	kvs, err := kv.Put(ctx, secretPath, rollbackVersion.Data, WithCheckAndSet(casVersion))
	if err != nil {
		return nil, fmt.Errorf("unable to roll back to previous secret version: %w", err)
	}

	return kvs, nil
}

func extractCustomMetadata(secret *Secret) map[string]interface{} {
	// Logical Writes return the metadata directly, Reads return it nested inside the "metadata" key
	customMetadataInterface, ok := secret.Data["custom_metadata"]
	if !ok {
		metadataInterface := secret.Data["metadata"]
		metadataMap, ok := metadataInterface.(map[string]interface{})
		if !ok {
			return nil
		}
		customMetadataInterface = metadataMap["custom_metadata"]
	}

	cm, ok := customMetadataInterface.(map[string]interface{})
	if !ok {
		return nil
	}

	return cm
}

func extractDataAndVersionMetadata(secret *Secret) (*KVSecret, error) {
	// A nil map is a valid value for data: secret.Data will be nil when this
	// version of the secret has been deleted, but the metadata is still
	// available.
	var data map[string]interface{}
	if secret.Data != nil {
		dataInterface, ok := secret.Data["data"]
		if !ok {
			return nil, fmt.Errorf("missing expected 'data' element")
		}

		if dataInterface != nil {
			data, ok = dataInterface.(map[string]interface{})
			if !ok {
				return nil, fmt.Errorf("unexpected type for 'data' element: %T (%#v)", data, data)
			}
		}
	}

	metadata, err := extractVersionMetadata(secret)
	if err != nil {
		return nil, fmt.Errorf("unable to get version metadata: %w", err)
	}

	return &KVSecret{
		Data:            data,
		VersionMetadata: metadata,
		Raw:             secret,
	}, nil
}

func extractVersionMetadata(secret *Secret) (*KVVersionMetadata, error) {
	var metadata *KVVersionMetadata

	if secret.Data == nil {
		return nil, nil
	}

	// Logical Writes return the metadata directly, Reads return it nested inside the "metadata" key
	var metadataMap map[string]interface{}
	metadataInterface, ok := secret.Data["metadata"]
	if ok {
		metadataMap, ok = metadataInterface.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("unexpected type for 'metadata' element: %T (%#v)", metadataInterface, metadataInterface)
		}
	} else {
		metadataMap = secret.Data
	}

	// deletion_time usually comes in as an empty string which can't be
	// processed as time.RFC3339, so we reset it to a convertible value
	if metadataMap["deletion_time"] == "" {
		metadataMap["deletion_time"] = time.Time{}
	}

	d, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
		DecodeHook: mapstructure.StringToTimeHookFunc(time.RFC3339),
		Result:     &metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("error setting up decoder for API response: %w", err)
	}

	err = d.Decode(metadataMap)
	if err != nil {
		return nil, fmt.Errorf("error decoding metadata from API response into VersionMetadata: %w", err)
	}

	return metadata, nil
}

func extractFullMetadata(secret *Secret) (*KVMetadata, error) {
	var metadata *KVMetadata

	if secret.Data == nil {
		return nil, nil
	}

	if versions, ok := secret.Data["versions"]; ok {
		versionsMap := versions.(map[string]interface{})
		if len(versionsMap) > 0 {
			for version, metadata := range versionsMap {
				metadataMap := metadata.(map[string]interface{})
				// deletion_time usually comes in as an empty string which can't be
				// processed as time.RFC3339, so we reset it to a convertible value
				if metadataMap["deletion_time"] == "" {
					metadataMap["deletion_time"] = time.Time{}
				}
				versionInt, err := strconv.Atoi(version)
				if err != nil {
					return nil, fmt.Errorf("error converting version %s to integer: %w", version, err)
				}
				metadataMap["version"] = versionInt
				versionsMap[version] = metadataMap // save the updated copy of the metadata map
			}
		}
		secret.Data["versions"] = versionsMap // save the updated copy of the versions map
	}

	d, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
		DecodeHook: mapstructure.ComposeDecodeHookFunc(
			mapstructure.StringToTimeHookFunc(time.RFC3339),
			mapstructure.StringToTimeDurationHookFunc(),
		),
		Result: &metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("error setting up decoder for API response: %w", err)
	}

	err = d.Decode(secret.Data)
	if err != nil {
		return nil, fmt.Errorf("error decoding metadata from API response into KVMetadata: %w", err)
	}

	return metadata, nil
}

func validateRollbackVersion(rollbackVersion *KVSecret) error {
	// Make sure a value already exists
	if rollbackVersion == nil || rollbackVersion.Data == nil {
		return fmt.Errorf("no secret found")
	}

	// Verify metadata found
	if rollbackVersion.VersionMetadata == nil {
		return fmt.Errorf("no version metadata found; rollback only works on existing data")
	}

	// Verify it hasn't been deleted
	if !rollbackVersion.VersionMetadata.DeletionTime.IsZero() {
		return fmt.Errorf("cannot roll back to a version that has been deleted")
	}

	if rollbackVersion.VersionMetadata.Destroyed {
		return fmt.Errorf("cannot roll back to a version that has been destroyed")
	}

	// Verify old data found
	if rollbackVersion.Data == nil {
		return fmt.Errorf("no data found; rollback only works on existing data")
	}

	return nil
}

func mergePatch(ctx context.Context, client *Client, mountPath string, secretPath string, newData map[string]interface{}, opts ...KVOption) (*KVSecret, error) {
	pathToMergePatch := fmt.Sprintf("%s/data/%s", mountPath, secretPath)

	// take any other additional options provided
	// and pass them along to the patch request
	wrappedData := map[string]interface{}{
		"data": newData,
	}
	options := make(map[string]interface{})
	for _, opt := range opts {
		k, v := opt()
		options[k] = v
	}
	if len(opts) > 0 {
		wrappedData["options"] = options
	}

	secret, err := client.Logical().JSONMergePatch(ctx, pathToMergePatch, wrappedData)
	if err != nil {
		var re *ResponseError

		if errors.As(err, &re) {
			switch re.StatusCode {
			// 403
			case http.StatusForbidden:
				return nil, fmt.Errorf("received 403 from Vault server; please ensure that token's policy has \"patch\" capability: %w", err)

			// 404
			case http.StatusNotFound:
				return nil, fmt.Errorf("%w: performing merge patch to %s", ErrSecretNotFound, pathToMergePatch)

			// 405
			case http.StatusMethodNotAllowed:
				// If it's a 405, that probably means the server is running a pre-1.9
				// Vault version that doesn't support the HTTP PATCH method.
				// Fall back to the old way of doing it.
				return readThenWrite(ctx, client, mountPath, secretPath, newData)
			}
		}

		return nil, fmt.Errorf("error performing merge patch to %s: %w", pathToMergePatch, err)
	}

	metadata, err := extractVersionMetadata(secret)
	if err != nil {
		return nil, fmt.Errorf("secret was written successfully, but unable to view version metadata from response: %w", err)
	}

	kvSecret := &KVSecret{
		Data:            nil, // secret.Data in this case is the metadata
		VersionMetadata: metadata,
		Raw:             secret,
	}

	kvSecret.CustomMetadata = extractCustomMetadata(secret)

	return kvSecret, nil
}

func readThenWrite(ctx context.Context, client *Client, mountPath string, secretPath string, newData map[string]interface{}) (*KVSecret, error) {
	// First, read the secret.
	existingVersion, err := client.KVv2(mountPath).Get(ctx, secretPath)
	if err != nil {
		return nil, fmt.Errorf("error reading secret as part of read-then-write patch operation: %w", err)
	}

	// Make sure the secret already exists
	if existingVersion == nil || existingVersion.Data == nil {
		return nil, fmt.Errorf("%w: at %s as part of read-then-write patch operation", ErrSecretNotFound, secretPath)
	}

	// Verify existing secret has metadata
	if existingVersion.VersionMetadata == nil {
		return nil, fmt.Errorf("no metadata found at %s; patch can only be used on existing data", secretPath)
	}

	// Copy new data over with existing data
	combinedData := existingVersion.Data
	for k, v := range newData {
		combinedData[k] = v
	}

	updatedSecret, err := client.KVv2(mountPath).Put(ctx, secretPath, combinedData, WithCheckAndSet(existingVersion.VersionMetadata.Version))
	if err != nil {
		return nil, fmt.Errorf("error writing secret to %s: %w", secretPath, err)
	}

	return updatedSecret, nil
}

func toMetadataMap(patchInput KVMetadataPatchInput) (map[string]interface{}, error) {
	metadataMap := make(map[string]interface{})

	const (
		casRequiredKey        = "cas_required"
		deleteVersionAfterKey = "delete_version_after"
		maxVersionsKey        = "max_versions"
		customMetadataKey     = "custom_metadata"
	)

	// The KVMetadataPatchInput struct is designed to have pointer fields so that
	// the user can easily express the difference between explicitly setting a
	// field back to its zero value (e.g. false), as opposed to just having
	// the field remain unchanged (e.g. nil). This way, they only need to pass
	// the fields they want to change.
	if patchInput.MaxVersions != nil {
		metadataMap[maxVersionsKey] = *(patchInput.MaxVersions)
	}
	if patchInput.CASRequired != nil {
		metadataMap[casRequiredKey] = *(patchInput.CASRequired)
	}
	if patchInput.CustomMetadata != nil {
		if len(patchInput.CustomMetadata) == 0 { // empty non-nil map means delete all the keys
			metadataMap[customMetadataKey] = nil
		} else {
			metadataMap[customMetadataKey] = patchInput.CustomMetadata
		}
	}
	if patchInput.DeleteVersionAfter != nil {
		metadataMap[deleteVersionAfterKey] = patchInput.DeleteVersionAfter.String()
	}

	return metadataMap, nil
}
