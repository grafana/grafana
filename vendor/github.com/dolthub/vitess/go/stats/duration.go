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
	"strconv"
	"time"

	"github.com/dolthub/vitess/go/sync2"
)

// CounterDuration exports a time.Duration as counter.
type CounterDuration struct {
	i    sync2.AtomicDuration
	help string
}

// NewCounterDuration returns a new CounterDuration.
func NewCounterDuration(name, help string) *CounterDuration {
	cd := &CounterDuration{
		help: help,
	}
	publish(name, cd)
	return cd
}

// Help implements the Variable interface.
func (cd CounterDuration) Help() string {
	return cd.help
}

// String is the implementation of expvar.var.
func (cd CounterDuration) String() string {
	return strconv.FormatInt(int64(cd.i.Get()), 10)
}

// Add adds the provided value to the CounterDuration.
func (cd *CounterDuration) Add(delta time.Duration) {
	cd.i.Add(delta)
}

// Get returns the value.
func (cd *CounterDuration) Get() time.Duration {
	return cd.i.Get()
}

// GaugeDuration exports a time.Duration as gauge.
// In addition to CounterDuration, it also has Set() which allows overriding
// the current value.
type GaugeDuration struct {
	CounterDuration
}

// NewGaugeDuration returns a new GaugeDuration.
func NewGaugeDuration(name, help string) *GaugeDuration {
	gd := &GaugeDuration{
		CounterDuration: CounterDuration{
			help: help,
		},
	}
	publish(name, gd)
	return gd
}

// Set sets the value.
func (gd *GaugeDuration) Set(value time.Duration) {
	gd.i.Set(value)
}

// CounterDurationFunc allows to provide the value via a custom function.
type CounterDurationFunc struct {
	F    func() time.Duration
	help string
}

// NewCounterDurationFunc creates a new CounterDurationFunc instance and
// publishes it if name is set.
func NewCounterDurationFunc(name string, help string, f func() time.Duration) *CounterDurationFunc {
	cf := &CounterDurationFunc{
		F:    f,
		help: help,
	}

	if name != "" {
		publish(name, cf)
	}
	return cf
}

// Help implements the Variable interface.
func (cf CounterDurationFunc) Help() string {
	return cf.help
}

// String is the implementation of expvar.var.
func (cf CounterDurationFunc) String() string {
	return strconv.FormatInt(int64(cf.F()), 10)
}

// GaugeDurationFunc allows to provide the value via a custom function.
type GaugeDurationFunc struct {
	CounterDurationFunc
}

// NewGaugeDurationFunc creates a new GaugeDurationFunc instance and
// publishes it if name is set.
func NewGaugeDurationFunc(name string, help string, f func() time.Duration) *GaugeDurationFunc {
	gf := &GaugeDurationFunc{
		CounterDurationFunc: CounterDurationFunc{
			F:    f,
			help: help,
		},
	}

	if name != "" {
		publish(name, gf)
	}
	return gf
}
