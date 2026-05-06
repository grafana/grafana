package retry

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
)

const (
	// DefaultRequestCost is the cost of a single request from the adaptive
	// rate limited token bucket.
	DefaultRequestCost uint = 1
)

// DefaultThrottles provides the set of errors considered throttle errors that
// are checked by default.
var DefaultThrottles = []IsErrorThrottle{
	ThrottleErrorCode{
		Codes: DefaultThrottleErrorCodes,
	},
}

// AdaptiveModeOptions provides the functional options for configuring the
// adaptive retry mode, and delay behavior.
type AdaptiveModeOptions struct {
	// If the adaptive token bucket is empty, when an attempt will be made
	// AdaptiveMode will sleep until a token is available. This can occur when
	// attempts fail with throttle errors. Use this option to disable the sleep
	// until token is available, and return error immediately.
	FailOnNoAttemptTokens bool

	// The cost of an attempt from the AdaptiveMode's adaptive token bucket.
	RequestCost uint

	// Set of strategies to determine if the attempt failed due to a throttle
	// error.
	//
	// It is safe to append to this list in NewAdaptiveMode's functional options.
	Throttles []IsErrorThrottle

	// Set of options for standard retry mode that AdaptiveMode is built on top
	// of. AdaptiveMode may apply its own defaults to Standard retry mode that
	// are different than the defaults of NewStandard. Use these options to
	// override the default options.
	StandardOptions []func(*StandardOptions)
}

// AdaptiveMode provides an experimental retry strategy that expands on the
// Standard retry strategy, adding client attempt rate limits. The attempt rate
// limit is initially unrestricted, but becomes restricted when the attempt
// fails with for a throttle error. When restricted AdaptiveMode may need to
// sleep before an attempt is made, if too many throttles have been received.
// AdaptiveMode's sleep can be canceled with context cancel. Set
// AdaptiveModeOptions FailOnNoAttemptTokens to change the behavior from sleep,
// to fail fast.
//
// Eventually unrestricted attempt rate limit will be restored once attempts no
// longer are failing due to throttle errors.
type AdaptiveMode struct {
	options   AdaptiveModeOptions
	throttles IsErrorThrottles

	retryer   aws.RetryerV2
	rateLimit *adaptiveRateLimit
}

// NewAdaptiveMode returns an initialized AdaptiveMode retry strategy.
func NewAdaptiveMode(optFns ...func(*AdaptiveModeOptions)) *AdaptiveMode {
	o := AdaptiveModeOptions{
		RequestCost: DefaultRequestCost,
		Throttles:   append([]IsErrorThrottle{}, DefaultThrottles...),
	}
	for _, fn := range optFns {
		fn(&o)
	}

	return &AdaptiveMode{
		options:   o,
		throttles: IsErrorThrottles(o.Throttles),
		retryer:   NewStandard(o.StandardOptions...),
		rateLimit: newAdaptiveRateLimit(),
	}
}

// IsErrorRetryable returns if the failed attempt is retryable. This check
// should determine if the error can be retried, or if the error is
// terminal.
func (a *AdaptiveMode) IsErrorRetryable(err error) bool {
	return a.retryer.IsErrorRetryable(err)
}

// MaxAttempts returns the maximum number of attempts that can be made for
// an attempt before failing. A value of 0 implies that the attempt should
// be retried until it succeeds if the errors are retryable.
func (a *AdaptiveMode) MaxAttempts() int {
	return a.retryer.MaxAttempts()
}

// RetryDelay returns the delay that should be used before retrying the
// attempt. Will return error if the if the delay could not be determined.
func (a *AdaptiveMode) RetryDelay(attempt int, opErr error) (
	time.Duration, error,
) {
	return a.retryer.RetryDelay(attempt, opErr)
}

// GetRetryToken attempts to deduct the retry cost from the retry token pool.
// Returning the token release function, or error.
func (a *AdaptiveMode) GetRetryToken(ctx context.Context, opErr error) (
	releaseToken func(error) error, err error,
) {
	return a.retryer.GetRetryToken(ctx, opErr)
}

// GetInitialToken returns the initial attempt token that can increment the
// retry token pool if the attempt is successful.
//
// Deprecated: This method does not provide a way to block using Context,
// nor can it return an error. Use RetryerV2, and GetAttemptToken instead. Only
// present to implement Retryer interface.
func (a *AdaptiveMode) GetInitialToken() (releaseToken func(error) error) {
	return nopRelease
}

// GetAttemptToken returns the attempt token that can be used to rate limit
// attempt calls. Will be used by the SDK's retry package's Attempt
// middleware to get an attempt token prior to calling the temp and releasing
// the attempt token after the attempt has been made.
func (a *AdaptiveMode) GetAttemptToken(ctx context.Context) (func(error) error, error) {
	for {
		acquiredToken, waitTryAgain := a.rateLimit.AcquireToken(a.options.RequestCost)
		if acquiredToken {
			break
		}
		if a.options.FailOnNoAttemptTokens {
			return nil, fmt.Errorf(
				"unable to get attempt token, and FailOnNoAttemptTokens enables")
		}

		if err := sdk.SleepWithContext(ctx, waitTryAgain); err != nil {
			return nil, fmt.Errorf("failed to wait for token to be available, %w", err)
		}
	}

	return a.handleResponse, nil
}

func (a *AdaptiveMode) handleResponse(opErr error) error {
	throttled := a.throttles.IsErrorThrottle(opErr).Bool()

	a.rateLimit.Update(throttled)
	return nil
}
