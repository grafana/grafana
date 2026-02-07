// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package aggregate // import "go.opentelemetry.io/otel/sdk/metric/internal/aggregate"

import (
	"context"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
)

// datapoint is timestamped measurement data.
type datapoint[N int64 | float64] struct {
	attrs attribute.Set
	value N
	res   FilteredExemplarReservoir[N]
}

func newLastValue[N int64 | float64](limit int, r func(attribute.Set) FilteredExemplarReservoir[N]) *lastValue[N] {
	return &lastValue[N]{
		newRes: r,
		limit:  newLimiter[datapoint[N]](limit),
		values: make(map[attribute.Distinct]*datapoint[N]),
		start:  now(),
	}
}

// lastValue summarizes a set of measurements as the last one made.
type lastValue[N int64 | float64] struct {
	sync.Mutex

	newRes func(attribute.Set) FilteredExemplarReservoir[N]
	limit  limiter[datapoint[N]]
	values map[attribute.Distinct]*datapoint[N]
	start  time.Time
}

func (s *lastValue[N]) measure(ctx context.Context, value N, fltrAttr attribute.Set, droppedAttr []attribute.KeyValue) {
	s.Lock()
	defer s.Unlock()

	d, ok := s.values[fltrAttr.Equivalent()]
	if !ok {
		fltrAttr = s.limit.Attributes(fltrAttr, s.values)
		d = &datapoint[N]{
			res:   s.newRes(fltrAttr),
			attrs: fltrAttr,
		}
	}

	d.value = value
	d.res.Offer(ctx, value, droppedAttr)

	s.values[fltrAttr.Equivalent()] = d
}

func (s *lastValue[N]) delta(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
) int {
	t := now()
	// Ignore if dest is not a metricdata.Gauge. The chance for memory reuse of
	// the DataPoints is missed (better luck next time).
	gData, _ := (*dest).(metricdata.Gauge[N])

	s.Lock()
	defer s.Unlock()

	n := s.copyDpts(&gData.DataPoints, t)
	// Do not report stale values.
	clear(s.values)
	// Update start time for delta temporality.
	s.start = t

	*dest = gData

	return n
}

func (s *lastValue[N]) cumulative(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
) int {
	t := now()
	// Ignore if dest is not a metricdata.Gauge. The chance for memory reuse of
	// the DataPoints is missed (better luck next time).
	gData, _ := (*dest).(metricdata.Gauge[N])

	s.Lock()
	defer s.Unlock()

	n := s.copyDpts(&gData.DataPoints, t)
	// TODO (#3006): This will use an unbounded amount of memory if there
	// are unbounded number of attribute sets being aggregated. Attribute
	// sets that become "stale" need to be forgotten so this will not
	// overload the system.
	*dest = gData

	return n
}

// copyDpts copies the datapoints held by s into dest. The number of datapoints
// copied is returned.
func (s *lastValue[N]) copyDpts(dest *[]metricdata.DataPoint[N], t time.Time) int {
	n := len(s.values)
	*dest = reset(*dest, n, n)

	var i int
	for _, v := range s.values {
		(*dest)[i].Attributes = v.attrs
		(*dest)[i].StartTime = s.start
		(*dest)[i].Time = t
		(*dest)[i].Value = v.value
		collectExemplars(&(*dest)[i].Exemplars, v.res.Collect)
		i++
	}
	return n
}

// newPrecomputedLastValue returns an aggregator that summarizes a set of
// observations as the last one made.
func newPrecomputedLastValue[N int64 | float64](
	limit int,
	r func(attribute.Set) FilteredExemplarReservoir[N],
) *precomputedLastValue[N] {
	return &precomputedLastValue[N]{lastValue: newLastValue[N](limit, r)}
}

// precomputedLastValue summarizes a set of observations as the last one made.
type precomputedLastValue[N int64 | float64] struct {
	*lastValue[N]
}

func (s *precomputedLastValue[N]) delta(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
) int {
	t := now()
	// Ignore if dest is not a metricdata.Gauge. The chance for memory reuse of
	// the DataPoints is missed (better luck next time).
	gData, _ := (*dest).(metricdata.Gauge[N])

	s.Lock()
	defer s.Unlock()

	n := s.copyDpts(&gData.DataPoints, t)
	// Do not report stale values.
	clear(s.values)
	// Update start time for delta temporality.
	s.start = t

	*dest = gData

	return n
}

func (s *precomputedLastValue[N]) cumulative(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
) int {
	t := now()
	// Ignore if dest is not a metricdata.Gauge. The chance for memory reuse of
	// the DataPoints is missed (better luck next time).
	gData, _ := (*dest).(metricdata.Gauge[N])

	s.Lock()
	defer s.Unlock()

	n := s.copyDpts(&gData.DataPoints, t)
	// Do not report stale values.
	clear(s.values)
	*dest = gData

	return n
}
