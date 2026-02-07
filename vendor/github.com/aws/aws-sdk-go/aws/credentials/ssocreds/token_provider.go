package ssocreds

import (
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/auth/bearer"
	"github.com/aws/aws-sdk-go/service/ssooidc"
)

// CreateTokenAPIClient provides the interface for the SSOTokenProvider's API
// client for calling CreateToken operation to refresh the SSO token.
type CreateTokenAPIClient interface {
	CreateToken(input *ssooidc.CreateTokenInput) (*ssooidc.CreateTokenOutput, error)
}

// SSOTokenProviderOptions provides the options for configuring the
// SSOTokenProvider.
type SSOTokenProviderOptions struct {
	// Client that can be overridden
	Client CreateTokenAPIClient

	// The path the file containing the cached SSO token will be read from.
	// Initialized the NewSSOTokenProvider's cachedTokenFilepath parameter.
	CachedTokenFilepath string
}

// SSOTokenProvider provides a utility for refreshing SSO AccessTokens for
// Bearer Authentication. The SSOTokenProvider can only be used to refresh
// already cached SSO Tokens. This utility cannot perform the initial SSO
// create token.
//
// The initial SSO create token should be preformed with the AWS CLI before the
// Go application using the SSOTokenProvider will need to retrieve the SSO
// token. If the AWS CLI has not created the token cache file, this provider
// will return an error when attempting to retrieve the cached token.
//
// This provider will attempt to refresh the cached SSO token periodically if
// needed when RetrieveBearerToken is called.
//
// A utility such as the AWS CLI must be used to initially create the SSO
// session and cached token file.
// https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html
type SSOTokenProvider struct {
	options SSOTokenProviderOptions
}

// NewSSOTokenProvider returns an initialized SSOTokenProvider that will
// periodically refresh the SSO token cached stored in the cachedTokenFilepath.
// The cachedTokenFilepath file's content will be rewritten by the token
// provider when the token is refreshed.
//
// The client must be configured for the AWS region the SSO token was created for.
func NewSSOTokenProvider(client CreateTokenAPIClient, cachedTokenFilepath string, optFns ...func(o *SSOTokenProviderOptions)) *SSOTokenProvider {
	options := SSOTokenProviderOptions{
		Client:              client,
		CachedTokenFilepath: cachedTokenFilepath,
	}
	for _, fn := range optFns {
		fn(&options)
	}

	provider := &SSOTokenProvider{
		options: options,
	}

	return provider
}

// RetrieveBearerToken returns the SSO token stored in the cachedTokenFilepath
// the SSOTokenProvider was created with. If the token has expired
// RetrieveBearerToken will attempt to refresh it. If the token cannot be
// refreshed or is not present an error will be returned.
//
// A utility such as the AWS CLI must be used to initially create the SSO
// session and cached token file. https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html
func (p *SSOTokenProvider) RetrieveBearerToken(ctx aws.Context) (bearer.Token, error) {
	cachedToken, err := loadCachedToken(p.options.CachedTokenFilepath)
	if err != nil {
		return bearer.Token{}, err
	}

	if cachedToken.ExpiresAt != nil && nowTime().After(time.Time(*cachedToken.ExpiresAt)) {
		cachedToken, err = p.refreshToken(cachedToken)
		if err != nil {
			return bearer.Token{}, fmt.Errorf("refresh cached SSO token failed, %v", err)
		}
	}

	expiresAt := toTime((*time.Time)(cachedToken.ExpiresAt))
	return bearer.Token{
		Value:     cachedToken.AccessToken,
		CanExpire: !expiresAt.IsZero(),
		Expires:   expiresAt,
	}, nil
}

func (p *SSOTokenProvider) refreshToken(token cachedToken) (cachedToken, error) {
	if token.ClientSecret == "" || token.ClientID == "" || token.RefreshToken == "" {
		return cachedToken{}, fmt.Errorf("cached SSO token is expired, or not present, and cannot be refreshed")
	}

	createResult, err := p.options.Client.CreateToken(&ssooidc.CreateTokenInput{
		ClientId:     &token.ClientID,
		ClientSecret: &token.ClientSecret,
		RefreshToken: &token.RefreshToken,
		GrantType:    aws.String("refresh_token"),
	})
	if err != nil {
		return cachedToken{}, fmt.Errorf("unable to refresh SSO token, %v", err)
	}
	if createResult.ExpiresIn == nil {
		return cachedToken{}, fmt.Errorf("missing required field ExpiresIn")
	}
	if createResult.AccessToken == nil {
		return cachedToken{}, fmt.Errorf("missing required field AccessToken")
	}
	if createResult.RefreshToken == nil {
		return cachedToken{}, fmt.Errorf("missing required field RefreshToken")
	}

	expiresAt := nowTime().Add(time.Duration(*createResult.ExpiresIn) * time.Second)

	token.AccessToken = *createResult.AccessToken
	token.ExpiresAt = (*rfc3339)(&expiresAt)
	token.RefreshToken = *createResult.RefreshToken

	fileInfo, err := os.Stat(p.options.CachedTokenFilepath)
	if err != nil {
		return cachedToken{}, fmt.Errorf("failed to stat cached SSO token file %v", err)
	}

	if err = storeCachedToken(p.options.CachedTokenFilepath, token, fileInfo.Mode()); err != nil {
		return cachedToken{}, fmt.Errorf("unable to cache refreshed SSO token, %v", err)
	}

	return token, nil
}

func toTime(p *time.Time) (v time.Time) {
	if p == nil {
		return v
	}

	return *p
}
