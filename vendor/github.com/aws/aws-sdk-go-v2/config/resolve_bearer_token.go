package config

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials/ssocreds"
	"github.com/aws/aws-sdk-go-v2/service/ssooidc"
	smithybearer "github.com/aws/smithy-go/auth/bearer"
)

// resolveBearerAuthToken extracts a token provider from the config sources.
//
// If an explicit bearer authentication token provider is not found the
// resolver will fallback to resolving token provider via other config sources
// such as SharedConfig.
func resolveBearerAuthToken(ctx context.Context, cfg *aws.Config, configs configs) error {
	found, err := resolveBearerAuthTokenProvider(ctx, cfg, configs)
	if found || err != nil {
		return err
	}

	return resolveBearerAuthTokenProviderChain(ctx, cfg, configs)
}

// resolveBearerAuthTokenProvider extracts the first instance of
// BearerAuthTokenProvider from the config sources.
//
// The resolved BearerAuthTokenProvider will be wrapped in a cache to ensure
// the Token is only refreshed when needed. This also protects the
// TokenProvider so it can be used concurrently.
//
// Config providers used:
// * bearerAuthTokenProviderProvider
func resolveBearerAuthTokenProvider(ctx context.Context, cfg *aws.Config, configs configs) (bool, error) {
	tokenProvider, found, err := getBearerAuthTokenProvider(ctx, configs)
	if !found || err != nil {
		return false, err
	}

	cfg.BearerAuthTokenProvider, err = wrapWithBearerAuthTokenCache(
		ctx, configs, tokenProvider)
	if err != nil {
		return false, err
	}

	return true, nil
}

func resolveBearerAuthTokenProviderChain(ctx context.Context, cfg *aws.Config, configs configs) (err error) {
	_, sharedConfig, _ := getAWSConfigSources(configs)

	var provider smithybearer.TokenProvider

	if sharedConfig.SSOSession != nil {
		provider, err = resolveBearerAuthSSOTokenProvider(
			ctx, cfg, sharedConfig.SSOSession, configs)
	}

	if err == nil && provider != nil {
		cfg.BearerAuthTokenProvider, err = wrapWithBearerAuthTokenCache(
			ctx, configs, provider)
	}

	return err
}

func resolveBearerAuthSSOTokenProvider(ctx context.Context, cfg *aws.Config, session *SSOSession, configs configs) (*ssocreds.SSOTokenProvider, error) {
	ssoTokenProviderOptionsFn, found, err := getSSOTokenProviderOptions(ctx, configs)
	if err != nil {
		return nil, fmt.Errorf("failed to get SSOTokenProviderOptions from config sources, %w", err)
	}

	var optFns []func(*ssocreds.SSOTokenProviderOptions)
	if found {
		optFns = append(optFns, ssoTokenProviderOptionsFn)
	}

	cachePath, err := ssocreds.StandardCachedTokenFilepath(session.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to get SSOTokenProvider's cache path, %w", err)
	}

	client := ssooidc.NewFromConfig(*cfg)
	provider := ssocreds.NewSSOTokenProvider(client, cachePath, optFns...)

	return provider, nil
}

// wrapWithBearerAuthTokenCache will wrap provider with an smithy-go
// bearer/auth#TokenCache with the provided options if the provider is not
// already a TokenCache.
func wrapWithBearerAuthTokenCache(
	ctx context.Context,
	cfgs configs,
	provider smithybearer.TokenProvider,
	optFns ...func(*smithybearer.TokenCacheOptions),
) (smithybearer.TokenProvider, error) {
	_, ok := provider.(*smithybearer.TokenCache)
	if ok {
		return provider, nil
	}

	tokenCacheConfigOptions, optionsFound, err := getBearerAuthTokenCacheOptions(ctx, cfgs)
	if err != nil {
		return nil, err
	}

	opts := make([]func(*smithybearer.TokenCacheOptions), 0, 2+len(optFns))
	opts = append(opts, func(o *smithybearer.TokenCacheOptions) {
		o.RefreshBeforeExpires = 5 * time.Minute
		o.RetrieveBearerTokenTimeout = 30 * time.Second
	})
	opts = append(opts, optFns...)
	if optionsFound {
		opts = append(opts, tokenCacheConfigOptions)
	}

	return smithybearer.NewTokenCache(provider, opts...), nil
}
