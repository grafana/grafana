//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package shared

const (
	ContentTypeAppJSON   = "application/json"
	ContentTypeAppXML    = "application/xml"
	ContentTypeTextPlain = "text/plain"
)

const (
	HeaderAuthorization          = "Authorization"
	HeaderAuxiliaryAuthorization = "x-ms-authorization-auxiliary"
	HeaderAzureAsync             = "Azure-AsyncOperation"
	HeaderContentLength          = "Content-Length"
	HeaderContentType            = "Content-Type"
	HeaderFakePollerStatus       = "Fake-Poller-Status"
	HeaderLocation               = "Location"
	HeaderOperationLocation      = "Operation-Location"
	HeaderRetryAfter             = "Retry-After"
	HeaderRetryAfterMS           = "Retry-After-Ms"
	HeaderUserAgent              = "User-Agent"
	HeaderWWWAuthenticate        = "WWW-Authenticate"
	HeaderXMSClientRequestID     = "x-ms-client-request-id"
	HeaderXMSRequestID           = "x-ms-request-id"
	HeaderXMSErrorCode           = "x-ms-error-code"
	HeaderXMSRetryAfterMS        = "x-ms-retry-after-ms"
)

const BearerTokenPrefix = "Bearer "

const TracingNamespaceAttrName = "az.namespace"

const (
	// Module is the name of the calling module used in telemetry data.
	Module = "azcore"

	// Version is the semantic version (see http://semver.org) of this module.
	Version = "v1.18.1"
)
