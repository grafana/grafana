//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"errors"
	"os"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
)

const credNameWorkloadIdentity = "WorkloadIdentityCredential"

// WorkloadIdentityCredential supports Azure workload identity on Kubernetes.
// See [Azure Kubernetes Service documentation] for more information.
//
// [Azure Kubernetes Service documentation]: https://learn.microsoft.com/azure/aks/workload-identity-overview
type WorkloadIdentityCredential struct {
	assertion, file string
	cred            *ClientAssertionCredential
	expires         time.Time
	mtx             *sync.RWMutex
}

// WorkloadIdentityCredentialOptions contains optional parameters for WorkloadIdentityCredential.
type WorkloadIdentityCredentialOptions struct {
	azcore.ClientOptions

	// AdditionallyAllowedTenants specifies additional tenants for which the credential may acquire tokens.
	// Add the wildcard value "*" to allow the credential to acquire tokens for any tenant in which the
	// application is registered.
	AdditionallyAllowedTenants []string

	// Cache is a persistent cache the credential will use to store the tokens it acquires, making
	// them available to other processes and credential instances. The default, zero value means the
	// credential will store tokens in memory and not share them with any other credential instance.
	Cache Cache

	// ClientID of the service principal. Defaults to the value of the environment variable AZURE_CLIENT_ID.
	ClientID string

	// DisableInstanceDiscovery should be set true only by applications authenticating in disconnected clouds, or
	// private clouds such as Azure Stack. It determines whether the credential requests Microsoft Entra instance metadata
	// from https://login.microsoft.com before authenticating. Setting this to true will skip this request, making
	// the application responsible for ensuring the configured authority is valid and trustworthy.
	DisableInstanceDiscovery bool

	// TenantID of the service principal. Defaults to the value of the environment variable AZURE_TENANT_ID.
	TenantID string

	// TokenFilePath is the path of a file containing a Kubernetes service account token. Defaults to the value of the
	// environment variable AZURE_FEDERATED_TOKEN_FILE.
	TokenFilePath string
}

// NewWorkloadIdentityCredential constructs a WorkloadIdentityCredential. Service principal configuration is read
// from environment variables as set by the Azure workload identity webhook. Set options to override those values.
func NewWorkloadIdentityCredential(options *WorkloadIdentityCredentialOptions) (*WorkloadIdentityCredential, error) {
	if options == nil {
		options = &WorkloadIdentityCredentialOptions{}
	}
	ok := false
	clientID := options.ClientID
	if clientID == "" {
		if clientID, ok = os.LookupEnv(azureClientID); !ok {
			return nil, errors.New("no client ID specified. Check pod configuration or set ClientID in the options")
		}
	}
	file := options.TokenFilePath
	if file == "" {
		if file, ok = os.LookupEnv(azureFederatedTokenFile); !ok {
			return nil, errors.New("no token file specified. Check pod configuration or set TokenFilePath in the options")
		}
	}
	tenantID := options.TenantID
	if tenantID == "" {
		if tenantID, ok = os.LookupEnv(azureTenantID); !ok {
			return nil, errors.New("no tenant ID specified. Check pod configuration or set TenantID in the options")
		}
	}
	w := WorkloadIdentityCredential{file: file, mtx: &sync.RWMutex{}}
	caco := ClientAssertionCredentialOptions{
		AdditionallyAllowedTenants: options.AdditionallyAllowedTenants,
		Cache:                      options.Cache,
		ClientOptions:              options.ClientOptions,
		DisableInstanceDiscovery:   options.DisableInstanceDiscovery,
	}
	cred, err := NewClientAssertionCredential(tenantID, clientID, w.getAssertion, &caco)
	if err != nil {
		return nil, err
	}
	// we want "WorkloadIdentityCredential" in log messages, not "ClientAssertionCredential"
	cred.client.name = credNameWorkloadIdentity
	w.cred = cred
	return &w, nil
}

// GetToken requests an access token from Microsoft Entra ID. Azure SDK clients call this method automatically.
func (w *WorkloadIdentityCredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	var err error
	ctx, endSpan := runtime.StartSpan(ctx, credNameWorkloadIdentity+"."+traceOpGetToken, w.cred.client.azClient.Tracer(), nil)
	defer func() { endSpan(err) }()
	tk, err := w.cred.GetToken(ctx, opts)
	return tk, err
}

// getAssertion returns the specified file's content, which is expected to be a Kubernetes service account token.
// Kubernetes is responsible for updating the file as service account tokens expire.
func (w *WorkloadIdentityCredential) getAssertion(context.Context) (string, error) {
	w.mtx.RLock()
	if w.expires.Before(time.Now()) {
		// ensure only one goroutine at a time updates the assertion
		w.mtx.RUnlock()
		w.mtx.Lock()
		defer w.mtx.Unlock()
		// double check because another goroutine may have acquired the write lock first and done the update
		if now := time.Now(); w.expires.Before(now) {
			content, err := os.ReadFile(w.file)
			if err != nil {
				return "", err
			}
			w.assertion = string(content)
			// Kubernetes rotates service account tokens when they reach 80% of their total TTL. The shortest TTL
			// is 1 hour. That implies the token we just read is valid for at least 12 minutes (20% of 1 hour),
			// but we add some margin for safety.
			w.expires = now.Add(10 * time.Minute)
		}
	} else {
		defer w.mtx.RUnlock()
	}
	return w.assertion, nil
}
