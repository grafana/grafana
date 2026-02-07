package server

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/stats"
	"google.golang.org/grpc/tap"
)

// unprocessedRequestCheckTimeout is large enough for a normal request to start processing,
// and small enough to cleanup quickly if the request was cancelled and early aborted.
const unprocessedRequestCheckTimeout = 10 * time.Second

type GrpcInflightMethodLimiter interface {
	// RPCCallStarting is called before request has been read into memory.
	// All that's known about the request at this point is grpc method name.
	//
	// Returned context is used during the remainder of the gRPC call.
	//
	// Returned error should be convertible to gRPC Status via status.FromError,
	// otherwise gRPC-server implementation-specific error will be returned to the client (codes.PermissionDenied in grpc@v1.55.0).
	RPCCallStarting(ctx context.Context, methodName string, md metadata.MD) (context.Context, error)

	// RPCCallProcessing is called by a server interceptor, allowing request pre-processing or request blocking to be
	// performed. The returned function will be applied after the request is handled, providing any error that occurred while
	// handling the request.
	RPCCallProcessing(ctx context.Context, methodName string) (func(error), error)

	// RPCCallFinished is called when an RPC call is finished being handled.
	// Under certain very rare race conditions it might be called earlier than the actual request processing is finished.
	RPCCallFinished(ctx context.Context)
}

func newGrpcInflightLimitCheck(methodLimiter GrpcInflightMethodLimiter, logger log.Logger) *grpcInflightLimitCheck {
	return &grpcInflightLimitCheck{
		methodLimiter: methodLimiter,
		logger:        logger,
	}
}

// grpcInflightLimitCheck implements gRPC TapHandle and gRPC stats.Handler.
// grpcInflightLimitCheck can track inflight requests, and reject requests before even reading them into memory.
type grpcInflightLimitCheck struct {
	methodLimiter GrpcInflightMethodLimiter

	logger log.Logger

	// Used to mock time.AfterFunc in tests.
	timeAfterFuncMock func(d time.Duration, f func()) testableTimer
}

// TapHandle is called after receiving grpc request and headers, but before reading any request data yet.
// If we reject request here (by returning non-nil error), it won't be counted towards any metrics (eg. in middleware.grpcStatsHandler).
// If we accept request (no error), the request should be processed and eventually HandleRPC with stats.End notification will be called,
// unless the context is cancelled before we start processing the request.
func (g *grpcInflightLimitCheck) TapHandle(ctx context.Context, info *tap.Info) (context.Context, error) {
	if !isMethodNameValid(info.FullMethodName) {
		// If method name is not valid, we let the request continue, but not call method limiter.
		// Otherwise, we would not be able to call method limiter again when the call finishes, because in this case grpc server will not call stat handler.
		return ctx, nil
	}

	ctx, err := g.methodLimiter.RPCCallStarting(ctx, info.FullMethodName, info.Header)
	if err != nil {
		return ctx, err
	}

	// We called RPCCallStarting, so we need to ensure RPCCallFinished is called once the request is done.
	// Because of a shortcut introduced in https://github.com/grpc/grpc-go/pull/8439 this may not happen.
	// We could create a goroutine that would watch ctx.Done() and call RPCCallFinished if the context is done and we have not started processing the headers yet.
	// However, that would mean paying the cost of an extra goroutine for every single gRPC request, just in case the request's context is cancelled before we start processing it.
	// Instead of that we schedule a cheaper timer that we will cancel in the happy case, which will run after 10s and perform the cleanup only when needed.
	state := &gprcInflightLimitCheckerState{
		fullMethod:       info.FullMethodName,
		timestamp:        time.Now(),
		headersProcessed: make(chan struct{}),
	}
	state.nonProcessedRequestTimer = g.timeAfterFunc(unprocessedRequestCheckTimeout, g.checkProbablyEarlyAbortedRequest(ctx, state))

	return context.WithValue(ctx, gprcInflightLimitCheckerStateKey{}, state), nil
}

func (g *grpcInflightLimitCheck) checkProbablyEarlyAbortedRequest(ctx context.Context, state *gprcInflightLimitCheckerState) func() {
	return func() {
		// If this function is running, we're in a corner case. Be very verbose in logging to help with debugging.
		logger := state.logger(g.logger)

		level.Warn(g.logger).Log("msg", "gRPC request processing didn't start within 10s of receiving, checking the context state")
		select {
		case <-ctx.Done():
			level.Info(logger).Log("msg", "gRPC request context is done, assuming the request was cancelled before processing started, will call RPCCallFinished")
		case <-state.headersProcessed:
			level.Info(logger).Log("msg", "gRPC request processing has started, no need to call RPCCallFinished", "time_to_start_processing", time.Since(state.timestamp).String())
			return
		default:
			level.Info(logger).Log("msg", "gRPC request context is not done and processing hasn't started, will wait until context is done or processing starts")

			select {
			case <-ctx.Done():
				level.Info(logger).Log("msg", "gRPC request context is finally done, assuming the request was cancelled before processing started, will call RPCCallFinished")
			case <-state.headersProcessed:
				level.Info(logger).Log("msg", "gRPC request processing has finally started, no need to call RPCCallFinished", "time_to_start_processing", time.Since(state.timestamp).String())
				return
			}
		}

		called := false
		state.rpcCallFinishedOnce.Do(func() {
			called = true
			g.methodLimiter.RPCCallFinished(ctx)
		})
		if called {
			level.Info(logger).Log("msg", "called RPCCallFinished for gRPC request that never started processing")
		} else {
			level.Info(logger).Log("msg", "RPCCallFinishes was already called for this gRPC request, no need to call it again")
		}
	}
}

func (g *grpcInflightLimitCheck) UnaryServerInterceptor(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	finish, err := g.methodLimiter.RPCCallProcessing(ctx, info.FullMethod)
	if err != nil {
		return nil, err
	}
	result, err := handler(ctx, req)
	if finish != nil {
		finish(err)
	}
	return result, err

}

func (g *grpcInflightLimitCheck) StreamServerInterceptor(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
	finish, err := g.methodLimiter.RPCCallProcessing(ss.Context(), info.FullMethod)
	if err != nil {
		return err
	}
	err = handler(srv, ss)
	if finish != nil {
		finish(err)
	}
	return err
}
func (g *grpcInflightLimitCheck) TagRPC(ctx context.Context, _ *stats.RPCTagInfo) context.Context {
	return ctx
}

func (g *grpcInflightLimitCheck) HandleRPC(ctx context.Context, rpcStats stats.RPCStats) {
	switch rpcStats.(type) {
	case *stats.InHeader:
		if state, ok := ctx.Value(gprcInflightLimitCheckerStateKey{}).(*gprcInflightLimitCheckerState); ok {
			// We're processing this request, stop the timer.
			if !state.nonProcessedRequestTimer.Stop() {
				level.Warn(state.logger(g.logger)).Log("msg", "gRPC request processing has started, but the non-processing timer already fired, need to signal that we're processing it now")
				// The timer has already expired, so the function is either executing or has executed.
				//
				// This (stats.InHeader) should be called once and only once, but gRPC is known for changing contracts
				// and we don't want this to start panicking trying to close the channel multiple times,
				// so a sync.Once doesn't hurt here.
				state.headersProcessedOnce.Do(func() { close(state.headersProcessed) })
			}
		}

	case *stats.End:
		if state, ok := ctx.Value(gprcInflightLimitCheckerStateKey{}).(*gprcInflightLimitCheckerState); ok {
			// We're done processing the request, but there's a scenario under which we may have already called RPCCallFinished,
			// from the goroutine watching the context in TapHandle, so we need to ensure it's called only once.
			called := false
			state.rpcCallFinishedOnce.Do(func() {
				g.methodLimiter.RPCCallFinished(ctx)
				called = true
			})
			if !called {
				level.Warn(state.logger(g.logger)).Log("msg", "RPCCallFinished was already called for this gRPC request before the request actually finished processing")
			}
		}
	}
}

func (g *grpcInflightLimitCheck) TagConn(ctx context.Context, _ *stats.ConnTagInfo) context.Context {
	return ctx
}

func (g *grpcInflightLimitCheck) HandleConn(_ context.Context, _ stats.ConnStats) {
	// Not interested.
}

func (g *grpcInflightLimitCheck) timeAfterFunc(d time.Duration, f func()) testableTimer {
	if g.timeAfterFuncMock != nil {
		return g.timeAfterFuncMock(d, f)
	}
	return testableTimer{timer: time.AfterFunc(d, f)}
}

// This function mimics the check in grpc library, server.go, handleStream method. handleStream method can stop processing early,
// without calling stat handler if the method name is invalid.
func isMethodNameValid(method string) bool {
	if method != "" && method[0] == '/' {
		method = method[1:]
	}
	pos := strings.LastIndex(method, "/")
	return pos >= 0
}

type gprcInflightLimitCheckerStateKey struct{}

type gprcInflightLimitCheckerState struct {
	fullMethod string
	timestamp  time.Time

	nonProcessedRequestTimer testableTimer
	headersProcessedOnce     sync.Once
	headersProcessed         chan struct{}

	rpcCallFinishedOnce sync.Once
}

func (state *gprcInflightLimitCheckerState) logger(baseLogger log.Logger) log.Logger {
	return log.With(baseLogger, "method", state.fullMethod, "req_timestamp", state.timestamp.Format(time.RFC3339Nano))
}

type testableTimer struct {
	// timer is what we use in production code.
	timer *time.Timer

	// stop is used in tests to mock timer stopping behavior.
	stop func() bool
}

func (t testableTimer) Stop() bool {
	if t.timer != nil {
		return t.timer.Stop()
	}

	return t.stop()
}
