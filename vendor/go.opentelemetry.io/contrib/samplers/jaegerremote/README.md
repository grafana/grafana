# Jaeger Remote Sampler

This package implements [Jaeger remote sampler](https://www.jaegertracing.io/docs/latest/sampling/#remote-sampling).
Remote sampler allows defining sampling configuration for services at the backend, at the granularity of service + endpoint.
When using the Jaeger backend, the sampling configuration can come from two sources:

1. A static configuration file, with the ability to hot-reload it on changes.
2. [Adaptive sampling](https://www.jaegertracing.io/docs/latest/sampling/#adaptive-sampling) where Jaeger backend
   automatically calculates desired sampling probabilities based on the target volume of trace data per service.

## Usage

Configuration in the code:

```go
	jaegerRemoteSampler := jaegerremote.New(
		"your-service-name",
		jaegerremote.WithSamplingServerURL("http://{sampling_service_host_name}:5778/sampling"),
		jaegerremote.WithSamplingRefreshInterval(10*time.Second),
		jaegerremote.WithInitialSampler(trace.TraceIDRatioBased(0.5)),
	)

	tp := trace.NewTracerProvider(
		trace.WithSampler(jaegerRemoteSampler),
		...
	)
	otel.SetTracerProvider(tp)
```

Sampling server:

* Historically, the Jaeger Agent provided the sampling server at `http://{agent_host}:5778/sampling`.
* When not running the Jaeger Agent, the sampling server is also provided by the Jaeger Collector,
  but at a slightly different endpoint: `http://collector_host:14268/api/sampling`.
* The OpenTelemetry Collector can provide the sampling endpoint `http://{otel_collector_host}:5778/sampling`
  by [configuring an extension](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/extension/jaegerremotesampling/README.md).

Notes:

* At this time, the Jaeger Remote Sampler can only be configured in the code,
  configuration via `OTEL_TRACES_SAMPLER=jaeger_sampler` environment variable is not supported.
* Service name must be passed to the constructor. It will be used by the sampler to poll
  the backend for the sampling strategy for this service.
* Both Jaeger Agent and OpenTelemetry Collector implement the Jaeger sampling service endpoint.

## Example

[example/](./example) shows how to host remote sampling strategies using the OpenTelemetry Collector.
The Collector uses the Jaeger receiver to host the strategy file. Note you do not need to run Jaeger to make use of the Jaeger remote sampling protocol. However, you do need Jaeger backend if you want to utilize its adaptive sampling engine that auto-calculates remote sampling strategies.

Run the OpenTelemetry Collector using docker-compose:

```shell
docker-compose up -d
```

You can fetch the strategy file using curl:

```shell
curl 'localhost:5778/sampling?service=foo'
curl 'localhost:5778/sampling?service=myService'
```

Run the Go program.
This program will start with an initial sampling percentage of 50% and tries to fetch the sampling strategies from the OpenTelemetry Collector.
It will print the entire Jaeger remote sampler structure every 10 seconds, this allows you to observe the internal sampler.

```shell
go run .
```
