package flag

// ErrorCode is an enum following the open-feature specs about error code.
type ErrorCode = string

const (
	// Proposed in the open-feature specs
	ErrorCodeProviderNotReady    ErrorCode = "PROVIDER_NOT_READY"
	ErrorCodeFlagNotFound        ErrorCode = "FLAG_NOT_FOUND"
	ErrorCodeParseError          ErrorCode = "PARSE_ERROR"
	ErrorCodeTypeMismatch        ErrorCode = "TYPE_MISMATCH"
	ErrorCodeGeneral             ErrorCode = "GENERAL"
	ErrorCodeInvalidContext      ErrorCode = "INVALID_CONTEXT"
	ErrorCodeTargetingKeyMissing ErrorCode = "TARGETING_KEY_MISSING"

	// Custom error code for Go Feature Flag

	// 	ErrorFlagConfiguration is returned when we were not able to use the flag because of a misconfiguration
	ErrorFlagConfiguration ErrorCode = "FLAG_CONFIG"
)
