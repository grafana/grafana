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

package credentials

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/internal"
	"cloud.google.com/go/auth/internal/credsfile"
	"cloud.google.com/go/compute/metadata"
	"github.com/googleapis/gax-go/v2/internallog"
)

const (
	// jwtTokenURL is Google's OAuth 2.0 token URL to use with the JWT(2LO) flow.
	jwtTokenURL = "https://oauth2.googleapis.com/token"

	// Google's OAuth 2.0 default endpoints.
	googleAuthURL  = "https://accounts.google.com/o/oauth2/auth"
	googleTokenURL = "https://oauth2.googleapis.com/token"

	// GoogleMTLSTokenURL is Google's default OAuth2.0 mTLS endpoint.
	GoogleMTLSTokenURL = "https://oauth2.mtls.googleapis.com/token"

	// Help on default credentials
	adcSetupURL = "https://cloud.google.com/docs/authentication/external/set-up-adc"
)

var (
	// for testing
	allowOnGCECheck = true
)

// TokenBindingType specifies the type of binding used when requesting a token
// whether to request a hard-bound token using mTLS or an instance identity
// bound token using ALTS.
type TokenBindingType int

const (
	// NoBinding specifies that requested tokens are not required to have a
	// binding. This is the default option.
	NoBinding TokenBindingType = iota
	// MTLSHardBinding specifies that a hard-bound token should be requested
	// using an mTLS with S2A channel.
	MTLSHardBinding
	// ALTSHardBinding specifies that an instance identity bound token should
	// be requested using an ALTS channel.
	ALTSHardBinding
)

// OnGCE reports whether this process is running in Google Cloud.
func OnGCE() bool {
	// TODO(codyoss): once all libs use this auth lib move metadata check here
	return allowOnGCECheck && metadata.OnGCE()
}

// DetectDefault searches for "Application Default Credentials" and returns
// a credential based on the [DetectOptions] provided.
//
// It looks for credentials in the following places, preferring the first
// location found:
//
//   - A JSON file whose path is specified by the GOOGLE_APPLICATION_CREDENTIALS
//     environment variable. For workload identity federation, refer to
//     https://cloud.google.com/iam/docs/how-to#using-workload-identity-federation
//     on how to generate the JSON configuration file for on-prem/non-Google
//     cloud platforms.
//   - A JSON file in a location known to the gcloud command-line tool. On
//     Windows, this is %APPDATA%/gcloud/application_default_credentials.json. On
//     other systems, $HOME/.config/gcloud/application_default_credentials.json.
//   - On Google Compute Engine, Google App Engine standard second generation
//     runtimes, and Google App Engine flexible environment, it fetches
//     credentials from the metadata server.
func DetectDefault(opts *DetectOptions) (*auth.Credentials, error) {
	if err := opts.validate(); err != nil {
		return nil, err
	}
	if len(opts.CredentialsJSON) > 0 {
		return readCredentialsFileJSON(opts.CredentialsJSON, opts)
	}
	if opts.CredentialsFile != "" {
		return readCredentialsFile(opts.CredentialsFile, opts)
	}
	if filename := os.Getenv(credsfile.GoogleAppCredsEnvVar); filename != "" {
		creds, err := readCredentialsFile(filename, opts)
		if err != nil {
			return nil, err
		}
		return creds, nil
	}

	fileName := credsfile.GetWellKnownFileName()
	if b, err := os.ReadFile(fileName); err == nil {
		return readCredentialsFileJSON(b, opts)
	}

	if OnGCE() {
		metadataClient := metadata.NewWithOptions(&metadata.Options{
			Logger: opts.logger(),
		})
		return auth.NewCredentials(&auth.CredentialsOptions{
			TokenProvider: computeTokenProvider(opts, metadataClient),
			ProjectIDProvider: auth.CredentialsPropertyFunc(func(ctx context.Context) (string, error) {
				return metadataClient.ProjectIDWithContext(ctx)
			}),
			UniverseDomainProvider: &internal.ComputeUniverseDomainProvider{
				MetadataClient: metadataClient,
			},
		}), nil
	}

	return nil, fmt.Errorf("credentials: could not find default credentials. See %v for more information", adcSetupURL)
}

// DetectOptions provides configuration for [DetectDefault].
type DetectOptions struct {
	// Scopes that credentials tokens should have. Example:
	// https://www.googleapis.com/auth/cloud-platform. Required if Audience is
	// not provided.
	Scopes []string
	// TokenBindingType specifies the type of binding used when requesting a
	// token whether to request a hard-bound token using mTLS or an instance
	// identity bound token using ALTS. Optional.
	TokenBindingType TokenBindingType
	// Audience that credentials tokens should have. Only applicable for 2LO
	// flows with service accounts. If specified, scopes should not be provided.
	Audience string
	// Subject is the user email used for [domain wide delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority).
	// Optional.
	Subject string
	// EarlyTokenRefresh configures how early before a token expires that it
	// should be refreshed. Once the token’s time until expiration has entered
	// this refresh window the token is considered valid but stale. If unset,
	// the default value is 3 minutes and 45 seconds. Optional.
	EarlyTokenRefresh time.Duration
	// DisableAsyncRefresh configures a synchronous workflow that refreshes
	// stale tokens while blocking. The default is false. Optional.
	DisableAsyncRefresh bool
	// AuthHandlerOptions configures an authorization handler and other options
	// for 3LO flows. It is required, and only used, for client credential
	// flows.
	AuthHandlerOptions *auth.AuthorizationHandlerOptions
	// TokenURL allows to set the token endpoint for user credential flows. If
	// unset the default value is: https://oauth2.googleapis.com/token.
	// Optional.
	TokenURL string
	// STSAudience is the audience sent to when retrieving an STS token.
	// Currently this only used for GDCH auth flow, for which it is required.
	STSAudience string
	// CredentialsFile overrides detection logic and sources a credential file
	// from the provided filepath. If provided, CredentialsJSON must not be.
	// Optional.
	//
	// Important: If you accept a credential configuration (credential
	// JSON/File/Stream) from an external source for authentication to Google
	// Cloud Platform, you must validate it before providing it to any Google
	// API or library. Providing an unvalidated credential configuration to
	// Google APIs can compromise the security of your systems and data. For
	// more information, refer to [Validate credential configurations from
	// external sources](https://cloud.google.com/docs/authentication/external/externally-sourced-credentials).
	CredentialsFile string
	// CredentialsJSON overrides detection logic and uses the JSON bytes as the
	// source for the credential. If provided, CredentialsFile must not be.
	// Optional.
	//
	// Important: If you accept a credential configuration (credential
	// JSON/File/Stream) from an external source for authentication to Google
	// Cloud Platform, you must validate it before providing it to any Google
	// API or library. Providing an unvalidated credential configuration to
	// Google APIs can compromise the security of your systems and data. For
	// more information, refer to [Validate credential configurations from
	// external sources](https://cloud.google.com/docs/authentication/external/externally-sourced-credentials).
	CredentialsJSON []byte
	// UseSelfSignedJWT directs service account based credentials to create a
	// self-signed JWT with the private key found in the file, skipping any
	// network requests that would normally be made. Optional.
	UseSelfSignedJWT bool
	// Client configures the underlying client used to make network requests
	// when fetching tokens. Optional.
	Client *http.Client
	// UniverseDomain is the default service domain for a given Cloud universe.
	// The default value is "googleapis.com". This option is ignored for
	// authentication flows that do not support universe domain. Optional.
	UniverseDomain string
	// Logger is used for debug logging. If provided, logging will be enabled
	// at the loggers configured level. By default logging is disabled unless
	// enabled by setting GOOGLE_SDK_GO_LOGGING_LEVEL in which case a default
	// logger will be used. Optional.
	Logger *slog.Logger
}

func (o *DetectOptions) validate() error {
	if o == nil {
		return errors.New("credentials: options must be provided")
	}
	if len(o.Scopes) > 0 && o.Audience != "" {
		return errors.New("credentials: both scopes and audience were provided")
	}
	if len(o.CredentialsJSON) > 0 && o.CredentialsFile != "" {
		return errors.New("credentials: both credentials file and JSON were provided")
	}
	return nil
}

func (o *DetectOptions) tokenURL() string {
	if o.TokenURL != "" {
		return o.TokenURL
	}
	return googleTokenURL
}

func (o *DetectOptions) scopes() []string {
	scopes := make([]string, len(o.Scopes))
	copy(scopes, o.Scopes)
	return scopes
}

func (o *DetectOptions) client() *http.Client {
	if o.Client != nil {
		return o.Client
	}
	return internal.DefaultClient()
}

func (o *DetectOptions) logger() *slog.Logger {
	return internallog.New(o.Logger)
}

func readCredentialsFile(filename string, opts *DetectOptions) (*auth.Credentials, error) {
	b, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	return readCredentialsFileJSON(b, opts)
}

func readCredentialsFileJSON(b []byte, opts *DetectOptions) (*auth.Credentials, error) {
	// attempt to parse jsonData as a Google Developers Console client_credentials.json.
	config := clientCredConfigFromJSON(b, opts)
	if config != nil {
		if config.AuthHandlerOpts == nil {
			return nil, errors.New("credentials: auth handler must be specified for this credential filetype")
		}
		tp, err := auth.New3LOTokenProvider(config)
		if err != nil {
			return nil, err
		}
		return auth.NewCredentials(&auth.CredentialsOptions{
			TokenProvider: tp,
			JSON:          b,
		}), nil
	}
	return fileCredentials(b, opts)
}

func clientCredConfigFromJSON(b []byte, opts *DetectOptions) *auth.Options3LO {
	var creds credsfile.ClientCredentialsFile
	var c *credsfile.Config3LO
	if err := json.Unmarshal(b, &creds); err != nil {
		return nil
	}
	switch {
	case creds.Web != nil:
		c = creds.Web
	case creds.Installed != nil:
		c = creds.Installed
	default:
		return nil
	}
	if len(c.RedirectURIs) < 1 {
		return nil
	}
	var handleOpts *auth.AuthorizationHandlerOptions
	if opts.AuthHandlerOptions != nil {
		handleOpts = &auth.AuthorizationHandlerOptions{
			Handler:  opts.AuthHandlerOptions.Handler,
			State:    opts.AuthHandlerOptions.State,
			PKCEOpts: opts.AuthHandlerOptions.PKCEOpts,
		}
	}
	return &auth.Options3LO{
		ClientID:         c.ClientID,
		ClientSecret:     c.ClientSecret,
		RedirectURL:      c.RedirectURIs[0],
		Scopes:           opts.scopes(),
		AuthURL:          c.AuthURI,
		TokenURL:         c.TokenURI,
		Client:           opts.client(),
		Logger:           opts.logger(),
		EarlyTokenExpiry: opts.EarlyTokenRefresh,
		AuthHandlerOpts:  handleOpts,
		// TODO(codyoss): refactor this out. We need to add in auto-detection
		// for this use case.
		AuthStyle: auth.StyleInParams,
	}
}
