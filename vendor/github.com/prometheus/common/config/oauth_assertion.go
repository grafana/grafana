// Copyright 2025 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
)

var (
	defaultGrantType        = "urn:ietf:params:oauth:grant-type:jwt-bearer"
	validSignatureAlgorithm = []string{"RS256", "RS384", "RS512"}
)

// Config is the configuration for using JWT to fetch tokens,
// commonly known as "two-legged OAuth 2.0".
type JwtGrantTypeConfig struct {
	// Iss is the OAuth client identifier used when communicating with
	// the configured OAuth provider.
	Iss string

	// PrivateKey contains the contents of an RSA private key or the
	// contents of a PEM file that contains a private key. The provided
	// private key is used to sign JWT payloads.
	// PEM containers with a passphrase are not supported.
	// Use the following command to convert a PKCS 12 file into a PEM.
	//
	//    $ openssl pkcs12 -in key.p12 -out key.pem -nodes
	//
	PrivateKey []byte

	// SigningAlgorithm is the RSA algorithm used to sign JWT payloads
	SigningAlgorithm *jwt.SigningMethodRSA

	// PrivateKeyID contains an optional hint indicating which key is being
	// used.
	PrivateKeyID string

	// Subject is the optional user to impersonate.
	Subject string

	// Scopes optionally specifies a list of requested permission scopes.
	Scopes []string

	// TokenURL is the endpoint required to complete the 2-legged JWT flow.
	TokenURL string

	// EndpointParams specifies additional parameters for requests to the token endpoint.
	EndpointParams url.Values

	// Expires optionally specifies how long the token is valid for.
	Expires time.Duration

	// Audience optionally specifies the intended audience of the
	// request.  If empty, the value of TokenURL is used as the
	// intended audience.
	Audience string

	// PrivateClaims optionally specifies custom private claims in the JWT.
	// See http://tools.ietf.org/html/draft-jones-json-web-token-10#section-4.3
	PrivateClaims map[string]any
}

// TokenSource returns a JWT TokenSource using the configuration
// in c and the HTTP client from the provided context.
func (c *JwtGrantTypeConfig) TokenSource(ctx context.Context) oauth2.TokenSource {
	return oauth2.ReuseTokenSource(nil, jwtSource{ctx, c})
}

// Client returns an HTTP client wrapping the context's
// HTTP transport and adding Authorization headers with tokens
// obtained from c.
//
// The returned client and its Transport should not be modified.
func (c *JwtGrantTypeConfig) Client(ctx context.Context) *http.Client {
	return oauth2.NewClient(ctx, c.TokenSource(ctx))
}

// jwtSource is a source that always does a signed JWT request for a token.
// It should typically be wrapped with a reuseTokenSource.
type jwtSource struct {
	ctx  context.Context
	conf *JwtGrantTypeConfig
}

func (js jwtSource) Token() (*oauth2.Token, error) {
	pk, err := jwt.ParseRSAPrivateKeyFromPEM(js.conf.PrivateKey)
	if err != nil {
		return nil, err
	}
	hc := oauth2.NewClient(js.ctx, nil)
	audience := js.conf.TokenURL
	if aud := js.conf.Audience; aud != "" {
		audience = aud
	}
	expiration := time.Now().Add(10 * time.Minute)
	if t := js.conf.Expires; t > 0 {
		expiration = time.Now().Add(t)
	}
	scopes := strings.Join(js.conf.Scopes, " ")

	claims := jwt.MapClaims{
		"iss": js.conf.Iss,
		"sub": js.conf.Subject,
		"jti": uuid.New(),
		"aud": audience,
		"iat": jwt.NewNumericDate(time.Now()),
		"exp": jwt.NewNumericDate(expiration),
	}

	if len(scopes) > 0 {
		claims["scope"] = scopes
	}

	for k, v := range js.conf.PrivateClaims {
		claims[k] = v
	}

	assertion := jwt.NewWithClaims(js.conf.SigningAlgorithm, claims)
	if js.conf.PrivateKeyID != "" {
		assertion.Header["kid"] = js.conf.PrivateKeyID
	}
	payload, err := assertion.SignedString(pk)
	if err != nil {
		return nil, err
	}
	v := url.Values{}
	v.Set("grant_type", defaultGrantType)
	v.Set("assertion", payload)
	if len(scopes) > 0 {
		v.Set("scope", scopes)
	}

	for k, p := range js.conf.EndpointParams {
		// Allow grant_type to be overridden to allow interoperability with
		// non-compliant implementations.
		if _, ok := v[k]; ok && k != "grant_type" {
			return nil, fmt.Errorf("oauth2: cannot overwrite parameter %q", k)
		}
		v[k] = p
	}

	resp, err := hc.PostForm(js.conf.TokenURL, v)
	if err != nil {
		return nil, fmt.Errorf("oauth2: cannot fetch token: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("oauth2: cannot fetch token: %w", err)
	}
	if c := resp.StatusCode; c < 200 || c > 299 {
		return nil, &oauth2.RetrieveError{
			Response: resp,
			Body:     body,
		}
	}
	// tokenRes is the JSON response body.
	var tokenRes struct {
		oauth2.Token
	}
	if err := json.Unmarshal(body, &tokenRes); err != nil {
		return nil, fmt.Errorf("oauth2: cannot fetch token: %w", err)
	}
	token := &oauth2.Token{
		AccessToken: tokenRes.AccessToken,
		TokenType:   tokenRes.TokenType,
	}
	if secs := tokenRes.ExpiresIn; secs > 0 {
		token.Expiry = time.Now().Add(time.Duration(secs) * time.Second)
	}
	return token, nil
}
