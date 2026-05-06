package config

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/feature/ec2/imds"
	"github.com/aws/smithy-go/logging"
)

// resolveDefaultAWSConfig will write default configuration values into the cfg
// value. It will write the default values, overwriting any previous value.
//
// This should be used as the first resolver in the slice of resolvers when
// resolving external configuration.
func resolveDefaultAWSConfig(ctx context.Context, cfg *aws.Config, cfgs configs) error {
	var sources []interface{}
	for _, s := range cfgs {
		sources = append(sources, s)
	}

	*cfg = aws.Config{
		Logger:        logging.NewStandardLogger(os.Stderr),
		ConfigSources: sources,
	}
	return nil
}

// resolveCustomCABundle extracts the first instance of a custom CA bundle filename
// from the external configurations. It will update the HTTP Client's builder
// to be configured with the custom CA bundle.
//
// Config provider used:
// * customCABundleProvider
func resolveCustomCABundle(ctx context.Context, cfg *aws.Config, cfgs configs) error {
	pemCerts, found, err := getCustomCABundle(ctx, cfgs)
	if err != nil {
		// TODO error handling, What is the best way to handle this?
		// capture previous errors continue. error out if all errors
		return err
	}
	if !found {
		return nil
	}

	if cfg.HTTPClient == nil {
		cfg.HTTPClient = awshttp.NewBuildableClient()
	}

	trOpts, ok := cfg.HTTPClient.(*awshttp.BuildableClient)
	if !ok {
		return fmt.Errorf("unable to add custom RootCAs HTTPClient, "+
			"has no WithTransportOptions, %T", cfg.HTTPClient)
	}

	var appendErr error
	client := trOpts.WithTransportOptions(func(tr *http.Transport) {
		if tr.TLSClientConfig == nil {
			tr.TLSClientConfig = &tls.Config{}
		}
		if tr.TLSClientConfig.RootCAs == nil {
			tr.TLSClientConfig.RootCAs = x509.NewCertPool()
		}

		b, err := ioutil.ReadAll(pemCerts)
		if err != nil {
			appendErr = fmt.Errorf("failed to read custom CA bundle PEM file")
		}

		if !tr.TLSClientConfig.RootCAs.AppendCertsFromPEM(b) {
			appendErr = fmt.Errorf("failed to load custom CA bundle PEM file")
		}
	})
	if appendErr != nil {
		return appendErr
	}

	cfg.HTTPClient = client
	return err
}

// resolveRegion extracts the first instance of a Region from the configs slice.
//
// Config providers used:
// * regionProvider
func resolveRegion(ctx context.Context, cfg *aws.Config, configs configs) error {
	v, found, err := getRegion(ctx, configs)
	if err != nil {
		// TODO error handling, What is the best way to handle this?
		// capture previous errors continue. error out if all errors
		return err
	}
	if !found {
		return nil
	}

	cfg.Region = v
	return nil
}

func resolveBaseEndpoint(ctx context.Context, cfg *aws.Config, configs configs) error {
	var downcastCfgSources []interface{}
	for _, cs := range configs {
		downcastCfgSources = append(downcastCfgSources, interface{}(cs))
	}

	if val, found, err := GetIgnoreConfiguredEndpoints(ctx, downcastCfgSources); found && val && err == nil {
		cfg.BaseEndpoint = nil
		return nil
	}

	v, found, err := getBaseEndpoint(ctx, configs)
	if err != nil {
		return err
	}

	if !found {
		return nil
	}
	cfg.BaseEndpoint = aws.String(v)
	return nil
}

// resolveAppID extracts the sdk app ID from the configs slice's SharedConfig or env var
func resolveAppID(ctx context.Context, cfg *aws.Config, configs configs) error {
	ID, _, err := getAppID(ctx, configs)
	if err != nil {
		return err
	}

	cfg.AppID = ID
	return nil
}

// resolveDisableRequestCompression extracts the DisableRequestCompression from the configs slice's
// SharedConfig or EnvConfig
func resolveDisableRequestCompression(ctx context.Context, cfg *aws.Config, configs configs) error {
	disable, _, err := getDisableRequestCompression(ctx, configs)
	if err != nil {
		return err
	}

	cfg.DisableRequestCompression = disable
	return nil
}

// resolveRequestMinCompressSizeBytes extracts the RequestMinCompressSizeBytes from the configs slice's
// SharedConfig or EnvConfig
func resolveRequestMinCompressSizeBytes(ctx context.Context, cfg *aws.Config, configs configs) error {
	minBytes, found, err := getRequestMinCompressSizeBytes(ctx, configs)
	if err != nil {
		return err
	}
	// must set a default min size 10240 if not configured
	if !found {
		minBytes = 10240
	}
	cfg.RequestMinCompressSizeBytes = minBytes
	return nil
}

// resolveAccountIDEndpointMode extracts the AccountIDEndpointMode from the configs slice's
// SharedConfig or EnvConfig
func resolveAccountIDEndpointMode(ctx context.Context, cfg *aws.Config, configs configs) error {
	m, found, err := getAccountIDEndpointMode(ctx, configs)
	if err != nil {
		return err
	}

	if !found {
		m = aws.AccountIDEndpointModePreferred
	}

	cfg.AccountIDEndpointMode = m
	return nil
}

// resolveRequestChecksumCalculation extracts the RequestChecksumCalculation from the configs slice's
// SharedConfig or EnvConfig
func resolveRequestChecksumCalculation(ctx context.Context, cfg *aws.Config, configs configs) error {
	c, found, err := getRequestChecksumCalculation(ctx, configs)
	if err != nil {
		return err
	}

	if !found {
		c = aws.RequestChecksumCalculationWhenSupported
	}
	cfg.RequestChecksumCalculation = c
	return nil
}

// resolveResponseValidation extracts the ResponseChecksumValidation from the configs slice's
// SharedConfig or EnvConfig
func resolveResponseChecksumValidation(ctx context.Context, cfg *aws.Config, configs configs) error {
	c, found, err := getResponseChecksumValidation(ctx, configs)
	if err != nil {
		return err
	}

	if !found {
		c = aws.ResponseChecksumValidationWhenSupported
	}
	cfg.ResponseChecksumValidation = c
	return nil
}

// resolveDefaultRegion extracts the first instance of a default region and sets `aws.Config.Region` to the default
// region if region had not been resolved from other sources.
func resolveDefaultRegion(ctx context.Context, cfg *aws.Config, configs configs) error {
	if len(cfg.Region) > 0 {
		return nil
	}

	v, found, err := getDefaultRegion(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	cfg.Region = v

	return nil
}

// resolveHTTPClient extracts the first instance of a HTTPClient and sets `aws.Config.HTTPClient` to the HTTPClient instance
// if one has not been resolved from other sources.
func resolveHTTPClient(ctx context.Context, cfg *aws.Config, configs configs) error {
	c, found, err := getHTTPClient(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	cfg.HTTPClient = c
	return nil
}

// resolveAPIOptions extracts the first instance of APIOptions and sets `aws.Config.APIOptions` to the resolved API options
// if one has not been resolved from other sources.
func resolveAPIOptions(ctx context.Context, cfg *aws.Config, configs configs) error {
	o, found, err := getAPIOptions(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	cfg.APIOptions = o

	return nil
}

// resolveEndpointResolver extracts the first instance of a EndpointResolverFunc from the config slice
// and sets the functions result on the aws.Config.EndpointResolver
func resolveEndpointResolver(ctx context.Context, cfg *aws.Config, configs configs) error {
	endpointResolver, found, err := getEndpointResolver(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	cfg.EndpointResolver = endpointResolver

	return nil
}

// resolveEndpointResolver extracts the first instance of a EndpointResolverFunc from the config slice
// and sets the functions result on the aws.Config.EndpointResolver
func resolveEndpointResolverWithOptions(ctx context.Context, cfg *aws.Config, configs configs) error {
	endpointResolver, found, err := getEndpointResolverWithOptions(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	cfg.EndpointResolverWithOptions = endpointResolver

	return nil
}

func resolveLogger(ctx context.Context, cfg *aws.Config, configs configs) error {
	logger, found, err := getLogger(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	cfg.Logger = logger

	return nil
}

func resolveClientLogMode(ctx context.Context, cfg *aws.Config, configs configs) error {
	mode, found, err := getClientLogMode(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	cfg.ClientLogMode = mode

	return nil
}

func resolveRetryer(ctx context.Context, cfg *aws.Config, configs configs) error {
	retryer, found, err := getRetryer(ctx, configs)
	if err != nil {
		return err
	}

	if found {
		cfg.Retryer = retryer
		return nil
	}

	// Only load the retry options if a custom retryer has not be specified.
	if err = resolveRetryMaxAttempts(ctx, cfg, configs); err != nil {
		return err
	}
	return resolveRetryMode(ctx, cfg, configs)
}

func resolveEC2IMDSRegion(ctx context.Context, cfg *aws.Config, configs configs) error {
	if len(cfg.Region) > 0 {
		return nil
	}

	region, found, err := getEC2IMDSRegion(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	cfg.Region = region

	return nil
}

func resolveDefaultsModeOptions(ctx context.Context, cfg *aws.Config, configs configs) error {
	defaultsMode, found, err := getDefaultsMode(ctx, configs)
	if err != nil {
		return err
	}
	if !found {
		defaultsMode = aws.DefaultsModeLegacy
	}

	var environment aws.RuntimeEnvironment
	if defaultsMode == aws.DefaultsModeAuto {
		envConfig, _, _ := getAWSConfigSources(configs)

		client, found, err := getDefaultsModeIMDSClient(ctx, configs)
		if err != nil {
			return err
		}
		if !found {
			client = imds.NewFromConfig(*cfg)
		}

		environment, err = resolveDefaultsModeRuntimeEnvironment(ctx, envConfig, client)
		if err != nil {
			return err
		}
	}

	cfg.DefaultsMode = defaultsMode
	cfg.RuntimeEnvironment = environment

	return nil
}

func resolveRetryMaxAttempts(ctx context.Context, cfg *aws.Config, configs configs) error {
	maxAttempts, found, err := getRetryMaxAttempts(ctx, configs)
	if err != nil || !found {
		return err
	}
	cfg.RetryMaxAttempts = maxAttempts

	return nil
}

func resolveRetryMode(ctx context.Context, cfg *aws.Config, configs configs) error {
	retryMode, found, err := getRetryMode(ctx, configs)
	if err != nil || !found {
		return err
	}
	cfg.RetryMode = retryMode

	return nil
}
