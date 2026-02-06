//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity/internal"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/public"

	// this import ensures well-known configurations in azcore/cloud have ARM audiences for Authenticate()
	_ "github.com/Azure/azure-sdk-for-go/sdk/azcore/arm/runtime"
)

type publicClientOptions struct {
	azcore.ClientOptions

	AdditionallyAllowedTenants     []string
	Cache                          Cache
	DeviceCodePrompt               func(context.Context, DeviceCodeMessage) error
	DisableAutomaticAuthentication bool
	DisableInstanceDiscovery       bool
	LoginHint, RedirectURL         string
	Record                         AuthenticationRecord
	Username, Password             string
}

// publicClient wraps the MSAL public client
type publicClient struct {
	cae, noCAE               msalPublicClient
	caeMu, noCAEMu, clientMu *sync.Mutex
	clientID, tenantID       string
	defaultScope             []string
	host                     string
	name                     string
	opts                     publicClientOptions
	record                   AuthenticationRecord
	azClient                 *azcore.Client
}

var errScopeRequired = errors.New("authenticating in this environment requires specifying a scope in TokenRequestOptions")

func newPublicClient(tenantID, clientID, name string, o publicClientOptions) (*publicClient, error) {
	if !validTenantID(tenantID) {
		return nil, errInvalidTenantID
	}
	host, err := setAuthorityHost(o.Cloud)
	if err != nil {
		return nil, err
	}
	// if the application specified a cloud configuration, use its ARM audience as the default scope for Authenticate()
	audience := o.Cloud.Services[cloud.ResourceManager].Audience
	if audience == "" {
		// no cloud configuration, or no ARM audience, specified; try to map the host to a well-known one (all of which have a trailing slash)
		if !strings.HasSuffix(host, "/") {
			host += "/"
		}
		switch host {
		case cloud.AzureChina.ActiveDirectoryAuthorityHost:
			audience = cloud.AzureChina.Services[cloud.ResourceManager].Audience
		case cloud.AzureGovernment.ActiveDirectoryAuthorityHost:
			audience = cloud.AzureGovernment.Services[cloud.ResourceManager].Audience
		case cloud.AzurePublic.ActiveDirectoryAuthorityHost:
			audience = cloud.AzurePublic.Services[cloud.ResourceManager].Audience
		}
	}
	// if we didn't come up with an audience, the application will have to specify a scope for Authenticate()
	var defaultScope []string
	if audience != "" {
		defaultScope = []string{audience + defaultSuffix}
	}
	client, err := azcore.NewClient(module, version, runtime.PipelineOptions{
		Tracing: runtime.TracingOptions{
			Namespace: traceNamespace,
		},
	}, &o.ClientOptions)
	if err != nil {
		return nil, err
	}
	o.AdditionallyAllowedTenants = resolveAdditionalTenants(o.AdditionallyAllowedTenants)
	return &publicClient{
		caeMu:        &sync.Mutex{},
		clientID:     clientID,
		clientMu:     &sync.Mutex{},
		defaultScope: defaultScope,
		host:         host,
		name:         name,
		noCAEMu:      &sync.Mutex{},
		opts:         o,
		record:       o.Record,
		tenantID:     tenantID,
		azClient:     client,
	}, nil
}

func (p *publicClient) Authenticate(ctx context.Context, tro *policy.TokenRequestOptions) (AuthenticationRecord, error) {
	if tro == nil {
		tro = &policy.TokenRequestOptions{}
	}
	if len(tro.Scopes) == 0 {
		if p.defaultScope == nil {
			return AuthenticationRecord{}, errScopeRequired
		}
		tro.Scopes = p.defaultScope
	}
	client, mu, err := p.client(*tro)
	if err != nil {
		return AuthenticationRecord{}, err
	}
	mu.Lock()
	defer mu.Unlock()
	_, err = p.reqToken(ctx, client, *tro)
	if err == nil {
		scope := strings.Join(tro.Scopes, ", ")
		msg := fmt.Sprintf("%s.Authenticate() acquired a token for scope %q", p.name, scope)
		log.Write(EventAuthentication, msg)
	}
	return p.record, err
}

// GetToken requests an access token from MSAL, checking the cache first.
func (p *publicClient) GetToken(ctx context.Context, tro policy.TokenRequestOptions) (azcore.AccessToken, error) {
	if len(tro.Scopes) < 1 {
		return azcore.AccessToken{}, fmt.Errorf("%s.GetToken() requires at least one scope", p.name)
	}
	tenant, err := p.resolveTenant(tro.TenantID)
	if err != nil {
		return azcore.AccessToken{}, err
	}
	client, mu, err := p.client(tro)
	if err != nil {
		return azcore.AccessToken{}, err
	}
	mu.Lock()
	defer mu.Unlock()
	ar, err := client.AcquireTokenSilent(ctx, tro.Scopes, public.WithSilentAccount(p.record.account()), public.WithClaims(tro.Claims), public.WithTenantID(tenant))
	if err == nil {
		return p.token(ar, err)
	}
	if p.opts.DisableAutomaticAuthentication {
		return azcore.AccessToken{}, newAuthenticationRequiredError(p.name, tro)
	}
	return p.reqToken(ctx, client, tro)
}

// reqToken requests a token from the MSAL public client. It's separate from GetToken() to enable Authenticate() to bypass the cache.
func (p *publicClient) reqToken(ctx context.Context, c msalPublicClient, tro policy.TokenRequestOptions) (azcore.AccessToken, error) {
	tenant, err := p.resolveTenant(tro.TenantID)
	if err != nil {
		return azcore.AccessToken{}, err
	}
	var ar public.AuthResult
	switch p.name {
	case credNameBrowser:
		ar, err = c.AcquireTokenInteractive(ctx, tro.Scopes,
			public.WithClaims(tro.Claims),
			public.WithLoginHint(p.opts.LoginHint),
			public.WithRedirectURI(p.opts.RedirectURL),
			public.WithTenantID(tenant),
		)
	case credNameDeviceCode:
		dc, e := c.AcquireTokenByDeviceCode(ctx, tro.Scopes, public.WithClaims(tro.Claims), public.WithTenantID(tenant))
		if e != nil {
			return azcore.AccessToken{}, e
		}
		err = p.opts.DeviceCodePrompt(ctx, DeviceCodeMessage{
			Message:         dc.Result.Message,
			UserCode:        dc.Result.UserCode,
			VerificationURL: dc.Result.VerificationURL,
		})
		if err == nil {
			ar, err = dc.AuthenticationResult(ctx)
		}
	case credNameUserPassword:
		ar, err = c.AcquireTokenByUsernamePassword(ctx, tro.Scopes, p.opts.Username, p.opts.Password, public.WithClaims(tro.Claims), public.WithTenantID(tenant))
	default:
		return azcore.AccessToken{}, fmt.Errorf("unknown credential %q", p.name)
	}
	return p.token(ar, err)
}

func (p *publicClient) client(tro policy.TokenRequestOptions) (msalPublicClient, *sync.Mutex, error) {
	p.clientMu.Lock()
	defer p.clientMu.Unlock()
	if tro.EnableCAE {
		if p.cae == nil {
			client, err := p.newMSALClient(true)
			if err != nil {
				return nil, nil, err
			}
			p.cae = client
		}
		return p.cae, p.caeMu, nil
	}
	if p.noCAE == nil {
		client, err := p.newMSALClient(false)
		if err != nil {
			return nil, nil, err
		}
		p.noCAE = client
	}
	return p.noCAE, p.noCAEMu, nil
}

func (p *publicClient) newMSALClient(enableCAE bool) (msalPublicClient, error) {
	c, err := internal.ExportReplace(p.opts.Cache, enableCAE)
	if err != nil {
		return nil, err
	}
	o := []public.Option{
		public.WithAuthority(runtime.JoinPaths(p.host, p.tenantID)),
		public.WithCache(c),
		public.WithHTTPClient(p),
	}
	if enableCAE {
		o = append(o, public.WithClientCapabilities(cp1))
	}
	if p.opts.DisableInstanceDiscovery || strings.ToLower(p.tenantID) == "adfs" {
		o = append(o, public.WithInstanceDiscovery(false))
	}
	return public.New(p.clientID, o...)
}

func (p *publicClient) token(ar public.AuthResult, err error) (azcore.AccessToken, error) {
	if err == nil {
		msg := fmt.Sprintf(scopeLogFmt, p.name, strings.Join(ar.GrantedScopes, ", "))
		log.Write(EventAuthentication, msg)
		p.record, err = newAuthenticationRecord(ar)
	} else {
		err = newAuthenticationFailedErrorFromMSAL(p.name, err)
	}
	return azcore.AccessToken{Token: ar.AccessToken, ExpiresOn: ar.ExpiresOn.UTC(), RefreshOn: ar.Metadata.RefreshOn.UTC()}, err
}

// resolveTenant returns the correct WithTenantID() argument for a token request given the client's
// configuration, or an error when that configuration doesn't allow the specified tenant
func (p *publicClient) resolveTenant(specified string) (string, error) {
	t, err := resolveTenant(p.tenantID, specified, p.name, p.opts.AdditionallyAllowedTenants)
	if t == p.tenantID {
		// callers pass this value to MSAL's WithTenantID(). There's no need to redundantly specify
		// the client's default tenant and doing so is an error when that tenant is "organizations"
		t = ""
	}
	return t, err
}

// these methods satisfy the MSAL ops.HTTPClient interface

func (p *publicClient) CloseIdleConnections() {
	// do nothing
}

func (p *publicClient) Do(r *http.Request) (*http.Response, error) {
	return doForClient(p.azClient, r)
}
