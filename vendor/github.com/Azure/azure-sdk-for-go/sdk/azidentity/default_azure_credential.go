//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
)

const azureTokenCredentials = "AZURE_TOKEN_CREDENTIALS"

// bit flags NewDefaultAzureCredential uses to parse AZURE_TOKEN_CREDENTIALS
const (
	env = uint8(1) << iota
	workloadIdentity
	managedIdentity
	az
	azd
)

// DefaultAzureCredentialOptions contains optional parameters for DefaultAzureCredential.
// These options may not apply to all credentials in the chain.
type DefaultAzureCredentialOptions struct {
	// ClientOptions has additional options for credentials that use an Azure SDK HTTP pipeline. These options don't apply
	// to credential types that authenticate via external tools such as the Azure CLI.
	azcore.ClientOptions

	// AdditionallyAllowedTenants specifies tenants to which the credential may authenticate, in addition to
	// TenantID. When TenantID is empty, this option has no effect and the credential will authenticate to
	// any requested tenant. Add the wildcard value "*" to allow the credential to authenticate to any tenant.
	// This value can also be set as a semicolon delimited list of tenants in the environment variable
	// AZURE_ADDITIONALLY_ALLOWED_TENANTS.
	AdditionallyAllowedTenants []string

	// DisableInstanceDiscovery should be set true only by applications authenticating in disconnected clouds, or
	// private clouds such as Azure Stack. It determines whether the credential requests Microsoft Entra instance metadata
	// from https://login.microsoft.com before authenticating. Setting this to true will skip this request, making
	// the application responsible for ensuring the configured authority is valid and trustworthy.
	DisableInstanceDiscovery bool

	// RequireAzureTokenCredentials determines whether NewDefaultAzureCredential returns an error when the environment
	// variable AZURE_TOKEN_CREDENTIALS has no value.
	RequireAzureTokenCredentials bool

	// TenantID sets the default tenant for authentication via the Azure CLI, Azure Developer CLI, and workload identity.
	TenantID string
}

// DefaultAzureCredential simplifies authentication while developing applications that deploy to Azure by
// combining credentials used in Azure hosting environments and credentials used in local development. In
// production, it's better to use a specific credential type so authentication is more predictable and easier
// to debug. For more information, see [DefaultAzureCredential overview].
//
// DefaultAzureCredential attempts to authenticate with each of these credential types, in the following order,
// stopping when one provides a token:
//
//   - [EnvironmentCredential]
//   - [WorkloadIdentityCredential], if environment variable configuration is set by the Azure workload
//     identity webhook. Use [WorkloadIdentityCredential] directly when not using the webhook or needing
//     more control over its configuration.
//   - [ManagedIdentityCredential]
//   - [AzureCLICredential]
//   - [AzureDeveloperCLICredential]
//
// Consult the documentation for these credential types for more information on how they authenticate.
// Once a credential has successfully authenticated, DefaultAzureCredential will use that credential for
// every subsequent authentication.
//
// # Selecting credentials
//
// Set environment variable AZURE_TOKEN_CREDENTIALS to select a subset of the credential chain described above.
// DefaultAzureCredential will try only the specified credential(s), but its other behavior remains the same.
// Valid values for AZURE_TOKEN_CREDENTIALS are the name of any single type in the above chain, for example
// "EnvironmentCredential" or "AzureCLICredential", and these special values:
//
//   - "dev": try [AzureCLICredential] and [AzureDeveloperCLICredential], in that order
//   - "prod": try [EnvironmentCredential], [WorkloadIdentityCredential], and [ManagedIdentityCredential], in that order
//
// [DefaultAzureCredentialOptions].RequireAzureTokenCredentials controls whether AZURE_TOKEN_CREDENTIALS must be set.
// NewDefaultAzureCredential returns an error when RequireAzureTokenCredentials is true and AZURE_TOKEN_CREDENTIALS
// has no value.
//
// [DefaultAzureCredential overview]: https://aka.ms/azsdk/go/identity/credential-chains#defaultazurecredential-overview
type DefaultAzureCredential struct {
	chain *ChainedTokenCredential
}

// NewDefaultAzureCredential creates a DefaultAzureCredential. Pass nil for options to accept defaults.
func NewDefaultAzureCredential(options *DefaultAzureCredentialOptions) (*DefaultAzureCredential, error) {
	if options == nil {
		options = &DefaultAzureCredentialOptions{}
	}

	var (
		creds         []azcore.TokenCredential
		errorMessages []string
		selected      = env | workloadIdentity | managedIdentity | az | azd
	)

	if atc, ok := os.LookupEnv(azureTokenCredentials); ok {
		switch {
		case atc == "dev":
			selected = az | azd
		case atc == "prod":
			selected = env | workloadIdentity | managedIdentity
		case strings.EqualFold(atc, credNameEnvironment):
			selected = env
		case strings.EqualFold(atc, credNameWorkloadIdentity):
			selected = workloadIdentity
		case strings.EqualFold(atc, credNameManagedIdentity):
			selected = managedIdentity
		case strings.EqualFold(atc, credNameAzureCLI):
			selected = az
		case strings.EqualFold(atc, credNameAzureDeveloperCLI):
			selected = azd
		default:
			return nil, fmt.Errorf(`invalid %s value %q. Valid values are "dev", "prod", or the name of any credential type in the default chain. See https://aka.ms/azsdk/go/identity/docs#DefaultAzureCredential for more information`, azureTokenCredentials, atc)
		}
	} else if options.RequireAzureTokenCredentials {
		return nil, fmt.Errorf("%s must be set when RequireAzureTokenCredentials is true. See https://aka.ms/azsdk/go/identity/docs#DefaultAzureCredential for more information", azureTokenCredentials)
	}

	additionalTenants := options.AdditionallyAllowedTenants
	if len(additionalTenants) == 0 {
		if tenants := os.Getenv(azureAdditionallyAllowedTenants); tenants != "" {
			additionalTenants = strings.Split(tenants, ";")
		}
	}
	if selected&env != 0 {
		envCred, err := NewEnvironmentCredential(&EnvironmentCredentialOptions{
			ClientOptions:              options.ClientOptions,
			DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
			additionallyAllowedTenants: additionalTenants,
		})
		if err == nil {
			creds = append(creds, envCred)
		} else {
			errorMessages = append(errorMessages, "EnvironmentCredential: "+err.Error())
			creds = append(creds, &defaultCredentialErrorReporter{credType: credNameEnvironment, err: err})
		}
	}
	if selected&workloadIdentity != 0 {
		wic, err := NewWorkloadIdentityCredential(&WorkloadIdentityCredentialOptions{
			AdditionallyAllowedTenants: additionalTenants,
			ClientOptions:              options.ClientOptions,
			DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
			TenantID:                   options.TenantID,
		})
		if err == nil {
			creds = append(creds, wic)
		} else {
			errorMessages = append(errorMessages, credNameWorkloadIdentity+": "+err.Error())
			creds = append(creds, &defaultCredentialErrorReporter{credType: credNameWorkloadIdentity, err: err})
		}
	}
	if selected&managedIdentity != 0 {
		o := &ManagedIdentityCredentialOptions{ClientOptions: options.ClientOptions, dac: true}
		if ID, ok := os.LookupEnv(azureClientID); ok {
			o.ID = ClientID(ID)
		}
		miCred, err := NewManagedIdentityCredential(o)
		if err == nil {
			creds = append(creds, miCred)
		} else {
			errorMessages = append(errorMessages, credNameManagedIdentity+": "+err.Error())
			creds = append(creds, &defaultCredentialErrorReporter{credType: credNameManagedIdentity, err: err})
		}
	}
	if selected&az != 0 {
		azCred, err := NewAzureCLICredential(&AzureCLICredentialOptions{
			AdditionallyAllowedTenants: additionalTenants,
			TenantID:                   options.TenantID,
			inDefaultChain:             true,
		})
		if err == nil {
			creds = append(creds, azCred)
		} else {
			errorMessages = append(errorMessages, credNameAzureCLI+": "+err.Error())
			creds = append(creds, &defaultCredentialErrorReporter{credType: credNameAzureCLI, err: err})
		}
	}
	if selected&azd != 0 {
		azdCred, err := NewAzureDeveloperCLICredential(&AzureDeveloperCLICredentialOptions{
			AdditionallyAllowedTenants: additionalTenants,
			TenantID:                   options.TenantID,
			inDefaultChain:             true,
		})
		if err == nil {
			creds = append(creds, azdCred)
		} else {
			errorMessages = append(errorMessages, credNameAzureDeveloperCLI+": "+err.Error())
			creds = append(creds, &defaultCredentialErrorReporter{credType: credNameAzureDeveloperCLI, err: err})
		}
	}

	if len(errorMessages) > 0 {
		log.Writef(EventAuthentication, "NewDefaultAzureCredential failed to initialize some credentials:\n\t%s", strings.Join(errorMessages, "\n\t"))
	}

	chain, err := NewChainedTokenCredential(creds, nil)
	if err != nil {
		return nil, err
	}
	chain.name = "DefaultAzureCredential"
	return &DefaultAzureCredential{chain: chain}, nil
}

// GetToken requests an access token from Microsoft Entra ID. This method is called automatically by Azure SDK clients.
func (c *DefaultAzureCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	return c.chain.GetToken(ctx, opts)
}

var _ azcore.TokenCredential = (*DefaultAzureCredential)(nil)

// defaultCredentialErrorReporter is a substitute for credentials that couldn't be constructed.
// Its GetToken method always returns a credentialUnavailableError having the same message as
// the error that prevented constructing the credential. This ensures the message is present
// in the error returned by ChainedTokenCredential.GetToken()
type defaultCredentialErrorReporter struct {
	credType string
	err      error
}

func (d *defaultCredentialErrorReporter) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	if _, ok := d.err.(credentialUnavailable); ok {
		return azcore.AccessToken{}, d.err
	}
	return azcore.AccessToken{}, newCredentialUnavailableError(d.credType, d.err.Error())
}

var _ azcore.TokenCredential = (*defaultCredentialErrorReporter)(nil)
