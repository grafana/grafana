// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Package observ provides experimental observability instrumentation
// for the prometheus exporter.
package observ // import "go.opentelemetry.io/otel/exporters/prometheus/internal/observ"

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/prometheus/internal"
	"go.opentelemetry.io/otel/exporters/prometheus/internal/x"
	"go.opentelemetry.io/otel/metric"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
	"go.opentelemetry.io/otel/semconv/v1.37.0/otelconv"
)

const (
	// ComponentType uniquely identifies the OpenTelemetry Exporter component
	// being instrumented.
	ComponentType = "go.opentelemetry.io/otel/exporters/prometheus/prometheus.Exporter"

	// ScopeName is the unique name of the meter used for instrumentation.
	ScopeName = "go.opentelemetry.io/otel/exporters/prometheus/internal/observ"

	// SchemaURL is the schema URL of the metrics produced by this
	// instrumentation.
	SchemaURL = semconv.SchemaURL

	// Version is the current version of this instrumentation.
	//
	// This matches the version of the exporter.
	Version = internal.Version
)

var (
	measureAttrsPool = &sync.Pool{
		New: func() any {
			// "component.name" + "component.type" + "error.type"
			const n = 1 + 1 + 1
			s := make([]attribute.KeyValue, 0, n)
			// Return a pointer to a slice instead of a slice itself
			// to avoid allocations on every call.
			return &s
		},
	}

	addOptPool = &sync.Pool{
		New: func() any {
			const n = 1 // WithAttributeSet
			o := make([]metric.AddOption, 0, n)
			return &o
		},
	}

	recordOptPool = &sync.Pool{
		New: func() any {
			const n = 1 // WithAttributeSet
			o := make([]metric.RecordOption, 0, n)
			return &o
		},
	}
)

func get[T any](p *sync.Pool) *[]T { return p.Get().(*[]T) }

func put[T any](p *sync.Pool, s *[]T) {
	*s = (*s)[:0] // Reset.
	p.Put(s)
}

func ComponentName(id int64) string {
	return fmt.Sprintf("%s/%d", ComponentType, id)
}

type Instrumentation struct {
	inflightMetric     metric.Int64UpDownCounter
	exportedMetric     metric.Int64Counter
	operationDuration  metric.Float64Histogram
	collectionDuration metric.Float64Histogram

	attrs  []attribute.KeyValue
	setOpt metric.MeasurementOption
}

func NewInstrumentation(id int64) (*Instrumentation, error) {
	if !x.Observability.Enabled() {
		return nil, nil
	}

	i := &Instrumentation{
		attrs: []attribute.KeyValue{
			semconv.OTelComponentName(ComponentName(id)),
			semconv.OTelComponentTypeKey.String(ComponentType),
		},
	}

	s := attribute.NewSet(i.attrs...)
	i.setOpt = metric.WithAttributeSet(s)

	mp := otel.GetMeterProvider()
	m := mp.Meter(
		ScopeName,
		metric.WithInstrumentationVersion(Version),
		metric.WithSchemaURL(SchemaURL),
	)

	var err, e error

	inflightMetric, e := otelconv.NewSDKExporterMetricDataPointInflight(m)
	if e != nil {
		e = fmt.Errorf("failed to create inflight metric: %w", e)
		err = errors.Join(err, e)
	}
	i.inflightMetric = inflightMetric.Inst()

	exportedMetric, e := otelconv.NewSDKExporterMetricDataPointExported(m)
	if e != nil {
		e = fmt.Errorf("failed to create exported metric: %w", e)
		err = errors.Join(err, e)
	}
	i.exportedMetric = exportedMetric.Inst()

	operationDuration, e := otelconv.NewSDKExporterOperationDuration(m)
	if e != nil {
		e = fmt.Errorf("failed to create operation duration metric: %w", e)
		err = errors.Join(err, e)
	}
	i.operationDuration = operationDuration.Inst()

	collectionDuration, e := otelconv.NewSDKMetricReaderCollectionDuration(m)
	if e != nil {
		e = fmt.Errorf("failed to create collection duration metric: %w", e)
		err = errors.Join(err, e)
	}
	i.collectionDuration = collectionDuration.Inst()

	return i, err
}

// RecordOperationDuration starts the timing of an operation.
//
// It returns a [Timer] that tracks the operation duration. The [Timer.Stop]
// method must be called when the operation completes.
func (i *Instrumentation) RecordOperationDuration(ctx context.Context) Timer {
	return Timer{
		ctx:   ctx,
		start: time.Now(),
		inst:  i,
		hist:  i.operationDuration,
	}
}

// RecordCollectionDuration starts the timing of a collection operation.
//
// It returns a [Timer] that tracks the collection duration. The [Timer.Stop]
// method must be called when the collection completes.
func (i *Instrumentation) RecordCollectionDuration(ctx context.Context) Timer {
	return Timer{
		ctx:   ctx,
		start: time.Now(),
		inst:  i,
		hist:  i.collectionDuration,
	}
}

// Timer tracks the duration of an operation.
type Timer struct {
	ctx   context.Context
	start time.Time

	inst *Instrumentation
	hist metric.Float64Histogram
}

// Stop ends the timing operation and records the elapsed duration.
//
// If err is non-nil, an appropriate error type attribute will be included.
func (t Timer) Stop(err error) {
	recordOpt := get[metric.RecordOption](recordOptPool)
	defer put(recordOptPool, recordOpt)
	*recordOpt = append(*recordOpt, t.inst.setOpt)

	if err != nil {
		attrs := get[attribute.KeyValue](measureAttrsPool)
		defer put(measureAttrsPool, attrs)
		*attrs = append(*attrs, t.inst.attrs...)
		*attrs = append(*attrs, semconv.ErrorType(err))

		set := attribute.NewSet(*attrs...)
		*recordOpt = append((*recordOpt)[:0], metric.WithAttributeSet(set))
	}

	t.hist.Record(t.ctx, time.Since(t.start).Seconds(), *recordOpt...)
}

// ExportMetrics starts the observation of a metric export operation.
//
// It returns an [ExportOp] that tracks the export operation. The
// [ExportOp.End] method must be called when the export completes.
func (i *Instrumentation) ExportMetrics(ctx context.Context, n int64) ExportOp {
	addOpt := get[metric.AddOption](addOptPool)
	defer put(addOptPool, addOpt)
	*addOpt = append(*addOpt, i.setOpt)

	i.inflightMetric.Add(ctx, n, *addOpt...)

	return ExportOp{ctx: ctx, nMetrics: n, inst: i}
}

// ExportOp tracks a metric export operation.
type ExportOp struct {
	ctx      context.Context
	nMetrics int64

	inst *Instrumentation
}

// End ends the observation of a metric export operation.
//
// The success parameter is the number of metrics that were successfully
// exported. If a non-nil error is provided, the number of failed metrics will
// be recorded with the error type attribute.
func (e ExportOp) End(success int64, err error) {
	addOpt := get[metric.AddOption](addOptPool)
	defer put(addOptPool, addOpt)
	*addOpt = append(*addOpt, e.inst.setOpt)

	e.inst.inflightMetric.Add(e.ctx, -e.nMetrics, *addOpt...)
	e.inst.exportedMetric.Add(e.ctx, success, *addOpt...)

	if err != nil {
		attrs := get[attribute.KeyValue](measureAttrsPool)
		defer put(measureAttrsPool, attrs)
		*attrs = append(*attrs, e.inst.attrs...)
		*attrs = append(*attrs, semconv.ErrorType(err))

		set := attribute.NewSet(*attrs...)

		*addOpt = append((*addOpt)[:0], metric.WithAttributeSet(set))
		e.inst.exportedMetric.Add(e.ctx, e.nMetrics-success, *addOpt...)
	}
}
