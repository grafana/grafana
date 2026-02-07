// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package prometheus // import "go.opentelemetry.io/otel/exporters/prometheus"

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/otlptranslator"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric"
)

// config contains options for the exporter.
type config struct {
	registerer               prometheus.Registerer
	disableTargetInfo        bool
	translationStrategy      otlptranslator.TranslationStrategyOption
	withoutUnits             bool
	withoutCounterSuffixes   bool
	readerOpts               []metric.ManualReaderOption
	disableScopeInfo         bool
	namespace                string
	resourceAttributesFilter attribute.Filter
}

// newConfig creates a validated config configured with options.
func newConfig(opts ...Option) config {
	cfg := config{}
	for _, opt := range opts {
		cfg = opt.apply(cfg)
	}

	if cfg.translationStrategy == "" {
		cfg.translationStrategy = otlptranslator.UnderscoreEscapingWithSuffixes
	} else if !cfg.translationStrategy.ShouldAddSuffixes() {
		// Note, if the translation strategy implies that suffixes should be added,
		// the user can still use WithoutUnits and WithoutCounterSuffixes to
		// explicitly disable specific suffixes. We do not override their preference
		// in this case. However if the chosen strategy disables suffixes, we should
		// forcibly disable all of them.
		cfg.withoutCounterSuffixes = true
		cfg.withoutUnits = true
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

// WithTranslationStrategy provides a standardized way to define how metric and
// label names should be handled during translation to Prometheus format. See:
// https://github.com/open-telemetry/opentelemetry-specification/blob/v1.48.0/specification/metrics/sdk_exporters/prometheus.md#configuration.
// The recommended approach is to use either
// [otlptranslator.UnderscoreEscapingWithSuffixes] for full Prometheus-style
// compatibility or [otlptranslator.NoTranslation] for OpenTelemetry-style names.
//
// By default, if the NameValidationScheme variable in
// [github.com/prometheus/common/model] is "legacy", the default strategy is
// [otlptranslator.UnderscoreEscapingWithSuffixes]. If the validation scheme is
// "utf8", then currently the default Strategy is
// [otlptranslator.NoUTF8EscapingWithSuffixes].
//
// Notice: It is planned that a future release of this SDK will change the
// default to always be [otlptranslator.UnderscoreEscapingWithSuffixes] in all
// circumstances. Users wanting a different translation strategy should specify
// it explicitly.
func WithTranslationStrategy(strategy otlptranslator.TranslationStrategyOption) Option {
	return optionFunc(func(cfg config) config {
		cfg.translationStrategy = strategy
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
//
// Can be used in conjunction with [WithTranslationStrategy] to disable unit
// suffixes in strategies that would otherwise add suffixes, but this behavior
// is not recommended and may be removed in a future release.
//
// Deprecated: Use [WithTranslationStrategy] instead.
func WithoutUnits() Option {
	return optionFunc(func(cfg config) config {
		cfg.withoutUnits = true
		return cfg
	})
}

// WithoutCounterSuffixes disables exporter's addition _total suffixes on
// counters.
//
// By default, metric names include a _total suffix to follow Prometheus naming
// conventions. For example, the counter metric happy.people would become
// happy_people_total. With this option set, the name would instead be
// happy_people.
//
// Can be used in conjunction with [WithTranslationStrategy] to disable counter
// suffixes in strategies that would otherwise add suffixes, but this behavior
// is not recommended and may be removed in a future release.
//
// Deprecated: Use [WithTranslationStrategy] instead.
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

// WithNamespace configures the Exporter to prefix metric with the given
// namespace. Metadata metrics such as target_info are not prefixed since these
// have special behavior based on their name. Namespaces will be prepended even
// if [otlptranslator.NoTranslation] is set as a translation strategy. If the provided namespace
// is empty, nothing will be prepended to metric names.
func WithNamespace(ns string) Option {
	return optionFunc(func(cfg config) config {
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
