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

package externalaccountuser

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/credentials/internal/stsexchange"
	"cloud.google.com/go/auth/internal"
	"github.com/googleapis/gax-go/v2/internallog"
)

// Options stores the configuration for fetching tokens with external authorized
// user credentials.
type Options struct {
	// Audience is the Secure Token Service (STS) audience which contains the
	// resource name for the workforce pool and the provider identifier in that
	// pool.
	Audience string
	// RefreshToken is the OAuth 2.0 refresh token.
	RefreshToken string
	// TokenURL is the STS token exchange endpoint for refresh.
	TokenURL string
	// TokenInfoURL is the STS endpoint URL for token introspection. Optional.
	TokenInfoURL string
	// ClientID is only required in conjunction with ClientSecret, as described
	// below.
	ClientID string
	// ClientSecret is currently only required if token_info endpoint also needs
	// to be called with the generated a cloud access token. When provided, STS
	// will be called with additional basic authentication using client_id as
	// username and client_secret as password.
	ClientSecret string
	// Scopes contains the desired scopes for the returned access token.
	Scopes []string

	// Client for token request.
	Client *http.Client
	// Logger for logging.
	Logger *slog.Logger
}

func (c *Options) validate() bool {
	return c.ClientID != "" && c.ClientSecret != "" && c.RefreshToken != "" && c.TokenURL != ""
}

// NewTokenProvider returns a [cloud.google.com/go/auth.TokenProvider]
// configured with the provided options.
func NewTokenProvider(opts *Options) (auth.TokenProvider, error) {
	if !opts.validate() {
		return nil, errors.New("credentials: invalid external_account_authorized_user configuration")
	}

	tp := &tokenProvider{
		o: opts,
	}
	return auth.NewCachedTokenProvider(tp, nil), nil
}

type tokenProvider struct {
	o *Options
}

func (tp *tokenProvider) Token(ctx context.Context) (*auth.Token, error) {
	opts := tp.o

	clientAuth := stsexchange.ClientAuthentication{
		AuthStyle:    auth.StyleInHeader,
		ClientID:     opts.ClientID,
		ClientSecret: opts.ClientSecret,
	}
	headers := make(http.Header)
	headers.Set("Content-Type", "application/x-www-form-urlencoded")
	stsResponse, err := stsexchange.RefreshAccessToken(ctx, &stsexchange.Options{
		Client:         opts.Client,
		Endpoint:       opts.TokenURL,
		RefreshToken:   opts.RefreshToken,
		Authentication: clientAuth,
		Headers:        headers,
		Logger:         internallog.New(tp.o.Logger),
	})
	if err != nil {
		return nil, err
	}
	if stsResponse.ExpiresIn < 0 {
		return nil, errors.New("credentials: invalid expiry from security token service")
	}

	// guarded by the wrapping with CachedTokenProvider
	if stsResponse.RefreshToken != "" {
		opts.RefreshToken = stsResponse.RefreshToken
	}
	return &auth.Token{
		Value:  stsResponse.AccessToken,
		Expiry: time.Now().UTC().Add(time.Duration(stsResponse.ExpiresIn) * time.Second),
		Type:   internal.TokenTypeBearer,
	}, nil
}
