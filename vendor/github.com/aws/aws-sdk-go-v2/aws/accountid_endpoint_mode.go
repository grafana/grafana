package aws

// AccountIDEndpointMode controls how a resolved AWS account ID is handled for endpoint routing.
type AccountIDEndpointMode string

const (
	// AccountIDEndpointModeUnset indicates the AWS account ID will not be used for endpoint routing
	AccountIDEndpointModeUnset AccountIDEndpointMode = ""

	// AccountIDEndpointModePreferred indicates the AWS account ID will be used for endpoint routing if present
	AccountIDEndpointModePreferred = "preferred"

	// AccountIDEndpointModeRequired indicates an error will be returned if the AWS account ID is not resolved from identity
	AccountIDEndpointModeRequired = "required"

	// AccountIDEndpointModeDisabled indicates the AWS account ID will be ignored during endpoint routing
	AccountIDEndpointModeDisabled = "disabled"
)
