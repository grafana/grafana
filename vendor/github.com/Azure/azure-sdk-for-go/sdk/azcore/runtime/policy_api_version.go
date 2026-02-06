//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
)

// APIVersionOptions contains options for API versions
type APIVersionOptions struct {
	// Location indicates where to set the version on a request, for example in a header or query param.
	Location APIVersionLocation
	// Name is the name of the header or query parameter, for example "api-version".
	// For [APIVersionLocationPath] the value is not used.
	Name string
}

// APIVersionLocation indicates which part of a request identifies the service version
type APIVersionLocation int

const (
	// APIVersionLocationQueryParam indicates a query parameter
	APIVersionLocationQueryParam = 0
	// APIVersionLocationHeader indicates a header
	APIVersionLocationHeader = 1
	// APIVersionLocationPath indicates a path segment
	APIVersionLocationPath = 2
)

// newAPIVersionPolicy constructs an APIVersionPolicy. If version is "", Do will be a no-op. If version
// isn't empty and opts.Name is empty, Do will return an error.
func newAPIVersionPolicy(version string, opts *APIVersionOptions) *apiVersionPolicy {
	if opts == nil {
		opts = &APIVersionOptions{}
	}
	return &apiVersionPolicy{location: opts.Location, name: opts.Name, version: version}
}

// apiVersionPolicy enables users to set the API version of every request a client sends.
type apiVersionPolicy struct {
	// location indicates whether "name" refers to a query parameter or header.
	location APIVersionLocation

	// name of the query param or header whose value should be overridden; provided by the client.
	name string

	// version is the value (provided by the user) that replaces the default version value.
	version string
}

// Do sets the request's API version, if the policy is configured to do so, replacing any prior value.
func (a *apiVersionPolicy) Do(req *policy.Request) (*http.Response, error) {
	// for API versions in the path, the client is responsible for
	// setting the correct path segment with the version. so, if the
	// location is path the policy is effectively a no-op.
	if a.location != APIVersionLocationPath && a.version != "" {
		if a.name == "" {
			// user set ClientOptions.APIVersion but the client ctor didn't set PipelineOptions.APIVersionOptions
			return nil, errors.New("this client doesn't support overriding its API version")
		}
		switch a.location {
		case APIVersionLocationHeader:
			req.Raw().Header.Set(a.name, a.version)
		case APIVersionLocationQueryParam:
			q := req.Raw().URL.Query()
			q.Set(a.name, a.version)
			req.Raw().URL.RawQuery = q.Encode()
		default:
			return nil, fmt.Errorf("unknown APIVersionLocation %d", a.location)
		}
	}
	return req.Next()
}
