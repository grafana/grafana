// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

package retry

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/metadata"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	grpcMetadata "google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const (
	AttemptMetadataKey = "x-retry-attempt"
)

// UnaryClientInterceptor returns a new retrying unary client interceptor.
//
// The default configuration of the interceptor is to not retry *at all*. This behaviour can be
// changed through options (e.g. WithMax) on creation of the interceptor or on call (through grpc.CallOptions).
func UnaryClientInterceptor(optFuncs ...CallOption) grpc.UnaryClientInterceptor {
	intOpts := reuseOrNewWithCallOptions(defaultOptions, optFuncs)
	return func(parentCtx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		grpcOpts, retryOpts := filterCallOptions(opts)
		callOpts := reuseOrNewWithCallOptions(intOpts, retryOpts)
		// short circuit for simplicity, and avoiding allocations.
		if callOpts.max == 0 {
			return invoker(parentCtx, method, req, reply, cc, grpcOpts...)
		}
		var lastErr error
		for attempt := uint(0); attempt < callOpts.max; attempt++ {
			if err := waitRetryBackoff(attempt, parentCtx, callOpts); err != nil {
				return err
			}
			if attempt > 0 {
				callOpts.onRetryCallback(parentCtx, attempt, lastErr)
			}
			callCtx, cancel := perCallContext(parentCtx, callOpts, attempt)
			lastErr = invoker(callCtx, method, req, reply, cc, grpcOpts...)
			// Cancel the context immediately after invoking the next call in the chain to avoid
			// holing onto its memory until this function returns.
			cancel()
			// TODO(mwitkow): Maybe dial and transport errors should be retriable?
			if lastErr == nil {
				return nil
			}
			if isContextError(lastErr) {
				if parentCtx.Err() != nil {
					logTrace(parentCtx, "grpc_retry attempt: %d, parent context error: %v", attempt, parentCtx.Err())
					// its the parent context deadline or cancellation.
					return lastErr
				} else if callOpts.perCallTimeout != 0 {
					// We have set a perCallTimeout in the retry middleware, which would result in a context error if
					// the deadline was exceeded, in which case try again.
					logTrace(parentCtx, "grpc_retry attempt: %d, context error from retry call", attempt)
					continue
				}
			}
			if !isRetriable(lastErr, callOpts) {
				return lastErr
			}
		}
		return lastErr
	}
}

// StreamClientInterceptor returns a new retrying stream client interceptor for server side streaming calls.
//
// The default configuration of the interceptor is to not retry *at all*. This behaviour can be
// changed through options (e.g. WithMax) on creation of the interceptor or on call (through grpc.CallOptions).
//
// Retry logic is available *only for ServerStreams*, i.e. 1:n streams, as the internal logic needs
// to buffer the messages sent by the client. If retry is enabled on any other streams (ClientStreams,
// BidiStreams), the retry interceptor will fail the call.
func StreamClientInterceptor(optFuncs ...CallOption) grpc.StreamClientInterceptor {
	intOpts := reuseOrNewWithCallOptions(defaultOptions, optFuncs)
	return func(parentCtx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		grpcOpts, retryOpts := filterCallOptions(opts)
		callOpts := reuseOrNewWithCallOptions(intOpts, retryOpts)
		// short circuit for simplicity, and avoiding allocations.
		if callOpts.max == 0 {
			return streamer(parentCtx, desc, cc, method, grpcOpts...)
		}
		if desc.ClientStreams {
			return nil, status.Error(codes.Unimplemented, "grpc_retry: cannot retry on ClientStreams, set grpc_retry.Disable()")
		}

		var lastErr error
		for attempt := uint(0); attempt < callOpts.max; attempt++ {
			if err := waitRetryBackoff(attempt, parentCtx, callOpts); err != nil {
				return nil, err
			}
			if attempt > 0 {
				callOpts.onRetryCallback(parentCtx, attempt, lastErr)
			}
			var newStreamer grpc.ClientStream
			newStreamer, lastErr = streamer(perStreamContext(parentCtx, callOpts, attempt), desc, cc, method, grpcOpts...)
			if lastErr == nil {
				retryingStreamer := &serverStreamingRetryingStream{
					ClientStream: newStreamer,
					callOpts:     callOpts,
					parentCtx:    parentCtx,
					streamerCall: func(ctx context.Context) (grpc.ClientStream, error) {
						attempt++
						return streamer(perStreamContext(ctx, callOpts, attempt), desc, cc, method, grpcOpts...)
					},
				}
				return retryingStreamer, nil
			}
			if isContextError(lastErr) {
				if parentCtx.Err() != nil {
					logTrace(parentCtx, "grpc_retry attempt: %d, parent context error: %v", attempt, parentCtx.Err())
					// its the parent context deadline or cancellation.
					return nil, lastErr
				} else if callOpts.perCallTimeout != 0 {
					// We have set a perCallTimeout in the retry middleware, which would result in a context error if
					// the deadline was exceeded, in which case try again.
					logTrace(parentCtx, "grpc_retry attempt: %d, context error from retry call", attempt)
					continue
				}
			}
			if !isRetriable(lastErr, callOpts) {
				return nil, lastErr
			}
		}
		return nil, lastErr
	}
}

// type serverStreamingRetryingStream is the implementation of grpc.ClientStream that acts as a
// proxy to the underlying call. If any of the RecvMsg() calls fail, it will try to reestablish
// a new ClientStream according to the retry policy.
type serverStreamingRetryingStream struct {
	grpc.ClientStream
	bufferedSends []any // single message that the client can sen
	wasClosedSend bool  // indicates that CloseSend was closed
	parentCtx     context.Context
	callOpts      *options
	streamerCall  func(ctx context.Context) (grpc.ClientStream, error)
	mu            sync.RWMutex
}

func (s *serverStreamingRetryingStream) setStream(clientStream grpc.ClientStream) {
	s.mu.Lock()
	s.ClientStream = clientStream
	s.mu.Unlock()
}

func (s *serverStreamingRetryingStream) getStream() grpc.ClientStream {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ClientStream
}

func (s *serverStreamingRetryingStream) SendMsg(m any) error {
	s.mu.Lock()
	s.bufferedSends = append(s.bufferedSends, m)
	s.mu.Unlock()
	return s.getStream().SendMsg(m)
}

func (s *serverStreamingRetryingStream) CloseSend() error {
	s.mu.Lock()
	s.wasClosedSend = true
	s.mu.Unlock()
	return s.getStream().CloseSend()
}

func (s *serverStreamingRetryingStream) Header() (grpcMetadata.MD, error) {
	return s.getStream().Header()
}

func (s *serverStreamingRetryingStream) Trailer() grpcMetadata.MD {
	return s.getStream().Trailer()
}

func (s *serverStreamingRetryingStream) RecvMsg(m any) error {
	attemptRetry, lastErr := s.receiveMsgAndIndicateRetry(m)
	if !attemptRetry {
		return lastErr // success or hard failure
	}
	// We start off from attempt 1, because zeroth was already made on normal SendMsg().
	for attempt := uint(1); attempt < s.callOpts.max; attempt++ {
		if err := waitRetryBackoff(attempt, s.parentCtx, s.callOpts); err != nil {
			return err
		}
		s.callOpts.onRetryCallback(s.parentCtx, attempt, lastErr)
		newStream, err := s.reestablishStreamAndResendBuffer(s.parentCtx)
		if err != nil {
			// Retry dial and transport errors of establishing stream as grpc doesn't retry.
			if isRetriable(err, s.callOpts) {
				continue
			}
			return err
		}

		s.setStream(newStream)
		attemptRetry, lastErr = s.receiveMsgAndIndicateRetry(m)

		if !attemptRetry {
			return lastErr
		}
	}
	return lastErr
}

func (s *serverStreamingRetryingStream) receiveMsgAndIndicateRetry(m any) (bool, error) {
	err := s.getStream().RecvMsg(m)
	if err == nil || errors.Is(err, io.EOF) {
		return false, err
	}
	if isContextError(err) {
		if s.parentCtx.Err() != nil {
			logTrace(s.parentCtx, "grpc_retry parent context error: %v", s.parentCtx.Err())
			return false, err
		} else if s.callOpts.perCallTimeout != 0 {
			// We have set a perCallTimeout in the retry middleware, which would result in a context error if
			// the deadline was exceeded, in which case try again.
			logTrace(s.parentCtx, "grpc_retry context error from retry call")
			return true, err
		}
	}
	return isRetriable(err, s.callOpts), err
}

func (s *serverStreamingRetryingStream) reestablishStreamAndResendBuffer(callCtx context.Context) (grpc.ClientStream, error) {
	s.mu.RLock()
	bufferedSends := s.bufferedSends
	s.mu.RUnlock()
	newStream, err := s.streamerCall(callCtx)
	if err != nil {
		logTrace(callCtx, "grpc_retry failed redialing new stream: %v", err)
		return nil, err
	}
	for _, msg := range bufferedSends {
		if err := newStream.SendMsg(msg); err != nil {
			logTrace(callCtx, "grpc_retry failed resending message: %v", err)
			return nil, err
		}
	}
	if err := newStream.CloseSend(); err != nil {
		logTrace(callCtx, "grpc_retry failed CloseSend on new stream %v", err)
		return nil, err
	}
	return newStream, nil
}

func waitRetryBackoff(attempt uint, parentCtx context.Context, callOpts *options) error {
	var waitTime time.Duration = 0
	if attempt > 0 {
		waitTime = callOpts.backoffFunc(parentCtx, attempt)
	}
	if waitTime > 0 {
		logTrace(parentCtx, "grpc_retry attempt: %d, backoff for %v", attempt, waitTime)
		timer := time.NewTimer(waitTime)
		select {
		case <-parentCtx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return contextErrToGrpcErr(parentCtx.Err())
		case <-timer.C:
		}
	}
	return nil
}

func isRetriable(err error, callOpts *options) bool {
	if callOpts.retriableFunc != nil {
		return callOpts.retriableFunc(err)
	}
	return false
}

func isContextError(err error) bool {
	code := status.Code(err)
	return code == codes.DeadlineExceeded || code == codes.Canceled
}

func perCallContext(parentCtx context.Context, callOpts *options, attempt uint) (context.Context, context.CancelFunc) {
	cancel := context.CancelFunc(func() {})

	ctx := parentCtx
	if callOpts.perCallTimeout != 0 {
		ctx, cancel = context.WithTimeout(ctx, callOpts.perCallTimeout)
	}
	if attempt > 0 && callOpts.includeHeader {
		mdClone := metadata.ExtractOutgoing(ctx).Clone().Set(AttemptMetadataKey, fmt.Sprintf("%d", attempt))
		ctx = mdClone.ToOutgoing(ctx)
	}
	return ctx, cancel
}

func perStreamContext(parentCtx context.Context, callOpts *options, attempt uint) context.Context {
	ctx := parentCtx
	if attempt > 0 && callOpts.includeHeader {
		mdClone := metadata.ExtractOutgoing(ctx).Clone().Set(AttemptMetadataKey, fmt.Sprintf("%d", attempt))
		ctx = mdClone.ToOutgoing(ctx)
	}
	return ctx
}

func contextErrToGrpcErr(err error) error {
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return status.Error(codes.DeadlineExceeded, err.Error())
	case errors.Is(err, context.Canceled):
		return status.Error(codes.Canceled, err.Error())
	default:
		return status.Error(codes.Unknown, err.Error())
	}
}

func logTrace(ctx context.Context, format string, a ...any) {
	tr, ok := traceFromCtx(ctx)
	if !ok {
		return
	}
	tr.LazyPrintf(format, a...)
}
