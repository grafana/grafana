// Copyright (c) 2017 Uber Technologies, Inc.
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

package multi

import (
	"time"

	"github.com/uber/jaeger-lib/metrics"
)

// Factory is a metrics factory that dispatches to multiple metrics backends.
type Factory struct {
	factories []metrics.Factory
}

// New creates a new multi.Factory that will dispatch to multiple metrics backends.
func New(factories ...metrics.Factory) *Factory {
	return &Factory{
		factories: factories,
	}
}

type counter struct {
	counters []metrics.Counter
}

func (c *counter) Inc(delta int64) {
	for _, counter := range c.counters {
		counter.Inc(delta)
	}
}

// Counter implements metrics.Factory interface
func (f *Factory) Counter(name string, tags map[string]string) metrics.Counter {
	counter := &counter{
		counters: make([]metrics.Counter, len(f.factories)),
	}
	for i, factory := range f.factories {
		counter.counters[i] = factory.Counter(name, tags)
	}
	return counter
}

type timer struct {
	timers []metrics.Timer
}

func (t *timer) Record(delta time.Duration) {
	for _, timer := range t.timers {
		timer.Record(delta)
	}
}

// Timer implements metrics.Factory interface
func (f *Factory) Timer(name string, tags map[string]string) metrics.Timer {
	timer := &timer{
		timers: make([]metrics.Timer, len(f.factories)),
	}
	for i, factory := range f.factories {
		timer.timers[i] = factory.Timer(name, tags)
	}
	return timer
}

type gauge struct {
	gauges []metrics.Gauge
}

func (t *gauge) Update(value int64) {
	for _, gauge := range t.gauges {
		gauge.Update(value)
	}
}

// Gauge implements metrics.Factory interface
func (f *Factory) Gauge(name string, tags map[string]string) metrics.Gauge {
	gauge := &gauge{
		gauges: make([]metrics.Gauge, len(f.factories)),
	}
	for i, factory := range f.factories {
		gauge.gauges[i] = factory.Gauge(name, tags)
	}
	return gauge
}

// Namespace implements metrics.Factory interface
func (f *Factory) Namespace(name string, tags map[string]string) metrics.Factory {
	newFactory := &Factory{
		factories: make([]metrics.Factory, len(f.factories)),
	}
	for i, factory := range f.factories {
		newFactory.factories[i] = factory.Namespace(name, tags)
	}
	return newFactory
}
