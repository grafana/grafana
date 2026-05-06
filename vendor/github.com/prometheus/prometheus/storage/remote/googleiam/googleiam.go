// Copyright 2024 The Prometheus Authors
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

// Package googleiam provides an http.RoundTripper that attaches an Google Cloud accessToken
// to remote write requests.
package googleiam

import (
	"context"
	"fmt"
	"net/http"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	apihttp "google.golang.org/api/transport/http"
)

type Config struct {
	CredentialsFile string `yaml:"credentials_file,omitempty"`
}

// NewRoundTripper creates a round tripper that adds Google Cloud Monitoring authorization to calls
// using either a credentials file or the default credentials.
func NewRoundTripper(cfg *Config, next http.RoundTripper) (http.RoundTripper, error) {
	if next == nil {
		next = http.DefaultTransport
	}
	const scopes = "https://www.googleapis.com/auth/monitoring.write"
	ctx := context.Background()
	opts := []option.ClientOption{
		option.WithScopes(scopes),
	}
	if cfg.CredentialsFile != "" {
		opts = append(opts, option.WithCredentialsFile(cfg.CredentialsFile))
	} else {
		creds, err := google.FindDefaultCredentials(ctx, scopes)
		if err != nil {
			return nil, fmt.Errorf("error finding default Google credentials: %w", err)
		}
		opts = append(opts, option.WithCredentials(creds))
	}

	return apihttp.NewTransport(ctx, next, opts...)
}
