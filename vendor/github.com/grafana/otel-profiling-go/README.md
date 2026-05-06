# Profiling Instrumentation for OpenTelemetry Go SDK

**NOTE**: This is an experimental package -- and will be officially supported in future versions of Pyroscope

The package provides means to integrate tracing with profiling. More specifically, a `TracerProvider` implementation,
that annotates profiling data with span IDs: when a new trace span emerges, the tracer adds a `span_id` [pprof tag](https://github.com/google/pprof/blob/master/doc/README.md#tag-filtering)
that points to the span. This makes it possible to filter out a profile of a particular trace span in [Pyroscope](https://pyroscope.io).

Note that the module does not control `pprof` profiler itself – it still needs to be started for profiles to be
collected. This can be done either via `runtime/pprof` package, or using the [Pyroscope client](https://github.com/grafana/pyroscope-go).

By default, only the root span gets labeled (the first span created locally): such spans are marked with the
`pyroscope.profile.id` attribute set to the span ID. Please note that presence of the attribute does not necessarily
indicate that the span has a profile: stack trace samples might not be collected, if the utilized CPU time is
less than the sample interval (10ms).

Limitations:
- Only CPU profiling is fully supported at the moment.

### Trace spans profiles

To start profiling trace spans, you need to include our go module in your app:

```
go get github.com/grafana/otel-profiling-go
```

Then add the pyroscope tracer provider:

```go
package main

import (
	otelpyroscope "github.com/grafana/otel-profiling-go"
	"github.com/grafana/pyroscope-go"
)

func main() {
	// Initialize your tracer provider as usual.
	tp := initTracer()

	// Wrap it with otelpyroscope tracer provider.
	otel.SetTracerProvider(otelpyroscope.NewTracerProvider(tp))

	// If you're using Pyroscope Go SDK, initialize pyroscope profiler.
	_, _ = pyroscope.Start(pyroscope.Config{
		ApplicationName: "my-service",
		ServerAddress:   "http://localhost:4040",
	})

	// Your code goes here.
}
```

Tracing integration is supported in pull mode as well: if you scrape profiles using Grafana Agent, you should
make sure that the pyroscope `service_name` label matches `service.name` attribute specified in the OTel SDK configuration.
Please refer to the [Grafana Agent](https://grafana.com/docs/pyroscope/latest/configure-client/grafana-agent/go_pull/)
documentation to learn more.

## Example

You can find a complete example setup with Grafana Tempo in the [Pyroscope repository](https://github.com/grafana/pyroscope/tree/main/examples/tracing/tempo).

![image](https://github.com/grafana/otel-profiling-go/assets/12090599/31e33cd1-818b-4116-b952-c9ec7b1fb593)
