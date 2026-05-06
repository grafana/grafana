//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
)

const credNameAzureDeveloperCLI = "AzureDeveloperCLICredential"

type azdTokenProvider func(ctx context.Context, scopes []string, tenant string) ([]byte, error)

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
	// tokenProvider is used by tests to fake invoking azd
	tokenProvider azdTokenProvider
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
	if cp.tokenProvider == nil {
		cp.tokenProvider = defaultAzdTokenProvider
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
	for _, scope := range opts.Scopes {
		if !validScope(scope) {
			return at, fmt.Errorf("%s.GetToken(): invalid scope %q", credNameAzureDeveloperCLI, scope)
		}
	}
	tenant, err := resolveTenant(c.opts.TenantID, opts.TenantID, credNameAzureDeveloperCLI, c.opts.AdditionallyAllowedTenants)
	if err != nil {
		return at, err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	b, err := c.opts.tokenProvider(ctx, opts.Scopes, tenant)
	if err == nil {
		at, err = c.createAccessToken(b)
	}
	if err != nil {
		err = unavailableIfInChain(err, c.opts.inDefaultChain)
		return at, err
	}
	msg := fmt.Sprintf("%s.GetToken() acquired a token for scope %q", credNameAzureDeveloperCLI, strings.Join(opts.Scopes, ", "))
	log.Write(EventAuthentication, msg)
	return at, nil
}

// defaultAzTokenProvider invokes the Azure Developer CLI to acquire a token. It assumes
// callers have verified that all string arguments are safe to pass to the CLI.
var defaultAzdTokenProvider azdTokenProvider = func(ctx context.Context, scopes []string, tenant string) ([]byte, error) {
	// set a default timeout for this authentication iff the application hasn't done so already
	var cancel context.CancelFunc
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		ctx, cancel = context.WithTimeout(ctx, cliTimeout)
		defer cancel()
	}
	commandLine := "azd auth token -o json"
	if tenant != "" {
		commandLine += " --tenant-id " + tenant
	}
	for _, scope := range scopes {
		commandLine += " --scope " + scope
	}
	var cliCmd *exec.Cmd
	if runtime.GOOS == "windows" {
		dir := os.Getenv("SYSTEMROOT")
		if dir == "" {
			return nil, newCredentialUnavailableError(credNameAzureDeveloperCLI, "environment variable 'SYSTEMROOT' has no value")
		}
		cliCmd = exec.CommandContext(ctx, "cmd.exe", "/c", commandLine)
		cliCmd.Dir = dir
	} else {
		cliCmd = exec.CommandContext(ctx, "/bin/sh", "-c", commandLine)
		cliCmd.Dir = "/bin"
	}
	cliCmd.Env = os.Environ()
	var stderr bytes.Buffer
	cliCmd.Stderr = &stderr
	cliCmd.WaitDelay = 100 * time.Millisecond

	stdout, err := cliCmd.Output()
	if errors.Is(err, exec.ErrWaitDelay) && len(stdout) > 0 {
		// The child process wrote to stdout and exited without closing it.
		// Swallow this error and return stdout because it may contain a token.
		return stdout, nil
	}
	if err != nil {
		msg := stderr.String()
		var exErr *exec.ExitError
		if errors.As(err, &exErr) && exErr.ExitCode() == 127 || strings.HasPrefix(msg, "'azd' is not recognized") {
			msg = "Azure Developer CLI not found on path"
		} else if strings.Contains(msg, "azd auth login") {
			msg = `please run "azd auth login" from a command prompt to authenticate before using this credential`
		}
		if msg == "" {
			msg = err.Error()
		}
		return nil, newCredentialUnavailableError(credNameAzureDeveloperCLI, msg)
	}
	return stdout, nil
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
