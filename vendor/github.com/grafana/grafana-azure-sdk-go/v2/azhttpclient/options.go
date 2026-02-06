package azhttpclient

import (
	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azhttpclient/internal/azendpoint"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-azure-sdk-go/v2/aztokenprovider"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

type AzureTokenProviderFactory = func(*azsettings.AzureSettings, azcredentials.AzureCredentials) (aztokenprovider.AzureTokenProvider, error)

type AuthOptions struct {
	settings              *azsettings.AzureSettings
	endpoints             *azendpoint.EndpointAllowlist
	scopes                []string
	userIdentitySupported bool
	rateLimitSession      bool
	customProviders       map[string]AzureTokenProviderFactory
}

func NewAuthOptions(settings *azsettings.AzureSettings) *AuthOptions {
	return &AuthOptions{settings: settings, scopes: []string{}}
}

func AddAzureAuthentication(clientOpts *sdkhttpclient.Options, authOpts *AuthOptions, credentials azcredentials.AzureCredentials) {
	clientOpts.Middlewares = append(clientOpts.Middlewares, AzureMiddleware(authOpts, credentials))
}

func (opts *AuthOptions) Scopes(scopes []string) {
	if len(scopes) > 0 {
		opts.scopes = make([]string, 0, len(scopes))
		for _, scope := range scopes {
			if scope != "" {
				opts.scopes = append(opts.scopes, scope)
			}
		}
	}
}

func (opts *AuthOptions) AllowedEndpoints(endpoints []string) error {
	if allowlist, err := azendpoint.Allowlist(endpoints); err != nil {
		return err
	} else {
		opts.endpoints = allowlist
	}
	return nil
}

func (opts *AuthOptions) AllowUserIdentity() {
	opts.userIdentitySupported = true
}

func (opts *AuthOptions) AddRateLimitSession(enable bool) {
	opts.rateLimitSession = enable
}

func (opts *AuthOptions) AddTokenProvider(authType string, factory AzureTokenProviderFactory) {
	if factory == nil {
		return
	}
	if opts.customProviders == nil {
		opts.customProviders = make(map[string]AzureTokenProviderFactory)
	}
	opts.customProviders[authType] = factory
}
