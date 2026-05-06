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

const credNameAzureCLI = "AzureCLICredential"

type azTokenProvider func(ctx context.Context, scopes []string, tenant, subscription string) ([]byte, error)

// AzureCLICredentialOptions contains optional parameters for AzureCLICredential.
type AzureCLICredentialOptions struct {
	// AdditionallyAllowedTenants specifies tenants to which the credential may authenticate, in addition to
	// TenantID. When TenantID is empty, this option has no effect and the credential will authenticate to
	// any requested tenant. Add the wildcard value "*" to allow the credential to authenticate to any tenant.
	AdditionallyAllowedTenants []string

	// Subscription is the name or ID of a subscription. Set this to acquire tokens for an account other
	// than the Azure CLI's current account.
	Subscription string

	// TenantID identifies the tenant the credential should authenticate in.
	// Defaults to the CLI's default tenant, which is typically the home tenant of the logged in user.
	TenantID string

	// inDefaultChain is true when the credential is part of DefaultAzureCredential
	inDefaultChain bool
	// tokenProvider is used by tests to fake invoking az
	tokenProvider azTokenProvider
}

// init returns an instance of AzureCLICredentialOptions initialized with default values.
func (o *AzureCLICredentialOptions) init() {
	if o.tokenProvider == nil {
		o.tokenProvider = defaultAzTokenProvider
	}
}

// AzureCLICredential authenticates as the identity logged in to the Azure CLI.
type AzureCLICredential struct {
	mu   *sync.Mutex
	opts AzureCLICredentialOptions
}

// NewAzureCLICredential constructs an AzureCLICredential. Pass nil to accept default options.
func NewAzureCLICredential(options *AzureCLICredentialOptions) (*AzureCLICredential, error) {
	cp := AzureCLICredentialOptions{}
	if options != nil {
		cp = *options
	}
	for _, r := range cp.Subscription {
		if !(alphanumeric(r) || r == '-' || r == '_' || r == ' ' || r == '.') {
			return nil, fmt.Errorf(
				"%s: Subscription %q contains invalid characters. If this is the name of a subscription, use its ID instead",
				credNameAzureCLI,
				cp.Subscription,
			)
		}
	}
	if cp.TenantID != "" && !validTenantID(cp.TenantID) {
		return nil, errInvalidTenantID
	}
	cp.init()
	cp.AdditionallyAllowedTenants = resolveAdditionalTenants(cp.AdditionallyAllowedTenants)
	return &AzureCLICredential{mu: &sync.Mutex{}, opts: cp}, nil
}

// GetToken requests a token from the Azure CLI. This credential doesn't cache tokens, so every call invokes the CLI.
// This method is called automatically by Azure SDK clients.
func (c *AzureCLICredential) GetToken(ctx context.Context, opts policy.TokenRequestOptions) (azcore.AccessToken, error) {
	at := azcore.AccessToken{}
	if len(opts.Scopes) != 1 {
		return at, errors.New(credNameAzureCLI + ": GetToken() requires exactly one scope")
	}
	if !validScope(opts.Scopes[0]) {
		return at, fmt.Errorf("%s.GetToken(): invalid scope %q", credNameAzureCLI, opts.Scopes[0])
	}
	tenant, err := resolveTenant(c.opts.TenantID, opts.TenantID, credNameAzureCLI, c.opts.AdditionallyAllowedTenants)
	if err != nil {
		return at, err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	b, err := c.opts.tokenProvider(ctx, opts.Scopes, tenant, c.opts.Subscription)
	if err == nil {
		at, err = c.createAccessToken(b)
	}
	if err != nil {
		err = unavailableIfInChain(err, c.opts.inDefaultChain)
		return at, err
	}
	msg := fmt.Sprintf("%s.GetToken() acquired a token for scope %q", credNameAzureCLI, strings.Join(opts.Scopes, ", "))
	log.Write(EventAuthentication, msg)
	return at, nil
}

// defaultAzTokenProvider invokes the Azure CLI to acquire a token. It assumes
// callers have verified that all string arguments are safe to pass to the CLI.
var defaultAzTokenProvider azTokenProvider = func(ctx context.Context, scopes []string, tenantID, subscription string) ([]byte, error) {
	// pass the CLI a Microsoft Entra ID v1 resource because we don't know which CLI version is installed and older ones don't support v2 scopes
	resource := strings.TrimSuffix(scopes[0], defaultSuffix)
	// set a default timeout for this authentication iff the application hasn't done so already
	var cancel context.CancelFunc
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		ctx, cancel = context.WithTimeout(ctx, cliTimeout)
		defer cancel()
	}
	commandLine := "az account get-access-token -o json --resource " + resource
	if tenantID != "" {
		commandLine += " --tenant " + tenantID
	}
	if subscription != "" {
		// subscription needs quotes because it may contain spaces
		commandLine += ` --subscription "` + subscription + `"`
	}
	var cliCmd *exec.Cmd
	if runtime.GOOS == "windows" {
		dir := os.Getenv("SYSTEMROOT")
		if dir == "" {
			return nil, newCredentialUnavailableError(credNameAzureCLI, "environment variable 'SYSTEMROOT' has no value")
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
		if errors.As(err, &exErr) && exErr.ExitCode() == 127 || strings.HasPrefix(msg, "'az' is not recognized") {
			msg = "Azure CLI not found on path"
		}
		if msg == "" {
			msg = err.Error()
		}
		return nil, newCredentialUnavailableError(credNameAzureCLI, msg)
	}

	return stdout, nil
}

func (c *AzureCLICredential) createAccessToken(tk []byte) (azcore.AccessToken, error) {
	t := struct {
		AccessToken string `json:"accessToken"`
		Expires_On  int64  `json:"expires_on"`
		ExpiresOn   string `json:"expiresOn"`
	}{}
	err := json.Unmarshal(tk, &t)
	if err != nil {
		return azcore.AccessToken{}, err
	}

	exp := time.Unix(t.Expires_On, 0)
	if t.Expires_On == 0 {
		exp, err = time.ParseInLocation("2006-01-02 15:04:05.999999", t.ExpiresOn, time.Local)
		if err != nil {
			return azcore.AccessToken{}, fmt.Errorf("%s: error parsing token expiration time %q: %v", credNameAzureCLI, t.ExpiresOn, err)
		}
	}

	converted := azcore.AccessToken{
		Token:     t.AccessToken,
		ExpiresOn: exp.UTC(),
	}
	return converted, nil
}

var _ azcore.TokenCredential = (*AzureCLICredential)(nil)
