// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/*
Package public provides a client for authentication of "public" applications. A "public"
application is defined as an app that runs on client devices (android, ios, windows, linux, ...).
These devices are "untrusted" and access resources via web APIs that must authenticate.
*/
package public

/*
Design note:

public.Client uses client.Base as an embedded type. client.Base statically assigns its attributes
during creation. As it doesn't have any pointers in it, anything borrowed from it, such as
Base.AuthParams is a copy that is free to be manipulated here.
*/

// TODO(msal): This should have example code for each method on client using Go's example doc framework.
// base usage details should be includee in the package documentation.

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"strconv"

	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/cache"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/base"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/local"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth/ops"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth/ops/accesstokens"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth/ops/authority"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/options"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/shared"
	"github.com/google/uuid"
	"github.com/pkg/browser"
)

// AuthResult contains the results of one token acquisition operation.
// For details see https://aka.ms/msal-net-authenticationresult
type AuthResult = base.AuthResult

type AuthenticationScheme = authority.AuthenticationScheme

type Account = shared.Account

type TokenSource = base.TokenSource

const (
	TokenSourceIdentityProvider = base.TokenSourceIdentityProvider
	TokenSourceCache            = base.TokenSourceCache
)

var errNoAccount = errors.New("no account was specified with public.WithSilentAccount(), or the specified account is invalid")

// clientOptions configures the Client's behavior.
type clientOptions struct {
	accessor                 cache.ExportReplace
	authority                string
	capabilities             []string
	disableInstanceDiscovery bool
	httpClient               ops.HTTPClient
}

func (p *clientOptions) validate() error {
	u, err := url.Parse(p.authority)
	if err != nil {
		return fmt.Errorf("Authority options cannot be URL parsed: %w", err)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("Authority(%s) did not start with https://", u.String())
	}
	return nil
}

// Option is an optional argument to the New constructor.
type Option func(o *clientOptions)

// WithAuthority allows for a custom authority to be set. This must be a valid https url.
func WithAuthority(authority string) Option {
	return func(o *clientOptions) {
		o.authority = authority
	}
}

// WithCache provides an accessor that will read and write authentication data to an externally managed cache.
func WithCache(accessor cache.ExportReplace) Option {
	return func(o *clientOptions) {
		o.accessor = accessor
	}
}

// WithClientCapabilities allows configuring one or more client capabilities such as "CP1"
func WithClientCapabilities(capabilities []string) Option {
	return func(o *clientOptions) {
		// there's no danger of sharing the slice's underlying memory with the application because
		// this slice is simply passed to base.WithClientCapabilities, which copies its data
		o.capabilities = capabilities
	}
}

// WithHTTPClient allows for a custom HTTP client to be set.
func WithHTTPClient(httpClient ops.HTTPClient) Option {
	return func(o *clientOptions) {
		o.httpClient = httpClient
	}
}

// WithInstanceDiscovery set to false to disable authority validation (to support private cloud scenarios)
func WithInstanceDiscovery(enabled bool) Option {
	return func(o *clientOptions) {
		o.disableInstanceDiscovery = !enabled
	}
}

// Client is a representation of authentication client for public applications as defined in the
// package doc. For more information, visit https://docs.microsoft.com/azure/active-directory/develop/msal-client-applications.
type Client struct {
	base base.Client
}

// New is the constructor for Client.
func New(clientID string, options ...Option) (Client, error) {
	opts := clientOptions{
		authority:  base.AuthorityPublicCloud,
		httpClient: shared.DefaultClient,
	}

	for _, o := range options {
		o(&opts)
	}
	if err := opts.validate(); err != nil {
		return Client{}, err
	}

	base, err := base.New(clientID, opts.authority, oauth.New(opts.httpClient), base.WithCacheAccessor(opts.accessor), base.WithClientCapabilities(opts.capabilities), base.WithInstanceDiscovery(!opts.disableInstanceDiscovery))
	if err != nil {
		return Client{}, err
	}
	return Client{base}, nil
}

// authCodeURLOptions contains options for AuthCodeURL
type authCodeURLOptions struct {
	claims, loginHint, tenantID, domainHint string
}

// AuthCodeURLOption is implemented by options for AuthCodeURL
type AuthCodeURLOption interface {
	authCodeURLOption()
}

// AuthCodeURL creates a URL used to acquire an authorization code.
//
// Options: [WithClaims], [WithDomainHint], [WithLoginHint], [WithTenantID]
func (pca Client) AuthCodeURL(ctx context.Context, clientID, redirectURI string, scopes []string, opts ...AuthCodeURLOption) (string, error) {
	o := authCodeURLOptions{}
	if err := options.ApplyOptions(&o, opts); err != nil {
		return "", err
	}
	ap, err := pca.base.AuthParams.WithTenant(o.tenantID)
	if err != nil {
		return "", err
	}
	ap.Claims = o.claims
	ap.LoginHint = o.loginHint
	ap.DomainHint = o.domainHint
	return pca.base.AuthCodeURL(ctx, clientID, redirectURI, scopes, ap)
}

// WithClaims sets additional claims to request for the token, such as those required by conditional access policies.
// Use this option when Azure AD returned a claims challenge for a prior request. The argument must be decoded.
// This option is valid for any token acquisition method.
func WithClaims(claims string) interface {
	AcquireByAuthCodeOption
	AcquireByDeviceCodeOption
	AcquireByUsernamePasswordOption
	AcquireInteractiveOption
	AcquireSilentOption
	AuthCodeURLOption
	options.CallOption
} {
	return struct {
		AcquireByAuthCodeOption
		AcquireByDeviceCodeOption
		AcquireByUsernamePasswordOption
		AcquireInteractiveOption
		AcquireSilentOption
		AuthCodeURLOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *acquireTokenByAuthCodeOptions:
					t.claims = claims
				case *acquireTokenByDeviceCodeOptions:
					t.claims = claims
				case *acquireTokenByUsernamePasswordOptions:
					t.claims = claims
				case *acquireTokenSilentOptions:
					t.claims = claims
				case *authCodeURLOptions:
					t.claims = claims
				case *interactiveAuthOptions:
					t.claims = claims
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// WithAuthenticationScheme is an extensibility mechanism designed to be used only by Azure Arc for proof of possession access tokens.
func WithAuthenticationScheme(authnScheme AuthenticationScheme) interface {
	AcquireSilentOption
	AcquireInteractiveOption
	AcquireByUsernamePasswordOption
	options.CallOption
} {
	return struct {
		AcquireSilentOption
		AcquireInteractiveOption
		AcquireByUsernamePasswordOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *acquireTokenSilentOptions:
					t.authnScheme = authnScheme
				case *interactiveAuthOptions:
					t.authnScheme = authnScheme
				case *acquireTokenByUsernamePasswordOptions:
					t.authnScheme = authnScheme
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// WithTenantID specifies a tenant for a single authentication. It may be different than the tenant set in [New] by [WithAuthority].
// This option is valid for any token acquisition method.
func WithTenantID(tenantID string) interface {
	AcquireByAuthCodeOption
	AcquireByDeviceCodeOption
	AcquireByUsernamePasswordOption
	AcquireInteractiveOption
	AcquireSilentOption
	AuthCodeURLOption
	options.CallOption
} {
	return struct {
		AcquireByAuthCodeOption
		AcquireByDeviceCodeOption
		AcquireByUsernamePasswordOption
		AcquireInteractiveOption
		AcquireSilentOption
		AuthCodeURLOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *acquireTokenByAuthCodeOptions:
					t.tenantID = tenantID
				case *acquireTokenByDeviceCodeOptions:
					t.tenantID = tenantID
				case *acquireTokenByUsernamePasswordOptions:
					t.tenantID = tenantID
				case *acquireTokenSilentOptions:
					t.tenantID = tenantID
				case *authCodeURLOptions:
					t.tenantID = tenantID
				case *interactiveAuthOptions:
					t.tenantID = tenantID
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// acquireTokenSilentOptions are all the optional settings to an AcquireTokenSilent() call.
// These are set by using various AcquireTokenSilentOption functions.
type acquireTokenSilentOptions struct {
	account          Account
	claims, tenantID string
	authnScheme      AuthenticationScheme
}

// AcquireSilentOption is implemented by options for AcquireTokenSilent
type AcquireSilentOption interface {
	acquireSilentOption()
}

// WithSilentAccount uses the passed account during an AcquireTokenSilent() call.
func WithSilentAccount(account Account) interface {
	AcquireSilentOption
	options.CallOption
} {
	return struct {
		AcquireSilentOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *acquireTokenSilentOptions:
					t.account = account
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// AcquireTokenSilent acquires a token from either the cache or using a refresh token.
//
// Options: [WithClaims], [WithSilentAccount], [WithTenantID]
func (pca Client) AcquireTokenSilent(ctx context.Context, scopes []string, opts ...AcquireSilentOption) (AuthResult, error) {
	o := acquireTokenSilentOptions{}
	if err := options.ApplyOptions(&o, opts); err != nil {
		return AuthResult{}, err
	}
	// an account is required to find user tokens in the cache
	if reflect.ValueOf(o.account).IsZero() {
		return AuthResult{}, errNoAccount
	}

	silentParameters := base.AcquireTokenSilentParameters{
		Scopes:      scopes,
		Account:     o.account,
		Claims:      o.claims,
		RequestType: accesstokens.ATPublic,
		IsAppCache:  false,
		TenantID:    o.tenantID,
		AuthnScheme: o.authnScheme,
	}

	return pca.base.AcquireTokenSilent(ctx, silentParameters)
}

// acquireTokenByUsernamePasswordOptions contains optional configuration for AcquireTokenByUsernamePassword
type acquireTokenByUsernamePasswordOptions struct {
	claims, tenantID string
	authnScheme      AuthenticationScheme
}

// AcquireByUsernamePasswordOption is implemented by options for AcquireTokenByUsernamePassword
type AcquireByUsernamePasswordOption interface {
	acquireByUsernamePasswordOption()
}

// AcquireTokenByUsernamePassword acquires a security token from the authority, via Username/Password Authentication.
// NOTE: this flow is NOT recommended.
//
// Options: [WithClaims], [WithTenantID]
func (pca Client) AcquireTokenByUsernamePassword(ctx context.Context, scopes []string, username, password string, opts ...AcquireByUsernamePasswordOption) (AuthResult, error) {
	o := acquireTokenByUsernamePasswordOptions{}
	if err := options.ApplyOptions(&o, opts); err != nil {
		return AuthResult{}, err
	}
	authParams, err := pca.base.AuthParams.WithTenant(o.tenantID)
	if err != nil {
		return AuthResult{}, err
	}
	authParams.Scopes = scopes
	authParams.AuthorizationType = authority.ATUsernamePassword
	authParams.Claims = o.claims
	authParams.Username = username
	authParams.Password = password
	if o.authnScheme != nil {
		authParams.AuthnScheme = o.authnScheme
	}

	token, err := pca.base.Token.UsernamePassword(ctx, authParams)
	if err != nil {
		return AuthResult{}, err
	}
	return pca.base.AuthResultFromToken(ctx, authParams, token)
}

type DeviceCodeResult = accesstokens.DeviceCodeResult

// DeviceCode provides the results of the device code flows first stage (containing the code)
// that must be entered on the second device and provides a method to retrieve the AuthenticationResult
// once that code has been entered and verified.
type DeviceCode struct {
	// Result holds the information about the device code (such as the code).
	Result DeviceCodeResult

	authParams authority.AuthParams
	client     Client
	dc         oauth.DeviceCode
}

// AuthenticationResult retreives the AuthenticationResult once the user enters the code
// on the second device. Until then it blocks until the .AcquireTokenByDeviceCode() context
// is cancelled or the token expires.
func (d DeviceCode) AuthenticationResult(ctx context.Context) (AuthResult, error) {
	token, err := d.dc.Token(ctx)
	if err != nil {
		return AuthResult{}, err
	}
	return d.client.base.AuthResultFromToken(ctx, d.authParams, token)
}

// acquireTokenByDeviceCodeOptions contains optional configuration for AcquireTokenByDeviceCode
type acquireTokenByDeviceCodeOptions struct {
	claims, tenantID string
}

// AcquireByDeviceCodeOption is implemented by options for AcquireTokenByDeviceCode
type AcquireByDeviceCodeOption interface {
	acquireByDeviceCodeOptions()
}

// AcquireTokenByDeviceCode acquires a security token from the authority, by acquiring a device code and using that to acquire the token.
// Users need to create an AcquireTokenDeviceCodeParameters instance and pass it in.
//
// Options: [WithClaims], [WithTenantID]
func (pca Client) AcquireTokenByDeviceCode(ctx context.Context, scopes []string, opts ...AcquireByDeviceCodeOption) (DeviceCode, error) {
	o := acquireTokenByDeviceCodeOptions{}
	if err := options.ApplyOptions(&o, opts); err != nil {
		return DeviceCode{}, err
	}
	authParams, err := pca.base.AuthParams.WithTenant(o.tenantID)
	if err != nil {
		return DeviceCode{}, err
	}
	authParams.Scopes = scopes
	authParams.AuthorizationType = authority.ATDeviceCode
	authParams.Claims = o.claims

	dc, err := pca.base.Token.DeviceCode(ctx, authParams)
	if err != nil {
		return DeviceCode{}, err
	}

	return DeviceCode{Result: dc.Result, authParams: authParams, client: pca, dc: dc}, nil
}

// acquireTokenByAuthCodeOptions contains the optional parameters used to acquire an access token using the authorization code flow.
type acquireTokenByAuthCodeOptions struct {
	challenge, claims, tenantID string
}

// AcquireByAuthCodeOption is implemented by options for AcquireTokenByAuthCode
type AcquireByAuthCodeOption interface {
	acquireByAuthCodeOption()
}

// WithChallenge allows you to provide a code for the .AcquireTokenByAuthCode() call.
func WithChallenge(challenge string) interface {
	AcquireByAuthCodeOption
	options.CallOption
} {
	return struct {
		AcquireByAuthCodeOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *acquireTokenByAuthCodeOptions:
					t.challenge = challenge
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// AcquireTokenByAuthCode is a request to acquire a security token from the authority, using an authorization code.
// The specified redirect URI must be the same URI that was used when the authorization code was requested.
//
// Options: [WithChallenge], [WithClaims], [WithTenantID]
func (pca Client) AcquireTokenByAuthCode(ctx context.Context, code string, redirectURI string, scopes []string, opts ...AcquireByAuthCodeOption) (AuthResult, error) {
	o := acquireTokenByAuthCodeOptions{}
	if err := options.ApplyOptions(&o, opts); err != nil {
		return AuthResult{}, err
	}

	params := base.AcquireTokenAuthCodeParameters{
		Scopes:      scopes,
		Code:        code,
		Challenge:   o.challenge,
		Claims:      o.claims,
		AppType:     accesstokens.ATPublic,
		RedirectURI: redirectURI,
		TenantID:    o.tenantID,
	}

	return pca.base.AcquireTokenByAuthCode(ctx, params)
}

// Accounts gets all the accounts in the token cache.
// If there are no accounts in the cache the returned slice is empty.
func (pca Client) Accounts(ctx context.Context) ([]Account, error) {
	return pca.base.AllAccounts(ctx)
}

// RemoveAccount signs the account out and forgets account from token cache.
func (pca Client) RemoveAccount(ctx context.Context, account Account) error {
	return pca.base.RemoveAccount(ctx, account)
}

// interactiveAuthOptions contains the optional parameters used to acquire an access token for interactive auth code flow.
type interactiveAuthOptions struct {
	claims, domainHint, loginHint, redirectURI, tenantID string
	openURL                                              func(url string) error
	authnScheme                                          AuthenticationScheme
}

// AcquireInteractiveOption is implemented by options for AcquireTokenInteractive
type AcquireInteractiveOption interface {
	acquireInteractiveOption()
}

// WithLoginHint pre-populates the login prompt with a username.
func WithLoginHint(username string) interface {
	AcquireInteractiveOption
	AuthCodeURLOption
	options.CallOption
} {
	return struct {
		AcquireInteractiveOption
		AuthCodeURLOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *authCodeURLOptions:
					t.loginHint = username
				case *interactiveAuthOptions:
					t.loginHint = username
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// WithDomainHint adds the IdP domain as domain_hint query parameter in the auth url.
func WithDomainHint(domain string) interface {
	AcquireInteractiveOption
	AuthCodeURLOption
	options.CallOption
} {
	return struct {
		AcquireInteractiveOption
		AuthCodeURLOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *authCodeURLOptions:
					t.domainHint = domain
				case *interactiveAuthOptions:
					t.domainHint = domain
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// WithRedirectURI sets a port for the local server used in interactive authentication, for
// example http://localhost:port. All URI components other than the port are ignored.
func WithRedirectURI(redirectURI string) interface {
	AcquireInteractiveOption
	options.CallOption
} {
	return struct {
		AcquireInteractiveOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *interactiveAuthOptions:
					t.redirectURI = redirectURI
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// WithOpenURL allows you to provide a function to open the browser to complete the interactive login, instead of launching the system default browser.
func WithOpenURL(openURL func(url string) error) interface {
	AcquireInteractiveOption
	options.CallOption
} {
	return struct {
		AcquireInteractiveOption
		options.CallOption
	}{
		CallOption: options.NewCallOption(
			func(a any) error {
				switch t := a.(type) {
				case *interactiveAuthOptions:
					t.openURL = openURL
				default:
					return fmt.Errorf("unexpected options type %T", a)
				}
				return nil
			},
		),
	}
}

// AcquireTokenInteractive acquires a security token from the authority using the default web browser to select the account.
// https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-authentication-flows#interactive-and-non-interactive-authentication
//
// Options: [WithDomainHint], [WithLoginHint], [WithOpenURL], [WithRedirectURI], [WithTenantID]
func (pca Client) AcquireTokenInteractive(ctx context.Context, scopes []string, opts ...AcquireInteractiveOption) (AuthResult, error) {
	o := interactiveAuthOptions{}
	if err := options.ApplyOptions(&o, opts); err != nil {
		return AuthResult{}, err
	}
	// the code verifier is a random 32-byte sequence that's been base-64 encoded without padding.
	// it's used to prevent MitM attacks during auth code flow, see https://tools.ietf.org/html/rfc7636
	cv, challenge, err := codeVerifier()
	if err != nil {
		return AuthResult{}, err
	}
	var redirectURL *url.URL
	if o.redirectURI != "" {
		redirectURL, err = url.Parse(o.redirectURI)
		if err != nil {
			return AuthResult{}, err
		}
	}
	if o.openURL == nil {
		o.openURL = browser.OpenURL
	}
	authParams, err := pca.base.AuthParams.WithTenant(o.tenantID)
	if err != nil {
		return AuthResult{}, err
	}
	authParams.Scopes = scopes
	authParams.AuthorizationType = authority.ATInteractive
	authParams.Claims = o.claims
	authParams.CodeChallenge = challenge
	authParams.CodeChallengeMethod = "S256"
	authParams.LoginHint = o.loginHint
	authParams.DomainHint = o.domainHint
	authParams.State = uuid.New().String()
	authParams.Prompt = "select_account"
	if o.authnScheme != nil {
		authParams.AuthnScheme = o.authnScheme
	}
	res, err := pca.browserLogin(ctx, redirectURL, authParams, o.openURL)
	if err != nil {
		return AuthResult{}, err
	}
	authParams.Redirecturi = res.redirectURI

	req, err := accesstokens.NewCodeChallengeRequest(authParams, accesstokens.ATPublic, nil, res.authCode, cv)
	if err != nil {
		return AuthResult{}, err
	}

	token, err := pca.base.Token.AuthCode(ctx, req)
	if err != nil {
		return AuthResult{}, err
	}

	return pca.base.AuthResultFromToken(ctx, authParams, token)
}

type interactiveAuthResult struct {
	authCode    string
	redirectURI string
}

// parses the port number from the provided URL.
// returns 0 if nil or no port is specified.
func parsePort(u *url.URL) (int, error) {
	if u == nil {
		return 0, nil
	}
	p := u.Port()
	if p == "" {
		return 0, nil
	}
	return strconv.Atoi(p)
}

// browserLogin calls openURL and waits for a user to log in
func (pca Client) browserLogin(ctx context.Context, redirectURI *url.URL, params authority.AuthParams, openURL func(string) error) (interactiveAuthResult, error) {
	// start local redirect server so login can call us back
	port, err := parsePort(redirectURI)
	if err != nil {
		return interactiveAuthResult{}, err
	}
	srv, err := local.New(params.State, port)
	if err != nil {
		return interactiveAuthResult{}, err
	}
	defer srv.Shutdown()
	params.Scopes = accesstokens.AppendDefaultScopes(params)
	authURL, err := pca.base.AuthCodeURL(ctx, params.ClientID, srv.Addr, params.Scopes, params)
	if err != nil {
		return interactiveAuthResult{}, err
	}
	// open browser window so user can select credentials
	if err := openURL(authURL); err != nil {
		return interactiveAuthResult{}, err
	}
	// now wait until the logic calls us back
	res := srv.Result(ctx)
	if res.Err != nil {
		return interactiveAuthResult{}, res.Err
	}
	return interactiveAuthResult{
		authCode:    res.Code,
		redirectURI: srv.Addr,
	}, nil
}

// creates a code verifier string along with its SHA256 hash which
// is used as the challenge when requesting an auth code.
// used in interactive auth flow for PKCE.
func codeVerifier() (codeVerifier string, challenge string, err error) {
	cvBytes := make([]byte, 32)
	if _, err = rand.Read(cvBytes); err != nil {
		return
	}
	codeVerifier = base64.RawURLEncoding.EncodeToString(cvBytes)
	// for PKCE, create a hash of the code verifier
	cvh := sha256.Sum256([]byte(codeVerifier))
	challenge = base64.RawURLEncoding.EncodeToString(cvh[:])
	return
}
