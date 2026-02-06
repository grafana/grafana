// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package prometheus // import "go.opentelemetry.io/contrib/bridges/prometheus"

import (
	"github.com/prometheus/client_golang/prometheus"
)

// config contains options for the producer.
type config struct {
	gatherers []prometheus.Gatherer
}

// newConfig creates a validated config configured with options.
func newConfig(opts ...Option) config {
	cfg := config{}
	for _, opt := range opts {
		cfg = opt.apply(cfg)
	}

	if len(cfg.gatherers) == 0 {
		cfg.gatherers = []prometheus.Gatherer{prometheus.DefaultGatherer}
	}

	return cfg
}

// Option sets producer option values.
type Option interface {
	apply(config) config
}

type optionFunc func(config) config

func (fn optionFunc) apply(cfg config) config {
	return fn(cfg)
}

// WithGatherer configures which prometheus Gatherer the Bridge will gather
// from. If no registerer is used the prometheus DefaultGatherer is used.
func WithGatherer(gatherer prometheus.Gatherer) Option {
	return optionFunc(func(cfg config) config {
		cfg.gatherers = append(cfg.gatherers, gatherer)
		return cfg
	})
}
