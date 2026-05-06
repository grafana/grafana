package metrics

import (
	"runtime"
	"strings"
	"time"

	iradix "github.com/hashicorp/go-immutable-radix"
)

type Label struct {
	Name  string
	Value string
}

func (m *Metrics) SetGauge(key []string, val float32) {
	m.SetGaugeWithLabels(key, val, nil)
}

func (m *Metrics) SetGaugeWithLabels(key []string, val float32, labels []Label) {
	if m.HostName != "" {
		if m.EnableHostnameLabel {
			labels = append(labels, Label{"host", m.HostName})
		} else if m.EnableHostname {
			key = insert(0, m.HostName, key)
		}
	}
	if m.EnableTypePrefix {
		key = insert(0, "gauge", key)
	}
	if m.ServiceName != "" {
		if m.EnableServiceLabel {
			labels = append(labels, Label{"service", m.ServiceName})
		} else {
			key = insert(0, m.ServiceName, key)
		}
	}
	allowed, labelsFiltered := m.allowMetric(key, labels)
	if !allowed {
		return
	}
	m.sink.SetGaugeWithLabels(key, val, labelsFiltered)
}

func (m *Metrics) EmitKey(key []string, val float32) {
	if m.EnableTypePrefix {
		key = insert(0, "kv", key)
	}
	if m.ServiceName != "" {
		key = insert(0, m.ServiceName, key)
	}
	allowed, _ := m.allowMetric(key, nil)
	if !allowed {
		return
	}
	m.sink.EmitKey(key, val)
}

func (m *Metrics) IncrCounter(key []string, val float32) {
	m.IncrCounterWithLabels(key, val, nil)
}

func (m *Metrics) IncrCounterWithLabels(key []string, val float32, labels []Label) {
	if m.HostName != "" && m.EnableHostnameLabel {
		labels = append(labels, Label{"host", m.HostName})
	}
	if m.EnableTypePrefix {
		key = insert(0, "counter", key)
	}
	if m.ServiceName != "" {
		if m.EnableServiceLabel {
			labels = append(labels, Label{"service", m.ServiceName})
		} else {
			key = insert(0, m.ServiceName, key)
		}
	}
	allowed, labelsFiltered := m.allowMetric(key, labels)
	if !allowed {
		return
	}
	m.sink.IncrCounterWithLabels(key, val, labelsFiltered)
}

func (m *Metrics) AddSample(key []string, val float32) {
	m.AddSampleWithLabels(key, val, nil)
}

func (m *Metrics) AddSampleWithLabels(key []string, val float32, labels []Label) {
	if m.HostName != "" && m.EnableHostnameLabel {
		labels = append(labels, Label{"host", m.HostName})
	}
	if m.EnableTypePrefix {
		key = insert(0, "sample", key)
	}
	if m.ServiceName != "" {
		if m.EnableServiceLabel {
			labels = append(labels, Label{"service", m.ServiceName})
		} else {
			key = insert(0, m.ServiceName, key)
		}
	}
	allowed, labelsFiltered := m.allowMetric(key, labels)
	if !allowed {
		return
	}
	m.sink.AddSampleWithLabels(key, val, labelsFiltered)
}

func (m *Metrics) MeasureSince(key []string, start time.Time) {
	m.MeasureSinceWithLabels(key, start, nil)
}

func (m *Metrics) MeasureSinceWithLabels(key []string, start time.Time, labels []Label) {
	if m.HostName != "" && m.EnableHostnameLabel {
		labels = append(labels, Label{"host", m.HostName})
	}
	if m.EnableTypePrefix {
		key = insert(0, "timer", key)
	}
	if m.ServiceName != "" {
		if m.EnableServiceLabel {
			labels = append(labels, Label{"service", m.ServiceName})
		} else {
			key = insert(0, m.ServiceName, key)
		}
	}
	allowed, labelsFiltered := m.allowMetric(key, labels)
	if !allowed {
		return
	}
	now := time.Now()
	elapsed := now.Sub(start)
	msec := float32(elapsed.Nanoseconds()) / float32(m.TimerGranularity)
	m.sink.AddSampleWithLabels(key, msec, labelsFiltered)
}

// UpdateFilter overwrites the existing filter with the given rules.
func (m *Metrics) UpdateFilter(allow, block []string) {
	m.UpdateFilterAndLabels(allow, block, m.AllowedLabels, m.BlockedLabels)
}

// UpdateFilterAndLabels overwrites the existing filter with the given rules.
func (m *Metrics) UpdateFilterAndLabels(allow, block, allowedLabels, blockedLabels []string) {
	m.filterLock.Lock()
	defer m.filterLock.Unlock()

	m.AllowedPrefixes = allow
	m.BlockedPrefixes = block

	if allowedLabels == nil {
		// Having a white list means we take only elements from it
		m.allowedLabels = nil
	} else {
		m.allowedLabels = make(map[string]bool)
		for _, v := range allowedLabels {
			m.allowedLabels[v] = true
		}
	}
	m.blockedLabels = make(map[string]bool)
	for _, v := range blockedLabels {
		m.blockedLabels[v] = true
	}
	m.AllowedLabels = allowedLabels
	m.BlockedLabels = blockedLabels

	m.filter = iradix.New()
	for _, prefix := range m.AllowedPrefixes {
		m.filter, _, _ = m.filter.Insert([]byte(prefix), true)
	}
	for _, prefix := range m.BlockedPrefixes {
		m.filter, _, _ = m.filter.Insert([]byte(prefix), false)
	}
}

func (m *Metrics) Shutdown() {
	if ss, ok := m.sink.(ShutdownSink); ok {
		ss.Shutdown()
	}
}

// labelIsAllowed return true if a should be included in metric
// the caller should lock m.filterLock while calling this method
func (m *Metrics) labelIsAllowed(label *Label) bool {
	labelName := (*label).Name
	if m.blockedLabels != nil {
		_, ok := m.blockedLabels[labelName]
		if ok {
			// If present, let's remove this label
			return false
		}
	}
	if m.allowedLabels != nil {
		_, ok := m.allowedLabels[labelName]
		return ok
	}
	// Allow by default
	return true
}

// filterLabels return only allowed labels
// the caller should lock m.filterLock while calling this method
func (m *Metrics) filterLabels(labels []Label) []Label {
	if labels == nil {
		return nil
	}
	toReturn := []Label{}
	for _, label := range labels {
		if m.labelIsAllowed(&label) {
			toReturn = append(toReturn, label)
		}
	}
	return toReturn
}

// Returns whether the metric should be allowed based on configured prefix filters
// Also return the applicable labels
func (m *Metrics) allowMetric(key []string, labels []Label) (bool, []Label) {
	m.filterLock.RLock()
	defer m.filterLock.RUnlock()

	if m.filter == nil || m.filter.Len() == 0 {
		return m.Config.FilterDefault, m.filterLabels(labels)
	}

	_, allowed, ok := m.filter.Root().LongestPrefix([]byte(strings.Join(key, ".")))
	if !ok {
		return m.Config.FilterDefault, m.filterLabels(labels)
	}

	return allowed.(bool), m.filterLabels(labels)
}

// Periodically collects runtime stats to publish
func (m *Metrics) collectStats() {
	for {
		time.Sleep(m.ProfileInterval)
		m.EmitRuntimeStats()
	}
}

// Emits various runtime statsitics
func (m *Metrics) EmitRuntimeStats() {
	// Export number of Goroutines
	numRoutines := runtime.NumGoroutine()
	m.SetGauge([]string{"runtime", "num_goroutines"}, float32(numRoutines))

	// Export memory stats
	var stats runtime.MemStats
	runtime.ReadMemStats(&stats)
	m.SetGauge([]string{"runtime", "alloc_bytes"}, float32(stats.Alloc))
	m.SetGauge([]string{"runtime", "sys_bytes"}, float32(stats.Sys))
	m.SetGauge([]string{"runtime", "malloc_count"}, float32(stats.Mallocs))
	m.SetGauge([]string{"runtime", "free_count"}, float32(stats.Frees))
	m.SetGauge([]string{"runtime", "heap_objects"}, float32(stats.HeapObjects))
	m.SetGauge([]string{"runtime", "total_gc_pause_ns"}, float32(stats.PauseTotalNs))
	m.SetGauge([]string{"runtime", "total_gc_runs"}, float32(stats.NumGC))

	// Export info about the last few GC runs
	num := stats.NumGC

	// Handle wrap around
	if num < m.lastNumGC {
		m.lastNumGC = 0
	}

	// Ensure we don't scan more than 256
	if num-m.lastNumGC >= 256 {
		m.lastNumGC = num - 255
	}

	for i := m.lastNumGC; i < num; i++ {
		pause := stats.PauseNs[i%256]
		m.AddSample([]string{"runtime", "gc_pause_ns"}, float32(pause))
	}
	m.lastNumGC = num
}

// Creates a new slice with the provided string value as the first element
// and the provided slice values as the remaining values.
// Ordering of the values in the provided input slice is kept in tact in the output slice.
func insert(i int, v string, s []string) []string {
	// Allocate new slice to avoid modifying the input slice
	newS := make([]string, len(s)+1)

	// Copy s[0, i-1] into newS
	for j := 0; j < i; j++ {
		newS[j] = s[j]
	}

	// Insert provided element at index i
	newS[i] = v

	// Copy s[i, len(s)-1] into newS starting at newS[i+1]
	for j := i; j < len(s); j++ {
		newS[j+1] = s[j]
	}

	return newS
}
