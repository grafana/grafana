// Copyright 2017 The Prometheus Authors
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
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql/parser"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/util/annotations"
)

func (Matrix) Type() parser.ValueType { return parser.ValueTypeMatrix }
func (Vector) Type() parser.ValueType { return parser.ValueTypeVector }
func (Scalar) Type() parser.ValueType { return parser.ValueTypeScalar }
func (String) Type() parser.ValueType { return parser.ValueTypeString }

// String represents a string value.
type String struct {
	T int64
	V string
}

func (s String) String() string {
	return s.V
}

func (s String) MarshalJSON() ([]byte, error) {
	return json.Marshal([...]interface{}{float64(s.T) / 1000, s.V})
}

// Scalar is a data point that's explicitly not associated with a metric.
type Scalar struct {
	T int64
	V float64
}

func (s Scalar) String() string {
	v := strconv.FormatFloat(s.V, 'f', -1, 64)
	return fmt.Sprintf("scalar: %v @[%v]", v, s.T)
}

func (s Scalar) MarshalJSON() ([]byte, error) {
	v := strconv.FormatFloat(s.V, 'f', -1, 64)
	return json.Marshal([...]interface{}{float64(s.T) / 1000, v})
}

// Series is a stream of data points belonging to a metric.
type Series struct {
	Metric     labels.Labels `json:"metric"`
	Floats     []FPoint      `json:"values,omitempty"`
	Histograms []HPoint      `json:"histograms,omitempty"`
	// DropName is used to indicate whether the __name__ label should be dropped
	// as part of the query evaluation.
	DropName bool `json:"-"`
}

func (s Series) String() string {
	// TODO(beorn7): This currently renders floats first and then
	// histograms, each sorted by timestamp. Maybe, in mixed series, that's
	// fine. Maybe, however, primary sorting by timestamp is preferred, in
	// which case this has to be changed.
	vals := make([]string, 0, len(s.Floats)+len(s.Histograms))
	for _, f := range s.Floats {
		vals = append(vals, f.String())
	}
	for _, h := range s.Histograms {
		vals = append(vals, h.String())
	}
	return fmt.Sprintf("%s =>\n%s", s.Metric, strings.Join(vals, "\n"))
}

// FPoint represents a single float data point for a given timestamp.
type FPoint struct {
	T int64
	F float64
}

func (p FPoint) String() string {
	s := strconv.FormatFloat(p.F, 'f', -1, 64)
	return fmt.Sprintf("%s @[%v]", s, p.T)
}

// MarshalJSON implements json.Marshaler.
//
// JSON marshaling is only needed for the HTTP API. Since FPoint is such a
// frequently marshaled type, it gets an optimized treatment directly in
// web/api/v1/api.go. Therefore, this method is unused within Prometheus. It is
// still provided here as convenience for debugging and for other users of this
// code. Also note that the different marshaling implementations might lead to
// slightly different results in terms of formatting and rounding of the
// timestamp.
func (p FPoint) MarshalJSON() ([]byte, error) {
	v := strconv.FormatFloat(p.F, 'f', -1, 64)
	return json.Marshal([...]interface{}{float64(p.T) / 1000, v})
}

// HPoint represents a single histogram data point for a given timestamp.
// H must never be nil.
type HPoint struct {
	T int64
	H *histogram.FloatHistogram
}

func (p HPoint) String() string {
	return fmt.Sprintf("%s @[%v]", p.H.String(), p.T)
}

// MarshalJSON implements json.Marshaler.
//
// JSON marshaling is only needed for the HTTP API. Since HPoint is such a
// frequently marshaled type, it gets an optimized treatment directly in
// web/api/v1/api.go. Therefore, this method is unused within Prometheus. It is
// still provided here as convenience for debugging and for other users of this
// code. Also note that the different marshaling implementations might lead to
// slightly different results in terms of formatting and rounding of the
// timestamp.
func (p HPoint) MarshalJSON() ([]byte, error) {
	h := struct {
		Count   string          `json:"count"`
		Sum     string          `json:"sum"`
		Buckets [][]interface{} `json:"buckets,omitempty"`
	}{
		Count: strconv.FormatFloat(p.H.Count, 'f', -1, 64),
		Sum:   strconv.FormatFloat(p.H.Sum, 'f', -1, 64),
	}
	it := p.H.AllBucketIterator()
	for it.Next() {
		bucket := it.At()
		if bucket.Count == 0 {
			continue // No need to expose empty buckets in JSON.
		}
		boundaries := 2 // Exclusive on both sides AKA open interval.
		if bucket.LowerInclusive {
			if bucket.UpperInclusive {
				boundaries = 3 // Inclusive on both sides AKA closed interval.
			} else {
				boundaries = 1 // Inclusive only on lower end AKA right open.
			}
		} else {
			if bucket.UpperInclusive {
				boundaries = 0 // Inclusive only on upper end AKA left open.
			}
		}
		bucketToMarshal := []interface{}{
			boundaries,
			strconv.FormatFloat(bucket.Lower, 'f', -1, 64),
			strconv.FormatFloat(bucket.Upper, 'f', -1, 64),
			strconv.FormatFloat(bucket.Count, 'f', -1, 64),
		}
		h.Buckets = append(h.Buckets, bucketToMarshal)
	}
	return json.Marshal([...]interface{}{float64(p.T) / 1000, h})
}

// size returns the size of the HPoint compared to the size of an FPoint.
// The total size is calculated considering the histogram timestamp (p.T - 8 bytes),
// and then a number of bytes in the histogram.
// This sum is divided by 16, as samples are 16 bytes.
func (p HPoint) size() int {
	return (p.H.Size() + 8) / 16
}

// totalHPointSize returns the total number of samples in the given slice of HPoints.
func totalHPointSize(histograms []HPoint) int {
	var total int
	for _, h := range histograms {
		total += h.size()
	}
	return total
}

// Sample is a single sample belonging to a metric. It represents either a float
// sample or a histogram sample. If H is nil, it is a float sample. Otherwise,
// it is a histogram sample.
type Sample struct {
	T int64
	F float64
	H *histogram.FloatHistogram

	Metric labels.Labels
	// DropName is used to indicate whether the __name__ label should be dropped
	// as part of the query evaluation.
	DropName bool
}

func (s Sample) String() string {
	var str string
	if s.H == nil {
		p := FPoint{T: s.T, F: s.F}
		str = p.String()
	} else {
		p := HPoint{T: s.T, H: s.H}
		str = p.String()
	}
	return fmt.Sprintf("%s => %s", s.Metric, str)
}

// MarshalJSON is mirrored in web/api/v1/api.go with jsoniter because FPoint and
// HPoint wouldn't be marshaled with jsoniter otherwise.
func (s Sample) MarshalJSON() ([]byte, error) {
	if s.H == nil {
		f := struct {
			M labels.Labels `json:"metric"`
			F FPoint        `json:"value"`
		}{
			M: s.Metric,
			F: FPoint{T: s.T, F: s.F},
		}
		return json.Marshal(f)
	}
	h := struct {
		M labels.Labels `json:"metric"`
		H HPoint        `json:"histogram"`
	}{
		M: s.Metric,
		H: HPoint{T: s.T, H: s.H},
	}
	return json.Marshal(h)
}

// Vector is basically only an alias for []Sample, but the contract is that
// in a Vector, all Samples have the same timestamp.
type Vector []Sample

func (vec Vector) String() string {
	entries := make([]string, len(vec))
	for i, s := range vec {
		entries[i] = s.String()
	}
	return strings.Join(entries, "\n")
}

// TotalSamples returns the total number of samples in the series within a vector.
// Float samples have a weight of 1 in this number, while histogram samples have a higher
// weight according to their size compared with the size of a float sample.
// See HPoint.size for details.
func (vec Vector) TotalSamples() int {
	numSamples := 0
	for _, sample := range vec {
		numSamples++
		if sample.H != nil {
			numSamples += sample.H.Size() / 16
		}
	}
	return numSamples
}

// ContainsSameLabelset checks if a vector has samples with the same labelset
// Such a behavior is semantically undefined
// https://github.com/prometheus/prometheus/issues/4562
func (vec Vector) ContainsSameLabelset() bool {
	switch len(vec) {
	case 0, 1:
		return false
	case 2:
		return vec[0].Metric.Hash() == vec[1].Metric.Hash()
	default:
		l := make(map[uint64]struct{}, len(vec))
		for _, ss := range vec {
			hash := ss.Metric.Hash()
			if _, ok := l[hash]; ok {
				return true
			}
			l[hash] = struct{}{}
		}
		return false
	}
}

// Matrix is a slice of Series that implements sort.Interface and
// has a String method.
type Matrix []Series

func (m Matrix) String() string {
	// TODO(fabxc): sort, or can we rely on order from the querier?
	strs := make([]string, len(m))

	for i, ss := range m {
		strs[i] = ss.String()
	}

	return strings.Join(strs, "\n")
}

// TotalSamples returns the total number of samples in the series within a matrix.
// Float samples have a weight of 1 in this number, while histogram samples have a higher
// weight according to their size compared with the size of a float sample.
// See HPoint.size for details.
func (m Matrix) TotalSamples() int {
	numSamples := 0
	for _, series := range m {
		numSamples += len(series.Floats) + totalHPointSize(series.Histograms)
	}
	return numSamples
}

func (m Matrix) Len() int           { return len(m) }
func (m Matrix) Less(i, j int) bool { return labels.Compare(m[i].Metric, m[j].Metric) < 0 }
func (m Matrix) Swap(i, j int)      { m[i], m[j] = m[j], m[i] }

// ContainsSameLabelset checks if a matrix has samples with the same labelset.
// Such a behavior is semantically undefined.
// https://github.com/prometheus/prometheus/issues/4562
func (m Matrix) ContainsSameLabelset() bool {
	switch len(m) {
	case 0, 1:
		return false
	case 2:
		return m[0].Metric.Hash() == m[1].Metric.Hash()
	default:
		l := make(map[uint64]struct{}, len(m))
		for _, ss := range m {
			hash := ss.Metric.Hash()
			if _, ok := l[hash]; ok {
				return true
			}
			l[hash] = struct{}{}
		}
		return false
	}
}

// Result holds the resulting value of an execution or an error
// if any occurred.
type Result struct {
	Err      error
	Value    parser.Value
	Warnings annotations.Annotations
}

// Vector returns a Vector if the result value is one. An error is returned if
// the result was an error or the result value is not a Vector.
func (r *Result) Vector() (Vector, error) {
	if r.Err != nil {
		return nil, r.Err
	}
	v, ok := r.Value.(Vector)
	if !ok {
		return nil, errors.New("query result is not a Vector")
	}
	return v, nil
}

// Matrix returns a Matrix. An error is returned if
// the result was an error or the result value is not a Matrix.
func (r *Result) Matrix() (Matrix, error) {
	if r.Err != nil {
		return nil, r.Err
	}
	v, ok := r.Value.(Matrix)
	if !ok {
		return nil, errors.New("query result is not a range Vector")
	}
	return v, nil
}

// Scalar returns a Scalar value. An error is returned if
// the result was an error or the result value is not a Scalar.
func (r *Result) Scalar() (Scalar, error) {
	if r.Err != nil {
		return Scalar{}, r.Err
	}
	v, ok := r.Value.(Scalar)
	if !ok {
		return Scalar{}, errors.New("query result is not a Scalar")
	}
	return v, nil
}

func (r *Result) String() string {
	if r.Err != nil {
		return r.Err.Error()
	}
	if r.Value == nil {
		return ""
	}
	return r.Value.String()
}

// StorageSeries simulates promql.Series as storage.Series.
type StorageSeries struct {
	series Series
}

// NewStorageSeries returns a StorageSeries from a Series.
func NewStorageSeries(series Series) *StorageSeries {
	return &StorageSeries{
		series: series,
	}
}

func (ss *StorageSeries) Labels() labels.Labels {
	return ss.series.Metric
}

// Iterator returns a new iterator of the data of the series. In case of
// multiple samples with the same timestamp, it returns the float samples first.
func (ss *StorageSeries) Iterator(it chunkenc.Iterator) chunkenc.Iterator {
	if ssi, ok := it.(*storageSeriesIterator); ok {
		ssi.reset(ss.series)
		return ssi
	}
	return newStorageSeriesIterator(ss.series)
}

type storageSeriesIterator struct {
	floats               []FPoint
	histograms           []HPoint
	iFloats, iHistograms int
	currT                int64
	currF                float64
	currH                *histogram.FloatHistogram
}

func newStorageSeriesIterator(series Series) *storageSeriesIterator {
	return &storageSeriesIterator{
		floats:      series.Floats,
		histograms:  series.Histograms,
		iFloats:     -1,
		iHistograms: 0,
		currT:       math.MinInt64,
	}
}

func (ssi *storageSeriesIterator) reset(series Series) {
	ssi.floats = series.Floats
	ssi.histograms = series.Histograms
	ssi.iFloats = -1
	ssi.iHistograms = 0
	ssi.currT = math.MinInt64
	ssi.currF = 0
	ssi.currH = nil
}

func (ssi *storageSeriesIterator) Seek(t int64) chunkenc.ValueType {
	if ssi.iFloats >= len(ssi.floats) && ssi.iHistograms >= len(ssi.histograms) {
		return chunkenc.ValNone
	}
	for ssi.currT < t {
		if ssi.Next() == chunkenc.ValNone {
			return chunkenc.ValNone
		}
	}
	if ssi.currH != nil {
		return chunkenc.ValFloatHistogram
	}
	return chunkenc.ValFloat
}

func (ssi *storageSeriesIterator) At() (t int64, v float64) {
	return ssi.currT, ssi.currF
}

func (ssi *storageSeriesIterator) AtHistogram(*histogram.Histogram) (int64, *histogram.Histogram) {
	panic(errors.New("storageSeriesIterator: AtHistogram not supported"))
}

func (ssi *storageSeriesIterator) AtFloatHistogram(*histogram.FloatHistogram) (int64, *histogram.FloatHistogram) {
	return ssi.currT, ssi.currH
}

func (ssi *storageSeriesIterator) AtT() int64 {
	return ssi.currT
}

func (ssi *storageSeriesIterator) Next() chunkenc.ValueType {
	if ssi.currH != nil {
		ssi.iHistograms++
	} else {
		ssi.iFloats++
	}
	var (
		pickH, pickF        = false, false
		floatsExhausted     = ssi.iFloats >= len(ssi.floats)
		histogramsExhausted = ssi.iHistograms >= len(ssi.histograms)
	)

	switch {
	case floatsExhausted:
		if histogramsExhausted { // Both exhausted!
			return chunkenc.ValNone
		}
		pickH = true
	case histogramsExhausted: // and floats not exhausted.
		pickF = true
	// From here on, we have to look at timestamps.
	case ssi.histograms[ssi.iHistograms].T < ssi.floats[ssi.iFloats].T:
		// Next histogram comes before next float.
		pickH = true
	default:
		// In all other cases, we pick float so that we first iterate
		// through floats if the timestamp is the same.
		pickF = true
	}

	switch {
	case pickF:
		p := ssi.floats[ssi.iFloats]
		ssi.currT = p.T
		ssi.currF = p.F
		ssi.currH = nil
		return chunkenc.ValFloat
	case pickH:
		p := ssi.histograms[ssi.iHistograms]
		ssi.currT = p.T
		ssi.currF = 0
		ssi.currH = p.H
		return chunkenc.ValFloatHistogram
	default:
		panic("storageSeriesIterator.Next failed to pick value type")
	}
}

func (ssi *storageSeriesIterator) Err() error {
	return nil
}
