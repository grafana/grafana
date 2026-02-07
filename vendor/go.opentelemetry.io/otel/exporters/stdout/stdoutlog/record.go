// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package stdoutlog // import "go.opentelemetry.io/otel/exporters/stdout/stdoutlog"

import (
	"encoding/json"
	"errors"
	"time"

	"go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/sdk/instrumentation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/trace"
)

func newValue(v log.Value) value {
	return value{Value: v}
}

type value struct {
	log.Value
}

// MarshalJSON implements a custom marshal function to encode log.Value.
func (v value) MarshalJSON() ([]byte, error) {
	var jsonVal struct {
		Type  string
		Value interface{}
	}
	jsonVal.Type = v.Kind().String()

	switch v.Kind() {
	case log.KindString:
		jsonVal.Value = v.AsString()
	case log.KindInt64:
		jsonVal.Value = v.AsInt64()
	case log.KindFloat64:
		jsonVal.Value = v.AsFloat64()
	case log.KindBool:
		jsonVal.Value = v.AsBool()
	case log.KindBytes:
		jsonVal.Value = v.AsBytes()
	case log.KindMap:
		m := v.AsMap()
		values := make([]keyValue, 0, len(m))
		for _, kv := range m {
			values = append(values, keyValue{
				Key:   kv.Key,
				Value: newValue(kv.Value),
			})
		}

		jsonVal.Value = values
	case log.KindSlice:
		s := v.AsSlice()
		values := make([]value, 0, len(s))
		for _, e := range s {
			values = append(values, newValue(e))
		}

		jsonVal.Value = values
	case log.KindEmpty:
		jsonVal.Value = nil
	default:
		return nil, errors.New("invalid Kind")
	}

	return json.Marshal(jsonVal)
}

type keyValue struct {
	Key   string
	Value value
}

// recordJSON is a JSON-serializable representation of a Record.
type recordJSON struct {
	Timestamp         *time.Time `json:",omitempty"`
	ObservedTimestamp *time.Time `json:",omitempty"`
	EventName         string     `json:",omitempty"`
	Severity          log.Severity
	SeverityText      string
	Body              value
	Attributes        []keyValue
	TraceID           trace.TraceID
	SpanID            trace.SpanID
	TraceFlags        trace.TraceFlags
	Resource          *resource.Resource
	Scope             instrumentation.Scope
	DroppedAttributes int
}

func (e *Exporter) newRecordJSON(r sdklog.Record) recordJSON {
	res := r.Resource()
	newRecord := recordJSON{
		EventName:    r.EventName(),
		Severity:     r.Severity(),
		SeverityText: r.SeverityText(),
		Body:         newValue(r.Body()),

		TraceID:    r.TraceID(),
		SpanID:     r.SpanID(),
		TraceFlags: r.TraceFlags(),

		Attributes: make([]keyValue, 0, r.AttributesLen()),

		Resource: &res,
		Scope:    r.InstrumentationScope(),

		DroppedAttributes: r.DroppedAttributes(),
	}

	r.WalkAttributes(func(kv log.KeyValue) bool {
		newRecord.Attributes = append(newRecord.Attributes, keyValue{
			Key:   kv.Key,
			Value: newValue(kv.Value),
		})
		return true
	})

	if e.timestamps {
		timestamp := r.Timestamp()
		newRecord.Timestamp = &timestamp

		observedTimestamp := r.ObservedTimestamp()
		newRecord.ObservedTimestamp = &observedTimestamp
	}

	return newRecord
}
