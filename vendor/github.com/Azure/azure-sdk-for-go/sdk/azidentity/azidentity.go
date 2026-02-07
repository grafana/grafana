//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity/internal"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/confidential"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/managedidentity"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/public"
)

const (
	azureAdditionallyAllowedTenants = "AZURE_ADDITIONALLY_ALLOWED_TENANTS"
	azureAuthorityHost              = "AZURE_AUTHORITY_HOST"
	azureClientCertificatePassword  = "AZURE_CLIENT_CERTIFICATE_PASSWORD"
	azureClientCertificatePath      = "AZURE_CLIENT_CERTIFICATE_PATH"
	azureClientID                   = "AZURE_CLIENT_ID"
	azureClientSecret               = "AZURE_CLIENT_SECRET"
	azureFederatedTokenFile         = "AZURE_FEDERATED_TOKEN_FILE"
	azurePassword                   = "AZURE_PASSWORD"
	azureRegionalAuthorityName      = "AZURE_REGIONAL_AUTHORITY_NAME"
	azureTenantID                   = "AZURE_TENANT_ID"
	azureUsername                   = "AZURE_USERNAME"

	organizationsTenantID   = "organizations"
	developerSignOnClientID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"
	defaultSuffix           = "/.default"

	scopeLogFmt = "%s.GetToken() acquired a token for scope %q"

	traceNamespace      = "Microsoft.Entra"
	traceOpGetToken     = "GetToken"
	traceOpAuthenticate = "Authenticate"
)

var (
	// capability CP1 indicates the client application is capable of handling CAE claims challenges
	cp1                = []string{"CP1"}
	errInvalidTenantID = errors.New("invalid tenantID. You can locate your tenantID by following the instructions listed here: https://learn.microsoft.com/partner-center/find-ids-and-domain-names")
)

// Cache represents a persistent cache that makes authentication data available across processes.
// Construct one with [github.com/Azure/azure-sdk-for-go/sdk/azidentity/cache.New]. This package's
// [persistent user authentication example] shows how to use a persistent cache to reuse user
// logins across application runs. For service principal credential types such as
// [ClientCertificateCredential], simply set the Cache field on the credential options.
//
// [persistent user authentication example]: https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#example-package-PersistentUserAuthentication
type Cache = internal.Cache

// setAuthorityHost initializes the authority host for credentials. Precedence is:
//  1. cloud.Configuration.ActiveDirectoryAuthorityHost value set by user
//  2. value of AZURE_AUTHORITY_HOST
//  3. default: Azure Public Cloud
func setAuthorityHost(cc cloud.Configuration) (string, error) {
	host := cc.ActiveDirectoryAuthorityHost
	if host == "" {
		if len(cc.Services) > 0 {
			return "", errors.New("missing ActiveDirectoryAuthorityHost for specified cloud")
		}
		host = cloud.AzurePublic.ActiveDirectoryAuthorityHost
		if envAuthorityHost := os.Getenv(azureAuthorityHost); envAuthorityHost != "" {
			host = envAuthorityHost
		}
	}
	u, err := url.Parse(host)
	if err != nil {
		return "", err
	}
	if u.Scheme != "https" {
		return "", errors.New("cannot use an authority host without https")
	}
	return host, nil
}

// resolveAdditionalTenants returns a copy of tenants, simplified when tenants contains a wildcard
func resolveAdditionalTenants(tenants []string) []string {
	if len(tenants) == 0 {
		return nil
	}
	for _, t := range tenants {
		// a wildcard makes all other values redundant
		if t == "*" {
			return []string{"*"}
		}
	}
	cp := make([]string, len(tenants))
	copy(cp, tenants)
	return cp
}

// resolveTenant returns the correct tenant for a token request, or "" when the calling credential doesn't
// have an explicitly configured tenant and the caller didn't specify a tenant for the token request.
//
//   - defaultTenant: tenant set when constructing the credential, if any. "" is valid for credentials
//     having an optional or implicit tenant such as dev tool and interactive user credentials. Those
//     default to the tool's configured tenant or the user's home tenant, respectively.
//   - specified: tenant specified for this token request i.e., TokenRequestOptions.TenantID. May be "".
//   - credName: name of the calling credential type; for error messages
//   - additionalTenants: optional allow list of tenants the credential may acquire tokens from in
//     addition to defaultTenant i.e., the credential's AdditionallyAllowedTenants option
func resolveTenant(defaultTenant, specified, credName string, additionalTenants []string) (string, error) {
	if specified == "" || specified == defaultTenant {
		return defaultTenant, nil
	}
	if defaultTenant == "adfs" {
		return "", errors.New("ADFS doesn't support tenants")
	}
	if !validTenantID(specified) {
		return "", errInvalidTenantID
	}
	for _, t := range additionalTenants {
		if t == "*" || t == specified {
			return specified, nil
		}
	}
	if len(additionalTenants) == 0 {
		switch defaultTenant {
		case "", organizationsTenantID:
			// The application didn't specify a tenant or allow list when constructing the credential. Allow the
			// tenant specified for this token request because we have nothing to compare it to (i.e., it vacuously
			// satisfies the credential's configuration); don't know whether the application is multitenant; and
			// don't want to return an error in the common case that the specified tenant matches the credential's
			// default tenant determined elsewhere e.g., in some dev tool's configuration.
			return specified, nil
		}
	}
	return "", fmt.Errorf(`%s isn't configured to acquire tokens for tenant %q. To enable acquiring tokens for this tenant add it to the AdditionallyAllowedTenants on the credential options, or add "*" to allow acquiring tokens for any tenant`, credName, specified)
}

func alphanumeric(r rune) bool {
	return ('0' <= r && r <= '9') || ('a' <= r && r <= 'z') || ('A' <= r && r <= 'Z')
}

func validTenantID(tenantID string) bool {
	if len(tenantID) < 1 {
		return false
	}
	for _, r := range tenantID {
		if !(alphanumeric(r) || r == '.' || r == '-') {
			return false
		}
	}
	return true
}

func doForClient(client *azcore.Client, r *http.Request) (*http.Response, error) {
	req, err := runtime.NewRequest(r.Context(), r.Method, r.URL.String())
	if err != nil {
		return nil, err
	}
	if r.Body != nil && r.Body != http.NoBody {
		// create a rewindable body from the existing body as required
		var body io.ReadSeekCloser
		if rsc, ok := r.Body.(io.ReadSeekCloser); ok {
			body = rsc
		} else {
			b, err := io.ReadAll(r.Body)
			if err != nil {
				return nil, err
			}
			body = streaming.NopCloser(bytes.NewReader(b))
		}
		err = req.SetBody(body, r.Header.Get("Content-Type"))
		if err != nil {
			return nil, err
		}
	}

	// copy headers to the new request, ignoring any for which the new request has a value
	h := req.Raw().Header
	for key, vals := range r.Header {
		if _, has := h[key]; !has {
			for _, val := range vals {
				h.Add(key, val)
			}
		}
	}

	resp, err := client.Pipeline().Do(req)
	if err != nil {
		return nil, err
	}
	return resp, err
}

// enables fakes for test scenarios
type msalConfidentialClient interface {
	AcquireTokenSilent(ctx context.Context, scopes []string, options ...confidential.AcquireSilentOption) (confidential.AuthResult, error)
	AcquireTokenByAuthCode(ctx context.Context, code string, redirectURI string, scopes []string, options ...confidential.AcquireByAuthCodeOption) (confidential.AuthResult, error)
	AcquireTokenByCredential(ctx context.Context, scopes []string, options ...confidential.AcquireByCredentialOption) (confidential.AuthResult, error)
	AcquireTokenOnBehalfOf(ctx context.Context, userAssertion string, scopes []string, options ...confidential.AcquireOnBehalfOfOption) (confidential.AuthResult, error)
}

type msalManagedIdentityClient interface {
	AcquireToken(context.Context, string, ...managedidentity.AcquireTokenOption) (managedidentity.AuthResult, error)
}

// enables fakes for test scenarios
type msalPublicClient interface {
	AcquireTokenSilent(ctx context.Context, scopes []string, options ...public.AcquireSilentOption) (public.AuthResult, error)
	AcquireTokenByUsernamePassword(ctx context.Context, scopes []string, username string, password string, options ...public.AcquireByUsernamePasswordOption) (public.AuthResult, error)
	AcquireTokenByDeviceCode(ctx context.Context, scopes []string, options ...public.AcquireByDeviceCodeOption) (public.DeviceCode, error)
	AcquireTokenByAuthCode(ctx context.Context, code string, redirectURI string, scopes []string, options ...public.AcquireByAuthCodeOption) (public.AuthResult, error)
	AcquireTokenInteractive(ctx context.Context, scopes []string, options ...public.AcquireInteractiveOption) (public.AuthResult, error)
}
