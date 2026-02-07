package retry

import (
	awsmiddle "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/smithy-go/middleware"
)

// attemptResultsKey is a metadata accessor key to retrieve metadata
// for all request attempts.
type attemptResultsKey struct {
}

// GetAttemptResults retrieves attempts results from middleware metadata.
func GetAttemptResults(metadata middleware.Metadata) (AttemptResults, bool) {
	m, ok := metadata.Get(attemptResultsKey{}).(AttemptResults)
	return m, ok
}

// AttemptResults represents struct containing metadata returned by all request attempts.
type AttemptResults struct {

	// Results is a slice consisting attempt result from all request attempts.
	// Results are stored in order request attempt is made.
	Results []AttemptResult
}

// AttemptResult represents attempt result returned by a single request attempt.
type AttemptResult struct {

	// Err is the error if received for the request attempt.
	Err error

	// Retryable denotes if request may be retried. This states if an
	// error is considered retryable.
	Retryable bool

	// Retried indicates if this request was retried.
	Retried bool

	// ResponseMetadata is any existing metadata passed via the response middlewares.
	ResponseMetadata middleware.Metadata
}

// addAttemptResults adds attempt results to middleware metadata
func addAttemptResults(metadata *middleware.Metadata, v AttemptResults) {
	metadata.Set(attemptResultsKey{}, v)
}

// GetRawResponse returns raw response recorded for the attempt result
func (a AttemptResult) GetRawResponse() interface{} {
	return awsmiddle.GetRawResponse(a.ResponseMetadata)
}
