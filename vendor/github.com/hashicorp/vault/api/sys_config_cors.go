// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/mitchellh/mapstructure"
)

func (c *Sys) CORSStatus() (*CORSResponse, error) {
	return c.CORSStatusWithContext(context.Background())
}

func (c *Sys) CORSStatusWithContext(ctx context.Context) (*CORSResponse, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodGet, "/v1/sys/config/cors")

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

	var result CORSResponse
	err = mapstructure.Decode(secret.Data, &result)
	if err != nil {
		return nil, err
	}

	return &result, err
}

func (c *Sys) ConfigureCORS(req *CORSRequest) error {
	return c.ConfigureCORSWithContext(context.Background(), req)
}

func (c *Sys) ConfigureCORSWithContext(ctx context.Context, req *CORSRequest) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodPut, "/v1/sys/config/cors")
	if err := r.SetJSONBody(req); err != nil {
		return err
	}

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err == nil {
		defer resp.Body.Close()
	}
	return err
}

func (c *Sys) DisableCORS() error {
	return c.DisableCORSWithContext(context.Background())
}

func (c *Sys) DisableCORSWithContext(ctx context.Context) error {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.c.NewRequest(http.MethodDelete, "/v1/sys/config/cors")

	resp, err := c.c.rawRequestWithContext(ctx, r)
	if err == nil {
		defer resp.Body.Close()
	}
	return err
}

type CORSRequest struct {
	AllowedOrigins []string `json:"allowed_origins" mapstructure:"allowed_origins"`
	AllowedHeaders []string `json:"allowed_headers" mapstructure:"allowed_headers"`
	Enabled        bool     `json:"enabled" mapstructure:"enabled"`
}

type CORSResponse struct {
	AllowedOrigins []string `json:"allowed_origins" mapstructure:"allowed_origins"`
	AllowedHeaders []string `json:"allowed_headers" mapstructure:"allowed_headers"`
	Enabled        bool     `json:"enabled" mapstructure:"enabled"`
}
