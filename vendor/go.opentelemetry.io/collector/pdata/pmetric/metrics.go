// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pmetric // import "go.opentelemetry.io/collector/pdata/pmetric"

// MarkReadOnly marks the Metrics as shared so that no further modifications can be done on it.
func (ms Metrics) MarkReadOnly() {
	ms.getState().MarkReadOnly()
}

// IsReadOnly returns true if this Metrics instance is read-only.
func (ms Metrics) IsReadOnly() bool {
	return ms.getState().IsReadOnly()
}

// MetricCount calculates the total number of metrics.
func (ms Metrics) MetricCount() int {
	metricCount := 0
	rms := ms.ResourceMetrics()
	for i := 0; i < rms.Len(); i++ {
		rm := rms.At(i)
		ilms := rm.ScopeMetrics()
		for j := 0; j < ilms.Len(); j++ {
			ilm := ilms.At(j)
			metricCount += ilm.Metrics().Len()
		}
	}
	return metricCount
}

// DataPointCount calculates the total number of data points.
func (ms Metrics) DataPointCount() (dataPointCount int) {
	rms := ms.ResourceMetrics()
	for i := 0; i < rms.Len(); i++ {
		rm := rms.At(i)
		ilms := rm.ScopeMetrics()
		for j := 0; j < ilms.Len(); j++ {
			ilm := ilms.At(j)
			ms := ilm.Metrics()
			for k := 0; k < ms.Len(); k++ {
				m := ms.At(k)
				switch m.Type() {
				case MetricTypeGauge:
					dataPointCount += m.Gauge().DataPoints().Len()
				case MetricTypeSum:
					dataPointCount += m.Sum().DataPoints().Len()
				case MetricTypeHistogram:
					dataPointCount += m.Histogram().DataPoints().Len()
				case MetricTypeExponentialHistogram:
					dataPointCount += m.ExponentialHistogram().DataPoints().Len()
				case MetricTypeSummary:
					dataPointCount += m.Summary().DataPoints().Len()
				}
			}
		}
	}
	return dataPointCount
}
