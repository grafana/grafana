// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"net/http"
)

func (c *Sys) GenerateRootStatus() (*GenerateRootStatusResponse, error) {
	return c.GenerateRootStatusWithContext(context.Background())
}

func (c *Sys) GenerateDROperationTokenStatus() (*GenerateRootStatusResponse, error) {
	return c.GenerateDROperationTokenStatusWithContext(context.Background())
}

func (c *Sys) GenerateRecoveryOperationTokenStatus() (*GenerateRootStatusResponse, error) {
	return c.GenerateRecoveryOperationTokenStatusWithContext(context.Background())
}

func (c *Sys) GenerateRootStatusWithContext(ctx context.Context) (*GenerateRootStatusResponse, error) {
	return c.generateRootStatusCommonWithContext(ctx, "/v1/sys/generate-root/attempt")
}

func (c *Sys) GenerateDROperationTokenStatusWithContext(ctx context.Context) (*GenerateRootStatusResponse, error) {
	return c.generateRootStatusCommonWithContext(ctx, "/v1/sys/replication/dr/secondary/generate-operation-token/attempt")
}

func (c *Sys) GenerateRecoveryOperationTokenStatusWithContext(ctx context.Context) (*GenerateRootStatusResponse, error) {
	return c.generateRootStatusCommonWithContext(ctx, "/v1/sys/generate-recovery-token/attempt")
}

func (c *Sys) generateRootStatusCommonWithContext(ctx context.Context, path string) (*GenerateRootStatusResponse, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, path)

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result GenerateRootStatusResponse
	err = resp.DecodeJSON(&result)
	return &result, err
}

func (c *Sys) GenerateRootInit(otp, pgpKey string) (*GenerateRootStatusResponse, error) {
	return c.GenerateRootInitWithContext(context.Background(), otp, pgpKey)
}

func (c *Sys) GenerateDROperationTokenInit(otp, pgpKey string) (*GenerateRootStatusResponse, error) {
	return c.GenerateDROperationTokenInitWithContext(context.Background(), otp, pgpKey)
}

func (c *Sys) GenerateRecoveryOperationTokenInit(otp, pgpKey string) (*GenerateRootStatusResponse, error) {
	return c.GenerateRecoveryOperationTokenInitWithContext(context.Background(), otp, pgpKey)
}

func (c *Sys) GenerateRootInitWithContext(ctx context.Context, otp, pgpKey string) (*GenerateRootStatusResponse, error) {
	return c.generateRootInitCommonWithContext(ctx, "/v1/sys/generate-root/attempt", otp, pgpKey)
}

func (c *Sys) GenerateDROperationTokenInitWithContext(ctx context.Context, otp, pgpKey string) (*GenerateRootStatusResponse, error) {
	return c.generateRootInitCommonWithContext(ctx, "/v1/sys/replication/dr/secondary/generate-operation-token/attempt", otp, pgpKey)
}

func (c *Sys) GenerateRecoveryOperationTokenInitWithContext(ctx context.Context, otp, pgpKey string) (*GenerateRootStatusResponse, error) {
	return c.generateRootInitCommonWithContext(ctx, "/v1/sys/generate-recovery-token/attempt", otp, pgpKey)
}

func (c *Sys) generateRootInitCommonWithContext(ctx context.Context, path, otp, pgpKey string) (*GenerateRootStatusResponse, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	body := map[string]interface{}{
		"otp":     otp,
		"pgp_key": pgpKey,
	}

	r := c.c.NewRequest(http.MethodPut, path)
	if err := r.SetJSONBody(body); err != nil {
		return nil, err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result GenerateRootStatusResponse
	err = resp.DecodeJSON(&result)
	return &result, err
}

func (c *Sys) GenerateRootCancel() error {
	return c.GenerateRootCancelWithContext(context.Background())
}

func (c *Sys) GenerateDROperationTokenCancel() error {
	return c.GenerateDROperationTokenCancelWithContext(context.Background())
}

func (c *Sys) GenerateRecoveryOperationTokenCancel() error {
	return c.GenerateRecoveryOperationTokenCancelWithContext(context.Background())
}

func (c *Sys) GenerateRootCancelWithContext(ctx context.Context) error {
	return c.generateRootCancelCommonWithContext(ctx, "/v1/sys/generate-root/attempt")
}

func (c *Sys) GenerateDROperationTokenCancelWithContext(ctx context.Context) error {
	return c.generateRootCancelCommonWithContext(ctx, "/v1/sys/replication/dr/secondary/generate-operation-token/attempt")
}

func (c *Sys) GenerateRecoveryOperationTokenCancelWithContext(ctx context.Context) error {
	return c.generateRootCancelCommonWithContext(ctx, "/v1/sys/generate-recovery-token/attempt")
}

func (c *Sys) generateRootCancelCommonWithContext(ctx context.Context, path string) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodDelete, path)

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err == nil {
		defer resp.Body.Close()
	}
	return err
}

func (c *Sys) GenerateRootUpdate(shard, nonce string) (*GenerateRootStatusResponse, error) {
	return c.GenerateRootUpdateWithContext(context.Background(), shard, nonce)
}

func (c *Sys) GenerateDROperationTokenUpdate(shard, nonce string) (*GenerateRootStatusResponse, error) {
	return c.GenerateDROperationTokenUpdateWithContext(context.Background(), shard, nonce)
}

func (c *Sys) GenerateRecoveryOperationTokenUpdate(shard, nonce string) (*GenerateRootStatusResponse, error) {
	return c.GenerateRecoveryOperationTokenUpdateWithContext(context.Background(), shard, nonce)
}

func (c *Sys) GenerateRootUpdateWithContext(ctx context.Context, shard, nonce string) (*GenerateRootStatusResponse, error) {
	return c.generateRootUpdateCommonWithContext(ctx, "/v1/sys/generate-root/update", shard, nonce)
}

func (c *Sys) GenerateDROperationTokenUpdateWithContext(ctx context.Context, shard, nonce string) (*GenerateRootStatusResponse, error) {
	return c.generateRootUpdateCommonWithContext(ctx, "/v1/sys/replication/dr/secondary/generate-operation-token/update", shard, nonce)
}

func (c *Sys) GenerateRecoveryOperationTokenUpdateWithContext(ctx context.Context, shard, nonce string) (*GenerateRootStatusResponse, error) {
	return c.generateRootUpdateCommonWithContext(ctx, "/v1/sys/generate-recovery-token/update", shard, nonce)
}

func (c *Sys) generateRootUpdateCommonWithContext(ctx context.Context, path, shard, nonce string) (*GenerateRootStatusResponse, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	body := map[string]interface{}{
		"key":   shard,
		"nonce": nonce,
	}

	r := c.c.NewRequest(http.MethodPut, path)
	if err := r.SetJSONBody(body); err != nil {
		return nil, err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result GenerateRootStatusResponse
	err = resp.DecodeJSON(&result)
	return &result, err
}

type GenerateRootStatusResponse struct {
	Nonce            string `json:"nonce"`
	Started          bool   `json:"started"`
	Progress         int    `json:"progress"`
	Required         int    `json:"required"`
	Complete         bool   `json:"complete"`
	EncodedToken     string `json:"encoded_token"`
	EncodedRootToken string `json:"encoded_root_token"`
	PGPFingerprint   string `json:"pgp_fingerprint"`
	OTP              string `json:"otp"`
	OTPLength        int    `json:"otp_length"`
}
