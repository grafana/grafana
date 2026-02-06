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
	"fmt"
	"strconv"

	"github.com/dolthub/vitess/go/sync2"
)

// Counter tracks a cumulative count of a metric.
// For a one-dimensional or multi-dimensional counter, please use
// CountersWithSingleLabel or CountersWithMultiLabels instead.
type Counter struct {
	i    sync2.AtomicInt64
	help string
}

// NewCounter returns a new Counter.
func NewCounter(name string, help string) *Counter {
	v := &Counter{help: help}
	if name != "" {
		publish(name, v)
	}
	return v
}

// Add adds the provided value to the Counter.
func (v *Counter) Add(delta int64) {
	if delta < 0 {
		panic(fmt.Sprintf("Adding a negative value to a counter, %v should be a gauge instead", v))
	}
	v.i.Add(delta)
}

// Reset resets the counter value to 0.
func (v *Counter) Reset() {
	v.i.Set(int64(0))
}

// Get returns the value.
func (v *Counter) Get() int64 {
	return v.i.Get()
}

// String implements the expvar.Var interface.
func (v *Counter) String() string {
	return strconv.FormatInt(v.i.Get(), 10)
}

// Help returns the help string.
func (v *Counter) Help() string {
	return v.help
}

// CounterFunc allows to provide the counter value via a custom function.
// For implementations that differentiate between Counters/Gauges,
// CounterFunc's values only go up (or are reset to 0).
type CounterFunc struct {
	F    func() int64
	help string
}

// NewCounterFunc creates a new CounterFunc instance and publishes it if name is
// set.
func NewCounterFunc(name string, help string, f func() int64) *CounterFunc {
	c := &CounterFunc{
		F:    f,
		help: help,
	}

	if name != "" {
		publish(name, c)
	}
	return c
}

// Help returns the help string.
func (cf CounterFunc) Help() string {
	return cf.help
}

// String implements expvar.Var.
func (cf CounterFunc) String() string {
	return strconv.FormatInt(cf.F(), 10)
}

// Gauge tracks the current value of an integer metric.
// The emphasis here is on *current* i.e. this is not a cumulative counter.
// For a one-dimensional or multi-dimensional gauge, please use
// GaugeWithSingleLabel or GaugesWithMultiLabels instead.
type Gauge struct {
	Counter
}

// NewGauge creates a new Gauge and publishes it if name is set.
func NewGauge(name string, help string) *Gauge {
	v := &Gauge{Counter: Counter{help: help}}

	if name != "" {
		publish(name, v)
	}
	return v
}

// Set overwrites the current value.
func (v *Gauge) Set(value int64) {
	v.Counter.i.Set(value)
}

// Add adds the provided value to the Gauge.
func (v *Gauge) Add(delta int64) {
	v.Counter.i.Add(delta)
}

// GaugeFunc is the same as CounterFunc but meant for gauges.
// It's a wrapper around CounterFunc for values that go up/down for
// implementations (like Prometheus) that need to differ between Counters and
// Gauges.
type GaugeFunc struct {
	CounterFunc
}

// NewGaugeFunc creates a new GaugeFunc instance and publishes it if name is
// set.
func NewGaugeFunc(name string, help string, f func() int64) *GaugeFunc {
	i := &GaugeFunc{
		CounterFunc: CounterFunc{
			F:    f,
			help: help,
		}}

	if name != "" {
		publish(name, i)
	}
	return i
}
