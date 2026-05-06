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
// [DefaultAzureCredential overview]: https://aka.ms/azsdk/go/identity/credential-chains#defaultazurecredential-overview
type DefaultAzureCredential struct {
	chain *ChainedTokenCredential
}

// NewDefaultAzureCredential creates a DefaultAzureCredential. Pass nil for options to accept defaults.
func NewDefaultAzureCredential(options *DefaultAzureCredentialOptions) (*DefaultAzureCredential, error) {
	var (
		creds                   []azcore.TokenCredential
		errorMessages           []string
		includeDev, includeProd = true, true
	)

	if c, ok := os.LookupEnv(azureTokenCredentials); ok {
		switch c {
		case "dev":
			includeProd = false
		case "prod":
			includeDev = false
		default:
			return nil, fmt.Errorf(`invalid %s value %q. Valid values are "dev" and "prod"`, azureTokenCredentials, c)
		}
	}

	if options == nil {
		options = &DefaultAzureCredentialOptions{}
	}
	additionalTenants := options.AdditionallyAllowedTenants
	if len(additionalTenants) == 0 {
		if tenants := os.Getenv(azureAdditionallyAllowedTenants); tenants != "" {
			additionalTenants = strings.Split(tenants, ";")
		}
	}

	if includeProd {
		envCred, err := NewEnvironmentCredential(&EnvironmentCredentialOptions{
			ClientOptions:              options.ClientOptions,
			DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
			additionallyAllowedTenants: additionalTenants,
		})
		if err == nil {
			creds = append(creds, envCred)
		} else {
			errorMessages = append(errorMessages, "EnvironmentCredential: "+err.Error())
			creds = append(creds, &defaultCredentialErrorReporter{credType: "EnvironmentCredential", err: err})
		}

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
	if includeDev {
		azCred, err := NewAzureCLICredential(&AzureCLICredentialOptions{AdditionallyAllowedTenants: additionalTenants, TenantID: options.TenantID})
		if err == nil {
			creds = append(creds, azCred)
		} else {
			errorMessages = append(errorMessages, credNameAzureCLI+": "+err.Error())
			creds = append(creds, &defaultCredentialErrorReporter{credType: credNameAzureCLI, err: err})
		}

		azdCred, err := NewAzureDeveloperCLICredential(&AzureDeveloperCLICredentialOptions{
			AdditionallyAllowedTenants: additionalTenants,
			TenantID:                   options.TenantID,
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
