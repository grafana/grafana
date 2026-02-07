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

package credsfile

import (
	"encoding/json"
)

// Config3LO is the internals of a client creds file.
type Config3LO struct {
	ClientID     string   `json:"client_id"`
	ClientSecret string   `json:"client_secret"`
	RedirectURIs []string `json:"redirect_uris"`
	AuthURI      string   `json:"auth_uri"`
	TokenURI     string   `json:"token_uri"`
}

// ClientCredentialsFile representation.
type ClientCredentialsFile struct {
	Web            *Config3LO `json:"web"`
	Installed      *Config3LO `json:"installed"`
	UniverseDomain string     `json:"universe_domain"`
}

// ServiceAccountFile representation.
type ServiceAccountFile struct {
	Type           string `json:"type"`
	ProjectID      string `json:"project_id"`
	PrivateKeyID   string `json:"private_key_id"`
	PrivateKey     string `json:"private_key"`
	ClientEmail    string `json:"client_email"`
	ClientID       string `json:"client_id"`
	AuthURL        string `json:"auth_uri"`
	TokenURL       string `json:"token_uri"`
	UniverseDomain string `json:"universe_domain"`
}

// UserCredentialsFile representation.
type UserCredentialsFile struct {
	Type           string `json:"type"`
	ClientID       string `json:"client_id"`
	ClientSecret   string `json:"client_secret"`
	QuotaProjectID string `json:"quota_project_id"`
	RefreshToken   string `json:"refresh_token"`
	UniverseDomain string `json:"universe_domain"`
}

// ExternalAccountFile representation.
type ExternalAccountFile struct {
	Type                           string                           `json:"type"`
	ClientID                       string                           `json:"client_id"`
	ClientSecret                   string                           `json:"client_secret"`
	Audience                       string                           `json:"audience"`
	SubjectTokenType               string                           `json:"subject_token_type"`
	ServiceAccountImpersonationURL string                           `json:"service_account_impersonation_url"`
	TokenURL                       string                           `json:"token_url"`
	CredentialSource               *CredentialSource                `json:"credential_source,omitempty"`
	TokenInfoURL                   string                           `json:"token_info_url"`
	ServiceAccountImpersonation    *ServiceAccountImpersonationInfo `json:"service_account_impersonation,omitempty"`
	QuotaProjectID                 string                           `json:"quota_project_id"`
	WorkforcePoolUserProject       string                           `json:"workforce_pool_user_project"`
	UniverseDomain                 string                           `json:"universe_domain"`
}

// ExternalAccountAuthorizedUserFile representation.
type ExternalAccountAuthorizedUserFile struct {
	Type           string `json:"type"`
	Audience       string `json:"audience"`
	ClientID       string `json:"client_id"`
	ClientSecret   string `json:"client_secret"`
	RefreshToken   string `json:"refresh_token"`
	TokenURL       string `json:"token_url"`
	TokenInfoURL   string `json:"token_info_url"`
	RevokeURL      string `json:"revoke_url"`
	QuotaProjectID string `json:"quota_project_id"`
	UniverseDomain string `json:"universe_domain"`
}

// CredentialSource stores the information necessary to retrieve the credentials for the STS exchange.
//
// One field amongst File, URL, Certificate, and Executable should be filled, depending on the kind of credential in question.
// The EnvironmentID should start with AWS if being used for an AWS credential.
type CredentialSource struct {
	File                        string             `json:"file"`
	URL                         string             `json:"url"`
	Headers                     map[string]string  `json:"headers"`
	Executable                  *ExecutableConfig  `json:"executable,omitempty"`
	Certificate                 *CertificateConfig `json:"certificate"`
	EnvironmentID               string             `json:"environment_id"` // TODO: Make type for this
	RegionURL                   string             `json:"region_url"`
	RegionalCredVerificationURL string             `json:"regional_cred_verification_url"`
	CredVerificationURL         string             `json:"cred_verification_url"`
	IMDSv2SessionTokenURL       string             `json:"imdsv2_session_token_url"`
	Format                      *Format            `json:"format,omitempty"`
}

// Format describes the format of a [CredentialSource].
type Format struct {
	// Type is either "text" or "json". When not provided "text" type is assumed.
	Type string `json:"type"`
	// SubjectTokenFieldName is only required for JSON format. This would be "access_token" for azure.
	SubjectTokenFieldName string `json:"subject_token_field_name"`
}

// ExecutableConfig represents the command to run for an executable
// [CredentialSource].
type ExecutableConfig struct {
	Command       string `json:"command"`
	TimeoutMillis int    `json:"timeout_millis"`
	OutputFile    string `json:"output_file"`
}

// CertificateConfig represents the options used to set up X509 based workload
// [CredentialSource]
type CertificateConfig struct {
	UseDefaultCertificateConfig bool   `json:"use_default_certificate_config"`
	CertificateConfigLocation   string `json:"certificate_config_location"`
	TrustChainPath              string `json:"trust_chain_path"`
}

// ServiceAccountImpersonationInfo has impersonation configuration.
type ServiceAccountImpersonationInfo struct {
	TokenLifetimeSeconds int `json:"token_lifetime_seconds"`
}

// ImpersonatedServiceAccountFile representation.
type ImpersonatedServiceAccountFile struct {
	Type                           string          `json:"type"`
	ServiceAccountImpersonationURL string          `json:"service_account_impersonation_url"`
	Delegates                      []string        `json:"delegates"`
	CredSource                     json.RawMessage `json:"source_credentials"`
	UniverseDomain                 string          `json:"universe_domain"`
}

// GDCHServiceAccountFile represents the Google Distributed Cloud Hosted (GDCH) service identity file.
type GDCHServiceAccountFile struct {
	Type           string `json:"type"`
	FormatVersion  string `json:"format_version"`
	Project        string `json:"project"`
	Name           string `json:"name"`
	CertPath       string `json:"ca_cert_path"`
	PrivateKeyID   string `json:"private_key_id"`
	PrivateKey     string `json:"private_key"`
	TokenURL       string `json:"token_uri"`
	UniverseDomain string `json:"universe_domain"`
}
