# OTLP Prometheus Translator

A Go library for converting [OpenTelemetry Protocol (OTLP)](https://opentelemetry.io/docs/specs/otlp/) metric and attribute names to [Prometheus](https://prometheus.io/)-compliant formats. This is an internal library for both Prometheus and Open Telemetry, without any stability guarantees for external usage.

Part of the [Prometheus](https://prometheus.io/) ecosystem, following the [OpenTelemetry to Prometheus compatibility specification](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/compatibility/prometheus_and_openmetrics.md).

## Features

- **Metric Name and Label Translation**: Convert OTLP metric names and attributes to Prometheus-compliant format
- **Unit Handling**: Translate OTLP units to Prometheus unit conventions
- **Type-Aware Suffixes**: Optionally append `_total`, `_ratio` based on metric type
- **Namespace Support**: Add configurable namespace prefixes
- **UTF-8 Support**: Choose between Prometheus legacy scheme compliant metric/label names (`[a-zA-Z0-9:_]`) or untranslated metric/label names
- **Translation Strategy Configuration**: Select a translation strategy with a standard set of strings.

## Installation

```bash
go get github.com/prometheus/otlptranslator
```

## Quick Start

```go
package main

import (
    "fmt"
    "github.com/prometheus/otlptranslator"
)

func main() {
    // Create a metric namer using traditional Prometheus name translation, with suffixes added and UTF-8 disallowed.
    strategy := otlptranslator.UnderscoreEscapingWithSuffixes
    namer := otlptranslator.NewMetricNamer("myapp", strategy)

    // Translate OTLP metric to Prometheus format
    metric := otlptranslator.Metric{
        Name: "http.server.request.duration",
        Unit: "s",
        Type: otlptranslator.MetricTypeHistogram,
    }
    fmt.Println(namer.Build(metric)) // Output: myapp_http_server_request_duration_seconds

    // Translate label names
    labelNamer := otlptranslator.LabelNamer{UTF8Allowed: false}
    fmt.Println(labelNamer.Build("http.method")) // Output: http_method
}
```

## Usage Examples

### Metric Name Translation

```go
namer := otlptranslator.MetricNamer{WithMetricSuffixes: true, UTF8Allowed: false}

// Counter gets _total suffix
counter := otlptranslator.Metric{
    Name: "requests.count", Unit: "1", Type: otlptranslator.MetricTypeMonotonicCounter,
}
fmt.Println(namer.Build(counter)) // requests_count_total

// Gauge with unit conversion
gauge := otlptranslator.Metric{
    Name: "memory.usage", Unit: "By", Type: otlptranslator.MetricTypeGauge,
}
fmt.Println(namer.Build(gauge)) // memory_usage_bytes

// Dimensionless gauge gets _ratio suffix
ratio := otlptranslator.Metric{
    Name: "cpu.utilization", Unit: "1", Type: otlptranslator.MetricTypeGauge,
}
fmt.Println(namer.Build(ratio)) // cpu_utilization_ratio
```

### Label Translation

```go
labelNamer := otlptranslator.LabelNamer{UTF8Allowed: false}

labelNamer.Build("http.method")           // http_method
labelNamer.Build("123invalid")            // key_123invalid
labelNamer.Build("_private")              // key_private
labelNamer.Build("__reserved__")          // __reserved__ (preserved)
labelNamer.Build("label@with$symbols")    // label_with_symbols
```

### Unit Translation

```go
unitNamer := otlptranslator.UnitNamer{UTF8Allowed: false}

unitNamer.Build("s")           // seconds
unitNamer.Build("By")          // bytes
unitNamer.Build("requests/s")  // requests_per_second
unitNamer.Build("1")           // "" (dimensionless)
```

### Configuration Options

```go
// Prometheus-compliant mode - supports [a-zA-Z0-9:_]
compliantNamer := otlptranslator.MetricNamer{UTF8Allowed: false, WithMetricSuffixes: true}

// Transparent pass-through mode, aka "NoTranslation"
utf8Namer := otlptranslator.MetricNamer{UTF8Allowed: true, WithMetricSuffixes: false}
utf8Namer = otlptranslator.NewMetricNamer("", otlpTranslator.NoTranslation)

// With namespace and suffixes
productionNamer := otlptranslator.MetricNamer{
    Namespace:          "myservice",
    WithMetricSuffixes: true,
    UTF8Allowed:        false,
}
```

## License

Licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
