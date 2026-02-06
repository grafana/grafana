package config

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
)

// defaultAWSConfigResolvers are a slice of functions that will resolve external
// configuration values into AWS configuration values.
//
// This will setup the AWS configuration's Region,
var defaultAWSConfigResolvers = []awsConfigResolver{
	// Resolves the default configuration the SDK's aws.Config will be
	// initialized with.
	resolveDefaultAWSConfig,

	// Sets the logger to be used. Could be user provided logger, and client
	// logging mode.
	resolveLogger,
	resolveClientLogMode,

	// Sets the HTTP client and configuration to use for making requests using
	// the HTTP transport.
	resolveHTTPClient,
	resolveCustomCABundle,

	// Sets the endpoint resolving behavior the API Clients will use for making
	// requests to. Clients default to their own clients this allows overrides
	// to be specified. The resolveEndpointResolver option is deprecated, but
	// we still need to set it for backwards compatibility on config
	// construction.
	resolveEndpointResolver,
	resolveEndpointResolverWithOptions,

	// Sets the retry behavior API clients will use within their retry attempt
	// middleware. Defaults to unset, allowing API clients to define their own
	// retry behavior.
	resolveRetryer,

	// Sets the region the API Clients should use for making requests to.
	resolveRegion,
	resolveEC2IMDSRegion,
	resolveDefaultRegion,

	// Sets the additional set of middleware stack mutators that will custom
	// API client request pipeline middleware.
	resolveAPIOptions,

	// Resolves the DefaultsMode that should be used by SDK clients. If this
	// mode is set to DefaultsModeAuto.
	//
	// Comes after HTTPClient and CustomCABundle to ensure the HTTP client is
	// configured if provided before invoking IMDS if mode is auto. Comes
	// before resolving credentials so that those subsequent clients use the
	// configured auto mode.
	resolveDefaultsModeOptions,

	// Sets the resolved credentials the API clients will use for
	// authentication. Provides the SDK's default credential chain.
	//
	// Should probably be the last step in the resolve chain to ensure that all
	// other configurations are resolved first in case downstream credentials
	// implementations depend on or can be configured with earlier resolved
	// configuration options.
	resolveCredentials,

	// Sets the resolved bearer authentication token API clients will use for
	// httpBearerAuth authentication scheme.
	resolveBearerAuthToken,

	// Sets the sdk app ID if present in env var or shared config profile
	resolveAppID,

	resolveBaseEndpoint,

	// Sets the DisableRequestCompression if present in env var or shared config profile
	resolveDisableRequestCompression,

	// Sets the RequestMinCompressSizeBytes if present in env var or shared config profile
	resolveRequestMinCompressSizeBytes,

	// Sets the AccountIDEndpointMode if present in env var or shared config profile
	resolveAccountIDEndpointMode,

	// Sets the RequestChecksumCalculation if present in env var or shared config profile
	resolveRequestChecksumCalculation,

	// Sets the ResponseChecksumValidation if present in env var or shared config profile
	resolveResponseChecksumValidation,

	resolveInterceptors,

	resolveAuthSchemePreference,

	// Sets the ServiceOptions if present in LoadOptions
	resolveServiceOptions,
}

// A Config represents a generic configuration value or set of values. This type
// will be used by the AWSConfigResolvers to extract
//
// General the Config type will use type assertion against the Provider interfaces
// to extract specific data from the Config.
type Config interface{}

// A loader is used to load external configuration data and returns it as
// a generic Config type.
//
// The loader should return an error if it fails to load the external configuration
// or the configuration data is malformed, or required components missing.
type loader func(context.Context, configs) (Config, error)

// An awsConfigResolver will extract configuration data from the configs slice
// using the provider interfaces to extract specific functionality. The extracted
// configuration values will be written to the AWS Config value.
//
// The resolver should return an error if it it fails to extract the data, the
// data is malformed, or incomplete.
type awsConfigResolver func(ctx context.Context, cfg *aws.Config, configs configs) error

// configs is a slice of Config values. These values will be used by the
// AWSConfigResolvers to extract external configuration values to populate the
// AWS Config type.
//
// Use AppendFromLoaders to add additional external Config values that are
// loaded from external sources.
//
// Use ResolveAWSConfig after external Config values have been added or loaded
// to extract the loaded configuration values into the AWS Config.
type configs []Config

// AppendFromLoaders iterates over the slice of loaders passed in calling each
// loader function in order. The external config value returned by the loader
// will be added to the returned configs slice.
//
// If a loader returns an error this method will stop iterating and return
// that error.
func (cs configs) AppendFromLoaders(ctx context.Context, loaders []loader) (configs, error) {
	for _, fn := range loaders {
		cfg, err := fn(ctx, cs)
		if err != nil {
			return nil, err
		}

		cs = append(cs, cfg)
	}

	return cs, nil
}

// ResolveAWSConfig returns a AWS configuration populated with values by calling
// the resolvers slice passed in. Each resolver is called in order. Any resolver
// may overwrite the AWS Configuration value of a previous resolver.
//
// If an resolver returns an error this method will return that error, and stop
// iterating over the resolvers.
func (cs configs) ResolveAWSConfig(ctx context.Context, resolvers []awsConfigResolver) (aws.Config, error) {
	var cfg aws.Config

	for _, fn := range resolvers {
		if err := fn(ctx, &cfg, cs); err != nil {
			return aws.Config{}, err
		}
	}

	return cfg, nil
}

// ResolveConfig calls the provide function passing slice of configuration sources.
// This implements the aws.ConfigResolver interface.
func (cs configs) ResolveConfig(f func(configs []interface{}) error) error {
	var cfgs []interface{}
	for i := range cs {
		cfgs = append(cfgs, cs[i])
	}
	return f(cfgs)
}

// LoadDefaultConfig reads the SDK's default external configurations, and
// populates an AWS Config with the values from the external configurations.
//
// An optional variadic set of additional Config values can be provided as input
// that will be prepended to the configs slice. Use this to add custom configuration.
// The custom configurations must satisfy the respective providers for their data
// or the custom data will be ignored by the resolvers and config loaders.
//
//	cfg, err := config.LoadDefaultConfig( context.TODO(),
//	   config.WithSharedConfigProfile("test-profile"),
//	)
//	if err != nil {
//	   panic(fmt.Sprintf("failed loading config, %v", err))
//	}
//
// The default configuration sources are:
// * Environment Variables
// * Shared Configuration and Shared Credentials files.
func LoadDefaultConfig(ctx context.Context, optFns ...func(*LoadOptions) error) (cfg aws.Config, err error) {
	var options LoadOptions
	for _, optFn := range optFns {
		if err := optFn(&options); err != nil {
			return aws.Config{}, err
		}
	}

	// assign Load Options to configs
	var cfgCpy = configs{options}

	cfgCpy, err = cfgCpy.AppendFromLoaders(ctx, resolveConfigLoaders(&options))
	if err != nil {
		return aws.Config{}, err
	}

	cfg, err = cfgCpy.ResolveAWSConfig(ctx, defaultAWSConfigResolvers)
	if err != nil {
		return aws.Config{}, err
	}

	return cfg, nil
}

func resolveConfigLoaders(options *LoadOptions) []loader {
	loaders := make([]loader, 2)
	loaders[0] = loadEnvConfig

	// specification of a profile should cause a load failure if it doesn't exist
	if os.Getenv(awsProfileEnv) != "" || options.SharedConfigProfile != "" {
		loaders[1] = loadSharedConfig
	} else {
		loaders[1] = loadSharedConfigIgnoreNotExist
	}

	return loaders
}
