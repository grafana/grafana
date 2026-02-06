//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package internal

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/to"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/errorinfo"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/temporal"
)

const (
	headerAuthorization = "Authorization"
	challengeMatchError = `challenge resource "%s" doesn't match the requested domain. Set DisableChallengeResourceVerification to true in your client options to disable. See https://aka.ms/azsdk/blog/vault-uri for more information`
	bearerHeader        = "Bearer "
)

type KeyVaultChallengePolicyOptions struct {
	// DisableChallengeResourceVerification controls whether the policy requires the
	// authentication challenge resource to match the Key Vault or Managed HSM domain
	DisableChallengeResourceVerification bool
}

type KeyVaultChallengePolicy struct {
	// mainResource is the resource to be retrieved using the tenant specified in the credential
	mainResource            *temporal.Resource[azcore.AccessToken, acquiringResourceState]
	cred                    azcore.TokenCredential
	scope                   *string
	tenantID                *string
	verifyChallengeResource bool
}

func NewKeyVaultChallengePolicy(cred azcore.TokenCredential, opts *KeyVaultChallengePolicyOptions) *KeyVaultChallengePolicy {
	if opts == nil {
		opts = &KeyVaultChallengePolicyOptions{}
	}
	return &KeyVaultChallengePolicy{
		cred:                    cred,
		mainResource:            temporal.NewResource(acquire),
		verifyChallengeResource: !opts.DisableChallengeResourceVerification,
	}
}

func (k *KeyVaultChallengePolicy) Do(req *policy.Request) (*http.Response, error) {
	as := acquiringResourceState{
		p:   k,
		req: req,
	}

	if k.scope == nil || k.tenantID == nil {
		// First request, get both to get the token
		challengeReq, err := k.getChallengeRequest(*req)
		if err != nil {
			return nil, err
		}

		resp, err := challengeReq.Next()
		if err != nil {
			return nil, err
		}

		if resp.StatusCode > 399 && resp.StatusCode != http.StatusUnauthorized {
			// the request failed for some other reason, don't try any further
			return resp, nil
		}
		err = k.findScopeAndTenant(resp, req.Raw())
		if err != nil {
			return nil, err
		}
	}

	tk, err := k.mainResource.Get(as)
	if err != nil {
		return nil, err
	}

	req.Raw().Header.Set(
		headerAuthorization,
		fmt.Sprintf("%s%s", bearerHeader, tk.Token),
	)

	// send a copy of the request
	cloneReq := req.Clone(req.Raw().Context())
	resp, cloneReqErr := cloneReq.Next()
	if cloneReqErr != nil {
		return nil, cloneReqErr
	}

	// If it fails and has a 401, try it with a new token
	if resp.StatusCode == 401 {
		// Force a new token
		k.mainResource.Expire()

		// Find the scope and tenant again in case they have changed
		err := k.findScopeAndTenant(resp, req.Raw())
		if err != nil {
			// Error parsing challenge, doomed to fail. Return
			return resp, cloneReqErr
		}

		tk, err := k.mainResource.Get(as)
		if err != nil {
			return resp, err
		}

		req.Raw().Header.Set(
			headerAuthorization,
			bearerHeader+tk.Token,
		)

		// send the original request now
		return req.Next()
	}

	return resp, err
}

// parses Tenant ID from auth challenge
// https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000
func parseTenant(url string) *string {
	if url == "" {
		return to.Ptr("")
	}
	parts := strings.Split(url, "/")
	tenant := parts[3]
	tenant = strings.ReplaceAll(tenant, ",", "")
	return &tenant
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

var _ errorinfo.NonRetriable = (*challengePolicyError)(nil)

// sets the k.scope and k.tenantID from the WWW-Authenticate header
func (k *KeyVaultChallengePolicy) findScopeAndTenant(resp *http.Response, req *http.Request) error {
	authHeader := resp.Header.Get("WWW-Authenticate")
	if authHeader == "" {
		return &challengePolicyError{err: errors.New("response has no WWW-Authenticate header for challenge authentication")}
	}

	// Strip down to auth and resource
	// Format is "Bearer authorization=\"<site>\" resource=\"<site>\"" OR
	// "Bearer authorization=\"<site>\" scope=\"<site>\" resource=\"<resource>\""
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

	k.tenantID = parseTenant(vals["authorization"])
	scope := ""
	if v, ok := vals["scope"]; ok {
		scope = v
	} else if v, ok := vals["resource"]; ok {
		scope = v
	}
	if scope == "" {
		return &challengePolicyError{err: errors.New("could not find a valid resource in the WWW-Authenticate header")}
	}
	if k.verifyChallengeResource {
		// the challenge resource's host must match the requested vault's host
		parsed, err := url.Parse(scope)
		if err != nil {
			return &challengePolicyError{err: fmt.Errorf(`invalid challenge resource "%s": %v`, scope, err)}
		}
		if !strings.HasSuffix(req.URL.Host, "."+parsed.Host) {
			return &challengePolicyError{err: fmt.Errorf(challengeMatchError, scope)}
		}
	}
	if !strings.HasSuffix(scope, "/.default") {
		scope += "/.default"
	}
	k.scope = &scope
	return nil
}

func (k KeyVaultChallengePolicy) getChallengeRequest(orig policy.Request) (*policy.Request, error) {
	req, err := runtime.NewRequest(orig.Raw().Context(), orig.Raw().Method, orig.Raw().URL.String())
	if err != nil {
		return nil, &challengePolicyError{err: err}
	}

	req.Raw().Header = orig.Raw().Header
	req.Raw().Header.Set("Content-Length", "0")
	req.Raw().ContentLength = 0

	copied := orig.Clone(orig.Raw().Context())
	copied.Raw().Body = req.Body()
	copied.Raw().ContentLength = 0
	copied.Raw().Header.Set("Content-Length", "0")
	err = copied.SetBody(streaming.NopCloser(bytes.NewReader([]byte{})), "application/json")
	if err != nil {
		return nil, &challengePolicyError{err: err}
	}
	copied.Raw().Header.Del("Content-Type")

	return copied, err
}

type acquiringResourceState struct {
	req *policy.Request
	p   *KeyVaultChallengePolicy
}

// acquire acquires or updates the resource; only one
// thread/goroutine at a time ever calls this function
func acquire(state acquiringResourceState) (newResource azcore.AccessToken, newExpiration time.Time, err error) {
	tk, err := state.p.cred.GetToken(
		state.req.Raw().Context(),
		policy.TokenRequestOptions{
			Scopes: []string{*state.p.scope},
		},
	)
	if err != nil {
		return azcore.AccessToken{}, time.Time{}, err
	}
	return tk, tk.ExpiresOn, nil
}
