// Package base contains a "Base" client that is used by the external public.Client and confidential.Client.
// Base holds shared attributes that must be available to both clients and methods that act as
// shared calls.
package base

import (
	"context"
	"fmt"
	"net/url"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/cache"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/errors"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/base/storage"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth/ops/accesstokens"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/oauth/ops/authority"
	"github.com/AzureAD/microsoft-authentication-library-for-go/apps/internal/shared"
)

const (
	// AuthorityPublicCloud is the default AAD authority host
	AuthorityPublicCloud = "https://login.microsoftonline.com/common"
	scopeSeparator       = " "
)

// manager provides an internal cache. It is defined to allow faking the cache in tests.
// In production it's a *storage.Manager or *storage.PartitionedManager.
type manager interface {
	cache.Serializer
	Read(context.Context, authority.AuthParams) (storage.TokenResponse, error)
	Write(authority.AuthParams, accesstokens.TokenResponse) (shared.Account, error)
}

// accountManager is a manager that also caches accounts. In production it's a *storage.Manager.
type accountManager interface {
	manager
	AllAccounts() []shared.Account
	Account(homeAccountID string) shared.Account
	RemoveAccount(account shared.Account, clientID string)
}

// AcquireTokenSilentParameters contains the parameters to acquire a token silently (from cache).
type AcquireTokenSilentParameters struct {
	Scopes            []string
	Account           shared.Account
	RequestType       accesstokens.AppType
	Credential        *accesstokens.Credential
	IsAppCache        bool
	TenantID          string
	UserAssertion     string
	AuthorizationType authority.AuthorizeType
	Claims            string
	AuthnScheme       authority.AuthenticationScheme
}

// AcquireTokenAuthCodeParameters contains the parameters required to acquire an access token using the auth code flow.
// To use PKCE, set the CodeChallengeParameter.
// Code challenges are used to secure authorization code grants; for more information, visit
// https://tools.ietf.org/html/rfc7636.
type AcquireTokenAuthCodeParameters struct {
	Scopes      []string
	Code        string
	Challenge   string
	Claims      string
	RedirectURI string
	AppType     accesstokens.AppType
	Credential  *accesstokens.Credential
	TenantID    string
}

type AcquireTokenOnBehalfOfParameters struct {
	Scopes        []string
	Claims        string
	Credential    *accesstokens.Credential
	TenantID      string
	UserAssertion string
}

// AuthResult contains the results of one token acquisition operation in PublicClientApplication
// or ConfidentialClientApplication. For details see https://aka.ms/msal-net-authenticationresult
type AuthResult struct {
	Account        shared.Account
	IDToken        accesstokens.IDToken
	AccessToken    string
	ExpiresOn      time.Time
	GrantedScopes  []string
	DeclinedScopes []string
	Metadata       AuthResultMetadata
}

// AuthResultMetadata which contains meta data for the AuthResult
type AuthResultMetadata struct {
	RefreshOn   time.Time
	TokenSource TokenSource
}

type TokenSource int

// These are all the types of token flows.
const (
	TokenSourceIdentityProvider TokenSource = 0
	TokenSourceCache            TokenSource = 1
)

// AuthResultFromStorage creates an AuthResult from a storage token response (which is generated from the cache).
func AuthResultFromStorage(storageTokenResponse storage.TokenResponse) (AuthResult, error) {
	if err := storageTokenResponse.AccessToken.Validate(); err != nil {
		return AuthResult{}, fmt.Errorf("problem with access token in StorageTokenResponse: %w", err)
	}
	account := storageTokenResponse.Account
	accessToken := storageTokenResponse.AccessToken.Secret
	grantedScopes := strings.Split(storageTokenResponse.AccessToken.Scopes, scopeSeparator)

	// Checking if there was an ID token in the cache; this will throw an error in the case of confidential client applications.
	var idToken accesstokens.IDToken
	if !storageTokenResponse.IDToken.IsZero() {
		err := idToken.UnmarshalJSON([]byte(storageTokenResponse.IDToken.Secret))
		if err != nil {
			return AuthResult{}, fmt.Errorf("problem decoding JWT token: %w", err)
		}
	}
	return AuthResult{
		Account:        account,
		IDToken:        idToken,
		AccessToken:    accessToken,
		ExpiresOn:      storageTokenResponse.AccessToken.ExpiresOn.T,
		GrantedScopes:  grantedScopes,
		DeclinedScopes: nil,
		Metadata: AuthResultMetadata{
			TokenSource: TokenSourceCache,
			RefreshOn:   storageTokenResponse.AccessToken.RefreshOn.T,
		},
	}, nil
}

// NewAuthResult creates an AuthResult.
func NewAuthResult(tokenResponse accesstokens.TokenResponse, account shared.Account) (AuthResult, error) {
	if len(tokenResponse.DeclinedScopes) > 0 {
		return AuthResult{}, fmt.Errorf("token response failed because declined scopes are present: %s", strings.Join(tokenResponse.DeclinedScopes, ","))
	}
	return AuthResult{
		Account:       account,
		IDToken:       tokenResponse.IDToken,
		AccessToken:   tokenResponse.AccessToken,
		ExpiresOn:     tokenResponse.ExpiresOn,
		GrantedScopes: tokenResponse.GrantedScopes.Slice,
		Metadata: AuthResultMetadata{
			TokenSource: TokenSourceIdentityProvider,
			RefreshOn:   tokenResponse.RefreshOn.T,
		},
	}, nil
}

// Client is a base client that provides access to common methods and primatives that
// can be used by multiple clients.
type Client struct {
	Token   *oauth.Client
	manager accountManager // *storage.Manager or fakeManager in tests
	// pmanager is a partitioned cache for OBO authentication. *storage.PartitionedManager or fakeManager in tests
	pmanager manager

	AuthParams      authority.AuthParams // DO NOT EVER MAKE THIS A POINTER! See "Note" in New().
	cacheAccessor   cache.ExportReplace
	cacheAccessorMu *sync.RWMutex
	canRefresh      map[string]*atomic.Value
	canRefreshMu    *sync.Mutex
}

// Option is an optional argument to the New constructor.
type Option func(c *Client) error

// WithCacheAccessor allows you to set some type of cache for storing authentication tokens.
func WithCacheAccessor(ca cache.ExportReplace) Option {
	return func(c *Client) error {
		if ca != nil {
			c.cacheAccessor = ca
		}
		return nil
	}
}

// WithClientCapabilities allows configuring one or more client capabilities such as "CP1"
func WithClientCapabilities(capabilities []string) Option {
	return func(c *Client) error {
		var err error
		if len(capabilities) > 0 {
			cc, err := authority.NewClientCapabilities(capabilities)
			if err == nil {
				c.AuthParams.Capabilities = cc
			}
		}
		return err
	}
}

// WithKnownAuthorityHosts specifies hosts Client shouldn't validate or request metadata for because they're known to the user
func WithKnownAuthorityHosts(hosts []string) Option {
	return func(c *Client) error {
		cp := make([]string, len(hosts))
		copy(cp, hosts)
		c.AuthParams.KnownAuthorityHosts = cp
		return nil
	}
}

// WithX5C specifies if x5c claim(public key of the certificate) should be sent to STS to enable Subject Name Issuer Authentication.
func WithX5C(sendX5C bool) Option {
	return func(c *Client) error {
		c.AuthParams.SendX5C = sendX5C
		return nil
	}
}

func WithRegionDetection(region string) Option {
	return func(c *Client) error {
		c.AuthParams.AuthorityInfo.Region = region
		return nil
	}
}

func WithInstanceDiscovery(instanceDiscoveryEnabled bool) Option {
	return func(c *Client) error {
		c.AuthParams.AuthorityInfo.ValidateAuthority = instanceDiscoveryEnabled
		c.AuthParams.AuthorityInfo.InstanceDiscoveryDisabled = !instanceDiscoveryEnabled
		return nil
	}
}

// New is the constructor for Base.
func New(clientID string, authorityURI string, token *oauth.Client, options ...Option) (Client, error) {
	//By default, validateAuthority is set to true and instanceDiscoveryDisabled is set to false
	authInfo, err := authority.NewInfoFromAuthorityURI(authorityURI, true, false)
	if err != nil {
		return Client{}, err
	}
	authParams := authority.NewAuthParams(clientID, authInfo)
	client := Client{ // Note: Hey, don't even THINK about making Base into *Base. See "design notes" in public.go and confidential.go
		Token:           token,
		AuthParams:      authParams,
		cacheAccessorMu: &sync.RWMutex{},
		manager:         storage.New(token),
		pmanager:        storage.NewPartitionedManager(token),
		canRefresh:      make(map[string]*atomic.Value),
		canRefreshMu:    &sync.Mutex{},
	}
	for _, o := range options {
		if err = o(&client); err != nil {
			break
		}
	}
	return client, err

}

// AuthCodeURL creates a URL used to acquire an authorization code.
func (b Client) AuthCodeURL(ctx context.Context, clientID, redirectURI string, scopes []string, authParams authority.AuthParams) (string, error) {
	endpoints, err := b.Token.ResolveEndpoints(ctx, authParams.AuthorityInfo, "")
	if err != nil {
		return "", err
	}

	baseURL, err := url.Parse(endpoints.AuthorizationEndpoint)
	if err != nil {
		return "", err
	}

	claims, err := authParams.MergeCapabilitiesAndClaims()
	if err != nil {
		return "", err
	}

	v := url.Values{}
	v.Add("client_id", clientID)
	v.Add("response_type", "code")
	v.Add("redirect_uri", redirectURI)
	v.Add("scope", strings.Join(scopes, scopeSeparator))
	if authParams.State != "" {
		v.Add("state", authParams.State)
	}
	if claims != "" {
		v.Add("claims", claims)
	}
	if authParams.CodeChallenge != "" {
		v.Add("code_challenge", authParams.CodeChallenge)
	}
	if authParams.CodeChallengeMethod != "" {
		v.Add("code_challenge_method", authParams.CodeChallengeMethod)
	}
	if authParams.LoginHint != "" {
		v.Add("login_hint", authParams.LoginHint)
	}
	if authParams.Prompt != "" {
		v.Add("prompt", authParams.Prompt)
	}
	if authParams.DomainHint != "" {
		v.Add("domain_hint", authParams.DomainHint)
	}
	// There were left over from an implementation that didn't use any of these.  We may
	// need to add them later, but as of now aren't needed.
	/*
		if p.ResponseMode != "" {
			urlParams.Add("response_mode", p.ResponseMode)
		}
	*/
	baseURL.RawQuery = v.Encode()
	return baseURL.String(), nil
}

func (b Client) AcquireTokenSilent(ctx context.Context, silent AcquireTokenSilentParameters) (AuthResult, error) {
	ar := AuthResult{}
	// when tenant == "", the caller didn't specify a tenant and WithTenant will choose the client's configured tenant
	tenant := silent.TenantID
	authParams, err := b.AuthParams.WithTenant(tenant)
	if err != nil {
		return ar, err
	}
	authParams.Scopes = silent.Scopes
	authParams.HomeAccountID = silent.Account.HomeAccountID
	authParams.AuthorizationType = silent.AuthorizationType
	authParams.Claims = silent.Claims
	authParams.UserAssertion = silent.UserAssertion
	if silent.AuthnScheme != nil {
		authParams.AuthnScheme = silent.AuthnScheme
	}

	m := b.pmanager
	if authParams.AuthorizationType != authority.ATOnBehalfOf {
		authParams.AuthorizationType = authority.ATRefreshToken
		m = b.manager
	}
	if b.cacheAccessor != nil {
		key := authParams.CacheKey(silent.IsAppCache)
		b.cacheAccessorMu.RLock()
		err = b.cacheAccessor.Replace(ctx, m, cache.ReplaceHints{PartitionKey: key})
		b.cacheAccessorMu.RUnlock()
	}
	if err != nil {
		return ar, err
	}
	storageTokenResponse, err := m.Read(ctx, authParams)
	if err != nil {
		return ar, err
	}

	// ignore cached access tokens when given claims
	if silent.Claims == "" {
		ar, err = AuthResultFromStorage(storageTokenResponse)
		if err == nil {
			if rt := storageTokenResponse.AccessToken.RefreshOn.T; !rt.IsZero() && Now().After(rt) {
				b.canRefreshMu.Lock()
				refreshValue, ok := b.canRefresh[tenant]
				if !ok {
					refreshValue = &atomic.Value{}
					refreshValue.Store(false)
					b.canRefresh[tenant] = refreshValue
				}
				b.canRefreshMu.Unlock()
				if refreshValue.CompareAndSwap(false, true) {
					defer refreshValue.Store(false)
					// Added a check to see if the token is still same because there is a chance
					// that the token is already refreshed by another thread.
					// If the token is not same, we don't need to refresh it.
					// Which means it refreshed.
					if str, err := m.Read(ctx, authParams); err == nil && str.AccessToken.Secret == ar.AccessToken {
						if tr, er := b.Token.Credential(ctx, authParams, silent.Credential); er == nil {
							return b.AuthResultFromToken(ctx, authParams, tr)
						}
					}
				}
			}
			ar.AccessToken, err = authParams.AuthnScheme.FormatAccessToken(ar.AccessToken)
			return ar, err
		}
	}

	// redeem a cached refresh token, if available
	if reflect.ValueOf(storageTokenResponse.RefreshToken).IsZero() {
		return ar, errors.New("no token found")
	}
	var cc *accesstokens.Credential
	if silent.RequestType == accesstokens.ATConfidential {
		cc = silent.Credential
	}
	token, err := b.Token.Refresh(ctx, silent.RequestType, authParams, cc, storageTokenResponse.RefreshToken)
	if err != nil {
		return ar, err
	}
	return b.AuthResultFromToken(ctx, authParams, token)
}

func (b Client) AcquireTokenByAuthCode(ctx context.Context, authCodeParams AcquireTokenAuthCodeParameters) (AuthResult, error) {
	authParams, err := b.AuthParams.WithTenant(authCodeParams.TenantID)
	if err != nil {
		return AuthResult{}, err
	}
	authParams.Claims = authCodeParams.Claims
	authParams.Scopes = authCodeParams.Scopes
	authParams.Redirecturi = authCodeParams.RedirectURI
	authParams.AuthorizationType = authority.ATAuthCode

	var cc *accesstokens.Credential
	if authCodeParams.AppType == accesstokens.ATConfidential {
		cc = authCodeParams.Credential
		authParams.IsConfidentialClient = true
	}

	req, err := accesstokens.NewCodeChallengeRequest(authParams, authCodeParams.AppType, cc, authCodeParams.Code, authCodeParams.Challenge)
	if err != nil {
		return AuthResult{}, err
	}

	token, err := b.Token.AuthCode(ctx, req)
	if err != nil {
		return AuthResult{}, err
	}

	return b.AuthResultFromToken(ctx, authParams, token)
}

// AcquireTokenOnBehalfOf acquires a security token for an app using middle tier apps access token.
func (b Client) AcquireTokenOnBehalfOf(ctx context.Context, onBehalfOfParams AcquireTokenOnBehalfOfParameters) (AuthResult, error) {
	var ar AuthResult
	silentParameters := AcquireTokenSilentParameters{
		Scopes:            onBehalfOfParams.Scopes,
		RequestType:       accesstokens.ATConfidential,
		Credential:        onBehalfOfParams.Credential,
		UserAssertion:     onBehalfOfParams.UserAssertion,
		AuthorizationType: authority.ATOnBehalfOf,
		TenantID:          onBehalfOfParams.TenantID,
		Claims:            onBehalfOfParams.Claims,
	}
	ar, err := b.AcquireTokenSilent(ctx, silentParameters)
	if err == nil {
		return ar, err
	}
	authParams, err := b.AuthParams.WithTenant(onBehalfOfParams.TenantID)
	if err != nil {
		return AuthResult{}, err
	}
	authParams.AuthorizationType = authority.ATOnBehalfOf
	authParams.Claims = onBehalfOfParams.Claims
	authParams.Scopes = onBehalfOfParams.Scopes
	authParams.UserAssertion = onBehalfOfParams.UserAssertion
	token, err := b.Token.OnBehalfOf(ctx, authParams, onBehalfOfParams.Credential)
	if err == nil {
		ar, err = b.AuthResultFromToken(ctx, authParams, token)
	}
	return ar, err
}

func (b Client) AuthResultFromToken(ctx context.Context, authParams authority.AuthParams, token accesstokens.TokenResponse) (AuthResult, error) {
	var m manager = b.manager
	if authParams.AuthorizationType == authority.ATOnBehalfOf {
		m = b.pmanager
	}
	key := token.CacheKey(authParams)
	if b.cacheAccessor != nil {
		b.cacheAccessorMu.Lock()
		defer b.cacheAccessorMu.Unlock()
		err := b.cacheAccessor.Replace(ctx, m, cache.ReplaceHints{PartitionKey: key})
		if err != nil {
			return AuthResult{}, err
		}
	}
	account, err := m.Write(authParams, token)
	if err != nil {
		return AuthResult{}, err
	}
	ar, err := NewAuthResult(token, account)
	if err == nil && b.cacheAccessor != nil {
		err = b.cacheAccessor.Export(ctx, b.manager, cache.ExportHints{PartitionKey: key})
	}
	if err != nil {
		return AuthResult{}, err
	}

	ar.AccessToken, err = authParams.AuthnScheme.FormatAccessToken(ar.AccessToken)
	return ar, err
}

// This function wraps time.Now() and is used for refreshing the application
// was created to test the function against refreshin
var Now = time.Now

func (b Client) AllAccounts(ctx context.Context) ([]shared.Account, error) {
	if b.cacheAccessor != nil {
		b.cacheAccessorMu.RLock()
		defer b.cacheAccessorMu.RUnlock()
		key := b.AuthParams.CacheKey(false)
		err := b.cacheAccessor.Replace(ctx, b.manager, cache.ReplaceHints{PartitionKey: key})
		if err != nil {
			return nil, err
		}
	}
	return b.manager.AllAccounts(), nil
}

func (b Client) Account(ctx context.Context, homeAccountID string) (shared.Account, error) {
	if b.cacheAccessor != nil {
		b.cacheAccessorMu.RLock()
		defer b.cacheAccessorMu.RUnlock()
		authParams := b.AuthParams // This is a copy, as we don't have a pointer receiver and .AuthParams is not a pointer.
		authParams.AuthorizationType = authority.AccountByID
		authParams.HomeAccountID = homeAccountID
		key := b.AuthParams.CacheKey(false)
		err := b.cacheAccessor.Replace(ctx, b.manager, cache.ReplaceHints{PartitionKey: key})
		if err != nil {
			return shared.Account{}, err
		}
	}
	return b.manager.Account(homeAccountID), nil
}

// RemoveAccount removes all the ATs, RTs and IDTs from the cache associated with this account.
func (b Client) RemoveAccount(ctx context.Context, account shared.Account) error {
	if b.cacheAccessor == nil {
		b.manager.RemoveAccount(account, b.AuthParams.ClientID)
		return nil
	}
	b.cacheAccessorMu.Lock()
	defer b.cacheAccessorMu.Unlock()
	key := b.AuthParams.CacheKey(false)
	err := b.cacheAccessor.Replace(ctx, b.manager, cache.ReplaceHints{PartitionKey: key})
	if err != nil {
		return err
	}
	b.manager.RemoveAccount(account, b.AuthParams.ClientID)
	return b.cacheAccessor.Export(ctx, b.manager, cache.ExportHints{PartitionKey: key})
}
