// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"fmt"
	"net/http"
)

// Help wraps HelpWithContext using context.Background.
func (c *Client) Help(path string) (*Help, error) {
	return c.HelpWithContext(context.Background(), path)
}

// HelpWithContext reads the help information for the given path.
func (c *Client) HelpWithContext(ctx context.Context, path string) (*Help, error) {
	ctx, cancelFunc := c.withConfiguredTimeout(ctx)
	defer cancelFunc()

	r := c.NewRequest(http.MethodGet, fmt.Sprintf("/v1/%s", path))
	r.Params.Add("help", "1")

	resp, err := c.rawRequestWithContext(ctx, r)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result Help
	err = resp.DecodeJSON(&result)
	return &result, err
}

type Help struct {
	Help    string                 `json:"help"`
	SeeAlso []string               `json:"see_also"`
	OpenAPI map[string]interface{} `json:"openapi"`
}
