//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"net/http"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
)

// NewResponseError creates an *azcore.ResponseError from the provided HTTP response.
// Call this when a service request returns a non-successful status code.
// The error code will be extracted from the *http.Response, either from the x-ms-error-code
// header (preferred) or attempted to be parsed from the response body.
func NewResponseError(resp *http.Response) error {
	return exported.NewResponseError(resp)
}

// NewResponseErrorWithErrorCode creates an *azcore.ResponseError from the provided HTTP response and errorCode.
// Use this variant when the error code is in a non-standard location.
func NewResponseErrorWithErrorCode(resp *http.Response, errorCode string) error {
	return exported.NewResponseErrorWithErrorCode(resp, errorCode)
}
