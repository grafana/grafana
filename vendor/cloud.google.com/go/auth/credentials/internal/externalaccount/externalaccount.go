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

package externalaccount

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/credentials/internal/impersonate"
	"cloud.google.com/go/auth/credentials/internal/stsexchange"
	"cloud.google.com/go/auth/internal/credsfile"
	"github.com/googleapis/gax-go/v2/internallog"
)

const (
	timeoutMinimum = 5 * time.Second
	timeoutMaximum = 120 * time.Second

	universeDomainPlaceholder = "UNIVERSE_DOMAIN"
	defaultTokenURL           = "https://sts.UNIVERSE_DOMAIN/v1/token"
	defaultUniverseDomain     = "googleapis.com"
)

var (
	// Now aliases time.Now for testing
	Now = func() time.Time {
		return time.Now().UTC()
	}
	validWorkforceAudiencePattern *regexp.Regexp = regexp.MustCompile(`//iam\.googleapis\.com/locations/[^/]+/workforcePools/`)
)

// Options stores the configuration for fetching tokens with external credentials.
type Options struct {
	// Audience is the Secure Token Service (STS) audience which contains the resource name for the workload
	// identity pool or the workforce pool and the provider identifier in that pool.
	Audience string
	// SubjectTokenType is the STS token type based on the Oauth2.0 token exchange spec
	// e.g. `urn:ietf:params:oauth:token-type:jwt`.
	SubjectTokenType string
	// TokenURL is the STS token exchange endpoint.
	TokenURL string
	// TokenInfoURL is the token_info endpoint used to retrieve the account related information (
	// user attributes like account identifier, eg. email, username, uid, etc). This is
	// needed for gCloud session account identification.
	TokenInfoURL string
	// ServiceAccountImpersonationURL is the URL for the service account impersonation request. This is only
	// required for workload identity pools when APIs to be accessed have not integrated with UberMint.
	ServiceAccountImpersonationURL string
	// ServiceAccountImpersonationLifetimeSeconds is the number of seconds the service account impersonation
	// token will be valid for.
	ServiceAccountImpersonationLifetimeSeconds int
	// ClientSecret is currently only required if token_info endpoint also
	// needs to be called with the generated GCP access token. When provided, STS will be
	// called with additional basic authentication using client_id as username and client_secret as password.
	ClientSecret string
	// ClientID is only required in conjunction with ClientSecret, as described above.
	ClientID string
	// CredentialSource contains the necessary information to retrieve the token itself, as well
	// as some environmental information.
	CredentialSource *credsfile.CredentialSource
	// QuotaProjectID is injected by gCloud. If the value is non-empty, the Auth libraries
	// will set the x-goog-user-project which overrides the project associated with the credentials.
	QuotaProjectID string
	// Scopes contains the desired scopes for the returned access token.
	Scopes []string
	// WorkforcePoolUserProject should be set when it is a workforce pool and
	// not a workload identity pool. The underlying principal must still have
	// serviceusage.services.use IAM permission to use the project for
	// billing/quota. Optional.
	WorkforcePoolUserProject string
	// UniverseDomain is the default service domain for a given Cloud universe.
	// This value will be used in the default STS token URL. The default value
	// is "googleapis.com". It will not be used if TokenURL is set. Optional.
	UniverseDomain string
	// SubjectTokenProvider is an optional token provider for OIDC/SAML
	// credentials. One of SubjectTokenProvider, AWSSecurityCredentialProvider
	// or CredentialSource must be provided. Optional.
	SubjectTokenProvider SubjectTokenProvider
	// AwsSecurityCredentialsProvider is an AWS Security Credential provider
	// for AWS credentials. One of SubjectTokenProvider,
	// AWSSecurityCredentialProvider or CredentialSource must be provided. Optional.
	AwsSecurityCredentialsProvider AwsSecurityCredentialsProvider
	// Client for token request.
	Client *http.Client
	// IsDefaultClient marks whether the client passed in is a default client that can be overriden.
	// This is important for X509 credentials which should create a new client if the default was used
	// but should respect a client explicitly passed in by the user.
	IsDefaultClient bool
	// Logger is used for debug logging. If provided, logging will be enabled
	// at the loggers configured level. By default logging is disabled unless
	// enabled by setting GOOGLE_SDK_GO_LOGGING_LEVEL in which case a default
	// logger will be used. Optional.
	Logger *slog.Logger
}

// SubjectTokenProvider can be used to supply a subject token to exchange for a
// GCP access token.
type SubjectTokenProvider interface {
	// SubjectToken should return a valid subject token or an error.
	// The external account token provider does not cache the returned subject
	// token, so caching logic should be implemented in the provider to prevent
	// multiple requests for the same subject token.
	SubjectToken(ctx context.Context, opts *RequestOptions) (string, error)
}

// RequestOptions contains information about the requested subject token or AWS
// security credentials from the Google external account credential.
type RequestOptions struct {
	// Audience is the requested audience for the external account credential.
	Audience string
	// Subject token type is the requested subject token type for the external
	// account credential. Expected values include:
	// “urn:ietf:params:oauth:token-type:jwt”
	// “urn:ietf:params:oauth:token-type:id-token”
	// “urn:ietf:params:oauth:token-type:saml2”
	// “urn:ietf:params:aws:token-type:aws4_request”
	SubjectTokenType string
}

// AwsSecurityCredentialsProvider can be used to supply AwsSecurityCredentials
// and an AWS Region to exchange for a GCP access token.
type AwsSecurityCredentialsProvider interface {
	// AwsRegion should return the AWS region or an error.
	AwsRegion(ctx context.Context, opts *RequestOptions) (string, error)
	// GetAwsSecurityCredentials should return a valid set of
	// AwsSecurityCredentials or an error. The external account token provider
	// does not cache the returned security credentials, so caching logic should
	// be implemented in the provider to prevent multiple requests for the
	// same security credentials.
	AwsSecurityCredentials(ctx context.Context, opts *RequestOptions) (*AwsSecurityCredentials, error)
}

// AwsSecurityCredentials models AWS security credentials.
type AwsSecurityCredentials struct {
	// AccessKeyId is the AWS Access Key ID - Required.
	AccessKeyID string `json:"AccessKeyID"`
	// SecretAccessKey is the AWS Secret Access Key - Required.
	SecretAccessKey string `json:"SecretAccessKey"`
	// SessionToken is the AWS Session token. This should be provided for
	// temporary AWS security credentials - Optional.
	SessionToken string `json:"Token"`
}

func (o *Options) validate() error {
	if o.Audience == "" {
		return fmt.Errorf("externalaccount: Audience must be set")
	}
	if o.SubjectTokenType == "" {
		return fmt.Errorf("externalaccount: Subject token type must be set")
	}
	if o.WorkforcePoolUserProject != "" {
		if valid := validWorkforceAudiencePattern.MatchString(o.Audience); !valid {
			return fmt.Errorf("externalaccount: workforce_pool_user_project should not be set for non-workforce pool credentials")
		}
	}
	count := 0
	if o.CredentialSource != nil {
		count++
	}
	if o.SubjectTokenProvider != nil {
		count++
	}
	if o.AwsSecurityCredentialsProvider != nil {
		count++
	}
	if count == 0 {
		return fmt.Errorf("externalaccount: one of CredentialSource, SubjectTokenProvider, or AwsSecurityCredentialsProvider must be set")
	}
	if count > 1 {
		return fmt.Errorf("externalaccount: only one of CredentialSource, SubjectTokenProvider, or AwsSecurityCredentialsProvider must be set")
	}
	return nil
}

// client returns the http client that should be used for the token exchange. If a non-default client
// is provided, then the client configured in the options will always be returned. If a default client
// is provided and the options are configured for X509 credentials, a new client will be created.
func (o *Options) client() (*http.Client, error) {
	// If a client was provided and no override certificate config location was provided, use the provided client.
	if o.CredentialSource == nil || o.CredentialSource.Certificate == nil || (!o.IsDefaultClient && o.CredentialSource.Certificate.CertificateConfigLocation == "") {
		return o.Client, nil
	}

	// If a new client should be created, validate and use the certificate source to create a new mTLS client.
	cert := o.CredentialSource.Certificate
	if !cert.UseDefaultCertificateConfig && cert.CertificateConfigLocation == "" {
		return nil, errors.New("credentials: \"certificate\" object must either specify a certificate_config_location or use_default_certificate_config should be true")
	}
	if cert.UseDefaultCertificateConfig && cert.CertificateConfigLocation != "" {
		return nil, errors.New("credentials: \"certificate\" object cannot specify both a certificate_config_location and use_default_certificate_config=true")
	}
	return createX509Client(cert.CertificateConfigLocation)
}

// resolveTokenURL sets the default STS token endpoint with the configured
// universe domain.
func (o *Options) resolveTokenURL() {
	if o.TokenURL != "" {
		return
	} else if o.UniverseDomain != "" {
		o.TokenURL = strings.Replace(defaultTokenURL, universeDomainPlaceholder, o.UniverseDomain, 1)
	} else {
		o.TokenURL = strings.Replace(defaultTokenURL, universeDomainPlaceholder, defaultUniverseDomain, 1)
	}
}

// NewTokenProvider returns a [cloud.google.com/go/auth.TokenProvider]
// configured with the provided options.
func NewTokenProvider(opts *Options) (auth.TokenProvider, error) {
	if err := opts.validate(); err != nil {
		return nil, err
	}
	opts.resolveTokenURL()
	logger := internallog.New(opts.Logger)
	stp, err := newSubjectTokenProvider(opts)
	if err != nil {
		return nil, err
	}

	client, err := opts.client()
	if err != nil {
		return nil, err
	}

	tp := &tokenProvider{
		client: client,
		opts:   opts,
		stp:    stp,
		logger: logger,
	}

	if opts.ServiceAccountImpersonationURL == "" {
		return auth.NewCachedTokenProvider(tp, nil), nil
	}

	scopes := make([]string, len(opts.Scopes))
	copy(scopes, opts.Scopes)
	// needed for impersonation
	tp.opts.Scopes = []string{"https://www.googleapis.com/auth/cloud-platform"}
	imp, err := impersonate.NewTokenProvider(&impersonate.Options{
		Client:               client,
		URL:                  opts.ServiceAccountImpersonationURL,
		Scopes:               scopes,
		Tp:                   auth.NewCachedTokenProvider(tp, nil),
		TokenLifetimeSeconds: opts.ServiceAccountImpersonationLifetimeSeconds,
		Logger:               logger,
	})
	if err != nil {
		return nil, err
	}
	return auth.NewCachedTokenProvider(imp, nil), nil
}

type subjectTokenProvider interface {
	subjectToken(ctx context.Context) (string, error)
	providerType() string
}

// tokenProvider is the provider that handles external credentials. It is used to retrieve Tokens.
type tokenProvider struct {
	client *http.Client
	logger *slog.Logger
	opts   *Options
	stp    subjectTokenProvider
}

func (tp *tokenProvider) Token(ctx context.Context) (*auth.Token, error) {
	subjectToken, err := tp.stp.subjectToken(ctx)
	if err != nil {
		return nil, err
	}

	stsRequest := &stsexchange.TokenRequest{
		GrantType:          stsexchange.GrantType,
		Audience:           tp.opts.Audience,
		Scope:              tp.opts.Scopes,
		RequestedTokenType: stsexchange.TokenType,
		SubjectToken:       subjectToken,
		SubjectTokenType:   tp.opts.SubjectTokenType,
	}
	header := make(http.Header)
	header.Set("Content-Type", "application/x-www-form-urlencoded")
	header.Add("x-goog-api-client", getGoogHeaderValue(tp.opts, tp.stp))
	clientAuth := stsexchange.ClientAuthentication{
		AuthStyle:    auth.StyleInHeader,
		ClientID:     tp.opts.ClientID,
		ClientSecret: tp.opts.ClientSecret,
	}
	var options map[string]interface{}
	// Do not pass workforce_pool_user_project when client authentication is used.
	// The client ID is sufficient for determining the user project.
	if tp.opts.WorkforcePoolUserProject != "" && tp.opts.ClientID == "" {
		options = map[string]interface{}{
			"userProject": tp.opts.WorkforcePoolUserProject,
		}
	}
	stsResp, err := stsexchange.ExchangeToken(ctx, &stsexchange.Options{
		Client:         tp.client,
		Endpoint:       tp.opts.TokenURL,
		Request:        stsRequest,
		Authentication: clientAuth,
		Headers:        header,
		ExtraOpts:      options,
		Logger:         tp.logger,
	})
	if err != nil {
		return nil, err
	}

	tok := &auth.Token{
		Value: stsResp.AccessToken,
		Type:  stsResp.TokenType,
	}
	// The RFC8693 doesn't define the explicit 0 of "expires_in" field behavior.
	if stsResp.ExpiresIn <= 0 {
		return nil, fmt.Errorf("credentials: got invalid expiry from security token service")
	}
	tok.Expiry = Now().Add(time.Duration(stsResp.ExpiresIn) * time.Second)
	return tok, nil
}

// newSubjectTokenProvider determines the type of credsfile.CredentialSource needed to create a
// subjectTokenProvider
func newSubjectTokenProvider(o *Options) (subjectTokenProvider, error) {
	logger := internallog.New(o.Logger)
	reqOpts := &RequestOptions{Audience: o.Audience, SubjectTokenType: o.SubjectTokenType}
	if o.AwsSecurityCredentialsProvider != nil {
		return &awsSubjectProvider{
			securityCredentialsProvider: o.AwsSecurityCredentialsProvider,
			TargetResource:              o.Audience,
			reqOpts:                     reqOpts,
			logger:                      logger,
		}, nil
	} else if o.SubjectTokenProvider != nil {
		return &programmaticProvider{stp: o.SubjectTokenProvider, opts: reqOpts}, nil
	} else if len(o.CredentialSource.EnvironmentID) > 3 && o.CredentialSource.EnvironmentID[:3] == "aws" {
		if awsVersion, err := strconv.Atoi(o.CredentialSource.EnvironmentID[3:]); err == nil {
			if awsVersion != 1 {
				return nil, fmt.Errorf("credentials: aws version '%d' is not supported in the current build", awsVersion)
			}

			awsProvider := &awsSubjectProvider{
				EnvironmentID:               o.CredentialSource.EnvironmentID,
				RegionURL:                   o.CredentialSource.RegionURL,
				RegionalCredVerificationURL: o.CredentialSource.RegionalCredVerificationURL,
				CredVerificationURL:         o.CredentialSource.URL,
				TargetResource:              o.Audience,
				Client:                      o.Client,
				logger:                      logger,
			}
			if o.CredentialSource.IMDSv2SessionTokenURL != "" {
				awsProvider.IMDSv2SessionTokenURL = o.CredentialSource.IMDSv2SessionTokenURL
			}

			return awsProvider, nil
		}
	} else if o.CredentialSource.File != "" {
		return &fileSubjectProvider{File: o.CredentialSource.File, Format: o.CredentialSource.Format}, nil
	} else if o.CredentialSource.URL != "" {
		return &urlSubjectProvider{
			URL:     o.CredentialSource.URL,
			Headers: o.CredentialSource.Headers,
			Format:  o.CredentialSource.Format,
			Client:  o.Client,
			Logger:  logger,
		}, nil
	} else if o.CredentialSource.Executable != nil {
		ec := o.CredentialSource.Executable
		if ec.Command == "" {
			return nil, errors.New("credentials: missing `command` field — executable command must be provided")
		}

		execProvider := &executableSubjectProvider{}
		execProvider.Command = ec.Command
		if ec.TimeoutMillis == 0 {
			execProvider.Timeout = executableDefaultTimeout
		} else {
			execProvider.Timeout = time.Duration(ec.TimeoutMillis) * time.Millisecond
			if execProvider.Timeout < timeoutMinimum || execProvider.Timeout > timeoutMaximum {
				return nil, fmt.Errorf("credentials: invalid `timeout_millis` field — executable timeout must be between %v and %v seconds", timeoutMinimum.Seconds(), timeoutMaximum.Seconds())
			}
		}
		execProvider.OutputFile = ec.OutputFile
		execProvider.client = o.Client
		execProvider.opts = o
		execProvider.env = runtimeEnvironment{}
		return execProvider, nil
	} else if o.CredentialSource.Certificate != nil {
		cert := o.CredentialSource.Certificate
		if !cert.UseDefaultCertificateConfig && cert.CertificateConfigLocation == "" {
			return nil, errors.New("credentials: \"certificate\" object must either specify a certificate_config_location or use_default_certificate_config should be true")
		}
		if cert.UseDefaultCertificateConfig && cert.CertificateConfigLocation != "" {
			return nil, errors.New("credentials: \"certificate\" object cannot specify both a certificate_config_location and use_default_certificate_config=true")
		}
		return &x509Provider{
			TrustChainPath: o.CredentialSource.Certificate.TrustChainPath,
			ConfigFilePath: o.CredentialSource.Certificate.CertificateConfigLocation,
		}, nil
	}
	return nil, errors.New("credentials: unable to parse credential source")
}

func getGoogHeaderValue(conf *Options, p subjectTokenProvider) string {
	return fmt.Sprintf("gl-go/%s auth/%s google-byoid-sdk source/%s sa-impersonation/%t config-lifetime/%t",
		goVersion(),
		"unknown",
		p.providerType(),
		conf.ServiceAccountImpersonationURL != "",
		conf.ServiceAccountImpersonationLifetimeSeconds != 0)
}
