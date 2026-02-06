// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/mitchellh/mapstructure"
)

func (c *Sys) AuditHash(path string, input string) (string, error) {
	return c.AuditHashWithContext(context.Background(), path, input)
}

func (c *Sys) AuditHashWithContext(ctx context.Context, path string, input string) (string, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	body := map[string]interface{}{
		"input": input,
	}

	r := c.c.NewRequest(http.MethodPut, fmt.Sprintf("/v1/sys/audit-hash/%s", path))
	if err := r.SetJSONBody(body); err != nil {
		return "", err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	secret, err := ParseSecret(resp.Body)
	if err != nil {
		return "", err
	}
	if secret == nil || secret.Data == nil {
		return "", errors.New("data from server response is empty")
	}

	hash, ok := secret.Data["hash"]
	if !ok {
		return "", errors.New("hash not found in response data")
	}
	hashStr, ok := hash.(string)
	if !ok {
		return "", errors.New("could not parse hash in response data")
	}

	return hashStr, nil
}

func (c *Sys) ListAudit() (map[string]*Audit, error) {
	return c.ListAuditWithContext(context.Background())
}

func (c *Sys) ListAuditWithContext(ctx context.Context) (map[string]*Audit, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, "/v1/sys/audit")

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

	mounts := map[string]*Audit{}
	err = mapstructure.Decode(secret.Data, &mounts)
	if err != nil {
		return nil, err
	}

	return mounts, nil
}

// DEPRECATED: Use EnableAuditWithOptions instead
func (c *Sys) EnableAudit(
	path string, auditType string, desc string, opts map[string]string,
) error {
	return c.EnableAuditWithOptions(path, &EnableAuditOptions{
		Type:        auditType,
		Description: desc,
		Options:     opts,
	})
}

func (c *Sys) EnableAuditWithOptions(path string, options *EnableAuditOptions) error {
	return c.EnableAuditWithOptionsWithContext(context.Background(), path, options)
}

func (c *Sys) EnableAuditWithOptionsWithContext(ctx context.Context, path string, options *EnableAuditOptions) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPut, fmt.Sprintf("/v1/sys/audit/%s", path))
	if err := r.SetJSONBody(options); err != nil {
		return err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (c *Sys) DisableAudit(path string) error {
	return c.DisableAuditWithContext(context.Background(), path)
}

func (c *Sys) DisableAuditWithContext(ctx context.Context, path string) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodDelete, fmt.Sprintf("/v1/sys/audit/%s", path))

	resp, err := c.c.rawRequestWithContext(ctx, r)

	if err == nil {
		defer resp.Body.Close()
	}
	return err
}

// Structures for the requests/response are all down here. They aren't
// individually documented because the map almost directly to the raw HTTP API
// documentation. Please refer to that documentation for more details.

type EnableAuditOptions struct {
	Type        string            `json:"type" mapstructure:"type"`
	Description string            `json:"description" mapstructure:"description"`
	Options     map[string]string `json:"options" mapstructure:"options"`
	Local       bool              `json:"local" mapstructure:"local"`
}

type Audit struct {
	Type        string            `json:"type" mapstructure:"type"`
	Description string            `json:"description" mapstructure:"description"`
	Options     map[string]string `json:"options" mapstructure:"options"`
	Local       bool              `json:"local" mapstructure:"local"`
	Path        string            `json:"path" mapstructure:"path"`
}
