package server

import (
	"context"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/stats"
	"google.golang.org/grpc/tap"
)

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
	RPCCallFinished(ctx context.Context)
}

func newGrpcInflightLimitCheck(methodLimiter GrpcInflightMethodLimiter) *grpcInflightLimitCheck {
	return &grpcInflightLimitCheck{
		methodLimiter: methodLimiter,
	}
}

// grpcInflightLimitCheck implements gRPC TapHandle and gRPC stats.Handler.
// grpcInflightLimitCheck can track inflight requests, and reject requests before even reading them into memory.
type grpcInflightLimitCheck struct {
	methodLimiter GrpcInflightMethodLimiter
}

// TapHandle is called after receiving grpc request and headers, but before reading any request data yet.
// If we reject request here (by returning non-nil error), it won't be counted towards any metrics (eg. in middleware.grpcStatsHandler).
// If we accept request (no error), eventually HandleRPC with stats.End notification will be called.
func (g *grpcInflightLimitCheck) TapHandle(ctx context.Context, info *tap.Info) (context.Context, error) {
	if !isMethodNameValid(info.FullMethodName) {
		// If method name is not valid, we let the request continue, but not call method limiter.
		// Otherwise, we would not be able to call method limiter again when the call finishes, because in this case grpc server will not call stat handler.
		return ctx, nil
	}

	return g.methodLimiter.RPCCallStarting(ctx, info.FullMethodName, info.Header)
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
	// when request ends, and we started "inflight" request tracking for it, finish it.
	if _, ok := rpcStats.(*stats.End); !ok {
		return
	}

	g.methodLimiter.RPCCallFinished(ctx)
}

func (g *grpcInflightLimitCheck) TagConn(ctx context.Context, _ *stats.ConnTagInfo) context.Context {
	return ctx
}

func (g *grpcInflightLimitCheck) HandleConn(_ context.Context, _ stats.ConnStats) {
	// Not interested.
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
