package awsds

import (
	"context"
	"os"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
)

const (
	// AllowedAuthProvidersEnvVarKeyName is the string literal for the aws allowed auth providers environment variable key name
	AllowedAuthProvidersEnvVarKeyName = "AWS_AUTH_AllowedAuthProviders"

	// AssumeRoleEnabledEnvVarKeyName is the string literal for the aws assume role enabled environment variable key name
	AssumeRoleEnabledEnvVarKeyName = "AWS_AUTH_AssumeRoleEnabled"

	// PerDatasourceHTTPProxyEnabledEnvVarKeyName is the string literal for the per datasource http proxy enabled environment variable key name
	PerDatasourceHTTPProxyEnabledEnvVarKeyName = "AWS_AUTH_PerDatasourceHTTPProxyEnabled"

	// SessionDurationEnvVarKeyName is the string literal for the session duration variable key name
	SessionDurationEnvVarKeyName = "AWS_AUTH_SESSION_DURATION"

	// GrafanaAssumeRoleExternalIdKeyName is the string literal for the grafana assume role external id environment variable key name
	GrafanaAssumeRoleExternalIdKeyName = "AWS_AUTH_EXTERNAL_ID"

	// ListMetricsPageLimitKeyName is the string literal for the cloudwatch list metrics page limit key name
	ListMetricsPageLimitKeyName = "AWS_CW_LIST_METRICS_PAGE_LIMIT"

	// SigV4AuthEnabledEnvVarKeyName is the string literal for the sigv4 auth enabled environment variable key name
	SigV4AuthEnabledEnvVarKeyName = "AWS_SIGV4_AUTH_ENABLED"

	// SigV4VerboseLoggingEnvVarKeyName is the string literal for the sigv4 verbose logging environment variable key name
	SigV4VerboseLoggingEnvVarKeyName = "AWS_SIGV4_VERBOSE_LOGGING"

	defaultAssumeRoleEnabled             = true
	defaultListMetricsPageLimit          = 500
	defaultSecureSocksDSProxyEnabled     = false
	defaultPerDatasourceHTTPProxyEnabled = false
)

// ReadAuthSettings gets the Grafana auth settings from the context if its available, the environment variables if not
// Note: This function is mainly for backwards compatibility with older versions of Grafana; generally
// ReadAuthSettingsFromContext should be used instead
func ReadAuthSettings(ctx context.Context) *AuthSettings {
	settings, exists := ReadAuthSettingsFromContext(ctx)
	if !exists {
		settings = ReadAuthSettingsFromEnvironmentVariables()
	}
	return settings
}

func defaultAuthSettings() *AuthSettings {
	return &AuthSettings{
		AllowedAuthProviders:          []string{"default", "keys", "credentials"},
		AssumeRoleEnabled:             defaultAssumeRoleEnabled,
		SessionDuration:               &stscreds.DefaultDuration,
		ListMetricsPageLimit:          defaultListMetricsPageLimit,
		PerDatasourceHTTPProxyEnabled: defaultPerDatasourceHTTPProxyEnabled,
		SecureSocksDSProxyEnabled:     defaultSecureSocksDSProxyEnabled,
	}
}

// ReadAuthSettingsFromContext tries to get the auth settings from the GrafanaConfig in ctx, and returns true if it finds a config
func ReadAuthSettingsFromContext(ctx context.Context) (*AuthSettings, bool) {
	cfg := backend.GrafanaConfigFromContext(ctx)
	// initialize settings with the default values set
	settings := defaultAuthSettings()
	if cfg == nil {
		return settings, false
	}
	hasSettings := false

	if providers := cfg.Get(AllowedAuthProvidersEnvVarKeyName); providers != "" {
		allowedAuthProviders := []string{}
		for _, authProvider := range strings.Split(providers, ",") {
			authProvider = strings.TrimSpace(authProvider)
			if authProvider != "" {
				allowedAuthProviders = append(allowedAuthProviders, authProvider)
			}
		}
		if len(allowedAuthProviders) != 0 {
			settings.AllowedAuthProviders = allowedAuthProviders
		}
		hasSettings = true
	}

	if v := cfg.Get(AssumeRoleEnabledEnvVarKeyName); v != "" {
		assumeRoleEnabled, err := strconv.ParseBool(v)
		if err == nil {
			settings.AssumeRoleEnabled = assumeRoleEnabled
		} else {
			backend.Logger.Error("could not parse context variable", "var", AllowedAuthProvidersEnvVarKeyName)
		}
		hasSettings = true
	}

	if v := cfg.Get(GrafanaAssumeRoleExternalIdKeyName); v != "" {
		settings.ExternalID = v
		hasSettings = true
	}

	if v := cfg.Get(SessionDurationEnvVarKeyName); v != "" {
		sessionDuration, err := gtime.ParseDuration(v)
		if err == nil {
			settings.SessionDuration = &sessionDuration
		} else {
			backend.Logger.Error("could not parse env variable", "var", SessionDurationEnvVarKeyName)
		}
	}

	if v := cfg.Get(ListMetricsPageLimitKeyName); v != "" {
		listMetricsPageLimit, err := strconv.Atoi(v)
		if err == nil {
			settings.ListMetricsPageLimit = listMetricsPageLimit
		} else {
			backend.Logger.Error("could not parse context variable", "var", ListMetricsPageLimitKeyName)
		}
		hasSettings = true
	}

	if v := cfg.Get(PerDatasourceHTTPProxyEnabledEnvVarKeyName); v != "" {
		perDatasourceHTTPProxyEnabled, err := strconv.ParseBool(v)
		if err == nil {
			settings.PerDatasourceHTTPProxyEnabled = perDatasourceHTTPProxyEnabled
		} else {
			backend.Logger.Error("could not parse context variable", "var", PerDatasourceHTTPProxyEnabledEnvVarKeyName)
		}
		hasSettings = true
	}

	if v := cfg.Get(proxy.PluginSecureSocksProxyEnabled); v != "" {
		secureSocksDSProxyEnabled, err := strconv.ParseBool(v)
		if err == nil {
			settings.SecureSocksDSProxyEnabled = secureSocksDSProxyEnabled
		} else {
			backend.Logger.Error("could not parse context variable", "var", proxy.PluginSecureSocksProxyEnabled)
		}
		hasSettings = true
	}

	return settings, hasSettings
}

// ReadAuthSettingsFromEnvironmentVariables gets the Grafana auth settings from the environment variables
// Deprecated: Use ReadAuthSettingsFromContext instead
func ReadAuthSettingsFromEnvironmentVariables() *AuthSettings {
	authSettings := &AuthSettings{}
	allowedAuthProviders := []string{}
	providers := os.Getenv(AllowedAuthProvidersEnvVarKeyName)
	for _, authProvider := range strings.Split(providers, ",") {
		authProvider = strings.TrimSpace(authProvider)
		if authProvider != "" {
			allowedAuthProviders = append(allowedAuthProviders, authProvider)
		}
	}

	if len(allowedAuthProviders) == 0 {
		allowedAuthProviders = []string{"default", "keys", "credentials"}
		backend.Logger.Warn("could not find allowed auth providers. falling back to 'default, keys, credentials'")
	}
	authSettings.AllowedAuthProviders = allowedAuthProviders

	assumeRoleEnabledString := os.Getenv(AssumeRoleEnabledEnvVarKeyName)
	if len(assumeRoleEnabledString) == 0 {
		backend.Logger.Warn("environment variable missing. falling back to enable assume role", "var", AssumeRoleEnabledEnvVarKeyName)
		assumeRoleEnabledString = "true"
	}

	var err error
	authSettings.AssumeRoleEnabled, err = strconv.ParseBool(assumeRoleEnabledString)
	if err != nil {
		backend.Logger.Error("could not parse env variable", "var", AssumeRoleEnabledEnvVarKeyName)
		authSettings.AssumeRoleEnabled = defaultAssumeRoleEnabled
	}

	authSettings.ExternalID = os.Getenv(GrafanaAssumeRoleExternalIdKeyName)

	listMetricsPageLimitString := os.Getenv(ListMetricsPageLimitKeyName)
	if len(listMetricsPageLimitString) == 0 {
		backend.Logger.Warn("environment variable missing. falling back to default page limit", "var", ListMetricsPageLimitKeyName)
		listMetricsPageLimitString = "500"
	}

	authSettings.ListMetricsPageLimit, err = strconv.Atoi(listMetricsPageLimitString)
	if err != nil {
		backend.Logger.Error("could not parse env variable", "var", ListMetricsPageLimitKeyName)
		authSettings.ListMetricsPageLimit = defaultListMetricsPageLimit
	}

	sessionDurationString := os.Getenv(SessionDurationEnvVarKeyName)
	if sessionDurationString != "" {
		sessionDuration, err := gtime.ParseDuration(sessionDurationString)
		if err != nil {
			backend.Logger.Error("could not parse env variable", "var", SessionDurationEnvVarKeyName)
		} else {
			authSettings.SessionDuration = &sessionDuration
		}
	}

	proxyEnabledString := os.Getenv(proxy.PluginSecureSocksProxyEnabled)
	if len(proxyEnabledString) == 0 {
		backend.Logger.Warn("environment variable missing. falling back to proxy disabled", "var", proxy.PluginSecureSocksProxyEnabled)
		proxyEnabledString = "false"
	}

	authSettings.PerDatasourceHTTPProxyEnabled, err = strconv.ParseBool(os.Getenv(PerDatasourceHTTPProxyEnabledEnvVarKeyName))
	if err != nil {
		backend.Logger.Warn("environment variable missing. falling back to per datasource http proxy disabled", "var", PerDatasourceHTTPProxyEnabledEnvVarKeyName)
		authSettings.PerDatasourceHTTPProxyEnabled = defaultPerDatasourceHTTPProxyEnabled
	}

	authSettings.SecureSocksDSProxyEnabled, err = strconv.ParseBool(proxyEnabledString)
	if err != nil {
		backend.Logger.Error("could not parse env variable", "var", proxy.PluginSecureSocksProxyEnabled)
		authSettings.SecureSocksDSProxyEnabled = defaultSecureSocksDSProxyEnabled
	}

	return authSettings
}

// ReadSigV4Settings gets the SigV4 settings from the context if its available
func ReadSigV4Settings(ctx context.Context) *SigV4Settings {
	cfg := backend.GrafanaConfigFromContext(ctx)
	return &SigV4Settings{
		Enabled:        cfg.Get(SigV4AuthEnabledEnvVarKeyName) == "true",
		VerboseLogging: cfg.Get(SigV4VerboseLoggingEnvVarKeyName) == "true",
	}
}
