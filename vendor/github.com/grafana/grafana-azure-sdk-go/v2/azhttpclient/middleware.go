package azhttpclient

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azhttpclient/internal/azendpoint"
	"github.com/grafana/grafana-azure-sdk-go/v2/aztokenprovider"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const azureMiddlewareName = "AzureAuthentication"

func AzureMiddleware(authOpts *AuthOptions, credentials azcredentials.AzureCredentials) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(azureMiddlewareName, func(clientOpts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		var err error
		var tokenProvider aztokenprovider.AzureTokenProvider = nil
		var sessionProvider *userSessionProvider = nil

		if tokenProviderFactory, ok := authOpts.customProviders[credentials.AzureAuthType()]; ok && tokenProviderFactory != nil {
			tokenProvider, err = tokenProviderFactory(authOpts.settings, credentials)
		} else {
			tokenProvider, err = aztokenprovider.NewAzureAccessTokenProvider(authOpts.settings, credentials, authOpts.userIdentitySupported)
		}
		if err != nil {
			return errorResponse(err)
		}

		if authOpts.rateLimitSession {
			sessionProvider, err = newSessionProvider()
			if err != nil {
				return errorResponse(err)
			}
		}

		if len(authOpts.scopes) == 0 {
			err = errors.New("scopes not configured")
			return errorResponse(err)
		}

		return applyAzureAuth(tokenProvider, sessionProvider, authOpts.scopes, authOpts.endpoints, next)
	})
}

func applyAzureAuth(tokenProvider aztokenprovider.AzureTokenProvider, sessionProvider *userSessionProvider,
	scopes []string, endpoints *azendpoint.EndpointAllowlist, next http.RoundTripper) http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		reqContext := req.Context()

		if endpoints != nil {
			endpoint := azendpoint.Endpoint(*req.URL)
			if !endpoints.IsAllowed(endpoint) {
				return nil, fmt.Errorf("request to endpoint '%s' is not allowed by the datasource", endpoint.String())
			}
		}

		token, err := tokenProvider.GetAccessToken(reqContext, scopes)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve Azure access token: %w", err)
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		if sessionProvider != nil {
			sessionId, err := sessionProvider.GetSessionId(reqContext)
			if err != nil {
				return nil, fmt.Errorf("failed to obtain user session: %w", err)
			} else if sessionId != "" {
				req.Header.Set("x-ms-ratelimit-id", sessionId)
			}
		}

		return next.RoundTrip(req)
	})
}

func errorResponse(err error) http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("invalid Azure configuration: %s", err)
	})
}
