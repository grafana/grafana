package aws

// MissingRegionError is an error that is returned if region configuration
// value was not found.
type MissingRegionError struct{}

func (*MissingRegionError) Error() string {
	return "an AWS region is required, but was not found"
}
