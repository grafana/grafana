// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

package retry

import (
	"context"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	// DefaultRetriableCodes is a set of well known types gRPC codes that should be retri-able.
	//
	// `ResourceExhausted` means that the user quota, e.g. per-RPC limits, have been reached.
	// `Unavailable` means that system is currently unavailable and the client should retry again.
	DefaultRetriableCodes = []codes.Code{codes.ResourceExhausted, codes.Unavailable}

	defaultOptions = &options{
		max:            0, // disabled
		perCallTimeout: 0, // disabled
		includeHeader:  true,
		backoffFunc:    BackoffLinearWithJitter(50*time.Millisecond /*jitter*/, 0.10),
		onRetryCallback: OnRetryCallback(func(ctx context.Context, attempt uint, err error) {
			logTrace(ctx, "grpc_retry attempt: %d, backoff for %v", attempt, err)
		}),
		retriableFunc: newRetriableFuncForCodes(DefaultRetriableCodes),
	}
)

// BackoffFunc denotes a family of functions that control the backoff duration between call retries.
//
// They are called with an identifier of the attempt, and should return a time the system client should
// hold off for. If the time returned is longer than the `context.Context.Deadline` of the request
// the deadline of the request takes precedence and the wait will be interrupted before proceeding
// with the next iteration. The context can be used to extract request scoped metadata and context values.
type BackoffFunc func(ctx context.Context, attempt uint) time.Duration

// OnRetryCallback is the type of function called when a retry occurs.
type OnRetryCallback func(ctx context.Context, attempt uint, err error)

// RetriableFunc denotes a family of functions that control which error should be retried.
type RetriableFunc func(err error) bool

// Disable disables the retry behaviour on this call, or this interceptor.
//
// Its semantically the same to `WithMax`
func Disable() CallOption {
	return WithMax(0)
}

// WithMax sets the maximum number of retries on this call, or this interceptor.
func WithMax(maxRetries uint) CallOption {
	return CallOption{applyFunc: func(o *options) {
		o.max = maxRetries
	}}
}

// WithBackoff sets the `BackoffFunc` used to control time between retries.
func WithBackoff(bf BackoffFunc) CallOption {
	return CallOption{applyFunc: func(o *options) {
		o.backoffFunc = bf
	}}
}

// WithOnRetryCallback sets the callback to use when a retry occurs.
//
// By default, when no callback function provided, we will just print a log to trace
func WithOnRetryCallback(fn OnRetryCallback) CallOption {
	return CallOption{applyFunc: func(o *options) {
		o.onRetryCallback = fn
	}}
}

// WithCodes sets which codes should be retried.
//
// Please *use with care*, as you may be retrying non-idempotent calls.
//
// You cannot automatically retry on Cancelled and Deadline, please use `WithPerRetryTimeout` for these.
func WithCodes(retryCodes ...codes.Code) CallOption {
	return CallOption{applyFunc: func(o *options) {
		o.retriableFunc = newRetriableFuncForCodes(retryCodes)
	}}
}

// WithPerRetryTimeout sets the RPC timeout per call (including initial call) on this call, or this interceptor.
//
// The context.Deadline of the call takes precedence and sets the maximum time the whole invocation
// will take, but WithPerRetryTimeout can be used to limit the RPC time per each call.
//
// For example, with context.Deadline = now + 10s, and WithPerRetryTimeout(3 * time.Seconds), each
// of the retry calls (including the initial one) will have a deadline of now + 3s.
//
// A value of 0 disables the timeout overrides completely and returns to each retry call using the
// parent `context.Deadline`.
//
// Note that when this is enabled, any DeadlineExceeded errors that are propagated up will be retried.
func WithPerRetryTimeout(timeout time.Duration) CallOption {
	return CallOption{applyFunc: func(o *options) {
		o.perCallTimeout = timeout
	}}
}

// WithRetriable sets which error should be retried.
func WithRetriable(retriableFunc RetriableFunc) CallOption {
	return CallOption{applyFunc: func(o *options) {
		o.retriableFunc = retriableFunc
	}}
}

type options struct {
	max             uint
	perCallTimeout  time.Duration
	includeHeader   bool
	backoffFunc     BackoffFunc
	onRetryCallback OnRetryCallback
	retriableFunc   RetriableFunc
}

// CallOption is a grpc.CallOption that is local to grpc_retry.
type CallOption struct {
	grpc.EmptyCallOption // make sure we implement private after() and before() fields so we don't panic.
	applyFunc            func(opt *options)
}

func reuseOrNewWithCallOptions(opt *options, callOptions []CallOption) *options {
	if len(callOptions) == 0 {
		return opt
	}
	optCopy := &options{}
	*optCopy = *opt
	for _, f := range callOptions {
		f.applyFunc(optCopy)
	}
	return optCopy
}

func filterCallOptions(callOptions []grpc.CallOption) (grpcOptions []grpc.CallOption, retryOptions []CallOption) {
	for _, opt := range callOptions {
		if co, ok := opt.(CallOption); ok {
			retryOptions = append(retryOptions, co)
		} else {
			grpcOptions = append(grpcOptions, opt)
		}
	}
	return grpcOptions, retryOptions
}

// newRetriableFuncForCodes returns retriable function for specific Codes.
func newRetriableFuncForCodes(codes []codes.Code) func(err error) bool {
	return func(err error) bool {
		errCode := status.Code(err)
		if isContextError(err) {
			// context errors are not retriable based on user settings.
			return false
		}
		for _, code := range codes {
			if code == errCode {
				return true
			}
		}
		return false
	}
}
