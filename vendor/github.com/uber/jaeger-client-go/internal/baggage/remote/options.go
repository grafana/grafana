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

package remote

import (
	"time"

	"github.com/uber/jaeger-client-go"
)

const (
	defaultMaxValueLength  = 2048
	defaultRefreshInterval = time.Minute
	defaultHostPort        = "localhost:5778"
)

// Option is a function that sets some option on the RestrictionManager
type Option func(options *options)

// Options is a factory for all available options
var Options options

type options struct {
	denyBaggageOnInitializationFailure bool
	metrics                            *jaeger.Metrics
	logger                             jaeger.Logger
	hostPort                           string
	refreshInterval                    time.Duration
}

// DenyBaggageOnInitializationFailure creates an Option that determines the startup failure mode of RestrictionManager.
// If DenyBaggageOnInitializationFailure is true, RestrictionManager will not allow any baggage to be written until baggage
// restrictions have been retrieved from agent.
// If DenyBaggageOnInitializationFailure is false, RestrictionManager will allow any baggage to be written until baggage
// restrictions have been retrieved from agent.
func (options) DenyBaggageOnInitializationFailure(b bool) Option {
	return func(o *options) {
		o.denyBaggageOnInitializationFailure = b
	}
}

// Metrics creates an Option that initializes Metrics on the RestrictionManager, which is used to emit statistics.
func (options) Metrics(m *jaeger.Metrics) Option {
	return func(o *options) {
		o.metrics = m
	}
}

// Logger creates an Option that sets the logger used by the RestrictionManager.
func (options) Logger(logger jaeger.Logger) Option {
	return func(o *options) {
		o.logger = logger
	}
}

// HostPort creates an Option that sets the hostPort of the local agent that contains the baggage restrictions.
func (options) HostPort(hostPort string) Option {
	return func(o *options) {
		o.hostPort = hostPort
	}
}

// RefreshInterval creates an Option that sets how often the RestrictionManager will poll local agent for
// the baggage restrictions.
func (options) RefreshInterval(refreshInterval time.Duration) Option {
	return func(o *options) {
		o.refreshInterval = refreshInterval
	}
}

func applyOptions(o ...Option) options {
	opts := options{}
	for _, option := range o {
		option(&opts)
	}
	if opts.metrics == nil {
		opts.metrics = jaeger.NewNullMetrics()
	}
	if opts.logger == nil {
		opts.logger = jaeger.NullLogger
	}
	if opts.hostPort == "" {
		opts.hostPort = defaultHostPort
	}
	if opts.refreshInterval == 0 {
		opts.refreshInterval = defaultRefreshInterval
	}
	return opts
}
