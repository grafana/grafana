// Copyright 2021 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package impersonate

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"google.golang.org/api/internal"
	"google.golang.org/api/option"
	"google.golang.org/api/option/internaloption"
	htransport "google.golang.org/api/transport/http"
)

var (
	iamCredentailsEndpoint                      = "https://iamcredentials.googleapis.com"
	oauth2Endpoint                              = "https://oauth2.googleapis.com"
	errMissingTargetPrincipal                   = errors.New("impersonate: a target service account must be provided")
	errMissingScopes                            = errors.New("impersonate: scopes must be provided")
	errLifetimeOverMax                          = errors.New("impersonate: max lifetime is 12 hours")
	errUniverseNotSupportedDomainWideDelegation = errors.New("impersonate: service account user is configured for the credential. " +
		"Domain-wide delegation is not supported in universes other than googleapis.com")
)

// CredentialsConfig for generating impersonated credentials.
type CredentialsConfig struct {
	// TargetPrincipal is the email address of the service account to
	// impersonate. Required.
	TargetPrincipal string
	// Scopes that the impersonated credential should have. Required.
	Scopes []string
	// Delegates are the service account email addresses in a delegation chain.
	// Each service account must be granted roles/iam.serviceAccountTokenCreator
	// on the next service account in the chain. Optional.
	Delegates []string
	// Lifetime is the amount of time until the impersonated token expires. If
	// unset the token's lifetime will be one hour and be automatically
	// refreshed. If set the token may have a max lifetime of one hour and will
	// not be refreshed. Service accounts that have been added to an org policy
	// with constraints/iam.allowServiceAccountCredentialLifetimeExtension may
	// request a token lifetime of up to 12 hours. Optional.
	Lifetime time.Duration
	// Subject is the sub field of a JWT. This field should only be set if you
	// wish to impersonate as a user. This feature is useful when using domain
	// wide delegation. Optional.
	Subject string
}

// defaultClientOptions ensures the base credentials will work with the IAM
// Credentials API if no scope or audience is set by the user.
func defaultClientOptions() []option.ClientOption {
	return []option.ClientOption{
		internaloption.WithDefaultAudience("https://iamcredentials.googleapis.com/"),
		internaloption.WithDefaultScopes("https://www.googleapis.com/auth/cloud-platform"),
	}
}

// CredentialsTokenSource returns an impersonated CredentialsTokenSource configured with the provided
// config and using credentials loaded from Application Default Credentials as
// the base credentials.
func CredentialsTokenSource(ctx context.Context, config CredentialsConfig, opts ...option.ClientOption) (oauth2.TokenSource, error) {
	if config.TargetPrincipal == "" {
		return nil, errMissingTargetPrincipal
	}
	if len(config.Scopes) == 0 {
		return nil, errMissingScopes
	}
	if config.Lifetime.Hours() > 12 {
		return nil, errLifetimeOverMax
	}

	var isStaticToken bool
	// Default to the longest acceptable value of one hour as the token will
	// be refreshed automatically if not set.
	lifetime := 3600 * time.Second
	if config.Lifetime != 0 {
		lifetime = config.Lifetime
		// Don't auto-refresh token if a lifetime is configured.
		isStaticToken = true
	}

	clientOpts := append(defaultClientOptions(), opts...)
	client, _, err := htransport.NewClient(ctx, clientOpts...)
	if err != nil {
		return nil, err
	}
	// If a subject is specified a domain-wide delegation auth-flow is initiated
	// to impersonate as the provided subject (user).
	if config.Subject != "" {
		settings, err := newSettings(clientOpts)
		if err != nil {
			return nil, err
		}
		if !settings.IsUniverseDomainGDU() {
			return nil, errUniverseNotSupportedDomainWideDelegation
		}
		return user(ctx, config, client, lifetime, isStaticToken)
	}

	its := impersonatedTokenSource{
		client:          client,
		targetPrincipal: config.TargetPrincipal,
		lifetime:        fmt.Sprintf("%.fs", lifetime.Seconds()),
	}
	for _, v := range config.Delegates {
		its.delegates = append(its.delegates, formatIAMServiceAccountName(v))
	}
	its.scopes = make([]string, len(config.Scopes))
	copy(its.scopes, config.Scopes)

	if isStaticToken {
		tok, err := its.Token()
		if err != nil {
			return nil, err
		}
		return oauth2.StaticTokenSource(tok), nil
	}
	return oauth2.ReuseTokenSource(nil, its), nil
}

func newSettings(opts []option.ClientOption) (*internal.DialSettings, error) {
	var o internal.DialSettings
	for _, opt := range opts {
		opt.Apply(&o)
	}
	if err := o.Validate(); err != nil {
		return nil, err
	}

	return &o, nil
}

func formatIAMServiceAccountName(name string) string {
	return fmt.Sprintf("projects/-/serviceAccounts/%s", name)
}

type generateAccessTokenReq struct {
	Delegates []string `json:"delegates,omitempty"`
	Lifetime  string   `json:"lifetime,omitempty"`
	Scope     []string `json:"scope,omitempty"`
}

type generateAccessTokenResp struct {
	AccessToken string `json:"accessToken"`
	ExpireTime  string `json:"expireTime"`
}

type impersonatedTokenSource struct {
	client *http.Client

	targetPrincipal string
	lifetime        string
	scopes          []string
	delegates       []string
}

// Token returns an impersonated Token.
func (i impersonatedTokenSource) Token() (*oauth2.Token, error) {
	reqBody := generateAccessTokenReq{
		Delegates: i.delegates,
		Lifetime:  i.lifetime,
		Scope:     i.scopes,
	}
	b, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to marshal request: %v", err)
	}
	url := fmt.Sprintf("%s/v1/%s:generateAccessToken", iamCredentailsEndpoint, formatIAMServiceAccountName(i.targetPrincipal))
	req, err := http.NewRequest("POST", url, bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := i.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to generate access token: %v", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to read body: %v", err)
	}
	if c := resp.StatusCode; c < 200 || c > 299 {
		return nil, fmt.Errorf("impersonate: status code %d: %s", c, body)
	}

	var accessTokenResp generateAccessTokenResp
	if err := json.Unmarshal(body, &accessTokenResp); err != nil {
		return nil, fmt.Errorf("impersonate: unable to parse response: %v", err)
	}
	expiry, err := time.Parse(time.RFC3339, accessTokenResp.ExpireTime)
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to parse expiry: %v", err)
	}
	return &oauth2.Token{
		AccessToken: accessTokenResp.AccessToken,
		Expiry:      expiry,
	}, nil
}
