go-metrics
==========

This library provides a `metrics` package which can be used to instrument code,
expose application metrics, and profile runtime performance in a flexible manner.

Current API: [![GoDoc](https://godoc.org/github.com/hashicorp/go-metrics?status.svg)](https://godoc.org/github.com/hashicorp/go-metrics)

Sinks
-----

The `metrics` package makes use of a `MetricSink` interface to support delivery
to any type of backend. Currently the following sinks are provided:

* StatsiteSink : Sinks to a [statsite](https://github.com/statsite/statsite/) instance (TCP)
* StatsdSink: Sinks to a [StatsD](https://github.com/statsd/statsd/) / statsite instance (UDP)
* PrometheusSink: Sinks to a [Prometheus](http://prometheus.io/) metrics endpoint (exposed via HTTP for scrapes)
* InmemSink : Provides in-memory aggregation, can be used to export stats
* FanoutSink : Sinks to multiple sinks. Enables writing to multiple statsite instances for example.
* BlackholeSink : Sinks to nowhere

In addition to the sinks, the `InmemSignal` can be used to catch a signal,
and dump a formatted output of recent metrics. For example, when a process gets
a SIGUSR1, it can dump to stderr recent performance metrics for debugging.

Labels
------

Most metrics do have an equivalent ending with `WithLabels`, such methods
allow to push metrics with labels and use some features of underlying Sinks
(ex: translated into Prometheus labels).

Since some of these labels may increase the cardinality of metrics, the
library allows filtering labels using a allow/block list filtering system
which is global to all metrics.

* If `Config.AllowedLabels` is not nil, then only labels specified in this value will be sent to underlying Sink, otherwise, all labels are sent by default.
* If `Config.BlockedLabels` is not nil, any label specified in this value will not be sent to underlying Sinks.

By default, both `Config.AllowedLabels` and `Config.BlockedLabels` are nil, meaning that
no tags are filtered at all, but it allows a user to globally block some tags with high
cardinality at the application level.

Backwards Compatibility
-----------------------
v0.5.0 of the library renamed the Go module from `github.com/armon/go-metrics` to `github.com/hashicorp/go-metrics`. 
While this did not introduce any breaking changes to the API, the change did subtly break backwards compatibility.

In essence, Go treats a renamed module as entirely distinct and will happily compile both modules into the same binary.
Due to most uses of the go-metrics library involving emitting metrics via the global metrics handler, having two global
metrics handlers could cause a subset of metrics to be effectively lost. As an example, if your application configures
go-metrics exporting via the `armon` namespace, then any metrics sent to go-metrics via the `hashicorp` namespaced module
will never get exported.

Eventually all usage of `armon/go-metrics` should be replaced with usage of `hashicorp/go-metrics`. However, a single
point-in-time coordinated update across all libraries that an application may depend on isn't always feasible. To facilitate migrations, 
a `github.com/hashicorp/go-metrics/compat` package has been introduced. This package and sub-packages are API compatible with
`armon/go-metrics`. Libraries should be updated to use this package for emitting metrics via the global handlers. Internally,
the package will route metrics to either `armon/go-metrics` or `hashicorp/go-metrics`. This is achieved at a global level
within an application via the use of Go build tags.

**Build Tags**
* `armonmetrics` - Using this tag will cause metrics to be routed to `armon/go-metrics`
* `hashicorpmetrics` - Using this tag will cause all metrics to be routed to `hashicorp/go-metrics`

If no build tag is specified, the default behavior is to use `armon/go-metrics`. The overall migration path would be as follows:

1. Upgrade libraries using `armon/go-metrics` to consume `hashicorp/go-metrics/compat` instead.
2. Update library dependencies of applications that use `armon/go-metrics`. 
   * This doesn't need to be one big atomic update but can be slower due to the default behavior remaining unaltered.
   * At this point all metrics will still be emitted to `armon/go-metrics`
3. Update the application to use `hashicorp/go-metrics`
   * Replace all application imports of `github.com/armon/go-metrics` with `github.com/hashicorp/go-metrics`
   * Libraries are unaltered at this stage.
   * Instrument your build system to build with the `hashicorpmetrics` tag.

Your migration is effectively finished and your application is now exclusively using `hashicorp/go-metrics`. A future release of the library
will change the default behavior to use `hashicorp/go-metrics` instead of `armon/go-metrics`. At that point in time, any application that
needs more time before performing the migration must instrument their build system to include the `armonmetrics` tag. A subsequent release
after that will eventually remove the compatibility layer all together. The rough timeline for this will be mid-2025 for changing the default 
behavior and then the end of 2025 for removal of the compatibility layer.


Examples
--------

Here is an example of using the package:

```go
func SlowMethod() {
    // Profiling the runtime of a method
    defer metrics.MeasureSince([]string{"SlowMethod"}, time.Now())
}

// Configure a statsite sink as the global metrics sink
sink, _ := metrics.NewStatsiteSink("statsite:8125")
metrics.NewGlobal(metrics.DefaultConfig("service-name"), sink)

// Emit a Key/Value pair
metrics.EmitKey([]string{"questions", "meaning of life"}, 42)
```

Here is an example of setting up a signal handler:

```go
// Setup the inmem sink and signal handler
inm := metrics.NewInmemSink(10*time.Second, time.Minute)
sig := metrics.DefaultInmemSignal(inm)
metrics.NewGlobal(metrics.DefaultConfig("service-name"), inm)

// Run some code
inm.SetGauge([]string{"foo"}, 42)
inm.EmitKey([]string{"bar"}, 30)

inm.IncrCounter([]string{"baz"}, 42)
inm.IncrCounter([]string{"baz"}, 1)
inm.IncrCounter([]string{"baz"}, 80)

inm.AddSample([]string{"method", "wow"}, 42)
inm.AddSample([]string{"method", "wow"}, 100)
inm.AddSample([]string{"method", "wow"}, 22)

....
```

When a signal comes in, output like the following will be dumped to stderr:

    [2014-01-28 14:57:33.04 -0800 PST][G] 'foo': 42.000
    [2014-01-28 14:57:33.04 -0800 PST][P] 'bar': 30.000
    [2014-01-28 14:57:33.04 -0800 PST][C] 'baz': Count: 3 Min: 1.000 Mean: 41.000 Max: 80.000 Stddev: 39.509
    [2014-01-28 14:57:33.04 -0800 PST][S] 'method.wow': Count: 3 Min: 22.000 Mean: 54.667 Max: 100.000 Stddev: 40.513
