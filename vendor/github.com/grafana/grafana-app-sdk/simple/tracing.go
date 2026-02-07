package simple

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otelresource "go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type OTelConnType string

const (
	OTelConnTypeGRPC = OTelConnType("grpc")
	OTelConnTypeHTTP = OTelConnType("http")
)

type OpenTelemetryConfig struct {
	Host        string
	Port        int
	ConnType    OTelConnType
	ServiceName string
}

// SetTraceProvider creates a trace.TracerProvider and sets it as the global TracerProvider which is used by
// default for all app-sdk packages unless overridden.
func SetTraceProvider(cfg OpenTelemetryConfig) error {
	var exp trace.SpanExporter
	switch cfg.ConnType {
	case OTelConnTypeGRPC:
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()

		// TODO: replace with grpc.NewClient, before we upgrade to 2.x.
		// nolint: staticcheck
		conn, err := grpc.DialContext(ctx, fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
			// Note the use of insecure transport here. TLS is recommended in production.
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithBlock(),
		)
		if err != nil {
			return fmt.Errorf("failed to create gRPC connection to collector: %w", err)
		}

		// Set up a trace exporter
		exp, err = otlptracegrpc.New(ctx, otlptracegrpc.WithGRPCConn(conn))
		if err != nil {
			return err
		}
	case OTelConnTypeHTTP:
		// TODO: better?
		var err error
		exp, err = otlptracehttp.New(context.Background())
		if err != nil {
			return err
		}
	default:
	}

	// Ensure default SDK resources and the required service name are set.
	r, err := otelresource.New(
		context.Background(),
		otelresource.WithAttributes(semconv.ServiceName(cfg.ServiceName)),
		otelresource.WithProcessRuntimeDescription(),
		otelresource.WithTelemetrySDK(),
	)

	if err != nil {
		return err
	}

	otel.SetTracerProvider(trace.NewTracerProvider(
		trace.WithBatcher(exp),
		trace.WithResource(r),
	))
	return nil
}
