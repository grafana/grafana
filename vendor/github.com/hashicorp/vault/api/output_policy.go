// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	ErrOutputPolicyRequest = "output a policy, please"
)

var LastOutputPolicyError *OutputPolicyError

type OutputPolicyError struct {
	method         string
	path           string
	params         url.Values
	finalHCLString string
}

func (d *OutputPolicyError) Error() string {
	if d.finalHCLString == "" {
		p, err := d.buildSamplePolicy()
		if err != nil {
			return err.Error()
		}
		d.finalHCLString = p
	}

	return ErrOutputPolicyRequest
}

func (d *OutputPolicyError) HCLString() (string, error) {
	if d.finalHCLString == "" {
		p, err := d.buildSamplePolicy()
		if err != nil {
			return "", err
		}
		d.finalHCLString = p
	}
	return d.finalHCLString, nil
}

// Builds a sample policy document from the request
func (d *OutputPolicyError) buildSamplePolicy() (string, error) {
	operation := d.method
	// List is often defined as a URL param instead of as an http.Method
	// this will check for the header and properly switch off of the intended functionality
	if d.params.Has("list") {
		isList, err := strconv.ParseBool(d.params.Get("list"))
		if err != nil {
			return "", fmt.Errorf("the value of the list url param is not a bool: %v", err)
		}

		if isList {
			operation = "LIST"
		}
	}

	var capabilities []string
	switch operation {
	case http.MethodGet, "":
		capabilities = append(capabilities, "read")
	case http.MethodPost, http.MethodPut:
		capabilities = append(capabilities, "create")
		capabilities = append(capabilities, "update")
	case http.MethodPatch:
		capabilities = append(capabilities, "patch")
	case http.MethodDelete:
		capabilities = append(capabilities, "delete")
	case "LIST":
		capabilities = append(capabilities, "list")
	}

	// determine whether to add sudo capability
	if IsSudoPath(d.path) {
		capabilities = append(capabilities, "sudo")
	}

	return formatOutputPolicy(d.path, capabilities), nil
}

func formatOutputPolicy(path string, capabilities []string) string {
	// the OpenAPI response has a / in front of each path,
	// but policies need the path without that leading slash
	path = strings.TrimLeft(path, "/")

	capStr := strings.Join(capabilities, `", "`)
	return fmt.Sprintf(
		`path "%s" {
  capabilities = ["%s"]
}`, path, capStr)
}
