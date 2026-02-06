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

// Package oauth2adapt helps converts types used in [cloud.google.com/go/auth]
// and [golang.org/x/oauth2].
package oauth2adapt

import (
	"context"
	"encoding/json"
	"errors"

	"cloud.google.com/go/auth"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	oauth2TokenSourceKey    = "oauth2.google.tokenSource"
	oauth2ServiceAccountKey = "oauth2.google.serviceAccount"
	authTokenSourceKey      = "auth.google.tokenSource"
	authServiceAccountKey   = "auth.google.serviceAccount"
)

// TokenProviderFromTokenSource converts any [golang.org/x/oauth2.TokenSource]
// into a [cloud.google.com/go/auth.TokenProvider].
func TokenProviderFromTokenSource(ts oauth2.TokenSource) auth.TokenProvider {
	return &tokenProviderAdapter{ts: ts}
}

type tokenProviderAdapter struct {
	ts oauth2.TokenSource
}

// Token fulfills the [cloud.google.com/go/auth.TokenProvider] interface. It
// is a light wrapper around the underlying TokenSource.
func (tp *tokenProviderAdapter) Token(context.Context) (*auth.Token, error) {
	tok, err := tp.ts.Token()
	if err != nil {
		var err2 *oauth2.RetrieveError
		if ok := errors.As(err, &err2); ok {
			return nil, AuthErrorFromRetrieveError(err2)
		}
		return nil, err
	}
	// Preserve compute token metadata, for both types of tokens.
	metadata := map[string]interface{}{}
	if val, ok := tok.Extra(oauth2TokenSourceKey).(string); ok {
		metadata[authTokenSourceKey] = val
		metadata[oauth2TokenSourceKey] = val
	}
	if val, ok := tok.Extra(oauth2ServiceAccountKey).(string); ok {
		metadata[authServiceAccountKey] = val
		metadata[oauth2ServiceAccountKey] = val
	}
	return &auth.Token{
		Value:    tok.AccessToken,
		Type:     tok.Type(),
		Expiry:   tok.Expiry,
		Metadata: metadata,
	}, nil
}

// TokenSourceFromTokenProvider converts any
// [cloud.google.com/go/auth.TokenProvider] into a
// [golang.org/x/oauth2.TokenSource].
func TokenSourceFromTokenProvider(tp auth.TokenProvider) oauth2.TokenSource {
	return &tokenSourceAdapter{tp: tp}
}

type tokenSourceAdapter struct {
	tp auth.TokenProvider
}

// Token fulfills the [golang.org/x/oauth2.TokenSource] interface. It
// is a light wrapper around the underlying TokenProvider.
func (ts *tokenSourceAdapter) Token() (*oauth2.Token, error) {
	tok, err := ts.tp.Token(context.Background())
	if err != nil {
		var err2 *auth.Error
		if ok := errors.As(err, &err2); ok {
			return nil, AddRetrieveErrorToAuthError(err2)
		}
		return nil, err
	}
	tok2 := &oauth2.Token{
		AccessToken: tok.Value,
		TokenType:   tok.Type,
		Expiry:      tok.Expiry,
	}
	// Preserve token metadata.
	m := tok.Metadata
	if m != nil {
		// Copy map to avoid concurrent map writes error (#11161).
		metadata := make(map[string]interface{}, len(m)+2)
		for k, v := range m {
			metadata[k] = v
		}
		// Append compute token metadata in converted form.
		if val, ok := metadata[authTokenSourceKey].(string); ok && val != "" {
			metadata[oauth2TokenSourceKey] = val
		}
		if val, ok := metadata[authServiceAccountKey].(string); ok && val != "" {
			metadata[oauth2ServiceAccountKey] = val
		}
		tok2 = tok2.WithExtra(metadata)
	}
	return tok2, nil
}

// AuthCredentialsFromOauth2Credentials converts a [golang.org/x/oauth2/google.Credentials]
// to a [cloud.google.com/go/auth.Credentials].
func AuthCredentialsFromOauth2Credentials(creds *google.Credentials) *auth.Credentials {
	if creds == nil {
		return nil
	}
	return auth.NewCredentials(&auth.CredentialsOptions{
		TokenProvider: TokenProviderFromTokenSource(creds.TokenSource),
		JSON:          creds.JSON,
		ProjectIDProvider: auth.CredentialsPropertyFunc(func(ctx context.Context) (string, error) {
			return creds.ProjectID, nil
		}),
		UniverseDomainProvider: auth.CredentialsPropertyFunc(func(ctx context.Context) (string, error) {
			return creds.GetUniverseDomain()
		}),
	})
}

// Oauth2CredentialsFromAuthCredentials converts a [cloud.google.com/go/auth.Credentials]
// to a [golang.org/x/oauth2/google.Credentials].
func Oauth2CredentialsFromAuthCredentials(creds *auth.Credentials) *google.Credentials {
	if creds == nil {
		return nil
	}
	// Throw away errors as old credentials are not request aware. Also, no
	// network requests are currently happening for this use case.
	projectID, _ := creds.ProjectID(context.Background())

	return &google.Credentials{
		TokenSource: TokenSourceFromTokenProvider(creds.TokenProvider),
		ProjectID:   projectID,
		JSON:        creds.JSON(),
		UniverseDomainProvider: func() (string, error) {
			return creds.UniverseDomain(context.Background())
		},
	}
}

type oauth2Error struct {
	ErrorCode        string `json:"error"`
	ErrorDescription string `json:"error_description"`
	ErrorURI         string `json:"error_uri"`
}

// AddRetrieveErrorToAuthError returns the same error provided and adds a
// [golang.org/x/oauth2.RetrieveError] to the error chain by setting the `Err` field on the
// [cloud.google.com/go/auth.Error].
func AddRetrieveErrorToAuthError(err *auth.Error) *auth.Error {
	if err == nil {
		return nil
	}
	e := &oauth2.RetrieveError{
		Response: err.Response,
		Body:     err.Body,
	}
	err.Err = e
	if len(err.Body) > 0 {
		var oErr oauth2Error
		// ignore the error as it only fills in extra details
		json.Unmarshal(err.Body, &oErr)
		e.ErrorCode = oErr.ErrorCode
		e.ErrorDescription = oErr.ErrorDescription
		e.ErrorURI = oErr.ErrorURI
	}
	return err
}

// AuthErrorFromRetrieveError returns an [cloud.google.com/go/auth.Error] that
// wraps the provided [golang.org/x/oauth2.RetrieveError].
func AuthErrorFromRetrieveError(err *oauth2.RetrieveError) *auth.Error {
	if err == nil {
		return nil
	}
	return &auth.Error{
		Response: err.Response,
		Body:     err.Body,
		Err:      err,
	}
}
