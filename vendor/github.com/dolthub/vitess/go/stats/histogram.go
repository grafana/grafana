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
	"bytes"
	"fmt"

	"github.com/dolthub/vitess/go/sync2"
)

// Histogram tracks counts and totals while
// splitting the counts under different buckets
// using specified cutoffs.
type Histogram struct {
	help       string
	cutoffs    []int64
	labels     []string
	countLabel string
	totalLabel string
	hook       func(int64)

	buckets []sync2.AtomicInt64
	total   sync2.AtomicInt64
}

// NewHistogram creates a histogram with auto-generated labels
// based on the cutoffs. The buckets are categorized using the
// following criterion: cutoff[i-1] < value <= cutoff[i]. Anything
// higher than the highest cutoff is labeled as "inf".
func NewHistogram(name, help string, cutoffs []int64) *Histogram {
	labels := make([]string, len(cutoffs)+1)
	for i, v := range cutoffs {
		labels[i] = fmt.Sprintf("%d", v)
	}
	labels[len(labels)-1] = "inf"
	return NewGenericHistogram(name, help, cutoffs, labels, "Count", "Total")
}

// NewGenericHistogram creates a histogram where all the labels are
// supplied by the caller. The number of labels has to be one more than
// the number of cutoffs because the last label captures everything that
// exceeds the highest cutoff.
func NewGenericHistogram(name, help string, cutoffs []int64, labels []string, countLabel, totalLabel string) *Histogram {
	if len(cutoffs) != len(labels)-1 {
		panic("mismatched cutoff and label lengths")
	}
	h := &Histogram{
		help:       help,
		cutoffs:    cutoffs,
		labels:     labels,
		countLabel: countLabel,
		totalLabel: totalLabel,
		buckets:    make([]sync2.AtomicInt64, len(labels)),
	}
	if name != "" {
		publish(name, h)
	}
	return h
}

// Add adds a new measurement to the Histogram.
func (h *Histogram) Add(value int64) {
	for i := range h.labels {
		if i == len(h.labels)-1 || value <= h.cutoffs[i] {
			h.buckets[i].Add(1)
			h.total.Add(value)
			break
		}
	}
	if h.hook != nil {
		h.hook(value)
	}
}

// String returns a string representation of the Histogram.
// Note that sum of all buckets may not be equal to the total temporarily,
// because Add() increments bucket and total with two atomic operations.
func (h *Histogram) String() string {
	b, _ := h.MarshalJSON()
	return string(b)
}

// MarshalJSON returns a JSON representation of the Histogram.
// Note that sum of all buckets may not be equal to the total temporarily,
// because Add() increments bucket and total with two atomic operations.
func (h *Histogram) MarshalJSON() ([]byte, error) {
	b := bytes.NewBuffer(make([]byte, 0, 4096))
	fmt.Fprintf(b, "{")
	totalCount := int64(0)
	for i, label := range h.labels {
		totalCount += h.buckets[i].Get()
		fmt.Fprintf(b, "\"%v\": %v, ", label, totalCount)
	}
	fmt.Fprintf(b, "\"%s\": %v, ", h.countLabel, totalCount)
	fmt.Fprintf(b, "\"%s\": %v", h.totalLabel, h.total.Get())
	fmt.Fprintf(b, "}")
	return b.Bytes(), nil
}

// Counts returns a map from labels to the current count in the Histogram for that label.
func (h *Histogram) Counts() map[string]int64 {
	counts := make(map[string]int64, len(h.labels))
	for i, label := range h.labels {
		counts[label] = h.buckets[i].Get()
	}
	return counts
}

// CountLabel returns the count label that was set when this Histogram was created.
func (h *Histogram) CountLabel() string {
	return h.countLabel
}

// Count returns the number of times Add has been called.
func (h *Histogram) Count() (count int64) {
	for i := range h.buckets {
		count += h.buckets[i].Get()
	}
	return
}

// TotalLabel returns the total label that was set when this Histogram was created.
func (h *Histogram) TotalLabel() string {
	return h.totalLabel
}

// Total returns the sum of all values that have been added to this Histogram.
func (h *Histogram) Total() (total int64) {
	return h.total.Get()
}

// Labels returns the labels that were set when this Histogram was created.
func (h *Histogram) Labels() []string {
	return h.labels
}

// Cutoffs returns the cutoffs that were set when this Histogram was created.
func (h *Histogram) Cutoffs() []int64 {
	return h.cutoffs
}

// Buckets returns a snapshot of the current values in all buckets.
func (h *Histogram) Buckets() []int64 {
	buckets := make([]int64, len(h.buckets))
	for i := range h.buckets {
		buckets[i] = h.buckets[i].Get()
	}
	return buckets
}

// Help returns the help string.
func (h *Histogram) Help() string {
	return h.help
}
