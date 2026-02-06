// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package stdoutmetric // import "go.opentelemetry.io/otel/exporters/stdout/stdoutmetric"

import (
	"encoding/json"
	"io"
	"os"

	"go.opentelemetry.io/otel/sdk/metric"
)

// config contains options for the exporter.
type config struct {
	prettyPrint         bool
	encoder             *encoderHolder
	temporalitySelector metric.TemporalitySelector
	aggregationSelector metric.AggregationSelector
	redactTimestamps    bool
}

// newConfig creates a validated config configured with options.
func newConfig(options ...Option) config {
	cfg := config{}
	for _, opt := range options {
		cfg = opt.apply(cfg)
	}

	if cfg.encoder == nil {
		enc := json.NewEncoder(os.Stdout)
		cfg.encoder = &encoderHolder{encoder: enc}
	}

	if cfg.prettyPrint {
		if e, ok := cfg.encoder.encoder.(*json.Encoder); ok {
			e.SetIndent("", "\t")
		}
	}

	if cfg.temporalitySelector == nil {
		cfg.temporalitySelector = metric.DefaultTemporalitySelector
	}

	if cfg.aggregationSelector == nil {
		cfg.aggregationSelector = metric.DefaultAggregationSelector
	}

	return cfg
}

// Option sets exporter option values.
type Option interface {
	apply(config) config
}

type optionFunc func(config) config

func (o optionFunc) apply(c config) config {
	return o(c)
}

// WithEncoder sets the exporter to use encoder to encode all the metric
// data-types to an output.
func WithEncoder(encoder Encoder) Option {
	return optionFunc(func(c config) config {
		if encoder != nil {
			c.encoder = &encoderHolder{encoder: encoder}
		}
		return c
	})
}

// WithWriter sets the export stream destination.
// Using this option overrides any previously set encoder.
func WithWriter(w io.Writer) Option {
	return WithEncoder(json.NewEncoder(w))
}

// WithPrettyPrint prettifies the emitted output.
// This option only works if the encoder is a *json.Encoder, as is the case
// when using `WithWriter`.
func WithPrettyPrint() Option {
	return optionFunc(func(c config) config {
		c.prettyPrint = true
		return c
	})
}

// WithTemporalitySelector sets the TemporalitySelector the exporter will use
// to determine the Temporality of an instrument based on its kind. If this
// option is not used, the exporter will use the DefaultTemporalitySelector
// from the go.opentelemetry.io/otel/sdk/metric package.
func WithTemporalitySelector(selector metric.TemporalitySelector) Option {
	return temporalitySelectorOption{selector: selector}
}

type temporalitySelectorOption struct {
	selector metric.TemporalitySelector
}

func (t temporalitySelectorOption) apply(c config) config {
	c.temporalitySelector = t.selector
	return c
}

// WithAggregationSelector sets the AggregationSelector the exporter will use
// to determine the aggregation to use for an instrument based on its kind. If
// this option is not used, the exporter will use the
// DefaultAggregationSelector from the go.opentelemetry.io/otel/sdk/metric
// package or the aggregation explicitly passed for a view matching an
// instrument.
func WithAggregationSelector(selector metric.AggregationSelector) Option {
	return aggregationSelectorOption{selector: selector}
}

type aggregationSelectorOption struct {
	selector metric.AggregationSelector
}

func (t aggregationSelectorOption) apply(c config) config {
	c.aggregationSelector = t.selector
	return c
}

// WithoutTimestamps sets all timestamps to zero in the output stream.
func WithoutTimestamps() Option {
	return optionFunc(func(c config) config {
		c.redactTimestamps = true
		return c
	})
}
