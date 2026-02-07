// Package logincreds implements AWS credential provision for sessions created
// via an `aws login` command.
package logincreds

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/aws-sdk-go-v2/service/signin"
	"github.com/aws/aws-sdk-go-v2/service/signin/types"
)

// ProviderName identifies the login provider.
const ProviderName = "LoginProvider"

// TokenAPIClient provides the interface for the login session's token
// retrieval operation.
type TokenAPIClient interface {
	CreateOAuth2Token(context.Context, *signin.CreateOAuth2TokenInput, ...func(*signin.Options)) (*signin.CreateOAuth2TokenOutput, error)
}

// Provider supplies credentials for an `aws login` session.
type Provider struct {
	options Options
}

var _ aws.CredentialsProvider = (*Provider)(nil)

// Options configures the Provider.
type Options struct {
	Client TokenAPIClient

	// APIOptions to pass to the underlying CreateOAuth2Token operation.
	ClientOptions []func(*signin.Options)

	// The path to the cached login token.
	CachedTokenFilepath string

	// The chain of providers that was used to create this provider.
	//
	// These values are for reporting purposes and are not meant to be set up
	// directly.
	CredentialSources []aws.CredentialSource
}

// New returns a new login session credentials provider.
func New(client TokenAPIClient, path string, opts ...func(*Options)) *Provider {
	options := Options{
		Client:              client,
		CachedTokenFilepath: path,
	}

	for _, opt := range opts {
		opt(&options)
	}

	return &Provider{options}
}

// Retrieve generates a new set of temporary credentials using an `aws login`
// session.
func (p *Provider) Retrieve(ctx context.Context) (aws.Credentials, error) {
	token, err := p.loadToken()
	if err != nil {
		return aws.Credentials{}, fmt.Errorf("load login token: %w", err)
	}
	if err := token.Validate(); err != nil {
		return aws.Credentials{}, fmt.Errorf("validate login token: %w", err)
	}

	// the token may have been refreshed elsewhere or the login session might
	// have just been created
	if sdk.NowTime().Before(token.AccessToken.ExpiresAt) {
		return token.Credentials(), nil
	}

	opts := make([]func(*signin.Options), len(p.options.ClientOptions)+1)
	opts[0] = addSignDPOP(token)
	copy(opts[1:], p.options.ClientOptions)

	out, err := p.options.Client.CreateOAuth2Token(ctx, &signin.CreateOAuth2TokenInput{
		TokenInput: &types.CreateOAuth2TokenRequestBody{
			ClientId:     aws.String(token.ClientID),
			GrantType:    aws.String("refresh_token"),
			RefreshToken: aws.String(token.RefreshToken),
		},
	}, opts...)
	if err != nil {
		var terr *types.AccessDeniedException
		if errors.As(err, &terr) {
			err = toAccessDeniedError(terr)
		}
		return aws.Credentials{}, fmt.Errorf("create oauth2 token: %w", err)
	}

	token.Update(out)
	if err := p.saveToken(token); err != nil {
		return aws.Credentials{}, fmt.Errorf("save token: %w", err)
	}

	return token.Credentials(), nil
}

// ProviderSources returns the credential chain that was used to construct this
// provider.
func (p *Provider) ProviderSources() []aws.CredentialSource {
	if p.options.CredentialSources == nil {
		return []aws.CredentialSource{aws.CredentialSourceLogin}
	}
	return p.options.CredentialSources
}

func (p *Provider) loadToken() (*loginToken, error) {
	f, err := openFile(p.options.CachedTokenFilepath)
	if err != nil && os.IsNotExist(err) {
		return nil, fmt.Errorf("token file not found, please reauthenticate")
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()

	j, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	var t *loginToken
	if err := json.Unmarshal(j, &t); err != nil {
		return nil, err
	}

	return t, nil
}

func (p *Provider) saveToken(token *loginToken) error {
	j, err := json.Marshal(token)
	if err != nil {
		return err
	}

	f, err := createFile(p.options.CachedTokenFilepath)
	if err != nil {
		return err
	}
	defer f.Close()

	if _, err := f.Write(j); err != nil {
		return err
	}

	return nil
}

func toAccessDeniedError(err *types.AccessDeniedException) error {
	switch err.Error_ {
	case types.OAuth2ErrorCodeTokenExpired:
		return fmt.Errorf("login session has expired, please reauthenticate")
	case types.OAuth2ErrorCodeUserCredentialsChanged:
		return fmt.Errorf("login session password has changed, please reauthenticate")
	case types.OAuth2ErrorCodeInsufficientPermissions:
		return fmt.Errorf("insufficient permissions, you may be missing permissions for the CreateOAuth2Token action")
	default:
		return err
	}
}
