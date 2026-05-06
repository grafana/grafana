package grpcclient

import (
	otgrpc "github.com/opentracing-contrib/go-grpc"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc"

	"github.com/grafana/dskit/middleware"
)

func Instrument(requestDuration *prometheus.HistogramVec, instrumentationLabelOptions ...middleware.InstrumentationOption) ([]grpc.UnaryClientInterceptor, []grpc.StreamClientInterceptor) {
	var (
		unary  []grpc.UnaryClientInterceptor
		stream []grpc.StreamClientInterceptor
	)
	if opentracing.IsGlobalTracerRegistered() {
		unary = append(unary, otgrpc.OpenTracingClientInterceptor(opentracing.GlobalTracer()))
		stream = append(stream, otgrpc.OpenTracingStreamClientInterceptor(opentracing.GlobalTracer()))
	}
	return append(unary,
			middleware.ClientUserHeaderInterceptor,
			middleware.UnaryClientInstrumentInterceptor(requestDuration, instrumentationLabelOptions...),
		),
		append(stream,
			middleware.StreamClientUserHeaderInterceptor,
			middleware.StreamClientInstrumentInterceptor(requestDuration, instrumentationLabelOptions...),
		)
}
