// Copyright 2023 The go-github AUTHORS. All rights reserved.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package github

import (
	"bytes"
	"context"
)

// MarkdownService provides access to markdown-related functions in the GitHub API.
type MarkdownService service

// MarkdownOptions specifies optional parameters to the Render method.
type MarkdownOptions struct {
	// Mode identifies the rendering mode. Possible values are:
	//   markdown - render a document as plain Render, just like
	//   README files are rendered.
	//
	//   gfm - to render a document as user-content, e.g. like user
	//   comments or issues are rendered. In GFM mode, hard line breaks are
	//   always taken into account, and issue and user mentions are linked
	//   accordingly.
	//
	// Default is "markdown".
	Mode string

	// Context identifies the repository context. Only taken into account
	// when rendering as "gfm".
	Context string
}

type markdownRenderRequest struct {
	Text    *string `json:"text,omitempty"`
	Mode    *string `json:"mode,omitempty"`
	Context *string `json:"context,omitempty"`
}

// Render renders an arbitrary Render document.
//
// GitHub API docs: https://docs.github.com/rest/markdown/markdown#render-a-markdown-document
//
//meta:operation POST /markdown
func (s *MarkdownService) Render(ctx context.Context, text string, opts *MarkdownOptions) (string, *Response, error) {
	request := &markdownRenderRequest{Text: Ptr(text)}
	if opts != nil {
		if opts.Mode != "" {
			request.Mode = Ptr(opts.Mode)
		}
		if opts.Context != "" {
			request.Context = Ptr(opts.Context)
		}
	}

	req, err := s.client.NewRequest("POST", "markdown", request)
	if err != nil {
		return "", nil, err
	}

	buf := new(bytes.Buffer)
	resp, err := s.client.Do(ctx, req, buf)
	if err != nil {
		return "", resp, err
	}

	return buf.String(), resp, nil
}
