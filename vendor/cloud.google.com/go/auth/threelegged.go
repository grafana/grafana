// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/auth/internal"
	"github.com/googleapis/gax-go/v2/internallog"
)

// AuthorizationHandler is a 3-legged-OAuth helper that prompts the user for
// OAuth consent at the specified auth code URL and returns an auth code and
// state upon approval.
type AuthorizationHandler func(authCodeURL string) (code string, state string, err error)

// Options3LO are the options for doing a 3-legged OAuth2 flow.
type Options3LO struct {
	// ClientID is the application's ID.
	ClientID string
	// ClientSecret is the application's secret. Not required if AuthHandlerOpts
	// is set.
	ClientSecret string
	// AuthURL is the URL for authenticating.
	AuthURL string
	// TokenURL is the URL for retrieving a token.
	TokenURL string
	// AuthStyle is used to describe how to client info in the token request.
	AuthStyle Style
	// RefreshToken is the token used to refresh the credential. Not required
	// if AuthHandlerOpts is set.
	RefreshToken string
	// RedirectURL is the URL to redirect users to. Optional.
	RedirectURL string
	// Scopes specifies requested permissions for the Token. Optional.
	Scopes []string

	// URLParams are the set of values to apply to the token exchange. Optional.
	URLParams url.Values
	// Client is the client to be used to make the underlying token requests.
	// Optional.
	Client *http.Client
	// EarlyTokenExpiry is the time before the token expires that it should be
	// refreshed. If not set the default value is 3 minutes and 45 seconds.
	// Optional.
	EarlyTokenExpiry time.Duration

	// AuthHandlerOpts provides a set of options for doing a
	// 3-legged OAuth2 flow with a custom [AuthorizationHandler]. Optional.
	AuthHandlerOpts *AuthorizationHandlerOptions
	// Logger is used for debug logging. If provided, logging will be enabled
	// at the loggers configured level. By default logging is disabled unless
	// enabled by setting GOOGLE_SDK_GO_LOGGING_LEVEL in which case a default
	// logger will be used. Optional.
	Logger *slog.Logger
}

func (o *Options3LO) validate() error {
	if o == nil {
		return errors.New("auth: options must be provided")
	}
	if o.ClientID == "" {
		return errors.New("auth: client ID must be provided")
	}
	if o.AuthHandlerOpts == nil && o.ClientSecret == "" {
		return errors.New("auth: client secret must be provided")
	}
	if o.AuthURL == "" {
		return errors.New("auth: auth URL must be provided")
	}
	if o.TokenURL == "" {
		return errors.New("auth: token URL must be provided")
	}
	if o.AuthStyle == StyleUnknown {
		return errors.New("auth: auth style must be provided")
	}
	if o.AuthHandlerOpts == nil && o.RefreshToken == "" {
		return errors.New("auth: refresh token must be provided")
	}
	return nil
}

func (o *Options3LO) logger() *slog.Logger {
	return internallog.New(o.Logger)
}

// PKCEOptions holds parameters to support PKCE.
type PKCEOptions struct {
	// Challenge is the un-padded, base64-url-encoded string of the encrypted code verifier.
	Challenge string // The un-padded, base64-url-encoded string of the encrypted code verifier.
	// ChallengeMethod is the encryption method (ex. S256).
	ChallengeMethod string
	// Verifier is the original, non-encrypted secret.
	Verifier string // The original, non-encrypted secret.
}

type tokenJSON struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	// error fields
	ErrorCode        string `json:"error"`
	ErrorDescription string `json:"error_description"`
	ErrorURI         string `json:"error_uri"`
}

func (e *tokenJSON) expiry() (t time.Time) {
	if v := e.ExpiresIn; v != 0 {
		return time.Now().Add(time.Duration(v) * time.Second)
	}
	return
}

func (o *Options3LO) client() *http.Client {
	if o.Client != nil {
		return o.Client
	}
	return internal.DefaultClient()
}

// authCodeURL returns a URL that points to a OAuth2 consent page.
func (o *Options3LO) authCodeURL(state string, values url.Values) string {
	var buf bytes.Buffer
	buf.WriteString(o.AuthURL)
	v := url.Values{
		"response_type": {"code"},
		"client_id":     {o.ClientID},
	}
	if o.RedirectURL != "" {
		v.Set("redirect_uri", o.RedirectURL)
	}
	if len(o.Scopes) > 0 {
		v.Set("scope", strings.Join(o.Scopes, " "))
	}
	if state != "" {
		v.Set("state", state)
	}
	if o.AuthHandlerOpts != nil {
		if o.AuthHandlerOpts.PKCEOpts != nil &&
			o.AuthHandlerOpts.PKCEOpts.Challenge != "" {
			v.Set(codeChallengeKey, o.AuthHandlerOpts.PKCEOpts.Challenge)
		}
		if o.AuthHandlerOpts.PKCEOpts != nil &&
			o.AuthHandlerOpts.PKCEOpts.ChallengeMethod != "" {
			v.Set(codeChallengeMethodKey, o.AuthHandlerOpts.PKCEOpts.ChallengeMethod)
		}
	}
	for k := range values {
		v.Set(k, v.Get(k))
	}
	if strings.Contains(o.AuthURL, "?") {
		buf.WriteByte('&')
	} else {
		buf.WriteByte('?')
	}
	buf.WriteString(v.Encode())
	return buf.String()
}

// New3LOTokenProvider returns a [TokenProvider] based on the 3-legged OAuth2
// configuration. The TokenProvider is caches and auto-refreshes tokens by
// default.
func New3LOTokenProvider(opts *Options3LO) (TokenProvider, error) {
	if err := opts.validate(); err != nil {
		return nil, err
	}
	if opts.AuthHandlerOpts != nil {
		return new3LOTokenProviderWithAuthHandler(opts), nil
	}
	return NewCachedTokenProvider(&tokenProvider3LO{opts: opts, refreshToken: opts.RefreshToken, client: opts.client()}, &CachedTokenProviderOptions{
		ExpireEarly: opts.EarlyTokenExpiry,
	}), nil
}

// AuthorizationHandlerOptions provides a set of options to specify for doing a
// 3-legged OAuth2 flow with a custom [AuthorizationHandler].
type AuthorizationHandlerOptions struct {
	// AuthorizationHandler specifies the handler used to for the authorization
	// part of the flow.
	Handler AuthorizationHandler
	// State is used verify that the "state" is identical in the request and
	// response before exchanging the auth code for OAuth2 token.
	State string
	// PKCEOpts allows setting configurations for PKCE. Optional.
	PKCEOpts *PKCEOptions
}

func new3LOTokenProviderWithAuthHandler(opts *Options3LO) TokenProvider {
	return NewCachedTokenProvider(&tokenProviderWithHandler{opts: opts, state: opts.AuthHandlerOpts.State}, &CachedTokenProviderOptions{
		ExpireEarly: opts.EarlyTokenExpiry,
	})
}

// exchange handles the final exchange portion of the 3lo flow. Returns a Token,
// refreshToken, and error.
func (o *Options3LO) exchange(ctx context.Context, code string) (*Token, string, error) {
	// Build request
	v := url.Values{
		"grant_type": {"authorization_code"},
		"code":       {code},
	}
	if o.RedirectURL != "" {
		v.Set("redirect_uri", o.RedirectURL)
	}
	if o.AuthHandlerOpts != nil &&
		o.AuthHandlerOpts.PKCEOpts != nil &&
		o.AuthHandlerOpts.PKCEOpts.Verifier != "" {
		v.Set(codeVerifierKey, o.AuthHandlerOpts.PKCEOpts.Verifier)
	}
	for k := range o.URLParams {
		v.Set(k, o.URLParams.Get(k))
	}
	return fetchToken(ctx, o, v)
}

// This struct is not safe for concurrent access alone, but the way it is used
// in this package by wrapping it with a cachedTokenProvider makes it so.
type tokenProvider3LO struct {
	opts         *Options3LO
	client       *http.Client
	refreshToken string
}

func (tp *tokenProvider3LO) Token(ctx context.Context) (*Token, error) {
	if tp.refreshToken == "" {
		return nil, errors.New("auth: token expired and refresh token is not set")
	}
	v := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {tp.refreshToken},
	}
	for k := range tp.opts.URLParams {
		v.Set(k, tp.opts.URLParams.Get(k))
	}

	tk, rt, err := fetchToken(ctx, tp.opts, v)
	if err != nil {
		return nil, err
	}
	if tp.refreshToken != rt && rt != "" {
		tp.refreshToken = rt
	}
	return tk, err
}

type tokenProviderWithHandler struct {
	opts  *Options3LO
	state string
}

func (tp tokenProviderWithHandler) Token(ctx context.Context) (*Token, error) {
	url := tp.opts.authCodeURL(tp.state, nil)
	code, state, err := tp.opts.AuthHandlerOpts.Handler(url)
	if err != nil {
		return nil, err
	}
	if state != tp.state {
		return nil, errors.New("auth: state mismatch in 3-legged-OAuth flow")
	}
	tok, _, err := tp.opts.exchange(ctx, code)
	return tok, err
}

// fetchToken returns a Token, refresh token, and/or an error.
func fetchToken(ctx context.Context, o *Options3LO, v url.Values) (*Token, string, error) {
	var refreshToken string
	if o.AuthStyle == StyleInParams {
		if o.ClientID != "" {
			v.Set("client_id", o.ClientID)
		}
		if o.ClientSecret != "" {
			v.Set("client_secret", o.ClientSecret)
		}
	}
	req, err := http.NewRequestWithContext(ctx, "POST", o.TokenURL, strings.NewReader(v.Encode()))
	if err != nil {
		return nil, refreshToken, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if o.AuthStyle == StyleInHeader {
		req.SetBasicAuth(url.QueryEscape(o.ClientID), url.QueryEscape(o.ClientSecret))
	}
	logger := o.logger()

	logger.DebugContext(ctx, "3LO token request", "request", internallog.HTTPRequest(req, []byte(v.Encode())))
	// Make request
	resp, body, err := internal.DoRequest(o.client(), req)
	if err != nil {
		return nil, refreshToken, err
	}
	logger.DebugContext(ctx, "3LO token response", "response", internallog.HTTPResponse(resp, body))
	failureStatus := resp.StatusCode < 200 || resp.StatusCode > 299
	tokError := &Error{
		Response: resp,
		Body:     body,
	}

	var token *Token
	// errors ignored because of default switch on content
	content, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	switch content {
	case "application/x-www-form-urlencoded", "text/plain":
		// some endpoints return a query string
		vals, err := url.ParseQuery(string(body))
		if err != nil {
			if failureStatus {
				return nil, refreshToken, tokError
			}
			return nil, refreshToken, fmt.Errorf("auth: cannot parse response: %w", err)
		}
		tokError.code = vals.Get("error")
		tokError.description = vals.Get("error_description")
		tokError.uri = vals.Get("error_uri")
		token = &Token{
			Value:    vals.Get("access_token"),
			Type:     vals.Get("token_type"),
			Metadata: make(map[string]interface{}, len(vals)),
		}
		for k, v := range vals {
			token.Metadata[k] = v
		}
		refreshToken = vals.Get("refresh_token")
		e := vals.Get("expires_in")
		expires, _ := strconv.Atoi(e)
		if expires != 0 {
			token.Expiry = time.Now().Add(time.Duration(expires) * time.Second)
		}
	default:
		var tj tokenJSON
		if err = json.Unmarshal(body, &tj); err != nil {
			if failureStatus {
				return nil, refreshToken, tokError
			}
			return nil, refreshToken, fmt.Errorf("auth: cannot parse json: %w", err)
		}
		tokError.code = tj.ErrorCode
		tokError.description = tj.ErrorDescription
		tokError.uri = tj.ErrorURI
		token = &Token{
			Value:    tj.AccessToken,
			Type:     tj.TokenType,
			Expiry:   tj.expiry(),
			Metadata: make(map[string]interface{}),
		}
		json.Unmarshal(body, &token.Metadata) // optional field, skip err check
		refreshToken = tj.RefreshToken
	}
	// according to spec, servers should respond status 400 in error case
	// https://www.rfc-editor.org/rfc/rfc6749#section-5.2
	// but some unorthodox servers respond 200 in error case
	if failureStatus || tokError.code != "" {
		return nil, refreshToken, tokError
	}
	if token.Value == "" {
		return nil, refreshToken, errors.New("auth: server response missing access_token")
	}
	return token, refreshToken, nil
}
