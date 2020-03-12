// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaeger

import (
	"fmt"

	"github.com/opentracing/opentracing-go"
)

const (
	// JaegerClientVersion is the version of the client library reported as Span tag.
	JaegerClientVersion = "Go-2.20.1"

	// JaegerClientVersionTagKey is the name of the tag used to report client version.
	JaegerClientVersionTagKey = "jaeger.version"

	// JaegerDebugHeader is the name of HTTP header or a TextMap carrier key which,
	// if found in the carrier, forces the trace to be sampled as "debug" trace.
	// The value of the header is recorded as the tag on the root span, so that the
	// trace can be found in the UI using this value as a correlation ID.
	JaegerDebugHeader = "jaeger-debug-id"

	// JaegerBaggageHeader is the name of the HTTP header that is used to submit baggage.
	// It differs from TraceBaggageHeaderPrefix in that it can be used only in cases where
	// a root span does not exist.
	JaegerBaggageHeader = "jaeger-baggage"

	// TracerHostnameTagKey used to report host name of the process.
	TracerHostnameTagKey = "hostname"

	// TracerIPTagKey used to report ip of the process.
	TracerIPTagKey = "ip"

	// TracerUUIDTagKey used to report UUID of the client process.
	TracerUUIDTagKey = "client-uuid"

	// SamplerTypeTagKey reports which sampler was used on the root span.
	SamplerTypeTagKey = "sampler.type"

	// SamplerParamTagKey reports the parameter of the sampler, like sampling probability.
	SamplerParamTagKey = "sampler.param"

	// TraceContextHeaderName is the http header name used to propagate tracing context.
	// This must be in lower-case to avoid mismatches when decoding incoming headers.
	TraceContextHeaderName = "uber-trace-id"

	// TracerStateHeaderName is deprecated.
	// Deprecated: use TraceContextHeaderName
	TracerStateHeaderName = TraceContextHeaderName

	// TraceBaggageHeaderPrefix is the prefix for http headers used to propagate baggage.
	// This must be in lower-case to avoid mismatches when decoding incoming headers.
	TraceBaggageHeaderPrefix = "uberctx-"

	// SamplerTypeConst is the type of sampler that always makes the same decision.
	SamplerTypeConst = "const"

	// SamplerTypeRemote is the type of sampler that polls Jaeger agent for sampling strategy.
	SamplerTypeRemote = "remote"

	// SamplerTypeProbabilistic is the type of sampler that samples traces
	// with a certain fixed probability.
	SamplerTypeProbabilistic = "probabilistic"

	// SamplerTypeRateLimiting is the type of sampler that samples
	// only up to a fixed number of traces per second.
	SamplerTypeRateLimiting = "ratelimiting"

	// SamplerTypeLowerBound is the type of sampler that samples
	// at least a fixed number of traces per second.
	SamplerTypeLowerBound = "lowerbound"

	// DefaultUDPSpanServerHost is the default host to send the spans to, via UDP
	DefaultUDPSpanServerHost = "localhost"

	// DefaultUDPSpanServerPort is the default port to send the spans to, via UDP
	DefaultUDPSpanServerPort = 6831

	// DefaultSamplingServerPort is the default port to fetch sampling config from, via http
	DefaultSamplingServerPort = 5778

	// DefaultMaxTagValueLength is the default max length of byte array or string allowed in the tag value.
	DefaultMaxTagValueLength = 256

	// SelfRefType is a jaeger specific reference type that supports creating a span
	// with an already defined context.
	selfRefType opentracing.SpanReferenceType = 99
)

var (
	// DefaultSamplingServerURL is the default url to fetch sampling config from, via http
	DefaultSamplingServerURL = fmt.Sprintf("http://localhost:%d/sampling", DefaultSamplingServerPort)
)
