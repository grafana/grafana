// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"net/http"
)

func (c *Sys) SealStatus() (*SealStatusResponse, error) {
	return c.SealStatusWithContext(context.Background())
}

func (c *Sys) SealStatusWithContext(ctx context.Context) (*SealStatusResponse, error) {
	r := c.c.NewRequest(http.MethodGet, "/v1/sys/seal-status")
	return sealStatusRequestWithContext(ctx, c, r)
}

func (c *Sys) Seal() error {
	return c.SealWithContext(context.Background())
}

func (c *Sys) SealWithContext(ctx context.Context) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPut, "/v1/sys/seal")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func (c *Sys) ResetUnsealProcess() (*SealStatusResponse, error) {
	return c.ResetUnsealProcessWithContext(context.Background())
}

func (c *Sys) ResetUnsealProcessWithContext(ctx context.Context) (*SealStatusResponse, error) {
	body := map[string]interface{}{"reset": true}

	r := c.c.NewRequest(http.MethodPut, "/v1/sys/unseal")
	if err := r.SetJSONBody(body); err != nil {
		return nil, err
	}

	return sealStatusRequestWithContext(ctx, c, r)
}

func (c *Sys) Unseal(shard string) (*SealStatusResponse, error) {
	return c.UnsealWithContext(context.Background(), shard)
}

func (c *Sys) UnsealWithContext(ctx context.Context, shard string) (*SealStatusResponse, error) {
	body := map[string]interface{}{"key": shard}

	r := c.c.NewRequest(http.MethodPut, "/v1/sys/unseal")
	if err := r.SetJSONBody(body); err != nil {
		return nil, err
	}

	return sealStatusRequestWithContext(ctx, c, r)
}

func (c *Sys) UnsealWithOptions(opts *UnsealOpts) (*SealStatusResponse, error) {
	return c.UnsealWithOptionsWithContext(context.Background(), opts)
}

func (c *Sys) UnsealWithOptionsWithContext(ctx context.Context, opts *UnsealOpts) (*SealStatusResponse, error) {
	r := c.c.NewRequest(http.MethodPut, "/v1/sys/unseal")

	if err := r.SetJSONBody(opts); err != nil {
		return nil, err
	}

	return sealStatusRequestWithContext(ctx, c, r)
}

func sealStatusRequestWithContext(ctx context.Context, c *Sys, r *Request) (*SealStatusResponse, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result SealStatusResponse
	err = resp.DecodeJSON(&result)
	return &result, err
}

type SealStatusResponse struct {
	Type               string   `json:"type"`
	Initialized        bool     `json:"initialized"`
	Sealed             bool     `json:"sealed"`
	T                  int      `json:"t"`
	N                  int      `json:"n"`
	Progress           int      `json:"progress"`
	Nonce              string   `json:"nonce"`
	Version            string   `json:"version"`
	BuildDate          string   `json:"build_date"`
	Migration          bool     `json:"migration"`
	ClusterName        string   `json:"cluster_name,omitempty"`
	ClusterID          string   `json:"cluster_id,omitempty"`
	RecoverySeal       bool     `json:"recovery_seal"`
	RecoverySealType   string   `json:"recovery_seal_type,omitempty"`
	StorageType        string   `json:"storage_type,omitempty"`
	HCPLinkStatus      string   `json:"hcp_link_status,omitempty"`
	HCPLinkResourceID  string   `json:"hcp_link_resource_ID,omitempty"`
	RemovedFromCluster *bool    `json:"removed_from_cluster,omitempty"`
	Warnings           []string `json:"warnings,omitempty"`
}

type UnsealOpts struct {
	Key     string `json:"key"`
	Reset   bool   `json:"reset"`
	Migrate bool   `json:"migrate"`
}
