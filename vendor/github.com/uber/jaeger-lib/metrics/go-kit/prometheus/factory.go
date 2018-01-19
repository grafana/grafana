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

package prometheus

import (
	"strings"

	"github.com/go-kit/kit/metrics"
	kitprom "github.com/go-kit/kit/metrics/prometheus"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/uber/jaeger-lib/metrics/go-kit"
)

var normalizer = strings.NewReplacer(
	".", "_",
	"-", "_",
)

// NewFactory creates a new metrics factory using go-kit prometheus package.
// buckets define the buckets into which histogram observations are counted.
// If buckets == nil, the default value prometheus.DefBuckets is used.
func NewFactory(namespace, subsystem string, buckets []float64) xkit.Factory {
	return &factory{
		namespace: namespace,
		subsystem: subsystem,
		buckets:   buckets,
	}
}

type factory struct {
	namespace string
	subsystem string
	buckets   []float64
}

func (f *factory) Counter(name string) metrics.Counter {
	opts := prometheus.CounterOpts{
		Namespace: f.namespace,
		Subsystem: f.subsystem,
		Name:      normalizer.Replace(name),
		Help:      name,
	}
	return kitprom.NewCounterFrom(opts, nil)
}

func (f *factory) Histogram(name string) metrics.Histogram {
	opts := prometheus.HistogramOpts{
		Namespace: f.namespace,
		Subsystem: f.subsystem,
		Name:      normalizer.Replace(name),
		Help:      name,
		Buckets:   f.buckets,
	}
	return kitprom.NewHistogramFrom(opts, nil)
}

func (f *factory) Gauge(name string) metrics.Gauge {
	opts := prometheus.GaugeOpts{
		Namespace: f.namespace,
		Subsystem: f.subsystem,
		Name:      normalizer.Replace(name),
		Help:      name,
	}
	return kitprom.NewGaugeFrom(opts, nil)
}

func (f *factory) Capabilities() xkit.Capabilities {
	return xkit.Capabilities{Tagging: true}
}
