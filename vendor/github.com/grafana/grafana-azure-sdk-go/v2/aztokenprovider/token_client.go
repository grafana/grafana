package aztokenprovider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/grafana/grafana-azure-sdk-go/v2/azusercontext"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type TokenClient interface {
	FromClientSecret(ctx context.Context, scopes []string) (*AccessToken, error)
	FromRefreshToken(ctx context.Context, refreshToken string, scopes []string) (*AccessToken, error)
	OnBehalfOf(ctx context.Context, idToken string, scopes []string) (*AccessToken, error)
	FromUsername(ctx context.Context, username string, scopes []string) (*AccessToken, error)
}

type tokenClientImpl struct {
	httpClient                  *http.Client
	endpointUrl                 string
	clientAuthentication        string
	clientId                    string
	clientSecret                string
	managedIdentityClientId     string
	federatedCredentialAudience string
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	ExtExpiresIn int64  `json:"ext_expires_in"`
	Scope        string `json:"scope"`
}

// List of supported client authentication methods for token requests
const (
	ClientSecret    = "client_secret_post"
	ManagedIdentity = "managed_identity"
)

// List of supported audiences in Azure
var supportedFederatedCredentialAudiences = []string{
	"api://AzureADTokenExchange",      // Public
	"api://AzureADTokenExchangeUSGov", // US Gov
	"api://AzureADTokenExchangeChina", // Mooncake
	"api://AzureADTokenExchangeUSNat", // USNat
	"api://AzureADTokenExchangeUSSec", // USSec
}

func NewTokenClient(endpointUrl string, clientAuthentication string, clientId string, clientSecret string, managedIdentityClientId string, federatedCredentialAudience string, httpClient *http.Client) (TokenClient, error) {
	return &tokenClientImpl{
		httpClient:                  httpClient,
		endpointUrl:                 endpointUrl,
		clientAuthentication:        clientAuthentication,
		clientId:                    clientId,
		clientSecret:                clientSecret,
		managedIdentityClientId:     managedIdentityClientId,
		federatedCredentialAudience: federatedCredentialAudience,
	}, nil
}

func (c *tokenClientImpl) FromClientSecret(ctx context.Context, scopes []string) (*AccessToken, error) {
	queryParams := url.Values{}
	queryParams.Set("grant_type", "client_credentials")

	accessToken, err := c.requestToken(ctx, queryParams, scopes)
	if err != nil {
		return nil, err
	}

	return accessToken, nil
}

func (c *tokenClientImpl) FromRefreshToken(ctx context.Context, refreshToken string, scopes []string) (*AccessToken, error) {
	queryParams := url.Values{}
	queryParams.Set("grant_type", "refresh_token")
	queryParams.Set("refresh_token", refreshToken)

	accessToken, err := c.requestToken(ctx, queryParams, scopes)
	if err != nil {
		return nil, err
	}

	return accessToken, nil
}

func (c *tokenClientImpl) OnBehalfOf(ctx context.Context, idToken string, scopes []string) (*AccessToken, error) {
	queryParams := url.Values{}
	queryParams.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	queryParams.Set("assertion", idToken)
	queryParams.Set("requested_token_use", "on_behalf_of")

	accessToken, err := c.requestToken(ctx, queryParams, scopes)
	if err != nil {
		return nil, err
	}

	return accessToken, nil
}

func (c *tokenClientImpl) FromUsername(ctx context.Context, username string, scopes []string) (*AccessToken, error) {
	queryParams := url.Values{}
	queryParams.Set("grant_type", "username")
	queryParams.Set("username", username)

	accessToken, err := c.requestToken(ctx, queryParams, scopes)
	if err != nil {
		return nil, err
	}

	return accessToken, nil
}

func (c *tokenClientImpl) requestToken(ctx context.Context, queryParams url.Values, scopes []string) (*AccessToken, error) {
	queryParams.Set("client_id", c.clientId)

	switch c.clientAuthentication {
	case ClientSecret:
		queryParams.Set("client_secret", c.clientSecret)

	case ManagedIdentity:
		// get client assertion and add it to the request
		clientAssertion, err := c.managedIdentityCallback(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get client assertion: %w", err)
		}

		queryParams.Set("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer")
		queryParams.Set("client_assertion", clientAssertion)

	default:
		return nil, fmt.Errorf("unsupported client authentication method '%s'", c.clientAuthentication)
	}

	addScopeQueryParam(queryParams, scopes)

	result := &tokenResponse{}
	err := requestUrlForm(ctx, c.httpClient, c.endpointUrl, queryParams, result)
	if err != nil {
		return nil, fmt.Errorf("failed to request token: %w", err)
	}

	accessToken, err := parseAccessToken(result)
	if err != nil {
		return nil, fmt.Errorf("failed to request token: %w", err)
	}

	return accessToken, nil
}

// retrieves a token using the managed identity credential of the Azure service.
func (c *tokenClientImpl) managedIdentityCallback(ctx context.Context) (string, error) {
	// Validate required fields for Managed Identity authentication
	if c.managedIdentityClientId == "" {
		return "", fmt.Errorf("ManagedIdentityClientID is required for Managed Identity authentication")
	}
	if c.federatedCredentialAudience == "" {
		return "", fmt.Errorf("FederatedCredentialAudience is required for Managed Identity authentication")
	}
	if err := validateFederatedCredentialAudience(c.federatedCredentialAudience); err != nil {
		return "", err
	}

	// Prepare Managed Identity Credential
	mic, err := azidentity.NewManagedIdentityCredential(&azidentity.ManagedIdentityCredentialOptions{
		ID: azidentity.ClientID(c.managedIdentityClientId),
	})
	if err != nil {
		return "", fmt.Errorf("error constructing managed identity credential: %w", err)
	}

	// Request token and return
	tk, err := mic.GetToken(ctx, policy.TokenRequestOptions{
		Scopes: []string{fmt.Sprintf("%s/.default", c.federatedCredentialAudience)},
	})
	if err != nil {
		return "", fmt.Errorf("error getting managed identity token: %w", err)
	}

	return tk.Token, nil
}

func addScopeQueryParam(queryParams url.Values, scopes []string) {
	scopesSanitized := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		s := strings.TrimSpace(scope)
		if s == "" {
			continue
		}
		scopesSanitized = append(scopesSanitized, scope)
	}
	queryParams.Set("scope", strings.Join(scopesSanitized, " "))
}

func parseAccessToken(result *tokenResponse) (*AccessToken, error) {
	if result.AccessToken == "" {
		return nil, errors.New("token response doesn't contain 'access_token' field")
	}

	var expiresOn = time.Time{}
	if result.ExpiresIn > 0 {
		expiresOn = time.Now().UTC().Add(time.Duration(result.ExpiresIn) * time.Second)
	}

	return &AccessToken{
		Token:     result.AccessToken,
		ExpiresOn: expiresOn,
	}, nil
}

func requestUrlForm(ctx context.Context, httpClient *http.Client, requestUrl string, queryParams url.Values, result interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestUrl, strings.NewReader(queryParams.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
	req.Header.Set("Accept", "application/json")

	req.Header.Set("X-Client-SKU", "github.com/grafana/grafana-azure-sdk-go/v2")
	req.Header.Set("X-Client-Ver", "2.0")

	// Attempt to get user context and forward cookies if available
	if currentUser, ok := azusercontext.GetCurrentUser(ctx); ok {
		if currentUser.Cookies != "" {
			// Validate that cookies don't contain newlines which could break HTTP headers
			sanitizedCookies := strings.ReplaceAll(currentUser.Cookies, "\n", "")
			sanitizedCookies = strings.ReplaceAll(sanitizedCookies, "\r", "")

			if sanitizedCookies != "" {
				req.Header.Add("Cookie", sanitizedCookies)
			}
		}
	} else {
		backend.Logger.Debug("No user context available; cookies will not be forwarded")
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}

	defer func(body io.ReadCloser) {
		err := body.Close()
		if err != nil {
			backend.Logger.Debug("failed to close response: %w", err)
		}
	}(resp.Body)

	contentType, _, err := getContentType(resp)
	if err != nil {
		return err
	}

	if resp.StatusCode != http.StatusOK {
		var bodyString string

		if contentType == "application/json" {
			bodyBytes, err := io.ReadAll(resp.Body)
			if err == nil {
				// TODO: Parse error details from the response body
				bodyString = string(bodyBytes)
			}
		}

		var errorMessage strings.Builder
		_, err = fmt.Fprintf(&errorMessage, "request failed with status %s", resp.Status)
		if err != nil {
			return err
		}

		if bodyString != "" {
			_, err = fmt.Fprintf(&errorMessage, ", body %s", bodyString)
			if err != nil {
				return err
			}
		}

		return errors.New(errorMessage.String())
	}

	if contentType != "application/json" {
		return fmt.Errorf("invalid response content-type '%s'", contentType)
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("unable to read response: %w", err)
	}

	return nil
}

func getContentType(resp *http.Response) (string, string, error) {
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		return "", "", nil
	}

	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return "", "", fmt.Errorf("invalid response content-type: %w", err)
	}

	charset := params["charset"]

	return mediaType, charset, nil
}

func validateFederatedCredentialAudience(federatedCredentialAudience string) error {
	for _, supportedFederatedCredentialAudience := range supportedFederatedCredentialAudiences {
		if federatedCredentialAudience == supportedFederatedCredentialAudience {
			return nil
		}
	}
	return fmt.Errorf("federated credential audience %s is not supported", federatedCredentialAudience)
}
