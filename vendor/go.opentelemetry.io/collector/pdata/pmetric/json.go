// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pmetric // import "go.opentelemetry.io/collector/pdata/pmetric"

import (
	"slices"

	"go.opentelemetry.io/collector/pdata/internal"
	"go.opentelemetry.io/collector/pdata/internal/json"
	"go.opentelemetry.io/collector/pdata/internal/otlp"
)

var _ Marshaler = (*JSONMarshaler)(nil)

// JSONMarshaler marshals Metrics to JSON bytes using the OTLP/JSON format.
type JSONMarshaler struct{}

// MarshalMetrics to the OTLP/JSON format.
func (*JSONMarshaler) MarshalMetrics(md Metrics) ([]byte, error) {
	dest := json.BorrowStream(nil)
	defer json.ReturnStream(dest)
	internal.MarshalJSONOrigExportMetricsServiceRequest(md.getOrig(), dest)
	if dest.Error() != nil {
		return nil, dest.Error()
	}
	return slices.Clone(dest.Buffer()), nil
}

// JSONUnmarshaler unmarshals OTLP/JSON formatted-bytes to Metrics.
type JSONUnmarshaler struct{}

// UnmarshalMetrics from OTLP/JSON format into Metrics.
func (*JSONUnmarshaler) UnmarshalMetrics(buf []byte) (Metrics, error) {
	iter := json.BorrowIterator(buf)
	defer json.ReturnIterator(iter)
	md := NewMetrics()
	internal.UnmarshalJSONOrigExportMetricsServiceRequest(md.getOrig(), iter)
	if iter.Error() != nil {
		return Metrics{}, iter.Error()
	}
	otlp.MigrateMetrics(md.getOrig().ResourceMetrics)
	return md, nil
}
