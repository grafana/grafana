package awsauth

import (
	"context"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

type LoadOptionsFunc = func(*config.LoadOptions) error

// AWSAPIClient isolates most of our interactions with the AWS SDK to make it easier to mock in tests
type AWSAPIClient interface {
	LoadDefaultConfig(ctx context.Context, options ...LoadOptionsFunc) (aws.Config, error)
	NewStaticCredentialsProvider(key, secret, session string) aws.CredentialsProvider
	NewSTSClientFromConfig(cfg aws.Config) stscreds.AssumeRoleAPIClient
	NewAssumeRoleProvider(client stscreds.AssumeRoleAPIClient, roleARN string, optFns ...func(*stscreds.AssumeRoleOptions)) aws.CredentialsProvider
	NewCredentialsCache(provider aws.CredentialsProvider, optFns ...func(options *aws.CredentialsCacheOptions)) aws.CredentialsProvider
	NewEC2RoleCreds() aws.CredentialsProvider
}

type awsAPIClient struct{}

func (c awsAPIClient) NewStaticCredentialsProvider(key, secret, session string) aws.CredentialsProvider {
	return credentials.NewStaticCredentialsProvider(key, secret, session)
}
func (c awsAPIClient) LoadDefaultConfig(ctx context.Context, options ...LoadOptionsFunc) (aws.Config, error) {
	return config.LoadDefaultConfig(ctx, options...)
}
func (c awsAPIClient) NewSTSClientFromConfig(cfg aws.Config) stscreds.AssumeRoleAPIClient {
	return sts.NewFromConfig(cfg)
}

func (c awsAPIClient) NewAssumeRoleProvider(client stscreds.AssumeRoleAPIClient, roleARN string, optFns ...func(*stscreds.AssumeRoleOptions)) aws.CredentialsProvider {
	return stscreds.NewAssumeRoleProvider(client, roleARN, optFns...)
}

func (c awsAPIClient) NewCredentialsCache(provider aws.CredentialsProvider, optFns ...func(options *aws.CredentialsCacheOptions)) aws.CredentialsProvider {
	return aws.NewCredentialsCache(provider, optFns...)
}
func (c awsAPIClient) NewEC2RoleCreds() aws.CredentialsProvider {
	return ec2rolecreds.New()
}
