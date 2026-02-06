# Prometheus Benchmarks

Using the Prometheus bridge and the OTLP exporter adds roughly ~50% to the CPU and memory overhead of an application compared to serving a Prometheus HTTP endpoint for metrics.

However, unless the application has extremely high cardinality for metrics, this is unlikely to represent a significant amount of additional overhead because the base-line memory consumption of client libraries is relatively low. For an application with 30k timeseries (which is a very high number), the additional overhead is about 50MB and about 0.1 CPU cores.

The bridge is particularly useful if you are exporting to an OpenTelemetry Collector, since the OTLP receiver is much more efficient than the Prometheus receiver. For the same 30k timeseries, the Prometheus receiver uses 3x the amount of memory, and 20x the amount of CPU. In concrete numbers, this is an additional 228 MB of memory, and 0.57 CPU cores.

For an application using the Prometheus client library, and exporting to an OpenTelemetry collector, the total CPU usage is 55% lower and total memory usage is 45% lower when using the bridge and the OTLP receiver compared to using a Prometheus endpoint and the collector's Prometheus receiver.

## Methods and Results

The sample application uses the Prometheus client library, and defines one histogram with the default 12 buckets, one counter, and one gauge. Each metric has a single label with 10k values, which are observed every second. See the [sample application's source](https://github.com/dashpole/client_golang/pull/1).

The memory usage of the sample application is measured using the `/memory/classes/total:bytes` metric from the go runtime. The CPU usage of the application is measured using `top`. The CPU and memory usage of the collector are measured using `docker stats`. It was built using v0.50.0 of the bridge, v1.25.0 of the OpenTelemetry API and SDK, and v1.19.0 of the Prometheus client.

The OpenTelemetry Collector is configured with only the OTLP or Prometheus receiver, and the debug (logging) exporter with only the basic output. The benchmark uses the Contrib distribution at v0.97.0.

| Experiment | Memory Usage (MB) | CPU Usage (millicores) |
|---|---|---|
| App w/ Prometheus Export | 94 | 220 |
| App w/ Bridge + OTLP Export | 140 | 330 |
| Collector w/ Prometheus Receiver | 320 | 600  |
| Collector w/ OTLP Receiver | 92  | 30 |
