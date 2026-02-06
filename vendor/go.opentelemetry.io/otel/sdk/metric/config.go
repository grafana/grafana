// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/sdk/metric/exemplar"
	"go.opentelemetry.io/otel/sdk/resource"
)

// config contains configuration options for a MeterProvider.
type config struct {
	res              *resource.Resource
	readers          []Reader
	views            []View
	exemplarFilter   exemplar.Filter
	cardinalityLimit int
}

const defaultCardinalityLimit = 0

// readerSignals returns a force-flush and shutdown function for a
// MeterProvider to call in their respective options. All Readers c contains
// will have their force-flush and shutdown methods unified into returned
// single functions.
func (c config) readerSignals() (forceFlush, shutdown func(context.Context) error) {
	var fFuncs, sFuncs []func(context.Context) error
	for _, r := range c.readers {
		sFuncs = append(sFuncs, r.Shutdown)
		if f, ok := r.(interface{ ForceFlush(context.Context) error }); ok {
			fFuncs = append(fFuncs, f.ForceFlush)
		}
	}

	return unify(fFuncs), unifyShutdown(sFuncs)
}

// unify unifies calling all of funcs into a single function call. All errors
// returned from calls to funcs will be unify into a single error return
// value.
func unify(funcs []func(context.Context) error) func(context.Context) error {
	return func(ctx context.Context) error {
		var err error
		for _, f := range funcs {
			if e := f(ctx); e != nil {
				err = errors.Join(err, e)
			}
		}
		return err
	}
}

// unifyShutdown unifies calling all of funcs once for a shutdown. If called
// more than once, an ErrReaderShutdown error is returned.
func unifyShutdown(funcs []func(context.Context) error) func(context.Context) error {
	f := unify(funcs)
	var once sync.Once
	return func(ctx context.Context) error {
		err := ErrReaderShutdown
		once.Do(func() { err = f(ctx) })
		return err
	}
}

// newConfig returns a config configured with options.
func newConfig(options []Option) config {
	conf := config{
		res:              resource.Default(),
		exemplarFilter:   exemplar.TraceBasedFilter,
		cardinalityLimit: cardinalityLimitFromEnv(),
	}
	for _, o := range meterProviderOptionsFromEnv() {
		conf = o.apply(conf)
	}
	for _, o := range options {
		conf = o.apply(conf)
	}
	return conf
}

// Option applies a configuration option value to a MeterProvider.
type Option interface {
	apply(config) config
}

// optionFunc applies a set of options to a config.
type optionFunc func(config) config

// apply returns a config with option(s) applied.
func (o optionFunc) apply(conf config) config {
	return o(conf)
}

// WithResource associates a Resource with a MeterProvider. This Resource
// represents the entity producing telemetry and is associated with all Meters
// the MeterProvider will create.
//
// By default, if this Option is not used, the default Resource from the
// go.opentelemetry.io/otel/sdk/resource package will be used.
func WithResource(res *resource.Resource) Option {
	return optionFunc(func(conf config) config {
		var err error
		conf.res, err = resource.Merge(resource.Environment(), res)
		if err != nil {
			otel.Handle(err)
		}
		return conf
	})
}

// WithReader associates Reader r with a MeterProvider.
//
// By default, if this option is not used, the MeterProvider will perform no
// operations; no data will be exported without a Reader.
func WithReader(r Reader) Option {
	return optionFunc(func(cfg config) config {
		if r == nil {
			return cfg
		}
		cfg.readers = append(cfg.readers, r)
		return cfg
	})
}

// WithView associates views with a MeterProvider.
//
// Views are appended to existing ones in a MeterProvider if this option is
// used multiple times.
//
// By default, if this option is not used, the MeterProvider will use the
// default view.
func WithView(views ...View) Option {
	return optionFunc(func(cfg config) config {
		cfg.views = append(cfg.views, views...)
		return cfg
	})
}

// WithExemplarFilter configures the exemplar filter.
//
// The exemplar filter determines which measurements are offered to the
// exemplar reservoir, but the exemplar reservoir makes the final decision of
// whether to store an exemplar.
//
// By default, the [exemplar.SampledFilter]
// is used. Exemplars can be entirely disabled by providing the
// [exemplar.AlwaysOffFilter].
func WithExemplarFilter(filter exemplar.Filter) Option {
	return optionFunc(func(cfg config) config {
		cfg.exemplarFilter = filter
		return cfg
	})
}

// WithCardinalityLimit sets the cardinality limit for the MeterProvider.
//
// The cardinality limit is the hard limit on the number of metric datapoints
// that can be collected for a single instrument in a single collect cycle.
//
// Setting this to a zero or negative value means no limit is applied.
func WithCardinalityLimit(limit int) Option {
	// For backward compatibility, the environment variable `OTEL_GO_X_CARDINALITY_LIMIT`
	// can also be used to set this value.
	return optionFunc(func(cfg config) config {
		cfg.cardinalityLimit = limit
		return cfg
	})
}

func meterProviderOptionsFromEnv() []Option {
	var opts []Option
	// https://github.com/open-telemetry/opentelemetry-specification/blob/d4b241f451674e8f611bb589477680341006ad2b/specification/configuration/sdk-environment-variables.md#exemplar
	const filterEnvKey = "OTEL_METRICS_EXEMPLAR_FILTER"

	switch strings.ToLower(strings.TrimSpace(os.Getenv(filterEnvKey))) {
	case "always_on":
		opts = append(opts, WithExemplarFilter(exemplar.AlwaysOnFilter))
	case "always_off":
		opts = append(opts, WithExemplarFilter(exemplar.AlwaysOffFilter))
	case "trace_based":
		opts = append(opts, WithExemplarFilter(exemplar.TraceBasedFilter))
	}
	return opts
}

func cardinalityLimitFromEnv() int {
	const cardinalityLimitKey = "OTEL_GO_X_CARDINALITY_LIMIT"
	v := strings.TrimSpace(os.Getenv(cardinalityLimitKey))
	if v == "" {
		return defaultCardinalityLimit
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		otel.Handle(err)
		return defaultCardinalityLimit
	}
	return n
}
