// Copyright 2017 Google LLC.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package internal

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/credentials"
	"cloud.google.com/go/auth/oauth2adapt"
	"golang.org/x/oauth2"
	"google.golang.org/api/internal/cert"
	"google.golang.org/api/internal/impersonate"

	"golang.org/x/oauth2/google"
)

const quotaProjectEnvVar = "GOOGLE_CLOUD_QUOTA_PROJECT"

// Creds returns credential information obtained from DialSettings, or if none, then
// it returns default credential information.
func Creds(ctx context.Context, ds *DialSettings) (*google.Credentials, error) {
	if ds.IsNewAuthLibraryEnabled() {
		return credsNewAuth(ds)
	}
	creds, err := baseCreds(ctx, ds)
	if err != nil {
		return nil, err
	}
	if ds.ImpersonationConfig != nil {
		return impersonateCredentials(ctx, creds, ds)
	}
	return creds, nil
}

// AuthCreds returns [cloud.google.com/go/auth.Credentials] based on credentials
// options provided via [option.ClientOption], including legacy oauth2/google
// options. If there are no applicable options, then it returns the result of
// [cloud.google.com/go/auth/credentials.DetectDefault].
// Note: If NoAuth is true, when [google.golang.org/api/option.WithoutAuthentication]
// is passed, then no authentication will be performed and this function will
// return nil, nil.
func AuthCreds(ctx context.Context, settings *DialSettings) (*auth.Credentials, error) {
	if settings.NoAuth {
		return nil, nil
	}
	if settings.AuthCredentials != nil {
		return settings.AuthCredentials, nil
	}
	// Support oauth2/google options
	var oauth2Creds *google.Credentials
	if settings.InternalCredentials != nil {
		oauth2Creds = settings.InternalCredentials
	} else if settings.Credentials != nil {
		oauth2Creds = settings.Credentials
	} else if settings.TokenSource != nil {
		oauth2Creds = &google.Credentials{TokenSource: settings.TokenSource}
	}
	if oauth2Creds != nil {
		return oauth2adapt.AuthCredentialsFromOauth2Credentials(oauth2Creds), nil
	}

	return detectDefaultFromDialSettings(settings)
}

// GetOAuth2Configuration determines configurations for the OAuth2 transport, which is separate from the API transport.
// The OAuth2 transport and endpoint will be configured for mTLS if applicable.
func GetOAuth2Configuration(ctx context.Context, settings *DialSettings) (string, *http.Client, error) {
	clientCertSource, err := getClientCertificateSource(settings)
	if err != nil {
		return "", nil, err
	}
	tokenURL := oAuth2Endpoint(clientCertSource)
	var oauth2Client *http.Client
	if clientCertSource != nil {
		tlsConfig := &tls.Config{
			GetClientCertificate: clientCertSource,
		}
		oauth2Client = customHTTPClient(tlsConfig)
	} else {
		oauth2Client = oauth2.NewClient(ctx, nil)
	}
	return tokenURL, oauth2Client, nil
}

func credsNewAuth(settings *DialSettings) (*google.Credentials, error) {
	// Preserve old options behavior
	if settings.InternalCredentials != nil {
		return settings.InternalCredentials, nil
	} else if settings.Credentials != nil {
		return settings.Credentials, nil
	} else if settings.TokenSource != nil {
		return &google.Credentials{TokenSource: settings.TokenSource}, nil
	}

	if settings.AuthCredentials != nil {
		return oauth2adapt.Oauth2CredentialsFromAuthCredentials(settings.AuthCredentials), nil
	}

	creds, err := detectDefaultFromDialSettings(settings)
	if err != nil {
		return nil, err
	}
	return oauth2adapt.Oauth2CredentialsFromAuthCredentials(creds), nil
}

func detectDefaultFromDialSettings(settings *DialSettings) (*auth.Credentials, error) {
	var useSelfSignedJWT bool
	var aud string
	var scopes []string
	// If scoped JWTs are enabled user provided an aud, allow self-signed JWT.
	if settings.EnableJwtWithScope || len(settings.Audiences) > 0 {
		useSelfSignedJWT = true
	}

	if len(settings.Scopes) > 0 {
		scopes = make([]string, len(settings.Scopes))
		copy(scopes, settings.Scopes)
	}
	if len(settings.Audiences) > 0 {
		aud = settings.Audiences[0]
	}
	// Only default scopes if user did not also set an audience.
	if len(settings.Scopes) == 0 && aud == "" && len(settings.DefaultScopes) > 0 {
		scopes = make([]string, len(settings.DefaultScopes))
		copy(scopes, settings.DefaultScopes)
	}
	if len(scopes) == 0 && aud == "" {
		aud = settings.DefaultAudience
	}

	return credentials.DetectDefault(&credentials.DetectOptions{
		Scopes:           scopes,
		Audience:         aud,
		CredentialsFile:  settings.CredentialsFile,
		CredentialsJSON:  settings.CredentialsJSON,
		UseSelfSignedJWT: useSelfSignedJWT,
		Logger:           settings.Logger,
	})
}

func baseCreds(ctx context.Context, ds *DialSettings) (*google.Credentials, error) {
	if ds.InternalCredentials != nil {
		return ds.InternalCredentials, nil
	}
	if ds.Credentials != nil {
		return ds.Credentials, nil
	}
	if len(ds.CredentialsJSON) > 0 {
		return credentialsFromJSON(ctx, ds.CredentialsJSON, ds)
	}
	if ds.CredentialsFile != "" {
		data, err := os.ReadFile(ds.CredentialsFile)
		if err != nil {
			return nil, fmt.Errorf("cannot read credentials file: %v", err)
		}
		return credentialsFromJSON(ctx, data, ds)
	}
	if ds.TokenSource != nil {
		return &google.Credentials{TokenSource: ds.TokenSource}, nil
	}
	cred, err := google.FindDefaultCredentials(ctx, ds.GetScopes()...)
	if err != nil {
		return nil, err
	}
	if len(cred.JSON) > 0 {
		return credentialsFromJSON(ctx, cred.JSON, ds)
	}
	// For GAE and GCE, the JSON is empty so return the default credentials directly.
	return cred, nil
}

// JSON key file type.
const (
	serviceAccountKey = "service_account"
)

// credentialsFromJSON returns a google.Credentials from the JSON data
//
// - A self-signed JWT flow will be executed if the following conditions are
// met:
//
//	(1) At least one of the following is true:
//	    (a) Scope for self-signed JWT flow is enabled
//	    (b) Audiences are explicitly provided by users
//	(2) No service account impersontation
//
// - Otherwise, executes standard OAuth 2.0 flow
// More details: google.aip.dev/auth/4111
func credentialsFromJSON(ctx context.Context, data []byte, ds *DialSettings) (*google.Credentials, error) {
	var params google.CredentialsParams
	params.Scopes = ds.GetScopes()

	tokenURL, oauth2Client, err := GetOAuth2Configuration(ctx, ds)
	if err != nil {
		return nil, err
	}
	params.TokenURL = tokenURL
	ctx = context.WithValue(ctx, oauth2.HTTPClient, oauth2Client)

	// By default, a standard OAuth 2.0 token source is created
	cred, err := google.CredentialsFromJSONWithParams(ctx, data, params)
	if err != nil {
		return nil, err
	}

	// Override the token source to use self-signed JWT if conditions are met
	isJWTFlow, err := isSelfSignedJWTFlow(data, ds)
	if err != nil {
		return nil, err
	}
	if isJWTFlow {
		ts, err := selfSignedJWTTokenSource(data, ds)
		if err != nil {
			return nil, err
		}
		cred.TokenSource = ts
	}

	return cred, err
}

func oAuth2Endpoint(clientCertSource cert.Source) string {
	if isMTLS(clientCertSource) {
		return google.MTLSTokenURL
	}
	return google.Endpoint.TokenURL
}

func isSelfSignedJWTFlow(data []byte, ds *DialSettings) (bool, error) {
	// For non-GDU universe domains, token exchange is impossible and services
	// must support self-signed JWTs with scopes.
	if !ds.IsUniverseDomainGDU() {
		return typeServiceAccount(data)
	}
	if (ds.EnableJwtWithScope || ds.HasCustomAudience()) && ds.ImpersonationConfig == nil {
		return typeServiceAccount(data)
	}
	return false, nil
}

// typeServiceAccount checks if JSON data is for a service account.
func typeServiceAccount(data []byte) (bool, error) {
	var f struct {
		Type string `json:"type"`
		// The remaining JSON fields are omitted because they are not used.
	}
	if err := json.Unmarshal(data, &f); err != nil {
		return false, err
	}
	return f.Type == serviceAccountKey, nil
}

func selfSignedJWTTokenSource(data []byte, ds *DialSettings) (oauth2.TokenSource, error) {
	if len(ds.GetScopes()) > 0 && !ds.HasCustomAudience() {
		// Scopes are preferred in self-signed JWT unless the scope is not available
		// or a custom audience is used.
		return google.JWTAccessTokenSourceWithScope(data, ds.GetScopes()...)
	} else if ds.GetAudience() != "" {
		// Fallback to audience if scope is not provided
		return google.JWTAccessTokenSourceFromJSON(data, ds.GetAudience())
	} else {
		return nil, errors.New("neither scopes or audience are available for the self-signed JWT")
	}
}

// GetQuotaProject retrieves quota project with precedence being: client option,
// environment variable, creds file.
func GetQuotaProject(creds *google.Credentials, clientOpt string) string {
	if clientOpt != "" {
		return clientOpt
	}
	if env := os.Getenv(quotaProjectEnvVar); env != "" {
		return env
	}
	if creds == nil {
		return ""
	}
	var v struct {
		QuotaProject string `json:"quota_project_id"`
	}
	if err := json.Unmarshal(creds.JSON, &v); err != nil {
		return ""
	}
	return v.QuotaProject
}

func impersonateCredentials(ctx context.Context, creds *google.Credentials, ds *DialSettings) (*google.Credentials, error) {
	if len(ds.ImpersonationConfig.Scopes) == 0 {
		ds.ImpersonationConfig.Scopes = ds.GetScopes()
	}
	ts, err := impersonate.TokenSource(ctx, creds.TokenSource, ds.ImpersonationConfig)
	if err != nil {
		return nil, err
	}
	return &google.Credentials{
		TokenSource: ts,
		ProjectID:   creds.ProjectID,
	}, nil
}

// customHTTPClient constructs an HTTPClient using the provided tlsConfig, to support mTLS.
func customHTTPClient(tlsConfig *tls.Config) *http.Client {
	trans := baseTransport()
	trans.TLSClientConfig = tlsConfig
	return &http.Client{Transport: trans}
}

func baseTransport() *http.Transport {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).DialContext,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
}
