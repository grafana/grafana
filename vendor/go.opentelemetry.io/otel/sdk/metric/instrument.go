// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

//go:generate stringer -type=InstrumentKind -trimprefix=InstrumentKind

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/metric/embedded"
	"go.opentelemetry.io/otel/sdk/instrumentation"
	"go.opentelemetry.io/otel/sdk/metric/internal/aggregate"
	"go.opentelemetry.io/otel/sdk/metric/internal/x"
)

var zeroScope instrumentation.Scope

// InstrumentKind is the identifier of a group of instruments that all
// performing the same function.
type InstrumentKind uint8

const (
	// instrumentKindUndefined is an undefined instrument kind, it should not
	// be used by any initialized type.
	instrumentKindUndefined InstrumentKind = 0 // nolint:unused
	// InstrumentKindCounter identifies a group of instruments that record
	// increasing values synchronously with the code path they are measuring.
	InstrumentKindCounter InstrumentKind = 1
	// InstrumentKindUpDownCounter identifies a group of instruments that
	// record increasing and decreasing values synchronously with the code path
	// they are measuring.
	InstrumentKindUpDownCounter InstrumentKind = 2
	// InstrumentKindHistogram identifies a group of instruments that record a
	// distribution of values synchronously with the code path they are
	// measuring.
	InstrumentKindHistogram InstrumentKind = 3
	// InstrumentKindObservableCounter identifies a group of instruments that
	// record increasing values in an asynchronous callback.
	InstrumentKindObservableCounter InstrumentKind = 4
	// InstrumentKindObservableUpDownCounter identifies a group of instruments
	// that record increasing and decreasing values in an asynchronous
	// callback.
	InstrumentKindObservableUpDownCounter InstrumentKind = 5
	// InstrumentKindObservableGauge identifies a group of instruments that
	// record current values in an asynchronous callback.
	InstrumentKindObservableGauge InstrumentKind = 6
	// InstrumentKindGauge identifies a group of instruments that record
	// instantaneous values synchronously with the code path they are
	// measuring.
	InstrumentKindGauge InstrumentKind = 7
)

type nonComparable [0]func() // nolint: unused  // This is indeed used.

// Instrument describes properties an instrument is created with.
type Instrument struct {
	// Name is the human-readable identifier of the instrument.
	Name string
	// Description describes the purpose of the instrument.
	Description string
	// Kind defines the functional group of the instrument.
	Kind InstrumentKind
	// Unit is the unit of measurement recorded by the instrument.
	Unit string
	// Scope identifies the instrumentation that created the instrument.
	Scope instrumentation.Scope

	// Ensure forward compatibility if non-comparable fields need to be added.
	nonComparable // nolint: unused
}

// IsEmpty reports whether all Instrument fields are their zero-value.
func (i Instrument) IsEmpty() bool {
	return i.Name == "" &&
		i.Description == "" &&
		i.Kind == instrumentKindUndefined &&
		i.Unit == "" &&
		i.Scope == zeroScope
}

// matches returns whether all the non-zero-value fields of i match the
// corresponding fields of other. If i is empty it will match all other, and
// true will always be returned.
func (i Instrument) matches(other Instrument) bool {
	return i.matchesName(other) &&
		i.matchesDescription(other) &&
		i.matchesKind(other) &&
		i.matchesUnit(other) &&
		i.matchesScope(other)
}

// matchesName returns true if the Name of i is "" or it equals the Name of
// other, otherwise false.
func (i Instrument) matchesName(other Instrument) bool {
	return i.Name == "" || i.Name == other.Name
}

// matchesDescription returns true if the Description of i is "" or it equals
// the Description of other, otherwise false.
func (i Instrument) matchesDescription(other Instrument) bool {
	return i.Description == "" || i.Description == other.Description
}

// matchesKind returns true if the Kind of i is its zero-value or it equals the
// Kind of other, otherwise false.
func (i Instrument) matchesKind(other Instrument) bool {
	return i.Kind == instrumentKindUndefined || i.Kind == other.Kind
}

// matchesUnit returns true if the Unit of i is its zero-value or it equals the
// Unit of other, otherwise false.
func (i Instrument) matchesUnit(other Instrument) bool {
	return i.Unit == "" || i.Unit == other.Unit
}

// matchesScope returns true if the Scope of i is its zero-value or it equals
// the Scope of other, otherwise false.
func (i Instrument) matchesScope(other Instrument) bool {
	return (i.Scope.Name == "" || i.Scope.Name == other.Scope.Name) &&
		(i.Scope.Version == "" || i.Scope.Version == other.Scope.Version) &&
		(i.Scope.SchemaURL == "" || i.Scope.SchemaURL == other.Scope.SchemaURL)
}

// Stream describes the stream of data an instrument produces.
type Stream struct {
	// Name is the human-readable identifier of the stream.
	Name string
	// Description describes the purpose of the data.
	Description string
	// Unit is the unit of measurement recorded.
	Unit string
	// Aggregation the stream uses for an instrument.
	Aggregation Aggregation
	// AttributeFilter is an attribute Filter applied to the attributes
	// recorded for an instrument's measurement. If the filter returns false
	// the attribute will not be recorded, otherwise, if it returns true, it
	// will record the attribute.
	//
	// Use NewAllowKeysFilter from "go.opentelemetry.io/otel/attribute" to
	// provide an allow-list of attribute keys here.
	AttributeFilter attribute.Filter
	// ExemplarReservoirProvider selects the
	// [go.opentelemetry.io/otel/sdk/metric/exemplar.ReservoirProvider] based
	// on the [Aggregation].
	//
	// If unspecified, [DefaultExemplarReservoirProviderSelector] is used.
	ExemplarReservoirProviderSelector ExemplarReservoirProviderSelector
}

// instID are the identifying properties of a instrument.
type instID struct {
	// Name is the name of the stream.
	Name string
	// Description is the description of the stream.
	Description string
	// Kind defines the functional group of the instrument.
	Kind InstrumentKind
	// Unit is the unit of the stream.
	Unit string
	// Number is the number type of the stream.
	Number string
}

// Returns a normalized copy of the instID i.
//
// Instrument names are considered case-insensitive. Standardize the instrument
// name to always be lowercase for the returned instID so it can be compared
// without the name casing affecting the comparison.
func (i instID) normalize() instID {
	i.Name = strings.ToLower(i.Name)
	return i
}

type int64Inst struct {
	measures []aggregate.Measure[int64]

	embedded.Int64Counter
	embedded.Int64UpDownCounter
	embedded.Int64Histogram
	embedded.Int64Gauge
}

var (
	_ metric.Int64Counter       = (*int64Inst)(nil)
	_ metric.Int64UpDownCounter = (*int64Inst)(nil)
	_ metric.Int64Histogram     = (*int64Inst)(nil)
	_ metric.Int64Gauge         = (*int64Inst)(nil)
	_ x.EnabledInstrument       = (*int64Inst)(nil)
)

func (i *int64Inst) Add(ctx context.Context, val int64, opts ...metric.AddOption) {
	c := metric.NewAddConfig(opts)
	i.aggregate(ctx, val, c.Attributes())
}

func (i *int64Inst) Record(ctx context.Context, val int64, opts ...metric.RecordOption) {
	c := metric.NewRecordConfig(opts)
	i.aggregate(ctx, val, c.Attributes())
}

func (i *int64Inst) Enabled(context.Context) bool {
	return len(i.measures) != 0
}

func (i *int64Inst) aggregate(
	ctx context.Context,
	val int64,
	s attribute.Set,
) { // nolint:revive  // okay to shadow pkg with method.
	for _, in := range i.measures {
		in(ctx, val, s)
	}
}

type float64Inst struct {
	measures []aggregate.Measure[float64]

	embedded.Float64Counter
	embedded.Float64UpDownCounter
	embedded.Float64Histogram
	embedded.Float64Gauge
}

var (
	_ metric.Float64Counter       = (*float64Inst)(nil)
	_ metric.Float64UpDownCounter = (*float64Inst)(nil)
	_ metric.Float64Histogram     = (*float64Inst)(nil)
	_ metric.Float64Gauge         = (*float64Inst)(nil)
	_ x.EnabledInstrument         = (*float64Inst)(nil)
)

func (i *float64Inst) Add(ctx context.Context, val float64, opts ...metric.AddOption) {
	c := metric.NewAddConfig(opts)
	i.aggregate(ctx, val, c.Attributes())
}

func (i *float64Inst) Record(ctx context.Context, val float64, opts ...metric.RecordOption) {
	c := metric.NewRecordConfig(opts)
	i.aggregate(ctx, val, c.Attributes())
}

func (i *float64Inst) Enabled(context.Context) bool {
	return len(i.measures) != 0
}

func (i *float64Inst) aggregate(ctx context.Context, val float64, s attribute.Set) {
	for _, in := range i.measures {
		in(ctx, val, s)
	}
}

// observableID is a comparable unique identifier of an observable.
type observableID[N int64 | float64] struct {
	name        string
	description string
	kind        InstrumentKind
	unit        string
	scope       instrumentation.Scope
}

type float64Observable struct {
	metric.Float64Observable
	*observable[float64]

	embedded.Float64ObservableCounter
	embedded.Float64ObservableUpDownCounter
	embedded.Float64ObservableGauge
}

var (
	_ metric.Float64ObservableCounter       = float64Observable{}
	_ metric.Float64ObservableUpDownCounter = float64Observable{}
	_ metric.Float64ObservableGauge         = float64Observable{}
)

func newFloat64Observable(m *meter, kind InstrumentKind, name, desc, u string) float64Observable {
	return float64Observable{
		observable: newObservable[float64](m, kind, name, desc, u),
	}
}

type int64Observable struct {
	metric.Int64Observable
	*observable[int64]

	embedded.Int64ObservableCounter
	embedded.Int64ObservableUpDownCounter
	embedded.Int64ObservableGauge
}

var (
	_ metric.Int64ObservableCounter       = int64Observable{}
	_ metric.Int64ObservableUpDownCounter = int64Observable{}
	_ metric.Int64ObservableGauge         = int64Observable{}
)

func newInt64Observable(m *meter, kind InstrumentKind, name, desc, u string) int64Observable {
	return int64Observable{
		observable: newObservable[int64](m, kind, name, desc, u),
	}
}

type observable[N int64 | float64] struct {
	metric.Observable
	observableID[N]

	meter           *meter
	measures        measures[N]
	dropAggregation bool
}

func newObservable[N int64 | float64](m *meter, kind InstrumentKind, name, desc, u string) *observable[N] {
	return &observable[N]{
		observableID: observableID[N]{
			name:        name,
			description: desc,
			kind:        kind,
			unit:        u,
			scope:       m.scope,
		},
		meter: m,
	}
}

// observe records the val for the set of attrs.
func (o *observable[N]) observe(val N, s attribute.Set) {
	o.measures.observe(val, s)
}

func (o *observable[N]) appendMeasures(meas []aggregate.Measure[N]) {
	o.measures = append(o.measures, meas...)
}

type measures[N int64 | float64] []aggregate.Measure[N]

// observe records the val for the set of attrs.
func (m measures[N]) observe(val N, s attribute.Set) {
	for _, in := range m {
		in(context.Background(), val, s)
	}
}

var errEmptyAgg = errors.New("no aggregators for observable instrument")

// registerable returns an error if the observable o should not be registered,
// and nil if it should. An errEmptyAgg error is returned if o is effectively a
// no-op because it does not have any aggregators. Also, an error is returned
// if scope defines a Meter other than the one o was created by.
func (o *observable[N]) registerable(m *meter) error {
	if len(o.measures) == 0 {
		return errEmptyAgg
	}
	if m != o.meter {
		return fmt.Errorf(
			"invalid registration: observable %q from Meter %q, registered with Meter %q",
			o.name,
			o.scope.Name,
			m.scope.Name,
		)
	}
	return nil
}
