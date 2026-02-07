package aztokenprovider

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
)

type clientSecretTokenRetriever struct {
	cloudConf    cloud.Configuration
	tenantId     string
	clientId     string
	clientSecret string
	credential   azcore.TokenCredential
}

func getClientSecretTokenRetriever(settings *azsettings.AzureSettings, credentials *azcredentials.AzureClientSecretCredentials) (TokenRetriever, error) {
	var authorityHost string

	if credentials.Authority != "" {
		// Use AAD authority endpoint configured in credentials
		authorityHost = credentials.Authority
	} else {
		// Resolve cloud settings for the given cloud name
		cloudSettings, err := settings.GetCloud(credentials.AzureCloud)
		if err != nil {
			return nil, err
		}
		authorityHost = cloudSettings.AadAuthority
	}

	return &clientSecretTokenRetriever{
		cloudConf: cloud.Configuration{
			ActiveDirectoryAuthorityHost: authorityHost,
			Services:                     map[cloud.ServiceName]cloud.ServiceConfiguration{},
		},
		tenantId:     credentials.TenantId,
		clientId:     credentials.ClientId,
		clientSecret: credentials.ClientSecret,
	}, nil
}

func (c *clientSecretTokenRetriever) GetCacheKey(grafanaMultiTenantId string) string {
	return fmt.Sprintf("azure|clientsecret|%s|%s|%s|%s|%s", c.cloudConf.ActiveDirectoryAuthorityHost, c.tenantId, c.clientId, hashSecret(c.clientSecret), grafanaMultiTenantId)
}

func (c *clientSecretTokenRetriever) Init() error {
	options := azidentity.ClientSecretCredentialOptions{}
	options.Cloud = c.cloudConf
	if credential, err := azidentity.NewClientSecretCredential(c.tenantId, c.clientId, c.clientSecret, &options); err != nil {
		return err
	} else {
		c.credential = credential
		return nil
	}
}

func (c *clientSecretTokenRetriever) GetAccessToken(ctx context.Context, scopes []string) (*AccessToken, error) {
	accessToken, err := c.credential.GetToken(ctx, policy.TokenRequestOptions{Scopes: scopes})
	if err != nil {
		return nil, err
	}

	return &AccessToken{Token: accessToken.Token, ExpiresOn: accessToken.ExpiresOn}, nil
}

// Empty implementation
func (c *clientSecretTokenRetriever) GetExpiry() *time.Time {
	return nil
}

func hashSecret(secret string) string {
	hash := sha256.New()
	_, err := hash.Write([]byte(secret))
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%x", hash.Sum(nil))
}
