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

package config

import (
	opentracing "github.com/opentracing/opentracing-go"
	"github.com/uber/jaeger-lib/metrics"

	"github.com/uber/jaeger-client-go"
)

// Option is a function that sets some option on the client.
type Option func(c *Options)

// Options control behavior of the client.
type Options struct {
	metrics                     metrics.Factory
	logger                      jaeger.Logger
	reporter                    jaeger.Reporter
	sampler                     jaeger.Sampler
	contribObservers            []jaeger.ContribObserver
	observers                   []jaeger.Observer
	gen128Bit                   bool
	poolSpans                   bool
	zipkinSharedRPCSpan         bool
	maxTagValueLength           int
	noDebugFlagOnForcedSampling bool
	tags                        []opentracing.Tag
	injectors                   map[interface{}]jaeger.Injector
	extractors                  map[interface{}]jaeger.Extractor
}

// Metrics creates an Option that initializes Metrics in the tracer,
// which is used to emit statistics about spans.
func Metrics(factory metrics.Factory) Option {
	return func(c *Options) {
		c.metrics = factory
	}
}

// Logger can be provided to log Reporter errors, as well as to log spans
// if Reporter.LogSpans is set to true.
func Logger(logger jaeger.Logger) Option {
	return func(c *Options) {
		c.logger = logger
	}
}

// Reporter can be provided explicitly to override the configuration.
// Useful for testing, e.g. by passing InMemoryReporter.
func Reporter(reporter jaeger.Reporter) Option {
	return func(c *Options) {
		c.reporter = reporter
	}
}

// Sampler can be provided explicitly to override the configuration.
func Sampler(sampler jaeger.Sampler) Option {
	return func(c *Options) {
		c.sampler = sampler
	}
}

// Observer can be registered with the Tracer to receive notifications about new Spans.
func Observer(observer jaeger.Observer) Option {
	return func(c *Options) {
		c.observers = append(c.observers, observer)
	}
}

// ContribObserver can be registered with the Tracer to receive notifications
// about new spans.
func ContribObserver(observer jaeger.ContribObserver) Option {
	return func(c *Options) {
		c.contribObservers = append(c.contribObservers, observer)
	}
}

// Gen128Bit specifies whether to generate 128bit trace IDs.
func Gen128Bit(gen128Bit bool) Option {
	return func(c *Options) {
		c.gen128Bit = gen128Bit
	}
}

// PoolSpans specifies whether to pool spans
func PoolSpans(poolSpans bool) Option {
	return func(c *Options) {
		c.poolSpans = poolSpans
	}
}

// ZipkinSharedRPCSpan creates an option that enables sharing span ID between client
// and server spans a la zipkin. If false, client and server spans will be assigned
// different IDs.
func ZipkinSharedRPCSpan(zipkinSharedRPCSpan bool) Option {
	return func(c *Options) {
		c.zipkinSharedRPCSpan = zipkinSharedRPCSpan
	}
}

// MaxTagValueLength can be provided to override the default max tag value length.
func MaxTagValueLength(maxTagValueLength int) Option {
	return func(c *Options) {
		c.maxTagValueLength = maxTagValueLength
	}
}

// NoDebugFlagOnForcedSampling can be used to decide whether debug flag will be set or not
// when calling span.setSamplingPriority to force sample a span.
func NoDebugFlagOnForcedSampling(noDebugFlagOnForcedSampling bool) Option {
	return func(c *Options) {
		c.noDebugFlagOnForcedSampling = noDebugFlagOnForcedSampling
	}
}

// Tag creates an option that adds a tracer-level tag.
func Tag(key string, value interface{}) Option {
	return func(c *Options) {
		c.tags = append(c.tags, opentracing.Tag{Key: key, Value: value})
	}
}

// Injector registers an Injector with the given format.
func Injector(format interface{}, injector jaeger.Injector) Option {
	return func(c *Options) {
		c.injectors[format] = injector
	}
}

// Extractor registers an Extractor with the given format.
func Extractor(format interface{}, extractor jaeger.Extractor) Option {
	return func(c *Options) {
		c.extractors[format] = extractor
	}
}

func applyOptions(options ...Option) Options {
	opts := Options{
		injectors:  make(map[interface{}]jaeger.Injector),
		extractors: make(map[interface{}]jaeger.Extractor),
	}
	for _, option := range options {
		option(&opts)
	}
	if opts.metrics == nil {
		opts.metrics = metrics.NullFactory
	}
	if opts.logger == nil {
		opts.logger = jaeger.NullLogger
	}
	return opts
}
