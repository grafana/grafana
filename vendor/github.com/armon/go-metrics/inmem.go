package metrics

import (
	"bytes"
	"fmt"
	"math"
	"net/url"
	"strings"
	"sync"
	"time"
)

var spaceReplacer = strings.NewReplacer(" ", "_")

// InmemSink provides a MetricSink that does in-memory aggregation
// without sending metrics over a network. It can be embedded within
// an application to provide profiling information.
type InmemSink struct {
	// How long is each aggregation interval
	interval time.Duration

	// Retain controls how many metrics interval we keep
	retain time.Duration

	// maxIntervals is the maximum length of intervals.
	// It is retain / interval.
	maxIntervals int

	// intervals is a slice of the retained intervals
	intervals    []*IntervalMetrics
	intervalLock sync.RWMutex

	rateDenom float64
}

// IntervalMetrics stores the aggregated metrics
// for a specific interval
type IntervalMetrics struct {
	sync.RWMutex

	// The start time of the interval
	Interval time.Time

	// Gauges maps the key to the last set value
	Gauges map[string]GaugeValue

	// Points maps the string to the list of emitted values
	// from EmitKey
	Points map[string][]float32

	// Counters maps the string key to a sum of the counter
	// values
	Counters map[string]SampledValue

	// Samples maps the key to an AggregateSample,
	// which has the rolled up view of a sample
	Samples map[string]SampledValue

	// done is closed when this interval has ended, and a new IntervalMetrics
	// has been created to receive any future metrics.
	done chan struct{}
}

// NewIntervalMetrics creates a new IntervalMetrics for a given interval
func NewIntervalMetrics(intv time.Time) *IntervalMetrics {
	return &IntervalMetrics{
		Interval: intv,
		Gauges:   make(map[string]GaugeValue),
		Points:   make(map[string][]float32),
		Counters: make(map[string]SampledValue),
		Samples:  make(map[string]SampledValue),
		done:     make(chan struct{}),
	}
}

// AggregateSample is used to hold aggregate metrics
// about a sample
type AggregateSample struct {
	Count       int       // The count of emitted pairs
	Rate        float64   // The values rate per time unit (usually 1 second)
	Sum         float64   // The sum of values
	SumSq       float64   `json:"-"` // The sum of squared values
	Min         float64   // Minimum value
	Max         float64   // Maximum value
	LastUpdated time.Time `json:"-"` // When value was last updated
}

// Computes a Stddev of the values
func (a *AggregateSample) Stddev() float64 {
	num := (float64(a.Count) * a.SumSq) - math.Pow(a.Sum, 2)
	div := float64(a.Count * (a.Count - 1))
	if div == 0 {
		return 0
	}
	return math.Sqrt(num / div)
}

// Computes a mean of the values
func (a *AggregateSample) Mean() float64 {
	if a.Count == 0 {
		return 0
	}
	return a.Sum / float64(a.Count)
}

// Ingest is used to update a sample
func (a *AggregateSample) Ingest(v float64, rateDenom float64) {
	a.Count++
	a.Sum += v
	a.SumSq += (v * v)
	if v < a.Min || a.Count == 1 {
		a.Min = v
	}
	if v > a.Max || a.Count == 1 {
		a.Max = v
	}
	a.Rate = float64(a.Sum) / rateDenom
	a.LastUpdated = time.Now()
}

func (a *AggregateSample) String() string {
	if a.Count == 0 {
		return "Count: 0"
	} else if a.Stddev() == 0 {
		return fmt.Sprintf("Count: %d Sum: %0.3f LastUpdated: %s", a.Count, a.Sum, a.LastUpdated)
	} else {
		return fmt.Sprintf("Count: %d Min: %0.3f Mean: %0.3f Max: %0.3f Stddev: %0.3f Sum: %0.3f LastUpdated: %s",
			a.Count, a.Min, a.Mean(), a.Max, a.Stddev(), a.Sum, a.LastUpdated)
	}
}

// NewInmemSinkFromURL creates an InmemSink from a URL. It is used
// (and tested) from NewMetricSinkFromURL.
func NewInmemSinkFromURL(u *url.URL) (MetricSink, error) {
	params := u.Query()

	interval, err := time.ParseDuration(params.Get("interval"))
	if err != nil {
		return nil, fmt.Errorf("Bad 'interval' param: %s", err)
	}

	retain, err := time.ParseDuration(params.Get("retain"))
	if err != nil {
		return nil, fmt.Errorf("Bad 'retain' param: %s", err)
	}

	return NewInmemSink(interval, retain), nil
}

// NewInmemSink is used to construct a new in-memory sink.
// Uses an aggregation interval and maximum retention period.
func NewInmemSink(interval, retain time.Duration) *InmemSink {
	rateTimeUnit := time.Second
	i := &InmemSink{
		interval:     interval,
		retain:       retain,
		maxIntervals: int(retain / interval),
		rateDenom:    float64(interval.Nanoseconds()) / float64(rateTimeUnit.Nanoseconds()),
	}
	i.intervals = make([]*IntervalMetrics, 0, i.maxIntervals)
	return i
}

func (i *InmemSink) SetGauge(key []string, val float32) {
	i.SetGaugeWithLabels(key, val, nil)
}

func (i *InmemSink) SetGaugeWithLabels(key []string, val float32, labels []Label) {
	k, name := i.flattenKeyLabels(key, labels)
	intv := i.getInterval()

	intv.Lock()
	defer intv.Unlock()
	intv.Gauges[k] = GaugeValue{Name: name, Value: val, Labels: labels}
}

func (i *InmemSink) EmitKey(key []string, val float32) {
	k := i.flattenKey(key)
	intv := i.getInterval()

	intv.Lock()
	defer intv.Unlock()
	vals := intv.Points[k]
	intv.Points[k] = append(vals, val)
}

func (i *InmemSink) IncrCounter(key []string, val float32) {
	i.IncrCounterWithLabels(key, val, nil)
}

func (i *InmemSink) IncrCounterWithLabels(key []string, val float32, labels []Label) {
	k, name := i.flattenKeyLabels(key, labels)
	intv := i.getInterval()

	intv.Lock()
	defer intv.Unlock()

	agg, ok := intv.Counters[k]
	if !ok {
		agg = SampledValue{
			Name:            name,
			AggregateSample: &AggregateSample{},
			Labels:          labels,
		}
		intv.Counters[k] = agg
	}
	agg.Ingest(float64(val), i.rateDenom)
}

func (i *InmemSink) AddSample(key []string, val float32) {
	i.AddSampleWithLabels(key, val, nil)
}

func (i *InmemSink) AddSampleWithLabels(key []string, val float32, labels []Label) {
	k, name := i.flattenKeyLabels(key, labels)
	intv := i.getInterval()

	intv.Lock()
	defer intv.Unlock()

	agg, ok := intv.Samples[k]
	if !ok {
		agg = SampledValue{
			Name:            name,
			AggregateSample: &AggregateSample{},
			Labels:          labels,
		}
		intv.Samples[k] = agg
	}
	agg.Ingest(float64(val), i.rateDenom)
}

// Data is used to retrieve all the aggregated metrics
// Intervals may be in use, and a read lock should be acquired
func (i *InmemSink) Data() []*IntervalMetrics {
	// Get the current interval, forces creation
	i.getInterval()

	i.intervalLock.RLock()
	defer i.intervalLock.RUnlock()

	n := len(i.intervals)
	intervals := make([]*IntervalMetrics, n)

	copy(intervals[:n-1], i.intervals[:n-1])
	current := i.intervals[n-1]

	// make its own copy for current interval
	intervals[n-1] = &IntervalMetrics{}
	copyCurrent := intervals[n-1]
	current.RLock()
	*copyCurrent = *current
	// RWMutex is not safe to copy, so create a new instance on the copy
	copyCurrent.RWMutex = sync.RWMutex{}

	copyCurrent.Gauges = make(map[string]GaugeValue, len(current.Gauges))
	for k, v := range current.Gauges {
		copyCurrent.Gauges[k] = v
	}
	// saved values will be not change, just copy its link
	copyCurrent.Points = make(map[string][]float32, len(current.Points))
	for k, v := range current.Points {
		copyCurrent.Points[k] = v
	}
	copyCurrent.Counters = make(map[string]SampledValue, len(current.Counters))
	for k, v := range current.Counters {
		copyCurrent.Counters[k] = v.deepCopy()
	}
	copyCurrent.Samples = make(map[string]SampledValue, len(current.Samples))
	for k, v := range current.Samples {
		copyCurrent.Samples[k] = v.deepCopy()
	}
	current.RUnlock()

	return intervals
}

// getInterval returns the current interval. A new interval is created if no
// previous interval exists, or if the current time is beyond the window for the
// current interval.
func (i *InmemSink) getInterval() *IntervalMetrics {
	intv := time.Now().Truncate(i.interval)

	// Attempt to return the existing interval first, because it only requires
	// a read lock.
	i.intervalLock.RLock()
	n := len(i.intervals)
	if n > 0 && i.intervals[n-1].Interval == intv {
		defer i.intervalLock.RUnlock()
		return i.intervals[n-1]
	}
	i.intervalLock.RUnlock()

	i.intervalLock.Lock()
	defer i.intervalLock.Unlock()

	// Re-check for an existing interval now that the lock is re-acquired.
	n = len(i.intervals)
	if n > 0 && i.intervals[n-1].Interval == intv {
		return i.intervals[n-1]
	}

	current := NewIntervalMetrics(intv)
	i.intervals = append(i.intervals, current)
	if n > 0 {
		close(i.intervals[n-1].done)
	}

	n++
	// Prune old intervals if the count exceeds the max.
	if n >= i.maxIntervals {
		copy(i.intervals[0:], i.intervals[n-i.maxIntervals:])
		i.intervals = i.intervals[:i.maxIntervals]
	}
	return current
}

// Flattens the key for formatting, removes spaces
func (i *InmemSink) flattenKey(parts []string) string {
	buf := &bytes.Buffer{}

	joined := strings.Join(parts, ".")

	spaceReplacer.WriteString(buf, joined)

	return buf.String()
}

// Flattens the key for formatting along with its labels, removes spaces
func (i *InmemSink) flattenKeyLabels(parts []string, labels []Label) (string, string) {
	key := i.flattenKey(parts)
	buf := bytes.NewBufferString(key)

	for _, label := range labels {
		spaceReplacer.WriteString(buf, fmt.Sprintf(";%s=%s", label.Name, label.Value))
	}

	return buf.String(), key
}
