// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlpmetricgrpc // import "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"

import (
	"context"
	"errors"
	"time"

	colmetricpb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	metricpb "go.opentelemetry.io/proto/otlp/metrics/v1"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc/internal"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc/internal/oconf"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc/internal/retry"
)

type client struct {
	metadata      metadata.MD
	exportTimeout time.Duration
	requestFunc   retry.RequestFunc

	// ourConn keeps track of where conn was created: true if created here in
	// NewClient, or false if passed with an option. This is important on
	// Shutdown as the conn should only be closed if we created it. Otherwise,
	// it is up to the processes that passed the conn to close it.
	ourConn bool
	conn    *grpc.ClientConn
	msc     colmetricpb.MetricsServiceClient
}

// newClient creates a new gRPC metric client.
func newClient(_ context.Context, cfg oconf.Config) (*client, error) {
	c := &client{
		exportTimeout: cfg.Metrics.Timeout,
		requestFunc:   cfg.RetryConfig.RequestFunc(retryable),
		conn:          cfg.GRPCConn,
	}

	if len(cfg.Metrics.Headers) > 0 {
		c.metadata = metadata.New(cfg.Metrics.Headers)
	}

	if c.conn == nil {
		// If the caller did not provide a ClientConn when the client was
		// created, create one using the configuration they did provide.
		userAgent := "OTel Go OTLP over gRPC metrics exporter/" + Version()
		dialOpts := []grpc.DialOption{grpc.WithUserAgent(userAgent)}
		dialOpts = append(dialOpts, cfg.DialOptions...)

		conn, err := grpc.NewClient(cfg.Metrics.Endpoint, dialOpts...)
		if err != nil {
			return nil, err
		}
		// Keep track that we own the lifecycle of this conn and need to close
		// it on Shutdown.
		c.ourConn = true
		c.conn = conn
	}

	c.msc = colmetricpb.NewMetricsServiceClient(c.conn)

	return c, nil
}

// Shutdown shuts down the client, freeing all resource.
//
// Any active connections to a remote endpoint are closed if they were created
// by the client. Any gRPC connection passed during creation using
// WithGRPCConn will not be closed. It is the caller's responsibility to
// handle cleanup of that resource.
func (c *client) Shutdown(ctx context.Context) error {
	// The otlpmetric.Exporter synchronizes access to client methods and
	// ensures this is called only once. The only thing that needs to be done
	// here is to release any computational resources the client holds.

	c.metadata = nil
	c.requestFunc = nil
	c.msc = nil

	err := ctx.Err()
	if c.ourConn {
		closeErr := c.conn.Close()
		// A context timeout error takes precedence over this error.
		if err == nil && closeErr != nil {
			err = closeErr
		}
	}
	c.conn = nil
	return err
}

// UploadMetrics sends protoMetrics to connected endpoint.
//
// Retryable errors from the server will be handled according to any
// RetryConfig the client was created with.
func (c *client) UploadMetrics(ctx context.Context, protoMetrics *metricpb.ResourceMetrics) (uploadErr error) {
	// The otlpmetric.Exporter synchronizes access to client methods, and
	// ensures this is not called after the Exporter is shutdown. Only thing
	// to do here is send data.

	select {
	case <-ctx.Done():
		// Do not upload if the context is already expired.
		return ctx.Err()
	default:
	}

	ctx, cancel := c.exportContext(ctx)
	defer cancel()

	return errors.Join(uploadErr, c.requestFunc(ctx, func(iCtx context.Context) error {
		resp, err := c.msc.Export(iCtx, &colmetricpb.ExportMetricsServiceRequest{
			ResourceMetrics: []*metricpb.ResourceMetrics{protoMetrics},
		})
		if resp != nil && resp.PartialSuccess != nil {
			msg := resp.PartialSuccess.GetErrorMessage()
			n := resp.PartialSuccess.GetRejectedDataPoints()
			if n != 0 || msg != "" {
				e := internal.MetricPartialSuccessError(n, msg)
				uploadErr = errors.Join(uploadErr, e)
			}
		}
		// nil is converted to OK.
		if status.Code(err) == codes.OK {
			// Success.
			return nil
		}
		return err
	}))
}

// exportContext returns a copy of parent with an appropriate deadline and
// cancellation function based on the clients configured export timeout.
//
// It is the callers responsibility to cancel the returned context once its
// use is complete, via the parent or directly with the returned CancelFunc, to
// ensure all resources are correctly released.
func (c *client) exportContext(parent context.Context) (context.Context, context.CancelFunc) {
	var (
		ctx    context.Context
		cancel context.CancelFunc
	)

	if c.exportTimeout > 0 {
		ctx, cancel = context.WithTimeoutCause(parent, c.exportTimeout, errors.New("exporter export timeout"))
	} else {
		ctx, cancel = context.WithCancel(parent)
	}

	if c.metadata.Len() > 0 {
		md := c.metadata
		if outMD, ok := metadata.FromOutgoingContext(ctx); ok {
			md = metadata.Join(md, outMD)
		}

		ctx = metadata.NewOutgoingContext(ctx, md)
	}

	return ctx, cancel
}

// retryable returns if err identifies a request that can be retried and a
// duration to wait for if an explicit throttle time is included in err.
func retryable(err error) (bool, time.Duration) {
	s := status.Convert(err)
	return retryableGRPCStatus(s)
}

func retryableGRPCStatus(s *status.Status) (bool, time.Duration) {
	switch s.Code() {
	case codes.Canceled,
		codes.DeadlineExceeded,
		codes.Aborted,
		codes.OutOfRange,
		codes.Unavailable,
		codes.DataLoss:
		// Additionally, handle RetryInfo.
		_, d := throttleDelay(s)
		return true, d
	case codes.ResourceExhausted:
		// Retry only if the server signals that the recovery from resource exhaustion is possible.
		return throttleDelay(s)
	}

	// Not a retry-able error.
	return false, 0
}

// throttleDelay returns if the status is RetryInfo
// and the duration to wait for if an explicit throttle time is included.
func throttleDelay(s *status.Status) (bool, time.Duration) {
	for _, detail := range s.Details() {
		if t, ok := detail.(*errdetails.RetryInfo); ok {
			return true, t.RetryDelay.AsDuration()
		}
	}
	return false, 0
}
