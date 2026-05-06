Changes by Version
==================

2.30.0 (2021-12-07)
-------------------
- Add deprecation notice -- Yuri Shkuro
- Use public struct for tracer options to document initialization better (#605) -- Yuri Shkuro
- Remove redundant newline in NewReporter init message (#603) -- wwade
- [zipkin] Encode span IDs as full 16-hex strings #601 -- Nathan
- [docs] Replace godoc.org with pkg.go.dev (#591) -- Aaron Jheng
- Remove outdated reference to Zipkin model. -- Yuri Shkuro
- Move thrift compilation to a script (#590) -- Aaron Jheng
- Document JAEGER_TRACEID_128BIT env var -- Yuri Shkuro

2.29.1 (2021-05-24)
-------------------
- Remove dependency on "testing" in "thrift" (#586) -- @yurishkuro


2.29.0 (2021-05-20)
-------------------
- Update vendored thrift to 0.14.1 (#584) -- @nhatthm


2.28.0 (2021-04-30)
-------------------
- HTTPSamplingStrategyFetcher: Use http client with 10 second timeout (#578) -- Joe Elliott


2.27.0 (2021-04-19)
-------------------
- Don't override HTTP Reporter batch size to 1; default to 100, user can override (#571) -- R. Aidan Campbell


2.26.0 (2021-04-16)
-------------------
- Delete a baggage item when value is blank (#562) -- evan.kim
- Trim baggage key when parsing (#566) -- sicong.huang
- feat: extend configuration to support custom randomNumber func (#555) -- NemoO_o
- Support JAEGER_TRACEID_128BIT env var (#547) -- Yuri Shkuro
- Additional context protections (#544) -- Joe Elliott
- Lock RemotelyControlledSampler.sampler on callbacks (#543) -- Dima
- Upgrade build to Go 1.15 (#539) -- Yuri Shkuro
- Upgrade to jaeger-lib@2.3.0 to fix broken codahale/hdrhistogram dependency (#537) -- Yuri Shkuro
- Prefix TraceID/SpanID.String() with zeroes (#533) -- Lukas Vogel
- Upgrade to OpenTracing Go 1.2 (#525) -- Yuri Shkuro


2.25.0 (2020-07-13)
-------------------
## Breaking changes
- [feat] Periodically re-resolve UDP server address, with opt-out (#520) -- Trevor Foster

  The re-resolving of UDP address is now enabled by default, to make the client more robust in Kubernetes deployments.
  The old resolve-once behavior can be restored by setting DisableAttemptReconnecting=true in the Configuration struct,
  or via JAEGER_REPORTER_ATTEMPT_RECONNECTING_DISABLED=true environment variable.

## Bug fixes
- Do not add invalid context to references (#521) -- Yuri Shkuro


2.24.0 (2020-06-14)
-------------------
- Mention FromEnv() in the README, docs, and examples (#518) -- Martin Lercher
- Serialize access to RemotelyControlledSampler.sampler (#515) -- Dima
- Override reporter config only when agent host/port is set in env (#513) -- ilylia
- Converge on JAEGER_SAMPLING_ENDPOINT env variable (#511) -- Eundoo Song


2.23.1 (2020-04-28)
-------------------
- Fix regression by handling nil logger correctly ([#507](https://github.com/jaegertracing/jaeger-client-go/pull/507)) -- Prithvi Raj


2.23.0 (2020-04-22)
-------------------

- Add the ability to log all span interactions at a new debug log level([#502](https://github.com/jaegertracing/jaeger-client-go/pull/502), [#503](https://github.com/jaegertracing/jaeger-client-go/pull/503), [#504](https://github.com/jaegertracing/jaeger-client-go/pull/504)) -- Prithvi Raj
- Chore (docs): fix typos ([#496](https://github.com/jaegertracing/jaeger-client-go/pull/496), [#498](https://github.com/jaegertracing/jaeger-client-go/pull/498)) -- Febrian Setianto and Ivan Babrou
- Unset highest bit of traceID in probabilistic sampler ([#490](https://github.com/jaegertracing/jaeger-client-go/pull/490)) -- Sokolov Yura

2.22.1 (2020-01-16)
-------------------

- Increase UDP batch overhead to account for data loss metrics ([#488](https://github.com/jaegertracing/jaeger-client-go/pull/488)) -- Yuri Shkuro


2.22.0 (2020-01-15)
-------------------

- Report data loss stats to Jaeger backend ([#482](https://github.com/jaegertracing/jaeger-client-go/pull/482)) -- Yuri Shkuro
- Add limit on log records per span ([#483](https://github.com/jaegertracing/jaeger-client-go/pull/483)) -- Sokolov Yura


2.21.1 (2019-12-20)
-------------------

- Update version correctly.


2.21.0 (2019-12-20)
-------------------

- Clarify reporting error logs ([#469](https://github.com/jaegertracing/jaeger-client-go/pull/469)) -- Yuri Shkuro
- Do not strip leading zeros from trace IDs ([#472](https://github.com/jaegertracing/jaeger-client-go/pull/472)) -- Yuri Shkuro
- Chore (docs): fixed a couple of typos ([#475](https://github.com/jaegertracing/jaeger-client-go/pull/475)) -- Marc Bramaud
- Support custom HTTP headers when reporting spans over HTTP ([#479](https://github.com/jaegertracing/jaeger-client-go/pull/479)) -- Albert Teoh


2.20.1 (2019-11-08)
-------------------

Minor patch via https://github.com/jaegertracing/jaeger-client-go/pull/468

- Make `AdaptiveSamplerUpdater` usable with default values; Resolves #467
- Create `OperationNameLateBinding` sampler option and config option
- Make `SamplerOptions` var of public type, so that its functions are discoverable via godoc


2.20.0 (2019-11-06)
-------------------

## New Features

- Allow all in-process spans of a trace to share sampling state (#443) -- Prithvi Raj

  Sampling state is shared between all spans of the trace that are still in memory.
  This allows implementation of delayed sampling decisions (see below).

- Support delayed sampling decisions (#449) -- Yuri Shkuro

  This is a large structural change to how the samplers work.
  It allows some samplers to be executed multiple times on different
  span events (like setting a tag) and make a positive sampling decision
  later in the span life cycle, or even based on children spans.
  See [README](./README.md#delayed-sampling) for more details.

  There is a related minor change in behavior of the adaptive (per-operation) sampler,
  which will no longer re-sample the trace when `span.SetOperation()` is called, i.e. the
  operation used to make the sampling decision is always the one provided at span creation.

- Add experimental tag matching sampler (#452) -- Yuri Shkuro

  A sampler that can sample a trace based on a certain tag added to the root
  span or one of its local (in-process) children. The sampler can be used with
  another experimental `PrioritySampler` that allows multiple samplers to try
  to make a sampling decision, in a certain priority order.

- [log/zap] Report whether a trace was sampled (#445) -- Abhinav Gupta
- Allow config.FromEnv() to enrich an existing config object (#436) -- Vineeth Reddy

## Minor patches

- Expose Sampler on Tracer and accept sampler options via Configuration (#460) -- Yuri Shkuro
- Fix github.com/uber-go/atomic import (#464) -- Yuri Shkuro
- Add nodejs to crossdock tests (#441) -- Bhavin Gandhi
- Bump Go compiler version to 1.13 (#453) -- Yuri Shkuro

2.19.0 (2019-09-23)
-------------------

- Upgrade jaeger-lib to 2.2 and unpin Prom client (#434) -- Yuri Shkuro


2.18.1 (2019-09-16)
-------------------

- Remove go.mod / go.sum that interfere with `go get` (#432)


2.18.0 (2019-09-09)
-------------------

- Add option "noDebugFlagOnForcedSampling" for tracer initialization [resolves #422] (#423) <Jun Guo>


2.17.0 (2019-08-30)
-------------------

- Add a flag for firehose mode (#419) <Prithvi Raj>
- Default sampling server URL to agent (#414) <Bryan Boreham>
- Update default sampling rate when sampling strategy is refreshed (#413) <Bryan Boreham>
- Support "Self" Span Reference (#411) <dm03514>
- Don't complain about blank service name if tracing is Disabled (#410) Yuri <Shkuro>
- Use IP address from tag if exist (#402) <NikoKVCS>
- Expose span data to custom reporters [fixes #394] (#399) <Curtis Allen>
- Fix the span allocation in the pool (#381) <Dmitry Ponomarev>


2.16.0 (2019-03-24)
-------------------

- Add baggage to B3 codec (#319) <Pavol Loffay>
- Add support for 128bit trace ids to zipkin thrift spans. (#378) <Douglas Reid>
- Update zipkin propagation logic to support 128bit traceIDs (#373) <Douglas Reid>
- Accept "true" for the x-b3-sampled header (#356) <Adrian Bogatu>

- Allow setting of PoolSpans from Config object (#322) <Matthew Pound>
- Make propagators public to allow wrapping (#379) <Ivan Babrou>
- Change default metric namespace to use relevant separator for the metric backend (#364) <Gary Brown>
- Change metrics prefix to jaeger_tracer and add descriptions (#346) <Gary Brown>
- Bump OpenTracing to ^1.1.x (#383) <Yuri Shkuro>
- Upgrade jaeger-lib to v2.0.0 (#359) <Gary Brown>
- Avoid defer when generating random number (#358) <Gary Brown>
- Use a pool of rand.Source to reduce lock contention when creating span ids (#357) <Gary Brown>
- Make JAEGER_ENDPOINT take priority over JAEGER_AGENT_XXX (#342) <Eundoo Song>


2.15.0 (2018-10-10)
-------------------

- Fix FollowsFrom spans ignoring baggage/debug header from dummy parent context (#313) <Zvi Cahana>
- Make maximum annotation length configurable in tracer options (#318) <Eric Chang>
- Support more environment variables in configuration (#323) <Daneyon Hansen>
- Print error on Sampler Query failure (#328) <Goutham Veeramachaneni>
- Add an HTTPOption to support custom http.RoundTripper (#333) <Michael Puncel>
- Return an error when an HTTP error code is seen in zipkin HTTP transport (#331) <Michael Puncel>


2.14.0 (2018-04-30)
-------------------

- Support throttling for debug traces (#274) <Isaac Hier>
- Remove dependency on Apache Thrift (#303) <Yuri Shkuro>
- Remove dependency on tchannel  (#295) (#294) <Yuri Shkuro>
- Test with Go 1.9 (#298) <Yuri Shkuro>


2.13.0 (2018-04-15)
-------------------

- Use value receiver for config.NewTracer() (#283) <Yuri Shkuro>
- Lock span during jaeger thrift conversion (#273) <Won Jun Jang>
- Fix the RemotelyControlledSampler so that it terminates go-routine on Close() (#260) <Scott Kidder> <Yuri Shkuro>
- Added support for client configuration via env vars (#275) <Juraci Paixão Kröhling>
- Allow overriding sampler in the Config (#270) <Mike Kabischev>


2.12.0 (2018-03-14)
-------------------

- Use lock when retrieving span.Context() (#268)
- Add Configuration support for custom Injector and Extractor (#263) <Martin Liu>


2.11.2 (2018-01-12)
-------------------

- Add Gopkg.toml to allow using the lib with `dep`


2.11.1 (2018-01-03)
-------------------

- Do not enqueue spans after Reporter is closed (#235, #245)
- Change default flush interval to 1sec (#243)


2.11.0 (2017-11-27)
-------------------

- Normalize metric names and tags to be compatible with Prometheus (#222)


2.10.0 (2017-11-14)
-------------------

- Support custom tracing headers (#176)
- Add BaggageRestrictionManager (#178) and RemoteBaggageRestrictionManager (#182)
- Do not coerce baggage keys to lower case (#196)
- Log span name when span cannot be reported (#198)
- Add option to enable gen128Bit for tracer (#193) and allow custom generator for high bits of trace ID (#219)


2.9.0 (2017-07-29)
------------------

- Pin thrift <= 0.10 (#179)
- Introduce a parallel interface ContribObserver (#159)


2.8.0 (2017-07-05)
------------------

- Drop `jaeger.` prefix from `jaeger.hostname` process-level tag
- Add options to set tracer tags


2.7.0 (2017-06-21)
------------------

- Fix rate limiter balance [#135](https://github.com/uber/jaeger-client-go/pull/135) [#140](https://github.com/uber/jaeger-client-go/pull/140)
- Default client to send Jaeger.thrift [#147](https://github.com/uber/jaeger-client-go/pull/147)
- Save baggage in span [#153](https://github.com/uber/jaeger-client-go/pull/153)
- Move reporter.queueLength to the top of the struct to guarantee 64bit alignment [#158](https://github.com/uber/jaeger-client-go/pull/158)
- Support HTTP transport with jaeger.thrift [#161](https://github.com/uber/jaeger-client-go/pull/161)


2.6.0 (2017-03-28)
------------------

- Add config option to initialize RPC Metrics feature


2.5.0 (2017-03-23)
------------------

- Split request latency metric by success/failure [#123](https://github.com/uber/jaeger-client-go/pull/123)
- Add mutex to adaptive sampler and fix race condition [#124](https://github.com/uber/jaeger-client-go/pull/124)
- Fix rate limiter panic [#125](https://github.com/uber/jaeger-client-go/pull/125)


2.4.0 (2017-03-21)
------------------

- Remove `_ms` suffix from request latency metric name [#121](https://github.com/uber/jaeger-client-go/pull/121)
- Rename all metrics to "request" and "http_request" and use tags for other dimensions [#121](https://github.com/uber/jaeger-client-go/pull/121)


2.3.0 (2017-03-20)
------------------

- Make Span type public to allow access to non-std methods for testing [#117](https://github.com/uber/jaeger-client-go/pull/117)
- Add a structured way to extract traces for logging with zap [#118](https://github.com/uber/jaeger-client-go/pull/118)


2.2.1 (2017-03-14)
------------------

- Fix panic caused by updating the remote sampler from adaptive sampler to any other sampler type (https://github.com/uber/jaeger-client-go/pull/111)


2.2.0 (2017-03-10)
------------------

- Introduce Observer and SpanObserver (https://github.com/uber/jaeger-client-go/pull/94)
- Add RPC metrics emitter as Observer/SpanObserver (https://github.com/uber/jaeger-client-go/pull/103)


2.1.2 (2017-02-27)
-------------------

- Fix leaky bucket bug (https://github.com/uber/jaeger-client-go/pull/99)
- Fix zap logger Infof (https://github.com/uber/jaeger-client-go/pull/100)
- Add tracer initialization godoc examples


2.1.1 (2017-02-21)
-------------------

- Fix inefficient usage of zap.Logger


2.1.0 (2017-02-17)
-------------------

- Add adapter for zap.Logger (https://github.com/uber-go/zap)
- Move logging API to ./log/ package


2.0.0 (2017-02-08)
-------------------

- Support Adaptive Sampling
- Support 128bit Trace IDs
- Change trace/span IDs from uint64 to strong types TraceID and SpanID
- Add Zipkin HTTP B3 Propagation format support #72
- Rip out existing metrics and use github.com/uber/jaeger-lib/metrics
- Change API for tracer, reporter, sampler initialization


1.6.0 (2016-10-14)
-------------------

- Add Zipkin HTTP transport
- Support external baggage via jaeger-baggage header
- Unpin Thrift version, keep to master


1.5.1 (2016-09-27)
-------------------

- Relax dependency on opentracing to ^1


1.5.0 (2016-09-27)
-------------------

- Upgrade to opentracing-go 1.0
- Support KV logging for Spans


1.4.0 (2016-09-14)
-------------------

- Support debug traces via HTTP header "jaeger-debug-id"
