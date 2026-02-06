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

package file

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/prometheus/prometheus/discovery"
)

var _ discovery.DiscovererMetrics = (*fileMetrics)(nil)

type fileMetrics struct {
	fileSDReadErrorsCount  prometheus.Counter
	fileSDScanDuration     prometheus.Summary
	fileWatcherErrorsCount prometheus.Counter
	fileSDTimeStamp        *TimestampCollector

	metricRegisterer discovery.MetricRegisterer
}

func newDiscovererMetrics(reg prometheus.Registerer, _ discovery.RefreshMetricsInstantiator) discovery.DiscovererMetrics {
	fm := &fileMetrics{
		fileSDReadErrorsCount: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "prometheus_sd_file_read_errors_total",
				Help: "The number of File-SD read errors.",
			}),
		fileSDScanDuration: prometheus.NewSummary(
			prometheus.SummaryOpts{
				Name:       "prometheus_sd_file_scan_duration_seconds",
				Help:       "The duration of the File-SD scan in seconds.",
				Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
			}),
		fileWatcherErrorsCount: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "prometheus_sd_file_watcher_errors_total",
				Help: "The number of File-SD errors caused by filesystem watch failures.",
			}),
		fileSDTimeStamp: NewTimestampCollector(),
	}

	fm.metricRegisterer = discovery.NewMetricRegisterer(reg, []prometheus.Collector{
		fm.fileSDReadErrorsCount,
		fm.fileSDScanDuration,
		fm.fileWatcherErrorsCount,
		fm.fileSDTimeStamp,
	})

	return fm
}

// Register implements discovery.DiscovererMetrics.
func (fm *fileMetrics) Register() error {
	return fm.metricRegisterer.RegisterMetrics()
}

// Unregister implements discovery.DiscovererMetrics.
func (fm *fileMetrics) Unregister() {
	fm.metricRegisterer.UnregisterMetrics()
}

func (fm *fileMetrics) init(disc *Discovery) {
	fm.fileSDTimeStamp.addDiscoverer(disc)
}
