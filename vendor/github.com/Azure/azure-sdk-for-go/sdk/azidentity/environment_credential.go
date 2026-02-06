//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
)

const (
	credNameEnvironment = "EnvironmentCredential"
	envVarSendCertChain = "AZURE_CLIENT_SEND_CERTIFICATE_CHAIN"
)

// EnvironmentCredentialOptions contains optional parameters for EnvironmentCredential
type EnvironmentCredentialOptions struct {
	azcore.ClientOptions

	// DisableInstanceDiscovery should be set true only by applications authenticating in disconnected clouds, or
	// private clouds such as Azure Stack. It determines whether the credential requests Microsoft Entra instance metadata
	// from https://login.microsoft.com before authenticating. Setting this to true will skip this request, making
	// the application responsible for ensuring the configured authority is valid and trustworthy.
	DisableInstanceDiscovery bool
	// additionallyAllowedTenants is used only by NewDefaultAzureCredential() to enable that constructor's explicit
	// option to override the value of AZURE_ADDITIONALLY_ALLOWED_TENANTS. Applications using EnvironmentCredential
	// directly should set that variable instead. This field should remain unexported to preserve this credential's
	// unambiguous "all configuration from environment variables" design.
	additionallyAllowedTenants []string
}

// EnvironmentCredential authenticates a service principal with a secret or certificate, or a user with a password, depending
// on environment variable configuration. It reads configuration from these variables, in the following order:
//
// # Service principal with client secret
//
// AZURE_TENANT_ID: ID of the service principal's tenant. Also called its "directory" ID.
//
// AZURE_CLIENT_ID: the service principal's client ID
//
// AZURE_CLIENT_SECRET: one of the service principal's client secrets
//
// # Service principal with certificate
//
// AZURE_TENANT_ID: ID of the service principal's tenant. Also called its "directory" ID.
//
// AZURE_CLIENT_ID: the service principal's client ID
//
// AZURE_CLIENT_CERTIFICATE_PATH: path to a PEM or PKCS12 certificate file including the private key.
//
// AZURE_CLIENT_CERTIFICATE_PASSWORD: (optional) password for the certificate file.
//
// Note that this credential uses [ParseCertificates] to load the certificate and key from the file. If this
// function isn't able to parse your certificate, use [ClientCertificateCredential] instead.
//
// # Configuration for multitenant applications
//
// To enable multitenant authentication, set AZURE_ADDITIONALLY_ALLOWED_TENANTS with a semicolon delimited list of tenants
// the credential may request tokens from in addition to the tenant specified by AZURE_TENANT_ID. Set
// AZURE_ADDITIONALLY_ALLOWED_TENANTS to "*" to enable the credential to request a token from any tenant.
//
// [Entra ID documentation]: https://aka.ms/azsdk/identity/mfa
type EnvironmentCredential struct {
	cred azcore.TokenCredential
}

// NewEnvironmentCredential creates an EnvironmentCredential. Pass nil to accept default options.
func NewEnvironmentCredential(options *EnvironmentCredentialOptions) (*EnvironmentCredential, error) {
	if options == nil {
		options = &EnvironmentCredentialOptions{}
	}
	tenantID := os.Getenv(azureTenantID)
	if tenantID == "" {
		return nil, errors.New("missing environment variable AZURE_TENANT_ID")
	}
	clientID := os.Getenv(azureClientID)
	if clientID == "" {
		return nil, errors.New("missing environment variable " + azureClientID)
	}
	// tenants set by NewDefaultAzureCredential() override the value of AZURE_ADDITIONALLY_ALLOWED_TENANTS
	additionalTenants := options.additionallyAllowedTenants
	if len(additionalTenants) == 0 {
		if tenants := os.Getenv(azureAdditionallyAllowedTenants); tenants != "" {
			additionalTenants = strings.Split(tenants, ";")
		}
	}
	if clientSecret := os.Getenv(azureClientSecret); clientSecret != "" {
		log.Write(EventAuthentication, "EnvironmentCredential will authenticate with ClientSecretCredential")
		o := &ClientSecretCredentialOptions{
			AdditionallyAllowedTenants: additionalTenants,
			ClientOptions:              options.ClientOptions,
			DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
		}
		cred, err := NewClientSecretCredential(tenantID, clientID, clientSecret, o)
		if err != nil {
			return nil, err
		}
		return &EnvironmentCredential{cred: cred}, nil
	}
	if certPath := os.Getenv(azureClientCertificatePath); certPath != "" {
		log.Write(EventAuthentication, "EnvironmentCredential will authenticate with ClientCertificateCredential")
		certData, err := os.ReadFile(certPath)
		if err != nil {
			return nil, fmt.Errorf(`failed to read certificate file "%s": %v`, certPath, err)
		}
		var password []byte
		if v := os.Getenv(azureClientCertificatePassword); v != "" {
			password = []byte(v)
		}
		certs, key, err := ParseCertificates(certData, password)
		if err != nil {
			return nil, fmt.Errorf("failed to parse %q due to error %q. This may be due to a limitation of this module's certificate loader. Consider calling NewClientCertificateCredential instead", certPath, err.Error())
		}
		o := &ClientCertificateCredentialOptions{
			AdditionallyAllowedTenants: additionalTenants,
			ClientOptions:              options.ClientOptions,
			DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
		}
		if v, ok := os.LookupEnv(envVarSendCertChain); ok {
			o.SendCertificateChain = v == "1" || strings.ToLower(v) == "true"
		}
		cred, err := NewClientCertificateCredential(tenantID, clientID, certs, key, o)
		if err != nil {
			return nil, err
		}
		return &EnvironmentCredential{cred: cred}, nil
	}
	if username := os.Getenv(azureUsername); username != "" {
		if password := os.Getenv(azurePassword); password != "" {
			log.Write(EventAuthentication, "EnvironmentCredential will authenticate with UsernamePasswordCredential")
			o := &UsernamePasswordCredentialOptions{
				AdditionallyAllowedTenants: additionalTenants,
				ClientOptions:              options.ClientOptions,
				DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
			}
			cred, err := NewUsernamePasswordCredential(tenantID, clientID, username, password, o)
			if err != nil {
				return nil, err
			}
			return &EnvironmentCredential{cred: cred}, nil
		}
		return nil, errors.New("no value for AZURE_PASSWORD")
	}
	return nil, errors.New("incomplete environment variable configuration. Only AZURE_TENANT_ID and AZURE_CLIENT_ID are set")
}

// GetToken requests an access token from Microsoft Entra ID. This method is called automatically by Azure SDK clients.
func (c *EnvironmentCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	return c.cred.GetToken(ctx, opts)
}

var _ azcore.TokenCredential = (*EnvironmentCredential)(nil)
