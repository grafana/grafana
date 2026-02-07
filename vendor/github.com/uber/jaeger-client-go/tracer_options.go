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
	"time"

	"github.com/opentracing/opentracing-go"

	"github.com/uber/jaeger-client-go/internal/baggage"
	"github.com/uber/jaeger-client-go/internal/throttler"
	"github.com/uber/jaeger-client-go/log"
)

// TracerOption is a function that sets some option on the tracer
type TracerOption func(tracer *Tracer)

// TracerOptions is a factory for all available TracerOption's.
var TracerOptions TracerOptionsFactory

// TracerOptionsFactory is a struct that defines functions for all available TracerOption's.
type TracerOptionsFactory struct{}

// Metrics creates a TracerOption that initializes Metrics on the tracer,
// which is used to emit statistics.
func (TracerOptionsFactory) Metrics(m *Metrics) TracerOption {
	return func(tracer *Tracer) {
		tracer.metrics = *m
	}
}

// Logger creates a TracerOption that gives the tracer a Logger.
func (TracerOptionsFactory) Logger(logger Logger) TracerOption {
	return func(tracer *Tracer) {
		tracer.logger = log.DebugLogAdapter(logger)
	}
}

// CustomHeaderKeys allows to override default HTTP header keys used to propagate
// tracing context.
func (TracerOptionsFactory) CustomHeaderKeys(headerKeys *HeadersConfig) TracerOption {
	return func(tracer *Tracer) {
		if headerKeys == nil {
			return
		}
		textPropagator := NewTextMapPropagator(headerKeys.ApplyDefaults(), tracer.metrics)
		tracer.addCodec(opentracing.TextMap, textPropagator, textPropagator)

		httpHeaderPropagator := NewHTTPHeaderPropagator(headerKeys.ApplyDefaults(), tracer.metrics)
		tracer.addCodec(opentracing.HTTPHeaders, httpHeaderPropagator, httpHeaderPropagator)
	}
}

// TimeNow creates a TracerOption that gives the tracer a function
// used to generate timestamps for spans.
func (TracerOptionsFactory) TimeNow(timeNow func() time.Time) TracerOption {
	return func(tracer *Tracer) {
		tracer.timeNow = timeNow
	}
}

// RandomNumber creates a TracerOption that gives the tracer
// a thread-safe random number generator function for generating trace IDs.
func (TracerOptionsFactory) RandomNumber(randomNumber func() uint64) TracerOption {
	return func(tracer *Tracer) {
		tracer.randomNumber = randomNumber
	}
}

// PoolSpans creates a TracerOption that tells the tracer whether it should use
// an object pool to minimize span allocations.
// This should be used with care, only if the service is not running any async tasks
// that can access parent spans after those spans have been finished.
func (TracerOptionsFactory) PoolSpans(poolSpans bool) TracerOption {
	return func(tracer *Tracer) {
		if poolSpans {
			tracer.spanAllocator = newSyncPollSpanAllocator()
		} else {
			tracer.spanAllocator = simpleSpanAllocator{}
		}
	}
}

// HostIPv4 creates a TracerOption that identifies the current service/process.
// If not set, the factory method will obtain the current IP address.
// The TracerOption is deprecated; the tracer will attempt to automatically detect the IP.
//
// Deprecated.
func (TracerOptionsFactory) HostIPv4(hostIPv4 uint32) TracerOption {
	return func(tracer *Tracer) {
		tracer.hostIPv4 = hostIPv4
	}
}

// Injector registers a Injector for given format.
func (TracerOptionsFactory) Injector(format interface{}, injector Injector) TracerOption {
	return func(tracer *Tracer) {
		tracer.injectors[format] = injector
	}
}

// Extractor registers an Extractor for given format.
func (TracerOptionsFactory) Extractor(format interface{}, extractor Extractor) TracerOption {
	return func(tracer *Tracer) {
		tracer.extractors[format] = extractor
	}
}

// Observer registers an Observer.
func (t TracerOptionsFactory) Observer(observer Observer) TracerOption {
	return t.ContribObserver(&oldObserver{obs: observer})
}

// ContribObserver registers a ContribObserver.
func (TracerOptionsFactory) ContribObserver(observer ContribObserver) TracerOption {
	return func(tracer *Tracer) {
		tracer.observer.append(observer)
	}
}

// Gen128Bit enables generation of 128bit trace IDs.
func (TracerOptionsFactory) Gen128Bit(gen128Bit bool) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.gen128Bit = gen128Bit
	}
}

// NoDebugFlagOnForcedSampling turns off setting the debug flag in the trace context
// when the trace is force-started via sampling=1 span tag.
func (TracerOptionsFactory) NoDebugFlagOnForcedSampling(noDebugFlagOnForcedSampling bool) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.noDebugFlagOnForcedSampling = noDebugFlagOnForcedSampling
	}
}

// HighTraceIDGenerator allows to override define ID generator.
func (TracerOptionsFactory) HighTraceIDGenerator(highTraceIDGenerator func() uint64) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.highTraceIDGenerator = highTraceIDGenerator
	}
}

// MaxTagValueLength sets the limit on the max length of tag values.
func (TracerOptionsFactory) MaxTagValueLength(maxTagValueLength int) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.maxTagValueLength = maxTagValueLength
	}
}

// MaxLogsPerSpan limits the number of Logs in a span (if set to a nonzero
// value). If a span has more logs than this value, logs are dropped as
// necessary (and replaced with a log describing how many were dropped).
//
// About half of the MaxLogsPerSpan logs kept are the oldest logs, and about
// half are the newest logs.
func (TracerOptionsFactory) MaxLogsPerSpan(maxLogsPerSpan int) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.maxLogsPerSpan = maxLogsPerSpan
	}
}

// ZipkinSharedRPCSpan enables a mode where server-side span shares the span ID
// from the client span from the incoming request, for compatibility with Zipkin's
// "one span per RPC" model.
func (TracerOptionsFactory) ZipkinSharedRPCSpan(zipkinSharedRPCSpan bool) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.zipkinSharedRPCSpan = zipkinSharedRPCSpan
	}
}

// Tag adds a tracer-level tag that will be added to all spans.
func (TracerOptionsFactory) Tag(key string, value interface{}) TracerOption {
	return func(tracer *Tracer) {
		tracer.tags = append(tracer.tags, Tag{key: key, value: value})
	}
}

// BaggageRestrictionManager registers BaggageRestrictionManager.
func (TracerOptionsFactory) BaggageRestrictionManager(mgr baggage.RestrictionManager) TracerOption {
	return func(tracer *Tracer) {
		tracer.baggageRestrictionManager = mgr
	}
}

// DebugThrottler registers a Throttler for debug spans.
func (TracerOptionsFactory) DebugThrottler(throttler throttler.Throttler) TracerOption {
	return func(tracer *Tracer) {
		tracer.debugThrottler = throttler
	}
}
