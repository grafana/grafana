// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
)

const (
	credNameAzurePipelines = "AzurePipelinesCredential"
	oidcAPIVersion         = "7.1"
	systemOIDCRequestURI   = "SYSTEM_OIDCREQUESTURI"
	xMsEdgeRef             = "x-msedge-ref"
	xVssE2eId              = "x-vss-e2eid"
)

// AzurePipelinesCredential authenticates with workload identity federation in an Azure Pipeline. See
// [Azure Pipelines documentation] for more information.
//
// [Azure Pipelines documentation]: https://learn.microsoft.com/azure/devops/pipelines/library/connect-to-azure?view=azure-devops#create-an-azure-resource-manager-service-connection-that-uses-workload-identity-federation
type AzurePipelinesCredential struct {
	connectionID, oidcURI, systemAccessToken string
	cred                                     *ClientAssertionCredential
}

// AzurePipelinesCredentialOptions contains optional parameters for AzurePipelinesCredential.
type AzurePipelinesCredentialOptions struct {
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

// NewAzurePipelinesCredential is the constructor for AzurePipelinesCredential.
//
//   - tenantID: tenant ID of the service principal federated with the service connection
//   - clientID: client ID of that service principal
//   - serviceConnectionID: ID of the service connection to authenticate
//   - systemAccessToken: security token for the running build. See [Azure Pipelines documentation] for
//     an example showing how to get this value.
//
// [Azure Pipelines documentation]: https://learn.microsoft.com/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml#systemaccesstoken
func NewAzurePipelinesCredential(tenantID, clientID, serviceConnectionID, systemAccessToken string, options *AzurePipelinesCredentialOptions) (*AzurePipelinesCredential, error) {
	if !validTenantID(tenantID) {
		return nil, errInvalidTenantID
	}
	if clientID == "" {
		return nil, errors.New("no client ID specified")
	}
	if serviceConnectionID == "" {
		return nil, errors.New("no service connection ID specified")
	}
	if systemAccessToken == "" {
		return nil, errors.New("no system access token specified")
	}
	u := os.Getenv(systemOIDCRequestURI)
	if u == "" {
		return nil, fmt.Errorf("no value for environment variable %s. This should be set by Azure Pipelines", systemOIDCRequestURI)
	}
	a := AzurePipelinesCredential{
		connectionID:      serviceConnectionID,
		oidcURI:           u,
		systemAccessToken: systemAccessToken,
	}
	if options == nil {
		options = &AzurePipelinesCredentialOptions{}
	}
	// these headers are useful to the DevOps team when debugging OIDC error responses
	options.ClientOptions.Logging.AllowedHeaders = append(options.ClientOptions.Logging.AllowedHeaders, xMsEdgeRef, xVssE2eId)
	caco := ClientAssertionCredentialOptions{
		AdditionallyAllowedTenants: options.AdditionallyAllowedTenants,
		Cache:                      options.Cache,
		ClientOptions:              options.ClientOptions,
		DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
	}
	cred, err := NewClientAssertionCredential(tenantID, clientID, a.getAssertion, &caco)
	if err != nil {
		return nil, err
	}
	cred.client.name = credNameAzurePipelines
	a.cred = cred
	return &a, nil
}

// GetToken requests an access token from Microsoft Entra ID. Azure SDK clients call this method automatically.
func (a *AzurePipelinesCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameAzurePipelines+"."+traceOpGetToken, a.cred.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := a.cred.GetToken(ctx, opts)
	return tk, err
}

func (a *AzurePipelinesCredential) getAssertion(ctx context.Context) (string, error) {
	url := a.oidcURI + "?api-version=" + oidcAPIVersion + "&serviceConnectionId=" + a.connectionID
	url, err := runtime.EncodeQueryParams(url)
	if err != nil {
		return "", newAuthenticationFailedError(credNameAzurePipelines, "couldn't encode OIDC URL: "+err.Error(), nil)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", newAuthenticationFailedError(credNameAzurePipelines, "couldn't create OIDC token request: "+err.Error(), nil)
	}
	req.Header.Set("Authorization", "Bearer "+a.systemAccessToken)
	// instruct endpoint to return 401 instead of 302, if the system access token is invalid
	req.Header.Set("X-TFS-FedAuthRedirect", "Suppress")
	res, err := doForClient(a.cred.client.azClient, req)
	if err != nil {
		return "", newAuthenticationFailedError(credNameAzurePipelines, "couldn't send OIDC token request: "+err.Error(), nil)
	}
	if res.StatusCode != http.StatusOK {
		msg := res.Status + " response from the OIDC endpoint. Check service connection ID and Pipeline configuration."
		for _, h := range []string{xMsEdgeRef, xVssE2eId} {
			if v := res.Header.Get(h); v != "" {
				msg += fmt.Sprintf("\n%s: %s", h, v)
			}
		}
		// include the response because its body, if any, probably contains an error message.
		// OK responses aren't included with errors because they probably contain secrets
		return "", newAuthenticationFailedError(credNameAzurePipelines, msg, res)
	}
	b, err := runtime.Payload(res)
	if err != nil {
		return "", newAuthenticationFailedError(credNameAzurePipelines, "couldn't read OIDC response content: "+err.Error(), nil)
	}
	var r struct {
		OIDCToken string `json:"oidcToken"`
	}
	err = json.Unmarshal(b, &r)
	if err != nil {
		return "", newAuthenticationFailedError(credNameAzurePipelines, "unexpected response from OIDC endpoint", nil)
	}
	return r.OIDCToken, nil
}
