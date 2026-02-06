package defaults

import (
	"github.com/aws/aws-sdk-go-v2/aws"
	"runtime"
	"strings"
)

var getGOOS = func() string {
	return runtime.GOOS
}

// ResolveDefaultsModeAuto is used to determine the effective aws.DefaultsMode when the mode
// is set to aws.DefaultsModeAuto.
func ResolveDefaultsModeAuto(region string, environment aws.RuntimeEnvironment) aws.DefaultsMode {
	goos := getGOOS()
	if goos == "android" || goos == "ios" {
		return aws.DefaultsModeMobile
	}

	var currentRegion string
	if len(environment.EnvironmentIdentifier) > 0 {
		currentRegion = environment.Region
	}

	if len(currentRegion) == 0 && len(environment.EC2InstanceMetadataRegion) > 0 {
		currentRegion = environment.EC2InstanceMetadataRegion
	}

	if len(region) > 0 && len(currentRegion) > 0 {
		if strings.EqualFold(region, currentRegion) {
			return aws.DefaultsModeInRegion
		}
		return aws.DefaultsModeCrossRegion
	}

	return aws.DefaultsModeStandard
}
