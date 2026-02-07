// Copyright 2015 The Prometheus Authors
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

package discovery

import (
	"github.com/prometheus/client_golang/prometheus"
)

// RefreshMetricsVecs are metric vectors for the "refresh" package.
// We define them here in the "discovery" package in order to avoid a cyclic dependency between
// "discovery" and "refresh".
type RefreshMetricsVecs struct {
	failuresVec *prometheus.CounterVec
	durationVec *prometheus.SummaryVec

	metricRegisterer MetricRegisterer
}

var _ RefreshMetricsManager = (*RefreshMetricsVecs)(nil)

func NewRefreshMetrics(reg prometheus.Registerer) RefreshMetricsManager {
	m := &RefreshMetricsVecs{
		failuresVec: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "prometheus_sd_refresh_failures_total",
				Help: "Number of refresh failures for the given SD mechanism.",
			},
			[]string{"mechanism"}),
		durationVec: prometheus.NewSummaryVec(
			prometheus.SummaryOpts{
				Name:       "prometheus_sd_refresh_duration_seconds",
				Help:       "The duration of a refresh in seconds for the given SD mechanism.",
				Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
			},
			[]string{"mechanism"}),
	}

	// The reason we register metric vectors instead of metrics is so that
	// the metrics are not visible until they are recorded.
	m.metricRegisterer = NewMetricRegisterer(reg, []prometheus.Collector{
		m.failuresVec,
		m.durationVec,
	})

	return m
}

// Instantiate returns metrics out of metric vectors.
func (m *RefreshMetricsVecs) Instantiate(mech string) *RefreshMetrics {
	return &RefreshMetrics{
		Failures: m.failuresVec.WithLabelValues(mech),
		Duration: m.durationVec.WithLabelValues(mech),
	}
}

// Register implements discovery.DiscovererMetrics.
func (m *RefreshMetricsVecs) Register() error {
	return m.metricRegisterer.RegisterMetrics()
}

// Unregister implements discovery.DiscovererMetrics.
func (m *RefreshMetricsVecs) Unregister() {
	m.metricRegisterer.UnregisterMetrics()
}
