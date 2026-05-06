package openfeature

import (
	"errors"
	"fmt"
)

type ErrorCode string

const (
	// ProviderNotReadyCode - the value was resolved before the provider was ready.
	ProviderNotReadyCode ErrorCode = "PROVIDER_NOT_READY"
	// ProviderFatalCode - a fatal provider error occured
	ProviderFatalCode ErrorCode = "PROVIDER_FATAL"
	// FlagNotFoundCode - the flag could not be found.
	FlagNotFoundCode ErrorCode = "FLAG_NOT_FOUND"
	// ParseErrorCode - an error was encountered parsing data, such as a flag configuration.
	ParseErrorCode ErrorCode = "PARSE_ERROR"
	// TypeMismatchCode - the type of the flag value does not match the expected type.
	TypeMismatchCode ErrorCode = "TYPE_MISMATCH"
	// TargetingKeyMissingCode - the provider requires a targeting key and one was not provided in the evaluation context.
	TargetingKeyMissingCode ErrorCode = "TARGETING_KEY_MISSING"
	// InvalidContextCode - the evaluation context does not meet provider requirements.
	InvalidContextCode ErrorCode = "INVALID_CONTEXT"
	// GeneralCode - the error was for a reason not enumerated above.
	GeneralCode ErrorCode = "GENERAL"
)

// ResolutionError is an enumerated error code with an optional message
type ResolutionError struct {
	// fields are unexported, this means providers are forced to create structs of this type using one of the constructors below.
	// this effectively emulates an enum
	code    ErrorCode
	message string
}

func (r ResolutionError) Error() string {
	return fmt.Sprintf("%s: %s", r.code, r.message)
}

// NewProviderNotReadyResolutionError constructs a resolution error with code PROVIDER_NOT_READY
//
// Explanation - The value was resolved before the provider was ready.
func NewProviderNotReadyResolutionError(msg string) ResolutionError {
	return ResolutionError{
		code:    ProviderNotReadyCode,
		message: msg,
	}
}

// NewFlagNotFoundResolutionError constructs a resolution error with code FLAG_NOT_FOUND
//
// Explanation - The flag could not be found.
func NewFlagNotFoundResolutionError(msg string) ResolutionError {
	return ResolutionError{
		code:    FlagNotFoundCode,
		message: msg,
	}
}

// NewParseErrorResolutionError constructs a resolution error with code PARSE_ERROR
//
// Explanation - An error was encountered parsing data, such as a flag configuration.
func NewParseErrorResolutionError(msg string) ResolutionError {
	return ResolutionError{
		code:    ParseErrorCode,
		message: msg,
	}
}

// NewTypeMismatchResolutionError constructs a resolution error with code TYPE_MISMATCH
//
// Explanation - The type of the flag value does not match the expected type.
func NewTypeMismatchResolutionError(msg string) ResolutionError {
	return ResolutionError{
		code:    TypeMismatchCode,
		message: msg,
	}
}

// NewTargetingKeyMissingResolutionError constructs a resolution error with code TARGETING_KEY_MISSING
//
// Explanation - The provider requires a targeting key and one was not provided in the evaluation context.
func NewTargetingKeyMissingResolutionError(msg string) ResolutionError {
	return ResolutionError{
		code:    TargetingKeyMissingCode,
		message: msg,
	}
}

// NewInvalidContextResolutionError constructs a resolution error with code INVALID_CONTEXT
//
// Explanation - The evaluation context does not meet provider requirements.
func NewInvalidContextResolutionError(msg string) ResolutionError {
	return ResolutionError{
		code:    InvalidContextCode,
		message: msg,
	}
}

// NewGeneralResolutionError constructs a resolution error with code GENERAL
//
// Explanation - The error was for a reason not enumerated above.
func NewGeneralResolutionError(msg string) ResolutionError {
	return ResolutionError{
		code:    GeneralCode,
		message: msg,
	}
}

// ProviderInitError represents an error that occurs during provider initialization.
type ProviderInitError struct {
	ErrorCode ErrorCode // Field to store the specific error code
	Message   string    // Custom error message
}

// Error implements the error interface for ProviderInitError.
func (e *ProviderInitError) Error() string {
	return fmt.Sprintf("ProviderInitError: %s (code: %s)", e.Message, e.ErrorCode)
}

var (
	// ProviderNotReadyError signifies that an operation failed because the provider is in a NOT_READY state.
	ProviderNotReadyError = errors.New("provider not yet initialized")
	// ProviderFatalError signifies that an operation failed because the provider is in a FATAL state.
	ProviderFatalError = errors.New("provider is in an irrecoverable error state")
)
