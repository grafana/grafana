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
	metrics             metrics.Factory
	logger              jaeger.Logger
	reporter            jaeger.Reporter
	contribObservers    []jaeger.ContribObserver
	observers           []jaeger.Observer
	zipkinSharedRPCSpan bool
	tags                []opentracing.Tag
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

// Observer can be registered with the Tracer to receive notifications about new Spans.
func Observer(observer jaeger.Observer) Option {
	return func(c *Options) {
		c.observers = append(c.observers, observer)
	}
}

// ContribObserver can be registered with the Tracer to recieve notifications
// about new spans.
func ContribObserver(observer jaeger.ContribObserver) Option {
	return func(c *Options) {
		c.contribObservers = append(c.contribObservers, observer)
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

// Tag creates an option that adds a tracer-level tag.
func Tag(key string, value interface{}) Option {
	return func(c *Options) {
		c.tags = append(c.tags, opentracing.Tag{Key: key, Value: value})
	}
}

func applyOptions(options ...Option) Options {
	opts := Options{}
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
