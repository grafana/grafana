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

func (c *Sys) CapabilitiesSelf(path string) ([]string, error) {
	return c.CapabilitiesSelfWithContext(context.Background(), path)
}

func (c *Sys) CapabilitiesSelfWithContext(ctx context.Context, path string) ([]string, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	return c.CapabilitiesWithContext(ctx, c.c.Token(), path)
}

func (c *Sys) Capabilities(token, path string) ([]string, error) {
	return c.CapabilitiesWithContext(context.Background(), token, path)
}

func (c *Sys) CapabilitiesWithContext(ctx context.Context, token, path string) ([]string, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	body := map[string]string{
		"token": token,
		"path":  path,
	}

	reqPath := "/v1/sys/capabilities"
	if token == c.c.Token() {
		reqPath = fmt.Sprintf("%s-self", reqPath)
	}

	r := c.c.NewRequest(http.MethodPost, reqPath)
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

	var res []string
	err = mapstructure.Decode(secret.Data[path], &res)
	if err != nil {
		return nil, err
	}

	if len(res) == 0 {
		_, ok := secret.Data["capabilities"]
		if ok {
			err = mapstructure.Decode(secret.Data["capabilities"], &res)
			if err != nil {
				return nil, err
			}
		}
	}

	return res, nil
}

func (c *Sys) CapabilitiesAccessor(accessor, path string) ([]string, error) {
	return c.CapabilitiesAccessorWithContext(context.Background(), accessor, path)
}

func (c *Sys) CapabilitiesAccessorWithContext(ctx context.Context, accessor, path string) ([]string, error) {
	ctx, cancelFunc := c.c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	body := map[string]string{
		"accessor": accessor,
		"path":     path,
	}

	reqPath := "/v1/sys/capabilities-accessor"

	r := c.c.NewRequest(http.MethodPost, reqPath)
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

	var res []string
	err = mapstructure.Decode(secret.Data[path], &res)
	if err != nil {
		return nil, err
	}

	if len(res) == 0 {
		_, ok := secret.Data["capabilities"]
		if ok {
			err = mapstructure.Decode(secret.Data["capabilities"], &res)
			if err != nil {
				return nil, err
			}
		}
	}

	return res, nil
}
