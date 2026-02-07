// Copyright 2017 Google LLC.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package internal supports the options and transport packages.
package internal

import (
	"crypto/tls"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"cloud.google.com/go/auth"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/internal/impersonate"
	"google.golang.org/grpc"
)

const (
	newAuthLibEnvVar        = "GOOGLE_API_GO_EXPERIMENTAL_ENABLE_NEW_AUTH_LIB"
	newAuthLibDisabledEnVar = "GOOGLE_API_GO_EXPERIMENTAL_DISABLE_NEW_AUTH_LIB"
	universeDomainEnvVar    = "GOOGLE_CLOUD_UNIVERSE_DOMAIN"
	defaultUniverseDomain   = "googleapis.com"
)

// DialSettings holds information needed to establish a connection with a
// Google API service.
type DialSettings struct {
	Endpoint                      string
	DefaultEndpoint               string
	DefaultEndpointTemplate       string
	DefaultMTLSEndpoint           string
	Scopes                        []string
	DefaultScopes                 []string
	EnableJwtWithScope            bool
	TokenSource                   oauth2.TokenSource
	Credentials                   *google.Credentials
	CredentialsFile               string // if set, Token Source is ignored.
	CredentialsJSON               []byte
	InternalCredentials           *google.Credentials
	UserAgent                     string
	APIKey                        string
	Audiences                     []string
	DefaultAudience               string
	HTTPClient                    *http.Client
	GRPCDialOpts                  []grpc.DialOption
	GRPCConn                      *grpc.ClientConn
	GRPCConnPool                  ConnPool
	GRPCConnPoolSize              int
	NoAuth                        bool
	TelemetryDisabled             bool
	ClientCertSource              func(*tls.CertificateRequestInfo) (*tls.Certificate, error)
	CustomClaims                  map[string]interface{}
	SkipValidation                bool
	ImpersonationConfig           *impersonate.Config
	EnableDirectPath              bool
	EnableDirectPathXds           bool
	AllowNonDefaultServiceAccount bool
	DefaultUniverseDomain         string
	UniverseDomain                string
	AllowHardBoundTokens          []string
	Logger                        *slog.Logger
	// Google API system parameters. For more information please read:
	// https://cloud.google.com/apis/docs/system-parameters
	QuotaProject  string
	RequestReason string

	// New Auth library Options
	AuthCredentials      *auth.Credentials
	EnableNewAuthLibrary bool

	// TODO(b/372244283): Remove after b/358175516 has been fixed
	EnableAsyncRefreshDryRun func()
}

// GetScopes returns the user-provided scopes, if set, or else falls back to the
// default scopes.
func (ds *DialSettings) GetScopes() []string {
	if len(ds.Scopes) > 0 {
		return ds.Scopes
	}
	return ds.DefaultScopes
}

// GetAudience returns the user-provided audience, if set, or else falls back to the default audience.
func (ds *DialSettings) GetAudience() string {
	if ds.HasCustomAudience() {
		return ds.Audiences[0]
	}
	return ds.DefaultAudience
}

// HasCustomAudience returns true if a custom audience is provided by users.
func (ds *DialSettings) HasCustomAudience() bool {
	return len(ds.Audiences) > 0
}

// IsNewAuthLibraryEnabled returns true if the new auth library should be used.
func (ds *DialSettings) IsNewAuthLibraryEnabled() bool {
	// Disabled env is for future rollouts to make sure there is a way to easily
	// disable this behaviour once we switch in on by default.
	if b, err := strconv.ParseBool(os.Getenv(newAuthLibDisabledEnVar)); err == nil && b {
		return false
	}
	if ds.EnableNewAuthLibrary {
		return true
	}
	if ds.AuthCredentials != nil {
		return true
	}
	if b, err := strconv.ParseBool(os.Getenv(newAuthLibEnvVar)); err == nil {
		return b
	}
	return false
}

// Validate reports an error if ds is invalid.
func (ds *DialSettings) Validate() error {
	if ds.SkipValidation {
		return nil
	}
	hasCreds := ds.APIKey != "" || ds.TokenSource != nil || ds.CredentialsFile != "" || ds.Credentials != nil
	if ds.NoAuth && hasCreds {
		return errors.New("options.WithoutAuthentication is incompatible with any option that provides credentials")
	}
	// Credentials should not appear with other options.
	// We currently allow TokenSource and CredentialsFile to coexist.
	// TODO(jba): make TokenSource & CredentialsFile an error (breaking change).
	nCreds := 0
	if ds.Credentials != nil {
		nCreds++
	}
	if len(ds.CredentialsJSON) > 0 {
		nCreds++
	}
	if ds.CredentialsFile != "" {
		nCreds++
	}
	if ds.APIKey != "" {
		nCreds++
	}
	if ds.TokenSource != nil {
		nCreds++
	}
	if len(ds.Scopes) > 0 && len(ds.Audiences) > 0 {
		return errors.New("WithScopes is incompatible with WithAudience")
	}
	// Accept only one form of credentials, except we allow TokenSource and CredentialsFile for backwards compatibility.
	if nCreds > 1 && !(nCreds == 2 && ds.TokenSource != nil && ds.CredentialsFile != "") {
		return errors.New("multiple credential options provided")
	}
	if ds.GRPCConn != nil && ds.GRPCConnPool != nil {
		return errors.New("WithGRPCConn is incompatible with WithConnPool")
	}
	if ds.HTTPClient != nil && ds.GRPCConnPool != nil {
		return errors.New("WithHTTPClient is incompatible with WithConnPool")
	}
	if ds.HTTPClient != nil && ds.GRPCConn != nil {
		return errors.New("WithHTTPClient is incompatible with WithGRPCConn")
	}
	if ds.HTTPClient != nil && ds.GRPCDialOpts != nil {
		return errors.New("WithHTTPClient is incompatible with gRPC dial options")
	}
	if ds.HTTPClient != nil && ds.QuotaProject != "" {
		return errors.New("WithHTTPClient is incompatible with QuotaProject")
	}
	if ds.HTTPClient != nil && ds.RequestReason != "" {
		return errors.New("WithHTTPClient is incompatible with RequestReason")
	}
	if ds.HTTPClient != nil && ds.ClientCertSource != nil {
		return errors.New("WithHTTPClient is incompatible with WithClientCertSource")
	}
	if ds.ClientCertSource != nil && (ds.GRPCConn != nil || ds.GRPCConnPool != nil || ds.GRPCConnPoolSize != 0 || ds.GRPCDialOpts != nil) {
		return errors.New("WithClientCertSource is currently only supported for HTTP. gRPC settings are incompatible")
	}
	if ds.ImpersonationConfig != nil && len(ds.ImpersonationConfig.Scopes) == 0 && len(ds.Scopes) == 0 {
		return errors.New("WithImpersonatedCredentials requires scopes being provided")
	}
	return nil
}

// GetDefaultUniverseDomain returns the Google default universe domain
// ("googleapis.com").
func (ds *DialSettings) GetDefaultUniverseDomain() string {
	return defaultUniverseDomain
}

// GetUniverseDomain returns the default service domain for a given Cloud
// universe, with the following precedence:
//
// 1. A non-empty option.WithUniverseDomain.
// 2. A non-empty environment variable GOOGLE_CLOUD_UNIVERSE_DOMAIN.
// 3. The default value "googleapis.com".
func (ds *DialSettings) GetUniverseDomain() string {
	if ds.UniverseDomain != "" {
		return ds.UniverseDomain
	}
	if envUD := os.Getenv(universeDomainEnvVar); envUD != "" {
		return envUD
	}
	return defaultUniverseDomain
}

// IsUniverseDomainGDU returns true if the universe domain is the default Google
// universe ("googleapis.com").
func (ds *DialSettings) IsUniverseDomainGDU() bool {
	return ds.GetUniverseDomain() == defaultUniverseDomain
}

// GetUniverseDomain returns the default service domain for a given Cloud
// universe, from google.Credentials. This wrapper function should be removed
// to close https://github.com/googleapis/google-api-go-client/issues/2399.
func GetUniverseDomain(creds *google.Credentials) (string, error) {
	timer := time.NewTimer(time.Second)
	defer timer.Stop()
	errors := make(chan error)
	results := make(chan string)

	go func() {
		result, err := creds.GetUniverseDomain()
		if err != nil {
			errors <- err
			return
		}
		results <- result
	}()

	select {
	case <-errors:
		// An error that is returned before the timer expires is likely to be
		// connection refused. Temporarily (2024-03-21) return the GDU domain.
		return defaultUniverseDomain, nil
	case res := <-results:
		return res, nil
	case <-timer.C: // Timer is expired.
		// If err or res was not returned, it means that creds.GetUniverseDomain()
		// did not complete in 1s. Assume that MDS is likely never responding to
		// the endpoint and will timeout. This is the source of issues such as
		// https://github.com/googleapis/google-cloud-go/issues/9350.
		// Temporarily (2024-02-02) return the GDU domain. Restore the original
		// calls to creds.GetUniverseDomain() in grpc/dial.go and http/dial.go
		// and remove this method to close
		// https://github.com/googleapis/google-api-go-client/issues/2399.
		return defaultUniverseDomain, nil
	}
}
