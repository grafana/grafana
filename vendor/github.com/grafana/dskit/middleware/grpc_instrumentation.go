// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/grpc_instrumentation.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package middleware

import (
	"context"
	"errors"
	"io"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/atomic"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/dskit/grpcutil"
	"github.com/grafana/dskit/instrument"
)

func observe(ctx context.Context, hist *prometheus.HistogramVec, method string, err error, duration time.Duration, instrumentLabel instrumentationLabel) {
	labelValues := []string{
		gRPC,
		method,
		instrumentLabel.getInstrumentationLabel(err),
		"false",
		"", // this is a placeholder for the tenant ID
	}
	labelValues = labelValues[:len(labelValues)-1]

	instrument.ObserveWithExemplar(ctx, hist.WithLabelValues(labelValues...), duration.Seconds())
	if cfg, ok := instrumentLabel.perTenantInstrumentation.shouldInstrument(ctx); ok {
		labelValues = append(labelValues, cfg.TenantID)
		if cfg.DurationHistogram {
			instrument.ObserveWithExemplar(ctx, instrumentLabel.perTenantDuration.WithLabelValues(labelValues...), duration.Seconds())
		}
		if cfg.TotalCounter {
			instrumentLabel.perTenantTotal.WithLabelValues(labelValues...).Inc()
		}
	}
}

// UnaryServerInstrumentInterceptor instruments gRPC requests for errors and latency.
func UnaryServerInstrumentInterceptor(hist *prometheus.HistogramVec, instrumentationOptions ...InstrumentationOption) grpc.UnaryServerInterceptor {
	instrumentationLabel := applyInstrumentationOptions(false, instrumentationOptions...)
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		begin := time.Now()
		resp, err := handler(ctx, req)
		observe(ctx, hist, info.FullMethod, err, time.Since(begin), instrumentationLabel)
		return resp, err
	}
}

// StreamServerInstrumentInterceptor instruments gRPC requests for errors and latency.
func StreamServerInstrumentInterceptor(hist *prometheus.HistogramVec, instrumentationOptions ...InstrumentationOption) grpc.StreamServerInterceptor {
	instrumentationLabel := applyInstrumentationOptions(false, instrumentationOptions...)
	return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		begin := time.Now()
		err := handler(srv, ss)
		observe(ss.Context(), hist, info.FullMethod, err, time.Since(begin), instrumentationLabel)
		return err
	}
}

// UnaryClientInstrumentInterceptor records duration of gRPC requests client side.
func UnaryClientInstrumentInterceptor(metric *prometheus.HistogramVec, instrumentationOptions ...InstrumentationOption) grpc.UnaryClientInterceptor {
	// we enforce masking of HTTP statuses.
	instrumentationLabel := applyInstrumentationOptions(true, instrumentationOptions...)
	return func(ctx context.Context, method string, req, resp interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		start := time.Now()
		err := invoker(ctx, method, req, resp, cc, opts...)
		metric.WithLabelValues(method, instrumentationLabel.getInstrumentationLabel(err)).Observe(time.Since(start).Seconds())
		return err
	}
}

// StreamClientInstrumentInterceptor records duration of streaming gRPC requests client side.
func StreamClientInstrumentInterceptor(metric *prometheus.HistogramVec, instrumentationOptions ...InstrumentationOption) grpc.StreamClientInterceptor {
	// we enforce masking of HTTP statuses.
	instrumentationLabel := applyInstrumentationOptions(true, instrumentationOptions...)
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string,
		streamer grpc.Streamer, opts ...grpc.CallOption,
	) (grpc.ClientStream, error) {
		start := time.Now()
		stream, err := streamer(ctx, desc, cc, method, opts...)
		s := &instrumentedClientStream{
			metric:               metric,
			start:                start,
			method:               method,
			serverStreams:        desc.ServerStreams,
			finished:             atomic.NewBool(false),
			finishedChan:         make(chan struct{}),
			stream:               stream,
			instrumentationLabel: instrumentationLabel,
		}
		s.awaitCompletion(ctx)
		return s, err
	}
}

// This implementation is heavily inspired by github.com/opentracing-contrib/go-grpc's openTracingClientStream.
type instrumentedClientStream struct {
	metric               *prometheus.HistogramVec
	start                time.Time
	method               string
	serverStreams        bool
	finished             *atomic.Bool
	finishedChan         chan struct{}
	stream               grpc.ClientStream
	instrumentationLabel instrumentationLabel
}

func (s *instrumentedClientStream) Trailer() metadata.MD {
	return s.stream.Trailer()
}

func (s *instrumentedClientStream) Context() context.Context {
	return s.stream.Context()
}

func (s *instrumentedClientStream) awaitCompletion(ctx context.Context) {
	go func() {
		select {
		case <-s.finishedChan:
			// Stream has finished for another reason, nothing more to do.
		case <-ctx.Done():
			s.finish(ctx.Err())
		}
	}()
}

func (s *instrumentedClientStream) finish(err error) {
	if !s.finished.CompareAndSwap(false, true) {
		return
	}

	close(s.finishedChan)

	s.metric.WithLabelValues(s.method, s.instrumentationLabel.getInstrumentationLabel(err)).Observe(time.Since(s.start).Seconds())
}

func (s *instrumentedClientStream) SendMsg(m interface{}) error {
	err := s.stream.SendMsg(m)
	if err == nil || err == io.EOF {
		// If SendMsg returns io.EOF, the true error is available from RecvMsg, so we shouldn't consider the stream failed at this point.
		return err
	}

	s.finish(err)
	return err
}

func (s *instrumentedClientStream) RecvMsg(m interface{}) error {
	err := s.stream.RecvMsg(m)
	if !s.serverStreams {
		// Unary server: this is the only message we'll receive, so the stream has ended.
		s.finish(err)
		return err
	}

	if err == nil {
		return nil
	}

	if err == io.EOF {
		s.finish(nil)
	} else {
		s.finish(err)
	}

	return err
}

func (s *instrumentedClientStream) Header() (metadata.MD, error) {
	md, err := s.stream.Header()
	if err != nil {
		s.finish(err)
	}
	return md, err
}

func (s *instrumentedClientStream) CloseSend() error {
	err := s.stream.CloseSend()
	if err != nil {
		s.finish(err)
	}
	return err
}

type InstrumentationOption func(*instrumentationLabel)

var (
	// ReportGRPCStatusOption is an InstrumentationOption that is used for enabling gRPC status codes to be used
	// in instrumentation labels.
	ReportGRPCStatusOption InstrumentationOption = func(instrumentationLabel *instrumentationLabel) {
		instrumentationLabel.reportGRPCStatus = true
	}
)

func WithPerTenantInstrumentation(total *prometheus.CounterVec, histogram *prometheus.HistogramVec, f PerTenantCallback) InstrumentationOption {
	return func(instrumentationLabel *instrumentationLabel) {
		instrumentationLabel.perTenantInstrumentation = f
		instrumentationLabel.perTenantDuration = histogram
		instrumentationLabel.perTenantTotal = total
	}
}

func applyInstrumentationOptions(maskHTTPStatuses bool, options ...InstrumentationOption) instrumentationLabel {
	instrumentationLabel := instrumentationLabel{
		maskHTTPStatus: maskHTTPStatuses,
	}
	for _, opt := range options {
		opt(&instrumentationLabel)
	}
	return instrumentationLabel
}

type instrumentationLabel struct {
	reportGRPCStatus         bool
	maskHTTPStatus           bool
	perTenantInstrumentation PerTenantCallback
	perTenantDuration        *prometheus.HistogramVec
	perTenantTotal           *prometheus.CounterVec
}

// getInstrumentationLabel converts an error into an error code string by applying the configurations
// contained in this instrumentationLabel object.
func (i *instrumentationLabel) getInstrumentationLabel(err error) string {
	statusCode := errorToStatusCode(err)
	return i.statusCodeToString(statusCode)
}

func (i *instrumentationLabel) statusCodeToString(statusCode codes.Code) string {
	if isHTTPStatusCode(statusCode) {
		statusFamily := int(statusCode / 100)
		if i.maskHTTPStatus {
			return strconv.Itoa(statusFamily) + "xx"
		}
		return strconv.Itoa(int(statusCode))
	}

	if i.reportGRPCStatus {
		return statusCode.String()
	}

	if statusCode == codes.OK {
		if i.maskHTTPStatus {
			return "2xx"
		}
		return "success"
	}

	if statusCode == codes.Canceled {
		return "cancel"
	}

	return "error"
}

func errorToStatusCode(err error) codes.Code {
	if err == nil {
		return codes.OK
	}

	if errors.Is(err, context.Canceled) {
		return codes.Canceled
	}

	return grpcutil.ErrorToStatusCode(err)
}

func isHTTPStatusCode(statusCode codes.Code) bool {
	return int(statusCode) >= 100 && int(statusCode) < 600
}
