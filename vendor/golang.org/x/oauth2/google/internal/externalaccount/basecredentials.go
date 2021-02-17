// Copyright 2020 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package externalaccount

import (
	"context"
	"fmt"
	"golang.org/x/oauth2"
	"net/http"
	"time"
)

// now aliases time.Now for testing
var now = time.Now

// Config stores the configuration for fetching tokens with external credentials.
type Config struct {
	Audience                       string
	SubjectTokenType               string
	TokenURL                       string
	TokenInfoURL                   string
	ServiceAccountImpersonationURL string
	ClientSecret                   string
	ClientID                       string
	CredentialSource               CredentialSource
	QuotaProjectID                 string
	Scopes                         []string
}

// TokenSource Returns an external account TokenSource struct. This is to be called by package google to construct a google.Credentials.
func (c *Config) TokenSource(ctx context.Context) oauth2.TokenSource {
	ts := tokenSource{
		ctx:  ctx,
		conf: c,
	}
	return oauth2.ReuseTokenSource(nil, ts)
}

// Subject token file types.
const (
	fileTypeText = "text"
	fileTypeJSON = "json"
)

type format struct {
	// Type is either "text" or "json".  When not provided "text" type is assumed.
	Type string `json:"type"`
	// SubjectTokenFieldName is only required for JSON format.  This would be "access_token" for azure.
	SubjectTokenFieldName string `json:"subject_token_field_name"`
}

// CredentialSource stores the information necessary to retrieve the credentials for the STS exchange.
type CredentialSource struct {
	File string `json:"file"`

	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`

	EnvironmentID               string `json:"environment_id"`
	RegionURL                   string `json:"region_url"`
	RegionalCredVerificationURL string `json:"regional_cred_verification_url"`
	CredVerificationURL         string `json:"cred_verification_url"`
	Format                      format `json:"format"`
}

// parse determines the type of CredentialSource needed
func (c *Config) parse(ctx context.Context) baseCredentialSource {
	if c.CredentialSource.File != "" {
		return fileCredentialSource{File: c.CredentialSource.File, Format: c.CredentialSource.Format}
	} else if c.CredentialSource.URL != "" {
		return urlCredentialSource{URL: c.CredentialSource.URL, Format: c.CredentialSource.Format, ctx: ctx}
	}
	return nil
}

type baseCredentialSource interface {
	subjectToken() (string, error)
}

// tokenSource is the source that handles external credentials.
type tokenSource struct {
	ctx  context.Context
	conf *Config
}

// Token allows tokenSource to conform to the oauth2.TokenSource interface.
func (ts tokenSource) Token() (*oauth2.Token, error) {
	conf := ts.conf

	credSource := conf.parse(ts.ctx)
	if credSource == nil {
		return nil, fmt.Errorf("oauth2/google: unable to parse credential source")
	}
	subjectToken, err := credSource.subjectToken()
	if err != nil {
		return nil, err
	}
	stsRequest := STSTokenExchangeRequest{
		GrantType:          "urn:ietf:params:oauth:grant-type:token-exchange",
		Audience:           conf.Audience,
		Scope:              conf.Scopes,
		RequestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
		SubjectToken:       subjectToken,
		SubjectTokenType:   conf.SubjectTokenType,
	}
	header := make(http.Header)
	header.Add("Content-Type", "application/x-www-form-urlencoded")
	clientAuth := ClientAuthentication{
		AuthStyle:    oauth2.AuthStyleInHeader,
		ClientID:     conf.ClientID,
		ClientSecret: conf.ClientSecret,
	}
	stsResp, err := ExchangeToken(ts.ctx, conf.TokenURL, &stsRequest, clientAuth, header, nil)
	if err != nil {
		return nil, err
	}

	accessToken := &oauth2.Token{
		AccessToken: stsResp.AccessToken,
		TokenType:   stsResp.TokenType,
	}
	if stsResp.ExpiresIn < 0 {
		return nil, fmt.Errorf("oauth2/google: got invalid expiry from security token service")
	} else if stsResp.ExpiresIn >= 0 {
		accessToken.Expiry = now().Add(time.Duration(stsResp.ExpiresIn) * time.Second)
	}

	if stsResp.RefreshToken != "" {
		accessToken.RefreshToken = stsResp.RefreshToken
	}

	return accessToken, nil
}
