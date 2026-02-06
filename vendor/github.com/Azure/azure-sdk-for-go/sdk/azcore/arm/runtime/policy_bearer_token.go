// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	armpolicy "github.com/Azure/azure-sdk-for-go/sdk/azcore/arm/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	azpolicy "github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	azruntime "github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/temporal"
)

const headerAuxiliaryAuthorization = "x-ms-authorization-auxiliary"

// acquiringResourceState holds data for an auxiliary token request
type acquiringResourceState struct {
	ctx    context.Context
	p      *BearerTokenPolicy
	tenant string
}

// acquireAuxToken acquires a token from an auxiliary tenant. Only one thread/goroutine at a time ever calls this function.
func acquireAuxToken(state acquiringResourceState) (newResource azcore.AccessToken, newExpiration time.Time, err error) {
	tk, err := state.p.cred.GetToken(state.ctx, azpolicy.TokenRequestOptions{
		EnableCAE: true,
		Scopes:    state.p.scopes,
		TenantID:  state.tenant,
	})
	if err != nil {
		return azcore.AccessToken{}, time.Time{}, err
	}
	return tk, tk.ExpiresOn, nil
}

// BearerTokenPolicy authorizes requests with bearer tokens acquired from a TokenCredential.
type BearerTokenPolicy struct {
	auxResources map[string]*temporal.Resource[azcore.AccessToken, acquiringResourceState]
	btp          *azruntime.BearerTokenPolicy
	cred         azcore.TokenCredential
	scopes       []string
}

// NewBearerTokenPolicy creates a policy object that authorizes requests with bearer tokens.
// cred: an azcore.TokenCredential implementation such as a credential object from azidentity
// opts: optional settings. Pass nil to accept default values; this is the same as passing a zero-value options.
func NewBearerTokenPolicy(cred azcore.TokenCredential, opts *armpolicy.BearerTokenOptions) *BearerTokenPolicy {
	if opts == nil {
		opts = &armpolicy.BearerTokenOptions{}
	}
	p := &BearerTokenPolicy{cred: cred}
	p.auxResources = make(map[string]*temporal.Resource[azcore.AccessToken, acquiringResourceState], len(opts.AuxiliaryTenants))
	for _, t := range opts.AuxiliaryTenants {
		p.auxResources[t] = temporal.NewResource(acquireAuxToken)
	}
	p.scopes = make([]string, len(opts.Scopes))
	copy(p.scopes, opts.Scopes)
	p.btp = azruntime.NewBearerTokenPolicy(cred, opts.Scopes, &azpolicy.BearerTokenOptions{
		InsecureAllowCredentialWithHTTP: opts.InsecureAllowCredentialWithHTTP,
		AuthorizationHandler: azpolicy.AuthorizationHandler{
			OnRequest: p.onRequest,
		},
	})
	return p
}

// onRequest authorizes requests with one or more bearer tokens
func (b *BearerTokenPolicy) onRequest(req *azpolicy.Request, authNZ func(azpolicy.TokenRequestOptions) error) error {
	// authorize the request with a token for the primary tenant
	err := authNZ(azpolicy.TokenRequestOptions{Scopes: b.scopes})
	if err != nil || len(b.auxResources) == 0 {
		return err
	}
	// add tokens for auxiliary tenants
	as := acquiringResourceState{
		ctx: req.Raw().Context(),
		p:   b,
	}
	auxTokens := make([]string, 0, len(b.auxResources))
	for tenant, er := range b.auxResources {
		as.tenant = tenant
		auxTk, err := er.Get(as)
		if err != nil {
			return err
		}
		auxTokens = append(auxTokens, fmt.Sprintf("%s%s", shared.BearerTokenPrefix, auxTk.Token))
	}
	req.Raw().Header.Set(headerAuxiliaryAuthorization, strings.Join(auxTokens, ", "))
	return nil
}

// Do authorizes a request with a bearer token
func (b *BearerTokenPolicy) Do(req *azpolicy.Request) (*http.Response, error) {
	return b.btp.Do(req)
}
