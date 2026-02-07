package azsettings

import (
	"context"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type AzureSettings struct {
	AzureAuthEnabled        bool
	Cloud                   string
	ManagedIdentityEnabled  bool
	ManagedIdentityClientId string

	WorkloadIdentityEnabled  bool
	WorkloadIdentitySettings *WorkloadIdentitySettings

	UserIdentityEnabled                    bool
	UserIdentityTokenEndpoint              *TokenEndpointSettings
	UserIdentityFallbackCredentialsEnabled bool

	// This field determines which plugins will receive the settings via plugin context
	ForwardSettingsPlugins []string

	CustomCloudList     []*AzureCloudSettings
	CustomCloudListJSON string

	AzureEntraPasswordCredentialsEnabled bool
}

type WorkloadIdentitySettings struct {
	TenantId  string
	ClientId  string
	TokenFile string
}

type TokenEndpointSettings struct {
	TokenUrl                    string
	ClientAuthentication        string
	ClientId                    string
	ClientSecret                string
	ManagedIdentityClientId     string
	FederatedCredentialAudience string

	// UsernameAssertion allows to use a custom token request assertion when Grafana is behind auth proxy
	UsernameAssertion bool

	// Internal properties to track if values were overridden in the `azure` section
	TokenUrlOverride                    bool
	ClientAuthenticationOverride        bool
	ClientIdOverride                    bool
	ClientSecretOverride                bool
	ManagedIdentityClientIdOverride     bool
	FederatedCredentialAudienceOverride bool
}

func (settings *AzureSettings) GetDefaultCloud() string {
	cloudName := settings.Cloud
	if cloudName == "" {
		return AzurePublic
	}
	return cloudName
}

// Changes here are dependant on https://github.com/grafana/grafana/tree/main/pkg/plugins/envvars/envvars.go#L148
func ReadFromContext(ctx context.Context) (*AzureSettings, bool) {
	cfg := backend.GrafanaConfigFromContext(ctx)
	settings := &AzureSettings{}

	if cfg == nil {
		return settings, false
	}

	hasSettings := false
	if v := cfg.Get(AzureAuthEnabled); v == strconv.FormatBool(true) {
		settings.AzureAuthEnabled = true
		hasSettings = true
	}

	if customCloudsJSON := cfg.Get(AzureCustomCloudsConfig); customCloudsJSON != "" {
		// this method will parse the JSON and set the custom cloud list in one go
		if err := settings.SetCustomClouds(customCloudsJSON); err != nil {
			backend.Logger.Error("Error setting custom clouds:  %w", err)
		}
		if settings.CustomCloudListJSON != "" {
			hasSettings = true
		}
	}

	if v := cfg.Get(AzureCloud); v != "" {
		settings.Cloud = v
		hasSettings = true
	}

	if v := cfg.Get(ManagedIdentityEnabled); v == strconv.FormatBool(true) {
		settings.ManagedIdentityEnabled = true
		hasSettings = true

		if v := cfg.Get(ManagedIdentityClientID); v != "" {
			settings.ManagedIdentityClientId = v
		}
	}

	if v := cfg.Get(UserIdentityEnabled); v == strconv.FormatBool(true) {
		settings.UserIdentityEnabled = true
		hasSettings = true

		settings.UserIdentityTokenEndpoint = &TokenEndpointSettings{}
		settings.UserIdentityFallbackCredentialsEnabled = true

		if v := cfg.Get(UserIdentityClientAuthentication); v != "" {
			settings.UserIdentityTokenEndpoint.ClientAuthentication = v
		} else {
			settings.UserIdentityTokenEndpoint.ClientAuthentication = "client_secret_post" // Default to client_secret_post if not set
		}
		if v := cfg.Get(UserIdentityClientID); v != "" {
			settings.UserIdentityTokenEndpoint.ClientId = v
		}
		if v := cfg.Get(UserIdentityClientSecret); v != "" {
			settings.UserIdentityTokenEndpoint.ClientSecret = v
		}
		if v := cfg.Get(UserIdentityManagedIdentityClientID); v != "" {
			settings.UserIdentityTokenEndpoint.ManagedIdentityClientId = v
		}
		if v := cfg.Get(UserIdentityFederatedCredentialAudience); v != "" {
			settings.UserIdentityTokenEndpoint.FederatedCredentialAudience = v
		}
		if v := cfg.Get(UserIdentityTokenURL); v != "" {
			settings.UserIdentityTokenEndpoint.TokenUrl = v
		}
		if v := cfg.Get(UserIdentityAssertion); v == "username" {
			settings.UserIdentityTokenEndpoint.UsernameAssertion = true
		}
		if v := cfg.Get(UserIdentityFallbackCredentialsEnabled); v == strconv.FormatBool(false) {
			settings.UserIdentityFallbackCredentialsEnabled = false
		}
	}

	if v := cfg.Get(WorkloadIdentityEnabled); v == strconv.FormatBool(true) {
		settings.WorkloadIdentityEnabled = true
		hasSettings = true

		settings.WorkloadIdentitySettings = &WorkloadIdentitySettings{}

		if v := cfg.Get(WorkloadIdentityClientID); v != "" {
			settings.WorkloadIdentitySettings.ClientId = v
		}
		if v := cfg.Get(WorkloadIdentityTenantID); v != "" {
			settings.WorkloadIdentitySettings.TenantId = v
		}
		if v := cfg.Get(WorkloadIdentityTokenFile); v != "" {
			settings.WorkloadIdentitySettings.TokenFile = v
		}
	}

	if v := cfg.Get(AzureEntraPasswordCredentialsEnabled); v == strconv.FormatBool(true) {
		settings.AzureEntraPasswordCredentialsEnabled = true
		hasSettings = true
	}

	return settings, hasSettings
}

func ReadSettings(ctx context.Context) (*AzureSettings, error) {
	azSettings, exists := ReadFromContext(ctx)

	if !exists {
		azSettings, err := ReadFromEnv()
		if err != nil {
			return nil, err
		}

		return azSettings, nil
	}

	return azSettings, nil
}
