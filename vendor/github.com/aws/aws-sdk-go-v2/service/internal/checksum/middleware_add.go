package checksum

import (
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/smithy-go/middleware"
)

// InputMiddlewareOptions provides the options for the request
// checksum middleware setup.
type InputMiddlewareOptions struct {
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

	// Enables support for wrapping the serialized input payload with a
	// content-encoding: aws-check wrapper, and including a trailer for the
	// algorithm's checksum value.
	//
	// The checksum will not be computed, nor added as trailing checksum, if
	// the Algorithm's header is already set on the request.
	EnableTrailingChecksum bool

	// Enables support for computing the SHA256 checksum of input payloads
	// along with the algorithm specified checksum. Prevents downstream
	// middleware handlers (computePayloadSHA256) re-reading the payload.
	//
	// The SHA256 payload checksum will only be used for computed for requests
	// that are not TLS, or do not enable trailing checksums.
	//
	// The SHA256 payload hash will not be computed, if the Algorithm's header
	// is already set on the request.
	EnableComputeSHA256PayloadHash bool

	// Enables support for setting the aws-chunked decoded content length
	// header for the decoded length of the underlying stream. Will only be set
	// when used with trailing checksums, and aws-chunked content-encoding.
	EnableDecodedContentLengthHeader bool
}

// AddInputMiddleware adds the middleware for performing checksum computing
// of request payloads, and checksum validation of response payloads.
//
// Deprecated: This internal-only runtime API is frozen. Do not call or modify
// it in new code. Checksum-enabled service operations now generate this
// middleware setup code inline per #2507.
func AddInputMiddleware(stack *middleware.Stack, options InputMiddlewareOptions) (err error) {
	// Initial checksum configuration look up middleware
	err = stack.Initialize.Add(&SetupInputContext{
		GetAlgorithm:               options.GetAlgorithm,
		RequireChecksum:            options.RequireChecksum,
		RequestChecksumCalculation: options.RequestChecksumCalculation,
	}, middleware.Before)
	if err != nil {
		return err
	}

	stack.Build.Remove("ContentChecksum")

	inputChecksum := &ComputeInputPayloadChecksum{
		EnableTrailingChecksum:           options.EnableTrailingChecksum,
		EnableComputePayloadHash:         options.EnableComputeSHA256PayloadHash,
		EnableDecodedContentLengthHeader: options.EnableDecodedContentLengthHeader,
	}
	if err := stack.Finalize.Insert(inputChecksum, "ResolveEndpointV2", middleware.After); err != nil {
		return err
	}

	// If trailing checksum is not supported no need for finalize handler to be added.
	if options.EnableTrailingChecksum {
		trailerMiddleware := &AddInputChecksumTrailer{
			EnableTrailingChecksum:           inputChecksum.EnableTrailingChecksum,
			EnableComputePayloadHash:         inputChecksum.EnableComputePayloadHash,
			EnableDecodedContentLengthHeader: inputChecksum.EnableDecodedContentLengthHeader,
		}
		if err := stack.Finalize.Insert(trailerMiddleware, "Retry", middleware.After); err != nil {
			return err
		}
	}

	return nil
}

// RemoveInputMiddleware Removes the compute input payload checksum middleware
// handlers from the stack.
func RemoveInputMiddleware(stack *middleware.Stack) {
	id := (*SetupInputContext)(nil).ID()
	stack.Initialize.Remove(id)

	id = (*ComputeInputPayloadChecksum)(nil).ID()
	stack.Finalize.Remove(id)
}

// OutputMiddlewareOptions provides options for configuring output checksum
// validation middleware.
type OutputMiddlewareOptions struct {
	// GetValidationMode is a function to get the checksum validation
	// mode of the output payload from the input parameters.
	//
	// Given the input parameter value, the function must return the validation
	// mode and true, or false if no mode is specified.
	GetValidationMode func(interface{}) (string, bool)

	// SetValidationMode is a function to set the checksum validation mode of input parameters
	SetValidationMode func(interface{}, string)

	// ResponseChecksumValidation is the user config to opt-in/out response checksum validation
	ResponseChecksumValidation aws.ResponseChecksumValidation

	// The set of checksum algorithms that should be used for response payload
	// checksum validation. The algorithm(s) used will be a union of the
	// output's returned algorithms and this set.
	//
	// Only the first algorithm in the union is currently used.
	ValidationAlgorithms []string

	// If set the middleware will ignore output multipart checksums. Otherwise
	// a checksum format error will be returned by the middleware.
	IgnoreMultipartValidation bool

	// When set the middleware will log when output does not have checksum or
	// algorithm to validate.
	LogValidationSkipped bool

	// When set the middleware will log when the output contains a multipart
	// checksum that was, skipped and not validated.
	LogMultipartValidationSkipped bool
}

// AddOutputMiddleware adds the middleware for validating response payload's
// checksum.
func AddOutputMiddleware(stack *middleware.Stack, options OutputMiddlewareOptions) error {
	err := stack.Initialize.Add(&setupOutputContext{
		GetValidationMode:          options.GetValidationMode,
		SetValidationMode:          options.SetValidationMode,
		ResponseChecksumValidation: options.ResponseChecksumValidation,
	}, middleware.Before)
	if err != nil {
		return err
	}

	// Resolve a supported priority order list of algorithms to validate.
	algorithms := FilterSupportedAlgorithms(options.ValidationAlgorithms)

	m := &validateOutputPayloadChecksum{
		Algorithms:                    algorithms,
		IgnoreMultipartValidation:     options.IgnoreMultipartValidation,
		LogMultipartValidationSkipped: options.LogMultipartValidationSkipped,
		LogValidationSkipped:          options.LogValidationSkipped,
	}

	return stack.Deserialize.Add(m, middleware.After)
}

// RemoveOutputMiddleware Removes the compute input payload checksum middleware
// handlers from the stack.
func RemoveOutputMiddleware(stack *middleware.Stack) {
	id := (*setupOutputContext)(nil).ID()
	stack.Initialize.Remove(id)

	id = (*validateOutputPayloadChecksum)(nil).ID()
	stack.Deserialize.Remove(id)
}
