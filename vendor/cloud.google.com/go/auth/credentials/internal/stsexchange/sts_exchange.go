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

package stsexchange

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/internal"
	"github.com/googleapis/gax-go/v2/internallog"
)

const (
	// GrantType for a sts exchange.
	GrantType = "urn:ietf:params:oauth:grant-type:token-exchange"
	// TokenType for a sts exchange.
	TokenType = "urn:ietf:params:oauth:token-type:access_token"

	jwtTokenType = "urn:ietf:params:oauth:token-type:jwt"
)

// Options stores the configuration for making an sts exchange request.
type Options struct {
	Client         *http.Client
	Logger         *slog.Logger
	Endpoint       string
	Request        *TokenRequest
	Authentication ClientAuthentication
	Headers        http.Header
	// ExtraOpts are optional fields marshalled into the `options` field of the
	// request body.
	ExtraOpts    map[string]interface{}
	RefreshToken string
}

// RefreshAccessToken performs the token exchange using a refresh token flow.
func RefreshAccessToken(ctx context.Context, opts *Options) (*TokenResponse, error) {
	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", opts.RefreshToken)
	return doRequest(ctx, opts, data)
}

// ExchangeToken performs an oauth2 token exchange with the provided endpoint.
func ExchangeToken(ctx context.Context, opts *Options) (*TokenResponse, error) {
	data := url.Values{}
	data.Set("audience", opts.Request.Audience)
	data.Set("grant_type", GrantType)
	data.Set("requested_token_type", TokenType)
	data.Set("subject_token_type", opts.Request.SubjectTokenType)
	data.Set("subject_token", opts.Request.SubjectToken)
	data.Set("scope", strings.Join(opts.Request.Scope, " "))
	if opts.ExtraOpts != nil {
		opts, err := json.Marshal(opts.ExtraOpts)
		if err != nil {
			return nil, fmt.Errorf("credentials: failed to marshal additional options: %w", err)
		}
		data.Set("options", string(opts))
	}
	return doRequest(ctx, opts, data)
}

func doRequest(ctx context.Context, opts *Options, data url.Values) (*TokenResponse, error) {
	opts.Authentication.InjectAuthentication(data, opts.Headers)
	encodedData := data.Encode()
	logger := internallog.New(opts.Logger)

	req, err := http.NewRequestWithContext(ctx, "POST", opts.Endpoint, strings.NewReader(encodedData))
	if err != nil {
		return nil, fmt.Errorf("credentials: failed to properly build http request: %w", err)

	}
	for key, list := range opts.Headers {
		for _, val := range list {
			req.Header.Add(key, val)
		}
	}
	req.Header.Set("Content-Length", strconv.Itoa(len(encodedData)))

	logger.DebugContext(ctx, "sts token request", "request", internallog.HTTPRequest(req, []byte(encodedData)))
	resp, body, err := internal.DoRequest(opts.Client, req)
	if err != nil {
		return nil, fmt.Errorf("credentials: invalid response from Secure Token Server: %w", err)
	}
	logger.DebugContext(ctx, "sts token response", "response", internallog.HTTPResponse(resp, body))
	if c := resp.StatusCode; c < http.StatusOK || c > http.StatusMultipleChoices {
		return nil, fmt.Errorf("credentials: status code %d: %s", c, body)
	}
	var stsResp TokenResponse
	if err := json.Unmarshal(body, &stsResp); err != nil {
		return nil, fmt.Errorf("credentials: failed to unmarshal response body from Secure Token Server: %w", err)
	}

	return &stsResp, nil
}

// TokenRequest contains fields necessary to make an oauth2 token
// exchange.
type TokenRequest struct {
	ActingParty struct {
		ActorToken     string
		ActorTokenType string
	}
	GrantType          string
	Resource           string
	Audience           string
	Scope              []string
	RequestedTokenType string
	SubjectToken       string
	SubjectTokenType   string
}

// TokenResponse is used to decode the remote server response during
// an oauth2 token exchange.
type TokenResponse struct {
	AccessToken     string `json:"access_token"`
	IssuedTokenType string `json:"issued_token_type"`
	TokenType       string `json:"token_type"`
	ExpiresIn       int    `json:"expires_in"`
	Scope           string `json:"scope"`
	RefreshToken    string `json:"refresh_token"`
}

// ClientAuthentication represents an OAuth client ID and secret and the
// mechanism for passing these credentials as stated in rfc6749#2.3.1.
type ClientAuthentication struct {
	AuthStyle    auth.Style
	ClientID     string
	ClientSecret string
}

// InjectAuthentication is used to add authentication to a Secure Token Service
// exchange request.  It modifies either the passed url.Values or http.Header
// depending on the desired authentication format.
func (c *ClientAuthentication) InjectAuthentication(values url.Values, headers http.Header) {
	if c.ClientID == "" || c.ClientSecret == "" || values == nil || headers == nil {
		return
	}
	switch c.AuthStyle {
	case auth.StyleInHeader:
		plainHeader := c.ClientID + ":" + c.ClientSecret
		headers.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(plainHeader)))
	default:
		values.Set("client_id", c.ClientID)
		values.Set("client_secret", c.ClientSecret)
	}
}
