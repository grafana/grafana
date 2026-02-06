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

package impersonate

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/internal"
	"github.com/googleapis/gax-go/v2/internallog"
)

const (
	defaultTokenLifetime = "3600s"
	authHeaderKey        = "Authorization"
)

// generateAccesstokenReq is used for service account impersonation
type generateAccessTokenReq struct {
	Delegates []string `json:"delegates,omitempty"`
	Lifetime  string   `json:"lifetime,omitempty"`
	Scope     []string `json:"scope,omitempty"`
}

type impersonateTokenResponse struct {
	AccessToken string `json:"accessToken"`
	ExpireTime  string `json:"expireTime"`
}

// NewTokenProvider uses a source credential, stored in Ts, to request an access token to the provided URL.
// Scopes can be defined when the access token is requested.
func NewTokenProvider(opts *Options) (auth.TokenProvider, error) {
	if err := opts.validate(); err != nil {
		return nil, err
	}
	return opts, nil
}

// Options for [NewTokenProvider].
type Options struct {
	// Tp is the source credential used to generate a token on the
	// impersonated service account. Required.
	Tp auth.TokenProvider

	// URL is the endpoint to call to generate a token
	// on behalf of the service account. Required.
	URL string
	// Scopes that the impersonated credential should have. Required.
	Scopes []string
	// Delegates are the service account email addresses in a delegation chain.
	// Each service account must be granted roles/iam.serviceAccountTokenCreator
	// on the next service account in the chain. Optional.
	Delegates []string
	// TokenLifetimeSeconds is the number of seconds the impersonation token will
	// be valid for. Defaults to 1 hour if unset. Optional.
	TokenLifetimeSeconds int
	// Client configures the underlying client used to make network requests
	// when fetching tokens. Required.
	Client *http.Client
	// Logger is used for debug logging. If provided, logging will be enabled
	// at the loggers configured level. By default logging is disabled unless
	// enabled by setting GOOGLE_SDK_GO_LOGGING_LEVEL in which case a default
	// logger will be used. Optional.
	Logger *slog.Logger
}

func (o *Options) validate() error {
	if o.Tp == nil {
		return errors.New("credentials: missing required 'source_credentials' field in impersonated credentials")
	}
	if o.URL == "" {
		return errors.New("credentials: missing required 'service_account_impersonation_url' field in impersonated credentials")
	}
	return nil
}

// Token performs the exchange to get a temporary service account token to allow access to GCP.
func (o *Options) Token(ctx context.Context) (*auth.Token, error) {
	logger := internallog.New(o.Logger)
	lifetime := defaultTokenLifetime
	if o.TokenLifetimeSeconds != 0 {
		lifetime = fmt.Sprintf("%ds", o.TokenLifetimeSeconds)
	}
	reqBody := generateAccessTokenReq{
		Lifetime:  lifetime,
		Scope:     o.Scopes,
		Delegates: o.Delegates,
	}
	b, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("credentials: unable to marshal request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", o.URL, bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("credentials: unable to create impersonation request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if err := setAuthHeader(ctx, o.Tp, req); err != nil {
		return nil, err
	}
	logger.DebugContext(ctx, "impersonated token request", "request", internallog.HTTPRequest(req, b))
	resp, body, err := internal.DoRequest(o.Client, req)
	if err != nil {
		return nil, fmt.Errorf("credentials: unable to generate access token: %w", err)
	}
	logger.DebugContext(ctx, "impersonated token response", "response", internallog.HTTPResponse(resp, body))
	if c := resp.StatusCode; c < http.StatusOK || c >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("credentials: status code %d: %s", c, body)
	}

	var accessTokenResp impersonateTokenResponse
	if err := json.Unmarshal(body, &accessTokenResp); err != nil {
		return nil, fmt.Errorf("credentials: unable to parse response: %w", err)
	}
	expiry, err := time.Parse(time.RFC3339, accessTokenResp.ExpireTime)
	if err != nil {
		return nil, fmt.Errorf("credentials: unable to parse expiry: %w", err)
	}
	return &auth.Token{
		Value:  accessTokenResp.AccessToken,
		Expiry: expiry,
		Type:   internal.TokenTypeBearer,
	}, nil
}

func setAuthHeader(ctx context.Context, tp auth.TokenProvider, r *http.Request) error {
	t, err := tp.Token(ctx)
	if err != nil {
		return err
	}
	typ := t.Type
	if typ == "" {
		typ = internal.TokenTypeBearer
	}
	r.Header.Set(authHeaderKey, typ+" "+t.Value)
	return nil
}
