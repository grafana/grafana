// Copyright 2016 The Prometheus Authors
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
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
)

// Metrics to be used with a discovery manager.
type Metrics struct {
	FailedConfigs     prometheus.Gauge
	DiscoveredTargets *prometheus.GaugeVec
	ReceivedUpdates   prometheus.Counter
	DelayedUpdates    prometheus.Counter
	SentUpdates       prometheus.Counter
}

func NewManagerMetrics(registerer prometheus.Registerer, sdManagerName string) (*Metrics, error) {
	m := &Metrics{}

	m.FailedConfigs = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name:        "prometheus_sd_failed_configs",
			Help:        "Current number of service discovery configurations that failed to load.",
			ConstLabels: prometheus.Labels{"name": sdManagerName},
		},
	)

	m.DiscoveredTargets = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:        "prometheus_sd_discovered_targets",
			Help:        "Current number of discovered targets.",
			ConstLabels: prometheus.Labels{"name": sdManagerName},
		},
		[]string{"config"},
	)

	m.ReceivedUpdates = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name:        "prometheus_sd_received_updates_total",
			Help:        "Total number of update events received from the SD providers.",
			ConstLabels: prometheus.Labels{"name": sdManagerName},
		},
	)

	m.DelayedUpdates = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name:        "prometheus_sd_updates_delayed_total",
			Help:        "Total number of update events that couldn't be sent immediately.",
			ConstLabels: prometheus.Labels{"name": sdManagerName},
		},
	)

	m.SentUpdates = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name:        "prometheus_sd_updates_total",
			Help:        "Total number of update events sent to the SD consumers.",
			ConstLabels: prometheus.Labels{"name": sdManagerName},
		},
	)

	metrics := []prometheus.Collector{
		m.FailedConfigs,
		m.DiscoveredTargets,
		m.ReceivedUpdates,
		m.DelayedUpdates,
		m.SentUpdates,
	}

	for _, collector := range metrics {
		err := registerer.Register(collector)
		if err != nil {
			return nil, fmt.Errorf("failed to register discovery manager metrics: %w", err)
		}
	}

	return m, nil
}

// Unregister unregisters all metrics.
func (m *Metrics) Unregister(registerer prometheus.Registerer) {
	registerer.Unregister(m.FailedConfigs)
	registerer.Unregister(m.DiscoveredTargets)
	registerer.Unregister(m.ReceivedUpdates)
	registerer.Unregister(m.DelayedUpdates)
	registerer.Unregister(m.SentUpdates)
}
