// Copyright (c) 2017 The Jaeger Authors.
//
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
	"sort"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/uber/jaeger-lib/metrics"
)

// Factory implements metrics.Factory backed by Prometheus registry.
type Factory struct {
	scope      string
	tags       map[string]string
	cache      *vectorCache
	buckets    []float64
	normalizer *strings.Replacer
}

type options struct {
	registerer prometheus.Registerer
	buckets    []float64
}

// Option is a function that sets some option for the Factory constructor.
type Option func(*options)

// WithRegisterer returns an option that sets the registerer.
// If not used we fallback to prometheus.DefaultRegisterer.
func WithRegisterer(registerer prometheus.Registerer) Option {
	return func(opts *options) {
		opts.registerer = registerer
	}
}

// WithBuckets returns an option that sets the default buckets for histogram.
// If not used, we fallback to default Prometheus buckets.
func WithBuckets(buckets []float64) Option {
	return func(opts *options) {
		opts.buckets = buckets
	}
}

func applyOptions(opts []Option) *options {
	options := new(options)
	for _, o := range opts {
		o(options)
	}
	if options.registerer == nil {
		options.registerer = prometheus.DefaultRegisterer
	}
	return options
}

// New creates a Factory backed by Prometheus registry.
// Typically the first argument should be prometheus.DefaultRegisterer.
//
// Parameter buckets defines the buckets into which Timer observations are counted.
// Each element in the slice is the upper inclusive bound of a bucket. The
// values must be sorted in strictly increasing order. There is no need
// to add a highest bucket with +Inf bound, it will be added
// implicitly. The default value is prometheus.DefBuckets.
func New(opts ...Option) *Factory {
	options := applyOptions(opts)
	return newFactory(
		&Factory{ // dummy struct to be discarded
			cache:      newVectorCache(options.registerer),
			buckets:    options.buckets,
			normalizer: strings.NewReplacer(".", "_", "-", "_"),
		},
		"",  // scope
		nil) // tags
}

func newFactory(parent *Factory, scope string, tags map[string]string) *Factory {
	return &Factory{
		cache:      parent.cache,
		buckets:    parent.buckets,
		normalizer: parent.normalizer,
		scope:      scope,
		tags:       tags,
	}
}

// Counter implements Counter of metrics.Factory.
func (f *Factory) Counter(name string, tags map[string]string) metrics.Counter {
	name = f.subScope(name)
	tags = f.mergeTags(tags)
	labelNames := f.tagNames(tags)
	opts := prometheus.CounterOpts{
		Name: name,
		Help: name,
	}
	cv := f.cache.getOrMakeCounterVec(opts, labelNames)
	return &counter{
		counter: cv.WithLabelValues(f.tagsAsLabelValues(labelNames, tags)...),
	}
}

// Gauge implements Gauge of metrics.Factory.
func (f *Factory) Gauge(name string, tags map[string]string) metrics.Gauge {
	name = f.subScope(name)
	tags = f.mergeTags(tags)
	labelNames := f.tagNames(tags)
	opts := prometheus.GaugeOpts{
		Name: name,
		Help: name,
	}
	gv := f.cache.getOrMakeGaugeVec(opts, labelNames)
	return &gauge{
		gauge: gv.WithLabelValues(f.tagsAsLabelValues(labelNames, tags)...),
	}
}

// Timer implements Timer of metrics.Factory.
func (f *Factory) Timer(name string, tags map[string]string) metrics.Timer {
	name = f.subScope(name)
	tags = f.mergeTags(tags)
	labelNames := f.tagNames(tags)
	opts := prometheus.HistogramOpts{
		Name:    name,
		Help:    name,
		Buckets: f.buckets,
	}
	hv := f.cache.getOrMakeHistogramVec(opts, labelNames)
	return &timer{
		histogram: hv.WithLabelValues(f.tagsAsLabelValues(labelNames, tags)...),
	}
}

// Namespace implements Namespace of metrics.Factory.
func (f *Factory) Namespace(name string, tags map[string]string) metrics.Factory {
	return newFactory(f, f.subScope(name), f.mergeTags(tags))
}

type counter struct {
	counter prometheus.Counter
}

func (c *counter) Inc(v int64) {
	c.counter.Add(float64(v))
}

type gauge struct {
	gauge prometheus.Gauge
}

func (g *gauge) Update(v int64) {
	g.gauge.Set(float64(v))
}

type timer struct {
	histogram prometheus.Histogram
}

func (t *timer) Record(v time.Duration) {
	t.histogram.Observe(float64(v.Nanoseconds()) / float64(time.Second/time.Nanosecond))
}

func (f *Factory) subScope(name string) string {
	if f.scope == "" {
		return f.normalize(name)
	}
	if name == "" {
		return f.normalize(f.scope)
	}
	return f.normalize(f.scope + ":" + name)
}

func (f *Factory) normalize(v string) string {
	return f.normalizer.Replace(v)
}

func (f *Factory) mergeTags(tags map[string]string) map[string]string {
	ret := make(map[string]string, len(f.tags)+len(tags))
	for k, v := range f.tags {
		ret[k] = v
	}
	for k, v := range tags {
		ret[k] = v
	}
	return ret
}

func (f *Factory) tagNames(tags map[string]string) []string {
	ret := make([]string, 0, len(tags))
	for k := range tags {
		ret = append(ret, k)
	}
	sort.Strings(ret)
	return ret
}

func (f *Factory) tagsAsLabelValues(labels []string, tags map[string]string) []string {
	ret := make([]string, 0, len(tags))
	for _, l := range labels {
		ret = append(ret, tags[l])
	}
	return ret
}
