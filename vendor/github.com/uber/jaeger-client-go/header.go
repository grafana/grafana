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

// HeadersConfig contains the values for the header keys that Jaeger will use.
// These values may be either custom or default depending on whether custom
// values were provided via a configuration.
type HeadersConfig struct {
	// JaegerDebugHeader is the name of HTTP header or a TextMap carrier key which,
	// if found in the carrier, forces the trace to be sampled as "debug" trace.
	// The value of the header is recorded as the tag on the root span, so that the
	// trace can be found in the UI using this value as a correlation ID.
	JaegerDebugHeader string `yaml:"jaegerDebugHeader"`

	// JaegerBaggageHeader is the name of the HTTP header that is used to submit baggage.
	// It differs from TraceBaggageHeaderPrefix in that it can be used only in cases where
	// a root span does not exist.
	JaegerBaggageHeader string `yaml:"jaegerBaggageHeader"`

	// TraceContextHeaderName is the http header name used to propagate tracing context.
	// This must be in lower-case to avoid mismatches when decoding incoming headers.
	TraceContextHeaderName string `yaml:"TraceContextHeaderName"`

	// TraceBaggageHeaderPrefix is the prefix for http headers used to propagate baggage.
	// This must be in lower-case to avoid mismatches when decoding incoming headers.
	TraceBaggageHeaderPrefix string `yaml:"traceBaggageHeaderPrefix"`
}

func (c *HeadersConfig) applyDefaults() *HeadersConfig {
	if c.JaegerBaggageHeader == "" {
		c.JaegerBaggageHeader = JaegerBaggageHeader
	}
	if c.JaegerDebugHeader == "" {
		c.JaegerDebugHeader = JaegerDebugHeader
	}
	if c.TraceBaggageHeaderPrefix == "" {
		c.TraceBaggageHeaderPrefix = TraceBaggageHeaderPrefix
	}
	if c.TraceContextHeaderName == "" {
		c.TraceContextHeaderName = TraceContextHeaderName
	}
	return c
}

func getDefaultHeadersConfig() *HeadersConfig {
	return &HeadersConfig{
		JaegerDebugHeader:        JaegerDebugHeader,
		JaegerBaggageHeader:      JaegerBaggageHeader,
		TraceContextHeaderName:   TraceContextHeaderName,
		TraceBaggageHeaderPrefix: TraceBaggageHeaderPrefix,
	}
}
