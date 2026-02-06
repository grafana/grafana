package operator

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/health"
	"github.com/grafana/grafana-app-sdk/metrics"
)

// ListWatchOptions are namespace, label selectors, and field selectors for filtering resources in ListWatch requests and Informers.
type ListWatchOptions struct {
	Namespace      string
	LabelFilters   []string
	FieldSelectors []string
}

// Controller is an interface that describes a controller which can be run as part of an operator
type Controller interface {
	app.Runnable
}

// Operator is the highest-level construct of the `operator` package,
// and contains one or more controllers which can be run.
// Operator handles scaling and error propagation for its underlying controllers
type Operator struct {
	controllers []Controller
}

// New creates a new Operator
func New() *Operator {
	return &Operator{
		controllers: make([]Controller, 0),
	}
}

// AddController adds a new controller to the operator.
// If called after `Run`, it will not be added to the currently-running controllers.
func (o *Operator) AddController(c Controller) {
	if o.controllers == nil {
		o.controllers = make([]Controller, 0)
	}
	o.controllers = append(o.controllers, c)
}

// PrometheusCollectors returns the prometheus metric collectors for all controllers which implement metrics.Provider
func (o *Operator) PrometheusCollectors() []prometheus.Collector {
	collectors := make([]prometheus.Collector, 0)
	for _, c := range o.controllers {
		if provider, ok := c.(metrics.Provider); ok {
			collectors = append(collectors, provider.PrometheusCollectors()...)
		}
	}
	return collectors
}

func (o *Operator) HealthChecks() []health.Check {
	checks := make([]health.Check, 0)
	for _, c := range o.controllers {
		if cast, ok := c.(health.Checker); ok {
			checks = append(checks, cast.HealthChecks()...)
		}

		if cast, ok := c.(health.Check); ok {
			checks = append(checks, cast)
		}
	}
	return checks
}

// Run runs the operator until an unrecoverable error occurs or the context is canceled.
func (o *Operator) Run(ctx context.Context) error {
	// TODO: operator should deal with scaling logic if possible.

	errs := make(chan error, len(o.controllers))
	derivedCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Start all controllers
	for _, controller := range o.controllers {
		go func(c Controller) {
			err := c.Run(derivedCtx)
			if err != nil {
				errs <- err
			}
		}(controller)
	}

	// Wait indefinitely until someone tells us to stop. or we encounter an error
	var err error
	select {
	case err = <-errs:
	case <-ctx.Done():
	}

	// If we encountered an error, return it (if we didn't, this will be nil)
	return err
}
