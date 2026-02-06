package ssocreds

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"io/ioutil"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/auth/bearer"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/service/sso"
	"github.com/aws/aws-sdk-go/service/sso/ssoiface"
)

// ErrCodeSSOProviderInvalidToken is the code type that is returned if loaded token has expired or is otherwise invalid.
// To refresh the SSO session run aws sso login with the corresponding profile.
const ErrCodeSSOProviderInvalidToken = "SSOProviderInvalidToken"

const invalidTokenMessage = "the SSO session has expired or is invalid"

func init() {
	nowTime = time.Now
	defaultCacheLocation = defaultCacheLocationImpl
}

var nowTime func() time.Time

// ProviderName is the name of the provider used to specify the source of credentials.
const ProviderName = "SSOProvider"

var defaultCacheLocation func() string

func defaultCacheLocationImpl() string {
	return filepath.Join(getHomeDirectory(), ".aws", "sso", "cache")
}

// Provider is an AWS credential provider that retrieves temporary AWS credentials by exchanging an SSO login token.
type Provider struct {
	credentials.Expiry

	// The Client which is configured for the AWS Region where the AWS SSO user portal is located.
	Client ssoiface.SSOAPI

	// The AWS account that is assigned to the user.
	AccountID string

	// The role name that is assigned to the user.
	RoleName string

	// The URL that points to the organization's AWS Single Sign-On (AWS SSO) user portal.
	StartURL string

	// The filepath the cached token will be retrieved from. If unset Provider will
	// use the startURL to determine the filepath at.
	//
	//    ~/.aws/sso/cache/<sha1-hex-encoded-startURL>.json
	//
	// If custom cached token filepath is used, the Provider's startUrl
	// parameter will be ignored.
	CachedTokenFilepath string

	// Used by the SSOCredentialProvider if a token configuration
	// profile is used in the shared config
	TokenProvider bearer.TokenProvider
}

// NewCredentials returns a new AWS Single Sign-On (AWS SSO) credential provider. The ConfigProvider is expected to be configured
// for the AWS Region where the AWS SSO user portal is located.
func NewCredentials(configProvider client.ConfigProvider, accountID, roleName, startURL string, optFns ...func(provider *Provider)) *credentials.Credentials {
	return NewCredentialsWithClient(sso.New(configProvider), accountID, roleName, startURL, optFns...)
}

// NewCredentialsWithClient returns a new AWS Single Sign-On (AWS SSO) credential provider. The provided client is expected to be configured
// for the AWS Region where the AWS SSO user portal is located.
func NewCredentialsWithClient(client ssoiface.SSOAPI, accountID, roleName, startURL string, optFns ...func(provider *Provider)) *credentials.Credentials {
	p := &Provider{
		Client:    client,
		AccountID: accountID,
		RoleName:  roleName,
		StartURL:  startURL,
	}

	for _, fn := range optFns {
		fn(p)
	}

	return credentials.NewCredentials(p)
}

// Retrieve retrieves temporary AWS credentials from the configured Amazon Single Sign-On (AWS SSO) user portal
// by exchanging the accessToken present in ~/.aws/sso/cache.
func (p *Provider) Retrieve() (credentials.Value, error) {
	return p.RetrieveWithContext(aws.BackgroundContext())
}

// RetrieveWithContext retrieves temporary AWS credentials from the configured Amazon Single Sign-On (AWS SSO) user portal
// by exchanging the accessToken present in ~/.aws/sso/cache.
func (p *Provider) RetrieveWithContext(ctx credentials.Context) (credentials.Value, error) {
	var accessToken *string
	if p.TokenProvider != nil {
		token, err := p.TokenProvider.RetrieveBearerToken(ctx)
		if err != nil {
			return credentials.Value{}, err
		}
		accessToken = &token.Value
	} else {
		if p.CachedTokenFilepath == "" {
			cachedTokenFilePath, err := getCachedFilePath(p.StartURL)
			if err != nil {
				return credentials.Value{}, err
			}
			p.CachedTokenFilepath = cachedTokenFilePath
		}

		tokenFile, err := loadTokenFile(p.CachedTokenFilepath)
		if err != nil {
			return credentials.Value{}, err
		}
		accessToken = &tokenFile.AccessToken
	}

	output, err := p.Client.GetRoleCredentialsWithContext(ctx, &sso.GetRoleCredentialsInput{
		AccessToken: accessToken,
		AccountId:   &p.AccountID,
		RoleName:    &p.RoleName,
	})
	if err != nil {
		return credentials.Value{}, err
	}

	expireTime := time.Unix(0, aws.Int64Value(output.RoleCredentials.Expiration)*int64(time.Millisecond)).UTC()
	p.SetExpiration(expireTime, 0)

	return credentials.Value{
		AccessKeyID:     aws.StringValue(output.RoleCredentials.AccessKeyId),
		SecretAccessKey: aws.StringValue(output.RoleCredentials.SecretAccessKey),
		SessionToken:    aws.StringValue(output.RoleCredentials.SessionToken),
		ProviderName:    ProviderName,
	}, nil
}

func getCachedFilePath(startUrl string) (string, error) {
	hash := sha1.New()
	_, err := hash.Write([]byte(startUrl))
	if err != nil {
		return "", err
	}
	return filepath.Join(defaultCacheLocation(), strings.ToLower(hex.EncodeToString(hash.Sum(nil)))+".json"), nil
}

type token struct {
	AccessToken string  `json:"accessToken"`
	ExpiresAt   rfc3339 `json:"expiresAt"`
	Region      string  `json:"region,omitempty"`
	StartURL    string  `json:"startUrl,omitempty"`
}

func (t token) Expired() bool {
	return nowTime().Round(0).After(time.Time(t.ExpiresAt))
}

func loadTokenFile(cachedTokenPath string) (t token, err error) {
	fileBytes, err := ioutil.ReadFile(cachedTokenPath)
	if err != nil {
		return token{}, awserr.New(ErrCodeSSOProviderInvalidToken, invalidTokenMessage, err)
	}

	if err := json.Unmarshal(fileBytes, &t); err != nil {
		return token{}, awserr.New(ErrCodeSSOProviderInvalidToken, invalidTokenMessage, err)
	}

	if len(t.AccessToken) == 0 {
		return token{}, awserr.New(ErrCodeSSOProviderInvalidToken, invalidTokenMessage, nil)
	}

	if t.Expired() {
		return token{}, awserr.New(ErrCodeSSOProviderInvalidToken, invalidTokenMessage, nil)
	}

	return t, nil
}
