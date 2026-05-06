package checksum

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/logging"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// outputValidationAlgorithmsUsedKey is the metadata key for indexing the algorithms
// that were used, by the middleware's validation.
type outputValidationAlgorithmsUsedKey struct{}

// GetOutputValidationAlgorithmsUsed returns the checksum algorithms used
// stored in the middleware Metadata. Returns false if no algorithms were
// stored in the Metadata.
func GetOutputValidationAlgorithmsUsed(m middleware.Metadata) ([]string, bool) {
	vs, ok := m.Get(outputValidationAlgorithmsUsedKey{}).([]string)
	return vs, ok
}

// SetOutputValidationAlgorithmsUsed stores the checksum algorithms used in the
// middleware Metadata.
func SetOutputValidationAlgorithmsUsed(m *middleware.Metadata, vs []string) {
	m.Set(outputValidationAlgorithmsUsedKey{}, vs)
}

// validateOutputPayloadChecksum middleware computes payload checksum of the
// received response and validates with checksum returned by the service.
type validateOutputPayloadChecksum struct {
	// Algorithms represents a priority-ordered list of valid checksum
	// algorithm that should be validated when present in HTTP response
	// headers.
	Algorithms []Algorithm

	// IgnoreMultipartValidation indicates multipart checksums ending with "-#"
	// will be ignored.
	IgnoreMultipartValidation bool

	// When set the middleware will log when output does not have checksum or
	// algorithm to validate.
	LogValidationSkipped bool

	// When set the middleware will log when the output contains a multipart
	// checksum that was, skipped and not validated.
	LogMultipartValidationSkipped bool
}

func (m *validateOutputPayloadChecksum) ID() string {
	return "AWSChecksum:ValidateOutputPayloadChecksum"
}

// HandleDeserialize is a Deserialize middleware that wraps the HTTP response
// body with an io.ReadCloser that will validate its checksum.
func (m *validateOutputPayloadChecksum) HandleDeserialize(
	ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler,
) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	if mode := getContextOutputValidationMode(ctx); mode != checksumValidationModeEnabled {
		return out, metadata, err
	}

	response, ok := out.RawResponse.(*smithyhttp.Response)
	if !ok {
		return out, metadata, &smithy.DeserializationError{
			Err: fmt.Errorf("unknown transport type %T", out.RawResponse),
		}
	}

	var expectedChecksum string
	var algorithmToUse Algorithm
	for _, algorithm := range m.Algorithms {
		value := response.Header.Get(AlgorithmHTTPHeader(algorithm))
		if len(value) == 0 {
			continue
		}

		expectedChecksum = value
		algorithmToUse = algorithm
	}

	logger := middleware.GetLogger(ctx)

	// Skip validation if no checksum algorithm or checksum is available.
	if len(expectedChecksum) == 0 || len(algorithmToUse) == 0 {
		if response.StatusCode != 404 && response.Body != http.NoBody && m.LogValidationSkipped {
			// TODO this probably should have more information about the
			// operation output that won't be validated.
			logger.Logf(logging.Warn,
				"Response has no supported checksum. Not validating response payload.")
		}
		return out, metadata, nil
	}

	// Ignore multipart validation
	if m.IgnoreMultipartValidation && strings.Contains(expectedChecksum, "-") {
		if m.LogMultipartValidationSkipped {
			// TODO this probably should have more information about the
			// operation output that won't be validated.
			logger.Logf(logging.Warn, "Skipped validation of multipart checksum.")
		}
		return out, metadata, nil
	}

	body, err := newValidateChecksumReader(response.Body, algorithmToUse, expectedChecksum)
	if err != nil {
		return out, metadata, fmt.Errorf("failed to create checksum validation reader, %w", err)
	}
	response.Body = body

	// Update the metadata to include the set of the checksum algorithms that
	// will be validated.
	SetOutputValidationAlgorithmsUsed(&metadata, []string{
		string(algorithmToUse),
	})

	return out, metadata, nil
}
