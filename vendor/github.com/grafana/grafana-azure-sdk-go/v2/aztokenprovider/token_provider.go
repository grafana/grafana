package aztokenprovider

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/golang-jwt/jwt/v5"
	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-azure-sdk-go/v2/azusercontext"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	azureTokenCache = NewConcurrentTokenCache()
)

type AzureTokenProvider interface {
	GetAccessToken(ctx context.Context, scopes []string) (string, error)
}

func NewAzureAccessTokenProvider(settings *azsettings.AzureSettings, credentials azcredentials.AzureCredentials,
	userIdentitySupported bool) (AzureTokenProvider, error) {
	var err error

	if settings == nil {
		err = fmt.Errorf("parameter 'settings' cannot be nil")
		return nil, err
	}
	if credentials == nil {
		err = fmt.Errorf("parameter 'credentials' cannot be nil")
		return nil, err
	}

	switch c := credentials.(type) {
	case *azcredentials.AzureManagedIdentityCredentials:
		if !settings.ManagedIdentityEnabled {
			err = fmt.Errorf("managed identity authentication is not enabled in Grafana config")
			return nil, err
		}
		tokenRetriever := getManagedIdentityTokenRetriever(settings, c)
		return &serviceTokenProvider{
			tokenCache:     azureTokenCache,
			tokenRetriever: tokenRetriever,
		}, nil
	case *azcredentials.AzureWorkloadIdentityCredentials:
		if !settings.WorkloadIdentityEnabled {
			err = fmt.Errorf("workload identity authentication is not enabled in Grafana config")
			return nil, err
		}
		tokenRetriever := getWorkloadIdentityTokenRetriever(settings, c)
		return &serviceTokenProvider{
			tokenCache:     azureTokenCache,
			tokenRetriever: tokenRetriever,
		}, nil
	case *azcredentials.AzureClientSecretCredentials:
		tokenRetriever, err := getClientSecretTokenRetriever(settings, c)
		if err != nil {
			return nil, err
		}
		return &serviceTokenProvider{
			tokenCache:     azureTokenCache,
			tokenRetriever: tokenRetriever,
		}, nil
	case *azcredentials.AadCurrentUserCredentials:
		if !userIdentitySupported {
			err = fmt.Errorf("user identity authentication is not supported by this datasource")
			return nil, err
		}
		if !settings.UserIdentityEnabled {
			err = fmt.Errorf("user identity authentication is not enabled in Grafana config")
			return nil, err
		}

		var tokenRetriever TokenRetriever

		if c.ServiceCredentialsEnabled && c.ServiceCredentials != nil && settings.UserIdentityFallbackCredentialsEnabled {
			fallbackType := c.ServiceCredentials.AzureAuthType()
			if fallbackType == azcredentials.AzureAuthCurrentUserIdentity || fallbackType == azcredentials.AzureAuthClientSecretObo {
				return nil, fmt.Errorf("user identity authentication not valid for fallback credentials")
			}
			switch c.ServiceCredentials.(type) {
			case *azcredentials.AzureClientSecretCredentials:
				tokenRetriever, err = getClientSecretTokenRetriever(settings, c.ServiceCredentials.(*azcredentials.AzureClientSecretCredentials))
				if err != nil {
					return nil, err
				}
			case *azcredentials.AzureManagedIdentityCredentials:
				tokenRetriever = getManagedIdentityTokenRetriever(settings, c.ServiceCredentials.(*azcredentials.AzureManagedIdentityCredentials))
			case *azcredentials.AzureWorkloadIdentityCredentials:
				tokenRetriever = getWorkloadIdentityTokenRetriever(settings, c.ServiceCredentials.(*azcredentials.AzureWorkloadIdentityCredentials))

			}
		}
		tokenEndpoint := settings.UserIdentityTokenEndpoint
		client, err := NewTokenClient(tokenEndpoint.TokenUrl, tokenEndpoint.ClientAuthentication, tokenEndpoint.ClientId, tokenEndpoint.ClientSecret, tokenEndpoint.ManagedIdentityClientId, tokenEndpoint.FederatedCredentialAudience, http.DefaultClient)
		if err != nil {
			err = fmt.Errorf("failed to initialize user authentication provider: %w", err)
			return nil, err
		}
		return &userTokenProvider{
			tokenCache:        azureTokenCache,
			client:            client,
			usernameAssertion: tokenEndpoint.UsernameAssertion,
			tokenRetriever:    tokenRetriever,
		}, nil
	default:
		err = fmt.Errorf("credentials of type '%s' not supported by Azure authentication provider", c.AzureAuthType())
		return nil, err
	}
}

type serviceTokenProvider struct {
	tokenCache     ConcurrentTokenCache
	tokenRetriever TokenRetriever
}

func (provider *serviceTokenProvider) GetAccessToken(ctx context.Context, scopes []string) (string, error) {
	if ctx == nil {
		err := fmt.Errorf("parameter 'ctx' cannot be nil")
		return "", err
	}
	if scopes == nil {
		err := fmt.Errorf("parameter 'scopes' cannot be nil")
		return "", err
	}

	accessToken, err := provider.tokenCache.GetAccessToken(ctx, provider.tokenRetriever, scopes)
	if err != nil {
		return "", err
	}
	return accessToken, nil
}

type userTokenProvider struct {
	tokenCache        ConcurrentTokenCache
	client            TokenClient
	usernameAssertion bool
	tokenRetriever    TokenRetriever
}

func isAzureUser(currentUser azusercontext.CurrentUserContext) (azusercontext.CurrentUserContext, error) {
	// This should always be present for logged in users. idForwarding feature toggle must be enabled. By default we return true if there's no ID token available
	if currentUser.GrafanaIdToken != "" {
		claims := jwt.MapClaims{}
		_, _, err := jwt.NewParser(jwt.WithValidMethods([]string{"ES256"})).ParseUnverified(currentUser.GrafanaIdToken, claims)
		if err != nil {
			return currentUser, fmt.Errorf("failed to decode user jwt: %s", err)
		}
		if claims["authenticatedBy"] != "oauth_azuread" && claims["authenticatedBy"] != "authproxy" {
			return currentUser, fmt.Errorf("user is not authenticated with Azure AD")
		}

		return currentUser, nil
	}

	return currentUser, nil
}

func isBackendRequest(currentUser azusercontext.CurrentUserContext, idForwardingEnabled bool) bool {
	// If the User struct is nil or there is no ID token then it's a backend initiated request
	if currentUser.User == nil {
		return true
	}

	// If ID forwarding is enabled we can assume this is backend initiated when empty
	if currentUser.GrafanaIdToken == "" && idForwardingEnabled {
		return true
	}

	return false
}

func (provider *userTokenProvider) GetAccessToken(ctx context.Context, scopes []string) (string, error) {
	if ctx == nil {
		err := fmt.Errorf("parameter 'ctx' cannot be nil")
		return "", err
	}
	if scopes == nil {
		err := fmt.Errorf("parameter 'scopes' cannot be nil")
		return "", err
	}
	settings, err := azsettings.ReadSettings(ctx)
	if err != nil {
		err := fmt.Errorf("error reading azure settings: %s", err)
		return "", err
	}

	currentUser, ok := azusercontext.GetCurrentUser(ctx)
	if !ok {
		return "", fmt.Errorf("user context not configured")
	}

	idForwardingSupported := backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled("idForwarding")
	backendRequest := isBackendRequest(currentUser, idForwardingSupported)

	if backendRequest {
		// Use fallback credentials if this is a backend request and fallback credentials are enabled
		if settings.UserIdentityFallbackCredentialsEnabled && !provider.usernameAssertion {
			if provider.tokenRetriever != nil {
				accessToken, err := provider.tokenCache.GetAccessToken(ctx, provider.tokenRetriever, scopes)
				if err != nil {
					return "", err
				}
				return accessToken, nil
			}
		}

		return "", fmt.Errorf("fallback credentials not enabled")
	}

	azureUser, err := isAzureUser(currentUser)
	if err != nil {
		return "", err
	}

	username, err := extractUsername(azureUser)
	if err != nil {
		err := fmt.Errorf("user identity authentication only possible in context of a Grafana user: %w", err)
		return "", err
	}

	var tokenRetriever TokenRetriever
	if provider.usernameAssertion {
		tokenRetriever = &usernameTokenRetriever{
			client:   provider.client,
			username: username,
		}
	} else {
		idToken := azureUser.IdToken
		if idToken == "" {
			err := fmt.Errorf("user identity authentication not possible because there's no ID token associated with the Grafana user")
			return "", err
		}

		tokenRetriever = &onBehalfOfTokenRetriever{
			client:  provider.client,
			userId:  username,
			idToken: idToken,
		}
	}

	accessToken, err := provider.tokenCache.GetAccessToken(ctx, tokenRetriever, scopes)
	if err != nil {
		err = fmt.Errorf("unable to acquire access token for user '%s': %w", username, err)
		return "", err
	}
	return accessToken, nil
}

func extractUsername(userCtx azusercontext.CurrentUserContext) (string, error) {
	user := userCtx.User
	if user != nil && user.Login != "" {
		return user.Login, nil
	} else {
		return "", errors.New("request not associated with a Grafana user")
	}
}
