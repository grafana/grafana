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

// Package credsfile is meant to hide implementation details from the pubic
// surface of the detect package. It should not import any other packages in
// this module. It is located under the main internal package so other
// sub-packages can use these parsed types as well.
package credsfile

import (
	"os"
	"os/user"
	"path/filepath"
	"runtime"
)

const (
	// GoogleAppCredsEnvVar is the environment variable for setting the
	// application default credentials.
	GoogleAppCredsEnvVar = "GOOGLE_APPLICATION_CREDENTIALS"
	userCredsFilename    = "application_default_credentials.json"
)

// CredentialType represents different credential filetypes Google credentials
// can be.
type CredentialType int

const (
	// UnknownCredType is an unidentified file type.
	UnknownCredType CredentialType = iota
	// UserCredentialsKey represents a user creds file type.
	UserCredentialsKey
	// ServiceAccountKey represents a service account file type.
	ServiceAccountKey
	// ImpersonatedServiceAccountKey represents a impersonated service account
	// file type.
	ImpersonatedServiceAccountKey
	// ExternalAccountKey represents a external account file type.
	ExternalAccountKey
	// GDCHServiceAccountKey represents a GDCH file type.
	GDCHServiceAccountKey
	// ExternalAccountAuthorizedUserKey represents a external account authorized
	// user file type.
	ExternalAccountAuthorizedUserKey
)

// parseCredentialType returns the associated filetype based on the parsed
// typeString provided.
func parseCredentialType(typeString string) CredentialType {
	switch typeString {
	case "service_account":
		return ServiceAccountKey
	case "authorized_user":
		return UserCredentialsKey
	case "impersonated_service_account":
		return ImpersonatedServiceAccountKey
	case "external_account":
		return ExternalAccountKey
	case "external_account_authorized_user":
		return ExternalAccountAuthorizedUserKey
	case "gdch_service_account":
		return GDCHServiceAccountKey
	default:
		return UnknownCredType
	}
}

// GetFileNameFromEnv returns the override if provided or detects a filename
// from the environment.
func GetFileNameFromEnv(override string) string {
	if override != "" {
		return override
	}
	return os.Getenv(GoogleAppCredsEnvVar)
}

// GetWellKnownFileName tries to locate the filepath for the user credential
// file based on the environment.
func GetWellKnownFileName() string {
	if runtime.GOOS == "windows" {
		return filepath.Join(os.Getenv("APPDATA"), "gcloud", userCredsFilename)
	}
	return filepath.Join(guessUnixHomeDir(), ".config", "gcloud", userCredsFilename)
}

// guessUnixHomeDir default to checking for HOME, but not all unix systems have
// this set, do have a fallback.
func guessUnixHomeDir() string {
	if v := os.Getenv("HOME"); v != "" {
		return v
	}
	if u, err := user.Current(); err == nil {
		return u.HomeDir
	}
	return ""
}
