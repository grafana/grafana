// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlploggrpc // import "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/encoding/gzip"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc/internal/retry"
	collogpb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	logpb "go.opentelemetry.io/proto/otlp/logs/v1"
)

// The methods of this type are not expected to be called concurrently.
type client struct {
	metadata      metadata.MD
	exportTimeout time.Duration
	requestFunc   retry.RequestFunc

	// ourConn keeps track of where conn was created: true if created here in
	// NewClient, or false if passed with an option. This is important on
	// Shutdown as conn should only be closed if we created it. Otherwise,
	// it is up to the processes that passed conn to close it.
	ourConn bool
	conn    *grpc.ClientConn
	lsc     collogpb.LogsServiceClient
}

// Used for testing.
var newGRPCClientFn = grpc.NewClient

// newClient creates a new gRPC log client.
func newClient(cfg config) (*client, error) {
	c := &client{
		exportTimeout: cfg.timeout.Value,
		requestFunc:   cfg.retryCfg.Value.RequestFunc(retryable),
		conn:          cfg.gRPCConn.Value,
	}

	if len(cfg.headers.Value) > 0 {
		c.metadata = metadata.New(cfg.headers.Value)
	}

	if c.conn == nil {
		// If the caller did not provide a ClientConn when the client was
		// created, create one using the configuration they did provide.
		dialOpts := newGRPCDialOptions(cfg)

		conn, err := newGRPCClientFn(cfg.endpoint.Value, dialOpts...)
		if err != nil {
			return nil, err
		}
		// Keep track that we own the lifecycle of this conn and need to close
		// it on Shutdown.
		c.ourConn = true
		c.conn = conn
	}

	c.lsc = collogpb.NewLogsServiceClient(c.conn)

	return c, nil
}

func newGRPCDialOptions(cfg config) []grpc.DialOption {
	userAgent := "OTel Go OTLP over gRPC logs exporter/" + Version()
	dialOpts := []grpc.DialOption{grpc.WithUserAgent(userAgent)}
	dialOpts = append(dialOpts, cfg.dialOptions.Value...)

	// Convert other grpc configs to the dial options.
	// Service config
	if cfg.serviceConfig.Value != "" {
		dialOpts = append(dialOpts, grpc.WithDefaultServiceConfig(cfg.serviceConfig.Value))
	}
	// Prioritize GRPCCredentials over Insecure (passing both is an error).
	if cfg.gRPCCredentials.Value != nil {
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(cfg.gRPCCredentials.Value))
	} else if cfg.insecure.Value {
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	} else {
		// Default to using the host's root CA.
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(
			credentials.NewTLS(nil),
		))
	}
	// Compression
	if cfg.compression.Value == GzipCompression {
		dialOpts = append(dialOpts, grpc.WithDefaultCallOptions(grpc.UseCompressor(gzip.Name)))
	}
	// Reconnection period
	if cfg.reconnectionPeriod.Value != 0 {
		p := grpc.ConnectParams{
			Backoff:           backoff.DefaultConfig,
			MinConnectTimeout: cfg.reconnectionPeriod.Value,
		}
		dialOpts = append(dialOpts, grpc.WithConnectParams(p))
	}

	return dialOpts
}

// UploadLogs sends proto logs to connected endpoint.
//
// Retryable errors from the server will be handled according to any
// RetryConfig the client was created with.
//
// The otlplog.Exporter synchronizes access to client methods, and
// ensures this is not called after the Exporter is shutdown. Only thing
// to do here is send data.
func (c *client) UploadLogs(ctx context.Context, rl []*logpb.ResourceLogs) error {
	select {
	case <-ctx.Done():
		// Do not upload if the context is already expired.
		return ctx.Err()
	default:
	}

	ctx, cancel := c.exportContext(ctx)
	defer cancel()

	return c.requestFunc(ctx, func(ctx context.Context) error {
		resp, err := c.lsc.Export(ctx, &collogpb.ExportLogsServiceRequest{
			ResourceLogs: rl,
		})
		if resp != nil && resp.PartialSuccess != nil {
			msg := resp.PartialSuccess.GetErrorMessage()
			n := resp.PartialSuccess.GetRejectedLogRecords()
			if n != 0 || msg != "" {
				err := fmt.Errorf("OTLP partial success: %s (%d log records rejected)", msg, n)
				otel.Handle(err)
			}
		}
		// nil is converted to OK.
		if status.Code(err) == codes.OK {
			// Success.
			return nil
		}
		return err
	})
}

// Shutdown shuts down the client, freeing all resources.
//
// Any active connections to a remote endpoint are closed if they were created
// by the client. Any gRPC connection passed during creation using
// WithGRPCConn will not be closed. It is the caller's responsibility to
// handle cleanup of that resource.
//
// The otlplog.Exporter synchronizes access to client methods and
// ensures this is called only once. The only thing that needs to be done
// here is to release any computational resources the client holds.
func (c *client) Shutdown(ctx context.Context) error {
	c.metadata = nil
	c.requestFunc = nil
	c.lsc = nil

	// Release the connection if we created it.
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
		ctx, cancel = context.WithTimeout(parent, c.exportTimeout)
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

type noopClient struct{}

func newNoopClient() *noopClient {
	return &noopClient{}
}

func (c *noopClient) UploadLogs(context.Context, []*logpb.ResourceLogs) error { return nil }

func (c *noopClient) Shutdown(context.Context) error { return nil }

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
