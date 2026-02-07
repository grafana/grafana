// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/grpc_logging.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"

	dskit_log "github.com/grafana/dskit/log"

	"google.golang.org/grpc"

	grpcUtils "github.com/grafana/dskit/grpcutil"
	"github.com/grafana/dskit/user"
)

const (
	gRPC = "gRPC"
)

// OptionalLogging is the interface that needs be implemented by an error that wants to control whether the log
// should be logged by GRPCServerLog.
type OptionalLogging interface {
	// ShouldLog returns whether the error should be logged and the reason. For example, if the error should be sampled
	// return returned reason could be something like "sampled 1/10". The reason, if any, is used to decorate the error
	// both in case the error should be logged or skipped.
	ShouldLog(ctx context.Context) (bool, string)
}

type DoNotLogError struct{ Err error }

func (i DoNotLogError) Error() string                              { return i.Err.Error() }
func (i DoNotLogError) Unwrap() error                              { return i.Err }
func (i DoNotLogError) ShouldLog(_ context.Context) (bool, string) { return false, "" }

// GRPCServerLog logs grpc requests, errors, and latency.
type GRPCServerLog struct {
	Log log.Logger
	// WithRequest will log the entire request rather than just the error
	WithRequest              bool
	DisableRequestSuccessLog bool
}

// UnaryServerInterceptor returns an interceptor that logs gRPC requests
func (s GRPCServerLog) UnaryServerInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	begin := time.Now()
	resp, err := handler(ctx, req)
	if err == nil && s.DisableRequestSuccessLog {
		return resp, nil
	}

	// Honor sampled error logging.
	keep, reason := shouldLog(ctx, err)
	if reason != "" {
		err = fmt.Errorf("%w (%s)", err, reason)
	}
	if !keep {
		return resp, err
	}

	entry := log.With(user.LogWith(ctx, s.Log), "method", info.FullMethod, "duration", time.Since(begin))
	if err != nil {
		if s.WithRequest {
			entry = log.With(entry, "request", req)
		}
		if grpcUtils.IsCanceled(err) {
			level.Debug(entry).Log("msg", gRPC, "err", err)
		} else {
			level.Warn(entry).Log("msg", gRPC, "err", err)
		}
	} else {
		level.Debug(entry).Log("msg", dskit_log.LazySprintf("%s (success)", gRPC))
	}
	return resp, err
}

// StreamServerInterceptor returns an interceptor that logs gRPC requests
func (s GRPCServerLog) StreamServerInterceptor(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
	begin := time.Now()
	err := handler(srv, ss)
	if err == nil && s.DisableRequestSuccessLog {
		return nil
	}

	entry := log.With(user.LogWith(ss.Context(), s.Log), "method", info.FullMethod, "duration", time.Since(begin))
	if err != nil {
		if grpcUtils.IsCanceled(err) {
			level.Debug(entry).Log("msg", gRPC, "err", err)
		} else {
			level.Warn(entry).Log("msg", gRPC, "err", err)
		}
	} else {
		level.Debug(entry).Log("msg", dskit_log.LazySprintf("%s (success)", gRPC))
	}
	return err
}

func shouldLog(ctx context.Context, err error) (bool, string) {
	var optional OptionalLogging
	if !errors.As(err, &optional) {
		return true, ""
	}

	return optional.ShouldLog(ctx)
}
