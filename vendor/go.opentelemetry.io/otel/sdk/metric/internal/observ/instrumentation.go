// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Package observ provides experimental observability instrumentation for the
// metric reader.
package observ // import "go.opentelemetry.io/otel/sdk/metric/internal/observ"

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/sdk"
	"go.opentelemetry.io/otel/sdk/internal/x"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
	"go.opentelemetry.io/otel/semconv/v1.37.0/otelconv"
)

const (
	// ScopeName is the unique name of the meter used for instrumentation.
	ScopeName = "go.opentelemetry.io/otel/sdk/metric/internal/observ"

	// SchemaURL is the schema URL of the metrics produced by this
	// instrumentation.
	SchemaURL = semconv.SchemaURL
)

var (
	measureAttrsPool = &sync.Pool{
		New: func() any {
			const n = 1 + // component.name
				1 + // component.type
				1 // error.type
			s := make([]attribute.KeyValue, 0, n)
			// Return a pointer to a slice instead of a slice itself
			// to avoid allocations on every call.
			return &s
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

// ComponentName returns the component name for the metric reader with the
// provided ComponentType and ID.
func ComponentName(componentType string, id int64) string {
	return fmt.Sprintf("%s/%d", componentType, id)
}

// Instrumentation is experimental instrumentation for the metric reader.
type Instrumentation struct {
	colDuration metric.Float64Histogram

	attrs  []attribute.KeyValue
	recOpt metric.RecordOption
}

// NewInstrumentation returns instrumentation for metric reader with the provided component
// type (such as periodic and manual metric reader) and ID. It uses the global
// MeterProvider to create the instrumentation.
//
// The id should be the unique metric reader instance ID. It is used
// to set the "component.name" attribute.
//
// If the experimental observability is disabled, nil is returned.
func NewInstrumentation(componentType string, id int64) (*Instrumentation, error) {
	if !x.Observability.Enabled() {
		return nil, nil
	}

	i := &Instrumentation{
		attrs: []attribute.KeyValue{
			semconv.OTelComponentName(ComponentName(componentType, id)),
			semconv.OTelComponentTypeKey.String(componentType),
		},
	}

	r := attribute.NewSet(i.attrs...)
	i.recOpt = metric.WithAttributeSet(r)

	meter := otel.GetMeterProvider().Meter(
		ScopeName,
		metric.WithInstrumentationVersion(sdk.Version()),
		metric.WithSchemaURL(SchemaURL),
	)

	colDuration, err := otelconv.NewSDKMetricReaderCollectionDuration(meter)
	if err != nil {
		err = fmt.Errorf("failed to create collection duration metric: %w", err)
	}
	i.colDuration = colDuration.Inst()

	return i, err
}

// CollectMetrics instruments the collect method of metric reader. It returns an
// [CollectOp] that must have its [CollectOp.End] method called when the
// collection end.
func (i *Instrumentation) CollectMetrics(ctx context.Context) CollectOp {
	start := time.Now()

	return CollectOp{
		ctx:   ctx,
		start: start,
		inst:  i,
	}
}

// CollectOp tracks the collect operation being observed by
// [Instrumentation.CollectMetrics].
type CollectOp struct {
	ctx   context.Context
	start time.Time

	inst *Instrumentation
}

// End completes the observation of the operation being observed by a call to
// [Instrumentation.CollectMetrics].
//
// Any error that is encountered is provided as err.
func (e CollectOp) End(err error) {
	recOpt := get[metric.RecordOption](recordOptPool)
	defer put(recordOptPool, recOpt)
	*recOpt = append(*recOpt, e.inst.recordOption(err))

	d := time.Since(e.start).Seconds()
	e.inst.colDuration.Record(e.ctx, d, *recOpt...)
}

// recordOption returns a RecordOption with attributes representing the
// outcome of the collection being recorded.
//
// If err is nil, the default recOpt of the Instrumentation is returned.
//
// Otherwise, a new RecordOption is returned with the base attributes of the
// Instrumentation plus the error.type attribute set to the type of the error.
func (i *Instrumentation) recordOption(err error) metric.RecordOption {
	if err == nil {
		return i.recOpt
	}

	attrs := get[attribute.KeyValue](measureAttrsPool)
	defer put(measureAttrsPool, attrs)
	*attrs = append(*attrs, i.attrs...)
	*attrs = append(*attrs, semconv.ErrorType(err))

	// Do not inefficiently make a copy of attrs by using WithAttributes
	// instead of WithAttributeSet.
	return metric.WithAttributeSet(attribute.NewSet(*attrs...))
}
