// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pmetric // import "go.opentelemetry.io/collector/pdata/pmetric"

import (
	"go.opentelemetry.io/collector/pdata/internal"
)

var _ MarshalSizer = (*ProtoMarshaler)(nil)

type ProtoMarshaler struct{}

func (e *ProtoMarshaler) MarshalMetrics(md Metrics) ([]byte, error) {
	size := internal.SizeProtoOrigExportMetricsServiceRequest(md.getOrig())
	buf := make([]byte, size)
	_ = internal.MarshalProtoOrigExportMetricsServiceRequest(md.getOrig(), buf)
	return buf, nil
}

func (e *ProtoMarshaler) MetricsSize(md Metrics) int {
	return internal.SizeProtoOrigExportMetricsServiceRequest(md.getOrig())
}

func (e *ProtoMarshaler) ResourceMetricsSize(md ResourceMetrics) int {
	return internal.SizeProtoOrigResourceMetrics(md.orig)
}

func (e *ProtoMarshaler) ScopeMetricsSize(md ScopeMetrics) int {
	return internal.SizeProtoOrigScopeMetrics(md.orig)
}

func (e *ProtoMarshaler) MetricSize(md Metric) int {
	return internal.SizeProtoOrigMetric(md.orig)
}

func (e *ProtoMarshaler) NumberDataPointSize(md NumberDataPoint) int {
	return internal.SizeProtoOrigNumberDataPoint(md.orig)
}

func (e *ProtoMarshaler) SummaryDataPointSize(md SummaryDataPoint) int {
	return internal.SizeProtoOrigSummaryDataPoint(md.orig)
}

func (e *ProtoMarshaler) HistogramDataPointSize(md HistogramDataPoint) int {
	return internal.SizeProtoOrigHistogramDataPoint(md.orig)
}

func (e *ProtoMarshaler) ExponentialHistogramDataPointSize(md ExponentialHistogramDataPoint) int {
	return internal.SizeProtoOrigExponentialHistogramDataPoint(md.orig)
}

type ProtoUnmarshaler struct{}

func (d *ProtoUnmarshaler) UnmarshalMetrics(buf []byte) (Metrics, error) {
	md := NewMetrics()
	err := internal.UnmarshalProtoOrigExportMetricsServiceRequest(md.getOrig(), buf)
	if err != nil {
		return Metrics{}, err
	}
	return md, nil
}
