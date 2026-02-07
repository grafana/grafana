//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
)

const credNameBrowser = "InteractiveBrowserCredential"

// InteractiveBrowserCredentialOptions contains optional parameters for InteractiveBrowserCredential.
type InteractiveBrowserCredentialOptions struct {
	azcore.ClientOptions

	// AdditionallyAllowedTenants specifies tenants to which the credential may authenticate, in addition to
	// TenantID. When TenantID is empty, this option has no effect and the credential will authenticate to
	// any requested tenant. Add the wildcard value "*" to allow the credential to authenticate to any tenant.
	AdditionallyAllowedTenants []string

	// AuthenticationRecord returned by a call to a credential's Authenticate method. Set this option
	// to enable the credential to use data from a previous authentication.
	AuthenticationRecord AuthenticationRecord

	// Cache is a persistent cache the credential will use to store the tokens it acquires, making
	// them available to other processes and credential instances. The default, zero value means the
	// credential will store tokens in memory and not share them with any other credential instance.
	Cache Cache

	// ClientID is the ID of the application to which users will authenticate. When not set, users
	// will authenticate to an Azure development application, which isn't recommended for production
	// scenarios. In production, developers should instead register their applications and assign
	// appropriate roles. See https://aka.ms/azsdk/identity/AppRegistrationAndRoleAssignment for more
	// information.
	ClientID string

	// DisableAutomaticAuthentication prevents the credential from automatically prompting the user to authenticate.
	// When this option is true, GetToken will return AuthenticationRequiredError when user interaction is necessary
	// to acquire a token.
	DisableAutomaticAuthentication bool

	// DisableInstanceDiscovery should be set true only by applications authenticating in disconnected clouds, or
	// private clouds such as Azure Stack. It determines whether the credential requests Microsoft Entra instance metadata
	// from https://login.microsoft.com before authenticating. Setting this to true will skip this request, making
	// the application responsible for ensuring the configured authority is valid and trustworthy.
	DisableInstanceDiscovery bool

	// LoginHint pre-populates the account prompt with a username. Users may choose to authenticate a different account.
	LoginHint string

	// RedirectURL is the URL Microsoft Entra ID will redirect to with the access token. This is required
	// only when setting ClientID, and must match a redirect URI in the application's registration.
	// Applications which have registered "http://localhost" as a redirect URI need not set this option.
	RedirectURL string

	// TenantID is the Microsoft Entra tenant the credential authenticates in. Defaults to the
	// "organizations" tenant, which can authenticate work and school accounts.
	TenantID string
}

func (o *InteractiveBrowserCredentialOptions) init() {
	if o.TenantID == "" {
		o.TenantID = organizationsTenantID
	}
	if o.ClientID == "" {
		o.ClientID = developerSignOnClientID
	}
}

// InteractiveBrowserCredential opens a browser to interactively authenticate a user.
type InteractiveBrowserCredential struct {
	client *publicClient
}

// NewInteractiveBrowserCredential constructs a new InteractiveBrowserCredential. Pass nil to accept default options.
func NewInteractiveBrowserCredential(options *InteractiveBrowserCredentialOptions) (*InteractiveBrowserCredential, error) {
	cp := InteractiveBrowserCredentialOptions{}
	if options != nil {
		cp = *options
	}
	cp.init()
	msalOpts := publicClientOptions{
		AdditionallyAllowedTenants:     cp.AdditionallyAllowedTenants,
		Cache:                          cp.Cache,
		ClientOptions:                  cp.ClientOptions,
		DisableAutomaticAuthentication: cp.DisableAutomaticAuthentication,
		DisableInstanceDiscovery:       cp.DisableInstanceDiscovery,
		LoginHint:                      cp.LoginHint,
		Record:                         cp.AuthenticationRecord,
		RedirectURL:                    cp.RedirectURL,
	}
	c, err := newPublicClient(cp.TenantID, cp.ClientID, credNameBrowser, msalOpts)
	if err != nil {
		return nil, err
	}
	return &InteractiveBrowserCredential{client: c}, nil
}

// Authenticate opens the default browser so a user can log in. Subsequent
// GetToken calls will automatically use the returned AuthenticationRecord.
func (c *InteractiveBrowserCredential) Authenticate(ctx context.Context, opts *policy.TokenRequestOptions) (AuthenticationRecord, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameBrowser+"."+traceOpAuthenticate, c.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := c.client.Authenticate(ctx, opts)
	return tk, err
}

// GetToken requests an access token from Microsoft Entra ID. This method is called automatically by Azure SDK clients.
func (c *InteractiveBrowserCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameBrowser+"."+traceOpGetToken, c.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := c.client.GetToken(ctx, opts)
	return tk, err
}

var _ azcore.TokenCredential = (*InteractiveBrowserCredential)(nil)
