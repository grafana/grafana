// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package pmetric // import "go.opentelemetry.io/collector/pdata/pmetric"

import (
	"bytes"
	"fmt"

	jsoniter "github.com/json-iterator/go"

	"go.opentelemetry.io/collector/pdata/internal"
	otlpmetrics "go.opentelemetry.io/collector/pdata/internal/data/protogen/metrics/v1"
	"go.opentelemetry.io/collector/pdata/internal/json"
	"go.opentelemetry.io/collector/pdata/internal/otlp"
)

var _ Marshaler = (*JSONMarshaler)(nil)

// JSONMarshaler marshals pdata.Metrics to JSON bytes using the OTLP/JSON format.
type JSONMarshaler struct{}

// MarshalMetrics to the OTLP/JSON format.
func (*JSONMarshaler) MarshalMetrics(md Metrics) ([]byte, error) {
	buf := bytes.Buffer{}
	pb := internal.MetricsToProto(internal.Metrics(md))
	err := json.Marshal(&buf, &pb)
	return buf.Bytes(), err
}

// JSONUnmarshaler unmarshals OTLP/JSON formatted-bytes to pdata.Metrics.
type JSONUnmarshaler struct{}

// UnmarshalMetrics from OTLP/JSON format into pdata.Metrics.
func (*JSONUnmarshaler) UnmarshalMetrics(buf []byte) (Metrics, error) {
	iter := jsoniter.ConfigFastest.BorrowIterator(buf)
	defer jsoniter.ConfigFastest.ReturnIterator(iter)
	md := NewMetrics()
	md.unmarshalJsoniter(iter)
	if iter.Error != nil {
		return Metrics{}, iter.Error
	}
	otlp.MigrateMetrics(md.getOrig().ResourceMetrics)
	return md, nil
}

func (ms Metrics) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "resource_metrics", "resourceMetrics":
			iter.ReadArrayCB(func(*jsoniter.Iterator) bool {
				ms.ResourceMetrics().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms ResourceMetrics) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "resource":
			json.ReadResource(iter, &ms.orig.Resource)
		case "scopeMetrics", "scope_metrics":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.ScopeMetrics().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		case "schemaUrl", "schema_url":
			ms.orig.SchemaUrl = iter.ReadString()
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms ScopeMetrics) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "scope":
			json.ReadScope(iter, &ms.orig.Scope)
		case "metrics":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.Metrics().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		case "schemaUrl", "schema_url":
			ms.orig.SchemaUrl = iter.ReadString()
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms Metric) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "name":
			ms.orig.Name = iter.ReadString()
		case "description":
			ms.orig.Description = iter.ReadString()
		case "unit":
			ms.orig.Unit = iter.ReadString()
		case "metadata":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.Metadata = append(ms.orig.Metadata, json.ReadAttribute(iter))
				return true
			})
		case "sum":
			ms.SetEmptySum().unmarshalJsoniter(iter)
		case "gauge":
			ms.SetEmptyGauge().unmarshalJsoniter(iter)
		case "histogram":
			ms.SetEmptyHistogram().unmarshalJsoniter(iter)
		case "exponential_histogram", "exponentialHistogram":
			ms.SetEmptyExponentialHistogram().unmarshalJsoniter(iter)
		case "summary":
			ms.SetEmptySummary().unmarshalJsoniter(iter)
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms Sum) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "aggregation_temporality", "aggregationTemporality":
			ms.orig.AggregationTemporality = readAggregationTemporality(iter)
		case "is_monotonic", "isMonotonic":
			ms.orig.IsMonotonic = iter.ReadBool()
		case "data_points", "dataPoints":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.DataPoints().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms Gauge) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "data_points", "dataPoints":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.DataPoints().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms Histogram) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "data_points", "dataPoints":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.DataPoints().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		case "aggregation_temporality", "aggregationTemporality":
			ms.orig.AggregationTemporality = readAggregationTemporality(iter)
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms ExponentialHistogram) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "data_points", "dataPoints":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.DataPoints().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		case "aggregation_temporality", "aggregationTemporality":
			ms.orig.AggregationTemporality = readAggregationTemporality(iter)
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms Summary) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "data_points", "dataPoints":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.DataPoints().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms NumberDataPoint) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "timeUnixNano", "time_unix_nano":
			ms.orig.TimeUnixNano = json.ReadUint64(iter)
		case "start_time_unix_nano", "startTimeUnixNano":
			ms.orig.StartTimeUnixNano = json.ReadUint64(iter)
		case "as_int", "asInt":
			ms.orig.Value = &otlpmetrics.NumberDataPoint_AsInt{
				AsInt: json.ReadInt64(iter),
			}
		case "as_double", "asDouble":
			ms.orig.Value = &otlpmetrics.NumberDataPoint_AsDouble{
				AsDouble: json.ReadFloat64(iter),
			}
		case "attributes":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.Attributes = append(ms.orig.Attributes, json.ReadAttribute(iter))
				return true
			})
		case "exemplars":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.Exemplars().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		case "flags":
			ms.orig.Flags = json.ReadUint32(iter)
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms HistogramDataPoint) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "timeUnixNano", "time_unix_nano":
			ms.orig.TimeUnixNano = json.ReadUint64(iter)
		case "start_time_unix_nano", "startTimeUnixNano":
			ms.orig.StartTimeUnixNano = json.ReadUint64(iter)
		case "attributes":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.Attributes = append(ms.orig.Attributes, json.ReadAttribute(iter))
				return true
			})
		case "count":
			ms.orig.Count = json.ReadUint64(iter)
		case "sum":
			ms.orig.Sum_ = &otlpmetrics.HistogramDataPoint_Sum{Sum: json.ReadFloat64(iter)}
		case "bucket_counts", "bucketCounts":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.BucketCounts = append(ms.orig.BucketCounts, json.ReadUint64(iter))
				return true
			})
		case "explicit_bounds", "explicitBounds":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.ExplicitBounds = append(ms.orig.ExplicitBounds, json.ReadFloat64(iter))
				return true
			})
		case "exemplars":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.Exemplars().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		case "flags":
			ms.orig.Flags = json.ReadUint32(iter)
		case "max":
			ms.orig.Max_ = &otlpmetrics.HistogramDataPoint_Max{
				Max: json.ReadFloat64(iter),
			}
		case "min":
			ms.orig.Min_ = &otlpmetrics.HistogramDataPoint_Min{
				Min: json.ReadFloat64(iter),
			}
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms ExponentialHistogramDataPoint) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "timeUnixNano", "time_unix_nano":
			ms.orig.TimeUnixNano = json.ReadUint64(iter)
		case "start_time_unix_nano", "startTimeUnixNano":
			ms.orig.StartTimeUnixNano = json.ReadUint64(iter)
		case "attributes":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.Attributes = append(ms.orig.Attributes, json.ReadAttribute(iter))
				return true
			})
		case "count":
			ms.orig.Count = json.ReadUint64(iter)
		case "sum":
			ms.orig.Sum_ = &otlpmetrics.ExponentialHistogramDataPoint_Sum{
				Sum: json.ReadFloat64(iter),
			}
		case "scale":
			ms.orig.Scale = iter.ReadInt32()
		case "zero_count", "zeroCount":
			ms.orig.ZeroCount = json.ReadUint64(iter)
		case "positive":
			ms.Positive().unmarshalJsoniter(iter)
		case "negative":
			ms.Negative().unmarshalJsoniter(iter)
		case "exemplars":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.Exemplars().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		case "flags":
			ms.orig.Flags = json.ReadUint32(iter)
		case "max":
			ms.orig.Max_ = &otlpmetrics.ExponentialHistogramDataPoint_Max{
				Max: json.ReadFloat64(iter),
			}
		case "min":
			ms.orig.Min_ = &otlpmetrics.ExponentialHistogramDataPoint_Min{
				Min: json.ReadFloat64(iter),
			}
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms SummaryDataPoint) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "timeUnixNano", "time_unix_nano":
			ms.orig.TimeUnixNano = json.ReadUint64(iter)
		case "start_time_unix_nano", "startTimeUnixNano":
			ms.orig.StartTimeUnixNano = json.ReadUint64(iter)
		case "attributes":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.Attributes = append(ms.orig.Attributes, json.ReadAttribute(iter))
				return true
			})
		case "count":
			ms.orig.Count = json.ReadUint64(iter)
		case "sum":
			ms.orig.Sum = json.ReadFloat64(iter)
		case "quantile_values", "quantileValues":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.QuantileValues().AppendEmpty().unmarshalJsoniter(iter)
				return true
			})
		case "flags":
			ms.orig.Flags = json.ReadUint32(iter)
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms ExponentialHistogramDataPointBuckets) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "bucket_counts", "bucketCounts":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.BucketCounts = append(ms.orig.BucketCounts, json.ReadUint64(iter))
				return true
			})
		case "offset":
			ms.orig.Offset = iter.ReadInt32()
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms SummaryDataPointValueAtQuantile) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "quantile":
			ms.orig.Quantile = json.ReadFloat64(iter)
		case "value":
			ms.orig.Value = json.ReadFloat64(iter)
		default:
			iter.Skip()
		}
		return true
	})
}

func (ms Exemplar) unmarshalJsoniter(iter *jsoniter.Iterator) {
	iter.ReadObjectCB(func(iter *jsoniter.Iterator, f string) bool {
		switch f {
		case "filtered_attributes", "filteredAttributes":
			iter.ReadArrayCB(func(iter *jsoniter.Iterator) bool {
				ms.orig.FilteredAttributes = append(ms.orig.FilteredAttributes, json.ReadAttribute(iter))
				return true
			})
		case "timeUnixNano", "time_unix_nano":
			ms.orig.TimeUnixNano = json.ReadUint64(iter)
		case "as_int", "asInt":
			ms.orig.Value = &otlpmetrics.Exemplar_AsInt{
				AsInt: json.ReadInt64(iter),
			}
		case "as_double", "asDouble":
			ms.orig.Value = &otlpmetrics.Exemplar_AsDouble{
				AsDouble: json.ReadFloat64(iter),
			}
		case "traceId", "trace_id":
			if err := ms.orig.TraceId.UnmarshalJSON([]byte(iter.ReadString())); err != nil {
				iter.ReportError("exemplar.traceId", fmt.Sprintf("parse trace_id:%v", err))
			}
		case "spanId", "span_id":
			if err := ms.orig.SpanId.UnmarshalJSON([]byte(iter.ReadString())); err != nil {
				iter.ReportError("exemplar.spanId", fmt.Sprintf("parse span_id:%v", err))
			}
		default:
			iter.Skip()
		}
		return true
	})
}

func readAggregationTemporality(iter *jsoniter.Iterator) otlpmetrics.AggregationTemporality {
	return otlpmetrics.AggregationTemporality(json.ReadEnumValue(iter, otlpmetrics.AggregationTemporality_value))
}
