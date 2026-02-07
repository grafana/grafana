// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/hashicorp/go-retryablehttp"
)

const (
	ErrOutputStringRequest = "output a string, please"
)

var LastOutputStringError *OutputStringError

type OutputStringError struct {
	*retryablehttp.Request
	TLSSkipVerify              bool
	ClientCACert, ClientCAPath string
	ClientCert, ClientKey      string
	finalCurlString            string
}

// Error is here so that we can return this struct as an error from client.rawRequestWithContext(). Note that
// the ErrOutputStringRequest constant is never actually used and is completely irrelevant to how this all functions.
// We could've just as easily returned an empty string. What matters is the machinery that happens before then where
// the curl string is built. So yes, this is confusing, but yes, this is also on purpose, and it is not incorrect.
func (d *OutputStringError) Error() string {
	if d.finalCurlString == "" {
		cs, err := d.buildCurlString()
		if err != nil {
			return err.Error()
		}
		d.finalCurlString = cs
	}

	return ErrOutputStringRequest
}

func (d *OutputStringError) CurlString() (string, error) {
	if d.finalCurlString == "" {
		cs, err := d.buildCurlString()
		if err != nil {
			return "", err
		}
		d.finalCurlString = cs
	}
	return d.finalCurlString, nil
}

func (d *OutputStringError) buildCurlString() (string, error) {
	body, err := d.Request.BodyBytes()
	if err != nil {
		return "", err
	}

	// Build cURL string
	finalCurlString := "curl "
	if d.TLSSkipVerify {
		finalCurlString += "--insecure "
	}
	if d.Request.Method != http.MethodGet {
		finalCurlString = fmt.Sprintf("%s-X %s ", finalCurlString, d.Request.Method)
	}
	if d.ClientCACert != "" {
		clientCACert := strings.ReplaceAll(d.ClientCACert, "'", "'\"'\"'")
		finalCurlString = fmt.Sprintf("%s--cacert '%s' ", finalCurlString, clientCACert)
	}
	if d.ClientCAPath != "" {
		clientCAPath := strings.ReplaceAll(d.ClientCAPath, "'", "'\"'\"'")
		finalCurlString = fmt.Sprintf("%s--capath '%s' ", finalCurlString, clientCAPath)
	}
	if d.ClientCert != "" {
		clientCert := strings.ReplaceAll(d.ClientCert, "'", "'\"'\"'")
		finalCurlString = fmt.Sprintf("%s--cert '%s' ", finalCurlString, clientCert)
	}
	if d.ClientKey != "" {
		clientKey := strings.ReplaceAll(d.ClientKey, "'", "'\"'\"'")
		finalCurlString = fmt.Sprintf("%s--key '%s' ", finalCurlString, clientKey)
	}
	for k, v := range d.Request.Header {
		for _, h := range v {
			if strings.ToLower(k) == "x-vault-token" {
				h = `$(vault print token)`
			}
			finalCurlString = fmt.Sprintf("%s-H \"%s: %s\" ", finalCurlString, k, h)
		}
	}

	if len(body) > 0 {
		// We need to escape single quotes since that's what we're using to
		// quote the body
		escapedBody := strings.ReplaceAll(string(body), "'", "'\"'\"'")
		finalCurlString = fmt.Sprintf("%s-d '%s' ", finalCurlString, escapedBody)
	}

	return fmt.Sprintf("%s%s", finalCurlString, d.Request.URL.String()), nil
}
