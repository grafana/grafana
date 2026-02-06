package config

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/ec2/imds"
	"github.com/aws/aws-sdk-go-v2/internal/ini"
	"github.com/aws/aws-sdk-go-v2/internal/shareddefaults"
	"github.com/aws/smithy-go/logging"
	smithyrequestcompression "github.com/aws/smithy-go/private/requestcompression"
)

const (
	// Prefix to use for filtering profiles. The profile prefix should only
	// exist in the shared config file, not the credentials file.
	profilePrefix = `profile `

	// Prefix to be used for SSO sections. These are supposed to only exist in
	// the shared config file, not the credentials file.
	ssoSectionPrefix = `sso-session `

	// Prefix for services section. It is referenced in profile via the services
	// parameter to configure clients for service-specific parameters.
	servicesPrefix = `services `

	// string equivalent for boolean
	endpointDiscoveryDisabled = `false`
	endpointDiscoveryEnabled  = `true`
	endpointDiscoveryAuto     = `auto`

	// Static Credentials group
	accessKeyIDKey  = `aws_access_key_id`     // group required
	secretAccessKey = `aws_secret_access_key` // group required
	sessionTokenKey = `aws_session_token`     // optional

	// Assume Role Credentials group
	roleArnKey             = `role_arn`          // group required
	sourceProfileKey       = `source_profile`    // group required
	credentialSourceKey    = `credential_source` // group required (or source_profile)
	externalIDKey          = `external_id`       // optional
	mfaSerialKey           = `mfa_serial`        // optional
	roleSessionNameKey     = `role_session_name` // optional
	roleDurationSecondsKey = "duration_seconds"  // optional

	// AWS Single Sign-On (AWS SSO) group
	ssoSessionNameKey = "sso_session"

	ssoRegionKey   = "sso_region"
	ssoStartURLKey = "sso_start_url"

	ssoAccountIDKey = "sso_account_id"
	ssoRoleNameKey  = "sso_role_name"

	// Additional Config fields
	regionKey = `region`

	// endpoint discovery group
	enableEndpointDiscoveryKey = `endpoint_discovery_enabled` // optional

	// External Credential process
	credentialProcessKey = `credential_process` // optional

	// Web Identity Token File
	webIdentityTokenFileKey = `web_identity_token_file` // optional

	// S3 ARN Region Usage
	s3UseARNRegionKey = "s3_use_arn_region"

	ec2MetadataServiceEndpointModeKey = "ec2_metadata_service_endpoint_mode"

	ec2MetadataServiceEndpointKey = "ec2_metadata_service_endpoint"

	ec2MetadataV1DisabledKey = "ec2_metadata_v1_disabled"

	// Use DualStack Endpoint Resolution
	useDualStackEndpoint = "use_dualstack_endpoint"

	// DefaultSharedConfigProfile is the default profile to be used when
	// loading configuration from the config files if another profile name
	// is not provided.
	DefaultSharedConfigProfile = `default`

	// S3 Disable Multi-Region AccessPoints
	s3DisableMultiRegionAccessPointsKey = `s3_disable_multiregion_access_points`

	useFIPSEndpointKey = "use_fips_endpoint"

	defaultsModeKey = "defaults_mode"

	// Retry options
	retryMaxAttemptsKey = "max_attempts"
	retryModeKey        = "retry_mode"

	caBundleKey = "ca_bundle"

	sdkAppID = "sdk_ua_app_id"

	ignoreConfiguredEndpoints = "ignore_configured_endpoint_urls"

	endpointURL = "endpoint_url"

	servicesSectionKey = "services"

	disableRequestCompression      = "disable_request_compression"
	requestMinCompressionSizeBytes = "request_min_compression_size_bytes"

	s3DisableExpressSessionAuthKey = "s3_disable_express_session_auth"

	accountIDKey          = "aws_account_id"
	accountIDEndpointMode = "account_id_endpoint_mode"

	requestChecksumCalculationKey = "request_checksum_calculation"
	responseChecksumValidationKey = "response_checksum_validation"
	checksumWhenSupported         = "when_supported"
	checksumWhenRequired          = "when_required"

	authSchemePreferenceKey = "auth_scheme_preference"

	loginSessionKey = "login_session"
)

// defaultSharedConfigProfile allows for swapping the default profile for testing
var defaultSharedConfigProfile = DefaultSharedConfigProfile

// DefaultSharedCredentialsFilename returns the SDK's default file path
// for the shared credentials file.
//
// Builds the shared config file path based on the OS's platform.
//
//   - Linux/Unix: $HOME/.aws/credentials
//   - Windows: %USERPROFILE%\.aws\credentials
func DefaultSharedCredentialsFilename() string {
	return filepath.Join(shareddefaults.UserHomeDir(), ".aws", "credentials")
}

// DefaultSharedConfigFilename returns the SDK's default file path for
// the shared config file.
//
// Builds the shared config file path based on the OS's platform.
//
//   - Linux/Unix: $HOME/.aws/config
//   - Windows: %USERPROFILE%\.aws\config
func DefaultSharedConfigFilename() string {
	return filepath.Join(shareddefaults.UserHomeDir(), ".aws", "config")
}

// DefaultSharedConfigFiles is a slice of the default shared config files that
// the will be used in order to load the SharedConfig.
var DefaultSharedConfigFiles = []string{
	DefaultSharedConfigFilename(),
}

// DefaultSharedCredentialsFiles is a slice of the default shared credentials
// files that the will be used in order to load the SharedConfig.
var DefaultSharedCredentialsFiles = []string{
	DefaultSharedCredentialsFilename(),
}

// SSOSession provides the shared configuration parameters of the sso-session
// section.
type SSOSession struct {
	Name        string
	SSORegion   string
	SSOStartURL string
}

func (s *SSOSession) setFromIniSection(section ini.Section) {
	updateString(&s.Name, section, ssoSessionNameKey)
	updateString(&s.SSORegion, section, ssoRegionKey)
	updateString(&s.SSOStartURL, section, ssoStartURLKey)
}

// Services contains values configured in the services section
// of the AWS configuration file.
type Services struct {
	// Services section values
	// {"serviceId": {"key": "value"}}
	// e.g. {"s3": {"endpoint_url": "example.com"}}
	ServiceValues map[string]map[string]string
}

func (s *Services) setFromIniSection(section ini.Section) {
	if s.ServiceValues == nil {
		s.ServiceValues = make(map[string]map[string]string)
	}
	for _, service := range section.List() {
		s.ServiceValues[service] = section.Map(service)
	}
}

// SharedConfig represents the configuration fields of the SDK config files.
type SharedConfig struct {
	Profile string

	// Credentials values from the config file. Both aws_access_key_id
	// and aws_secret_access_key must be provided together in the same file
	// to be considered valid. The values will be ignored if not a complete group.
	// aws_session_token is an optional field that can be provided if both of the
	// other two fields are also provided.
	//
	//	aws_access_key_id
	//	aws_secret_access_key
	//	aws_session_token
	Credentials aws.Credentials

	CredentialSource     string
	CredentialProcess    string
	WebIdentityTokenFile string

	// SSO session options
	SSOSessionName string
	SSOSession     *SSOSession

	// Legacy SSO session options
	SSORegion   string
	SSOStartURL string

	// SSO fields not used
	SSOAccountID string
	SSORoleName  string

	RoleARN             string
	ExternalID          string
	MFASerial           string
	RoleSessionName     string
	RoleDurationSeconds *time.Duration

	SourceProfileName string
	Source            *SharedConfig

	// Region is the region the SDK should use for looking up AWS service endpoints
	// and signing requests.
	//
	//	region = us-west-2
	Region string

	// EnableEndpointDiscovery can be enabled or disabled in the shared config
	// by setting endpoint_discovery_enabled to true, or false respectively.
	//
	//	endpoint_discovery_enabled = true
	EnableEndpointDiscovery aws.EndpointDiscoveryEnableState

	// Specifies if the S3 service should allow ARNs to direct the region
	// the client's requests are sent to.
	//
	// s3_use_arn_region=true
	S3UseARNRegion *bool

	// Specifies the EC2 Instance Metadata Service default endpoint selection
	// mode (IPv4 or IPv6)
	//
	// ec2_metadata_service_endpoint_mode=IPv6
	EC2IMDSEndpointMode imds.EndpointModeState

	// Specifies the EC2 Instance Metadata Service endpoint to use. If
	// specified it overrides EC2IMDSEndpointMode.
	//
	// ec2_metadata_service_endpoint=http://fd00:ec2::254
	EC2IMDSEndpoint string

	// Specifies that IMDS clients should not fallback to IMDSv1 if token
	// requests fail.
	//
	// ec2_metadata_v1_disabled=true
	EC2IMDSv1Disabled *bool

	// Specifies if the S3 service should disable support for Multi-Region
	// access-points
	//
	// s3_disable_multiregion_access_points=true
	S3DisableMultiRegionAccessPoints *bool

	// Specifies that SDK clients must resolve a dual-stack endpoint for
	// services.
	//
	// use_dualstack_endpoint=true
	UseDualStackEndpoint aws.DualStackEndpointState

	// Specifies that SDK clients must resolve a FIPS endpoint for
	// services.
	//
	// use_fips_endpoint=true
	UseFIPSEndpoint aws.FIPSEndpointState

	// Specifies which defaults mode should be used by services.
	//
	// defaults_mode=standard
	DefaultsMode aws.DefaultsMode

	// Specifies the maximum number attempts an API client will call an
	// operation that fails with a retryable error.
	//
	// max_attempts=3
	RetryMaxAttempts int

	// Specifies the retry model the API client will be created with.
	//
	// retry_mode=standard
	RetryMode aws.RetryMode

	// Sets the path to a custom Credentials Authority (CA) Bundle PEM file
	// that the SDK will use instead of the system's root CA bundle. Only use
	// this if you want to configure the SDK to use a custom set of CAs.
	//
	// Enabling this option will attempt to merge the Transport into the SDK's
	// HTTP client. If the client's Transport is not a http.Transport an error
	// will be returned. If the Transport's TLS config is set this option will
	// cause the SDK to overwrite the Transport's TLS config's  RootCAs value.
	//
	// Setting a custom HTTPClient in the aws.Config options will override this
	// setting. To use this option and custom HTTP client, the HTTP client
	// needs to be provided when creating the config. Not the service client.
	//
	//  ca_bundle=$HOME/my_custom_ca_bundle
	CustomCABundle string

	// aws sdk app ID that can be added to user agent header string
	AppID string

	// Flag used to disable configured endpoints.
	IgnoreConfiguredEndpoints *bool

	// Value to contain configured endpoints to be propagated to
	// corresponding endpoint resolution field.
	BaseEndpoint string

	// Services section config.
	ServicesSectionName string
	Services            Services

	// determine if request compression is allowed, default to false
	// retrieved from config file's profile field disable_request_compression
	DisableRequestCompression *bool

	// inclusive threshold request body size to trigger compression,
	// default to 10240 and must be within 0 and 10485760 bytes inclusive
	// retrieved from config file's profile field request_min_compression_size_bytes
	RequestMinCompressSizeBytes *int64

	// Whether S3Express auth is disabled.
	//
	// This will NOT prevent requests from being made to S3Express buckets, it
	// will only bypass the modified endpoint routing and signing behaviors
	// associated with the feature.
	S3DisableExpressAuth *bool

	AccountIDEndpointMode aws.AccountIDEndpointMode

	// RequestChecksumCalculation indicates if the request checksum should be calculated
	RequestChecksumCalculation aws.RequestChecksumCalculation

	// ResponseChecksumValidation indicates if the response checksum should be validated
	ResponseChecksumValidation aws.ResponseChecksumValidation

	// Priority list of preferred auth scheme names (e.g. sigv4a).
	AuthSchemePreference []string

	// Session ARN from an `aws login` session.
	LoginSession string
}

func (c SharedConfig) getDefaultsMode(ctx context.Context) (value aws.DefaultsMode, ok bool, err error) {
	if len(c.DefaultsMode) == 0 {
		return "", false, nil
	}

	return c.DefaultsMode, true, nil
}

// GetRetryMaxAttempts returns the maximum number of attempts an API client
// created Retryer should attempt an operation call before failing.
func (c SharedConfig) GetRetryMaxAttempts(ctx context.Context) (value int, ok bool, err error) {
	if c.RetryMaxAttempts == 0 {
		return 0, false, nil
	}

	return c.RetryMaxAttempts, true, nil
}

// GetRetryMode returns the model the API client should create its Retryer in.
func (c SharedConfig) GetRetryMode(ctx context.Context) (value aws.RetryMode, ok bool, err error) {
	if len(c.RetryMode) == 0 {
		return "", false, nil
	}

	return c.RetryMode, true, nil
}

// GetS3UseARNRegion returns if the S3 service should allow ARNs to direct the region
// the client's requests are sent to.
func (c SharedConfig) GetS3UseARNRegion(ctx context.Context) (value, ok bool, err error) {
	if c.S3UseARNRegion == nil {
		return false, false, nil
	}

	return *c.S3UseARNRegion, true, nil
}

// GetEnableEndpointDiscovery returns if the enable_endpoint_discovery is set.
func (c SharedConfig) GetEnableEndpointDiscovery(ctx context.Context) (value aws.EndpointDiscoveryEnableState, ok bool, err error) {
	if c.EnableEndpointDiscovery == aws.EndpointDiscoveryUnset {
		return aws.EndpointDiscoveryUnset, false, nil
	}

	return c.EnableEndpointDiscovery, true, nil
}

// GetS3DisableMultiRegionAccessPoints returns if the S3 service should disable support for Multi-Region
// access-points.
func (c SharedConfig) GetS3DisableMultiRegionAccessPoints(ctx context.Context) (value, ok bool, err error) {
	if c.S3DisableMultiRegionAccessPoints == nil {
		return false, false, nil
	}

	return *c.S3DisableMultiRegionAccessPoints, true, nil
}

// GetRegion returns the region for the profile if a region is set.
func (c SharedConfig) getRegion(ctx context.Context) (string, bool, error) {
	if len(c.Region) == 0 {
		return "", false, nil
	}
	return c.Region, true, nil
}

// GetCredentialsProvider returns the credentials for a profile if they were set.
func (c SharedConfig) getCredentialsProvider() (aws.Credentials, bool, error) {
	return c.Credentials, true, nil
}

// GetEC2IMDSEndpointMode implements a EC2IMDSEndpointMode option resolver interface.
func (c SharedConfig) GetEC2IMDSEndpointMode() (imds.EndpointModeState, bool, error) {
	if c.EC2IMDSEndpointMode == imds.EndpointModeStateUnset {
		return imds.EndpointModeStateUnset, false, nil
	}

	return c.EC2IMDSEndpointMode, true, nil
}

// GetEC2IMDSEndpoint implements a EC2IMDSEndpoint option resolver interface.
func (c SharedConfig) GetEC2IMDSEndpoint() (string, bool, error) {
	if len(c.EC2IMDSEndpoint) == 0 {
		return "", false, nil
	}

	return c.EC2IMDSEndpoint, true, nil
}

// GetEC2IMDSV1FallbackDisabled implements an EC2IMDSV1FallbackDisabled option
// resolver interface.
func (c SharedConfig) GetEC2IMDSV1FallbackDisabled() (bool, bool) {
	if c.EC2IMDSv1Disabled == nil {
		return false, false
	}

	return *c.EC2IMDSv1Disabled, true
}

// GetUseDualStackEndpoint returns whether the service's dual-stack endpoint should be
// used for requests.
func (c SharedConfig) GetUseDualStackEndpoint(ctx context.Context) (value aws.DualStackEndpointState, found bool, err error) {
	if c.UseDualStackEndpoint == aws.DualStackEndpointStateUnset {
		return aws.DualStackEndpointStateUnset, false, nil
	}

	return c.UseDualStackEndpoint, true, nil
}

// GetUseFIPSEndpoint returns whether the service's FIPS endpoint should be
// used for requests.
func (c SharedConfig) GetUseFIPSEndpoint(ctx context.Context) (value aws.FIPSEndpointState, found bool, err error) {
	if c.UseFIPSEndpoint == aws.FIPSEndpointStateUnset {
		return aws.FIPSEndpointStateUnset, false, nil
	}

	return c.UseFIPSEndpoint, true, nil
}

// GetS3DisableExpressAuth returns the configured value for
// [SharedConfig.S3DisableExpressAuth].
func (c SharedConfig) GetS3DisableExpressAuth() (value, ok bool) {
	if c.S3DisableExpressAuth == nil {
		return false, false
	}

	return *c.S3DisableExpressAuth, true
}

// GetCustomCABundle returns the custom CA bundle's PEM bytes if the file was
func (c SharedConfig) getCustomCABundle(context.Context) (io.Reader, bool, error) {
	if len(c.CustomCABundle) == 0 {
		return nil, false, nil
	}

	b, err := ioutil.ReadFile(c.CustomCABundle)
	if err != nil {
		return nil, false, err
	}
	return bytes.NewReader(b), true, nil
}

// getAppID returns the sdk app ID if set in shared config profile
func (c SharedConfig) getAppID(context.Context) (string, bool, error) {
	return c.AppID, len(c.AppID) > 0, nil
}

// GetIgnoreConfiguredEndpoints is used in knowing when to disable configured
// endpoints feature.
func (c SharedConfig) GetIgnoreConfiguredEndpoints(context.Context) (bool, bool, error) {
	if c.IgnoreConfiguredEndpoints == nil {
		return false, false, nil
	}

	return *c.IgnoreConfiguredEndpoints, true, nil
}

func (c SharedConfig) getBaseEndpoint(context.Context) (string, bool, error) {
	return c.BaseEndpoint, len(c.BaseEndpoint) > 0, nil
}

// GetServiceBaseEndpoint is used to retrieve a normalized SDK ID for use
// with configured endpoints.
func (c SharedConfig) GetServiceBaseEndpoint(ctx context.Context, sdkID string) (string, bool, error) {
	if service, ok := c.Services.ServiceValues[normalizeShared(sdkID)]; ok {
		if endpt, ok := service[endpointURL]; ok {
			return endpt, true, nil
		}
	}
	return "", false, nil
}

func normalizeShared(sdkID string) string {
	lower := strings.ToLower(sdkID)
	return strings.ReplaceAll(lower, " ", "_")
}

func (c SharedConfig) getServicesObject(context.Context) (map[string]map[string]string, bool, error) {
	return c.Services.ServiceValues, c.Services.ServiceValues != nil, nil
}

// loadSharedConfigIgnoreNotExist is an alias for loadSharedConfig with the
// addition of ignoring when none of the files exist or when the profile
// is not found in any of the files.
func loadSharedConfigIgnoreNotExist(ctx context.Context, configs configs) (Config, error) {
	cfg, err := loadSharedConfig(ctx, configs)
	if err != nil {
		if _, ok := err.(SharedConfigProfileNotExistError); ok {
			return SharedConfig{}, nil
		}
		return nil, err
	}

	return cfg, nil
}

// loadSharedConfig uses the configs passed in to load the SharedConfig from file
// The file names and profile name are sourced from the configs.
//
// If profile name is not provided DefaultSharedConfigProfile (default) will
// be used.
//
// If shared config filenames are not provided DefaultSharedConfigFiles will
// be used.
//
// Config providers used:
// * sharedConfigProfileProvider
// * sharedConfigFilesProvider
func loadSharedConfig(ctx context.Context, configs configs) (Config, error) {
	var profile string
	var configFiles []string
	var credentialsFiles []string
	var ok bool
	var err error

	profile, ok, err = getSharedConfigProfile(ctx, configs)
	if err != nil {
		return nil, err
	}
	if !ok {
		profile = defaultSharedConfigProfile
	}

	configFiles, ok, err = getSharedConfigFiles(ctx, configs)
	if err != nil {
		return nil, err
	}

	credentialsFiles, ok, err = getSharedCredentialsFiles(ctx, configs)
	if err != nil {
		return nil, err
	}

	// setup logger if log configuration warning is seti
	var logger logging.Logger
	logWarnings, found, err := getLogConfigurationWarnings(ctx, configs)
	if err != nil {
		return SharedConfig{}, err
	}
	if found && logWarnings {
		logger, found, err = getLogger(ctx, configs)
		if err != nil {
			return SharedConfig{}, err
		}
		if !found {
			logger = logging.NewStandardLogger(os.Stderr)
		}
	}

	return LoadSharedConfigProfile(ctx, profile,
		func(o *LoadSharedConfigOptions) {
			o.Logger = logger
			o.ConfigFiles = configFiles
			o.CredentialsFiles = credentialsFiles
		},
	)
}

// LoadSharedConfigOptions struct contains optional values that can be used to load the config.
type LoadSharedConfigOptions struct {

	// CredentialsFiles are the shared credentials files
	CredentialsFiles []string

	// ConfigFiles are the shared config files
	ConfigFiles []string

	// Logger is the logger used to log shared config behavior
	Logger logging.Logger
}

// LoadSharedConfigProfile retrieves the configuration from the list of files
// using the profile provided. The order the files are listed will determine
// precedence. Values in subsequent files will overwrite values defined in
// earlier files.
//
// For example, given two files A and B. Both define credentials. If the order
// of the files are A then B, B's credential values will be used instead of A's.
//
// If config files are not set, SDK will default to using a file at location `.aws/config` if present.
// If credentials files are not set, SDK will default to using a file at location `.aws/credentials` if present.
// No default files are set, if files set to an empty slice.
//
// You can read more about shared config and credentials file location at
// https://docs.aws.amazon.com/credref/latest/refdocs/file-location.html#file-location
func LoadSharedConfigProfile(ctx context.Context, profile string, optFns ...func(*LoadSharedConfigOptions)) (SharedConfig, error) {
	var option LoadSharedConfigOptions
	for _, fn := range optFns {
		fn(&option)
	}

	if option.ConfigFiles == nil {
		option.ConfigFiles = DefaultSharedConfigFiles
	}

	if option.CredentialsFiles == nil {
		option.CredentialsFiles = DefaultSharedCredentialsFiles
	}

	// load shared configuration sections from shared configuration INI options
	configSections, err := loadIniFiles(option.ConfigFiles)
	if err != nil {
		return SharedConfig{}, err
	}

	// check for profile prefix and drop duplicates or invalid profiles
	err = processConfigSections(ctx, &configSections, option.Logger)
	if err != nil {
		return SharedConfig{}, err
	}

	// load shared credentials sections from shared credentials INI options
	credentialsSections, err := loadIniFiles(option.CredentialsFiles)
	if err != nil {
		return SharedConfig{}, err
	}

	// check for profile prefix and drop duplicates or invalid profiles
	err = processCredentialsSections(ctx, &credentialsSections, option.Logger)
	if err != nil {
		return SharedConfig{}, err
	}

	err = mergeSections(&configSections, credentialsSections)
	if err != nil {
		return SharedConfig{}, err
	}

	cfg := SharedConfig{}
	profiles := map[string]struct{}{}

	if err = cfg.setFromIniSections(profiles, profile, configSections, option.Logger); err != nil {
		return SharedConfig{}, err
	}

	return cfg, nil
}

func processConfigSections(ctx context.Context, sections *ini.Sections, logger logging.Logger) error {
	skipSections := map[string]struct{}{}

	for _, section := range sections.List() {
		if _, ok := skipSections[section]; ok {
			continue
		}

		// drop sections from config file that do not have expected prefixes.
		switch {
		case strings.HasPrefix(section, profilePrefix):
			// Rename sections to remove "profile " prefixing to match with
			// credentials file. If default is already present, it will be
			// dropped.
			newName, err := renameProfileSection(section, sections, logger)
			if err != nil {
				return fmt.Errorf("failed to rename profile section, %w", err)
			}
			skipSections[newName] = struct{}{}

		case strings.HasPrefix(section, ssoSectionPrefix):
		case strings.HasPrefix(section, servicesPrefix):
		case strings.EqualFold(section, "default"):
		default:
			// drop this section, as invalid profile name
			sections.DeleteSection(section)

			if logger != nil {
				logger.Logf(logging.Debug, "A profile defined with name `%v` is ignored. "+
					"For use within a shared configuration file, "+
					"a non-default profile must have `profile ` "+
					"prefixed to the profile name.",
					section,
				)
			}
		}
	}
	return nil
}

func renameProfileSection(section string, sections *ini.Sections, logger logging.Logger) (string, error) {
	v, ok := sections.GetSection(section)
	if !ok {
		return "", fmt.Errorf("error processing profiles within the shared configuration files")
	}

	// delete section with profile as prefix
	sections.DeleteSection(section)

	// set the value to non-prefixed name in sections.
	section = strings.TrimPrefix(section, profilePrefix)
	if sections.HasSection(section) {
		oldSection, _ := sections.GetSection(section)
		v.Logs = append(v.Logs,
			fmt.Sprintf("A non-default profile not prefixed with `profile ` found in %s, "+
				"overriding non-default profile from %s",
				v.SourceFile, oldSection.SourceFile))
		sections.DeleteSection(section)
	}

	// assign non-prefixed name to section
	v.Name = section
	sections.SetSection(section, v)

	return section, nil
}

func processCredentialsSections(ctx context.Context, sections *ini.Sections, logger logging.Logger) error {
	for _, section := range sections.List() {
		// drop profiles with prefix for credential files
		if strings.HasPrefix(section, profilePrefix) {
			// drop this section, as invalid profile name
			sections.DeleteSection(section)

			if logger != nil {
				logger.Logf(logging.Debug,
					"The profile defined with name `%v` is ignored. A profile with the `profile ` prefix is invalid "+
						"for the shared credentials file.\n",
					section,
				)
			}
		}
	}
	return nil
}

func loadIniFiles(filenames []string) (ini.Sections, error) {
	mergedSections := ini.NewSections()

	for _, filename := range filenames {
		sections, err := ini.OpenFile(filename)
		var v *ini.UnableToReadFile
		if ok := errors.As(err, &v); ok {
			// Skip files which can't be opened and read for whatever reason.
			// We treat such files as empty, and do not fall back to other locations.
			continue
		} else if err != nil {
			return ini.Sections{}, SharedConfigLoadError{Filename: filename, Err: err}
		}

		// mergeSections into mergedSections
		err = mergeSections(&mergedSections, sections)
		if err != nil {
			return ini.Sections{}, SharedConfigLoadError{Filename: filename, Err: err}
		}
	}

	return mergedSections, nil
}

// mergeSections merges source section properties into destination section properties
func mergeSections(dst *ini.Sections, src ini.Sections) error {
	for _, sectionName := range src.List() {
		srcSection, _ := src.GetSection(sectionName)

		if (!srcSection.Has(accessKeyIDKey) && srcSection.Has(secretAccessKey)) ||
			(srcSection.Has(accessKeyIDKey) && !srcSection.Has(secretAccessKey)) {
			srcSection.Errors = append(srcSection.Errors,
				fmt.Errorf("partial credentials found for profile %v", sectionName))
		}

		if !dst.HasSection(sectionName) {
			dst.SetSection(sectionName, srcSection)
			continue
		}

		// merge with destination srcSection
		dstSection, _ := dst.GetSection(sectionName)

		// errors should be overriden if any
		dstSection.Errors = srcSection.Errors

		// Access key id update
		if srcSection.Has(accessKeyIDKey) && srcSection.Has(secretAccessKey) {
			accessKey := srcSection.String(accessKeyIDKey)
			secretKey := srcSection.String(secretAccessKey)

			if dstSection.Has(accessKeyIDKey) {
				dstSection.Logs = append(dstSection.Logs, newMergeKeyLogMessage(sectionName, accessKeyIDKey,
					dstSection.SourceFile[accessKeyIDKey], srcSection.SourceFile[accessKeyIDKey]))
			}

			// update access key
			v, err := ini.NewStringValue(accessKey)
			if err != nil {
				return fmt.Errorf("error merging access key, %w", err)
			}
			dstSection.UpdateValue(accessKeyIDKey, v)

			// update secret key
			v, err = ini.NewStringValue(secretKey)
			if err != nil {
				return fmt.Errorf("error merging secret key, %w", err)
			}
			dstSection.UpdateValue(secretAccessKey, v)

			// update session token
			if err = mergeStringKey(&srcSection, &dstSection, sectionName, sessionTokenKey); err != nil {
				return err
			}

			// update source file to reflect where the static creds came from
			dstSection.UpdateSourceFile(accessKeyIDKey, srcSection.SourceFile[accessKeyIDKey])
			dstSection.UpdateSourceFile(secretAccessKey, srcSection.SourceFile[secretAccessKey])
		}

		stringKeys := []string{
			roleArnKey,
			sourceProfileKey,
			credentialSourceKey,
			externalIDKey,
			mfaSerialKey,
			roleSessionNameKey,
			regionKey,
			enableEndpointDiscoveryKey,
			credentialProcessKey,
			webIdentityTokenFileKey,
			s3UseARNRegionKey,
			s3DisableMultiRegionAccessPointsKey,
			ec2MetadataServiceEndpointModeKey,
			ec2MetadataServiceEndpointKey,
			ec2MetadataV1DisabledKey,
			useDualStackEndpoint,
			useFIPSEndpointKey,
			defaultsModeKey,
			retryModeKey,
			caBundleKey,
			roleDurationSecondsKey,
			retryMaxAttemptsKey,

			ssoSessionNameKey,
			ssoAccountIDKey,
			ssoRegionKey,
			ssoRoleNameKey,
			ssoStartURLKey,

			authSchemePreferenceKey,

			loginSessionKey,
		}
		for i := range stringKeys {
			if err := mergeStringKey(&srcSection, &dstSection, sectionName, stringKeys[i]); err != nil {
				return err
			}
		}

		// set srcSection on dst srcSection
		*dst = dst.SetSection(sectionName, dstSection)
	}

	return nil
}

func mergeStringKey(srcSection *ini.Section, dstSection *ini.Section, sectionName, key string) error {
	if srcSection.Has(key) {
		srcValue := srcSection.String(key)
		val, err := ini.NewStringValue(srcValue)
		if err != nil {
			return fmt.Errorf("error merging %s, %w", key, err)
		}

		if dstSection.Has(key) {
			dstSection.Logs = append(dstSection.Logs, newMergeKeyLogMessage(sectionName, key,
				dstSection.SourceFile[key], srcSection.SourceFile[key]))
		}

		dstSection.UpdateValue(key, val)
		dstSection.UpdateSourceFile(key, srcSection.SourceFile[key])
	}
	return nil
}

func newMergeKeyLogMessage(sectionName, key, dstSourceFile, srcSourceFile string) string {
	return fmt.Sprintf("For profile: %v, overriding %v value, defined in %v "+
		"with a %v value found in a duplicate profile defined at file %v. \n",
		sectionName, key, dstSourceFile, key, srcSourceFile)
}

// Returns an error if all of the files fail to load. If at least one file is
// successfully loaded and contains the profile, no error will be returned.
func (c *SharedConfig) setFromIniSections(profiles map[string]struct{}, profile string,
	sections ini.Sections, logger logging.Logger) error {
	c.Profile = profile

	section, ok := sections.GetSection(profile)
	if !ok {
		return SharedConfigProfileNotExistError{
			Profile: profile,
		}
	}

	// if logs are appended to the section, log them
	if section.Logs != nil && logger != nil {
		for _, log := range section.Logs {
			logger.Logf(logging.Debug, log)
		}
	}

	// set config from the provided INI section
	err := c.setFromIniSection(profile, section)
	if err != nil {
		return fmt.Errorf("error fetching config from profile, %v, %w", profile, err)
	}

	if _, ok := profiles[profile]; ok {
		// if this is the second instance of the profile the Assume Role
		// options must be cleared because they are only valid for the
		// first reference of a profile. The self linked instance of the
		// profile only have credential provider options.
		c.clearAssumeRoleOptions()
	} else {
		// First time a profile has been seen. Assert if the credential type
		// requires a role ARN, the ARN is also set
		if err := c.validateCredentialsConfig(profile); err != nil {
			return err
		}
	}

	// if not top level profile and has credentials, return with credentials.
	if len(profiles) != 0 && c.Credentials.HasKeys() {
		return nil
	}

	profiles[profile] = struct{}{}

	// validate no colliding credentials type are present
	if err := c.validateCredentialType(); err != nil {
		return err
	}

	// Link source profiles for assume roles
	if len(c.SourceProfileName) != 0 {
		// Linked profile via source_profile ignore credential provider
		// options, the source profile must provide the credentials.
		c.clearCredentialOptions()

		srcCfg := &SharedConfig{}
		err := srcCfg.setFromIniSections(profiles, c.SourceProfileName, sections, logger)
		if err != nil {
			// SourceProfileName that doesn't exist is an error in configuration.
			if _, ok := err.(SharedConfigProfileNotExistError); ok {
				err = SharedConfigAssumeRoleError{
					RoleARN: c.RoleARN,
					Profile: c.SourceProfileName,
					Err:     err,
				}
			}
			return err
		}

		if !srcCfg.hasCredentials() {
			return SharedConfigAssumeRoleError{
				RoleARN: c.RoleARN,
				Profile: c.SourceProfileName,
			}
		}

		c.Source = srcCfg
	}

	// If the profile contains an SSO session parameter, the session MUST exist
	// as a section in the config file. Load the SSO session using the name
	// provided. If the session section is not found or incomplete an error
	// will be returned.
	if c.hasSSOTokenProviderConfiguration() {
		section, ok := sections.GetSection(ssoSectionPrefix + strings.TrimSpace(c.SSOSessionName))
		if !ok {
			return fmt.Errorf("failed to find SSO session section, %v", c.SSOSessionName)
		}
		var ssoSession SSOSession
		ssoSession.setFromIniSection(section)
		ssoSession.Name = c.SSOSessionName
		c.SSOSession = &ssoSession
	}

	if len(c.ServicesSectionName) > 0 {
		if section, ok := sections.GetSection(servicesPrefix + c.ServicesSectionName); ok {
			var svcs Services
			svcs.setFromIniSection(section)
			c.Services = svcs
		}
	}

	return nil
}

// setFromIniSection loads the configuration from the profile section defined in
// the provided INI file. A SharedConfig pointer type value is used so that
// multiple config file loadings can be chained.
//
// Only loads complete logically grouped values, and will not set fields in cfg
// for incomplete grouped values in the config. Such as credentials. For example
// if a config file only includes aws_access_key_id but no aws_secret_access_key
// the aws_access_key_id will be ignored.
func (c *SharedConfig) setFromIniSection(profile string, section ini.Section) error {
	if len(section.Name) == 0 {
		sources := make([]string, 0)
		for _, v := range section.SourceFile {
			sources = append(sources, v)
		}

		return fmt.Errorf("parsing error : could not find profile section name after processing files: %v", sources)
	}

	if len(section.Errors) != 0 {
		var errStatement string
		for i, e := range section.Errors {
			errStatement = fmt.Sprintf("%d, %v\n", i+1, e.Error())
		}
		return fmt.Errorf("Error using profile: \n %v", errStatement)
	}

	// Assume Role
	updateString(&c.RoleARN, section, roleArnKey)
	updateString(&c.ExternalID, section, externalIDKey)
	updateString(&c.MFASerial, section, mfaSerialKey)
	updateString(&c.RoleSessionName, section, roleSessionNameKey)
	updateString(&c.SourceProfileName, section, sourceProfileKey)
	updateString(&c.CredentialSource, section, credentialSourceKey)
	updateString(&c.Region, section, regionKey)

	// AWS Single Sign-On (AWS SSO)
	// SSO session options
	updateString(&c.SSOSessionName, section, ssoSessionNameKey)

	// Legacy SSO session options
	updateString(&c.SSORegion, section, ssoRegionKey)
	updateString(&c.SSOStartURL, section, ssoStartURLKey)

	// SSO fields not used
	updateString(&c.SSOAccountID, section, ssoAccountIDKey)
	updateString(&c.SSORoleName, section, ssoRoleNameKey)

	// we're retaining a behavioral quirk with this field that existed before
	// the removal of literal parsing for #2276:
	//   - if the key is missing, the config field will not be set
	//   - if the key is set to a non-numeric, the config field will be set to 0
	if section.Has(roleDurationSecondsKey) {
		if v, ok := section.Int(roleDurationSecondsKey); ok {
			c.RoleDurationSeconds = aws.Duration(time.Duration(v) * time.Second)
		} else {
			c.RoleDurationSeconds = aws.Duration(time.Duration(0))
		}
	}

	updateString(&c.CredentialProcess, section, credentialProcessKey)
	updateString(&c.WebIdentityTokenFile, section, webIdentityTokenFileKey)

	updateEndpointDiscoveryType(&c.EnableEndpointDiscovery, section, enableEndpointDiscoveryKey)
	updateBoolPtr(&c.S3UseARNRegion, section, s3UseARNRegionKey)
	updateBoolPtr(&c.S3DisableMultiRegionAccessPoints, section, s3DisableMultiRegionAccessPointsKey)
	updateBoolPtr(&c.S3DisableExpressAuth, section, s3DisableExpressSessionAuthKey)

	if err := updateEC2MetadataServiceEndpointMode(&c.EC2IMDSEndpointMode, section, ec2MetadataServiceEndpointModeKey); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %v", ec2MetadataServiceEndpointModeKey, err)
	}
	updateString(&c.EC2IMDSEndpoint, section, ec2MetadataServiceEndpointKey)
	updateBoolPtr(&c.EC2IMDSv1Disabled, section, ec2MetadataV1DisabledKey)

	updateUseDualStackEndpoint(&c.UseDualStackEndpoint, section, useDualStackEndpoint)
	updateUseFIPSEndpoint(&c.UseFIPSEndpoint, section, useFIPSEndpointKey)

	if err := updateDefaultsMode(&c.DefaultsMode, section, defaultsModeKey); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %w", defaultsModeKey, err)
	}

	if err := updateInt(&c.RetryMaxAttempts, section, retryMaxAttemptsKey); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %w", retryMaxAttemptsKey, err)
	}
	if err := updateRetryMode(&c.RetryMode, section, retryModeKey); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %w", retryModeKey, err)
	}

	updateString(&c.CustomCABundle, section, caBundleKey)

	// user agent app ID added to request User-Agent header
	updateString(&c.AppID, section, sdkAppID)

	updateBoolPtr(&c.IgnoreConfiguredEndpoints, section, ignoreConfiguredEndpoints)

	updateString(&c.BaseEndpoint, section, endpointURL)

	if err := updateDisableRequestCompression(&c.DisableRequestCompression, section, disableRequestCompression); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %w", disableRequestCompression, err)
	}
	if err := updateRequestMinCompressSizeBytes(&c.RequestMinCompressSizeBytes, section, requestMinCompressionSizeBytes); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %w", requestMinCompressionSizeBytes, err)
	}

	if err := updateAIDEndpointMode(&c.AccountIDEndpointMode, section, accountIDEndpointMode); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %w", accountIDEndpointMode, err)
	}

	if err := updateRequestChecksumCalculation(&c.RequestChecksumCalculation, section, requestChecksumCalculationKey); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %w", requestChecksumCalculationKey, err)
	}
	if err := updateResponseChecksumValidation(&c.ResponseChecksumValidation, section, responseChecksumValidationKey); err != nil {
		return fmt.Errorf("failed to load %s from shared config, %w", responseChecksumValidationKey, err)
	}

	// Shared Credentials
	creds := aws.Credentials{
		AccessKeyID:     section.String(accessKeyIDKey),
		SecretAccessKey: section.String(secretAccessKey),
		SessionToken:    section.String(sessionTokenKey),
		Source:          fmt.Sprintf("SharedConfigCredentials: %s", section.SourceFile[accessKeyIDKey]),
		AccountID:       section.String(accountIDKey),
	}

	if creds.HasKeys() {
		c.Credentials = creds
	}

	updateString(&c.ServicesSectionName, section, servicesSectionKey)

	c.AuthSchemePreference = toAuthSchemePreferenceList(section.String(authSchemePreferenceKey))

	updateString(&c.LoginSession, section, loginSessionKey)

	return nil
}

func updateRequestMinCompressSizeBytes(bytes **int64, sec ini.Section, key string) error {
	if !sec.Has(key) {
		return nil
	}

	v, ok := sec.Int(key)
	if !ok {
		return fmt.Errorf("invalid value for min request compression size bytes %s, need int64", sec.String(key))
	}
	if v < 0 || v > smithyrequestcompression.MaxRequestMinCompressSizeBytes {
		return fmt.Errorf("invalid range for min request compression size bytes %d, must be within 0 and 10485760 inclusively", v)
	}
	*bytes = new(int64)
	**bytes = v
	return nil
}

func updateDisableRequestCompression(disable **bool, sec ini.Section, key string) error {
	if !sec.Has(key) {
		return nil
	}

	v := sec.String(key)
	switch {
	case v == "true":
		*disable = new(bool)
		**disable = true
	case v == "false":
		*disable = new(bool)
		**disable = false
	default:
		return fmt.Errorf("invalid value for shared config profile field, %s=%s, need true or false", key, v)
	}
	return nil
}

func updateAIDEndpointMode(m *aws.AccountIDEndpointMode, sec ini.Section, key string) error {
	if !sec.Has(key) {
		return nil
	}

	v := sec.String(key)
	switch v {
	case "preferred":
		*m = aws.AccountIDEndpointModePreferred
	case "required":
		*m = aws.AccountIDEndpointModeRequired
	case "disabled":
		*m = aws.AccountIDEndpointModeDisabled
	default:
		return fmt.Errorf("invalid value for shared config profile field, %s=%s, must be preferred/required/disabled", key, v)
	}

	return nil
}

func updateRequestChecksumCalculation(m *aws.RequestChecksumCalculation, sec ini.Section, key string) error {
	if !sec.Has(key) {
		return nil
	}

	v := sec.String(key)
	switch strings.ToLower(v) {
	case checksumWhenSupported:
		*m = aws.RequestChecksumCalculationWhenSupported
	case checksumWhenRequired:
		*m = aws.RequestChecksumCalculationWhenRequired
	default:
		return fmt.Errorf("invalid value for shared config profile field, %s=%s, must be when_supported/when_required", key, v)
	}

	return nil
}

func updateResponseChecksumValidation(m *aws.ResponseChecksumValidation, sec ini.Section, key string) error {
	if !sec.Has(key) {
		return nil
	}

	v := sec.String(key)
	switch strings.ToLower(v) {
	case checksumWhenSupported:
		*m = aws.ResponseChecksumValidationWhenSupported
	case checksumWhenRequired:
		*m = aws.ResponseChecksumValidationWhenRequired
	default:
		return fmt.Errorf("invalid value for shared config profile field, %s=%s, must be when_supported/when_required", key, v)
	}

	return nil
}

func (c SharedConfig) getRequestMinCompressSizeBytes(ctx context.Context) (int64, bool, error) {
	if c.RequestMinCompressSizeBytes == nil {
		return 0, false, nil
	}
	return *c.RequestMinCompressSizeBytes, true, nil
}

func (c SharedConfig) getDisableRequestCompression(ctx context.Context) (bool, bool, error) {
	if c.DisableRequestCompression == nil {
		return false, false, nil
	}
	return *c.DisableRequestCompression, true, nil
}

func (c SharedConfig) getAccountIDEndpointMode(ctx context.Context) (aws.AccountIDEndpointMode, bool, error) {
	return c.AccountIDEndpointMode, len(c.AccountIDEndpointMode) > 0, nil
}

func (c SharedConfig) getRequestChecksumCalculation(ctx context.Context) (aws.RequestChecksumCalculation, bool, error) {
	return c.RequestChecksumCalculation, c.RequestChecksumCalculation > 0, nil
}

func (c SharedConfig) getResponseChecksumValidation(ctx context.Context) (aws.ResponseChecksumValidation, bool, error) {
	return c.ResponseChecksumValidation, c.ResponseChecksumValidation > 0, nil
}

func updateDefaultsMode(mode *aws.DefaultsMode, section ini.Section, key string) error {
	if !section.Has(key) {
		return nil
	}
	value := section.String(key)
	if ok := mode.SetFromString(value); !ok {
		return fmt.Errorf("invalid value: %s", value)
	}
	return nil
}

func updateRetryMode(mode *aws.RetryMode, section ini.Section, key string) (err error) {
	if !section.Has(key) {
		return nil
	}
	value := section.String(key)
	if *mode, err = aws.ParseRetryMode(value); err != nil {
		return err
	}
	return nil
}

func updateEC2MetadataServiceEndpointMode(endpointMode *imds.EndpointModeState, section ini.Section, key string) error {
	if !section.Has(key) {
		return nil
	}
	value := section.String(key)
	return endpointMode.SetFromString(value)
}

func (c *SharedConfig) validateCredentialsConfig(profile string) error {
	if err := c.validateCredentialsRequireARN(profile); err != nil {
		return err
	}

	return nil
}

func (c *SharedConfig) validateCredentialsRequireARN(profile string) error {
	var credSource string

	switch {
	case len(c.SourceProfileName) != 0:
		credSource = sourceProfileKey
	case len(c.CredentialSource) != 0:
		credSource = credentialSourceKey
	case len(c.WebIdentityTokenFile) != 0:
		credSource = webIdentityTokenFileKey
	}

	if len(credSource) != 0 && len(c.RoleARN) == 0 {
		return CredentialRequiresARNError{
			Type:    credSource,
			Profile: profile,
		}
	}

	return nil
}

func (c *SharedConfig) validateCredentialType() error {
	// Only one or no credential type can be defined.
	if !oneOrNone(
		len(c.SourceProfileName) != 0,
		len(c.CredentialSource) != 0,
		len(c.CredentialProcess) != 0,
		len(c.WebIdentityTokenFile) != 0,
	) {
		return fmt.Errorf("only one credential type may be specified per profile: source profile, credential source, credential process, web identity token")
	}

	return nil
}

func (c *SharedConfig) validateSSOConfiguration() error {
	if c.hasSSOTokenProviderConfiguration() {
		err := c.validateSSOTokenProviderConfiguration()
		if err != nil {
			return err
		}
		return nil
	}

	if c.hasLegacySSOConfiguration() {
		err := c.validateLegacySSOConfiguration()
		if err != nil {
			return err
		}
	}
	return nil
}

func (c *SharedConfig) validateSSOTokenProviderConfiguration() error {
	var missing []string

	if len(c.SSOSessionName) == 0 {
		missing = append(missing, ssoSessionNameKey)
	}

	if c.SSOSession == nil {
		missing = append(missing, ssoSectionPrefix)
	} else {
		if len(c.SSOSession.SSORegion) == 0 {
			missing = append(missing, ssoRegionKey)
		}

		if len(c.SSOSession.SSOStartURL) == 0 {
			missing = append(missing, ssoStartURLKey)
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("profile %q is configured to use SSO but is missing required configuration: %s",
			c.Profile, strings.Join(missing, ", "))
	}

	if len(c.SSORegion) > 0 && c.SSORegion != c.SSOSession.SSORegion {
		return fmt.Errorf("%s in profile %q must match %s in %s", ssoRegionKey, c.Profile, ssoRegionKey, ssoSectionPrefix)
	}

	if len(c.SSOStartURL) > 0 && c.SSOStartURL != c.SSOSession.SSOStartURL {
		return fmt.Errorf("%s in profile %q must match %s in %s", ssoStartURLKey, c.Profile, ssoStartURLKey, ssoSectionPrefix)
	}

	return nil
}

func (c *SharedConfig) validateLegacySSOConfiguration() error {
	var missing []string

	if len(c.SSORegion) == 0 {
		missing = append(missing, ssoRegionKey)
	}

	if len(c.SSOStartURL) == 0 {
		missing = append(missing, ssoStartURLKey)
	}

	if len(c.SSOAccountID) == 0 {
		missing = append(missing, ssoAccountIDKey)
	}

	if len(c.SSORoleName) == 0 {
		missing = append(missing, ssoRoleNameKey)
	}

	if len(missing) > 0 {
		return fmt.Errorf("profile %q is configured to use SSO but is missing required configuration: %s",
			c.Profile, strings.Join(missing, ", "))
	}
	return nil
}

func (c *SharedConfig) hasCredentials() bool {
	switch {
	case len(c.SourceProfileName) != 0:
	case len(c.CredentialSource) != 0:
	case len(c.CredentialProcess) != 0:
	case len(c.WebIdentityTokenFile) != 0:
	case c.hasSSOConfiguration():
	case c.Credentials.HasKeys():
	default:
		return false
	}

	return true
}

func (c *SharedConfig) hasSSOConfiguration() bool {
	return c.hasSSOTokenProviderConfiguration() || c.hasLegacySSOConfiguration()
}

func (c *SharedConfig) hasSSOTokenProviderConfiguration() bool {
	return len(c.SSOSessionName) > 0
}

func (c *SharedConfig) hasLegacySSOConfiguration() bool {
	return len(c.SSORegion) > 0 || len(c.SSOAccountID) > 0 || len(c.SSOStartURL) > 0 || len(c.SSORoleName) > 0
}

func (c *SharedConfig) clearAssumeRoleOptions() {
	c.RoleARN = ""
	c.ExternalID = ""
	c.MFASerial = ""
	c.RoleSessionName = ""
	c.SourceProfileName = ""
}

func (c *SharedConfig) clearCredentialOptions() {
	c.CredentialSource = ""
	c.CredentialProcess = ""
	c.WebIdentityTokenFile = ""
	c.Credentials = aws.Credentials{}
	c.SSOAccountID = ""
	c.SSORegion = ""
	c.SSORoleName = ""
	c.SSOStartURL = ""
}

// SharedConfigLoadError is an error for the shared config file failed to load.
type SharedConfigLoadError struct {
	Filename string
	Err      error
}

// Unwrap returns the underlying error that caused the failure.
func (e SharedConfigLoadError) Unwrap() error {
	return e.Err
}

func (e SharedConfigLoadError) Error() string {
	return fmt.Sprintf("failed to load shared config file, %s, %v", e.Filename, e.Err)
}

// SharedConfigProfileNotExistError is an error for the shared config when
// the profile was not find in the config file.
type SharedConfigProfileNotExistError struct {
	Filename []string
	Profile  string
	Err      error
}

// Unwrap returns the underlying error that caused the failure.
func (e SharedConfigProfileNotExistError) Unwrap() error {
	return e.Err
}

func (e SharedConfigProfileNotExistError) Error() string {
	return fmt.Sprintf("failed to get shared config profile, %s", e.Profile)
}

// SharedConfigAssumeRoleError is an error for the shared config when the
// profile contains assume role information, but that information is invalid
// or not complete.
type SharedConfigAssumeRoleError struct {
	Profile string
	RoleARN string
	Err     error
}

// Unwrap returns the underlying error that caused the failure.
func (e SharedConfigAssumeRoleError) Unwrap() error {
	return e.Err
}

func (e SharedConfigAssumeRoleError) Error() string {
	return fmt.Sprintf("failed to load assume role %s, of profile %s, %v",
		e.RoleARN, e.Profile, e.Err)
}

// CredentialRequiresARNError provides the error for shared config credentials
// that are incorrectly configured in the shared config or credentials file.
type CredentialRequiresARNError struct {
	// type of credentials that were configured.
	Type string

	// Profile name the credentials were in.
	Profile string
}

// Error satisfies the error interface.
func (e CredentialRequiresARNError) Error() string {
	return fmt.Sprintf(
		"credential type %s requires role_arn, profile %s",
		e.Type, e.Profile,
	)
}

func oneOrNone(bs ...bool) bool {
	var count int

	for _, b := range bs {
		if b {
			count++
			if count > 1 {
				return false
			}
		}
	}

	return true
}

// updateString will only update the dst with the value in the section key, key
// is present in the section.
func updateString(dst *string, section ini.Section, key string) {
	if !section.Has(key) {
		return
	}
	*dst = section.String(key)
}

// updateInt will only update the dst with the value in the section key, key
// is present in the section.
//
// Down casts the INI integer value from a int64 to an int, which could be
// different bit size depending on platform.
func updateInt(dst *int, section ini.Section, key string) error {
	if !section.Has(key) {
		return nil
	}

	v, ok := section.Int(key)
	if !ok {
		return fmt.Errorf("invalid value %s=%s, expect integer", key, section.String(key))
	}

	*dst = int(v)
	return nil
}

// updateBool will only update the dst with the value in the section key, key
// is present in the section.
func updateBool(dst *bool, section ini.Section, key string) {
	if !section.Has(key) {
		return
	}

	// retains pre-#2276 behavior where non-bool value would resolve to false
	v, _ := section.Bool(key)
	*dst = v
}

// updateBoolPtr will only update the dst with the value in the section key,
// key is present in the section.
func updateBoolPtr(dst **bool, section ini.Section, key string) {
	if !section.Has(key) {
		return
	}

	// retains pre-#2276 behavior where non-bool value would resolve to false
	v, _ := section.Bool(key)
	*dst = new(bool)
	**dst = v
}

// updateEndpointDiscoveryType will only update the dst with the value in the section, if
// a valid key and corresponding EndpointDiscoveryType is found.
func updateEndpointDiscoveryType(dst *aws.EndpointDiscoveryEnableState, section ini.Section, key string) {
	if !section.Has(key) {
		return
	}

	value := section.String(key)
	if len(value) == 0 {
		return
	}

	switch {
	case strings.EqualFold(value, endpointDiscoveryDisabled):
		*dst = aws.EndpointDiscoveryDisabled
	case strings.EqualFold(value, endpointDiscoveryEnabled):
		*dst = aws.EndpointDiscoveryEnabled
	case strings.EqualFold(value, endpointDiscoveryAuto):
		*dst = aws.EndpointDiscoveryAuto
	}
}

// updateEndpointDiscoveryType will only update the dst with the value in the section, if
// a valid key and corresponding EndpointDiscoveryType is found.
func updateUseDualStackEndpoint(dst *aws.DualStackEndpointState, section ini.Section, key string) {
	if !section.Has(key) {
		return
	}

	// retains pre-#2276 behavior where non-bool value would resolve to false
	if v, _ := section.Bool(key); v {
		*dst = aws.DualStackEndpointStateEnabled
	} else {
		*dst = aws.DualStackEndpointStateDisabled
	}

	return
}

// updateEndpointDiscoveryType will only update the dst with the value in the section, if
// a valid key and corresponding EndpointDiscoveryType is found.
func updateUseFIPSEndpoint(dst *aws.FIPSEndpointState, section ini.Section, key string) {
	if !section.Has(key) {
		return
	}

	// retains pre-#2276 behavior where non-bool value would resolve to false
	if v, _ := section.Bool(key); v {
		*dst = aws.FIPSEndpointStateEnabled
	} else {
		*dst = aws.FIPSEndpointStateDisabled
	}

	return
}

func (c SharedConfig) getAuthSchemePreference() ([]string, bool) {
	if len(c.AuthSchemePreference) > 0 {
		return c.AuthSchemePreference, true
	}
	return nil, false
}
