// Copyright 2014 The Prometheus Authors
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

package prometheus

import (
	"fmt"
	"sync"

	"github.com/prometheus/common/model"
)

// metricVec is a Collector to bundle metrics of the same name that differ in
// their label values. metricVec is not used directly (and therefore
// unexported). It is used as a building block for implementations of vectors of
// a given metric type, like GaugeVec, CounterVec, SummaryVec, HistogramVec, and
// UntypedVec.
type metricVec struct {
	mtx      sync.RWMutex // Protects the children.
	children map[uint64][]metricWithLabelValues
	desc     *Desc

	newMetric   func(labelValues ...string) Metric
	hashAdd     func(h uint64, s string) uint64 // replace hash function for testing collision handling
	hashAddByte func(h uint64, b byte) uint64
}

// newMetricVec returns an initialized metricVec.
func newMetricVec(desc *Desc, newMetric func(lvs ...string) Metric) *metricVec {
	return &metricVec{
		children:    map[uint64][]metricWithLabelValues{},
		desc:        desc,
		newMetric:   newMetric,
		hashAdd:     hashAdd,
		hashAddByte: hashAddByte,
	}
}

// metricWithLabelValues provides the metric and its label values for
// disambiguation on hash collision.
type metricWithLabelValues struct {
	values []string
	metric Metric
}

// Describe implements Collector. The length of the returned slice
// is always one.
func (m *metricVec) Describe(ch chan<- *Desc) {
	ch <- m.desc
}

// Collect implements Collector.
func (m *metricVec) Collect(ch chan<- Metric) {
	m.mtx.RLock()
	defer m.mtx.RUnlock()

	for _, metrics := range m.children {
		for _, metric := range metrics {
			ch <- metric.metric
		}
	}
}

func (m *metricVec) getMetricWithLabelValues(lvs ...string) (Metric, error) {
	h, err := m.hashLabelValues(lvs)
	if err != nil {
		return nil, err
	}

	return m.getOrCreateMetricWithLabelValues(h, lvs), nil
}

func (m *metricVec) getMetricWith(labels Labels) (Metric, error) {
	h, err := m.hashLabels(labels)
	if err != nil {
		return nil, err
	}

	return m.getOrCreateMetricWithLabels(h, labels), nil
}

func (m *metricVec) withLabelValues(lvs ...string) Metric {
	metric, err := m.getMetricWithLabelValues(lvs...)
	if err != nil {
		panic(err)
	}
	return metric
}

func (m *metricVec) with(labels Labels) Metric {
	metric, err := m.getMetricWith(labels)
	if err != nil {
		panic(err)
	}
	return metric
}

// DeleteLabelValues removes the metric where the variable labels are the same
// as those passed in as labels (same order as the VariableLabels in Desc). It
// returns true if a metric was deleted.
//
// It is not an error if the number of label values is not the same as the
// number of VariableLabels in Desc. However, such inconsistent label count can
// never match an actual metric, so the method will always return false in that
// case.
//
// Note that for more than one label value, this method is prone to mistakes
// caused by an incorrect order of arguments. Consider Delete(Labels) as an
// alternative to avoid that type of mistake. For higher label numbers, the
// latter has a much more readable (albeit more verbose) syntax, but it comes
// with a performance overhead (for creating and processing the Labels map).
// See also the CounterVec example.
func (m *metricVec) DeleteLabelValues(lvs ...string) bool {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	h, err := m.hashLabelValues(lvs)
	if err != nil {
		return false
	}
	return m.deleteByHashWithLabelValues(h, lvs)
}

// Delete deletes the metric where the variable labels are the same as those
// passed in as labels. It returns true if a metric was deleted.
//
// It is not an error if the number and names of the Labels are inconsistent
// with those of the VariableLabels in Desc. However, such inconsistent Labels
// can never match an actual metric, so the method will always return false in
// that case.
//
// This method is used for the same purpose as DeleteLabelValues(...string). See
// there for pros and cons of the two methods.
func (m *metricVec) Delete(labels Labels) bool {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	h, err := m.hashLabels(labels)
	if err != nil {
		return false
	}

	return m.deleteByHashWithLabels(h, labels)
}

// deleteByHashWithLabelValues removes the metric from the hash bucket h. If
// there are multiple matches in the bucket, use lvs to select a metric and
// remove only that metric.
func (m *metricVec) deleteByHashWithLabelValues(h uint64, lvs []string) bool {
	metrics, ok := m.children[h]
	if !ok {
		return false
	}

	i := m.findMetricWithLabelValues(metrics, lvs)
	if i >= len(metrics) {
		return false
	}

	if len(metrics) > 1 {
		m.children[h] = append(metrics[:i], metrics[i+1:]...)
	} else {
		delete(m.children, h)
	}
	return true
}

// deleteByHashWithLabels removes the metric from the hash bucket h. If there
// are multiple matches in the bucket, use lvs to select a metric and remove
// only that metric.
func (m *metricVec) deleteByHashWithLabels(h uint64, labels Labels) bool {
	metrics, ok := m.children[h]
	if !ok {
		return false
	}
	i := m.findMetricWithLabels(metrics, labels)
	if i >= len(metrics) {
		return false
	}

	if len(metrics) > 1 {
		m.children[h] = append(metrics[:i], metrics[i+1:]...)
	} else {
		delete(m.children, h)
	}
	return true
}

// Reset deletes all metrics in this vector.
func (m *metricVec) Reset() {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	for h := range m.children {
		delete(m.children, h)
	}
}

func (m *metricVec) hashLabelValues(vals []string) (uint64, error) {
	if err := validateLabelValues(vals, len(m.desc.variableLabels)); err != nil {
		return 0, err
	}

	h := hashNew()
	for _, val := range vals {
		h = m.hashAdd(h, val)
		h = m.hashAddByte(h, model.SeparatorByte)
	}
	return h, nil
}

func (m *metricVec) hashLabels(labels Labels) (uint64, error) {
	if err := validateValuesInLabels(labels, len(m.desc.variableLabels)); err != nil {
		return 0, err
	}

	h := hashNew()
	for _, label := range m.desc.variableLabels {
		val, ok := labels[label]
		if !ok {
			return 0, fmt.Errorf("label name %q missing in label map", label)
		}
		h = m.hashAdd(h, val)
		h = m.hashAddByte(h, model.SeparatorByte)
	}
	return h, nil
}

// getOrCreateMetricWithLabelValues retrieves the metric by hash and label value
// or creates it and returns the new one.
//
// This function holds the mutex.
func (m *metricVec) getOrCreateMetricWithLabelValues(hash uint64, lvs []string) Metric {
	m.mtx.RLock()
	metric, ok := m.getMetricWithHashAndLabelValues(hash, lvs)
	m.mtx.RUnlock()
	if ok {
		return metric
	}

	m.mtx.Lock()
	defer m.mtx.Unlock()
	metric, ok = m.getMetricWithHashAndLabelValues(hash, lvs)
	if !ok {
		// Copy to avoid allocation in case wo don't go down this code path.
		copiedLVs := make([]string, len(lvs))
		copy(copiedLVs, lvs)
		metric = m.newMetric(copiedLVs...)
		m.children[hash] = append(m.children[hash], metricWithLabelValues{values: copiedLVs, metric: metric})
	}
	return metric
}

// getOrCreateMetricWithLabelValues retrieves the metric by hash and label value
// or creates it and returns the new one.
//
// This function holds the mutex.
func (m *metricVec) getOrCreateMetricWithLabels(hash uint64, labels Labels) Metric {
	m.mtx.RLock()
	metric, ok := m.getMetricWithHashAndLabels(hash, labels)
	m.mtx.RUnlock()
	if ok {
		return metric
	}

	m.mtx.Lock()
	defer m.mtx.Unlock()
	metric, ok = m.getMetricWithHashAndLabels(hash, labels)
	if !ok {
		lvs := m.extractLabelValues(labels)
		metric = m.newMetric(lvs...)
		m.children[hash] = append(m.children[hash], metricWithLabelValues{values: lvs, metric: metric})
	}
	return metric
}

// getMetricWithHashAndLabelValues gets a metric while handling possible
// collisions in the hash space. Must be called while holding the read mutex.
func (m *metricVec) getMetricWithHashAndLabelValues(h uint64, lvs []string) (Metric, bool) {
	metrics, ok := m.children[h]
	if ok {
		if i := m.findMetricWithLabelValues(metrics, lvs); i < len(metrics) {
			return metrics[i].metric, true
		}
	}
	return nil, false
}

// getMetricWithHashAndLabels gets a metric while handling possible collisions in
// the hash space. Must be called while holding read mutex.
func (m *metricVec) getMetricWithHashAndLabels(h uint64, labels Labels) (Metric, bool) {
	metrics, ok := m.children[h]
	if ok {
		if i := m.findMetricWithLabels(metrics, labels); i < len(metrics) {
			return metrics[i].metric, true
		}
	}
	return nil, false
}

// findMetricWithLabelValues returns the index of the matching metric or
// len(metrics) if not found.
func (m *metricVec) findMetricWithLabelValues(metrics []metricWithLabelValues, lvs []string) int {
	for i, metric := range metrics {
		if m.matchLabelValues(metric.values, lvs) {
			return i
		}
	}
	return len(metrics)
}

// findMetricWithLabels returns the index of the matching metric or len(metrics)
// if not found.
func (m *metricVec) findMetricWithLabels(metrics []metricWithLabelValues, labels Labels) int {
	for i, metric := range metrics {
		if m.matchLabels(metric.values, labels) {
			return i
		}
	}
	return len(metrics)
}

func (m *metricVec) matchLabelValues(values []string, lvs []string) bool {
	if len(values) != len(lvs) {
		return false
	}
	for i, v := range values {
		if v != lvs[i] {
			return false
		}
	}
	return true
}

func (m *metricVec) matchLabels(values []string, labels Labels) bool {
	if len(labels) != len(values) {
		return false
	}
	for i, k := range m.desc.variableLabels {
		if values[i] != labels[k] {
			return false
		}
	}
	return true
}

func (m *metricVec) extractLabelValues(labels Labels) []string {
	labelValues := make([]string, len(labels))
	for i, k := range m.desc.variableLabels {
		labelValues[i] = labels[k]
	}
	return labelValues
}
