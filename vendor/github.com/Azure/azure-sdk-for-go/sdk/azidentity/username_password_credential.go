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

const credNameUserPassword = "UsernamePasswordCredential"

// UsernamePasswordCredentialOptions contains optional parameters for UsernamePasswordCredential.
//
// Deprecated: UsernamePasswordCredential is deprecated because it can't support multifactor
// authentication. See [Entra ID documentation] for migration guidance.
//
// [Entra ID documentation]: https://aka.ms/azsdk/identity/mfa
type UsernamePasswordCredentialOptions struct {
	azcore.ClientOptions

	// AdditionallyAllowedTenants specifies additional tenants for which the credential may acquire tokens.
	// Add the wildcard value "*" to allow the credential to acquire tokens for any tenant in which the
	// application is registered.
	AdditionallyAllowedTenants []string

	// AuthenticationRecord returned by a call to a credential's Authenticate method. Set this option
	// to enable the credential to use data from a previous authentication.
	AuthenticationRecord AuthenticationRecord

	// Cache is a persistent cache the credential will use to store the tokens it acquires, making
	// them available to other processes and credential instances. The default, zero value means the
	// credential will store tokens in memory and not share them with any other credential instance.
	Cache Cache

	// DisableInstanceDiscovery should be set true only by applications authenticating in disconnected clouds, or
	// private clouds such as Azure Stack. It determines whether the credential requests Microsoft Entra instance metadata
	// from https://login.microsoft.com before authenticating. Setting this to true will skip this request, making
	// the application responsible for ensuring the configured authority is valid and trustworthy.
	DisableInstanceDiscovery bool
}

// UsernamePasswordCredential authenticates a user with a password. Microsoft doesn't recommend this kind of authentication,
// because it's less secure than other authentication flows. This credential is not interactive, so it isn't compatible
// with any form of multifactor authentication, and the application must already have user or admin consent.
// This credential can only authenticate work and school accounts; it can't authenticate Microsoft accounts.
//
// Deprecated: this credential is deprecated because it can't support multifactor authentication. See [Entra ID documentation]
// for migration guidance.
//
// [Entra ID documentation]: https://aka.ms/azsdk/identity/mfa
type UsernamePasswordCredential struct {
	client *publicClient
}

// NewUsernamePasswordCredential creates a UsernamePasswordCredential. clientID is the ID of the application the user
// will authenticate to. Pass nil for options to accept defaults.
func NewUsernamePasswordCredential(tenantID string, clientID string, username string, password string, options *UsernamePasswordCredentialOptions) (*UsernamePasswordCredential, error) {
	if options == nil {
		options = &UsernamePasswordCredentialOptions{}
	}
	opts := publicClientOptions{
		AdditionallyAllowedTenants: options.AdditionallyAllowedTenants,
		Cache:                      options.Cache,
		ClientOptions:              options.ClientOptions,
		DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
		Password:                   password,
		Record:                     options.AuthenticationRecord,
		Username:                   username,
	}
	c, err := newPublicClient(tenantID, clientID, credNameUserPassword, opts)
	if err != nil {
		return nil, err
	}
	return &UsernamePasswordCredential{client: c}, err
}

// Authenticate the user. Subsequent calls to GetToken will automatically use the returned AuthenticationRecord.
func (c *UsernamePasswordCredential) Authenticate(ctx context.Context, opts *policy.TokenRequestOptions) (AuthenticationRecord, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameUserPassword+"."+traceOpAuthenticate, c.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := c.client.Authenticate(ctx, opts)
	return tk, err
}

// GetToken requests an access token from Microsoft Entra ID. This method is called automatically by Azure SDK clients.
func (c *UsernamePasswordCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameUserPassword+"."+traceOpGetToken, c.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := c.client.GetToken(ctx, opts)
	return tk, err
}

var _ azcore.TokenCredential = (*UsernamePasswordCredential)(nil)
