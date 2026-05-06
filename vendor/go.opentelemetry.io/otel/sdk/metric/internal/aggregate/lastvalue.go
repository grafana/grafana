// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package aggregate // import "go.opentelemetry.io/otel/sdk/metric/internal/aggregate"

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
)

// lastValuePoint is timestamped measurement data.
type lastValuePoint[N int64 | float64] struct {
	attrs attribute.Set
	value atomicN[N]
	res   FilteredExemplarReservoir[N]
}

// lastValueMap summarizes a set of measurements as the last one made.
type lastValueMap[N int64 | float64] struct {
	newRes func(attribute.Set) FilteredExemplarReservoir[N]
	values limitedSyncMap
}

func (s *lastValueMap[N]) measure(
	ctx context.Context,
	value N,
	fltrAttr attribute.Set,
	droppedAttr []attribute.KeyValue,
) {
	lv := s.values.LoadOrStoreAttr(fltrAttr, func(attr attribute.Set) any {
		return &lastValuePoint[N]{
			res:   s.newRes(attr),
			attrs: attr,
		}
	}).(*lastValuePoint[N])

	lv.value.Store(value)
	lv.res.Offer(ctx, value, droppedAttr)
}

func newDeltaLastValue[N int64 | float64](
	limit int,
	r func(attribute.Set) FilteredExemplarReservoir[N],
) *deltaLastValue[N] {
	return &deltaLastValue[N]{
		newRes: r,
		start:  now(),
		hotColdValMap: [2]lastValueMap[N]{
			{
				values: limitedSyncMap{aggLimit: limit},
				newRes: r,
			},
			{
				values: limitedSyncMap{aggLimit: limit},
				newRes: r,
			},
		},
	}
}

// deltaLastValue summarizes a set of measurements as the last one made.
type deltaLastValue[N int64 | float64] struct {
	newRes func(attribute.Set) FilteredExemplarReservoir[N]
	start  time.Time

	hcwg          hotColdWaitGroup
	hotColdValMap [2]lastValueMap[N]
}

func (s *deltaLastValue[N]) measure(
	ctx context.Context,
	value N,
	fltrAttr attribute.Set,
	droppedAttr []attribute.KeyValue,
) {
	hotIdx := s.hcwg.start()
	defer s.hcwg.done(hotIdx)
	s.hotColdValMap[hotIdx].measure(ctx, value, fltrAttr, droppedAttr)
}

func (s *deltaLastValue[N]) collect(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
) int {
	t := now()
	n := s.copyAndClearDpts(dest, t)
	// Update start time for delta temporality.
	s.start = t
	return n
}

// copyAndClearDpts copies the lastValuePoints held by s into dest. The number of lastValuePoints
// copied is returned.
func (s *deltaLastValue[N]) copyAndClearDpts(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
	t time.Time,
) int {
	// Ignore if dest is not a metricdata.Gauge. The chance for memory reuse of
	// the DataPoints is missed (better luck next time).
	gData, _ := (*dest).(metricdata.Gauge[N])
	// delta always clears values on collection
	readIdx := s.hcwg.swapHotAndWait()
	// The len will not change while we iterate over values, since we waited
	// for all writes to finish to the cold values and len.
	n := s.hotColdValMap[readIdx].values.Len()
	dPts := reset(gData.DataPoints, n, n)

	var i int
	s.hotColdValMap[readIdx].values.Range(func(_, value any) bool {
		v := value.(*lastValuePoint[N])
		dPts[i].Attributes = v.attrs
		dPts[i].StartTime = s.start
		dPts[i].Time = t
		dPts[i].Value = v.value.Load()
		collectExemplars[N](&dPts[i].Exemplars, v.res.Collect)
		i++
		return true
	})
	gData.DataPoints = dPts
	// Do not report stale values.
	s.hotColdValMap[readIdx].values.Clear()
	*dest = gData
	return i
}

// cumulativeLastValue summarizes a set of measurements as the last one made.
type cumulativeLastValue[N int64 | float64] struct {
	lastValueMap[N]
	start time.Time
}

func newCumulativeLastValue[N int64 | float64](
	limit int,
	r func(attribute.Set) FilteredExemplarReservoir[N],
) *cumulativeLastValue[N] {
	return &cumulativeLastValue[N]{
		lastValueMap: lastValueMap[N]{
			values: limitedSyncMap{aggLimit: limit},
			newRes: r,
		},
		start: now(),
	}
}

func (s *cumulativeLastValue[N]) collect(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
) int {
	t := now()
	// Ignore if dest is not a metricdata.Gauge. The chance for memory reuse of
	// the lastValuePoints is missed (better luck next time).
	gData, _ := (*dest).(metricdata.Gauge[N])

	// Values are being concurrently written while we iterate, so only use the
	// current length for capacity.
	dPts := reset(gData.DataPoints, 0, s.values.Len())

	var i int
	s.values.Range(func(_, value any) bool {
		v := value.(*lastValuePoint[N])
		newPt := metricdata.DataPoint[N]{
			Attributes: v.attrs,
			StartTime:  s.start,
			Time:       t,
			Value:      v.value.Load(),
		}
		collectExemplars[N](&newPt.Exemplars, v.res.Collect)
		dPts = append(dPts, newPt)
		i++
		return true
	})
	gData.DataPoints = dPts
	// TODO (#3006): This will use an unbounded amount of memory if there
	// are unbounded number of attribute sets being aggregated. Attribute
	// sets that become "stale" need to be forgotten so this will not
	// overload the system.
	*dest = gData

	return i
}

// newPrecomputedLastValue returns an aggregator that summarizes a set of
// observations as the last one made.
func newPrecomputedLastValue[N int64 | float64](
	limit int,
	r func(attribute.Set) FilteredExemplarReservoir[N],
) *precomputedLastValue[N] {
	return &precomputedLastValue[N]{deltaLastValue: newDeltaLastValue[N](limit, r)}
}

// precomputedLastValue summarizes a set of observations as the last one made.
type precomputedLastValue[N int64 | float64] struct {
	*deltaLastValue[N]
}

func (s *precomputedLastValue[N]) delta(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
) int {
	return s.collect(dest)
}

func (s *precomputedLastValue[N]) cumulative(
	dest *metricdata.Aggregation, //nolint:gocritic // The pointer is needed for the ComputeAggregation interface
) int {
	// Do not reset the start time.
	return s.copyAndClearDpts(dest, now())
}
