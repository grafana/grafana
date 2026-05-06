package aws

// ExecutionEnvironmentID is the AWS execution environment runtime identifier.
type ExecutionEnvironmentID string

// RuntimeEnvironment is a collection of values that are determined at runtime
// based on the environment that the SDK is executing in. Some of these values
// may or may not be present based on the executing environment and certain SDK
// configuration properties that drive whether these values are populated..
type RuntimeEnvironment struct {
	EnvironmentIdentifier     ExecutionEnvironmentID
	Region                    string
	EC2InstanceMetadataRegion string
}
