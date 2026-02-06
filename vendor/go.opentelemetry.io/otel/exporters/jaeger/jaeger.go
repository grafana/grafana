// Copyright The OpenTelemetry Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaeger // import "go.opentelemetry.io/otel/exporters/jaeger"

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	gen "go.opentelemetry.io/otel/exporters/jaeger/internal/gen-go/jaeger"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

const (
	keyInstrumentationLibraryName    = "otel.library.name"
	keyInstrumentationLibraryVersion = "otel.library.version"
	keyError                         = "error"
	keySpanKind                      = "span.kind"
	keyStatusCode                    = "otel.status_code"
	keyStatusMessage                 = "otel.status_description"
	keyDroppedAttributeCount         = "otel.event.dropped_attributes_count"
	keyEventName                     = "event"
)

// New returns an OTel Exporter implementation that exports the collected
// spans to Jaeger.
func New(endpointOption EndpointOption) (*Exporter, error) {
	uploader, err := endpointOption.newBatchUploader()
	if err != nil {
		return nil, err
	}

	// Fetch default service.name from default resource for backup
	var defaultServiceName string
	defaultResource := resource.Default()
	if value, exists := defaultResource.Set().Value(semconv.ServiceNameKey); exists {
		defaultServiceName = value.AsString()
	}
	if defaultServiceName == "" {
		return nil, fmt.Errorf("failed to get service name from default resource")
	}

	stopCh := make(chan struct{})
	e := &Exporter{
		uploader:           uploader,
		stopCh:             stopCh,
		defaultServiceName: defaultServiceName,
	}
	return e, nil
}

// Exporter exports OpenTelemetry spans to a Jaeger agent or collector.
type Exporter struct {
	uploader           batchUploader
	stopOnce           sync.Once
	stopCh             chan struct{}
	defaultServiceName string
}

var _ sdktrace.SpanExporter = (*Exporter)(nil)

// ExportSpans transforms and exports OpenTelemetry spans to Jaeger.
func (e *Exporter) ExportSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error {
	// Return fast if context is already canceled or Exporter shutdown.
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-e.stopCh:
		return nil
	default:
	}

	// Cancel export if Exporter is shutdown.
	var cancel context.CancelFunc
	ctx, cancel = context.WithCancel(ctx)
	defer cancel()
	go func(ctx context.Context, cancel context.CancelFunc) {
		select {
		case <-ctx.Done():
		case <-e.stopCh:
			cancel()
		}
	}(ctx, cancel)

	for _, batch := range jaegerBatchList(spans, e.defaultServiceName) {
		if err := e.uploader.upload(ctx, batch); err != nil {
			return err
		}
	}

	return nil
}

// Shutdown stops the Exporter. This will close all connections and release
// all resources held by the Exporter.
func (e *Exporter) Shutdown(ctx context.Context) error {
	// Stop any active and subsequent exports.
	e.stopOnce.Do(func() { close(e.stopCh) })
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	return e.uploader.shutdown(ctx)
}

// MarshalLog is the marshaling function used by the logging system to represent this exporter.
func (e *Exporter) MarshalLog() interface{} {
	return struct {
		Type string
	}{
		Type: "jaeger",
	}
}

func spanToThrift(ss sdktrace.ReadOnlySpan) *gen.Span {
	attr := ss.Attributes()
	tags := make([]*gen.Tag, 0, len(attr))
	for _, kv := range attr {
		tag := keyValueToTag(kv)
		if tag != nil {
			tags = append(tags, tag)
		}
	}

	if is := ss.InstrumentationScope(); is.Name != "" {
		tags = append(tags, getStringTag(keyInstrumentationLibraryName, is.Name))
		if is.Version != "" {
			tags = append(tags, getStringTag(keyInstrumentationLibraryVersion, is.Version))
		}
	}

	if ss.SpanKind() != trace.SpanKindInternal {
		tags = append(tags,
			getStringTag(keySpanKind, ss.SpanKind().String()),
		)
	}

	if ss.Status().Code != codes.Unset {
		switch ss.Status().Code {
		case codes.Ok:
			tags = append(tags, getStringTag(keyStatusCode, "OK"))
		case codes.Error:
			tags = append(tags, getBoolTag(keyError, true))
			tags = append(tags, getStringTag(keyStatusCode, "ERROR"))
		}
		if ss.Status().Description != "" {
			tags = append(tags, getStringTag(keyStatusMessage, ss.Status().Description))
		}
	}

	var logs []*gen.Log
	for _, a := range ss.Events() {
		nTags := len(a.Attributes)
		if a.Name != "" {
			nTags++
		}
		if a.DroppedAttributeCount != 0 {
			nTags++
		}
		fields := make([]*gen.Tag, 0, nTags)
		if a.Name != "" {
			// If an event contains an attribute with the same key, it needs
			// to be given precedence and overwrite this.
			fields = append(fields, getStringTag(keyEventName, a.Name))
		}
		for _, kv := range a.Attributes {
			tag := keyValueToTag(kv)
			if tag != nil {
				fields = append(fields, tag)
			}
		}
		if a.DroppedAttributeCount != 0 {
			fields = append(fields, getInt64Tag(keyDroppedAttributeCount, int64(a.DroppedAttributeCount)))
		}
		logs = append(logs, &gen.Log{
			Timestamp: a.Time.UnixNano() / 1000,
			Fields:    fields,
		})
	}

	var refs []*gen.SpanRef
	for _, link := range ss.Links() {
		tid := link.SpanContext.TraceID()
		sid := link.SpanContext.SpanID()
		refs = append(refs, &gen.SpanRef{
			TraceIdHigh: int64(binary.BigEndian.Uint64(tid[0:8])),
			TraceIdLow:  int64(binary.BigEndian.Uint64(tid[8:16])),
			SpanId:      int64(binary.BigEndian.Uint64(sid[:])),
			RefType:     gen.SpanRefType_FOLLOWS_FROM,
		})
	}

	tid := ss.SpanContext().TraceID()
	sid := ss.SpanContext().SpanID()
	psid := ss.Parent().SpanID()
	return &gen.Span{
		TraceIdHigh:   int64(binary.BigEndian.Uint64(tid[0:8])),
		TraceIdLow:    int64(binary.BigEndian.Uint64(tid[8:16])),
		SpanId:        int64(binary.BigEndian.Uint64(sid[:])),
		ParentSpanId:  int64(binary.BigEndian.Uint64(psid[:])),
		OperationName: ss.Name(), // TODO: if span kind is added then add prefix "Sent"/"Recv"
		Flags:         int32(ss.SpanContext().TraceFlags()),
		StartTime:     ss.StartTime().UnixNano() / 1000,
		Duration:      ss.EndTime().Sub(ss.StartTime()).Nanoseconds() / 1000,
		Tags:          tags,
		Logs:          logs,
		References:    refs,
	}
}

func keyValueToTag(keyValue attribute.KeyValue) *gen.Tag {
	var tag *gen.Tag
	switch keyValue.Value.Type() {
	case attribute.STRING:
		s := keyValue.Value.AsString()
		tag = &gen.Tag{
			Key:   string(keyValue.Key),
			VStr:  &s,
			VType: gen.TagType_STRING,
		}
	case attribute.BOOL:
		b := keyValue.Value.AsBool()
		tag = &gen.Tag{
			Key:   string(keyValue.Key),
			VBool: &b,
			VType: gen.TagType_BOOL,
		}
	case attribute.INT64:
		i := keyValue.Value.AsInt64()
		tag = &gen.Tag{
			Key:   string(keyValue.Key),
			VLong: &i,
			VType: gen.TagType_LONG,
		}
	case attribute.FLOAT64:
		f := keyValue.Value.AsFloat64()
		tag = &gen.Tag{
			Key:     string(keyValue.Key),
			VDouble: &f,
			VType:   gen.TagType_DOUBLE,
		}
	case attribute.BOOLSLICE,
		attribute.INT64SLICE,
		attribute.FLOAT64SLICE,
		attribute.STRINGSLICE:
		data, _ := json.Marshal(keyValue.Value.AsInterface())
		a := (string)(data)
		tag = &gen.Tag{
			Key:   string(keyValue.Key),
			VStr:  &a,
			VType: gen.TagType_STRING,
		}
	}
	return tag
}

func getInt64Tag(k string, i int64) *gen.Tag {
	return &gen.Tag{
		Key:   k,
		VLong: &i,
		VType: gen.TagType_LONG,
	}
}

func getStringTag(k, s string) *gen.Tag {
	return &gen.Tag{
		Key:   k,
		VStr:  &s,
		VType: gen.TagType_STRING,
	}
}

func getBoolTag(k string, b bool) *gen.Tag {
	return &gen.Tag{
		Key:   k,
		VBool: &b,
		VType: gen.TagType_BOOL,
	}
}

// jaegerBatchList transforms a slice of spans into a slice of jaeger Batch.
func jaegerBatchList(ssl []sdktrace.ReadOnlySpan, defaultServiceName string) []*gen.Batch {
	if len(ssl) == 0 {
		return nil
	}

	batchDict := make(map[attribute.Distinct]*gen.Batch)

	for _, ss := range ssl {
		if ss == nil {
			continue
		}

		resourceKey := ss.Resource().Equivalent()
		batch, bOK := batchDict[resourceKey]
		if !bOK {
			batch = &gen.Batch{
				Process: process(ss.Resource(), defaultServiceName),
				Spans:   []*gen.Span{},
			}
		}
		batch.Spans = append(batch.Spans, spanToThrift(ss))
		batchDict[resourceKey] = batch
	}

	// Transform the categorized map into a slice
	batchList := make([]*gen.Batch, 0, len(batchDict))
	for _, batch := range batchDict {
		batchList = append(batchList, batch)
	}
	return batchList
}

// process transforms an OTel Resource into a jaeger Process.
func process(res *resource.Resource, defaultServiceName string) *gen.Process {
	var process gen.Process

	var serviceName attribute.KeyValue
	if res != nil {
		for iter := res.Iter(); iter.Next(); {
			if iter.Attribute().Key == semconv.ServiceNameKey {
				serviceName = iter.Attribute()
				// Don't convert service.name into tag.
				continue
			}
			if tag := keyValueToTag(iter.Attribute()); tag != nil {
				process.Tags = append(process.Tags, tag)
			}
		}
	}

	// If no service.name is contained in a Span's Resource,
	// that field MUST be populated from the default Resource.
	if serviceName.Value.AsString() == "" {
		serviceName = semconv.ServiceName(defaultServiceName)
	}
	process.ServiceName = serviceName.Value.AsString()

	return &process
}
