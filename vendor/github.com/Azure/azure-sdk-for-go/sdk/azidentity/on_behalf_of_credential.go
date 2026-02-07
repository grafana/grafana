//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"crypto"
	"crypto/x509"
	"errors"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/confidential"
)

const credNameOBO = "OnBehalfOfCredential"

// OnBehalfOfCredential authenticates a service principal via the on-behalf-of flow. This is typically used by
// middle-tier services that authorize requests to other services with a delegated user identity. Because this
// is not an interactive authentication flow, an application using it must have admin consent for any delegated
// permissions before requesting tokens for them. See [Microsoft Entra ID documentation] for more details.
//
// [Microsoft Entra ID documentation]: https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow
type OnBehalfOfCredential struct {
	client *confidentialClient
}

// OnBehalfOfCredentialOptions contains optional parameters for OnBehalfOfCredential
type OnBehalfOfCredentialOptions struct {
	azcore.ClientOptions

	// AdditionallyAllowedTenants specifies additional tenants for which the credential may acquire tokens.
	// Add the wildcard value "*" to allow the credential to acquire tokens for any tenant in which the
	// application is registered.
	AdditionallyAllowedTenants []string

	// DisableInstanceDiscovery should be set true only by applications authenticating in disconnected clouds, or
	// private clouds such as Azure Stack. It determines whether the credential requests Microsoft Entra instance metadata
	// from https://login.microsoft.com before authenticating. Setting this to true will skip this request, making
	// the application responsible for ensuring the configured authority is valid and trustworthy.
	DisableInstanceDiscovery bool

	// SendCertificateChain applies only when the credential is configured to authenticate with a certificate.
	// This setting controls whether the credential sends the public certificate chain in the x5c header of each
	// token request's JWT. This is required for, and only used in, Subject Name/Issuer (SNI) authentication.
	SendCertificateChain bool
}

// NewOnBehalfOfCredentialWithCertificate constructs an OnBehalfOfCredential that authenticates with a certificate.
// See [ParseCertificates] for help loading a certificate.
func NewOnBehalfOfCredentialWithCertificate(tenantID, clientID, userAssertion string, certs []*x509.Certificate, key crypto.PrivateKey, options *OnBehalfOfCredentialOptions) (*OnBehalfOfCredential, error) {
	cred, err := confidential.NewCredFromCert(certs, key)
	if err != nil {
		return nil, err
	}
	return newOnBehalfOfCredential(tenantID, clientID, userAssertion, cred, options)
}

// NewOnBehalfOfCredentialWithClientAssertions constructs an OnBehalfOfCredential that authenticates with client assertions.
// userAssertion is the user's access token for the application. The getAssertion function should return client assertions
// that authenticate the application to Microsoft Entra ID, such as federated credentials.
func NewOnBehalfOfCredentialWithClientAssertions(tenantID, clientID, userAssertion string, getAssertion func(context.Context) (string, error), options *OnBehalfOfCredentialOptions) (*OnBehalfOfCredential, error) {
	if getAssertion == nil {
		return nil, errors.New("getAssertion can't be nil. It must be a function that returns client assertions")
	}
	cred := confidential.NewCredFromAssertionCallback(func(ctx context.Context, _ confidential.AssertionRequestOptions) (string, error) {
		return getAssertion(ctx)
	})
	return newOnBehalfOfCredential(tenantID, clientID, userAssertion, cred, options)
}

// NewOnBehalfOfCredentialWithSecret constructs an OnBehalfOfCredential that authenticates with a client secret.
func NewOnBehalfOfCredentialWithSecret(tenantID, clientID, userAssertion, clientSecret string, options *OnBehalfOfCredentialOptions) (*OnBehalfOfCredential, error) {
	cred, err := confidential.NewCredFromSecret(clientSecret)
	if err != nil {
		return nil, err
	}
	return newOnBehalfOfCredential(tenantID, clientID, userAssertion, cred, options)
}

func newOnBehalfOfCredential(tenantID, clientID, userAssertion string, cred confidential.Credential, options *OnBehalfOfCredentialOptions) (*OnBehalfOfCredential, error) {
	if options == nil {
		options = &OnBehalfOfCredentialOptions{}
	}
	opts := confidentialClientOptions{
		AdditionallyAllowedTenants: options.AdditionallyAllowedTenants,
		Assertion:                  userAssertion,
		ClientOptions:              options.ClientOptions,
		DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
		SendX5C:                    options.SendCertificateChain,
	}
	c, err := newConfidentialClient(tenantID, clientID, credNameOBO, cred, opts)
	if err != nil {
		return nil, err
	}
	return &OnBehalfOfCredential{c}, nil
}

// GetToken requests an access token from Microsoft Entra ID. This method is called automatically by Azure SDK clients.
func (o *OnBehalfOfCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameOBO+"."+traceOpGetToken, o.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := o.client.GetToken(ctx, opts)
	return tk, err
}

var _ azcore.TokenCredential = (*OnBehalfOfCredential)(nil)
