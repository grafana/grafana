package config

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/ec2/imds"
	smithyrequestcompression "github.com/aws/smithy-go/private/requestcompression"
)

// CredentialsSourceName provides a name of the provider when config is
// loaded from environment.
const CredentialsSourceName = "EnvConfigCredentials"

// Environment variables that will be read for configuration values.
const (
	awsAccessKeyIDEnv = "AWS_ACCESS_KEY_ID"
	awsAccessKeyEnv   = "AWS_ACCESS_KEY"

	awsSecretAccessKeyEnv = "AWS_SECRET_ACCESS_KEY"
	awsSecretKeyEnv       = "AWS_SECRET_KEY"

	awsSessionTokenEnv = "AWS_SESSION_TOKEN"

	awsContainerCredentialsFullURIEnv     = "AWS_CONTAINER_CREDENTIALS_FULL_URI"
	awsContainerCredentialsRelativeURIEnv = "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI"
	awsContainerAuthorizationTokenEnv     = "AWS_CONTAINER_AUTHORIZATION_TOKEN"

	awsRegionEnv        = "AWS_REGION"
	awsDefaultRegionEnv = "AWS_DEFAULT_REGION"

	awsProfileEnv        = "AWS_PROFILE"
	awsDefaultProfileEnv = "AWS_DEFAULT_PROFILE"

	awsSharedCredentialsFileEnv = "AWS_SHARED_CREDENTIALS_FILE"

	awsConfigFileEnv = "AWS_CONFIG_FILE"

	awsCABundleEnv = "AWS_CA_BUNDLE"

	awsWebIdentityTokenFileEnv = "AWS_WEB_IDENTITY_TOKEN_FILE"

	awsRoleARNEnv         = "AWS_ROLE_ARN"
	awsRoleSessionNameEnv = "AWS_ROLE_SESSION_NAME"

	awsEnableEndpointDiscoveryEnv = "AWS_ENABLE_ENDPOINT_DISCOVERY"

	awsS3UseARNRegionEnv = "AWS_S3_USE_ARN_REGION"

	awsEc2MetadataServiceEndpointModeEnv = "AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE"

	awsEc2MetadataServiceEndpointEnv = "AWS_EC2_METADATA_SERVICE_ENDPOINT"

	awsEc2MetadataDisabledEnv   = "AWS_EC2_METADATA_DISABLED"
	awsEc2MetadataV1DisabledEnv = "AWS_EC2_METADATA_V1_DISABLED"

	awsS3DisableMultiRegionAccessPointsEnv = "AWS_S3_DISABLE_MULTIREGION_ACCESS_POINTS"

	awsUseDualStackEndpointEnv = "AWS_USE_DUALSTACK_ENDPOINT"

	awsUseFIPSEndpointEnv = "AWS_USE_FIPS_ENDPOINT"

	awsDefaultsModeEnv = "AWS_DEFAULTS_MODE"

	awsMaxAttemptsEnv = "AWS_MAX_ATTEMPTS"
	awsRetryModeEnv   = "AWS_RETRY_MODE"
	awsSdkUaAppIDEnv  = "AWS_SDK_UA_APP_ID"

	awsIgnoreConfiguredEndpointURLEnv = "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS"
	awsEndpointURLEnv                 = "AWS_ENDPOINT_URL"

	awsDisableRequestCompressionEnv      = "AWS_DISABLE_REQUEST_COMPRESSION"
	awsRequestMinCompressionSizeBytesEnv = "AWS_REQUEST_MIN_COMPRESSION_SIZE_BYTES"

	awsS3DisableExpressSessionAuthEnv = "AWS_S3_DISABLE_EXPRESS_SESSION_AUTH"

	awsAccountIDEnv             = "AWS_ACCOUNT_ID"
	awsAccountIDEndpointModeEnv = "AWS_ACCOUNT_ID_ENDPOINT_MODE"

	awsRequestChecksumCalculation = "AWS_REQUEST_CHECKSUM_CALCULATION"
	awsResponseChecksumValidation = "AWS_RESPONSE_CHECKSUM_VALIDATION"

	awsAuthSchemePreferenceEnv = "AWS_AUTH_SCHEME_PREFERENCE"
)

var (
	credAccessEnvKeys = []string{
		awsAccessKeyIDEnv,
		awsAccessKeyEnv,
	}
	credSecretEnvKeys = []string{
		awsSecretAccessKeyEnv,
		awsSecretKeyEnv,
	}
	regionEnvKeys = []string{
		awsRegionEnv,
		awsDefaultRegionEnv,
	}
	profileEnvKeys = []string{
		awsProfileEnv,
		awsDefaultProfileEnv,
	}
)

// EnvConfig is a collection of environment values the SDK will read
// setup config from. All environment values are optional. But some values
// such as credentials require multiple values to be complete or the values
// will be ignored.
type EnvConfig struct {
	// Environment configuration values. If set both Access Key ID and Secret Access
	// Key must be provided. Session Token and optionally also be provided, but is
	// not required.
	//
	//	# Access Key ID
	//	AWS_ACCESS_KEY_ID=AKID
	//	AWS_ACCESS_KEY=AKID # only read if AWS_ACCESS_KEY_ID is not set.
	//
	//	# Secret Access Key
	//	AWS_SECRET_ACCESS_KEY=SECRET
	//	AWS_SECRET_KEY=SECRET # only read if AWS_SECRET_ACCESS_KEY is not set.
	//
	//	# Session Token
	//	AWS_SESSION_TOKEN=TOKEN
	Credentials aws.Credentials

	// ContainerCredentialsEndpoint value is the HTTP enabled endpoint to retrieve credentials
	// using the endpointcreds.Provider
	ContainerCredentialsEndpoint string

	// ContainerCredentialsRelativePath is the relative URI path that will be used when attempting to retrieve
	// credentials from the container endpoint.
	ContainerCredentialsRelativePath string

	// ContainerAuthorizationToken is the authorization token that will be included in the HTTP Authorization
	// header when attempting to retrieve credentials from the container credentials endpoint.
	ContainerAuthorizationToken string

	// Region value will instruct the SDK where to make service API requests to. If is
	// not provided in the environment the region must be provided before a service
	// client request is made.
	//
	//	AWS_REGION=us-west-2
	//	AWS_DEFAULT_REGION=us-west-2
	Region string

	// Profile name the SDK should load use when loading shared configuration from the
	// shared configuration files. If not provided "default" will be used as the
	// profile name.
	//
	//	AWS_PROFILE=my_profile
	//	AWS_DEFAULT_PROFILE=my_profile
	SharedConfigProfile string

	// Shared credentials file path can be set to instruct the SDK to use an alternate
	// file for the shared credentials. If not set the file will be loaded from
	// $HOME/.aws/credentials on Linux/Unix based systems, and
	// %USERPROFILE%\.aws\credentials on Windows.
	//
	//	AWS_SHARED_CREDENTIALS_FILE=$HOME/my_shared_credentials
	SharedCredentialsFile string

	// Shared config file path can be set to instruct the SDK to use an alternate
	// file for the shared config. If not set the file will be loaded from
	// $HOME/.aws/config on Linux/Unix based systems, and
	// %USERPROFILE%\.aws\config on Windows.
	//
	//	AWS_CONFIG_FILE=$HOME/my_shared_config
	SharedConfigFile string

	// Sets the path to a custom Credentials Authority (CA) Bundle PEM file
	// that the SDK will use instead of the system's root CA bundle.
	// Only use this if you want to configure the SDK to use a custom set
	// of CAs.
	//
	// Enabling this option will attempt to merge the Transport
	// into the SDK's HTTP client. If the client's Transport is
	// not a http.Transport an error will be returned. If the
	// Transport's TLS config is set this option will cause the
	// SDK to overwrite the Transport's TLS config's  RootCAs value.
	//
	// Setting a custom HTTPClient in the aws.Config options will override this setting.
	// To use this option and custom HTTP client, the HTTP client needs to be provided
	// when creating the config. Not the service client.
	//
	//  AWS_CA_BUNDLE=$HOME/my_custom_ca_bundle
	CustomCABundle string

	// Enables endpoint discovery via environment variables.
	//
	//	AWS_ENABLE_ENDPOINT_DISCOVERY=true
	EnableEndpointDiscovery aws.EndpointDiscoveryEnableState

	// Specifies the WebIdentity token the SDK should use to assume a role
	// with.
	//
	//  AWS_WEB_IDENTITY_TOKEN_FILE=file_path
	WebIdentityTokenFilePath string

	// Specifies the IAM role arn to use when assuming an role.
	//
	//  AWS_ROLE_ARN=role_arn
	RoleARN string

	// Specifies the IAM role session name to use when assuming a role.
	//
	//  AWS_ROLE_SESSION_NAME=session_name
	RoleSessionName string

	// Specifies if the S3 service should allow ARNs to direct the region
	// the client's requests are sent to.
	//
	// AWS_S3_USE_ARN_REGION=true
	S3UseARNRegion *bool

	// Specifies if the EC2 IMDS service client is enabled.
	//
	// AWS_EC2_METADATA_DISABLED=true
	EC2IMDSClientEnableState imds.ClientEnableState

	// Specifies if EC2 IMDSv1 fallback is disabled.
	//
	// AWS_EC2_METADATA_V1_DISABLED=true
	EC2IMDSv1Disabled *bool

	// Specifies the EC2 Instance Metadata Service default endpoint selection mode (IPv4 or IPv6)
	//
	// AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE=IPv6
	EC2IMDSEndpointMode imds.EndpointModeState

	// Specifies the EC2 Instance Metadata Service endpoint to use. If specified it overrides EC2IMDSEndpointMode.
	//
	// AWS_EC2_METADATA_SERVICE_ENDPOINT=http://fd00:ec2::254
	EC2IMDSEndpoint string

	// Specifies if the S3 service should disable multi-region access points
	// support.
	//
	// AWS_S3_DISABLE_MULTIREGION_ACCESS_POINTS=true
	S3DisableMultiRegionAccessPoints *bool

	// Specifies that SDK clients must resolve a dual-stack endpoint for
	// services.
	//
	// AWS_USE_DUALSTACK_ENDPOINT=true
	UseDualStackEndpoint aws.DualStackEndpointState

	// Specifies that SDK clients must resolve a FIPS endpoint for
	// services.
	//
	// AWS_USE_FIPS_ENDPOINT=true
	UseFIPSEndpoint aws.FIPSEndpointState

	// Specifies the SDK Defaults Mode used by services.
	//
	// AWS_DEFAULTS_MODE=standard
	DefaultsMode aws.DefaultsMode

	// Specifies the maximum number attempts an API client will call an
	// operation that fails with a retryable error.
	//
	// AWS_MAX_ATTEMPTS=3
	RetryMaxAttempts int

	// Specifies the retry model the API client will be created with.
	//
	// aws_retry_mode=standard
	RetryMode aws.RetryMode

	// aws sdk app ID that can be added to user agent header string
	AppID string

	// Flag used to disable configured endpoints.
	IgnoreConfiguredEndpoints *bool

	// Value to contain configured endpoints to be propagated to
	// corresponding endpoint resolution field.
	BaseEndpoint string

	// determine if request compression is allowed, default to false
	// retrieved from env var AWS_DISABLE_REQUEST_COMPRESSION
	DisableRequestCompression *bool

	// inclusive threshold request body size to trigger compression,
	// default to 10240 and must be within 0 and 10485760 bytes inclusive
	// retrieved from env var AWS_REQUEST_MIN_COMPRESSION_SIZE_BYTES
	RequestMinCompressSizeBytes *int64

	// Whether S3Express auth is disabled.
	//
	// This will NOT prevent requests from being made to S3Express buckets, it
	// will only bypass the modified endpoint routing and signing behaviors
	// associated with the feature.
	S3DisableExpressAuth *bool

	// Indicates whether account ID will be required/ignored in endpoint2.0 routing
	AccountIDEndpointMode aws.AccountIDEndpointMode

	// Indicates whether request checksum should be calculated
	RequestChecksumCalculation aws.RequestChecksumCalculation

	// Indicates whether response checksum should be validated
	ResponseChecksumValidation aws.ResponseChecksumValidation

	// Priority list of preferred auth scheme names (e.g. sigv4a).
	AuthSchemePreference []string
}

// loadEnvConfig reads configuration values from the OS's environment variables.
// Returning the a Config typed EnvConfig to satisfy the ConfigLoader func type.
func loadEnvConfig(ctx context.Context, cfgs configs) (Config, error) {
	return NewEnvConfig()
}

// NewEnvConfig retrieves the SDK's environment configuration.
// See `EnvConfig` for the values that will be retrieved.
func NewEnvConfig() (EnvConfig, error) {
	var cfg EnvConfig

	creds := aws.Credentials{
		Source: CredentialsSourceName,
	}
	setStringFromEnvVal(&creds.AccessKeyID, credAccessEnvKeys)
	setStringFromEnvVal(&creds.SecretAccessKey, credSecretEnvKeys)
	if creds.HasKeys() {
		creds.AccountID = os.Getenv(awsAccountIDEnv)
		creds.SessionToken = os.Getenv(awsSessionTokenEnv)
		cfg.Credentials = creds
	}

	cfg.ContainerCredentialsEndpoint = os.Getenv(awsContainerCredentialsFullURIEnv)
	cfg.ContainerCredentialsRelativePath = os.Getenv(awsContainerCredentialsRelativeURIEnv)
	cfg.ContainerAuthorizationToken = os.Getenv(awsContainerAuthorizationTokenEnv)

	setStringFromEnvVal(&cfg.Region, regionEnvKeys)
	setStringFromEnvVal(&cfg.SharedConfigProfile, profileEnvKeys)

	cfg.SharedCredentialsFile = os.Getenv(awsSharedCredentialsFileEnv)
	cfg.SharedConfigFile = os.Getenv(awsConfigFileEnv)

	cfg.CustomCABundle = os.Getenv(awsCABundleEnv)

	cfg.WebIdentityTokenFilePath = os.Getenv(awsWebIdentityTokenFileEnv)

	cfg.RoleARN = os.Getenv(awsRoleARNEnv)
	cfg.RoleSessionName = os.Getenv(awsRoleSessionNameEnv)

	cfg.AppID = os.Getenv(awsSdkUaAppIDEnv)

	if err := setBoolPtrFromEnvVal(&cfg.DisableRequestCompression, []string{awsDisableRequestCompressionEnv}); err != nil {
		return cfg, err
	}
	if err := setInt64PtrFromEnvVal(&cfg.RequestMinCompressSizeBytes, []string{awsRequestMinCompressionSizeBytesEnv}, smithyrequestcompression.MaxRequestMinCompressSizeBytes); err != nil {
		return cfg, err
	}

	if err := setEndpointDiscoveryTypeFromEnvVal(&cfg.EnableEndpointDiscovery, []string{awsEnableEndpointDiscoveryEnv}); err != nil {
		return cfg, err
	}

	if err := setBoolPtrFromEnvVal(&cfg.S3UseARNRegion, []string{awsS3UseARNRegionEnv}); err != nil {
		return cfg, err
	}

	setEC2IMDSClientEnableState(&cfg.EC2IMDSClientEnableState, []string{awsEc2MetadataDisabledEnv})
	if err := setEC2IMDSEndpointMode(&cfg.EC2IMDSEndpointMode, []string{awsEc2MetadataServiceEndpointModeEnv}); err != nil {
		return cfg, err
	}
	cfg.EC2IMDSEndpoint = os.Getenv(awsEc2MetadataServiceEndpointEnv)
	if err := setBoolPtrFromEnvVal(&cfg.EC2IMDSv1Disabled, []string{awsEc2MetadataV1DisabledEnv}); err != nil {
		return cfg, err
	}

	if err := setBoolPtrFromEnvVal(&cfg.S3DisableMultiRegionAccessPoints, []string{awsS3DisableMultiRegionAccessPointsEnv}); err != nil {
		return cfg, err
	}

	if err := setUseDualStackEndpointFromEnvVal(&cfg.UseDualStackEndpoint, []string{awsUseDualStackEndpointEnv}); err != nil {
		return cfg, err
	}

	if err := setUseFIPSEndpointFromEnvVal(&cfg.UseFIPSEndpoint, []string{awsUseFIPSEndpointEnv}); err != nil {
		return cfg, err
	}

	if err := setDefaultsModeFromEnvVal(&cfg.DefaultsMode, []string{awsDefaultsModeEnv}); err != nil {
		return cfg, err
	}

	if err := setIntFromEnvVal(&cfg.RetryMaxAttempts, []string{awsMaxAttemptsEnv}); err != nil {
		return cfg, err
	}
	if err := setRetryModeFromEnvVal(&cfg.RetryMode, []string{awsRetryModeEnv}); err != nil {
		return cfg, err
	}

	setStringFromEnvVal(&cfg.BaseEndpoint, []string{awsEndpointURLEnv})

	if err := setBoolPtrFromEnvVal(&cfg.IgnoreConfiguredEndpoints, []string{awsIgnoreConfiguredEndpointURLEnv}); err != nil {
		return cfg, err
	}

	if err := setBoolPtrFromEnvVal(&cfg.S3DisableExpressAuth, []string{awsS3DisableExpressSessionAuthEnv}); err != nil {
		return cfg, err
	}

	if err := setAIDEndPointModeFromEnvVal(&cfg.AccountIDEndpointMode, []string{awsAccountIDEndpointModeEnv}); err != nil {
		return cfg, err
	}

	if err := setRequestChecksumCalculationFromEnvVal(&cfg.RequestChecksumCalculation, []string{awsRequestChecksumCalculation}); err != nil {
		return cfg, err
	}
	if err := setResponseChecksumValidationFromEnvVal(&cfg.ResponseChecksumValidation, []string{awsResponseChecksumValidation}); err != nil {
		return cfg, err
	}

	cfg.AuthSchemePreference = toAuthSchemePreferenceList(os.Getenv(awsAuthSchemePreferenceEnv))

	return cfg, nil
}

func (c EnvConfig) getDefaultsMode(ctx context.Context) (aws.DefaultsMode, bool, error) {
	if len(c.DefaultsMode) == 0 {
		return "", false, nil
	}
	return c.DefaultsMode, true, nil
}

func (c EnvConfig) getAppID(context.Context) (string, bool, error) {
	return c.AppID, len(c.AppID) > 0, nil
}

func (c EnvConfig) getDisableRequestCompression(context.Context) (bool, bool, error) {
	if c.DisableRequestCompression == nil {
		return false, false, nil
	}
	return *c.DisableRequestCompression, true, nil
}

func (c EnvConfig) getRequestMinCompressSizeBytes(context.Context) (int64, bool, error) {
	if c.RequestMinCompressSizeBytes == nil {
		return 0, false, nil
	}
	return *c.RequestMinCompressSizeBytes, true, nil
}

func (c EnvConfig) getAccountIDEndpointMode(context.Context) (aws.AccountIDEndpointMode, bool, error) {
	return c.AccountIDEndpointMode, len(c.AccountIDEndpointMode) > 0, nil
}

func (c EnvConfig) getRequestChecksumCalculation(context.Context) (aws.RequestChecksumCalculation, bool, error) {
	return c.RequestChecksumCalculation, c.RequestChecksumCalculation > 0, nil
}

func (c EnvConfig) getResponseChecksumValidation(context.Context) (aws.ResponseChecksumValidation, bool, error) {
	return c.ResponseChecksumValidation, c.ResponseChecksumValidation > 0, nil
}

// GetRetryMaxAttempts returns the value of AWS_MAX_ATTEMPTS if was specified,
// and not 0.
func (c EnvConfig) GetRetryMaxAttempts(ctx context.Context) (int, bool, error) {
	if c.RetryMaxAttempts == 0 {
		return 0, false, nil
	}
	return c.RetryMaxAttempts, true, nil
}

// GetRetryMode returns the RetryMode of AWS_RETRY_MODE if was specified, and a
// valid value.
func (c EnvConfig) GetRetryMode(ctx context.Context) (aws.RetryMode, bool, error) {
	if len(c.RetryMode) == 0 {
		return "", false, nil
	}
	return c.RetryMode, true, nil
}

func setEC2IMDSClientEnableState(state *imds.ClientEnableState, keys []string) {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue
		}
		switch {
		case strings.EqualFold(value, "true"):
			*state = imds.ClientDisabled
		case strings.EqualFold(value, "false"):
			*state = imds.ClientEnabled
		default:
			continue
		}
		break
	}
}

func setDefaultsModeFromEnvVal(mode *aws.DefaultsMode, keys []string) error {
	for _, k := range keys {
		if value := os.Getenv(k); len(value) > 0 {
			if ok := mode.SetFromString(value); !ok {
				return fmt.Errorf("invalid %s value: %s", k, value)
			}
			break
		}
	}
	return nil
}

func setRetryModeFromEnvVal(mode *aws.RetryMode, keys []string) (err error) {
	for _, k := range keys {
		if value := os.Getenv(k); len(value) > 0 {
			*mode, err = aws.ParseRetryMode(value)
			if err != nil {
				return fmt.Errorf("invalid %s value, %w", k, err)
			}
			break
		}
	}
	return nil
}

func setEC2IMDSEndpointMode(mode *imds.EndpointModeState, keys []string) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue
		}
		if err := mode.SetFromString(value); err != nil {
			return fmt.Errorf("invalid value for environment variable, %s=%s, %v", k, value, err)
		}
	}
	return nil
}

func setAIDEndPointModeFromEnvVal(m *aws.AccountIDEndpointMode, keys []string) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue
		}

		switch value {
		case "preferred":
			*m = aws.AccountIDEndpointModePreferred
		case "required":
			*m = aws.AccountIDEndpointModeRequired
		case "disabled":
			*m = aws.AccountIDEndpointModeDisabled
		default:
			return fmt.Errorf("invalid value for environment variable, %s=%s, must be preferred/required/disabled", k, value)
		}
		break
	}
	return nil
}

func setRequestChecksumCalculationFromEnvVal(m *aws.RequestChecksumCalculation, keys []string) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue
		}

		switch strings.ToLower(value) {
		case checksumWhenSupported:
			*m = aws.RequestChecksumCalculationWhenSupported
		case checksumWhenRequired:
			*m = aws.RequestChecksumCalculationWhenRequired
		default:
			return fmt.Errorf("invalid value for environment variable, %s=%s, must be when_supported/when_required", k, value)
		}
	}
	return nil
}

func setResponseChecksumValidationFromEnvVal(m *aws.ResponseChecksumValidation, keys []string) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue
		}

		switch strings.ToLower(value) {
		case checksumWhenSupported:
			*m = aws.ResponseChecksumValidationWhenSupported
		case checksumWhenRequired:
			*m = aws.ResponseChecksumValidationWhenRequired
		default:
			return fmt.Errorf("invalid value for environment variable, %s=%s, must be when_supported/when_required", k, value)
		}

	}
	return nil
}

// GetRegion returns the AWS Region if set in the environment. Returns an empty
// string if not set.
func (c EnvConfig) getRegion(ctx context.Context) (string, bool, error) {
	if len(c.Region) == 0 {
		return "", false, nil
	}
	return c.Region, true, nil
}

// GetSharedConfigProfile returns the shared config profile if set in the
// environment. Returns an empty string if not set.
func (c EnvConfig) getSharedConfigProfile(ctx context.Context) (string, bool, error) {
	if len(c.SharedConfigProfile) == 0 {
		return "", false, nil
	}

	return c.SharedConfigProfile, true, nil
}

// getSharedConfigFiles returns a slice of filenames set in the environment.
//
// Will return the filenames in the order of:
// * Shared Config
func (c EnvConfig) getSharedConfigFiles(context.Context) ([]string, bool, error) {
	var files []string
	if v := c.SharedConfigFile; len(v) > 0 {
		files = append(files, v)
	}

	if len(files) == 0 {
		return nil, false, nil
	}
	return files, true, nil
}

// getSharedCredentialsFiles returns a slice of filenames set in the environment.
//
// Will return the filenames in the order of:
// * Shared Credentials
func (c EnvConfig) getSharedCredentialsFiles(context.Context) ([]string, bool, error) {
	var files []string
	if v := c.SharedCredentialsFile; len(v) > 0 {
		files = append(files, v)
	}
	if len(files) == 0 {
		return nil, false, nil
	}
	return files, true, nil
}

// GetCustomCABundle returns the custom CA bundle's PEM bytes if the file was
func (c EnvConfig) getCustomCABundle(context.Context) (io.Reader, bool, error) {
	if len(c.CustomCABundle) == 0 {
		return nil, false, nil
	}

	b, err := os.ReadFile(c.CustomCABundle)
	if err != nil {
		return nil, false, err
	}
	return bytes.NewReader(b), true, nil
}

// GetIgnoreConfiguredEndpoints is used in knowing when to disable configured
// endpoints feature.
func (c EnvConfig) GetIgnoreConfiguredEndpoints(context.Context) (bool, bool, error) {
	if c.IgnoreConfiguredEndpoints == nil {
		return false, false, nil
	}

	return *c.IgnoreConfiguredEndpoints, true, nil
}

func (c EnvConfig) getBaseEndpoint(context.Context) (string, bool, error) {
	return c.BaseEndpoint, len(c.BaseEndpoint) > 0, nil
}

// GetServiceBaseEndpoint is used to retrieve a normalized SDK ID for use
// with configured endpoints.
func (c EnvConfig) GetServiceBaseEndpoint(ctx context.Context, sdkID string) (string, bool, error) {
	if endpt := os.Getenv(fmt.Sprintf("%s_%s", awsEndpointURLEnv, normalizeEnv(sdkID))); endpt != "" {
		return endpt, true, nil
	}
	return "", false, nil
}

func normalizeEnv(sdkID string) string {
	upper := strings.ToUpper(sdkID)
	return strings.ReplaceAll(upper, " ", "_")
}

// GetS3UseARNRegion returns whether to allow ARNs to direct the region
// the S3 client's requests are sent to.
func (c EnvConfig) GetS3UseARNRegion(ctx context.Context) (value, ok bool, err error) {
	if c.S3UseARNRegion == nil {
		return false, false, nil
	}

	return *c.S3UseARNRegion, true, nil
}

// GetS3DisableMultiRegionAccessPoints returns whether to disable multi-region access point
// support for the S3 client.
func (c EnvConfig) GetS3DisableMultiRegionAccessPoints(ctx context.Context) (value, ok bool, err error) {
	if c.S3DisableMultiRegionAccessPoints == nil {
		return false, false, nil
	}

	return *c.S3DisableMultiRegionAccessPoints, true, nil
}

// GetUseDualStackEndpoint returns whether the service's dual-stack endpoint should be
// used for requests.
func (c EnvConfig) GetUseDualStackEndpoint(ctx context.Context) (value aws.DualStackEndpointState, found bool, err error) {
	if c.UseDualStackEndpoint == aws.DualStackEndpointStateUnset {
		return aws.DualStackEndpointStateUnset, false, nil
	}

	return c.UseDualStackEndpoint, true, nil
}

// GetUseFIPSEndpoint returns whether the service's FIPS endpoint should be
// used for requests.
func (c EnvConfig) GetUseFIPSEndpoint(ctx context.Context) (value aws.FIPSEndpointState, found bool, err error) {
	if c.UseFIPSEndpoint == aws.FIPSEndpointStateUnset {
		return aws.FIPSEndpointStateUnset, false, nil
	}

	return c.UseFIPSEndpoint, true, nil
}

func setStringFromEnvVal(dst *string, keys []string) {
	for _, k := range keys {
		if v := os.Getenv(k); len(v) > 0 {
			*dst = v
			break
		}
	}
}

func setIntFromEnvVal(dst *int, keys []string) error {
	for _, k := range keys {
		if v := os.Getenv(k); len(v) > 0 {
			i, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				return fmt.Errorf("invalid value %s=%s, %w", k, v, err)
			}
			*dst = int(i)
			break
		}
	}

	return nil
}

func setBoolPtrFromEnvVal(dst **bool, keys []string) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue
		}

		if *dst == nil {
			*dst = new(bool)
		}

		switch {
		case strings.EqualFold(value, "false"):
			**dst = false
		case strings.EqualFold(value, "true"):
			**dst = true
		default:
			return fmt.Errorf(
				"invalid value for environment variable, %s=%s, need true or false",
				k, value)
		}
		break
	}

	return nil
}

func setInt64PtrFromEnvVal(dst **int64, keys []string, max int64) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue
		}

		v, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid value for env var, %s=%s, need int64", k, value)
		} else if v < 0 || v > max {
			return fmt.Errorf("invalid range for env var min request compression size bytes %q, must be within 0 and 10485760 inclusively", v)
		}
		if *dst == nil {
			*dst = new(int64)
		}

		**dst = v
		break
	}

	return nil
}

func setEndpointDiscoveryTypeFromEnvVal(dst *aws.EndpointDiscoveryEnableState, keys []string) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue // skip if empty
		}

		switch {
		case strings.EqualFold(value, endpointDiscoveryDisabled):
			*dst = aws.EndpointDiscoveryDisabled
		case strings.EqualFold(value, endpointDiscoveryEnabled):
			*dst = aws.EndpointDiscoveryEnabled
		case strings.EqualFold(value, endpointDiscoveryAuto):
			*dst = aws.EndpointDiscoveryAuto
		default:
			return fmt.Errorf(
				"invalid value for environment variable, %s=%s, need true, false or auto",
				k, value)
		}
	}
	return nil
}

func setUseDualStackEndpointFromEnvVal(dst *aws.DualStackEndpointState, keys []string) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue // skip if empty
		}

		switch {
		case strings.EqualFold(value, "true"):
			*dst = aws.DualStackEndpointStateEnabled
		case strings.EqualFold(value, "false"):
			*dst = aws.DualStackEndpointStateDisabled
		default:
			return fmt.Errorf(
				"invalid value for environment variable, %s=%s, need true, false",
				k, value)
		}
	}
	return nil
}

func setUseFIPSEndpointFromEnvVal(dst *aws.FIPSEndpointState, keys []string) error {
	for _, k := range keys {
		value := os.Getenv(k)
		if len(value) == 0 {
			continue // skip if empty
		}

		switch {
		case strings.EqualFold(value, "true"):
			*dst = aws.FIPSEndpointStateEnabled
		case strings.EqualFold(value, "false"):
			*dst = aws.FIPSEndpointStateDisabled
		default:
			return fmt.Errorf(
				"invalid value for environment variable, %s=%s, need true, false",
				k, value)
		}
	}
	return nil
}

// GetEnableEndpointDiscovery returns resolved value for EnableEndpointDiscovery env variable setting.
func (c EnvConfig) GetEnableEndpointDiscovery(ctx context.Context) (value aws.EndpointDiscoveryEnableState, found bool, err error) {
	if c.EnableEndpointDiscovery == aws.EndpointDiscoveryUnset {
		return aws.EndpointDiscoveryUnset, false, nil
	}

	return c.EnableEndpointDiscovery, true, nil
}

// GetEC2IMDSClientEnableState implements a EC2IMDSClientEnableState options resolver interface.
func (c EnvConfig) GetEC2IMDSClientEnableState() (imds.ClientEnableState, bool, error) {
	if c.EC2IMDSClientEnableState == imds.ClientDefaultEnableState {
		return imds.ClientDefaultEnableState, false, nil
	}

	return c.EC2IMDSClientEnableState, true, nil
}

// GetEC2IMDSEndpointMode implements a EC2IMDSEndpointMode option resolver interface.
func (c EnvConfig) GetEC2IMDSEndpointMode() (imds.EndpointModeState, bool, error) {
	if c.EC2IMDSEndpointMode == imds.EndpointModeStateUnset {
		return imds.EndpointModeStateUnset, false, nil
	}

	return c.EC2IMDSEndpointMode, true, nil
}

// GetEC2IMDSEndpoint implements a EC2IMDSEndpoint option resolver interface.
func (c EnvConfig) GetEC2IMDSEndpoint() (string, bool, error) {
	if len(c.EC2IMDSEndpoint) == 0 {
		return "", false, nil
	}

	return c.EC2IMDSEndpoint, true, nil
}

// GetEC2IMDSV1FallbackDisabled implements an EC2IMDSV1FallbackDisabled option
// resolver interface.
func (c EnvConfig) GetEC2IMDSV1FallbackDisabled() (bool, bool) {
	if c.EC2IMDSv1Disabled == nil {
		return false, false
	}

	return *c.EC2IMDSv1Disabled, true
}

// GetS3DisableExpressAuth returns the configured value for
// [EnvConfig.S3DisableExpressAuth].
func (c EnvConfig) GetS3DisableExpressAuth() (value, ok bool) {
	if c.S3DisableExpressAuth == nil {
		return false, false
	}

	return *c.S3DisableExpressAuth, true
}

func (c EnvConfig) getAuthSchemePreference() ([]string, bool) {
	if len(c.AuthSchemePreference) > 0 {
		return c.AuthSchemePreference, true
	}
	return nil, false
}
