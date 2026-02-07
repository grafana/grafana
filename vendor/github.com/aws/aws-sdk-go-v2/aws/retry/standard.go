package retry

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws/ratelimit"
)

// BackoffDelayer provides the interface for determining the delay to before
// another request attempt, that previously failed.
type BackoffDelayer interface {
	BackoffDelay(attempt int, err error) (time.Duration, error)
}

// BackoffDelayerFunc provides a wrapper around a function to determine the
// backoff delay of an attempt retry.
type BackoffDelayerFunc func(int, error) (time.Duration, error)

// BackoffDelay returns the delay before attempt to retry a request.
func (fn BackoffDelayerFunc) BackoffDelay(attempt int, err error) (time.Duration, error) {
	return fn(attempt, err)
}

const (
	// DefaultMaxAttempts is the maximum of attempts for an API request
	DefaultMaxAttempts int = 3

	// DefaultMaxBackoff is the maximum back off delay between attempts
	DefaultMaxBackoff time.Duration = 20 * time.Second
)

// Default retry token quota values.
const (
	DefaultRetryRateTokens  uint = 500
	DefaultRetryCost        uint = 5
	DefaultRetryTimeoutCost uint = 10
	DefaultNoRetryIncrement uint = 1
)

// DefaultRetryableHTTPStatusCodes is the default set of HTTP status codes the SDK
// should consider as retryable errors.
var DefaultRetryableHTTPStatusCodes = map[int]struct{}{
	500: {},
	502: {},
	503: {},
	504: {},
}

// DefaultRetryableErrorCodes provides the set of API error codes that should
// be retried.
var DefaultRetryableErrorCodes = map[string]struct{}{
	"RequestTimeout":          {},
	"RequestTimeoutException": {},
}

// DefaultThrottleErrorCodes provides the set of API error codes that are
// considered throttle errors.
var DefaultThrottleErrorCodes = map[string]struct{}{
	"Throttling":                             {},
	"ThrottlingException":                    {},
	"ThrottledException":                     {},
	"RequestThrottledException":              {},
	"TooManyRequestsException":               {},
	"ProvisionedThroughputExceededException": {},
	"TransactionInProgressException":         {},
	"RequestLimitExceeded":                   {},
	"BandwidthLimitExceeded":                 {},
	"LimitExceededException":                 {},
	"RequestThrottled":                       {},
	"SlowDown":                               {},
	"PriorRequestNotComplete":                {},
	"EC2ThrottledException":                  {},
}

// DefaultRetryables provides the set of retryable checks that are used by
// default.
var DefaultRetryables = []IsErrorRetryable{
	NoRetryCanceledError{},
	RetryableError{},
	RetryableConnectionError{},
	RetryableHTTPStatusCode{
		Codes: DefaultRetryableHTTPStatusCodes,
	},
	RetryableErrorCode{
		Codes: DefaultRetryableErrorCodes,
	},
	RetryableErrorCode{
		Codes: DefaultThrottleErrorCodes,
	},
}

// DefaultTimeouts provides the set of timeout checks that are used by default.
var DefaultTimeouts = []IsErrorTimeout{
	TimeouterError{},
}

// StandardOptions provides the functional options for configuring the standard
// retryable, and delay behavior.
type StandardOptions struct {
	// Maximum number of attempts that should be made.
	MaxAttempts int

	// MaxBackoff duration between retried attempts.
	MaxBackoff time.Duration

	// Provides the backoff strategy the retryer will use to determine the
	// delay between retry attempts.
	Backoff BackoffDelayer

	// Set of strategies to determine if the attempt should be retried based on
	// the error response received.
	//
	// It is safe to append to this list in NewStandard's functional options.
	Retryables []IsErrorRetryable

	// Set of strategies to determine if the attempt failed due to a timeout
	// error.
	//
	// It is safe to append to this list in NewStandard's functional options.
	Timeouts []IsErrorTimeout

	// Provides the rate limiting strategy for rate limiting attempt retries
	// across all attempts the retryer is being used with.
	//
	// A RateLimiter operates as a token bucket with a set capacity, where
	// attempt failures events consume tokens. A retry attempt that attempts to
	// consume more tokens than what's available results in operation failure.
	// The default implementation is parameterized as follows:
	//   - a capacity of 500 (DefaultRetryRateTokens)
	//   - a retry caused by a timeout costs 10 tokens (DefaultRetryCost)
	//   - a retry caused by other errors costs 5 tokens (DefaultRetryTimeoutCost)
	//   - an operation that succeeds on the 1st attempt adds 1 token (DefaultNoRetryIncrement)
	//
	// You can disable rate limiting by setting this field to ratelimit.None.
	RateLimiter RateLimiter

	// The cost to deduct from the RateLimiter's token bucket per retry.
	RetryCost uint

	// The cost to deduct from the RateLimiter's token bucket per retry caused
	// by timeout error.
	RetryTimeoutCost uint

	// The cost to payback to the RateLimiter's token bucket for successful
	// attempts.
	NoRetryIncrement uint
}

// RateLimiter provides the interface for limiting the rate of attempt retries
// allowed by the retryer.
type RateLimiter interface {
	GetToken(ctx context.Context, cost uint) (releaseToken func() error, err error)
	AddTokens(uint) error
}

// Standard is the standard retry pattern for the SDK. It uses a set of
// retryable checks to determine of the failed attempt should be retried, and
// what retry delay should be used.
type Standard struct {
	options StandardOptions

	timeout   IsErrorTimeout
	retryable IsErrorRetryable
	backoff   BackoffDelayer
}

// NewStandard initializes a standard retry behavior with defaults that can be
// overridden via functional options.
func NewStandard(fnOpts ...func(*StandardOptions)) *Standard {
	o := StandardOptions{
		MaxAttempts: DefaultMaxAttempts,
		MaxBackoff:  DefaultMaxBackoff,
		Retryables:  append([]IsErrorRetryable{}, DefaultRetryables...),
		Timeouts:    append([]IsErrorTimeout{}, DefaultTimeouts...),

		RateLimiter:      ratelimit.NewTokenRateLimit(DefaultRetryRateTokens),
		RetryCost:        DefaultRetryCost,
		RetryTimeoutCost: DefaultRetryTimeoutCost,
		NoRetryIncrement: DefaultNoRetryIncrement,
	}
	for _, fn := range fnOpts {
		fn(&o)
	}
	if o.MaxAttempts <= 0 {
		o.MaxAttempts = DefaultMaxAttempts
	}

	backoff := o.Backoff
	if backoff == nil {
		backoff = NewExponentialJitterBackoff(o.MaxBackoff)
	}

	return &Standard{
		options:   o,
		backoff:   backoff,
		retryable: IsErrorRetryables(o.Retryables),
		timeout:   IsErrorTimeouts(o.Timeouts),
	}
}

// MaxAttempts returns the maximum number of attempts that can be made for a
// request before failing.
func (s *Standard) MaxAttempts() int {
	return s.options.MaxAttempts
}

// IsErrorRetryable returns if the error is can be retried or not. Should not
// consider the number of attempts made.
func (s *Standard) IsErrorRetryable(err error) bool {
	return s.retryable.IsErrorRetryable(err).Bool()
}

// RetryDelay returns the delay to use before another request attempt is made.
func (s *Standard) RetryDelay(attempt int, err error) (time.Duration, error) {
	return s.backoff.BackoffDelay(attempt, err)
}

// GetAttemptToken returns the token to be released after then attempt completes.
// The release token will add NoRetryIncrement to the RateLimiter token pool if
// the attempt was successful. If the attempt failed, nothing will be done.
func (s *Standard) GetAttemptToken(context.Context) (func(error) error, error) {
	return s.GetInitialToken(), nil
}

// GetInitialToken returns a token for adding the NoRetryIncrement to the
// RateLimiter token if the attempt completed successfully without error.
//
// InitialToken applies to result of the each attempt, including the first.
// Whereas the RetryToken applies to the result of subsequent attempts.
//
// Deprecated: use GetAttemptToken instead.
func (s *Standard) GetInitialToken() func(error) error {
	return releaseToken(s.noRetryIncrement).release
}

func (s *Standard) noRetryIncrement() error {
	return s.options.RateLimiter.AddTokens(s.options.NoRetryIncrement)
}

// GetRetryToken attempts to deduct the retry cost from the retry token pool.
// Returning the token release function, or error.
func (s *Standard) GetRetryToken(ctx context.Context, opErr error) (func(error) error, error) {
	cost := s.options.RetryCost

	if s.timeout.IsErrorTimeout(opErr).Bool() {
		cost = s.options.RetryTimeoutCost
	}

	fn, err := s.options.RateLimiter.GetToken(ctx, cost)
	if err != nil {
		return nil, fmt.Errorf("failed to get rate limit token, %w", err)
	}

	return releaseToken(fn).release, nil
}

func nopRelease(error) error { return nil }

type releaseToken func() error

func (f releaseToken) release(err error) error {
	if err != nil {
		return nil
	}

	return f()
}
