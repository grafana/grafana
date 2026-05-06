// Package retry provides interfaces and implementations for SDK request retry behavior.
//
// # Retryer Interface and Implementations
//
// This package defines Retryer interface that is used to either implement custom retry behavior
// or to extend the existing retry implementations provided by the SDK. This package provides a single
// retry implementation: Standard.
//
// # Standard
//
// Standard is the default retryer implementation used by service clients. The standard retryer is a rate limited
// retryer that has a configurable max attempts to limit the number of retry attempts when a retryable error occurs.
// In addition, the retryer uses a configurable token bucket to rate limit the retry attempts across the client,
// and uses an additional delay policy to limit the time between a requests subsequent attempts.
//
// By default the standard retryer uses the DefaultRetryables slice of IsErrorRetryable types to determine whether
// a given error is retryable. By default this list of retryables includes the following:
//   - Retrying errors that implement the RetryableError method, and return true.
//   - Connection Errors
//   - Errors that implement a ConnectionError, Temporary, or Timeout method that return true.
//   - Connection Reset Errors.
//   - net.OpErr types that are dialing errors or are temporary.
//   - HTTP Status Codes: 500, 502, 503, and 504.
//   - API Error Codes
//   - RequestTimeout, RequestTimeoutException
//   - Throttling, ThrottlingException, ThrottledException, RequestThrottledException, TooManyRequestsException,
//     RequestThrottled, SlowDown, EC2ThrottledException
//   - ProvisionedThroughputExceededException, RequestLimitExceeded, BandwidthLimitExceeded, LimitExceededException
//   - TransactionInProgressException, PriorRequestNotComplete
//
// The standard retryer will not retry a request in the event if the context associated with the request
// has been cancelled. Applications must handle this case explicitly if they wish to retry with a different context
// value.
//
// You can configure the standard retryer implementation to fit your applications by constructing a standard retryer
// using the NewStandard function, and providing one more functional argument that mutate the StandardOptions
// structure. StandardOptions provides the ability to modify the token bucket rate limiter, retryable error conditions,
// and the retry delay policy.
//
// For example to modify the default retry attempts for the standard retryer:
//
//	// configure the custom retryer
//	customRetry := retry.NewStandard(func(o *retry.StandardOptions) {
//	    o.MaxAttempts = 5
//	})
//
//	// create a service client with the retryer
//	s3.NewFromConfig(cfg, func(o *s3.Options) {
//	    o.Retryer = customRetry
//	})
//
// # Utilities
//
// A number of package functions have been provided to easily wrap retryer implementations in an implementation agnostic
// way. These are:
//
//	AddWithErrorCodes      - Provides the ability to add additional API error codes that should be considered retryable
//	                        in addition to those considered retryable by the provided retryer.
//
//	AddWithMaxAttempts     - Provides the ability to set the max number of attempts for retrying a request by wrapping
//	                         a retryer implementation.
//
//	AddWithMaxBackoffDelay - Provides the ability to set the max back off delay that can occur before retrying a
//	                         request by wrapping a retryer implementation.
//
// The following package functions have been provided to easily satisfy different retry interfaces to further customize
// a given retryer's behavior:
//
//	BackoffDelayerFunc   - Can be used to wrap a function to satisfy the BackoffDelayer interface. For example,
//	                       you can use this method to easily create custom back off policies to be used with the
//	                       standard retryer.
//
//	IsErrorRetryableFunc - Can be used to wrap a function to satisfy the IsErrorRetryable interface. For example,
//	                       this can be used to extend the standard retryer to add additional logic to determine if an
//	                       error should be retried.
//
//	IsErrorTimeoutFunc   - Can be used to wrap a function to satisfy IsErrorTimeout interface. For example,
//	                       this can be used to extend the standard retryer to add additional logic to determine if an
//	                        error should be considered a timeout.
package retry
