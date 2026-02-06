//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"errors"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/confidential"
)

const credNameAssertion = "ClientAssertionCredential"

// ClientAssertionCredential authenticates an application with assertions provided by a callback function.
// This credential is for advanced scenarios. [ClientCertificateCredential] has a more convenient API for
// the most common assertion scenario, authenticating a service principal with a certificate. See
// [Microsoft Entra ID documentation] for details of the assertion format.
//
// [Microsoft Entra ID documentation]: https://learn.microsoft.com/entra/identity-platform/certificate-credentials#assertion-format
type ClientAssertionCredential struct {
	client *confidentialClient
}

// ClientAssertionCredentialOptions contains optional parameters for ClientAssertionCredential.
type ClientAssertionCredentialOptions struct {
	azcore.ClientOptions

	// AdditionallyAllowedTenants specifies additional tenants for which the credential may acquire tokens.
	// Add the wildcard value "*" to allow the credential to acquire tokens for any tenant in which the
	// application is registered.
	AdditionallyAllowedTenants []string

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

// NewClientAssertionCredential constructs a ClientAssertionCredential. The getAssertion function must be thread safe. Pass nil for options to accept defaults.
func NewClientAssertionCredential(tenantID, clientID string, getAssertion func(context.Context) (string, error), options *ClientAssertionCredentialOptions) (*ClientAssertionCredential, error) {
	if getAssertion == nil {
		return nil, errors.New("getAssertion must be a function that returns assertions")
	}
	if options == nil {
		options = &ClientAssertionCredentialOptions{}
	}
	cred := confidential.NewCredFromAssertionCallback(
		func(ctx context.Context, _ confidential.AssertionRequestOptions) (string, error) {
			return getAssertion(ctx)
		},
	)
	msalOpts := confidentialClientOptions{
		AdditionallyAllowedTenants: options.AdditionallyAllowedTenants,
		Cache:                      options.Cache,
		ClientOptions:              options.ClientOptions,
		DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
	}
	c, err := newConfidentialClient(tenantID, clientID, credNameAssertion, cred, msalOpts)
	if err != nil {
		return nil, err
	}
	return &ClientAssertionCredential{client: c}, nil
}

// GetToken requests an access token from Microsoft Entra ID. This method is called automatically by Azure SDK clients.
func (c *ClientAssertionCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameAssertion+"."+traceOpGetToken, c.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := c.client.GetToken(ctx, opts)
	return tk, err
}

var _ azcore.TokenCredential = (*ClientAssertionCredential)(nil)
