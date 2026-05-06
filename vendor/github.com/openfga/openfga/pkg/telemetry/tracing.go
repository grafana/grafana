// Package telemetry contains code that emits telemetry (logging, metrics, tracing).
package telemetry

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
)

type TracerOption func(d *customTracer)

func WithOTLPEndpoint(endpoint string) TracerOption {
	return func(d *customTracer) {
		d.endpoint = endpoint
	}
}

func WithOTLPInsecure() TracerOption {
	return func(d *customTracer) {
		d.insecure = true
	}
}

func WithSamplingRatio(samplingRatio float64) TracerOption {
	return func(d *customTracer) {
		d.samplingRatio = samplingRatio
	}
}

func WithAttributes(attrs ...attribute.KeyValue) TracerOption {
	return func(d *customTracer) {
		d.attributes = attrs
	}
}

type customTracer struct {
	endpoint   string
	insecure   bool
	attributes []attribute.KeyValue

	samplingRatio float64
}

func MustNewTracerProvider(opts ...TracerOption) *sdktrace.TracerProvider {
	tracer := &customTracer{
		endpoint:      "",
		attributes:    []attribute.KeyValue{},
		samplingRatio: 0,
	}

	for _, opt := range opts {
		opt(tracer)
	}

	baseRes, err := resource.Merge(
		resource.Default(),
		resource.NewSchemaless(tracer.attributes...))
	if err != nil {
		panic(err)
	}

	res, err := resource.Merge(baseRes, resource.Environment())

	if err != nil {
		panic(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	options := []otlptracegrpc.Option{
		otlptracegrpc.WithEndpoint(tracer.endpoint),
		otlptracegrpc.WithDialOption(
			// nolint:staticcheck // ignoring gRPC deprecations
			grpc.WithBlock(),
		),
	}

	if tracer.insecure {
		options = append(options, otlptracegrpc.WithInsecure())
	}

	var exp sdktrace.SpanExporter
	exp, err = otlptracegrpc.New(ctx, options...)
	if err != nil {
		panic(fmt.Sprintf("failed to establish a connection with the otlp exporter: %v", err))
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.TraceIDRatioBased(tracer.samplingRatio)),
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(sdktrace.NewBatchSpanProcessor(exp)),
	)

	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))

	otel.SetTracerProvider(tp)

	return tp
}

// TraceError marks the span as having an error, except if the error is context.Canceled,
// in which case it does nothing.
func TraceError(span trace.Span, err error) {
	if errors.Is(err, context.Canceled) {
		return
	}
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}
