package aws

import (
	"context"
	"fmt"
	"time"
)

// RetryMode provides the mode the API client will use to create a retryer
// based on.
type RetryMode string

const (
	// RetryModeStandard model provides rate limited retry attempts with
	// exponential backoff delay.
	RetryModeStandard RetryMode = "standard"

	// RetryModeAdaptive model provides attempt send rate limiting on throttle
	// responses in addition to standard mode's retry rate limiting.
	//
	// Adaptive retry mode is experimental and is subject to change in the
	// future.
	RetryModeAdaptive RetryMode = "adaptive"
)

// ParseRetryMode attempts to parse a RetryMode from the given string.
// Returning error if the value is not a known RetryMode.
func ParseRetryMode(v string) (mode RetryMode, err error) {
	switch v {
	case "standard":
		return RetryModeStandard, nil
	case "adaptive":
		return RetryModeAdaptive, nil
	default:
		return mode, fmt.Errorf("unknown RetryMode, %v", v)
	}
}

func (m RetryMode) String() string { return string(m) }

// Retryer is an interface to determine if a given error from a
// attempt should be retried, and if so what backoff delay to apply. The
// default implementation used by most services is the retry package's Standard
// type. Which contains basic retry logic using exponential backoff.
type Retryer interface {
	// IsErrorRetryable returns if the failed attempt is retryable. This check
	// should determine if the error can be retried, or if the error is
	// terminal.
	IsErrorRetryable(error) bool

	// MaxAttempts returns the maximum number of attempts that can be made for
	// an attempt before failing. A value of 0 implies that the attempt should
	// be retried until it succeeds if the errors are retryable.
	MaxAttempts() int

	// RetryDelay returns the delay that should be used before retrying the
	// attempt. Will return error if the delay could not be determined.
	RetryDelay(attempt int, opErr error) (time.Duration, error)

	// GetRetryToken attempts to deduct the retry cost from the retry token pool.
	// Returning the token release function, or error.
	GetRetryToken(ctx context.Context, opErr error) (releaseToken func(error) error, err error)

	// GetInitialToken returns the initial attempt token that can increment the
	// retry token pool if the attempt is successful.
	GetInitialToken() (releaseToken func(error) error)
}

// RetryerV2 is an interface to determine if a given error from an attempt
// should be retried, and if so what backoff delay to apply. The default
// implementation used by most services is the retry package's Standard type.
// Which contains basic retry logic using exponential backoff.
//
// RetryerV2 replaces the Retryer interface, deprecating the GetInitialToken
// method in favor of GetAttemptToken which takes a context, and can return an error.
//
// The SDK's retry package's Attempt middleware, and utilities will always
// wrap a Retryer as a RetryerV2. Delegating to GetInitialToken, only if
// GetAttemptToken is not implemented.
type RetryerV2 interface {
	Retryer

	// GetInitialToken returns the initial attempt token that can increment the
	// retry token pool if the attempt is successful.
	//
	// Deprecated: This method does not provide a way to block using Context,
	// nor can it return an error. Use RetryerV2, and GetAttemptToken instead.
	GetInitialToken() (releaseToken func(error) error)

	// GetAttemptToken returns the send token that can be used to rate limit
	// attempt calls. Will be used by the SDK's retry package's Attempt
	// middleware to get a send token prior to calling the temp and releasing
	// the send token after the attempt has been made.
	GetAttemptToken(context.Context) (func(error) error, error)
}

// NopRetryer provides a RequestRetryDecider implementation that will flag
// all attempt errors as not retryable, with a max attempts of 1.
type NopRetryer struct{}

// IsErrorRetryable returns false for all error values.
func (NopRetryer) IsErrorRetryable(error) bool { return false }

// MaxAttempts always returns 1 for the original attempt.
func (NopRetryer) MaxAttempts() int { return 1 }

// RetryDelay is not valid for the NopRetryer. Will always return error.
func (NopRetryer) RetryDelay(int, error) (time.Duration, error) {
	return 0, fmt.Errorf("not retrying any attempt errors")
}

// GetRetryToken returns a stub function that does nothing.
func (NopRetryer) GetRetryToken(context.Context, error) (func(error) error, error) {
	return nopReleaseToken, nil
}

// GetInitialToken returns a stub function that does nothing.
func (NopRetryer) GetInitialToken() func(error) error {
	return nopReleaseToken
}

// GetAttemptToken returns a stub function that does nothing.
func (NopRetryer) GetAttemptToken(context.Context) (func(error) error, error) {
	return nopReleaseToken, nil
}

func nopReleaseToken(error) error { return nil }
