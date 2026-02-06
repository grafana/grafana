//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
)

const (
	credNameAzureDeveloperCLI = "AzureDeveloperCLICredential"
	mfaRequired               = "Azure Developer CLI requires multifactor authentication or additional claims"
)

// AzureDeveloperCLICredentialOptions contains optional parameters for AzureDeveloperCLICredential.
type AzureDeveloperCLICredentialOptions struct {
	// AdditionallyAllowedTenants specifies tenants to which the credential may authenticate, in addition to
	// TenantID. When TenantID is empty, this option has no effect and the credential will authenticate to
	// any requested tenant. Add the wildcard value "*" to allow the credential to authenticate to any tenant.
	AdditionallyAllowedTenants []string

	// TenantID identifies the tenant the credential should authenticate in. Defaults to the azd environment,
	// which is the tenant of the selected Azure subscription.
	TenantID string

	// inDefaultChain is true when the credential is part of DefaultAzureCredential
	inDefaultChain bool
	// exec is used by tests to fake invoking azd
	exec executor
}

// AzureDeveloperCLICredential authenticates as the identity logged in to the [Azure Developer CLI].
//
// [Azure Developer CLI]: https://learn.microsoft.com/azure/developer/azure-developer-cli/overview
type AzureDeveloperCLICredential struct {
	mu   *sync.Mutex
	opts AzureDeveloperCLICredentialOptions
}

// NewAzureDeveloperCLICredential constructs an AzureDeveloperCLICredential. Pass nil to accept default options.
func NewAzureDeveloperCLICredential(options *AzureDeveloperCLICredentialOptions) (*AzureDeveloperCLICredential, error) {
	cp := AzureDeveloperCLICredentialOptions{}
	if options != nil {
		cp = *options
	}
	if cp.TenantID != "" && !validTenantID(cp.TenantID) {
		return nil, errInvalidTenantID
	}
	if cp.exec == nil {
		cp.exec = shellExec
	}
	return &AzureDeveloperCLICredential{mu: &sync.Mutex{}, opts: cp}, nil
}

// GetToken requests a token from the Azure Developer CLI. This credential doesn't cache tokens, so every call invokes azd.
// This method is called automatically by Azure SDK clients.
func (c *AzureDeveloperCLICredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	at := azcore.AccessToken{}
	if len(opts.Scopes) == 0 {
		return at, errors.New(credNameAzureDeveloperCLI + ": GetToken() requires at least one scope")
	}
	command := "azd auth token -o json --no-prompt"
	for _, scope := range opts.Scopes {
		if !validScope(scope) {
			return at, fmt.Errorf("%s.GetToken(): invalid scope %q", credNameAzureDeveloperCLI, scope)
		}
		command += " --scope " + scope
	}
	tenant, err := resolveTenant(c.opts.TenantID, opts.TenantID, credNameAzureDeveloperCLI, c.opts.AdditionallyAllowedTenants)
	if err != nil {
		return at, err
	}
	if tenant != "" {
		command += " --tenant-id " + tenant
	}
	commandNoClaims := command
	if opts.Claims != "" {
		encoded := base64.StdEncoding.EncodeToString([]byte(opts.Claims))
		command += " --claims " + encoded
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	b, err := c.opts.exec(ctx, credNameAzureDeveloperCLI, command)
	if err == nil {
		at, err = c.createAccessToken(b)
	}
	if err != nil {
		msg := err.Error()
		switch {
		case strings.Contains(msg, "unknown flag: --claims"):
			err = newAuthenticationFailedError(
				credNameAzureDeveloperCLI,
				mfaRequired+", however the installed version doesn't support this. Upgrade to version 1.18.1 or later",
				nil,
			)
		case opts.Claims != "":
			err = newAuthenticationFailedError(
				credNameAzureDeveloperCLI,
				mfaRequired+". Run this command then retry the operation: "+commandNoClaims,
				nil,
			)
		case strings.Contains(msg, "azd auth login"):
			err = newCredentialUnavailableError(credNameAzureDeveloperCLI, `please run "azd auth login" from a command prompt to authenticate before using this credential`)
		}
		err = unavailableIfInDAC(err, c.opts.inDefaultChain)
		return at, err
	}
	msg := fmt.Sprintf("%s.GetToken() acquired a token for scope %q", credNameAzureDeveloperCLI, strings.Join(opts.Scopes, ", "))
	log.Write(EventAuthentication, msg)
	return at, nil
}

func (c *AzureDeveloperCLICredential) createAccessToken(tk []byte) (azcore.AccessToken, error) {
	t := struct {
		AccessToken string `json:"token"`
		ExpiresOn   string `json:"expiresOn"`
	}{}
	err := json.Unmarshal(tk, &t)
	if err != nil {
		return azcore.AccessToken{}, err
	}
	exp, err := time.Parse("2006-01-02T15:04:05Z", t.ExpiresOn)
	if err != nil {
		return azcore.AccessToken{}, fmt.Errorf("error parsing token expiration time %q: %v", t.ExpiresOn, err)
	}
	return azcore.AccessToken{
		ExpiresOn: exp.UTC(),
		Token:     t.AccessToken,
	}, nil
}

var _ azcore.TokenCredential = (*AzureDeveloperCLICredential)(nil)
