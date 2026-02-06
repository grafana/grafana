// Copyright 2021 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package impersonate

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/oauth2"
)

// user provides an auth flow for domain-wide delegation, setting
// CredentialsConfig.Subject to be the impersonated user.
func user(ctx context.Context, c CredentialsConfig, client *http.Client, lifetime time.Duration, isStaticToken bool) (oauth2.TokenSource, error) {
	u := userTokenSource{
		client:          client,
		targetPrincipal: c.TargetPrincipal,
		subject:         c.Subject,
		lifetime:        lifetime,
	}
	u.delegates = make([]string, len(c.Delegates))
	for i, v := range c.Delegates {
		u.delegates[i] = formatIAMServiceAccountName(v)
	}
	u.scopes = make([]string, len(c.Scopes))
	copy(u.scopes, c.Scopes)
	if isStaticToken {
		tok, err := u.Token()
		if err != nil {
			return nil, err
		}
		return oauth2.StaticTokenSource(tok), nil
	}
	return oauth2.ReuseTokenSource(nil, u), nil
}

type claimSet struct {
	Iss   string `json:"iss"`
	Scope string `json:"scope,omitempty"`
	Sub   string `json:"sub,omitempty"`
	Aud   string `json:"aud"`
	Iat   int64  `json:"iat"`
	Exp   int64  `json:"exp"`
}

type signJWTRequest struct {
	Payload   string   `json:"payload"`
	Delegates []string `json:"delegates,omitempty"`
}

type signJWTResponse struct {
	// KeyID is the key used to sign the JWT.
	KeyID string `json:"keyId"`
	// SignedJwt contains the automatically generated header; the
	// client-supplied payload; and the signature, which is generated using
	// the key referenced by the `kid` field in the header.
	SignedJWT string `json:"signedJwt"`
}

type exchangeTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int64  `json:"expires_in"`
}

type userTokenSource struct {
	client *http.Client

	targetPrincipal string
	subject         string
	scopes          []string
	lifetime        time.Duration
	delegates       []string
}

func (u userTokenSource) Token() (*oauth2.Token, error) {
	signedJWT, err := u.signJWT()
	if err != nil {
		return nil, err
	}
	return u.exchangeToken(signedJWT)
}

func (u userTokenSource) signJWT() (string, error) {
	now := time.Now()
	exp := now.Add(u.lifetime)
	claims := claimSet{
		Iss:   u.targetPrincipal,
		Scope: strings.Join(u.scopes, " "),
		Sub:   u.subject,
		Aud:   fmt.Sprintf("%s/token", oauth2Endpoint),
		Iat:   now.Unix(),
		Exp:   exp.Unix(),
	}
	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("impersonate: unable to marshal claims: %v", err)
	}
	signJWTReq := signJWTRequest{
		Payload:   string(payloadBytes),
		Delegates: u.delegates,
	}

	bodyBytes, err := json.Marshal(signJWTReq)
	if err != nil {
		return "", fmt.Errorf("impersonate: unable to marshal request: %v", err)
	}
	reqURL := fmt.Sprintf("%s/v1/%s:signJwt", iamCredentailsEndpoint, formatIAMServiceAccountName(u.targetPrincipal))
	req, err := http.NewRequest("POST", reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("impersonate: unable to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	rawResp, err := u.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("impersonate: unable to sign JWT: %v", err)
	}
	body, err := io.ReadAll(io.LimitReader(rawResp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("impersonate: unable to read body: %v", err)
	}
	if c := rawResp.StatusCode; c < 200 || c > 299 {
		return "", fmt.Errorf("impersonate: status code %d: %s", c, body)
	}

	var signJWTResp signJWTResponse
	if err := json.Unmarshal(body, &signJWTResp); err != nil {
		return "", fmt.Errorf("impersonate: unable to parse response: %v", err)
	}
	return signJWTResp.SignedJWT, nil
}

func (u userTokenSource) exchangeToken(signedJWT string) (*oauth2.Token, error) {
	now := time.Now()
	v := url.Values{}
	v.Set("grant_type", "assertion")
	v.Set("assertion_type", "http://oauth.net/grant_type/jwt/1.0/bearer")
	v.Set("assertion", signedJWT)
	rawResp, err := u.client.PostForm(fmt.Sprintf("%s/token", oauth2Endpoint), v)
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to exchange token: %v", err)
	}
	body, err := io.ReadAll(io.LimitReader(rawResp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to read body: %v", err)
	}
	if c := rawResp.StatusCode; c < 200 || c > 299 {
		return nil, fmt.Errorf("impersonate: status code %d: %s", c, body)
	}

	var tokenResp exchangeTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("impersonate: unable to parse response: %v", err)
	}

	return &oauth2.Token{
		AccessToken: tokenResp.AccessToken,
		TokenType:   tokenResp.TokenType,
		Expiry:      now.Add(time.Second * time.Duration(tokenResp.ExpiresIn)),
	}, nil
}
