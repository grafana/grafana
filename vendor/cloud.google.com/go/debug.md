# Logging, Debugging and Telemetry

**Warning: The OpenCensus project is obsolete and was archived on July 31st,
2023.** This means that any security vulnerabilities that are found will not be
patched. We recommend that you migrate from OpenCensus tracing to
OpenTelemetry, the successor project. See [OpenCensus](#opencensus) below for
details.

Logging, debugging and telemetry all capture data that can be used for
troubleshooting. Logging records specific events and transactions. Debugging
exposes values for immediate analysis. Telemetry is suitable for production use
and can serve both logging and monitoring purposes. Telemetry tracing follows
requests through a system to provide a view of component interactions. Telemetry
metrics collects data for significant performance indicators, offering insights
into a system's health.

## Logging and debugging

While working with the Go Client Libraries you may run into some situations
where you need a deeper level of understanding about what is going on in order
to solve your problem. Here are some tips and tricks that you can use in these
cases. *Note* that many of the tips in this section will have a performance
impact and are therefore not recommended for sustained production use. Use these
tips locally or in production for a *limited time* to help get a better
understanding of what is going on.

### Request/Response Logging

To enable logging for all outgoing requests from the Go Client Libraries, set
the environment variable `GOOGLE_SDK_GO_LOGGING_LEVEL` to `debug`. Currently all
logging is at the debug level, but this is likely to change in the future.

*Caution*: Debug level logging should only be used in a limited manner. Debug
level logs contain sensitive information, including headers, request/response
payloads, and authentication tokens. Additionally, enabling logging at this
level will have a minor performance impact.

### HTTP based clients

All of our auto-generated clients have a constructor to create a client that
uses HTTP/JSON instead of gRPC. Additionally a couple of our hand-written
clients like Storage and Bigquery are also HTTP based. Here are some tips for
debugging these clients.

#### Try setting Go's HTTP debug variable

Try setting the following environment variable for verbose Go HTTP logging:
GODEBUG=http2debug=1. To read more about this feature please see the godoc for
[net/http](https://pkg.go.dev/net/http).

*WARNING*: Enabling this debug variable will log headers and payloads which may
contain private information.

### gRPC based clients

#### Try setting grpc-go's debug variables

Try setting the following environment variables for grpc-go:
`GRPC_GO_LOG_VERBOSITY_LEVEL=99` `GRPC_GO_LOG_SEVERITY_LEVEL=info`. These are
good for diagnosing connection level failures. For more information please see
[grpc-go's debug documentation](https://pkg.go.dev/google.golang.org/grpc/examples/features/debugging#section-readme).

## Telemetry

**Warning: The OpenCensus project is obsolete and was archived on July 31st,
2023.** This means that any security vulnerabilities that are found will not be
patched. We recommend that you migrate from OpenCensus tracing to
OpenTelemetry, the successor project. The default experimental tracing support
for OpenCensus is now deprecated in the Google Cloud client libraries for Go.
See [OpenCensus](#opencensus) below for details.

The Google Cloud client libraries for Go now use the
[OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/) project.
The transition from OpenCensus to OpenTelemetry is covered in the following
sections.

### Tracing (experimental)

Apart from spans created by underlying libraries such as gRPC, Google Cloud Go
generated clients do not create spans. Only the spans created by following
hand-written clients are in scope for the discussion in this section:

* [cloud.google.com/go/bigquery](https://pkg.go.dev/cloud.google.com/go/bigquery)
* [cloud.google.com/go/bigtable](https://pkg.go.dev/cloud.google.com/go/bigtable)
* [cloud.google.com/go/datastore](https://pkg.go.dev/cloud.google.com/go/datastore)
* [cloud.google.com/go/firestore](https://pkg.go.dev/cloud.google.com/go/firestore)
* [cloud.google.com/go/spanner](https://pkg.go.dev/cloud.google.com/go/spanner)
* [cloud.google.com/go/storage](https://pkg.go.dev/cloud.google.com/go/storage)

Currently, the spans created by these clients are for OpenTelemetry. OpenCensus
users are urged to transition to OpenTelemetry as soon as possible, as explained
in the next section.

#### OpenCensus

**Warning: The OpenCensus project is obsolete and was archived on July 31st,
2023.** This means that any security vulnerabilities that are found will not be
patched. We recommend that you migrate from OpenCensus tracing to
OpenTelemetry, the successor project. The default experimental tracing support
for OpenCensus is now deprecated in the Google Cloud client libraries for Go.

Using the [OpenTelemetry-Go - OpenCensus Bridge](https://pkg.go.dev/go.opentelemetry.io/otel/bridge/opencensus), you can immediately begin exporting your traces with OpenTelemetry, even while
dependencies of your application remain instrumented with OpenCensus. If you do
not use the bridge, you will need to migrate your entire application and all of
its instrumented dependencies at once.  For simple applications, this may be
possible, but we expect the bridge to be helpful if multiple libraries with
instrumentation are used.

On May 29, 2024, six months after the
[release](https://github.com/googleapis/google-cloud-go/releases/tag/v0.111.0)
of experimental, opt-in support for OpenTelemetry tracing, the default tracing
support in the clients above was changed from OpenCensus to OpenTelemetry, and
the experimental OpenCensus support was marked as deprecated.

On December 2nd, 2024, one year after the release of OpenTelemetry support, the
experimental and deprecated support for OpenCensus tracing was removed.

Please note that all Google Cloud Go clients currently provide experimental
support for the propagation of both OpenCensus and OpenTelemetry trace context
to their receiving endpoints. The experimental support for OpenCensus trace
context propagation will be removed soon.

Please refer to the following resources:

* [Sunsetting OpenCensus](https://opentelemetry.io/blog/2023/sunsetting-opencensus/)
* [OpenTelemetry-Go - OpenCensus Bridge](https://pkg.go.dev/go.opentelemetry.io/otel/bridge/opencensus)

#### OpenTelemetry

The default experimental tracing support for OpenCensus is now deprecated in the
Google Cloud client libraries for Go.

On May 29, 2024, the default experimental tracing support in the Google Cloud
client libraries for Go was changed from OpenCensus to OpenTelemetry.

**Warning: OpenTelemetry-Go ensures
[compatibility](https://github.com/open-telemetry/opentelemetry-go/tree/main?tab=readme-ov-file#compatibility)
with ONLY the current supported versions of the [Go
language](https://go.dev/doc/devel/release#policy). This support may be narrower
than the support that has been offered historically by the Go Client Libraries.
Ensure that your Go runtime version is supported by the OpenTelemetry-Go
[compatibility](https://github.com/open-telemetry/opentelemetry-go/tree/main?tab=readme-ov-file#compatibility)
policy before enabling OpenTelemetry instrumentation.**

Please refer to the following resources:

* [What is OpenTelemetry?](https://opentelemetry.io/docs/what-is-opentelemetry/)
* [Cloud Trace - Go and OpenTelemetry](https://cloud.google.com/trace/docs/setup/go-ot)
* On GCE, [use Ops Agent and OpenTelemetry](https://cloud.google.com/trace/docs/otlp)

##### Configuring the OpenTelemetry-Go - OpenCensus Bridge

To configure the OpenCensus bridge with OpenTelemetry and Cloud Trace:

```go
import (
    "context"
    "log"
    "os"
    texporter "github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/trace"
    octrace "go.opencensus.io/trace"
    "go.opentelemetry.io/contrib/detectors/gcp"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/bridge/opencensus"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.7.0"
)

func main() {
    // Create exporter.
    ctx := context.Background()
    projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
    exporter, err := texporter.New(texporter.WithProjectID(projectID))
    if err != nil {
        log.Fatalf("texporter.New: %v", err)
    }
    // Identify your application using resource detection
    res, err := resource.New(ctx,
        // Use the GCP resource detector to detect information about the GCP platform
        resource.WithDetectors(gcp.NewDetector()),
        // Keep the default detectors
        resource.WithTelemetrySDK(),
        // Add your own custom attributes to identify your application
        resource.WithAttributes(
            semconv.ServiceNameKey.String("my-application"),
        ),
    )
    if err != nil {
        log.Fatalf("resource.New: %v", err)
    }
    // Create trace provider with the exporter.
    //
    // By default it uses AlwaysSample() which samples all traces.
    // In a production environment or high QPS setup please use
    // probabilistic sampling.
    // Example:
    //   tp := sdktrace.NewTracerProvider(sdktrace.WithSampler(sdktrace.TraceIDRatioBased(0.0001)), ...)
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(res),
    )
    defer tp.Shutdown(ctx) // flushes any pending spans, and closes connections.
    otel.SetTracerProvider(tp)
    tracer := otel.GetTracerProvider().Tracer("example.com/trace")
    // Configure the OpenCensus tracer to use the bridge.
    octrace.DefaultTracer = opencensus.NewTracer(tracer)
    // Use otel tracer to create spans...
}

```

##### Configuring context propagation

In order to pass options to OpenTelemetry trace context propagation, follow the
appropriate example for the client's underlying transport.

###### Passing options in HTTP-based clients

```go
ctx := context.Background()
trans, err := htransport.NewTransport(ctx,
    http.DefaultTransport,
    option.WithScopes(storage.ScopeFullControl),
)
if err != nil {
    log.Fatal(err)
}
// An example of passing options to the otelhttp.Transport.
otelOpts := otelhttp.WithFilter(func(r *http.Request) bool {
    return r.URL.Path != "/ping"
})
hc := &http.Client{
    Transport: otelhttp.NewTransport(trans, otelOpts),
}
client, err := storage.NewClient(ctx, option.WithHTTPClient(hc))
```

Note that scopes must be set manually in this user-configured solution.

######  Passing options in gRPC-based clients

```go
projectID := "..."
ctx := context.Background()

// An example of passing options to grpc.WithStatsHandler.
otelOpts := otelgrpc.WithMessageEvents(otelgrpc.ReceivedEvents)
dialOpts := grpc.WithStatsHandler(otelgrpc.NewClientHandler(otelOpts))

ctx := context.Background()
c, err := datastore.NewClient(ctx, projectID, option.WithGRPCDialOption(dialOpts))
if err != nil {
    log.Fatal(err)
}
defer c.Close()
```

### Metrics (experimental)

The generated clients do not create metrics. Only the following hand-written
clients create experimental OpenCensus metrics:

* [cloud.google.com/go/bigquery](https://pkg.go.dev/cloud.google.com/go/bigquery)
* [cloud.google.com/go/pubsub](https://pkg.go.dev/cloud.google.com/go/pubsub)
* [cloud.google.com/go/spanner](https://pkg.go.dev/cloud.google.com/go/spanner)

#### OpenTelemetry

The transition of the experimental metrics in the clients above from OpenCensus
to OpenTelemetry is still TBD.