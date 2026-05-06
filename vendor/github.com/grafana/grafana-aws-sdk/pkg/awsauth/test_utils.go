package awsauth

import (
	"context"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/feature/ec2/imds"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	ststypes "github.com/aws/aws-sdk-go-v2/service/sts/types"
	"github.com/stretchr/testify/mock"
)

// mockAWSAPIClient is used for internal testing. Most of the aws-sdk-go-v2 machinery is used,
// but anything that reaches out to AWS is faked or disabled.
type mockAWSAPIClient struct {
	assumeRoleClient *mockAssumeRoleAPIClient
}

func (m *mockAWSAPIClient) LoadDefaultConfig(ctx context.Context, options ...LoadOptionsFunc) (aws.Config, error) {
	opts := []LoadOptionsFunc{func(opts *config.LoadOptions) error {
		// Disable using EC2 instance metadata in config loading
		opts.EC2IMDSClientEnableState = imds.ClientDisabled
		// Disable endpoint discovery to avoid API calls out from tests
		opts.EnableEndpointDiscovery = aws.EndpointDiscoveryDisabled
		return nil
	}}
	opts = append(opts, options...)
	return config.LoadDefaultConfig(ctx, opts...)
}

func (m *mockAWSAPIClient) NewStaticCredentialsProvider(key, secret, session string) aws.CredentialsProvider {
	return credentials.NewStaticCredentialsProvider(key, secret, session)
}

func (m *mockAWSAPIClient) NewSTSClientFromConfig(cfg aws.Config) stscreds.AssumeRoleAPIClient {
	m.assumeRoleClient.stsConfig = cfg
	return m.assumeRoleClient
}

func (m *mockAWSAPIClient) NewAssumeRoleProvider(client stscreds.AssumeRoleAPIClient, arn string, opts ...func(*stscreds.AssumeRoleOptions)) aws.CredentialsProvider {
	return stscreds.NewAssumeRoleProvider(client, arn, opts...)
}

func (m *mockAWSAPIClient) NewCredentialsCache(provider aws.CredentialsProvider, optFns ...func(options *aws.CredentialsCacheOptions)) aws.CredentialsProvider {
	return aws.NewCredentialsCache(provider, optFns...)
}

func (m *mockAWSAPIClient) NewEC2RoleCreds() aws.CredentialsProvider {
	// TODO
	panic("not implemented")
}

type mockAssumeRoleAPIClient struct {
	mock.Mock
	stsConfig        aws.Config
	calledExternalId string
}

func (m *mockAssumeRoleAPIClient) AssumeRole(_ context.Context, params *sts.AssumeRoleInput, _ ...func(*sts.Options)) (*sts.AssumeRoleOutput, error) {
	args := m.Called()
	if params.ExternalId != nil {
		m.calledExternalId = *params.ExternalId
	}
	if args.Bool(0) { // shouldError
		return &sts.AssumeRoleOutput{}, fmt.Errorf("assume role failed")
	}
	return &sts.AssumeRoleOutput{
		AssumedRoleUser: &ststypes.AssumedRoleUser{
			Arn:           params.RoleArn,
			AssumedRoleId: aws.String("auto-generated-id"),
		},
		Credentials: args.Get(1).(*ststypes.Credentials),
	}, nil
}

// NewFakeConfigProvider returns a basic mock satisfying AWSConfigProvider.
// If shouldFail is true, the GetConfig method will fail. Otherwise it will
// return a basic config with static credentials
func NewFakeConfigProvider(shouldFail bool) ConfigProvider {
	return fakeConfigProvider{shouldFail}
}

type fakeConfigProvider struct {
	shouldFail bool
}

var staticCredentials = aws.Credentials{
	AccessKeyID:     "hello",
	SecretAccessKey: "world",
	SessionToken:    "(no)",
	CanExpire:       false,
}

func (f fakeConfigProvider) GetConfig(_ context.Context, _ Settings) (aws.Config, error) {
	if f.shouldFail {
		return aws.Config{}, fmt.Errorf("LoadDefaultConfig failed")
	}
	return aws.Config{Credentials: credentials.StaticCredentialsProvider{Value: staticCredentials}}, nil
}
