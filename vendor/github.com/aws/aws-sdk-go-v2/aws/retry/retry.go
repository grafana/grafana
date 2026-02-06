package retry

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
)

// AddWithErrorCodes returns a Retryer with additional error codes considered
// for determining if the error should be retried.
func AddWithErrorCodes(r aws.Retryer, codes ...string) aws.Retryer {
	retryable := &RetryableErrorCode{
		Codes: map[string]struct{}{},
	}
	for _, c := range codes {
		retryable.Codes[c] = struct{}{}
	}

	return &withIsErrorRetryable{
		RetryerV2: wrapAsRetryerV2(r),
		Retryable: retryable,
	}
}

type withIsErrorRetryable struct {
	aws.RetryerV2
	Retryable IsErrorRetryable
}

func (r *withIsErrorRetryable) IsErrorRetryable(err error) bool {
	if v := r.Retryable.IsErrorRetryable(err); v != aws.UnknownTernary {
		return v.Bool()
	}
	return r.RetryerV2.IsErrorRetryable(err)
}

// AddWithMaxAttempts returns a Retryer with MaxAttempts set to the value
// specified.
func AddWithMaxAttempts(r aws.Retryer, max int) aws.Retryer {
	return &withMaxAttempts{
		RetryerV2: wrapAsRetryerV2(r),
		Max:       max,
	}
}

type withMaxAttempts struct {
	aws.RetryerV2
	Max int
}

func (w *withMaxAttempts) MaxAttempts() int {
	return w.Max
}

// AddWithMaxBackoffDelay returns a retryer wrapping the passed in retryer
// overriding the RetryDelay behavior for a alternate minimum initial backoff
// delay.
func AddWithMaxBackoffDelay(r aws.Retryer, delay time.Duration) aws.Retryer {
	return &withMaxBackoffDelay{
		RetryerV2: wrapAsRetryerV2(r),
		backoff:   NewExponentialJitterBackoff(delay),
	}
}

type withMaxBackoffDelay struct {
	aws.RetryerV2
	backoff *ExponentialJitterBackoff
}

func (r *withMaxBackoffDelay) RetryDelay(attempt int, err error) (time.Duration, error) {
	return r.backoff.BackoffDelay(attempt, err)
}

type wrappedAsRetryerV2 struct {
	aws.Retryer
}

func wrapAsRetryerV2(r aws.Retryer) aws.RetryerV2 {
	v, ok := r.(aws.RetryerV2)
	if !ok {
		v = wrappedAsRetryerV2{Retryer: r}
	}

	return v
}

func (w wrappedAsRetryerV2) GetAttemptToken(context.Context) (func(error) error, error) {
	return w.Retryer.GetInitialToken(), nil
}
