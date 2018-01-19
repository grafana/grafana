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

package expvar

import (
	"github.com/go-kit/kit/metrics"
	"github.com/go-kit/kit/metrics/expvar"

	"github.com/uber/jaeger-lib/metrics/go-kit"
)

// NewFactory creates a new metrics factory using go-kit expvar package.
// buckets is the number of buckets to be used in histograms.
func NewFactory(buckets int) xkit.Factory {
	return factory{
		buckets: buckets,
	}
}

type factory struct {
	buckets int
}

func (f factory) Counter(name string) metrics.Counter {
	return expvar.NewCounter(name)
}

func (f factory) Histogram(name string) metrics.Histogram {
	return expvar.NewHistogram(name, f.buckets)
}

func (f factory) Gauge(name string) metrics.Gauge {
	return expvar.NewGauge(name)
}

func (f factory) Capabilities() xkit.Capabilities {
	return xkit.Capabilities{Tagging: false}
}
