# Collector Feature Gates

This package provides a mechanism that allows operators to enable and disable
experimental or transitional features at deployment time. These flags should
be able to govern the behavior of the application starting as early as possible
and should be available to every component such that decisions may be made
based on flags at the component level.

## Usage

Feature gates must be defined and registered with the global registry in
an `init()` function.  This makes the `Gate` available to be configured and 
queried with the defined [`Stage`](#feature-lifecycle) default value.
A `Gate` can have a list of associated issues that allow users to refer to
the issue and report any additional problems or understand the context of the `Gate`.
Once a `Gate` has been marked as `Stable`, it must have a `RemovalVersion` set.

```go
var myFeatureGate = featuregate.GlobalRegistry().MustRegister(
	"namespaced.uniqueIdentifier",
	featuregate.Stable,
    featuregate.WithRegisterFromVersion("v0.65.0")
	featuregate.WithRegisterDescription("A brief description of what the gate controls"),
	featuregate.WithRegisterReferenceURL("https://github.com/open-telemetry/opentelemetry-collector/issues/6167"),
	featuregate.WithRegisterToVersion("v0.70.0"))
```

The status of the gate may later be checked by interrogating the global 
feature gate registry:

```go
if myFeatureGate.IsEnabled() {
	setupNewFeature()
}
```

Note that querying the registry takes a read lock and accesses a map, so it 
should be done once and the result cached for local use if repeated checks 
are required.  Avoid querying the registry in a loop.

## Controlling Gates

Feature gates can be enabled or disabled via the CLI, with the 
`--feature-gates` flag. When using the CLI flag, gate 
identifiers must be presented as a comma-delimited list. Gate identifiers
prefixed with `-` will disable the gate and prefixing with `+` or with no
prefix will enable the gate.

```shell
otelcol --config=config.yaml --feature-gates=gate1,-gate2,+gate3
```

This will enable `gate1` and `gate3` and disable `gate2`.

## Feature Lifecycle

Features controlled by a `Gate` should follow a three-stage lifecycle, 
modeled after the [system used by Kubernetes](https://kubernetes.io/docs/reference/command-line-tools-reference/feature-gates/#feature-stages):

1. An `alpha` stage where the feature is disabled by default and must be enabled 
   through a `Gate`.
2. A `beta` stage where the feature has been well tested and is enabled by 
   default but can be disabled through a `Gate`.
3. A generally available or `stable` stage where the feature is permanently enabled. At this stage
   the gate should no longer be explicitly used. Disabling the gate will produce an error and
   explicitly enabling will produce a warning log.
4. A `stable` feature gate will be removed in the version specified by its `ToVersion` value.

Features that prove unworkable in the `alpha` stage may be discontinued 
without proceeding to the `beta` stage. Instead, they will proceed to the
`deprecated` stage, which will feature is permanently disabled. A feature gate will
be removed once it has been `deprecated` for at least 2 releases of the collector.

Features that make it to the `beta` stage are intended to reach general availability but may still be discontinued.
If, after wider use, it is determined that the gate should be discontinued it will be reverted to the `alpha` stage
for 2 releases and then proceed to the `deprecated` stage. If instead it is ready for general availability it will
proceed to the `stable` stage.
