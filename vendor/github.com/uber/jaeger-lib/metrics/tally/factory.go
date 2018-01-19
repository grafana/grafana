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
	"github.com/uber-go/tally"

	"github.com/uber/jaeger-lib/metrics"
)

// Wrap takes a tally Scope and returns jaeger-lib metrics.Factory.
func Wrap(scope tally.Scope) metrics.Factory {
	return &factory{
		tally: scope,
	}
}

// TODO implement support for tags if tally.Scope does not support them
type factory struct {
	tally tally.Scope
}

func (f *factory) Counter(name string, tags map[string]string) metrics.Counter {
	scope := f.tally
	if len(tags) > 0 {
		scope = scope.Tagged(tags)
	}
	return NewCounter(scope.Counter(name))
}

func (f *factory) Gauge(name string, tags map[string]string) metrics.Gauge {
	scope := f.tally
	if len(tags) > 0 {
		scope = scope.Tagged(tags)
	}
	return NewGauge(scope.Gauge(name))
}

func (f *factory) Timer(name string, tags map[string]string) metrics.Timer {
	scope := f.tally
	if len(tags) > 0 {
		scope = scope.Tagged(tags)
	}
	return NewTimer(scope.Timer(name))
}

func (f *factory) Namespace(name string, tags map[string]string) metrics.Factory {
	return &factory{
		tally: f.tally.SubScope(name).Tagged(tags),
	}
}
