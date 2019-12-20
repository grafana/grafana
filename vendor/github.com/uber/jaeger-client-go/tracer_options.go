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
)

// TracerOption is a function that sets some option on the tracer
type TracerOption func(tracer *Tracer)

// TracerOptions is a factory for all available TracerOption's
var TracerOptions tracerOptions

type tracerOptions struct{}

// Metrics creates a TracerOption that initializes Metrics on the tracer,
// which is used to emit statistics.
func (tracerOptions) Metrics(m *Metrics) TracerOption {
	return func(tracer *Tracer) {
		tracer.metrics = *m
	}
}

// Logger creates a TracerOption that gives the tracer a Logger.
func (tracerOptions) Logger(logger Logger) TracerOption {
	return func(tracer *Tracer) {
		tracer.logger = logger
	}
}

func (tracerOptions) CustomHeaderKeys(headerKeys *HeadersConfig) TracerOption {
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
func (tracerOptions) TimeNow(timeNow func() time.Time) TracerOption {
	return func(tracer *Tracer) {
		tracer.timeNow = timeNow
	}
}

// RandomNumber creates a TracerOption that gives the tracer
// a thread-safe random number generator function for generating trace IDs.
func (tracerOptions) RandomNumber(randomNumber func() uint64) TracerOption {
	return func(tracer *Tracer) {
		tracer.randomNumber = randomNumber
	}
}

// PoolSpans creates a TracerOption that tells the tracer whether it should use
// an object pool to minimize span allocations.
// This should be used with care, only if the service is not running any async tasks
// that can access parent spans after those spans have been finished.
func (tracerOptions) PoolSpans(poolSpans bool) TracerOption {
	return func(tracer *Tracer) {
		if poolSpans {
			tracer.spanAllocator = newSyncPollSpanAllocator()
		} else {
			tracer.spanAllocator = simpleSpanAllocator{}
		}
	}
}

// Deprecated: HostIPv4 creates a TracerOption that identifies the current service/process.
// If not set, the factory method will obtain the current IP address.
// The TracerOption is deprecated; the tracer will attempt to automatically detect the IP.
func (tracerOptions) HostIPv4(hostIPv4 uint32) TracerOption {
	return func(tracer *Tracer) {
		tracer.hostIPv4 = hostIPv4
	}
}

func (tracerOptions) Injector(format interface{}, injector Injector) TracerOption {
	return func(tracer *Tracer) {
		tracer.injectors[format] = injector
	}
}

func (tracerOptions) Extractor(format interface{}, extractor Extractor) TracerOption {
	return func(tracer *Tracer) {
		tracer.extractors[format] = extractor
	}
}

func (t tracerOptions) Observer(observer Observer) TracerOption {
	return t.ContribObserver(&oldObserver{obs: observer})
}

func (tracerOptions) ContribObserver(observer ContribObserver) TracerOption {
	return func(tracer *Tracer) {
		tracer.observer.append(observer)
	}
}

func (tracerOptions) Gen128Bit(gen128Bit bool) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.gen128Bit = gen128Bit
	}
}

func (tracerOptions) NoDebugFlagOnForcedSampling(noDebugFlagOnForcedSampling bool) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.noDebugFlagOnForcedSampling = noDebugFlagOnForcedSampling
	}
}

func (tracerOptions) HighTraceIDGenerator(highTraceIDGenerator func() uint64) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.highTraceIDGenerator = highTraceIDGenerator
	}
}

func (tracerOptions) MaxTagValueLength(maxTagValueLength int) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.maxTagValueLength = maxTagValueLength
	}
}

func (tracerOptions) ZipkinSharedRPCSpan(zipkinSharedRPCSpan bool) TracerOption {
	return func(tracer *Tracer) {
		tracer.options.zipkinSharedRPCSpan = zipkinSharedRPCSpan
	}
}

func (tracerOptions) Tag(key string, value interface{}) TracerOption {
	return func(tracer *Tracer) {
		tracer.tags = append(tracer.tags, Tag{key: key, value: value})
	}
}

func (tracerOptions) BaggageRestrictionManager(mgr baggage.RestrictionManager) TracerOption {
	return func(tracer *Tracer) {
		tracer.baggageRestrictionManager = mgr
	}
}

func (tracerOptions) DebugThrottler(throttler throttler.Throttler) TracerOption {
	return func(tracer *Tracer) {
		tracer.debugThrottler = throttler
	}
}
