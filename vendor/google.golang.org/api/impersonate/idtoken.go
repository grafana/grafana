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
	"time"

	"golang.org/x/oauth2"
	"google.golang.org/api/option"
	htransport "google.golang.org/api/transport/http"
)

// IDTokenConfig for generating an impersonated ID token.
type IDTokenConfig struct {
	// Audience is the `aud` field for the token, such as an API endpoint the
	// token will grant access to. Required.
	Audience string
	// TargetPrincipal is the email address of the service account to
	// impersonate. Required.
	TargetPrincipal string
	// IncludeEmail includes the service account's email in the token. The
	// resulting token will include both an `email` and `email_verified`
	// claim.
	IncludeEmail bool
	// Delegates are the service account email addresses in a delegation chain.
	// Each service account must be granted roles/iam.serviceAccountTokenCreator
	// on the next service account in the chain. Optional.
	Delegates []string
}

// IDTokenSource creates an impersonated TokenSource that returns ID tokens
// configured with the provided config and using credentials loaded from
// Application Default Credentials as the base credentials. The tokens provided
// by the source are valid for one hour and are automatically refreshed.
func IDTokenSource(ctx context.Context, config IDTokenConfig, opts ...option.ClientOption) (oauth2.TokenSource, error) {
	if config.Audience == "" {
		return nil, fmt.Errorf("impersonate: an audience must be provided")
	}
	if config.TargetPrincipal == "" {
		return nil, fmt.Errorf("impersonate: a target service account must be provided")
	}

	clientOpts := append(defaultClientOptions(), opts...)
	client, _, err := htransport.NewClient(ctx, clientOpts...)
	if err != nil {
		return nil, err
	}

	its := impersonatedIDTokenSource{
		client:          client,
		targetPrincipal: config.TargetPrincipal,
		audience:        config.Audience,
		includeEmail:    config.IncludeEmail,
	}
	for _, v := range config.Delegates {
		its.delegates = append(its.delegates, formatIAMServiceAccountName(v))
	}
	return oauth2.ReuseTokenSource(nil, its), nil
}

type generateIDTokenRequest struct {
	Audience     string   `json:"audience"`
	IncludeEmail bool     `json:"includeEmail"`
	Delegates    []string `json:"delegates,omitempty"`
}

type generateIDTokenResponse struct {
	Token string `json:"token"`
}

type impersonatedIDTokenSource struct {
	client *http.Client

	targetPrincipal string
	audience        string
	includeEmail    bool
	delegates       []string
}

func (i impersonatedIDTokenSource) Token() (*oauth2.Token, error) {
	now := time.Now()
	genIDTokenReq := generateIDTokenRequest{
		Audience:     i.audience,
		IncludeEmail: i.includeEmail,
		Delegates:    i.delegates,
	}
	bodyBytes, err := json.Marshal(genIDTokenReq)
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to marshal request: %v", err)
	}

	url := fmt.Sprintf("%s/v1/%s:generateIdToken", iamCredentailsEndpoint, formatIAMServiceAccountName(i.targetPrincipal))
	req, err := http.NewRequest("POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := i.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to generate ID token: %v", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to read body: %v", err)
	}
	if c := resp.StatusCode; c < 200 || c > 299 {
		return nil, fmt.Errorf("impersonate: status code %d: %s", c, body)
	}

	var generateIDTokenResp generateIDTokenResponse
	if err := json.Unmarshal(body, &generateIDTokenResp); err != nil {
		return nil, fmt.Errorf("impersonate: unable to parse response: %v", err)
	}
	return &oauth2.Token{
		AccessToken: generateIDTokenResp.Token,
		// Generated ID tokens are good for one hour.
		Expiry: now.Add(1 * time.Hour),
	}, nil
}
