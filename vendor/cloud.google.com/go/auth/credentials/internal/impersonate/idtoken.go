// Copyright 2025 Google LLC
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
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/internal"
	"github.com/googleapis/gax-go/v2/internallog"
)

var (
	universeDomainPlaceholder            = "UNIVERSE_DOMAIN"
	iamCredentialsUniverseDomainEndpoint = "https://iamcredentials.UNIVERSE_DOMAIN"
)

// IDTokenIAMOptions provides configuration for [IDTokenIAMOptions.Token].
type IDTokenIAMOptions struct {
	// Client is required.
	Client *http.Client
	// Logger is required.
	Logger              *slog.Logger
	UniverseDomain      auth.CredentialsPropertyProvider
	ServiceAccountEmail string
	GenerateIDTokenRequest
}

// GenerateIDTokenRequest holds the request to the IAM generateIdToken RPC.
type GenerateIDTokenRequest struct {
	Audience     string `json:"audience"`
	IncludeEmail bool   `json:"includeEmail"`
	// Delegates are the ordered, fully-qualified resource name for service
	// accounts in a delegation chain. Each service account must be granted
	// roles/iam.serviceAccountTokenCreator on the next service account in the
	// chain. The delegates must have the following format:
	// projects/-/serviceAccounts/{ACCOUNT_EMAIL_OR_UNIQUEID}. The - wildcard
	// character is required; replacing it with a project ID is invalid.
	// Optional.
	Delegates []string `json:"delegates,omitempty"`
}

// GenerateIDTokenResponse holds the response from the IAM generateIdToken RPC.
type GenerateIDTokenResponse struct {
	Token string `json:"token"`
}

// Token call IAM generateIdToken with the configuration provided in [IDTokenIAMOptions].
func (o IDTokenIAMOptions) Token(ctx context.Context) (*auth.Token, error) {
	universeDomain, err := o.UniverseDomain.GetProperty(ctx)
	if err != nil {
		return nil, err
	}
	endpoint := strings.Replace(iamCredentialsUniverseDomainEndpoint, universeDomainPlaceholder, universeDomain, 1)
	url := fmt.Sprintf("%s/v1/%s:generateIdToken", endpoint, internal.FormatIAMServiceAccountResource(o.ServiceAccountEmail))

	bodyBytes, err := json.Marshal(o.GenerateIDTokenRequest)
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	o.Logger.DebugContext(ctx, "impersonated idtoken request", "request", internallog.HTTPRequest(req, bodyBytes))
	resp, body, err := internal.DoRequest(o.Client, req)
	if err != nil {
		return nil, fmt.Errorf("impersonate: unable to generate ID token: %w", err)
	}
	o.Logger.DebugContext(ctx, "impersonated idtoken response", "response", internallog.HTTPResponse(resp, body))
	if c := resp.StatusCode; c < 200 || c > 299 {
		return nil, fmt.Errorf("impersonate: status code %d: %s", c, body)
	}

	var tokenResp GenerateIDTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("impersonate: unable to parse response: %w", err)
	}
	return &auth.Token{
		Value: tokenResp.Token,
		// Generated ID tokens are good for one hour.
		Expiry: time.Now().Add(1 * time.Hour),
	}, nil
}
