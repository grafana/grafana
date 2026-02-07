// Copyright 2024 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package promql

import (
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/value"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
)

type histogramStatsIterator struct {
	chunkenc.Iterator

	currentH *histogram.Histogram
	lastH    *histogram.Histogram

	currentFH *histogram.FloatHistogram
	lastFH    *histogram.FloatHistogram
}

// NewHistogramStatsIterator creates an iterator which returns histogram objects
// which have only their sum and count values populated. The iterator handles
// counter reset detection internally and sets the counter reset hint accordingly
// in each returned histogram objects.
func NewHistogramStatsIterator(it chunkenc.Iterator) chunkenc.Iterator {
	return &histogramStatsIterator{
		Iterator:  it,
		currentH:  &histogram.Histogram{},
		currentFH: &histogram.FloatHistogram{},
	}
}

// AtHistogram returns the next timestamp/histogram pair. The counter reset
// detection is guaranteed to be correct only when the caller does not switch
// between AtHistogram and AtFloatHistogram calls.
func (f *histogramStatsIterator) AtHistogram(h *histogram.Histogram) (int64, *histogram.Histogram) {
	var t int64
	t, f.currentH = f.Iterator.AtHistogram(f.currentH)
	if value.IsStaleNaN(f.currentH.Sum) {
		h = &histogram.Histogram{Sum: f.currentH.Sum}
		return t, h
	}

	if h == nil {
		h = &histogram.Histogram{
			CounterResetHint: f.getResetHint(f.currentH),
			Count:            f.currentH.Count,
			Sum:              f.currentH.Sum,
		}
		f.setLastH(f.currentH)
		return t, h
	}

	returnValue := histogram.Histogram{
		CounterResetHint: f.getResetHint(f.currentH),
		Count:            f.currentH.Count,
		Sum:              f.currentH.Sum,
	}
	returnValue.CopyTo(h)

	f.setLastH(f.currentH)
	return t, h
}

// AtFloatHistogram returns the next timestamp/float histogram pair. The counter
// reset detection is guaranteed to be correct only when the caller does not
// switch between AtHistogram and AtFloatHistogram calls.
func (f *histogramStatsIterator) AtFloatHistogram(fh *histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	var t int64
	t, f.currentFH = f.Iterator.AtFloatHistogram(f.currentFH)
	if value.IsStaleNaN(f.currentFH.Sum) {
		return t, &histogram.FloatHistogram{Sum: f.currentFH.Sum}
	}

	if fh == nil {
		fh = &histogram.FloatHistogram{
			CounterResetHint: f.getFloatResetHint(f.currentFH.CounterResetHint),
			Count:            f.currentFH.Count,
			Sum:              f.currentFH.Sum,
		}
		f.setLastFH(f.currentFH)
		return t, fh
	}

	returnValue := histogram.FloatHistogram{
		CounterResetHint: f.getFloatResetHint(f.currentFH.CounterResetHint),
		Count:            f.currentFH.Count,
		Sum:              f.currentFH.Sum,
	}
	returnValue.CopyTo(fh)

	f.setLastFH(f.currentFH)
	return t, fh
}

func (f *histogramStatsIterator) setLastH(h *histogram.Histogram) {
	if f.lastH == nil {
		f.lastH = h.Copy()
	} else {
		h.CopyTo(f.lastH)
	}
}

func (f *histogramStatsIterator) setLastFH(fh *histogram.FloatHistogram) {
	if f.lastFH == nil {
		f.lastFH = fh.Copy()
	} else {
		fh.CopyTo(f.lastFH)
	}
}

func (f *histogramStatsIterator) getFloatResetHint(hint histogram.CounterResetHint) histogram.CounterResetHint {
	if hint != histogram.UnknownCounterReset {
		return hint
	}
	if f.lastFH == nil {
		return histogram.NotCounterReset
	}

	if f.currentFH.DetectReset(f.lastFH) {
		return histogram.CounterReset
	}
	return histogram.NotCounterReset
}

func (f *histogramStatsIterator) getResetHint(h *histogram.Histogram) histogram.CounterResetHint {
	if h.CounterResetHint != histogram.UnknownCounterReset {
		return h.CounterResetHint
	}
	if f.lastH == nil {
		return histogram.NotCounterReset
	}

	fh, prevFH := h.ToFloat(nil), f.lastH.ToFloat(nil)
	if fh.DetectReset(prevFH) {
		return histogram.CounterReset
	}
	return histogram.NotCounterReset
}
