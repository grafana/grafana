/*
 *
 * Copyright 2017 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package stats

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"time"
)

// Features contains most fields for a benchmark
type Features struct {
	NetworkMode        string
	EnableTrace        bool
	Latency            time.Duration
	Kbps               int
	Mtu                int
	MaxConcurrentCalls int
	ReqSizeBytes       int
	RespSizeBytes      int
	EnableCompressor   bool
}

// String returns the textual output of the Features as string.
func (f Features) String() string {
	return fmt.Sprintf("traceMode_%t-latency_%s-kbps_%#v-MTU_%#v-maxConcurrentCalls_"+
		"%#v-reqSize_%#vB-respSize_%#vB-Compressor_%t", f.EnableTrace,
		f.Latency.String(), f.Kbps, f.Mtu, f.MaxConcurrentCalls, f.ReqSizeBytes, f.RespSizeBytes, f.EnableCompressor)
}

// PartialPrintString can print certain features with different format.
func PartialPrintString(noneEmptyPos []bool, f Features, shared bool) string {
	s := ""
	var (
		prefix, suffix, linker string
		isNetwork              bool
	)
	if shared {
		suffix = "\n"
		linker = ": "
	} else {
		prefix = "-"
		linker = "_"
	}
	if noneEmptyPos[0] {
		s += fmt.Sprintf("%sTrace%s%t%s", prefix, linker, f.EnableCompressor, suffix)
	}
	if shared && f.NetworkMode != "" {
		s += fmt.Sprintf("Network: %s \n", f.NetworkMode)
		isNetwork = true
	}
	if !isNetwork {
		if noneEmptyPos[1] {
			s += fmt.Sprintf("%slatency%s%s%s", prefix, linker, f.Latency.String(), suffix)
		}
		if noneEmptyPos[2] {
			s += fmt.Sprintf("%skbps%s%#v%s", prefix, linker, f.Kbps, suffix)
		}
		if noneEmptyPos[3] {
			s += fmt.Sprintf("%sMTU%s%#v%s", prefix, linker, f.Mtu, suffix)
		}
	}
	if noneEmptyPos[4] {
		s += fmt.Sprintf("%sCallers%s%#v%s", prefix, linker, f.MaxConcurrentCalls, suffix)
	}
	if noneEmptyPos[5] {
		s += fmt.Sprintf("%sreqSize%s%#vB%s", prefix, linker, f.ReqSizeBytes, suffix)
	}
	if noneEmptyPos[6] {
		s += fmt.Sprintf("%srespSize%s%#vB%s", prefix, linker, f.RespSizeBytes, suffix)
	}
	if noneEmptyPos[7] {
		s += fmt.Sprintf("%sCompressor%s%t%s", prefix, linker, f.EnableCompressor, suffix)
	}
	return s
}

type percentLatency struct {
	Percent int
	Value   time.Duration
}

// BenchResults records features and result of a benchmark.
type BenchResults struct {
	RunMode           string
	Features          Features
	Latency           []percentLatency
	Operations        int
	NsPerOp           int64
	AllocedBytesPerOp int64
	AllocsPerOp       int64
	SharedPosion      []bool
}

// SetBenchmarkResult sets features of benchmark and basic results.
func (stats *Stats) SetBenchmarkResult(mode string, features Features, o int, allocdBytes, allocs int64, sharedPos []bool) {
	stats.result.RunMode = mode
	stats.result.Features = features
	stats.result.Operations = o
	stats.result.AllocedBytesPerOp = allocdBytes
	stats.result.AllocsPerOp = allocs
	stats.result.SharedPosion = sharedPos
}

// GetBenchmarkResults returns the result of the benchmark including features and result.
func (stats *Stats) GetBenchmarkResults() BenchResults {
	return stats.result
}

// BenchString output latency stats as the format as time + unit.
func (stats *Stats) BenchString() string {
	stats.maybeUpdate()
	s := stats.result
	res := s.RunMode + "-" + s.Features.String() + ": \n"
	if len(s.Latency) != 0 {
		var statsUnit = s.Latency[0].Value
		var timeUnit = fmt.Sprintf("%v", statsUnit)[1:]
		for i := 1; i < len(s.Latency)-1; i++ {
			res += fmt.Sprintf("%d_Latency: %s %s \t", s.Latency[i].Percent,
				strconv.FormatFloat(float64(s.Latency[i].Value)/float64(statsUnit), 'f', 4, 64), timeUnit)
		}
		res += fmt.Sprintf("Avg latency: %s %s \t",
			strconv.FormatFloat(float64(s.Latency[len(s.Latency)-1].Value)/float64(statsUnit), 'f', 4, 64), timeUnit)
	}
	res += fmt.Sprintf("Count: %v \t", s.Operations)
	res += fmt.Sprintf("%v Bytes/op\t", s.AllocedBytesPerOp)
	res += fmt.Sprintf("%v Allocs/op\t", s.AllocsPerOp)

	return res
}

// Stats is a simple helper for gathering additional statistics like histogram
// during benchmarks. This is not thread safe.
type Stats struct {
	numBuckets int
	unit       time.Duration
	min, max   int64
	histogram  *Histogram

	durations durationSlice
	dirty     bool

	sortLatency bool
	result      BenchResults
}

type durationSlice []time.Duration

// NewStats creates a new Stats instance. If numBuckets is not positive,
// the default value (16) will be used.
func NewStats(numBuckets int) *Stats {
	if numBuckets <= 0 {
		numBuckets = 16
	}
	return &Stats{
		// Use one more bucket for the last unbounded bucket.
		numBuckets: numBuckets + 1,
		durations:  make(durationSlice, 0, 100000),
	}
}

// Add adds an elapsed time per operation to the stats.
func (stats *Stats) Add(d time.Duration) {
	stats.durations = append(stats.durations, d)
	stats.dirty = true
}

// Clear resets the stats, removing all values.
func (stats *Stats) Clear() {
	stats.durations = stats.durations[:0]
	stats.histogram = nil
	stats.dirty = false
	stats.result = BenchResults{}
}

//Sort method for durations
func (a durationSlice) Len() int           { return len(a) }
func (a durationSlice) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a durationSlice) Less(i, j int) bool { return a[i] < a[j] }
func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// maybeUpdate updates internal stat data if there was any newly added
// stats since this was updated.
func (stats *Stats) maybeUpdate() {
	if !stats.dirty {
		return
	}

	if stats.sortLatency {
		sort.Sort(stats.durations)
		stats.min = int64(stats.durations[0])
		stats.max = int64(stats.durations[len(stats.durations)-1])
	}

	stats.min = math.MaxInt64
	stats.max = 0
	for _, d := range stats.durations {
		if stats.min > int64(d) {
			stats.min = int64(d)
		}
		if stats.max < int64(d) {
			stats.max = int64(d)
		}
	}

	// Use the largest unit that can represent the minimum time duration.
	stats.unit = time.Nanosecond
	for _, u := range []time.Duration{time.Microsecond, time.Millisecond, time.Second} {
		if stats.min <= int64(u) {
			break
		}
		stats.unit = u
	}

	numBuckets := stats.numBuckets
	if n := int(stats.max - stats.min + 1); n < numBuckets {
		numBuckets = n
	}
	stats.histogram = NewHistogram(HistogramOptions{
		NumBuckets: numBuckets,
		// max-min(lower bound of last bucket) = (1 + growthFactor)^(numBuckets-2) * baseBucketSize.
		GrowthFactor:   math.Pow(float64(stats.max-stats.min), 1/float64(numBuckets-2)) - 1,
		BaseBucketSize: 1.0,
		MinValue:       stats.min})

	for _, d := range stats.durations {
		stats.histogram.Add(int64(d))
	}

	stats.dirty = false

	if stats.durations.Len() != 0 {
		var percentToObserve = []int{50, 90, 99}
		// First data record min unit from the latency result.
		stats.result.Latency = append(stats.result.Latency, percentLatency{Percent: -1, Value: stats.unit})
		for _, position := range percentToObserve {
			stats.result.Latency = append(stats.result.Latency, percentLatency{Percent: position, Value: stats.durations[max(stats.histogram.Count*int64(position)/100-1, 0)]})
		}
		// Last data record the average latency.
		avg := float64(stats.histogram.Sum) / float64(stats.histogram.Count)
		stats.result.Latency = append(stats.result.Latency, percentLatency{Percent: -1, Value: time.Duration(avg)})
	}
}

// SortLatency blocks the output
func (stats *Stats) SortLatency() {
	stats.sortLatency = true
}

// Print writes textual output of the Stats.
func (stats *Stats) Print(w io.Writer) {
	stats.maybeUpdate()
	if stats.histogram == nil {
		fmt.Fprint(w, "Histogram (empty)\n")
	} else {
		fmt.Fprintf(w, "Histogram (unit: %s)\n", fmt.Sprintf("%v", stats.unit)[1:])
		stats.histogram.PrintWithUnit(w, float64(stats.unit))
	}
}

// String returns the textual output of the Stats as string.
func (stats *Stats) String() string {
	var b bytes.Buffer
	stats.Print(&b)
	return b.String()
}
