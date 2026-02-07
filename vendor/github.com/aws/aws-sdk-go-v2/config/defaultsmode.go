package config

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/ec2/imds"
)

const execEnvVar = "AWS_EXECUTION_ENV"

// DefaultsModeOptions is the set of options that are used to configure
type DefaultsModeOptions struct {
	// The SDK configuration defaults mode. Defaults to legacy if not specified.
	//
	// Supported modes are: auto, cross-region, in-region, legacy, mobile, standard
	Mode aws.DefaultsMode

	// The EC2 Instance Metadata Client that should be used when performing environment
	// discovery when aws.DefaultsModeAuto is set.
	//
	// If not specified the SDK will construct a client if the instance metadata service has not been disabled by
	// the AWS_EC2_METADATA_DISABLED environment variable.
	IMDSClient *imds.Client
}

func resolveDefaultsModeRuntimeEnvironment(ctx context.Context, envConfig *EnvConfig, client *imds.Client) (aws.RuntimeEnvironment, error) {
	getRegionOutput, err := client.GetRegion(ctx, &imds.GetRegionInput{})
	// honor context timeouts, but if we couldn't talk to IMDS don't fail runtime environment introspection.
	select {
	case <-ctx.Done():
		return aws.RuntimeEnvironment{}, err
	default:
	}

	var imdsRegion string
	if err == nil {
		imdsRegion = getRegionOutput.Region
	}

	return aws.RuntimeEnvironment{
		EnvironmentIdentifier:     aws.ExecutionEnvironmentID(os.Getenv(execEnvVar)),
		Region:                    envConfig.Region,
		EC2InstanceMetadataRegion: imdsRegion,
	}, nil
}
