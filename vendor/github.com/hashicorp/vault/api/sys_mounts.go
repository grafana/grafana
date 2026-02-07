// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/mitchellh/mapstructure"
)

func (c *Sys) GetMount(path string) (*MountOutput, error) {
	return c.GetMountWithContext(context.Background(), path)
}

func (c *Sys) GetMountWithContext(ctx context.Context, path string) (*MountOutput, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, fmt.Sprintf("/v1/sys/mounts/%s", path))

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	mount := MountOutput{}
	err = mapstructure.Decode(secret.Data, &mount)
	if err != nil {
		return nil, err
	}

	return &mount, nil
}

func (c *Sys) ListMounts() (map[string]*MountOutput, error) {
	return c.ListMountsWithContext(context.Background())
}

func (c *Sys) ListMountsWithContext(ctx context.Context) (map[string]*MountOutput, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, "/v1/sys/mounts")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	mounts := map[string]*MountOutput{}
	err = mapstructure.Decode(secret.Data, &mounts)
	if err != nil {
		return nil, err
	}

	return mounts, nil
}

func (c *Sys) Mount(path string, mountInfo *MountInput) error {
	return c.MountWithContext(context.Background(), path, mountInfo)
}

func (c *Sys) MountWithContext(ctx context.Context, path string, mountInfo *MountInput) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPost, fmt.Sprintf("/v1/sys/mounts/%s", path))
	if err := r.SetJSONBody(mountInfo); err != nil {
		return err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (c *Sys) Unmount(path string) error {
	return c.UnmountWithContext(context.Background(), path)
}

func (c *Sys) UnmountWithContext(ctx context.Context, path string) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodDelete, fmt.Sprintf("/v1/sys/mounts/%s", path))

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err == nil {
		defer resp.Body.Close()
	}
	return err
}

// Remount wraps RemountWithContext using context.Background.
func (c *Sys) Remount(from, to string) error {
	return c.RemountWithContext(context.Background(), from, to)
}

// RemountWithContext kicks off a remount operation, polls the status endpoint using
// the migration ID till either success or failure state is observed
func (c *Sys) RemountWithContext(ctx context.Context, from, to string) error {
	remountResp, err := c.StartRemountWithContext(ctx, from, to)
	if err != nil {
		return err
	}

	for {
		remountStatusResp, err := c.RemountStatusWithContext(ctx, remountResp.MigrationID)
		if err != nil {
			return err
		}
		if remountStatusResp.MigrationInfo.MigrationStatus == "success" {
			return nil
		}
		if remountStatusResp.MigrationInfo.MigrationStatus == "failure" {
			return fmt.Errorf("Failure! Error encountered moving mount %s to %s, with migration ID %s", from, to, remountResp.MigrationID)
		}
		time.Sleep(1 * time.Second)
	}
}

// StartRemount wraps StartRemountWithContext using context.Background.
func (c *Sys) StartRemount(from, to string) (*MountMigrationOutput, error) {
	return c.StartRemountWithContext(context.Background(), from, to)
}

// StartRemountWithContext kicks off a mount migration and returns a response with the migration ID
func (c *Sys) StartRemountWithContext(ctx context.Context, from, to string) (*MountMigrationOutput, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	body := map[string]interface{}{
		"from": from,
		"to":   to,
	}

	r := c.c.NewRequest(http.MethodPost, "/v1/sys/remount")
	if err := r.SetJSONBody(body); err != nil {
		return nil, err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	var result MountMigrationOutput
	err = mapstructure.Decode(secret.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, err
}

// RemountStatus wraps RemountStatusWithContext using context.Background.
func (c *Sys) RemountStatus(migrationID string) (*MountMigrationStatusOutput, error) {
	return c.RemountStatusWithContext(context.Background(), migrationID)
}

// RemountStatusWithContext checks the status of a mount migration operation with the provided ID
func (c *Sys) RemountStatusWithContext(ctx context.Context, migrationID string) (*MountMigrationStatusOutput, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, fmt.Sprintf("/v1/sys/remount/status/%s", migrationID))

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	var result MountMigrationStatusOutput
	err = mapstructure.Decode(secret.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, err
}

func (c *Sys) TuneMount(path string, config MountConfigInput) error {
	return c.TuneMountWithContext(context.Background(), path, config)
}

func (c *Sys) TuneMountWithContext(ctx context.Context, path string, config MountConfigInput) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPost, fmt.Sprintf("/v1/sys/mounts/%s/tune", path))
	if err := r.SetJSONBody(config); err != nil {
		return err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err == nil {
		defer resp.Body.Close()
	}
	return err
}

func (c *Sys) MountConfig(path string) (*MountConfigOutput, error) {
	return c.MountConfigWithContext(context.Background(), path)
}

func (c *Sys) MountConfigWithContext(ctx context.Context, path string) (*MountConfigOutput, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, fmt.Sprintf("/v1/sys/mounts/%s/tune", path))

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return nil, err
	}
	if secret == nil || secret.Data == nil {
		return nil, errors.New("data from server response is empty")
	}

	var result MountConfigOutput
	err = mapstructure.Decode(secret.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, err
}

type MountInput struct {
	Type                  string            `json:"type"`
	Description           string            `json:"description"`
	Config                MountConfigInput  `json:"config"`
	Local                 bool              `json:"local"`
	SealWrap              bool              `json:"seal_wrap" mapstructure:"seal_wrap"`
	ExternalEntropyAccess bool              `json:"external_entropy_access" mapstructure:"external_entropy_access"`
	Options               map[string]string `json:"options"`

	// Deprecated: Newer server responses should be returning this information in the
	// Type field (json: "type") instead.
	PluginName string `json:"plugin_name,omitempty"`
}

type MountConfigInput struct {
	Options                    map[string]string       `json:"options" mapstructure:"options"`
	DefaultLeaseTTL            string                  `json:"default_lease_ttl" mapstructure:"default_lease_ttl"`
	Description                *string                 `json:"description,omitempty" mapstructure:"description"`
	MaxLeaseTTL                string                  `json:"max_lease_ttl" mapstructure:"max_lease_ttl"`
	ForceNoCache               bool                    `json:"force_no_cache" mapstructure:"force_no_cache"`
	AuditNonHMACRequestKeys    []string                `json:"audit_non_hmac_request_keys,omitempty" mapstructure:"audit_non_hmac_request_keys"`
	AuditNonHMACResponseKeys   []string                `json:"audit_non_hmac_response_keys,omitempty" mapstructure:"audit_non_hmac_response_keys"`
	ListingVisibility          string                  `json:"listing_visibility,omitempty" mapstructure:"listing_visibility"`
	PassthroughRequestHeaders  []string                `json:"passthrough_request_headers,omitempty" mapstructure:"passthrough_request_headers"`
	AllowedResponseHeaders     []string                `json:"allowed_response_headers,omitempty" mapstructure:"allowed_response_headers"`
	TokenType                  string                  `json:"token_type,omitempty" mapstructure:"token_type"`
	AllowedManagedKeys         []string                `json:"allowed_managed_keys,omitempty" mapstructure:"allowed_managed_keys"`
	PluginVersion              string                  `json:"plugin_version,omitempty"`
	UserLockoutConfig          *UserLockoutConfigInput `json:"user_lockout_config,omitempty"`
	DelegatedAuthAccessors     []string                `json:"delegated_auth_accessors,omitempty" mapstructure:"delegated_auth_accessors"`
	IdentityTokenKey           string                  `json:"identity_token_key,omitempty" mapstructure:"identity_token_key"`
	TrimRequestTrailingSlashes *bool                   `json:"trim_request_trailing_slashes,omitempty" mapstructure:"trim_request_trailing_slashes"`
	// Deprecated: This field will always be blank for newer server responses.
	PluginName string `json:"plugin_name,omitempty" mapstructure:"plugin_name"`
}

type MountOutput struct {
	UUID                  string            `json:"uuid"`
	Type                  string            `json:"type"`
	Description           string            `json:"description"`
	Accessor              string            `json:"accessor"`
	Config                MountConfigOutput `json:"config"`
	Options               map[string]string `json:"options"`
	Local                 bool              `json:"local"`
	SealWrap              bool              `json:"seal_wrap" mapstructure:"seal_wrap"`
	ExternalEntropyAccess bool              `json:"external_entropy_access" mapstructure:"external_entropy_access"`
	PluginVersion         string            `json:"plugin_version" mapstructure:"plugin_version"`
	RunningVersion        string            `json:"running_plugin_version" mapstructure:"running_plugin_version"`
	RunningSha256         string            `json:"running_sha256" mapstructure:"running_sha256"`
	DeprecationStatus     string            `json:"deprecation_status" mapstructure:"deprecation_status"`
}

type MountConfigOutput struct {
	DefaultLeaseTTL            int                      `json:"default_lease_ttl" mapstructure:"default_lease_ttl"`
	MaxLeaseTTL                int                      `json:"max_lease_ttl" mapstructure:"max_lease_ttl"`
	ForceNoCache               bool                     `json:"force_no_cache" mapstructure:"force_no_cache"`
	AuditNonHMACRequestKeys    []string                 `json:"audit_non_hmac_request_keys,omitempty" mapstructure:"audit_non_hmac_request_keys"`
	AuditNonHMACResponseKeys   []string                 `json:"audit_non_hmac_response_keys,omitempty" mapstructure:"audit_non_hmac_response_keys"`
	ListingVisibility          string                   `json:"listing_visibility,omitempty" mapstructure:"listing_visibility"`
	PassthroughRequestHeaders  []string                 `json:"passthrough_request_headers,omitempty" mapstructure:"passthrough_request_headers"`
	AllowedResponseHeaders     []string                 `json:"allowed_response_headers,omitempty" mapstructure:"allowed_response_headers"`
	TokenType                  string                   `json:"token_type,omitempty" mapstructure:"token_type"`
	AllowedManagedKeys         []string                 `json:"allowed_managed_keys,omitempty" mapstructure:"allowed_managed_keys"`
	UserLockoutConfig          *UserLockoutConfigOutput `json:"user_lockout_config,omitempty"`
	DelegatedAuthAccessors     []string                 `json:"delegated_auth_accessors,omitempty" mapstructure:"delegated_auth_accessors"`
	IdentityTokenKey           string                   `json:"identity_token_key,omitempty" mapstructure:"identity_token_key"`
	TrimRequestTrailingSlashes bool                     `json:"trim_request_trailing_slashes,omitempty" mapstructure:"trim_request_trailing_slashes"`

	// Deprecated: This field will always be blank for newer server responses.
	PluginName string `json:"plugin_name,omitempty" mapstructure:"plugin_name"`
}

type UserLockoutConfigInput struct {
	LockoutThreshold            string `json:"lockout_threshold,omitempty" structs:"lockout_threshold" mapstructure:"lockout_threshold"`
	LockoutDuration             string `json:"lockout_duration,omitempty" structs:"lockout_duration" mapstructure:"lockout_duration"`
	LockoutCounterResetDuration string `json:"lockout_counter_reset_duration,omitempty" structs:"lockout_counter_reset_duration" mapstructure:"lockout_counter_reset_duration"`
	DisableLockout              *bool  `json:"lockout_disable,omitempty" structs:"lockout_disable" mapstructure:"lockout_disable"`
}

type UserLockoutConfigOutput struct {
	LockoutThreshold    uint  `json:"lockout_threshold,omitempty" structs:"lockout_threshold" mapstructure:"lockout_threshold"`
	LockoutDuration     int   `json:"lockout_duration,omitempty" structs:"lockout_duration" mapstructure:"lockout_duration"`
	LockoutCounterReset int   `json:"lockout_counter_reset,omitempty" structs:"lockout_counter_reset" mapstructure:"lockout_counter_reset"`
	DisableLockout      *bool `json:"disable_lockout,omitempty" structs:"disable_lockout" mapstructure:"disable_lockout"`
}

type MountMigrationOutput struct {
	MigrationID string `mapstructure:"migration_id"`
}

type MountMigrationStatusOutput struct {
	MigrationID   string                    `mapstructure:"migration_id"`
	MigrationInfo *MountMigrationStatusInfo `mapstructure:"migration_info"`
}

type MountMigrationStatusInfo struct {
	SourceMount     string `mapstructure:"source_mount"`
	TargetMount     string `mapstructure:"target_mount"`
	MigrationStatus string `mapstructure:"status"`
}
