package config

import (
	"context"
	"fmt"
	"io/ioutil"
	"net"
	"net/url"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go-v2/credentials/endpointcreds"
	"github.com/aws/aws-sdk-go-v2/credentials/processcreds"
	"github.com/aws/aws-sdk-go-v2/credentials/ssocreds"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/feature/ec2/imds"
	"github.com/aws/aws-sdk-go-v2/service/sso"
	"github.com/aws/aws-sdk-go-v2/service/ssooidc"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

const (
	// valid credential source values
	credSourceEc2Metadata      = "Ec2InstanceMetadata"
	credSourceEnvironment      = "Environment"
	credSourceECSContainer     = "EcsContainer"
	httpProviderAuthFileEnvVar = "AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE"
)

// direct representation of the IPv4 address for the ECS container
// "169.254.170.2"
var ecsContainerIPv4 net.IP = []byte{
	169, 254, 170, 2,
}

// direct representation of the IPv4 address for the EKS container
// "169.254.170.23"
var eksContainerIPv4 net.IP = []byte{
	169, 254, 170, 23,
}

// direct representation of the IPv6 address for the EKS container
// "fd00:ec2::23"
var eksContainerIPv6 net.IP = []byte{
	0xFD, 0, 0xE, 0xC2,
	0, 0, 0, 0,
	0, 0, 0, 0,
	0, 0, 0, 0x23,
}

var (
	ecsContainerEndpoint = "http://169.254.170.2" // not constant to allow for swapping during unit-testing
)

// resolveCredentials extracts a credential provider from slice of config
// sources.
//
// If an explicit credential provider is not found the resolver will fallback
// to resolving credentials by extracting a credential provider from EnvConfig
// and SharedConfig.
func resolveCredentials(ctx context.Context, cfg *aws.Config, configs configs) error {
	found, err := resolveCredentialProvider(ctx, cfg, configs)
	if found || err != nil {
		return err
	}

	return resolveCredentialChain(ctx, cfg, configs)
}

// resolveCredentialProvider extracts the first instance of Credentials from the
// config slices.
//
// The resolved CredentialProvider will be wrapped in a cache to ensure the
// credentials are only refreshed when needed. This also protects the
// credential provider to be used concurrently.
//
// Config providers used:
// * credentialsProviderProvider
func resolveCredentialProvider(ctx context.Context, cfg *aws.Config, configs configs) (bool, error) {
	credProvider, found, err := getCredentialsProvider(ctx, configs)
	if !found || err != nil {
		return false, err
	}

	cfg.Credentials, err = wrapWithCredentialsCache(ctx, configs, credProvider)
	if err != nil {
		return false, err
	}

	return true, nil
}

// resolveCredentialChain resolves a credential provider chain using EnvConfig
// and SharedConfig if present in the slice of provided configs.
//
// The resolved CredentialProvider will be wrapped in a cache to ensure the
// credentials are only refreshed when needed. This also protects the
// credential provider to be used concurrently.
func resolveCredentialChain(ctx context.Context, cfg *aws.Config, configs configs) (err error) {
	envConfig, sharedConfig, other := getAWSConfigSources(configs)

	// When checking if a profile was specified programmatically we should only consider the "other"
	// configuration sources that have been provided. This ensures we correctly honor the expected credential
	// hierarchy.
	_, sharedProfileSet, err := getSharedConfigProfile(ctx, other)
	if err != nil {
		return err
	}

	switch {
	case sharedProfileSet:
		ctx, err = resolveCredsFromProfile(ctx, cfg, envConfig, sharedConfig, other)
	case envConfig.Credentials.HasKeys():
		ctx = addCredentialSource(ctx, aws.CredentialSourceEnvVars)
		cfg.Credentials = credentials.StaticCredentialsProvider{Value: envConfig.Credentials, Source: getCredentialSources(ctx)}
	case len(envConfig.WebIdentityTokenFilePath) > 0:
		ctx = addCredentialSource(ctx, aws.CredentialSourceEnvVarsSTSWebIDToken)
		err = assumeWebIdentity(ctx, cfg, envConfig.WebIdentityTokenFilePath, envConfig.RoleARN, envConfig.RoleSessionName, configs)
	default:
		ctx, err = resolveCredsFromProfile(ctx, cfg, envConfig, sharedConfig, other)
	}
	if err != nil {
		return err
	}

	// Wrap the resolved provider in a cache so the SDK will cache credentials.
	cfg.Credentials, err = wrapWithCredentialsCache(ctx, configs, cfg.Credentials)
	if err != nil {
		return err
	}

	return nil
}

func resolveCredsFromProfile(ctx context.Context, cfg *aws.Config, envConfig *EnvConfig, sharedConfig *SharedConfig, configs configs) (ctx2 context.Context, err error) {
	switch {
	case sharedConfig.Source != nil:
		ctx = addCredentialSource(ctx, aws.CredentialSourceProfileSourceProfile)
		// Assume IAM role with credentials source from a different profile.
		ctx, err = resolveCredsFromProfile(ctx, cfg, envConfig, sharedConfig.Source, configs)

	case sharedConfig.Credentials.HasKeys():
		// Static Credentials from Shared Config/Credentials file.
		ctx = addCredentialSource(ctx, aws.CredentialSourceProfile)
		cfg.Credentials = credentials.StaticCredentialsProvider{
			Value:  sharedConfig.Credentials,
			Source: getCredentialSources(ctx),
		}

	case len(sharedConfig.CredentialSource) != 0:
		ctx = addCredentialSource(ctx, aws.CredentialSourceProfileNamedProvider)
		ctx, err = resolveCredsFromSource(ctx, cfg, envConfig, sharedConfig, configs)

	case len(sharedConfig.WebIdentityTokenFile) != 0:
		// Credentials from Assume Web Identity token require an IAM Role, and
		// that roll will be assumed. May be wrapped with another assume role
		// via SourceProfile.
		ctx = addCredentialSource(ctx, aws.CredentialSourceProfileSTSWebIDToken)
		return ctx, assumeWebIdentity(ctx, cfg, sharedConfig.WebIdentityTokenFile, sharedConfig.RoleARN, sharedConfig.RoleSessionName, configs)

	case sharedConfig.hasSSOConfiguration():
		if sharedConfig.hasLegacySSOConfiguration() {
			ctx = addCredentialSource(ctx, aws.CredentialSourceProfileSSOLegacy)
			ctx = addCredentialSource(ctx, aws.CredentialSourceSSOLegacy)
		} else {
			ctx = addCredentialSource(ctx, aws.CredentialSourceSSO)
		}
		if sharedConfig.SSOSession != nil {
			ctx = addCredentialSource(ctx, aws.CredentialSourceProfileSSO)
		}
		err = resolveSSOCredentials(ctx, cfg, sharedConfig, configs)

	case len(sharedConfig.CredentialProcess) != 0:
		// Get credentials from CredentialProcess
		ctx = addCredentialSource(ctx, aws.CredentialSourceProfileProcess)
		ctx = addCredentialSource(ctx, aws.CredentialSourceProcess)
		err = processCredentials(ctx, cfg, sharedConfig, configs)

	case len(envConfig.ContainerCredentialsRelativePath) != 0:
		ctx = addCredentialSource(ctx, aws.CredentialSourceHTTP)
		err = resolveHTTPCredProvider(ctx, cfg, ecsContainerURI(envConfig.ContainerCredentialsRelativePath), envConfig.ContainerAuthorizationToken, configs)

	case len(envConfig.ContainerCredentialsEndpoint) != 0:
		ctx = addCredentialSource(ctx, aws.CredentialSourceHTTP)
		err = resolveLocalHTTPCredProvider(ctx, cfg, envConfig.ContainerCredentialsEndpoint, envConfig.ContainerAuthorizationToken, configs)

	default:
		ctx = addCredentialSource(ctx, aws.CredentialSourceIMDS)
		err = resolveEC2RoleCredentials(ctx, cfg, configs)
	}
	if err != nil {
		return ctx, err
	}

	if len(sharedConfig.RoleARN) > 0 {
		return ctx, credsFromAssumeRole(ctx, cfg, sharedConfig, configs)
	}

	return ctx, nil
}

func resolveSSOCredentials(ctx context.Context, cfg *aws.Config, sharedConfig *SharedConfig, configs configs) error {
	if err := sharedConfig.validateSSOConfiguration(); err != nil {
		return err
	}

	var options []func(*ssocreds.Options)
	v, found, err := getSSOProviderOptions(ctx, configs)
	if err != nil {
		return err
	}
	if found {
		options = append(options, v)
	}

	cfgCopy := cfg.Copy()

	options = append(options, func(o *ssocreds.Options) {
		o.CredentialSources = getCredentialSources(ctx)
	})

	if sharedConfig.SSOSession != nil {
		ssoTokenProviderOptionsFn, found, err := getSSOTokenProviderOptions(ctx, configs)
		if err != nil {
			return fmt.Errorf("failed to get SSOTokenProviderOptions from config sources, %w", err)
		}
		var optFns []func(*ssocreds.SSOTokenProviderOptions)
		if found {
			optFns = append(optFns, ssoTokenProviderOptionsFn)
		}
		cfgCopy.Region = sharedConfig.SSOSession.SSORegion
		cachedPath, err := ssocreds.StandardCachedTokenFilepath(sharedConfig.SSOSession.Name)
		if err != nil {
			return err
		}
		oidcClient := ssooidc.NewFromConfig(cfgCopy)
		tokenProvider := ssocreds.NewSSOTokenProvider(oidcClient, cachedPath, optFns...)
		options = append(options, func(o *ssocreds.Options) {
			o.SSOTokenProvider = tokenProvider
			o.CachedTokenFilepath = cachedPath
		})
	} else {
		cfgCopy.Region = sharedConfig.SSORegion
	}

	cfg.Credentials = ssocreds.New(sso.NewFromConfig(cfgCopy), sharedConfig.SSOAccountID, sharedConfig.SSORoleName, sharedConfig.SSOStartURL, options...)

	return nil
}

func ecsContainerURI(path string) string {
	return fmt.Sprintf("%s%s", ecsContainerEndpoint, path)
}

func processCredentials(ctx context.Context, cfg *aws.Config, sharedConfig *SharedConfig, configs configs) error {
	var opts []func(*processcreds.Options)

	options, found, err := getProcessCredentialOptions(ctx, configs)
	if err != nil {
		return err
	}
	if found {
		opts = append(opts, options)
	}

	opts = append(opts, func(o *processcreds.Options) {
		o.CredentialSources = getCredentialSources(ctx)
	})

	cfg.Credentials = processcreds.NewProvider(sharedConfig.CredentialProcess, opts...)

	return nil
}

// isAllowedHost allows host to be loopback or known ECS/EKS container IPs
//
// host can either be an IP address OR an unresolved hostname - resolution will
// be automatically performed in the latter case
func isAllowedHost(host string) (bool, error) {
	if ip := net.ParseIP(host); ip != nil {
		return isIPAllowed(ip), nil
	}

	addrs, err := lookupHostFn(host)
	if err != nil {
		return false, err
	}

	for _, addr := range addrs {
		if ip := net.ParseIP(addr); ip == nil || !isIPAllowed(ip) {
			return false, nil
		}
	}

	return true, nil
}

func isIPAllowed(ip net.IP) bool {
	return ip.IsLoopback() ||
		ip.Equal(ecsContainerIPv4) ||
		ip.Equal(eksContainerIPv4) ||
		ip.Equal(eksContainerIPv6)
}

func resolveLocalHTTPCredProvider(ctx context.Context, cfg *aws.Config, endpointURL, authToken string, configs configs) error {
	var resolveErr error

	parsed, err := url.Parse(endpointURL)
	if err != nil {
		resolveErr = fmt.Errorf("invalid URL, %w", err)
	} else {
		host := parsed.Hostname()
		if len(host) == 0 {
			resolveErr = fmt.Errorf("unable to parse host from local HTTP cred provider URL")
		} else if parsed.Scheme == "http" {
			if isAllowedHost, allowHostErr := isAllowedHost(host); allowHostErr != nil {
				resolveErr = fmt.Errorf("failed to resolve host %q, %v", host, allowHostErr)
			} else if !isAllowedHost {
				resolveErr = fmt.Errorf("invalid endpoint host, %q, only loopback/ecs/eks hosts are allowed", host)
			}
		}
	}

	if resolveErr != nil {
		return resolveErr
	}

	return resolveHTTPCredProvider(ctx, cfg, endpointURL, authToken, configs)
}

func resolveHTTPCredProvider(ctx context.Context, cfg *aws.Config, url, authToken string, configs configs) error {
	optFns := []func(*endpointcreds.Options){
		func(options *endpointcreds.Options) {
			if len(authToken) != 0 {
				options.AuthorizationToken = authToken
			}
			if authFilePath := os.Getenv(httpProviderAuthFileEnvVar); authFilePath != "" {
				options.AuthorizationTokenProvider = endpointcreds.TokenProviderFunc(func() (string, error) {
					var contents []byte
					var err error
					if contents, err = ioutil.ReadFile(authFilePath); err != nil {
						return "", fmt.Errorf("failed to read authorization token from %v: %v", authFilePath, err)
					}
					return string(contents), nil
				})
			}
			options.APIOptions = cfg.APIOptions
			if cfg.Retryer != nil {
				options.Retryer = cfg.Retryer()
			}
			options.CredentialSources = getCredentialSources(ctx)
		},
	}

	optFn, found, err := getEndpointCredentialProviderOptions(ctx, configs)
	if err != nil {
		return err
	}
	if found {
		optFns = append(optFns, optFn)
	}

	provider := endpointcreds.New(url, optFns...)

	cfg.Credentials, err = wrapWithCredentialsCache(ctx, configs, provider, func(options *aws.CredentialsCacheOptions) {
		options.ExpiryWindow = 5 * time.Minute
	})
	if err != nil {
		return err
	}

	return nil
}

func resolveCredsFromSource(ctx context.Context, cfg *aws.Config, envConfig *EnvConfig, sharedCfg *SharedConfig, configs configs) (context.Context, error) {
	switch sharedCfg.CredentialSource {
	case credSourceEc2Metadata:
		ctx = addCredentialSource(ctx, aws.CredentialSourceIMDS)
		return ctx, resolveEC2RoleCredentials(ctx, cfg, configs)

	case credSourceEnvironment:
		ctx = addCredentialSource(ctx, aws.CredentialSourceHTTP)
		cfg.Credentials = credentials.StaticCredentialsProvider{Value: envConfig.Credentials, Source: getCredentialSources(ctx)}

	case credSourceECSContainer:
		ctx = addCredentialSource(ctx, aws.CredentialSourceHTTP)
		if len(envConfig.ContainerCredentialsRelativePath) != 0 {
			return ctx, resolveHTTPCredProvider(ctx, cfg, ecsContainerURI(envConfig.ContainerCredentialsRelativePath), envConfig.ContainerAuthorizationToken, configs)
		}
		if len(envConfig.ContainerCredentialsEndpoint) != 0 {
			return ctx, resolveLocalHTTPCredProvider(ctx, cfg, envConfig.ContainerCredentialsEndpoint, envConfig.ContainerAuthorizationToken, configs)
		}
		return ctx, fmt.Errorf("EcsContainer was specified as the credential_source, but neither 'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI' or AWS_CONTAINER_CREDENTIALS_FULL_URI' was set")

	default:
		return ctx, fmt.Errorf("credential_source values must be EcsContainer, Ec2InstanceMetadata, or Environment")
	}

	return ctx, nil
}

func resolveEC2RoleCredentials(ctx context.Context, cfg *aws.Config, configs configs) error {
	optFns := make([]func(*ec2rolecreds.Options), 0, 2)

	optFn, found, err := getEC2RoleCredentialProviderOptions(ctx, configs)
	if err != nil {
		return err
	}
	if found {
		optFns = append(optFns, optFn)
	}

	optFns = append(optFns, func(o *ec2rolecreds.Options) {
		// Only define a client from config if not already defined.
		if o.Client == nil {
			o.Client = imds.NewFromConfig(*cfg)
		}
		o.CredentialSources = getCredentialSources(ctx)
	})

	provider := ec2rolecreds.New(optFns...)

	cfg.Credentials, err = wrapWithCredentialsCache(ctx, configs, provider)
	if err != nil {
		return err
	}
	return nil
}

func getAWSConfigSources(cfgs configs) (*EnvConfig, *SharedConfig, configs) {
	var (
		envConfig    *EnvConfig
		sharedConfig *SharedConfig
		other        configs
	)

	for i := range cfgs {
		switch c := cfgs[i].(type) {
		case EnvConfig:
			if envConfig == nil {
				envConfig = &c
			}
		case *EnvConfig:
			if envConfig == nil {
				envConfig = c
			}
		case SharedConfig:
			if sharedConfig == nil {
				sharedConfig = &c
			}
		case *SharedConfig:
			if envConfig == nil {
				sharedConfig = c
			}
		default:
			other = append(other, c)
		}
	}

	if envConfig == nil {
		envConfig = &EnvConfig{}
	}

	if sharedConfig == nil {
		sharedConfig = &SharedConfig{}
	}

	return envConfig, sharedConfig, other
}

// AssumeRoleTokenProviderNotSetError is an error returned when creating a
// session when the MFAToken option is not set when shared config is configured
// load assume a role with an MFA token.
type AssumeRoleTokenProviderNotSetError struct{}

// Error is the error message
func (e AssumeRoleTokenProviderNotSetError) Error() string {
	return fmt.Sprintf("assume role with MFA enabled, but AssumeRoleTokenProvider session option not set.")
}

func assumeWebIdentity(ctx context.Context, cfg *aws.Config, filepath string, roleARN, sessionName string, configs configs) error {
	if len(filepath) == 0 {
		return fmt.Errorf("token file path is not set")
	}

	optFns := []func(*stscreds.WebIdentityRoleOptions){
		func(options *stscreds.WebIdentityRoleOptions) {
			options.RoleSessionName = sessionName
		},
	}

	optFn, found, err := getWebIdentityCredentialProviderOptions(ctx, configs)
	if err != nil {
		return err
	}

	if found {
		optFns = append(optFns, optFn)
	}

	opts := stscreds.WebIdentityRoleOptions{
		RoleARN: roleARN,
	}

	optFns = append(optFns, func(options *stscreds.WebIdentityRoleOptions) {
		options.CredentialSources = getCredentialSources(ctx)
	})

	for _, fn := range optFns {
		fn(&opts)
	}

	if len(opts.RoleARN) == 0 {
		return fmt.Errorf("role ARN is not set")
	}

	client := opts.Client
	if client == nil {
		client = sts.NewFromConfig(*cfg)
	}

	provider := stscreds.NewWebIdentityRoleProvider(client, roleARN, stscreds.IdentityTokenFile(filepath), optFns...)

	cfg.Credentials = provider

	return nil
}

func credsFromAssumeRole(ctx context.Context, cfg *aws.Config, sharedCfg *SharedConfig, configs configs) (err error) {
	// resolve credentials early
	credentialSources := getCredentialSources(ctx)
	optFns := []func(*stscreds.AssumeRoleOptions){
		func(options *stscreds.AssumeRoleOptions) {
			options.RoleSessionName = sharedCfg.RoleSessionName
			if sharedCfg.RoleDurationSeconds != nil {
				if *sharedCfg.RoleDurationSeconds/time.Minute > 15 {
					options.Duration = *sharedCfg.RoleDurationSeconds
				}
			}
			// Assume role with external ID
			if len(sharedCfg.ExternalID) > 0 {
				options.ExternalID = aws.String(sharedCfg.ExternalID)
			}

			// Assume role with MFA
			if len(sharedCfg.MFASerial) != 0 {
				options.SerialNumber = aws.String(sharedCfg.MFASerial)
			}

			// add existing credential chain
			options.CredentialSources = credentialSources
		},
	}

	optFn, found, err := getAssumeRoleCredentialProviderOptions(ctx, configs)
	if err != nil {
		return err
	}
	if found {
		optFns = append(optFns, optFn)
	}

	{
		// Synthesize options early to validate configuration errors sooner to ensure a token provider
		// is present if the SerialNumber was set.
		var o stscreds.AssumeRoleOptions
		for _, fn := range optFns {
			fn(&o)
		}
		if o.TokenProvider == nil && o.SerialNumber != nil {
			return AssumeRoleTokenProviderNotSetError{}
		}
	}
	cfg.Credentials = stscreds.NewAssumeRoleProvider(sts.NewFromConfig(*cfg), sharedCfg.RoleARN, optFns...)

	return nil
}

// wrapWithCredentialsCache will wrap provider with an aws.CredentialsCache
// with the provided options if the provider is not already a
// aws.CredentialsCache.
func wrapWithCredentialsCache(
	ctx context.Context,
	cfgs configs,
	provider aws.CredentialsProvider,
	optFns ...func(options *aws.CredentialsCacheOptions),
) (aws.CredentialsProvider, error) {
	_, ok := provider.(*aws.CredentialsCache)
	if ok {
		return provider, nil
	}

	credCacheOptions, optionsFound, err := getCredentialsCacheOptionsProvider(ctx, cfgs)
	if err != nil {
		return nil, err
	}

	// force allocation of a new slice if the additional options are
	// needed, to prevent overwriting the passed in slice of options.
	optFns = optFns[:len(optFns):len(optFns)]
	if optionsFound {
		optFns = append(optFns, credCacheOptions)
	}

	return aws.NewCredentialsCache(provider, optFns...), nil
}

// credentialSource stores the chain of providers that was used to create an instance of
// a credentials provider on the context
type credentialSource struct{}

func addCredentialSource(ctx context.Context, source aws.CredentialSource) context.Context {
	existing, ok := ctx.Value(credentialSource{}).([]aws.CredentialSource)
	if !ok {
		existing = []aws.CredentialSource{source}
	} else {
		existing = append(existing, source)
	}
	return context.WithValue(ctx, credentialSource{}, existing)
}

func getCredentialSources(ctx context.Context) []aws.CredentialSource {
	return ctx.Value(credentialSource{}).([]aws.CredentialSource)
}
