// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"context"
)

// EmojisService provides access to emoji-related functions in the GitHub API.
type EmojisService service

// List returns the emojis available to use on GitHub.
//
// GitHub API docs: https://docs.github.com/rest/emojis/emojis#get-emojis
//
//meta:operation GET /emojis
func (s *EmojisService) List(ctx context.Context) (map[string]string, *Response, error) {
	req, err := s.client.NewRequest("GET", "emojis", nil)
	if err != nil {
		return nil, nil, err
	}

	var emoji map[string]string
	resp, err := s.client.Do(ctx, req, &emoji)
	if err != nil {
		return nil, resp, err
	}

	return emoji, resp, nil
}

// ListEmojis returns the emojis available to use on GitHub.
//
// Deprecated: Use EmojisService.List instead
func (c *Client) ListEmojis(ctx context.Context) (map[string]string, *Response, error) {
	return c.Emojis.List(ctx)
}
