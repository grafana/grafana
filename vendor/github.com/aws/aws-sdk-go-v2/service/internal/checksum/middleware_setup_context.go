package checksum

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"

	internalcontext "github.com/aws/aws-sdk-go-v2/internal/context"
	"github.com/aws/smithy-go/middleware"
)

const (
	checksumValidationModeEnabled = "ENABLED"
)

// SetupInputContext is the initial middleware that looks up the input
// used to configure checksum behavior. This middleware must be executed before
// input validation step or any other checksum middleware.
type SetupInputContext struct {
	// GetAlgorithm is a function to get the checksum algorithm of the
	// input payload from the input parameters.
	//
	// Given the input parameter value, the function must return the algorithm
	// and true, or false if no algorithm is specified.
	GetAlgorithm func(interface{}) (string, bool)

	// RequireChecksum indicates whether operation model forces middleware to compute the input payload's checksum.
	// If RequireChecksum is set to true, checksum will be calculated and RequestChecksumCalculation will be ignored,
	// otherwise RequestChecksumCalculation will be used to indicate if checksum will be calculated
	RequireChecksum bool

	// RequestChecksumCalculation is the user config to opt-in/out request checksum calculation. If RequireChecksum is
	// set to true, checksum will be calculated and this field will be ignored, otherwise
	// RequestChecksumCalculation will be used to indicate if checksum will be calculated
	RequestChecksumCalculation aws.RequestChecksumCalculation
}

// ID for the middleware
func (m *SetupInputContext) ID() string {
	return "AWSChecksum:SetupInputContext"
}

// HandleInitialize initialization middleware that setups up the checksum
// context based on the input parameters provided in the stack.
func (m *SetupInputContext) HandleInitialize(
	ctx context.Context, in middleware.InitializeInput, next middleware.InitializeHandler,
) (
	out middleware.InitializeOutput, metadata middleware.Metadata, err error,
) {
	// nil check here is for operations that require checksum but do not have input algorithm setting
	if m.GetAlgorithm != nil {
		if algorithm, ok := m.GetAlgorithm(in.Parameters); ok {
			ctx = internalcontext.SetChecksumInputAlgorithm(ctx, algorithm)
			return next.HandleInitialize(ctx, in)
		}
	}

	if m.RequireChecksum || m.RequestChecksumCalculation == aws.RequestChecksumCalculationWhenSupported {
		ctx = internalcontext.SetChecksumInputAlgorithm(ctx, string(AlgorithmCRC32))
	}

	return next.HandleInitialize(ctx, in)
}

type setupOutputContext struct {
	// GetValidationMode is a function to get the checksum validation
	// mode of the output payload from the input parameters.
	//
	// Given the input parameter value, the function must return the validation
	// mode and true, or false if no mode is specified.
	GetValidationMode func(interface{}) (string, bool)

	// SetValidationMode is a function to set the checksum validation mode of input parameters
	SetValidationMode func(interface{}, string)

	// ResponseChecksumValidation states user config to opt-in/out checksum validation
	ResponseChecksumValidation aws.ResponseChecksumValidation
}

// ID for the middleware
func (m *setupOutputContext) ID() string {
	return "AWSChecksum:SetupOutputContext"
}

// HandleInitialize initialization middleware that setups up the checksum
// context based on the input parameters provided in the stack.
func (m *setupOutputContext) HandleInitialize(
	ctx context.Context, in middleware.InitializeInput, next middleware.InitializeHandler,
) (
	out middleware.InitializeOutput, metadata middleware.Metadata, err error,
) {

	mode, _ := m.GetValidationMode(in.Parameters)

	if m.ResponseChecksumValidation == aws.ResponseChecksumValidationWhenSupported || mode == checksumValidationModeEnabled {
		m.SetValidationMode(in.Parameters, checksumValidationModeEnabled)
		ctx = setContextOutputValidationMode(ctx, checksumValidationModeEnabled)
	}

	return next.HandleInitialize(ctx, in)
}

// outputValidationModeKey is the key set on context used to identify if
// output checksum validation is enabled.
type outputValidationModeKey struct{}

// setContextOutputValidationMode sets the request checksum
// algorithm on the context.
//
// Scoped to stack values.
func setContextOutputValidationMode(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, outputValidationModeKey{}, value)
}

// getContextOutputValidationMode returns response checksum validation state,
// if one was specified. Empty string is returned if one is not specified.
//
// Scoped to stack values.
func getContextOutputValidationMode(ctx context.Context) (v string) {
	v, _ = middleware.GetStackValue(ctx, outputValidationModeKey{}).(string)
	return v
}
