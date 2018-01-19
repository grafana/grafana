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

package influx

import (
	"github.com/go-kit/kit/metrics"
	"github.com/go-kit/kit/metrics/influx"

	"github.com/uber/jaeger-lib/metrics/go-kit"
)

// NewFactory creates a new metrics factory using go-kit influx package.
func NewFactory(client *influx.Influx) xkit.Factory {
	return factory{
		client: client,
	}
}

type factory struct {
	client *influx.Influx
}

func (f factory) Counter(name string) metrics.Counter {
	return f.client.NewCounter(name)
}

func (f factory) Histogram(name string) metrics.Histogram {
	return f.client.NewHistogram(name)
}

func (f factory) Gauge(name string) metrics.Gauge {
	return f.client.NewGauge(name)
}

func (f factory) Capabilities() xkit.Capabilities {
	return xkit.Capabilities{Tagging: true}
}
