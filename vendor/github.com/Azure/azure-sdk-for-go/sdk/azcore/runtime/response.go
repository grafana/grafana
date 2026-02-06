//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"

	azexported "github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/exported"
)

// Payload reads and returns the response body or an error.
// On a successful read, the response body is cached.
// Subsequent reads will access the cached value.
func Payload(resp *http.Response) ([]byte, error) {
	return exported.Payload(resp, nil)
}

// HasStatusCode returns true if the Response's status code is one of the specified values.
func HasStatusCode(resp *http.Response, statusCodes ...int) bool {
	return exported.HasStatusCode(resp, statusCodes...)
}

// UnmarshalAsByteArray will base-64 decode the received payload and place the result into the value pointed to by v.
func UnmarshalAsByteArray(resp *http.Response, v *[]byte, format Base64Encoding) error {
	p, err := Payload(resp)
	if err != nil {
		return err
	}
	return DecodeByteArray(string(p), v, format)
}

// UnmarshalAsJSON calls json.Unmarshal() to unmarshal the received payload into the value pointed to by v.
func UnmarshalAsJSON(resp *http.Response, v any) error {
	payload, err := Payload(resp)
	if err != nil {
		return err
	}
	// TODO: verify early exit is correct
	if len(payload) == 0 {
		return nil
	}
	err = removeBOM(resp)
	if err != nil {
		return err
	}
	err = json.Unmarshal(payload, v)
	if err != nil {
		err = fmt.Errorf("unmarshalling type %T: %s", v, err)
	}
	return err
}

// UnmarshalAsXML calls xml.Unmarshal() to unmarshal the received payload into the value pointed to by v.
func UnmarshalAsXML(resp *http.Response, v any) error {
	payload, err := Payload(resp)
	if err != nil {
		return err
	}
	// TODO: verify early exit is correct
	if len(payload) == 0 {
		return nil
	}
	err = removeBOM(resp)
	if err != nil {
		return err
	}
	err = xml.Unmarshal(payload, v)
	if err != nil {
		err = fmt.Errorf("unmarshalling type %T: %s", v, err)
	}
	return err
}

// Drain reads the response body to completion then closes it.  The bytes read are discarded.
func Drain(resp *http.Response) {
	if resp != nil && resp.Body != nil {
		_, _ = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}

// removeBOM removes any byte-order mark prefix from the payload if present.
func removeBOM(resp *http.Response) error {
	_, err := exported.Payload(resp, &exported.PayloadOptions{
		BytesModifier: func(b []byte) []byte {
			// UTF8
			return bytes.TrimPrefix(b, []byte("\xef\xbb\xbf"))
		},
	})
	if err != nil {
		return err
	}
	return nil
}

// DecodeByteArray will base-64 decode the provided string into v.
func DecodeByteArray(s string, v *[]byte, format Base64Encoding) error {
	return azexported.DecodeByteArray(s, v, format)
}
