// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package jaeger // import "github.com/open-telemetry/opentelemetry-collector-contrib/pkg/translator/jaeger"

import (
	"fmt"
	"reflect"

	"github.com/jaegertracing/jaeger-idl/thrift-gen/jaeger"
	"go.opentelemetry.io/collector/pdata/pcommon"
	"go.opentelemetry.io/collector/pdata/ptrace"
	conventions "go.opentelemetry.io/collector/semconv/v1.9.0"

	"github.com/open-telemetry/opentelemetry-collector-contrib/internal/coreinternal/tracetranslator"
	idutils "github.com/open-telemetry/opentelemetry-collector-contrib/pkg/core/xidutils"
)

var blankJaegerThriftSpan = new(jaeger.Span)

// ThriftToTraces transforms a Thrift trace batch into ptrace.Traces.
func ThriftToTraces(batches *jaeger.Batch) (ptrace.Traces, error) {
	traceData := ptrace.NewTraces()
	jProcess := batches.GetProcess()
	jSpans := batches.GetSpans()

	if jProcess == nil && len(jSpans) == 0 {
		return traceData, nil
	}

	rs := traceData.ResourceSpans().AppendEmpty()
	jThriftProcessToInternalResource(jProcess, rs.Resource())

	if len(jSpans) == 0 {
		return traceData, nil
	}

	jThriftSpansToInternal(jSpans, rs.ScopeSpans().AppendEmpty().Spans())

	return traceData, nil
}

func jThriftProcessToInternalResource(process *jaeger.Process, dest pcommon.Resource) {
	if process == nil {
		return
	}

	serviceName := process.GetServiceName()
	tags := process.GetTags()
	if serviceName == "" && tags == nil {
		return
	}

	attrs := dest.Attributes()
	if serviceName != "" {
		attrs.EnsureCapacity(len(tags) + 1)
		attrs.PutStr(conventions.AttributeServiceName, serviceName)
	} else {
		attrs.EnsureCapacity(len(tags))
	}
	jThriftTagsToInternalAttributes(tags, attrs)

	// Handle special keys translations.
	translateHostnameAttr(attrs)
	translateJaegerVersionAttr(attrs)
}

func jThriftSpansToInternal(spans []*jaeger.Span, dest ptrace.SpanSlice) {
	if len(spans) == 0 {
		return
	}

	dest.EnsureCapacity(len(spans))
	for _, span := range spans {
		if span == nil || reflect.DeepEqual(span, blankJaegerThriftSpan) {
			continue
		}
		jThriftSpanToInternal(span, dest.AppendEmpty())
	}
}

// jThriftSpanParentID infers the parent span ID for a given span.
// Based on https://github.com/jaegertracing/jaeger/blob/8c61b6561f9057a199c1504606d8e68319ee7b31/model/span.go#L143
func jThriftSpanParentID(span *jaeger.Span) int64 {
	if span.ParentSpanId != 0 {
		return span.ParentSpanId
	}
	// If span.ParentSpanId undefined but there are references to the same trace,
	// they can also be considered a parent, with CHILD_OF being higher priority.
	var ffRef *jaeger.SpanRef
	for _, ref := range span.References {
		// must be from the same trace
		if ref.TraceIdHigh != span.TraceIdHigh || ref.TraceIdLow != span.TraceIdLow {
			continue
		}
		if ref.RefType == jaeger.SpanRefType_CHILD_OF {
			return ref.SpanId
		}
		if ffRef == nil && ref.RefType == jaeger.SpanRefType_FOLLOWS_FROM {
			ffRef = ref
		}
	}
	if ffRef != nil {
		return ffRef.SpanId
	}
	return 0
}

func jThriftSpanToInternal(span *jaeger.Span, dest ptrace.Span) {
	dest.SetTraceID(idutils.UInt64ToTraceID(uint64(span.TraceIdHigh), uint64(span.TraceIdLow)))
	dest.SetSpanID(idutils.UInt64ToSpanID(uint64(span.SpanId)))
	dest.SetName(span.OperationName)
	dest.SetStartTimestamp(microsecondsToUnixNano(span.StartTime))
	dest.SetEndTimestamp(microsecondsToUnixNano(span.StartTime + span.Duration))

	parentSpanID := jThriftSpanParentID(span)
	if parentSpanID != 0 {
		dest.SetParentSpanID(idutils.UInt64ToSpanID(uint64(parentSpanID)))
	}

	attrs := dest.Attributes()
	attrs.EnsureCapacity(len(span.Tags))
	jThriftTagsToInternalAttributes(span.Tags, attrs)
	if spanKindAttr, ok := attrs.Get(tracetranslator.TagSpanKind); ok {
		dest.SetKind(jSpanKindToInternal(spanKindAttr.Str()))
		attrs.Remove(tracetranslator.TagSpanKind)
	}
	setInternalSpanStatus(attrs, dest)

	// drop the attributes slice if all of them were replaced during translation
	if attrs.Len() == 0 {
		attrs.Clear()
	}

	jThriftLogsToSpanEvents(span.Logs, dest.Events())
	jThriftReferencesToSpanLinks(span.References, parentSpanID, dest.Links())
}

// jThriftTagsToInternalAttributes sets internal span links based on jaeger span references skipping excludeParentID
func jThriftTagsToInternalAttributes(tags []*jaeger.Tag, dest pcommon.Map) {
	for _, tag := range tags {
		switch tag.GetVType() {
		case jaeger.TagType_STRING:
			dest.PutStr(tag.Key, tag.GetVStr())
		case jaeger.TagType_BOOL:
			dest.PutBool(tag.Key, tag.GetVBool())
		case jaeger.TagType_LONG:
			dest.PutInt(tag.Key, tag.GetVLong())
		case jaeger.TagType_DOUBLE:
			dest.PutDouble(tag.Key, tag.GetVDouble())
		case jaeger.TagType_BINARY:
			dest.PutEmptyBytes(tag.Key).FromRaw(tag.GetVBinary())
		default:
			dest.PutStr(tag.Key, fmt.Sprintf("<Unknown Jaeger TagType %q>", tag.GetVType()))
		}
	}
}

func jThriftLogsToSpanEvents(logs []*jaeger.Log, dest ptrace.SpanEventSlice) {
	if len(logs) == 0 {
		return
	}

	dest.EnsureCapacity(len(logs))

	for _, log := range logs {
		event := dest.AppendEmpty()

		event.SetTimestamp(microsecondsToUnixNano(log.Timestamp))
		if len(log.Fields) == 0 {
			continue
		}

		attrs := event.Attributes()
		attrs.EnsureCapacity(len(log.Fields))
		jThriftTagsToInternalAttributes(log.Fields, attrs)
		if name, ok := attrs.Get(eventNameAttr); ok {
			event.SetName(name.Str())
			attrs.Remove(eventNameAttr)
		}
	}
}

func jThriftReferencesToSpanLinks(refs []*jaeger.SpanRef, excludeParentID int64, dest ptrace.SpanLinkSlice) {
	if len(refs) == 0 || len(refs) == 1 && refs[0].SpanId == excludeParentID && refs[0].RefType == jaeger.SpanRefType_CHILD_OF {
		return
	}

	dest.EnsureCapacity(len(refs))
	for _, ref := range refs {
		if ref.SpanId == excludeParentID && ref.RefType == jaeger.SpanRefType_CHILD_OF {
			continue
		}

		link := dest.AppendEmpty()
		link.SetTraceID(idutils.UInt64ToTraceID(uint64(ref.TraceIdHigh), uint64(ref.TraceIdLow)))
		link.SetSpanID(idutils.UInt64ToSpanID(uint64(ref.SpanId)))
		link.Attributes().PutStr(conventions.AttributeOpentracingRefType, jThriftRefTypeToAttribute(ref.RefType))
	}
}

// microsecondsToUnixNano converts epoch microseconds to pcommon.Timestamp
func microsecondsToUnixNano(ms int64) pcommon.Timestamp {
	return pcommon.Timestamp(uint64(ms) * 1000)
}

func jThriftRefTypeToAttribute(ref jaeger.SpanRefType) string {
	if ref == jaeger.SpanRefType_CHILD_OF {
		return conventions.AttributeOpentracingRefTypeChildOf
	}
	return conventions.AttributeOpentracingRefTypeFollowsFrom
}
