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

package tally

import (
	"time"

	"github.com/uber-go/tally"
)

// Counter is an adapter from go-tally Counter to jaeger-lib Counter
type Counter struct {
	counter tally.Counter
}

// NewCounter creates a new Counter
func NewCounter(counter tally.Counter) *Counter {
	return &Counter{counter: counter}
}

// Inc adds the given value to the counter.
func (c *Counter) Inc(delta int64) {
	c.counter.Inc(delta)
}

// Gauge is an adapter from go-tally Gauge to jaeger-lib Gauge
type Gauge struct {
	gauge tally.Gauge
}

// NewGauge creates a new Gauge
func NewGauge(gauge tally.Gauge) *Gauge {
	return &Gauge{gauge: gauge}
}

// Update the gauge to the value passed in.
func (g *Gauge) Update(value int64) {
	g.gauge.Update(float64(value))
}

// Timer is an adapter from go-tally Histogram to jaeger-lib Timer
type Timer struct {
	timer tally.Timer
}

// NewTimer creates a new Timer
func NewTimer(timer tally.Timer) *Timer {
	return &Timer{timer: timer}
}

// Record saves the time passed in.
func (t *Timer) Record(delta time.Duration) {
	t.timer.Record(delta)
}
