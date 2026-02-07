package ssocreds

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/aws-sdk-go-v2/service/ssooidc"
	"github.com/aws/smithy-go/auth/bearer"
)

// CreateTokenAPIClient provides the interface for the SSOTokenProvider's API
// client for calling CreateToken operation to refresh the SSO token.
type CreateTokenAPIClient interface {
	CreateToken(context.Context, *ssooidc.CreateTokenInput, ...func(*ssooidc.Options)) (
		*ssooidc.CreateTokenOutput, error,
	)
}

// SSOTokenProviderOptions provides the options for configuring the
// SSOTokenProvider.
type SSOTokenProviderOptions struct {
	// Client that can be overridden
	Client CreateTokenAPIClient

	// The set of API Client options to be applied when invoking the
	// CreateToken operation.
	ClientOptions []func(*ssooidc.Options)

	// The path the file containing the cached SSO token will be read from.
	// Initialized the NewSSOTokenProvider's cachedTokenFilepath parameter.
	CachedTokenFilepath string
}

// SSOTokenProvider provides an utility for refreshing SSO AccessTokens for
// Bearer Authentication. The SSOTokenProvider can only be used to refresh
// already cached SSO Tokens. This utility cannot perform the initial SSO
// create token.
//
// The SSOTokenProvider is not safe to use concurrently. It must be wrapped in
// a utility such as smithy-go's auth/bearer#TokenCache. The SDK's
// config.LoadDefaultConfig will automatically wrap the SSOTokenProvider with
// the smithy-go TokenCache, if the external configuration loaded configured
// for an SSO session.
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

var _ bearer.TokenProvider = (*SSOTokenProvider)(nil)

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
func (p SSOTokenProvider) RetrieveBearerToken(ctx context.Context) (bearer.Token, error) {
	cachedToken, err := loadCachedToken(p.options.CachedTokenFilepath)
	if err != nil {
		return bearer.Token{}, err
	}

	if cachedToken.ExpiresAt != nil && sdk.NowTime().After(time.Time(*cachedToken.ExpiresAt)) {
		cachedToken, err = p.refreshToken(ctx, cachedToken)
		if err != nil {
			return bearer.Token{}, fmt.Errorf("refresh cached SSO token failed, %w", err)
		}
	}

	expiresAt := aws.ToTime((*time.Time)(cachedToken.ExpiresAt))
	return bearer.Token{
		Value:     cachedToken.AccessToken,
		CanExpire: !expiresAt.IsZero(),
		Expires:   expiresAt,
	}, nil
}

func (p SSOTokenProvider) refreshToken(ctx context.Context, cachedToken token) (token, error) {
	if cachedToken.ClientSecret == "" || cachedToken.ClientID == "" || cachedToken.RefreshToken == "" {
		return token{}, fmt.Errorf("cached SSO token is expired, or not present, and cannot be refreshed")
	}

	createResult, err := p.options.Client.CreateToken(ctx, &ssooidc.CreateTokenInput{
		ClientId:     &cachedToken.ClientID,
		ClientSecret: &cachedToken.ClientSecret,
		RefreshToken: &cachedToken.RefreshToken,
		GrantType:    aws.String("refresh_token"),
	}, p.options.ClientOptions...)
	if err != nil {
		return token{}, fmt.Errorf("unable to refresh SSO token, %w", err)
	}

	expiresAt := sdk.NowTime().Add(time.Duration(createResult.ExpiresIn) * time.Second)

	cachedToken.AccessToken = aws.ToString(createResult.AccessToken)
	cachedToken.ExpiresAt = (*rfc3339)(&expiresAt)
	cachedToken.RefreshToken = aws.ToString(createResult.RefreshToken)

	fileInfo, err := os.Stat(p.options.CachedTokenFilepath)
	if err != nil {
		return token{}, fmt.Errorf("failed to stat cached SSO token file %w", err)
	}

	if err = storeCachedToken(p.options.CachedTokenFilepath, cachedToken, fileInfo.Mode()); err != nil {
		return token{}, fmt.Errorf("unable to cache refreshed SSO token, %w", err)
	}

	return cachedToken, nil
}
