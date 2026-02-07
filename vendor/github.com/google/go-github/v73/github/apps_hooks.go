// Copyright 2021 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
)

// GetHookConfig returns the webhook configuration for a GitHub App.
// The underlying transport must be authenticated as an app.
//
// GitHub API docs: https://docs.github.com/rest/apps/webhooks#get-a-webhook-configuration-for-an-app
//
//meta:operation GET /app/hook/config
func (s *AppsService) GetHookConfig(ctx context.Context) (*HookConfig, *Response, error) {
	req, err := s.client.NewRequest("GET", "app/hook/config", nil)
	if err != nil {
		return nil, nil, err
	}

	config := new(HookConfig)
	resp, err := s.client.Do(ctx, req, &config)
	if err != nil {
		return nil, resp, err
	}

	return config, resp, nil
}

// UpdateHookConfig updates the webhook configuration for a GitHub App.
// The underlying transport must be authenticated as an app.
//
// GitHub API docs: https://docs.github.com/rest/apps/webhooks#update-a-webhook-configuration-for-an-app
//
//meta:operation PATCH /app/hook/config
func (s *AppsService) UpdateHookConfig(ctx context.Context, config *HookConfig) (*HookConfig, *Response, error) {
	req, err := s.client.NewRequest("PATCH", "app/hook/config", config)
	if err != nil {
		return nil, nil, err
	}

	c := new(HookConfig)
	resp, err := s.client.Do(ctx, req, c)
	if err != nil {
		return nil, resp, err
	}

	return c, resp, nil
}
