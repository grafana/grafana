// Copyright 2018 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package gcp provides fundamental Wire providers and types for Google Cloud Platform (GCP).
package gcp // import "gocloud.dev/gcp"

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/wire"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// DefaultIdentity is a Wire provider set that provides the project ID
// and token source from Application Default Credentials (ADC).
var DefaultIdentity = wire.NewSet(
	CredentialsTokenSource,
	DefaultCredentials,
	DefaultProjectID)

// ProjectID is a GCP Project ID.
type ProjectID string

// TokenSource wraps a GCP token source that provides Cloud-Platform-
// scoped tokens.
type TokenSource oauth2.TokenSource

// HTTPClient is an HTTP client that makes requests authenticated with Cloud-
// Platform-scoped authentication tokens.
type HTTPClient struct {
	http.Client
}

// NewAnonymousHTTPClient creates a new anonymous HTTP client.
func NewAnonymousHTTPClient(transport http.RoundTripper) *HTTPClient {
	return &HTTPClient{
		Client: http.Client{
			Transport: transport,
		},
	}
}

// NewHTTPClient creates a new authenticated HTTP client.
func NewHTTPClient(transport http.RoundTripper, ts TokenSource) (*HTTPClient, error) {
	if ts == nil {
		return nil, errors.New("gcp: no credentials available")
	}
	return &HTTPClient{
		Client: http.Client{
			Transport: &oauth2.Transport{
				Base:   transport,
				Source: ts,
			},
		},
	}, nil
}

// DefaultTransport returns http.DefaultTransport.
func DefaultTransport() http.RoundTripper {
	return http.DefaultTransport
}

// DefaultCredentials obtains the default GCP credentials with Cloud Platform
// scope.
func DefaultCredentials(ctx context.Context) (*google.Credentials, error) {
	adc, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return nil, err
	}
	return adc, nil
}

// CredentialsTokenSource extracts the token source from GCP credentials.
func CredentialsTokenSource(creds *google.Credentials) TokenSource {
	if creds == nil {
		return nil
	}
	return TokenSource(creds.TokenSource)
}

// DefaultProjectID obtains the project ID from the default GCP credentials.
func DefaultProjectID(creds *google.Credentials) (ProjectID, error) {
	if creds == nil {
		return "", errors.New("gcp: no project found in credentials")
	}
	return ProjectID(creds.ProjectID), nil
}
