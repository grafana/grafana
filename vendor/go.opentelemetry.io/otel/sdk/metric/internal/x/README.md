# Experimental Features

The Metric SDK contains features that have not yet stabilized in the OpenTelemetry specification.
These features are added to the OpenTelemetry Go Metric SDK prior to stabilization in the specification so that users can start experimenting with them and provide feedback.

These feature may change in backwards incompatible ways as feedback is applied.
See the [Compatibility and Stability](#compatibility-and-stability) section for more information.

## Features

- [Exemplars](#exemplars)
- [Instrument Enabled](#instrument-enabled)

### Exemplars

A sample of measurements made may be exported directly as a set of exemplars.

This experimental feature can be enabled by setting the `OTEL_GO_X_EXEMPLAR` environment variable.
The value of must be the case-insensitive string of `"true"` to enable the feature.
All other values are ignored.

Exemplar filters are a supported.
The exemplar filter applies to all measurements made.
They filter these measurements, only allowing certain measurements to be passed to the underlying exemplar reservoir.

To change the exemplar filter from the default `"trace_based"` filter set the `OTEL_METRICS_EXEMPLAR_FILTER` environment variable.
The value must be the case-sensitive string defined by the [OpenTelemetry specification].

- `"always_on"`: allows all measurements
- `"always_off"`: denies all measurements
- `"trace_based"`: allows only sampled measurements

All values other than these will result in the default, `"trace_based"`, exemplar filter being used.

[OpenTelemetry specification]: https://github.com/open-telemetry/opentelemetry-specification/blob/a6ca2fd484c9e76fe1d8e1c79c99f08f4745b5ee/specification/configuration/sdk-environment-variables.md#exemplar

#### Examples

Enable exemplars to be exported.

```console
export OTEL_GO_X_EXEMPLAR=true
```

Disable exemplars from being exported.

```console
unset OTEL_GO_X_EXEMPLAR
```

Set the exemplar filter to allow all measurements.

```console
export OTEL_METRICS_EXEMPLAR_FILTER=always_on
```

Set the exemplar filter to deny all measurements.

```console
export OTEL_METRICS_EXEMPLAR_FILTER=always_off
```

Set the exemplar filter to only allow sampled measurements.

```console
export OTEL_METRICS_EXEMPLAR_FILTER=trace_based
```

Revert to the default exemplar filter (`"trace_based"`)

```console
unset OTEL_METRICS_EXEMPLAR_FILTER
```

### Instrument Enabled

To help users avoid performing computationally expensive operations when recording measurements, synchronous instruments provide an `Enabled` method.

#### Examples

The following code shows an example of how to check if an instrument implements the `EnabledInstrument` interface before using the `Enabled` function to avoid doing an expensive computation:

```go
type enabledInstrument interface { Enabled(context.Context) bool }

ctr, err := m.Int64Counter("expensive-counter")
c, ok := ctr.(enabledInstrument)
if !ok || c.Enabled(context.Background()) {
    c.Add(expensiveComputation())
}
```

## Compatibility and Stability

Experimental features do not fall within the scope of the OpenTelemetry Go versioning and stability [policy](../../../../VERSIONING.md).
These features may be removed or modified in successive version releases, including patch versions.

When an experimental feature is promoted to a stable feature, a migration path will be included in the changelog entry of the release.
There is no guarantee that any environment variable feature flags that enabled the experimental feature will be supported by the stable version.
If they are supported, they may be accompanied with a deprecation notice stating a timeline for the removal of that support.
