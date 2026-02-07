// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Response is a raw response that wraps an HTTP response.
type Response struct {
	*http.Response
}

// DecodeJSON will decode the response body to a JSON structure. This
// will consume the response body, but will not close it. Close must
// still be called.
func (r *Response) DecodeJSON(out interface{}) error {
	dec := json.NewDecoder(r.Body)
	dec.UseNumber()
	return dec.Decode(out)
}

// Error returns an error response if there is one. If there is an error,
// this will fully consume the response body, but will not close it. The
// body must still be closed manually.
func (r *Response) Error() error {
	// 200 to 399 are okay status codes. 429 is the code for health status of
	// standby nodes, otherwise, 429 is treated as quota limit reached.
	if (r.StatusCode >= 200 && r.StatusCode < 400) || (r.StatusCode == 429 && r.Request.URL.Path == "/v1/sys/health") {
		return nil
	}

	// We have an error. Let's copy the body into our own buffer first,
	// so that if we can't decode JSON, we can at least copy it raw.
	bodyBuf := &bytes.Buffer{}
	if _, err := io.Copy(bodyBuf, r.Body); err != nil {
		return err
	}

	r.Body.Close()
	r.Body = io.NopCloser(bodyBuf)
	ns := r.Header.Get(NamespaceHeaderName)

	// Build up the error object
	respErr := &ResponseError{
		HTTPMethod:    r.Request.Method,
		URL:           r.Request.URL.String(),
		StatusCode:    r.StatusCode,
		NamespacePath: ns,
	}

	// Decode the error response if we can. Note that we wrap the bodyBuf
	// in a bytes.Reader here so that the JSON decoder doesn't move the
	// read pointer for the original buffer.
	var resp ErrorResponse
	dec := json.NewDecoder(bytes.NewReader(bodyBuf.Bytes()))
	dec.UseNumber()
	if err := dec.Decode(&resp); err != nil {
		// Store the fact that we couldn't decode the errors
		respErr.RawError = true
		respErr.Errors = []string{bodyBuf.String()}
	} else {
		// Store the decoded errors
		respErr.Errors = resp.Errors
	}

	return respErr
}

// ErrorResponse is the raw structure of errors when they're returned by the
// HTTP API.
type ErrorResponse struct {
	Errors []string
}

// ResponseError is the error returned when Vault responds with an error or
// non-success HTTP status code. If a request to Vault fails because of a
// network error a different error message will be returned. ResponseError gives
// access to the underlying errors and status code.
type ResponseError struct {
	// HTTPMethod is the HTTP method for the request (PUT, GET, etc).
	HTTPMethod string

	// URL is the URL of the request.
	URL string

	// StatusCode is the HTTP status code.
	StatusCode int

	// RawError marks that the underlying error messages returned by Vault were
	// not parsable. The Errors slice will contain the raw response body as the
	// first and only error string if this value is set to true.
	RawError bool

	// Errors are the underlying errors returned by Vault.
	Errors []string

	// Namespace path to be reported to the client if it is set to anything other
	// than root
	NamespacePath string
}

// Error returns a human-readable error string for the response error.
func (r *ResponseError) Error() string {
	errString := "Errors"
	if r.RawError {
		errString = "Raw Message"
	}

	var ns string
	if r.NamespacePath != "" && r.NamespacePath != "root/" {
		ns = "Namespace: " + r.NamespacePath + "\n"
	}

	var errBody bytes.Buffer
	errBody.WriteString(fmt.Sprintf(
		"Error making API request.\n\n"+
			ns+
			"URL: %s %s\n"+
			"Code: %d. %s:\n\n",
		r.HTTPMethod, r.URL, r.StatusCode, errString))

	if r.RawError && len(r.Errors) == 1 {
		errBody.WriteString(r.Errors[0])
	} else {
		for _, err := range r.Errors {
			errBody.WriteString(fmt.Sprintf("* %s", err))
		}
	}

	return errBody.String()
}
