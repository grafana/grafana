package azsettings

import (
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings/internal/envutil"
)

const (
	AzureCloud              = "GFAZPL_AZURE_CLOUD"
	AzureCustomCloudsConfig = "GFAZPL_AZURE_CLOUDS_CONFIG"

	AzureAuthEnabled = "GFAZPL_AZURE_AUTH_ENABLED"

	ManagedIdentityEnabled  = "GFAZPL_MANAGED_IDENTITY_ENABLED"
	ManagedIdentityClientID = "GFAZPL_MANAGED_IDENTITY_CLIENT_ID"

	WorkloadIdentityEnabled   = "GFAZPL_WORKLOAD_IDENTITY_ENABLED"
	WorkloadIdentityTenantID  = "GFAZPL_WORKLOAD_IDENTITY_TENANT_ID"
	WorkloadIdentityClientID  = "GFAZPL_WORKLOAD_IDENTITY_CLIENT_ID"
	WorkloadIdentityTokenFile = "GFAZPL_WORKLOAD_IDENTITY_TOKEN_FILE"

	UserIdentityEnabled                     = "GFAZPL_USER_IDENTITY_ENABLED"
	UserIdentityTokenURL                    = "GFAZPL_USER_IDENTITY_TOKEN_URL"
	UserIdentityClientAuthentication        = "GFAZPL_USER_IDENTITY_CLIENT_AUTHENTICATION"
	UserIdentityClientID                    = "GFAZPL_USER_IDENTITY_CLIENT_ID"
	UserIdentityClientSecret                = "GFAZPL_USER_IDENTITY_CLIENT_SECRET"
	UserIdentityManagedIdentityClientID     = "GFAZPL_USER_IDENTITY_MANAGED_IDENTITY_CLIENT_ID"
	UserIdentityFederatedCredentialAudience = "GFAZPL_USER_IDENTITY_FEDERATED_CREDENTIAL_AUDIENCE"
	UserIdentityAssertion                   = "GFAZPL_USER_IDENTITY_ASSERTION"
	UserIdentityFallbackCredentialsEnabled  = "GFAZPL_USER_IDENTITY_FALLBACK_SERVICE_CREDENTIALS_ENABLED"

	AzureEntraPasswordCredentialsEnabled = "GFAZPL_AZURE_ENTRA_PASSWORD_CREDENTIALS_ENABLED"

	// Pre Grafana 9.x variables
	fallbackAzureCloud              = "AZURE_CLOUD"
	fallbackManagedIdentityEnabled  = "AZURE_MANAGED_IDENTITY_ENABLED"
	fallbackManagedIdentityClientId = "AZURE_MANAGED_IDENTITY_CLIENT_ID"
)

func ReadFromEnv() (*AzureSettings, error) {
	azureSettings := &AzureSettings{}

	azureSettings.Cloud = envutil.GetOrFallback(AzureCloud, fallbackAzureCloud, AzurePublic)

	// Azure auth enabled or not
	if azureAuthEnabled, err := envutil.GetBoolOrDefault(AzureAuthEnabled, false); err != nil {
		err = fmt.Errorf("invalid Azure configuration: %w", err)
		return nil, err
	} else if azureAuthEnabled {
		azureSettings.AzureAuthEnabled = true
	}

	if customCloudsJSON := envutil.GetOrDefault(AzureCustomCloudsConfig, ""); customCloudsJSON != "" {
		// this method will parse the JSON and set the custom cloud list in one go
		if err := azureSettings.SetCustomClouds(customCloudsJSON); err != nil {
			return nil, err
		}
	}

	// Managed Identity authentication
	if msiEnabled, err := envutil.GetBoolOrFallback(ManagedIdentityEnabled, fallbackManagedIdentityEnabled, false); err != nil {
		err = fmt.Errorf("invalid Azure configuration: %w", err)
		return nil, err
	} else if msiEnabled {
		azureSettings.ManagedIdentityEnabled = true
		azureSettings.ManagedIdentityClientId = envutil.GetOrFallback(ManagedIdentityClientID, fallbackManagedIdentityClientId, "")
	}

	// Workload Identity authentication
	if wiEnabled, err := envutil.GetBoolOrDefault(WorkloadIdentityEnabled, false); err != nil {
		err = fmt.Errorf("invalid Azure configuration: %w", err)
		return nil, err
	} else if wiEnabled {
		azureSettings.WorkloadIdentityEnabled = true

		wiSettings := &WorkloadIdentitySettings{}
		wiSettings.TenantId = envutil.GetOrDefault(WorkloadIdentityTenantID, "")
		wiSettings.ClientId = envutil.GetOrDefault(WorkloadIdentityClientID, "")
		wiSettings.TokenFile = envutil.GetOrDefault(WorkloadIdentityTokenFile, "")
		azureSettings.WorkloadIdentitySettings = wiSettings
	}

	// User Identity authentication
	if userIdentityEnabled, err := envutil.GetBoolOrDefault(UserIdentityEnabled, false); err != nil {
		err = fmt.Errorf("invalid Azure configuration: %w", err)
		return nil, err
	} else if userIdentityEnabled {
		tokenUrl, err := envutil.Get(UserIdentityTokenURL)
		if err != nil {
			err = fmt.Errorf("token URL must be set when user identity authentication enabled: %w", err)
			return nil, err
		}

		// Default to client_secret_post if not set
		clientAuthentication := envutil.GetOrDefault(UserIdentityClientAuthentication, "client_secret_post")

		clientId, err := envutil.Get(UserIdentityClientID)
		if err != nil {
			err = fmt.Errorf("client ID must be set when user identity authentication enabled: %w", err)
			return nil, err
		}

		clientSecret := envutil.GetOrDefault(UserIdentityClientSecret, "")

		managedIdentityClientId := envutil.GetOrDefault(UserIdentityManagedIdentityClientID, "")

		federatedCredentialAudience := envutil.GetOrDefault(UserIdentityFederatedCredentialAudience, "")

		assertion := envutil.GetOrDefault(UserIdentityAssertion, "")
		usernameAssertion := assertion == "username"

		serviceCredentialsFallback, err := envutil.GetBoolOrDefault(UserIdentityFallbackCredentialsEnabled, true)
		if err != nil {
			return nil, err
		}

		azureSettings.UserIdentityEnabled = true
		azureSettings.UserIdentityTokenEndpoint = &TokenEndpointSettings{
			TokenUrl:                    tokenUrl,
			ClientAuthentication:        clientAuthentication,
			ClientId:                    clientId,
			ClientSecret:                clientSecret,
			ManagedIdentityClientId:     managedIdentityClientId,
			FederatedCredentialAudience: federatedCredentialAudience,
			UsernameAssertion:           usernameAssertion,
		}
		azureSettings.UserIdentityFallbackCredentialsEnabled = serviceCredentialsFallback
	}

	// Client Password Credentials auth
	if AzureEntraPasswordCredentialsEnabled, err := envutil.GetBoolOrDefault(AzureEntraPasswordCredentialsEnabled, false); err != nil {
		err = fmt.Errorf("invalid Azure configuration: %w", err)
		return nil, err
	} else {
		azureSettings.AzureEntraPasswordCredentialsEnabled = AzureEntraPasswordCredentialsEnabled
	}

	return azureSettings, nil
}

func WriteToEnvStr(azureSettings *AzureSettings) []string {
	var envs []string

	if azureSettings != nil {
		if azureSettings.Cloud != "" {
			envs = append(envs, fmt.Sprintf("%s=%s", AzureCloud, azureSettings.Cloud))
		}

		if azureSettings.AzureAuthEnabled {
			envs = append(envs, fmt.Sprintf("%s=true", AzureAuthEnabled))
		}

		if azureSettings.ManagedIdentityEnabled {
			envs = append(envs, fmt.Sprintf("%s=true", ManagedIdentityEnabled))

			if azureSettings.ManagedIdentityClientId != "" {
				envs = append(envs, fmt.Sprintf("%s=%s", ManagedIdentityClientID, azureSettings.ManagedIdentityClientId))
			}
		}

		if azureSettings.WorkloadIdentityEnabled {
			envs = append(envs, fmt.Sprintf("%s=true", WorkloadIdentityEnabled))

			if wiSettings := azureSettings.WorkloadIdentitySettings; wiSettings != nil {
				if wiSettings.TenantId != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", WorkloadIdentityTenantID, wiSettings.TenantId))
				}
				if wiSettings.ClientId != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", WorkloadIdentityClientID, wiSettings.ClientId))
				}
				if wiSettings.TokenFile != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", WorkloadIdentityTokenFile, wiSettings.TokenFile))
				}
			}
		}

		if azureSettings.UserIdentityEnabled {
			envs = append(envs, fmt.Sprintf("%s=true", UserIdentityEnabled))
			envs = append(envs, fmt.Sprintf("%s=%t", UserIdentityFallbackCredentialsEnabled, azureSettings.UserIdentityFallbackCredentialsEnabled))

			if tokenEndpoint := azureSettings.UserIdentityTokenEndpoint; tokenEndpoint != nil {
				if tokenEndpoint.TokenUrl != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", UserIdentityTokenURL, tokenEndpoint.TokenUrl))
				}
				if tokenEndpoint.ClientAuthentication != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", UserIdentityClientAuthentication, tokenEndpoint.ClientAuthentication))
				}
				if tokenEndpoint.ClientId != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", UserIdentityClientID, tokenEndpoint.ClientId))
				}
				if tokenEndpoint.ClientSecret != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", UserIdentityClientSecret, tokenEndpoint.ClientSecret))
				}
				if tokenEndpoint.ManagedIdentityClientId != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", UserIdentityManagedIdentityClientID, tokenEndpoint.ManagedIdentityClientId))
				}
				if tokenEndpoint.FederatedCredentialAudience != "" {
					envs = append(envs, fmt.Sprintf("%s=%s", UserIdentityFederatedCredentialAudience, tokenEndpoint.FederatedCredentialAudience))
				}
				if tokenEndpoint.UsernameAssertion {
					envs = append(envs, fmt.Sprintf("%s=username", UserIdentityAssertion))
				}
			}
		}
	}

	return envs
}
