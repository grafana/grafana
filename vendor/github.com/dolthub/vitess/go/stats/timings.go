/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package stats

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/dolthub/vitess/go/sync2"
)

// Timings is meant to tracks timing data
// by named categories as well as histograms.
type Timings struct {
	totalCount sync2.AtomicInt64
	totalTime  sync2.AtomicInt64

	// mu protects get and set of hook and the map.
	// Modification to the value in the map is not protected.
	mu         sync.RWMutex
	histograms map[string]*Histogram
	hook       func(string, time.Duration)
	help       string
	label      string
}

// NewTimings creates a new Timings object, and publishes it if name is set.
// categories is an optional list of categories to initialize to 0.
// Categories that aren't initialized will be missing from the map until the
// first time they are updated.
func NewTimings(name, help, label string, categories ...string) *Timings {
	t := &Timings{
		histograms: make(map[string]*Histogram),
		help:       help,
		label:      label,
	}
	for _, cat := range categories {
		t.histograms[cat] = NewGenericHistogram("", "", bucketCutoffs, bucketLabels, "Count", "Time")
	}
	if name != "" {
		publish(name, t)
	}

	return t
}

// Add will add a new value to the named histogram.
func (t *Timings) Add(name string, elapsed time.Duration) {
	// Get existing Histogram.
	t.mu.RLock()
	hist, ok := t.histograms[name]
	hook := t.hook
	t.mu.RUnlock()

	// Create Histogram if it does not exist.
	if !ok {
		t.mu.Lock()
		hist, ok = t.histograms[name]
		if !ok {
			hist = NewGenericHistogram("", "", bucketCutoffs, bucketLabels, "Count", "Time")
			t.histograms[name] = hist
		}
		t.mu.Unlock()
	}

	elapsedNs := int64(elapsed)
	hist.Add(elapsedNs)
	t.totalCount.Add(1)
	t.totalTime.Add(elapsedNs)
	if hook != nil {
		hook(name, elapsed)
	}
}

// Record is a convenience function that records completion
// timing data based on the provided start time of an event.
func (t *Timings) Record(name string, startTime time.Time) {
	t.Add(name, time.Since(startTime))
}

// String is for expvar.
func (t *Timings) String() string {
	t.mu.RLock()
	defer t.mu.RUnlock()

	tm := struct {
		TotalCount int64
		TotalTime  int64
		Histograms map[string]*Histogram
	}{
		t.totalCount.Get(),
		t.totalTime.Get(),
		t.histograms,
	}

	data, err := json.Marshal(tm)
	if err != nil {
		data, _ = json.Marshal(err.Error())
	}
	return string(data)
}

// Histograms returns a map pointing at the histograms.
func (t *Timings) Histograms() (h map[string]*Histogram) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	h = make(map[string]*Histogram, len(t.histograms))
	for k, v := range t.histograms {
		h[k] = v
	}
	return
}

// Count returns the total count for all values.
func (t *Timings) Count() int64 {
	return t.totalCount.Get()
}

// Time returns the total time elapsed for all values.
func (t *Timings) Time() int64 {
	return t.totalTime.Get()
}

// Counts returns the total count for each value.
func (t *Timings) Counts() map[string]int64 {
	t.mu.RLock()
	defer t.mu.RUnlock()

	counts := make(map[string]int64, len(t.histograms)+1)
	for k, v := range t.histograms {
		counts[k] = v.Count()
	}
	counts["All"] = t.totalCount.Get()
	return counts
}

// Cutoffs returns the cutoffs used in the component histograms.
// Do not change the returned slice.
func (t *Timings) Cutoffs() []int64 {
	return bucketCutoffs
}

// Help returns the help string.
func (t *Timings) Help() string {
	return t.help
}

// Label returns the label name.
func (t *Timings) Label() string {
	return t.label
}

var bucketCutoffs = []int64{5e5, 1e6, 5e6, 1e7, 5e7, 1e8, 5e8, 1e9, 5e9, 1e10}

var bucketLabels []string

func init() {
	bucketLabels = make([]string, len(bucketCutoffs)+1)
	for i, v := range bucketCutoffs {
		bucketLabels[i] = fmt.Sprintf("%d", v)
	}
	bucketLabels[len(bucketLabels)-1] = "inf"
}

// MultiTimings is meant to tracks timing data by categories as well
// as histograms. The names of the categories are compound names made
// with joining multiple strings with '.'.
type MultiTimings struct {
	Timings
	labels []string
}

// NewMultiTimings creates a new MultiTimings object.
func NewMultiTimings(name string, help string, labels []string) *MultiTimings {
	t := &MultiTimings{
		Timings: Timings{
			histograms: make(map[string]*Histogram),
			help:       help,
		},
		labels: labels,
	}
	if name != "" {
		publish(name, t)
	}

	return t
}

// Labels returns descriptions of the parts of each compound category name.
func (mt *MultiTimings) Labels() []string {
	return mt.labels
}

// safeJoinLabels joins the label values with ".", but first replaces any existing
// "." characters in the labels with the proper replacement, to avoid issues parsing
// them apart later.
func safeJoinLabels(labels []string) string {
	sanitizedLabels := make([]string, len(labels))
	for idx, label := range labels {
		sanitizedLabels[idx] = safeLabel(label)
	}
	return strings.Join(sanitizedLabels, ".")
}

// Add will add a new value to the named histogram.
func (mt *MultiTimings) Add(names []string, elapsed time.Duration) {
	if len(names) != len(mt.labels) {
		panic("MultiTimings: wrong number of values in Add")
	}
	mt.Timings.Add(safeJoinLabels(names), elapsed)
}

// Record is a convenience function that records completion
// timing data based on the provided start time of an event.
func (mt *MultiTimings) Record(names []string, startTime time.Time) {
	if len(names) != len(mt.labels) {
		panic("MultiTimings: wrong number of values in Record")
	}
	mt.Timings.Record(safeJoinLabels(names), startTime)
}

// Cutoffs returns the cutoffs used in the component histograms.
// Do not change the returned slice.
func (mt *MultiTimings) Cutoffs() []int64 {
	return bucketCutoffs
}
