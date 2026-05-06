// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlpmetrichttp // import "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp/internal/oconf"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp/internal/transform"
	"go.opentelemetry.io/otel/internal/global"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	metricpb "go.opentelemetry.io/proto/otlp/metrics/v1"
)

// Exporter is a OpenTelemetry metric Exporter using protobufs over HTTP.
type Exporter struct {
	// Ensure synchronous access to the client across all functionality.
	clientMu sync.Mutex
	client   interface {
		UploadMetrics(context.Context, *metricpb.ResourceMetrics) error
		Shutdown(context.Context) error
	}

	temporalitySelector metric.TemporalitySelector
	aggregationSelector metric.AggregationSelector

	shutdownOnce sync.Once
}

func newExporter(c *client, cfg oconf.Config) (*Exporter, error) {
	ts := cfg.Metrics.TemporalitySelector
	if ts == nil {
		ts = func(metric.InstrumentKind) metricdata.Temporality {
			return metricdata.CumulativeTemporality
		}
	}

	as := cfg.Metrics.AggregationSelector
	if as == nil {
		as = metric.DefaultAggregationSelector
	}

	return &Exporter{
		client: c,

		temporalitySelector: ts,
		aggregationSelector: as,
	}, nil
}

// Temporality returns the Temporality to use for an instrument kind.
func (e *Exporter) Temporality(k metric.InstrumentKind) metricdata.Temporality {
	return e.temporalitySelector(k)
}

// Aggregation returns the Aggregation to use for an instrument kind.
func (e *Exporter) Aggregation(k metric.InstrumentKind) metric.Aggregation {
	return e.aggregationSelector(k)
}

// Export transforms and transmits metric data to an OTLP receiver.
//
// This method returns an error if called after Shutdown.
// This method returns an error if the method is canceled by the passed context.
func (e *Exporter) Export(ctx context.Context, rm *metricdata.ResourceMetrics) error {
	defer global.Debug("OTLP/HTTP exporter export", "Data", rm)

	otlpRm, err := transform.ResourceMetrics(rm)
	// Best effort upload of transformable metrics.
	e.clientMu.Lock()
	upErr := e.client.UploadMetrics(ctx, otlpRm)
	e.clientMu.Unlock()
	if upErr != nil {
		if err == nil {
			return fmt.Errorf("failed to upload metrics: %w", upErr)
		}
		// Merge the two errors.
		return fmt.Errorf("failed to upload incomplete metrics (%w): %w", err, upErr)
	}
	return err
}

// ForceFlush flushes any metric data held by an exporter.
//
// This method returns an error if called after Shutdown.
// This method returns an error if the method is canceled by the passed context.
//
// This method is safe to call concurrently.
func (e *Exporter) ForceFlush(ctx context.Context) error {
	// The exporter and client hold no state, nothing to flush.
	return ctx.Err()
}

// Shutdown flushes all metric data held by an exporter and releases any held
// computational resources.
//
// This method returns an error if called after Shutdown.
// This method returns an error if the method is canceled by the passed context.
//
// This method is safe to call concurrently.
func (e *Exporter) Shutdown(ctx context.Context) error {
	err := errShutdown
	e.shutdownOnce.Do(func() {
		e.clientMu.Lock()
		client := e.client
		e.client = shutdownClient{}
		e.clientMu.Unlock()
		err = client.Shutdown(ctx)
	})
	return err
}

var errShutdown = errors.New("HTTP exporter is shutdown")

type shutdownClient struct{}

func (c shutdownClient) err(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	return errShutdown
}

func (c shutdownClient) UploadMetrics(ctx context.Context, _ *metricpb.ResourceMetrics) error {
	return c.err(ctx)
}

func (c shutdownClient) Shutdown(ctx context.Context) error {
	return c.err(ctx)
}

// MarshalLog returns logging data about the Exporter.
func (e *Exporter) MarshalLog() interface{} {
	return struct{ Type string }{Type: "OTLP/HTTP"}
}

// New returns an OpenTelemetry metric Exporter. The Exporter can be used with
// a PeriodicReader to export OpenTelemetry metric data to an OTLP receiving
// endpoint using protobufs over HTTP.
func New(_ context.Context, opts ...Option) (*Exporter, error) {
	cfg := oconf.NewHTTPConfig(asHTTPOptions(opts)...)
	c, err := newClient(cfg)
	if err != nil {
		return nil, err
	}
	return newExporter(c, cfg)
}
