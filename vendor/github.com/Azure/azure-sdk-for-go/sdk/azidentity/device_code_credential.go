//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
)

const credNameDeviceCode = "DeviceCodeCredential"

// DeviceCodeCredentialOptions contains optional parameters for DeviceCodeCredential.
type DeviceCodeCredentialOptions struct {
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

	// TenantID is the Microsoft Entra tenant the credential authenticates in. Defaults to the
	// "organizations" tenant, which can authenticate work and school accounts. Required for single-tenant
	// applications.
	TenantID string

	// UserPrompt controls how the credential presents authentication instructions. The credential calls
	// this function with authentication details when it receives a device code. By default, the credential
	// prints these details to stdout.
	UserPrompt func(context.Context, DeviceCodeMessage) error
}

func (o *DeviceCodeCredentialOptions) init() {
	if o.TenantID == "" {
		o.TenantID = organizationsTenantID
	}
	if o.ClientID == "" {
		o.ClientID = developerSignOnClientID
	}
	if o.UserPrompt == nil {
		o.UserPrompt = func(ctx context.Context, dc DeviceCodeMessage) error {
			fmt.Println(dc.Message)
			return nil
		}
	}
}

// DeviceCodeMessage contains the information a user needs to complete authentication.
type DeviceCodeMessage struct {
	// UserCode is the user code returned by the service.
	UserCode string `json:"user_code"`
	// VerificationURL is the URL at which the user must authenticate.
	VerificationURL string `json:"verification_uri"`
	// Message is user instruction from Microsoft Entra ID.
	Message string `json:"message"`
}

// DeviceCodeCredential acquires tokens for a user via the device code flow, which has the
// user browse to a Microsoft Entra URL, enter a code, and authenticate. It's useful
// for authenticating a user in an environment without a web browser, such as an SSH session.
// If a web browser is available, [InteractiveBrowserCredential] is more convenient because it
// automatically opens a browser to the login page.
type DeviceCodeCredential struct {
	client *publicClient
}

// NewDeviceCodeCredential creates a DeviceCodeCredential. Pass nil to accept default options.
func NewDeviceCodeCredential(options *DeviceCodeCredentialOptions) (*DeviceCodeCredential, error) {
	cp := DeviceCodeCredentialOptions{}
	if options != nil {
		cp = *options
	}
	cp.init()
	msalOpts := publicClientOptions{
		AdditionallyAllowedTenants:     cp.AdditionallyAllowedTenants,
		Cache:                          cp.Cache,
		ClientOptions:                  cp.ClientOptions,
		DeviceCodePrompt:               cp.UserPrompt,
		DisableAutomaticAuthentication: cp.DisableAutomaticAuthentication,
		DisableInstanceDiscovery:       cp.DisableInstanceDiscovery,
		Record:                         cp.AuthenticationRecord,
	}
	c, err := newPublicClient(cp.TenantID, cp.ClientID, credNameDeviceCode, msalOpts)
	if err != nil {
		return nil, err
	}
	c.name = credNameDeviceCode
	return &DeviceCodeCredential{client: c}, nil
}

// Authenticate prompts a user to log in via the device code flow. Subsequent
// GetToken calls will automatically use the returned AuthenticationRecord.
func (c *DeviceCodeCredential) Authenticate(ctx context.Context, opts *policy.TokenRequestOptions) (AuthenticationRecord, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameDeviceCode+"."+traceOpAuthenticate, c.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := c.client.Authenticate(ctx, opts)
	return tk, err
}

// GetToken requests an access token from Microsoft Entra ID. It will begin the device code flow and poll until the user completes authentication.
// This method is called automatically by Azure SDK clients.
func (c *DeviceCodeCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameDeviceCode+"."+traceOpGetToken, c.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := c.client.GetToken(ctx, opts)
	return tk, err
}

var _ azcore.TokenCredential = (*DeviceCodeCredential)(nil)
