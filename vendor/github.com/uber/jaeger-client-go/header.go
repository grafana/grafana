// Copyright (c) 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

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
