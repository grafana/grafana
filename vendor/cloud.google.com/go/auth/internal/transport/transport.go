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

// Package transport provided internal helpers for the two transport packages
// (grpctransport and httptransport).
package transport

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"

	"cloud.google.com/go/auth/credentials"
)

// CloneDetectOptions clones a user set detect option into some new memory that
// we can internally manipulate before sending onto the detect package.
func CloneDetectOptions(oldDo *credentials.DetectOptions) *credentials.DetectOptions {
	if oldDo == nil {
		// it is valid for users not to set this, but we will need to to default
		// some options for them in this case so return some initialized memory
		// to work with.
		return &credentials.DetectOptions{}
	}
	newDo := &credentials.DetectOptions{
		// Simple types
		TokenBindingType:  oldDo.TokenBindingType,
		Audience:          oldDo.Audience,
		Subject:           oldDo.Subject,
		EarlyTokenRefresh: oldDo.EarlyTokenRefresh,
		TokenURL:          oldDo.TokenURL,
		STSAudience:       oldDo.STSAudience,
		CredentialsFile:   oldDo.CredentialsFile,
		UseSelfSignedJWT:  oldDo.UseSelfSignedJWT,
		UniverseDomain:    oldDo.UniverseDomain,

		// These fields are pointer types that we just want to use exactly as
		// the user set, copy the ref
		Client:             oldDo.Client,
		Logger:             oldDo.Logger,
		AuthHandlerOptions: oldDo.AuthHandlerOptions,
	}

	// Smartly size this memory and copy below.
	if len(oldDo.CredentialsJSON) > 0 {
		newDo.CredentialsJSON = make([]byte, len(oldDo.CredentialsJSON))
		copy(newDo.CredentialsJSON, oldDo.CredentialsJSON)
	}
	if len(oldDo.Scopes) > 0 {
		newDo.Scopes = make([]string, len(oldDo.Scopes))
		copy(newDo.Scopes, oldDo.Scopes)
	}

	return newDo
}

// ValidateUniverseDomain verifies that the universe domain configured for the
// client matches the universe domain configured for the credentials.
func ValidateUniverseDomain(clientUniverseDomain, credentialsUniverseDomain string) error {
	if clientUniverseDomain != credentialsUniverseDomain {
		return fmt.Errorf(
			"the configured universe domain (%q) does not match the universe "+
				"domain found in the credentials (%q). If you haven't configured "+
				"the universe domain explicitly, \"googleapis.com\" is the default",
			clientUniverseDomain,
			credentialsUniverseDomain)
	}
	return nil
}

// DefaultHTTPClientWithTLS constructs an HTTPClient using the provided tlsConfig, to support mTLS.
func DefaultHTTPClientWithTLS(tlsConfig *tls.Config) *http.Client {
	trans := BaseTransport()
	trans.TLSClientConfig = tlsConfig
	return &http.Client{Transport: trans}
}

// BaseTransport returns a default [http.Transport] which can be used if
// [http.DefaultTransport] has been overwritten.
func BaseTransport() *http.Transport {
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
