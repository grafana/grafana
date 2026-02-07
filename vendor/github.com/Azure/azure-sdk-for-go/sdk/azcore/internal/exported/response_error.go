//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package exported

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/log"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/exported"
)

// NewResponseError creates a new *ResponseError from the provided HTTP response.
// Exported as runtime.NewResponseError().
func NewResponseError(resp *http.Response) error {
	// prefer the error code in the response header
	if ec := resp.Header.Get(shared.HeaderXMSErrorCode); ec != "" {
		return NewResponseErrorWithErrorCode(resp, ec)
	}

	// if we didn't get x-ms-error-code, check in the response body
	body, err := exported.Payload(resp, nil)
	if err != nil {
		// since we're not returning the ResponseError in this
		// case we also don't want to write it to the log.
		return err
	}

	var errorCode string
	if len(body) > 0 {
		if fromJSON := extractErrorCodeJSON(body); fromJSON != "" {
			errorCode = fromJSON
		} else if fromXML := extractErrorCodeXML(body); fromXML != "" {
			errorCode = fromXML
		}
	}

	return NewResponseErrorWithErrorCode(resp, errorCode)
}

// NewResponseErrorWithErrorCode creates an *azcore.ResponseError from the provided HTTP response and errorCode.
// Exported as runtime.NewResponseErrorWithErrorCode().
func NewResponseErrorWithErrorCode(resp *http.Response, errorCode string) error {
	respErr := &ResponseError{
		ErrorCode:   errorCode,
		StatusCode:  resp.StatusCode,
		RawResponse: resp,
	}
	log.Write(log.EventResponseError, respErr.Error())
	return respErr
}

func extractErrorCodeJSON(body []byte) string {
	var rawObj map[string]any
	if err := json.Unmarshal(body, &rawObj); err != nil {
		// not a JSON object
		return ""
	}

	// check if this is a wrapped error, i.e. { "error": { ... } }
	// if so then unwrap it
	if wrapped, ok := rawObj["error"]; ok {
		unwrapped, ok := wrapped.(map[string]any)
		if !ok {
			return ""
		}
		rawObj = unwrapped
	} else if wrapped, ok := rawObj["odata.error"]; ok {
		// check if this a wrapped odata error, i.e. { "odata.error": { ... } }
		unwrapped, ok := wrapped.(map[string]any)
		if !ok {
			return ""
		}
		rawObj = unwrapped
	}

	// now check for the error code
	code, ok := rawObj["code"]
	if !ok {
		return ""
	}
	codeStr, ok := code.(string)
	if !ok {
		return ""
	}
	return codeStr
}

func extractErrorCodeXML(body []byte) string {
	// regular expression is much easier than dealing with the XML parser
	rx := regexp.MustCompile(`<(?:\w+:)?[c|C]ode>\s*(\w+)\s*<\/(?:\w+:)?[c|C]ode>`)
	res := rx.FindStringSubmatch(string(body))
	if len(res) != 2 {
		return ""
	}
	// first submatch is the entire thing, second one is the captured error code
	return res[1]
}

// ResponseError is returned when a request is made to a service and
// the service returns a non-success HTTP status code.
// Use errors.As() to access this type in the error chain.
// Exported as azcore.ResponseError.
type ResponseError struct {
	// ErrorCode is the error code returned by the resource provider if available.
	ErrorCode string

	// StatusCode is the HTTP status code as defined in https://pkg.go.dev/net/http#pkg-constants.
	StatusCode int

	// RawResponse is the underlying HTTP response.
	RawResponse *http.Response `json:"-"`

	errMsg string
}

// Error implements the error interface for type ResponseError.
// Note that the message contents are not contractual and can change over time.
func (e *ResponseError) Error() string {
	if e.errMsg != "" {
		return e.errMsg
	}

	const separator = "--------------------------------------------------------------------------------"
	// write the request method and URL with response status code
	msg := &bytes.Buffer{}
	if e.RawResponse != nil {
		if e.RawResponse.Request != nil {
			fmt.Fprintf(msg, "%s %s://%s%s\n", e.RawResponse.Request.Method, e.RawResponse.Request.URL.Scheme, e.RawResponse.Request.URL.Host, e.RawResponse.Request.URL.Path)
		} else {
			fmt.Fprintln(msg, "Request information not available")
		}
		fmt.Fprintln(msg, separator)
		fmt.Fprintf(msg, "RESPONSE %d: %s\n", e.RawResponse.StatusCode, e.RawResponse.Status)
	} else {
		fmt.Fprintln(msg, "Missing RawResponse")
		fmt.Fprintln(msg, separator)
	}
	if e.ErrorCode != "" {
		fmt.Fprintf(msg, "ERROR CODE: %s\n", e.ErrorCode)
	} else {
		fmt.Fprintln(msg, "ERROR CODE UNAVAILABLE")
	}
	if e.RawResponse != nil {
		fmt.Fprintln(msg, separator)
		body, err := exported.Payload(e.RawResponse, nil)
		if err != nil {
			// this really shouldn't fail at this point as the response
			// body is already cached (it was read in NewResponseError)
			fmt.Fprintf(msg, "Error reading response body: %v", err)
		} else if len(body) > 0 {
			if err := json.Indent(msg, body, "", "  "); err != nil {
				// failed to pretty-print so just dump it verbatim
				fmt.Fprint(msg, string(body))
			}
			// the standard library doesn't have a pretty-printer for XML
			fmt.Fprintln(msg)
		} else {
			fmt.Fprintln(msg, "Response contained no body")
		}
	}
	fmt.Fprintln(msg, separator)

	e.errMsg = msg.String()
	return e.errMsg
}

// internal type used for marshaling/unmarshaling
type responseError struct {
	ErrorCode    string `json:"errorCode"`
	StatusCode   int    `json:"statusCode"`
	ErrorMessage string `json:"errorMessage"`
}

func (e ResponseError) MarshalJSON() ([]byte, error) {
	return json.Marshal(responseError{
		ErrorCode:    e.ErrorCode,
		StatusCode:   e.StatusCode,
		ErrorMessage: e.Error(),
	})
}

func (e *ResponseError) UnmarshalJSON(data []byte) error {
	re := responseError{}
	if err := json.Unmarshal(data, &re); err != nil {
		return err
	}

	e.ErrorCode = re.ErrorCode
	e.StatusCode = re.StatusCode
	e.errMsg = re.ErrorMessage
	return nil
}
