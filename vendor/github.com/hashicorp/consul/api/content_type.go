// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"net/http"
	"strings"
)

const (
	contentTypeHeader = "Content-Type"
	plainContentType  = "text/plain; charset=utf-8"
	octetStream       = "application/octet-stream"
	jsonContentType   = "application/json" // Default content type
)

// ContentTypeRule defines a rule for determining the content type of an HTTP request.
// This rule is based on the combination of the HTTP path, method, and the desired content type.
type ContentTypeRule struct {
	path        string
	httpMethod  string
	contentType string
}

var ContentTypeRules = []ContentTypeRule{
	{
		path:        "/v1/snapshot",
		httpMethod:  http.MethodPut,
		contentType: octetStream,
	},
	{
		path:        "/v1/kv",
		httpMethod:  http.MethodPut,
		contentType: octetStream,
	},
	{
		path:        "/v1/event/fire",
		httpMethod:  http.MethodPut,
		contentType: octetStream,
	},
}

// GetContentType returns the content type for a request
// This function isused as routing logic or middleware to determine and enforce
// the appropriate content type for HTTP requests.
func GetContentType(req *http.Request) string {
	reqContentType := req.Header.Get(contentTypeHeader)

	if isIndexPage(req) {
		return plainContentType
	}

	// For GET, DELETE, or internal API paths, ensure a valid Content-Type is returned.
	if req.Method == http.MethodGet || req.Method == http.MethodDelete || strings.HasPrefix(req.URL.Path, "/v1/internal") {
		if reqContentType == "" {
			// Default to JSON Content-Type if no Content-Type is provided.
			return jsonContentType
		}
		// Return the provided Content-Type if it exists.
		return reqContentType
	}

	for _, rule := range ContentTypeRules {
		if matchesRule(req, rule) {
			return rule.contentType
		}
	}
	return jsonContentType
}

// matchesRule checks if a request matches a content type rule
func matchesRule(req *http.Request, rule ContentTypeRule) bool {
	return strings.HasPrefix(req.URL.Path, rule.path) &&
		(rule.httpMethod == "" || req.Method == rule.httpMethod)
}

// isIndexPage checks if the request is for the index page
func isIndexPage(req *http.Request) bool {
	return req.URL.Path == "/" || req.URL.Path == "/ui"
}
