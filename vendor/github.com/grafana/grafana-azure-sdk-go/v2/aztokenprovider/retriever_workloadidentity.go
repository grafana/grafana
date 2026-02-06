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

type workloadIdentityTokenRetriever struct {
	tenantId   string
	clientId   string
	tokenFile  string
	credential azcore.TokenCredential
}

func getWorkloadIdentityTokenRetriever(settings *azsettings.AzureSettings, credentials *azcredentials.AzureWorkloadIdentityCredentials) TokenRetriever {
	tenantId := ""
	clientId := ""
	tokenFile := ""

	if wiSettings := settings.WorkloadIdentitySettings; wiSettings != nil {
		tenantId = wiSettings.TenantId
		clientId = wiSettings.ClientId
		tokenFile = wiSettings.TokenFile
	}

	if credentials != nil {
		if credentials.TenantId != "" {
			tenantId = credentials.TenantId
		}
		if credentials.ClientId != "" {
			clientId = credentials.ClientId
		}
	}

	return &workloadIdentityTokenRetriever{
		tenantId:  tenantId,
		clientId:  clientId,
		tokenFile: tokenFile,
	}
}

func (c *workloadIdentityTokenRetriever) GetCacheKey(grafanaMultiTenantId string) string {
	tenantId := c.tenantId
	if tenantId == "" {
		tenantId = "default"
	}
	clientId := c.clientId
	if clientId == "" {
		clientId = "default"
	}

	return fmt.Sprintf("azure|wi|%s|%s|%s", tenantId, clientId, grafanaMultiTenantId)
}

func (c *workloadIdentityTokenRetriever) Init() error {
	options := &azidentity.WorkloadIdentityCredentialOptions{}
	if c.tenantId != "" {
		options.TenantID = c.tenantId
	}
	if c.clientId != "" {
		options.ClientID = c.clientId
	}
	if c.tokenFile != "" {
		options.TokenFilePath = c.tokenFile
	}

	credential, err := azidentity.NewWorkloadIdentityCredential(options)
	if err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *workloadIdentityTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := c.credential.GetToken(ctx, policy.TokenRequestOptions{Scopes: scopes})
	if err != nil {
		return nil, err
	}

	return &AccessToken{Token: accessToken.Token, ExpiresOn: accessToken.ExpiresOn}, nil
}

// Empty implementation
func (c *workloadIdentityTokenRetriever) GetExpiry() *time.Time {
	return nil
}
