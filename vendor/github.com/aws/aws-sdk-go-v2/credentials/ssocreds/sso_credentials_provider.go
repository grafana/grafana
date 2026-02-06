package ssocreds

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/aws-sdk-go-v2/service/sso"
)

// ProviderName is the name of the provider used to specify the source of
// credentials.
const ProviderName = "SSOProvider"

// GetRoleCredentialsAPIClient is a API client that implements the
// GetRoleCredentials operation.
type GetRoleCredentialsAPIClient interface {
	GetRoleCredentials(context.Context, *sso.GetRoleCredentialsInput, ...func(*sso.Options)) (
		*sso.GetRoleCredentialsOutput, error,
	)
}

// Options is the Provider options structure.
type Options struct {
	// The Client which is configured for the AWS Region where the AWS SSO user
	// portal is located.
	Client GetRoleCredentialsAPIClient

	// The AWS account that is assigned to the user.
	AccountID string

	// The role name that is assigned to the user.
	RoleName string

	// The URL that points to the organization's AWS Single Sign-On (AWS SSO)
	// user portal.
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
	SSOTokenProvider *SSOTokenProvider

	// The chain of providers that was used to create this provider.
	// These values are for reporting purposes and are not meant to be set up directly
	CredentialSources []aws.CredentialSource
}

// Provider is an AWS credential provider that retrieves temporary AWS
// credentials by exchanging an SSO login token.
type Provider struct {
	options Options

	cachedTokenFilepath string
}

// New returns a new AWS Single Sign-On (AWS SSO) credential provider. The
// provided client is expected to be configured for the AWS Region where the
// AWS SSO user portal is located.
func New(client GetRoleCredentialsAPIClient, accountID, roleName, startURL string, optFns ...func(options *Options)) *Provider {
	options := Options{
		Client:    client,
		AccountID: accountID,
		RoleName:  roleName,
		StartURL:  startURL,
	}

	for _, fn := range optFns {
		fn(&options)
	}

	return &Provider{
		options:             options,
		cachedTokenFilepath: options.CachedTokenFilepath,
	}
}

// Retrieve retrieves temporary AWS credentials from the configured Amazon
// Single Sign-On (AWS SSO) user portal by exchanging the accessToken present
// in ~/.aws/sso/cache. However, if a token provider configuration exists
// in the shared config, then we ought to use the token provider rather then
// direct access on the cached token.
func (p *Provider) Retrieve(ctx context.Context) (aws.Credentials, error) {
	var accessToken *string
	if p.options.SSOTokenProvider != nil {
		token, err := p.options.SSOTokenProvider.RetrieveBearerToken(ctx)
		if err != nil {
			return aws.Credentials{}, err
		}
		accessToken = &token.Value
	} else {
		if p.cachedTokenFilepath == "" {
			cachedTokenFilepath, err := StandardCachedTokenFilepath(p.options.StartURL)
			if err != nil {
				return aws.Credentials{}, &InvalidTokenError{Err: err}
			}
			p.cachedTokenFilepath = cachedTokenFilepath
		}

		tokenFile, err := loadCachedToken(p.cachedTokenFilepath)
		if err != nil {
			return aws.Credentials{}, &InvalidTokenError{Err: err}
		}

		if tokenFile.ExpiresAt == nil || sdk.NowTime().After(time.Time(*tokenFile.ExpiresAt)) {
			return aws.Credentials{}, &InvalidTokenError{}
		}
		accessToken = &tokenFile.AccessToken
	}

	output, err := p.options.Client.GetRoleCredentials(ctx, &sso.GetRoleCredentialsInput{
		AccessToken: accessToken,
		AccountId:   &p.options.AccountID,
		RoleName:    &p.options.RoleName,
	})
	if err != nil {
		return aws.Credentials{}, err
	}

	return aws.Credentials{
		AccessKeyID:     aws.ToString(output.RoleCredentials.AccessKeyId),
		SecretAccessKey: aws.ToString(output.RoleCredentials.SecretAccessKey),
		SessionToken:    aws.ToString(output.RoleCredentials.SessionToken),
		CanExpire:       true,
		Expires:         time.Unix(0, output.RoleCredentials.Expiration*int64(time.Millisecond)).UTC(),
		Source:          ProviderName,
		AccountID:       p.options.AccountID,
	}, nil
}

// ProviderSources returns the credential chain that was used to construct this provider
func (p *Provider) ProviderSources() []aws.CredentialSource {
	if p.options.CredentialSources == nil {
		return []aws.CredentialSource{aws.CredentialSourceSSO}
	}
	return p.options.CredentialSources
}

// InvalidTokenError is the error type that is returned if loaded token has
// expired or is otherwise invalid. To refresh the SSO session run AWS SSO
// login with the corresponding profile.
type InvalidTokenError struct {
	Err error
}

func (i *InvalidTokenError) Unwrap() error {
	return i.Err
}

func (i *InvalidTokenError) Error() string {
	const msg = "the SSO session has expired or is invalid"
	if i.Err == nil {
		return msg
	}
	return msg + ": " + i.Err.Error()
}
