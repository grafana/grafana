package awsauth

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type ConfigProvider interface {
	GetConfig(context.Context, Settings) (aws.Config, error)
}

func NewConfigProvider() ConfigProvider {
	return newAWSConfigProviderWithClient(awsAPIClient{})
}

func newAWSConfigProviderWithClient(client AWSAPIClient) *awsConfigProvider {
	return &awsConfigProvider{client: client}
}

type awsConfigProvider struct {
	client AWSAPIClient
	cache  sync.Map
}

func (rcp *awsConfigProvider) GetConfig(ctx context.Context, authSettings Settings) (aws.Config, error) {
	logger := backend.Logger.FromContext(ctx)

	authType := authSettings.GetAuthType()
	grafanaAuthSettings, _ := awsds.ReadAuthSettingsFromContext(ctx)
	if !slices.Contains(grafanaAuthSettings.AllowedAuthProviders, string(authType)) {
		return aws.Config{}, backend.DownstreamErrorf("trying to use non-allowed auth method %s", authType)
	}
	if authSettings.AssumeRoleARN != "" && !grafanaAuthSettings.AssumeRoleEnabled {
		return aws.Config{}, backend.DownstreamErrorf("trying to use assume role but it is disabled in grafana config")
	}

	key := authSettings.Hash()
	cached, exists := rcp.cache.Load(key)
	if exists {
		logger.Debug("returning config from cache")
		return cached.(aws.Config), nil
	}
	logger.Debug("creating new config")

	options := authSettings.BaseOptions()

	logger.Debug(fmt.Sprintf("Using auth type: %s", authType))
	switch authType {
	case AuthTypeDefault, AuthTypeEC2IAMRole: // nothing else to do here
	case AuthTypeKeys:
		options = append(options, authSettings.WithStaticCredentials(rcp.client))
	case AuthTypeSharedCreds:
		options = append(options, authSettings.WithSharedCredentials())
	case AuthTypeGrafanaAssumeRole:
		authSettings.ExternalID = grafanaAuthSettings.ExternalID
		options = append(options, authSettings.WithGrafanaAssumeRole(ctx, rcp.client))
	default:
		return aws.Config{}, backend.DownstreamErrorf("unknown auth type: %s", authType)
	}

	cfg, err := rcp.client.LoadDefaultConfig(ctx, options...)
	if err != nil {
		return aws.Config{}, err
	}

	if authSettings.AssumeRoleARN != "" {
		options = append(authSettings.BaseOptions(), authSettings.WithAssumeRole(cfg, rcp.client, grafanaAuthSettings.SessionDuration))
		cfg, err = rcp.client.LoadDefaultConfig(ctx, options...)
		if err != nil {
			return aws.Config{}, err
		}
	}

	rcp.cache.Store(key, cfg)
	return cfg, nil
}

var stsEndpointPrefixes = []string{
	"sts.",
	"sts-fips.",
	"https://sts.",
	"https://sts-fips.",
}
func isStsEndpoint(ep *string) bool {
	if ep == nil {
		return false
	}
	for _, prefix := range stsEndpointPrefixes {
		if strings.HasPrefix(*ep, prefix) {
			return true
		}
	}
	return false
}
