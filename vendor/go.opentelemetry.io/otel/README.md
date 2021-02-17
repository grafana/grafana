# OpenTelemetry-Go

[![Circle CI](https://circleci.com/gh/open-telemetry/opentelemetry-go.svg?style=svg)](https://circleci.com/gh/open-telemetry/opentelemetry-go)
[![PkgGoDev](https://pkg.go.dev/badge/go.opentelemetry.io/otel)](https://pkg.go.dev/go.opentelemetry.io/otel)
[![Go Report Card](https://goreportcard.com/badge/go.opentelemetry.io/otel)](https://goreportcard.com/report/go.opentelemetry.io/otel)
[![Gitter](https://badges.gitter.im/open-telemetry/opentelemetry-go.svg)](https://gitter.im/open-telemetry/opentelemetry-go?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

The Go [OpenTelemetry](https://opentelemetry.io/) implementation.

## Project Status

**Warning**: this project is currently in a pre-GA phase. Backwards
incompatible changes may be introduced in subsequent minor version releases as
we work to track the evolving OpenTelemetry specification and user feedback.

Our progress towards a GA release candidate is tracked in [this project
board](https://github.com/orgs/open-telemetry/projects/5). This release
candidate will follow semantic versioning and will be released with a major
version greater than zero.

Progress and status specific to this repository is tracked in our local
[project boards](https://github.com/open-telemetry/opentelemetry-go/projects)
and
[milestones](https://github.com/open-telemetry/opentelemetry-go/milestones).

## Getting Started

OpenTelemetry's goal is to provide a single set of APIs to capture distributed
traces and metrics from your application and send them to an observability
platform. This project allows you to do just that for applications written in
Go. There are two steps to this process: instrument your application, and
configure an exporter.

### Instrumentation

To start capturing distributed traces and metric events from your application
it first needs to be instrumented. The easiest way to do this is by using an
instrumentation library for your code. Be sure to check out [the officially
supported instrumentation
libraries](https://github.com/open-telemetry/opentelemetry-go-contrib/tree/master/instrumentation).

If you need to extend the telemetry an instrumentation library provides or want
to build your own instrumentation for your application directly you will need
to use the
[go.opentelemetry.io/otel/api](https://pkg.go.dev/go.opentelemetry.io/otel/api)
package. The included [examples](./example/) are a good way to see some
practical uses of this process.

### Export

Now that your application is instrumented to collect telemetry, it needs an
export pipeline to send that telemetry to an observability platform.

You can find officially supported exporters [here](./exporters/) and in the
companion [contrib
repository](https://github.com/open-telemetry/opentelemetry-go-contrib/tree/master/exporters/metric).
Additionally, there are many vendor specific or 3rd party exporters for
OpenTelemetry. These exporters are broken down by
[trace](https://pkg.go.dev/go.opentelemetry.io/otel/sdk/export/trace?tab=importedby)
and
[metric](https://pkg.go.dev/go.opentelemetry.io/otel/sdk/export/metric?tab=importedby)
support.

## Contributing

See the [contributing documentation](CONTRIBUTING.md).
