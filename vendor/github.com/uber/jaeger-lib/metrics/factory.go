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

package metrics

// Factory creates new metrics
type Factory interface {
	Counter(name string, tags map[string]string) Counter
	Timer(name string, tags map[string]string) Timer
	Gauge(name string, tags map[string]string) Gauge

	// Namespace returns a nested metrics factory.
	Namespace(name string, tags map[string]string) Factory
}

// NullFactory is a metrics factory that returns NullCounter, NullTimer, and NullGauge.
var NullFactory Factory = nullFactory{}

type nullFactory struct{}

func (nullFactory) Counter(name string, tags map[string]string) Counter   { return NullCounter }
func (nullFactory) Timer(name string, tags map[string]string) Timer       { return NullTimer }
func (nullFactory) Gauge(name string, tags map[string]string) Gauge       { return NullGauge }
func (nullFactory) Namespace(name string, tags map[string]string) Factory { return NullFactory }
