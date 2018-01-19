# Crossdock-based Integration Test Suite

This package implements integration test suite for testing 
interoperability between different Jaeger client libraries.

## Actors

There are five actors participating in any given test case,
the crossdock driver itself, a Client, and three Servers, S1-S3.

### Driver

The crossdock driver reads axis and test definitions from the YAML file,
generates permutations based on values listed for each axis, and
makes an HTTP request to the Client, passing it the selected value
for each axis.

### Client

Client runs as part of the `jaeger-client/go` image and orchestrates
the actual test case with the servers S1-S3.  The incoming request
from the driver is expected to have parameters defined in
[client/constants.go](client/constants.go), which specify

  1. The type of test to execute (only `trace` is currently supported)
  1. Whether the trace should be sampled or not
  1. For each of the servers S1-S3:
     * the name of the server (same as docker image name, same as host name)
     * the transport to send request to that server (http or TChannel)
     * the type of client to use (e.g. in Python, `urllib2` vs. `requests`)

The Client translates the parameters into a "call tree" instruction set,
and calls S1, which in turn calls S2 with the sub-set of instructions,
and so on. Upon receiving the response from S1, the Client validates the
response against the conditions of the test, and returns a summary result
to the crossdock driver, indicating a success of a failure of the test.
For the `trace` test type, the success conditions are that at all levels
the observed tracing spans have the same trace ID, the same sampling flag
equal to the input `sampled` parameter, and the same value of a baggage
item. The baggage item value is randomly selected by the client at the
start of each test.

### Servers

Servers represent examples of business services with Jaeger tracing enabled.
Servers must be implemented for each supported language, and potentially
multiple times for a given language depending on the framework used to build
the service, such as Flask vs. Tornado in Python.  Each implementation of the
server may act as any of the S1-S3 servers in the test.  Each server must
implement the `TracedService` interface from
[thrift/tracetest.thrift](thrift/tracetest.thrift):

    service TracedService {
        TraceResponse startTrace(1: StartTraceRequest request)
        TraceResponse joinTrace(1: JoinTraceRequest request)
    }

  * In `startTrace` the server is supposed to ignore any trace it may have
    received via inbound request and start a brand new trace, with the
    sampling flag set appropriately, using `sampling.priority` tag,
    see [Go server implementation](server/trace.go) for example.
  * In `joinTrace` the server is supposed to respect the trace in the
    inbound request and propagate it to the outbound downstream request.

The response from the server contains the information about the current
tracing span it has observed (or started), including trace ID, sampling
flag, and the value of a baggage item. For S1 and S2 the response also
includes the response of the downstream server.

## Running the tests

The intended setup is that every commit to master branch of each of the client
libraries results in a build of a new docker image (or images, e.g. in Python).
When a new pull request is tested against one of the libraries, it will build
a new image from the modified version of the library, and use the existing
images for the other languages.  The `docker-compose.yaml` file refers to those
images by name.

