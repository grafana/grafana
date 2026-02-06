//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package shared

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
)

type storageAuthorizer struct {
	scopes   []string
	tenantID string
}

func NewStorageChallengePolicy(cred azcore.TokenCredential, audience string, allowHTTP bool) policy.Policy {
	s := storageAuthorizer{scopes: []string{audience}}
	return runtime.NewBearerTokenPolicy(cred, []string{audience}, &policy.BearerTokenOptions{
		AuthorizationHandler: policy.AuthorizationHandler{
			OnRequest:   s.onRequest,
			OnChallenge: s.onChallenge,
		},
		InsecureAllowCredentialWithHTTP: allowHTTP,
	})
}

func (s *storageAuthorizer) onRequest(req *policy.Request, authNZ func(policy.TokenRequestOptions) error) error {
	return authNZ(policy.TokenRequestOptions{Scopes: s.scopes})
}

func (s *storageAuthorizer) onChallenge(req *policy.Request, resp *http.Response, authNZ func(policy.TokenRequestOptions) error) error {
	// parse the challenge
	err := s.parseChallenge(resp)
	if err != nil {
		return err
	}
	// TODO: Set tenantID when policy.TokenRequestOptions supports it. https://github.com/Azure/azure-sdk-for-go/issues/19841
	return authNZ(policy.TokenRequestOptions{Scopes: s.scopes})
}

type challengePolicyError struct {
	err error
}

func (c *challengePolicyError) Error() string {
	return c.err.Error()
}

func (*challengePolicyError) NonRetriable() {
	// marker method
}

func (c *challengePolicyError) Unwrap() error {
	return c.err
}

// parses Tenant ID from auth challenge
// https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/oauth2/authorize
func parseTenant(url string) string {
	if url == "" {
		return ""
	}
	parts := strings.Split(url, "/")
	if len(parts) >= 3 {
		tenant := parts[3]
		tenant = strings.ReplaceAll(tenant, ",", "")
		return tenant
	} else {
		return ""
	}
}

func (s *storageAuthorizer) parseChallenge(resp *http.Response) error {
	authHeader := resp.Header.Get("WWW-Authenticate")
	if authHeader == "" {
		return &challengePolicyError{err: errors.New("response has no WWW-Authenticate header for challenge authentication")}
	}

	// Strip down to auth and resource
	// Format is "Bearer authorization_uri=\"<site>\" resource_id=\"<site>\""
	authHeader = strings.ReplaceAll(authHeader, "Bearer ", "")

	parts := strings.Split(authHeader, " ")

	vals := map[string]string{}
	for _, part := range parts {
		subParts := strings.Split(part, "=")
		if len(subParts) == 2 {
			stripped := strings.ReplaceAll(subParts[1], "\"", "")
			stripped = strings.TrimSuffix(stripped, ",")
			vals[subParts[0]] = stripped
		}
	}

	s.tenantID = parseTenant(vals["authorization_uri"])

	scope := vals["resource_id"]
	if scope == "" {
		return &challengePolicyError{err: errors.New("could not find a valid resource in the WWW-Authenticate header")}
	}

	if !strings.HasSuffix(scope, "/.default") {
		scope += "/.default"
	}
	s.scopes = []string{scope}
	return nil
}
