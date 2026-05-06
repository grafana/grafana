// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package prometheus // import "go.opentelemetry.io/otel/exporters/prometheus"

import (
	"strings"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/internal/global"
	"go.opentelemetry.io/otel/sdk/metric"
)

// config contains options for the exporter.
type config struct {
	registerer               prometheus.Registerer
	disableTargetInfo        bool
	withoutUnits             bool
	withoutCounterSuffixes   bool
	readerOpts               []metric.ManualReaderOption
	disableScopeInfo         bool
	namespace                string
	resourceAttributesFilter attribute.Filter
}

var logDeprecatedLegacyScheme = sync.OnceFunc(func() {
	global.Warn(
		"prometheus exporter legacy scheme deprecated: support for the legacy NameValidationScheme will be removed in a future release",
	)
})

// newConfig creates a validated config configured with options.
func newConfig(opts ...Option) config {
	cfg := config{}
	for _, opt := range opts {
		cfg = opt.apply(cfg)
	}

	if cfg.registerer == nil {
		cfg.registerer = prometheus.DefaultRegisterer
	}

	return cfg
}

// Option sets exporter option values.
type Option interface {
	apply(config) config
}

type optionFunc func(config) config

func (fn optionFunc) apply(cfg config) config {
	return fn(cfg)
}

// WithRegisterer configures which prometheus Registerer the Exporter will
// register with.  If no registerer is used the prometheus DefaultRegisterer is
// used.
func WithRegisterer(reg prometheus.Registerer) Option {
	return optionFunc(func(cfg config) config {
		cfg.registerer = reg
		return cfg
	})
}

// WithAggregationSelector configure the Aggregation Selector the exporter will
// use. If no AggregationSelector is provided the DefaultAggregationSelector is
// used.
func WithAggregationSelector(agg metric.AggregationSelector) Option {
	return optionFunc(func(cfg config) config {
		cfg.readerOpts = append(cfg.readerOpts, metric.WithAggregationSelector(agg))
		return cfg
	})
}

// WithProducer configure the metric Producer the exporter will use as a source
// of external metric data.
func WithProducer(producer metric.Producer) Option {
	return optionFunc(func(cfg config) config {
		cfg.readerOpts = append(cfg.readerOpts, metric.WithProducer(producer))
		return cfg
	})
}

// WithoutTargetInfo configures the Exporter to not export the resource target_info metric.
// If not specified, the Exporter will create a target_info metric containing
// the metrics' resource.Resource attributes.
func WithoutTargetInfo() Option {
	return optionFunc(func(cfg config) config {
		cfg.disableTargetInfo = true
		return cfg
	})
}

// WithoutUnits disables exporter's addition of unit suffixes to metric names,
// and will also prevent unit comments from being added in OpenMetrics once
// unit comments are supported.
//
// By default, metric names include a unit suffix to follow Prometheus naming
// conventions. For example, the counter metric request.duration, with unit
// milliseconds would become request_duration_milliseconds_total.
// With this option set, the name would instead be request_duration_total.
func WithoutUnits() Option {
	return optionFunc(func(cfg config) config {
		cfg.withoutUnits = true
		return cfg
	})
}

// WithoutCounterSuffixes disables exporter's addition _total suffixes on counters.
//
// By default, metric names include a _total suffix to follow Prometheus naming
// conventions. For example, the counter metric happy.people would become
// happy_people_total. With this option set, the name would instead be
// happy_people.
func WithoutCounterSuffixes() Option {
	return optionFunc(func(cfg config) config {
		cfg.withoutCounterSuffixes = true
		return cfg
	})
}

// WithoutScopeInfo configures the Exporter to not export
// labels about Instrumentation Scope to all metric points.
func WithoutScopeInfo() Option {
	return optionFunc(func(cfg config) config {
		cfg.disableScopeInfo = true
		return cfg
	})
}

// WithNamespace configures the Exporter to prefix metric with the given namespace.
// Metadata metrics such as target_info are not prefixed since these
// have special behavior based on their name.
func WithNamespace(ns string) Option {
	return optionFunc(func(cfg config) config {
		if model.NameValidationScheme != model.UTF8Validation { // nolint:staticcheck // We need this check to keep supporting the legacy scheme.
			logDeprecatedLegacyScheme()
			// Only sanitize if prometheus does not support UTF-8.
			ns = model.EscapeName(ns, model.NameEscapingScheme)
		}
		if !strings.HasSuffix(ns, "_") {
			// namespace and metric names should be separated with an underscore,
			// adds a trailing underscore if there is not one already.
			ns = ns + "_"
		}

		cfg.namespace = ns
		return cfg
	})
}

// WithResourceAsConstantLabels configures the Exporter to add the resource attributes the
// resourceFilter returns true for as attributes on all exported metrics.
//
// The does not affect the target info generated from resource attributes.
func WithResourceAsConstantLabels(resourceFilter attribute.Filter) Option {
	return optionFunc(func(cfg config) config {
		cfg.resourceAttributesFilter = resourceFilter
		return cfg
	})
}
