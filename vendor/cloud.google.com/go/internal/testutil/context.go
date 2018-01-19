// Copyright 2014 Google Inc. All Rights Reserved.
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

// Package testutil contains helper functions for writing tests.
package testutil

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/jwt"
)

const (
	envProjID     = "GCLOUD_TESTS_GOLANG_PROJECT_ID"
	envPrivateKey = "GCLOUD_TESTS_GOLANG_KEY"
)

// ProjID returns the project ID to use in integration tests, or the empty
// string if none is configured.
func ProjID() string {
	return os.Getenv(envProjID)
}

// TokenSource returns the OAuth2 token source to use in integration tests,
// or nil if none is configured. It uses the standard environment variable
// for tests in this repo.
func TokenSource(ctx context.Context, scopes ...string) oauth2.TokenSource {
	return TokenSourceEnv(ctx, envPrivateKey, scopes...)
}

// TokenSourceEnv returns the OAuth2 token source to use in integration tests. or nil
// if none is configured. It tries to get credentials from the filename in the
// environment variable envVar. If the environment variable is unset, TokenSourceEnv
// will try to find 'Application Default Credentials'. Else, TokenSourceEnv will
// return nil. TokenSourceEnv will log.Fatal if the token source is specified but
// missing or invalid.
func TokenSourceEnv(ctx context.Context, envVar string, scopes ...string) oauth2.TokenSource {
	key := os.Getenv(envVar)
	if key == "" { // Try for application default credentials.
		ts, err := google.DefaultTokenSource(ctx, scopes...)
		if err != nil {
			log.Println("No 'Application Default Credentials' found.")
			return nil
		}
		return ts
	}
	conf, err := jwtConfigFromFile(key, scopes)
	if err != nil {
		log.Fatal(err)
	}
	return conf.TokenSource(ctx)
}

// JWTConfig reads the JSON private key file whose name is in the default
// environment variable, and returns the jwt.Config it contains. It ignores
// scopes.
// If the environment variable is empty, it returns (nil, nil).
func JWTConfig() (*jwt.Config, error) {
	return jwtConfigFromFile(os.Getenv(envPrivateKey), nil)
}

// jwtConfigFromFile reads the given JSON private key file, and returns the
// jwt.Config it contains.
// If the filename is empty, it returns (nil, nil).
func jwtConfigFromFile(filename string, scopes []string) (*jwt.Config, error) {
	if filename == "" {
		return nil, nil
	}
	jsonKey, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("Cannot read the JSON key file, err: %v", err)
	}
	conf, err := google.JWTConfigFromJSON(jsonKey, scopes...)
	if err != nil {
		return nil, fmt.Errorf("google.JWTConfigFromJSON: %v", err)
	}
	return conf, nil
}
