package aztokenprovider

import (
	"context"
	"fmt"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
)

type managedIdentityTokenRetriever struct {
	clientId   string
	credential azcore.TokenCredential
}

func getManagedIdentityTokenRetriever(settings *azsettings.AzureSettings, credentials *azcredentials.AzureManagedIdentityCredentials) TokenRetriever {
	var clientId string
	if credentials.ClientId != "" {
		clientId = credentials.ClientId
	} else {
		clientId = settings.ManagedIdentityClientId
	}
	return &managedIdentityTokenRetriever{
		clientId: clientId,
	}
}

func (c *managedIdentityTokenRetriever) GetCacheKey(grafanaMultiTenantId string) string {
	clientId := c.clientId
	if clientId == "" {
		clientId = "system"
	}
	return fmt.Sprintf("azure|msi|%s|%s", clientId, grafanaMultiTenantId)
}

func (c *managedIdentityTokenRetriever) Init() error {
	options := &azidentity.ManagedIdentityCredentialOptions{}
	if c.clientId != "" {
		options.ID = azidentity.ClientID(c.clientId)
	}
	credential, err := azidentity.NewManagedIdentityCredential(options)
	if err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *managedIdentityTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := c.credential.GetToken(ctx, policy.TokenRequestOptions{Scopes: scopes})
	if err != nil {
		return nil, err
	}

	return &AccessToken{Token: accessToken.Token, ExpiresOn: accessToken.ExpiresOn}, nil
}

// Empty implementation
func (c *managedIdentityTokenRetriever) GetExpiry() *time.Time {
	return nil
}
