// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package jaeger // import "github.com/open-telemetry/opentelemetry-collector-contrib/pkg/translator/jaeger"

import (
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"reflect"
	"strconv"
	"strings"

	"github.com/jaegertracing/jaeger-idl/model/v1"
	"go.opentelemetry.io/collector/pdata/pcommon"
	"go.opentelemetry.io/collector/pdata/ptrace"
	conventions "go.opentelemetry.io/collector/semconv/v1.16.0"

	"github.com/open-telemetry/opentelemetry-collector-contrib/internal/coreinternal/occonventions"
	"github.com/open-telemetry/opentelemetry-collector-contrib/internal/coreinternal/tracetranslator"
	idutils "github.com/open-telemetry/opentelemetry-collector-contrib/pkg/core/xidutils"
)

var blankJaegerProtoSpan = new(model.Span)

// ProtoToTraces converts multiple Jaeger proto batches to internal traces
func ProtoToTraces(batches []*model.Batch) (ptrace.Traces, error) {
	traceData := ptrace.NewTraces()
	if len(batches) == 0 {
		return traceData, nil
	}

	batches = regroup(batches)
	rss := traceData.ResourceSpans()
	rss.EnsureCapacity(len(batches))

	for _, batch := range batches {
		if batch.GetProcess() == nil && len(batch.GetSpans()) == 0 {
			continue
		}

		protoBatchToResourceSpans(*batch, rss.AppendEmpty())
	}

	return traceData, nil
}

func regroup(batches []*model.Batch) []*model.Batch {
	// Re-group batches
	// This is needed as there might be a Process within Batch and Span at the same
	// time, with the span one taking precedence.
	// As we only have it at one level in OpenTelemetry, ResourceSpans, we split
	// each batch into potentially multiple other batches, with the sum of their
	// processes as the key to a map.
	// Step 1) iterate over the batches
	// Step 2) for each batch, calculate the batch's process checksum and store
	// it on a map, with the checksum as the key and the process as the value
	// Step 3) iterate the spans for a batch: if a given span has its own process,
	// calculate the checksum for the process and store it on the same map
	// Step 4) each entry on the map becomes a ResourceSpan
	registry := map[uint64]*model.Batch{}

	for _, batch := range batches {
		bb := batchForProcess(registry, batch.Process)
		for _, span := range batch.Spans {
			if span.Process == nil {
				bb.Spans = append(bb.Spans, span)
			} else {
				b := batchForProcess(registry, span.Process)
				b.Spans = append(b.Spans, span)
			}
		}
	}

	result := make([]*model.Batch, 0, len(registry))
	for _, v := range registry {
		result = append(result, v)
	}

	return result
}

func batchForProcess(registry map[uint64]*model.Batch, p *model.Process) *model.Batch {
	sum := checksum(p)
	batch := registry[sum]
	if batch == nil {
		batch = &model.Batch{
			Process: p,
		}
		registry[sum] = batch
	}

	return batch
}

func checksum(process *model.Process) uint64 {
	// this will get all the keys and values, plus service name, into this buffer
	// this is potentially dangerous, as a batch/span with a big enough processes
	// might cause the collector to allocate this extra big information
	// for this reason, we hash it as an integer and return it, instead of keeping
	// all the hashes for all the processes for all batches in memory
	fnvHash := fnv.New64a()

	if process != nil {
		// this effectively means that all spans from batches with nil processes
		// will be grouped together
		// this should only ever happen in unit tests
		// this implementation never returns an error according to the Hash interface
		_ = process.Hash(fnvHash)
	}

	out := make([]byte, 0, 16)
	out = fnvHash.Sum(out)
	return binary.BigEndian.Uint64(out)
}

func protoBatchToResourceSpans(batch model.Batch, dest ptrace.ResourceSpans) {
	jSpans := batch.GetSpans()

	jProcessToInternalResource(batch.GetProcess(), dest.Resource())

	if len(jSpans) == 0 {
		return
	}

	jSpansToInternal(jSpans, dest.ScopeSpans())
}

func jProcessToInternalResource(process *model.Process, dest pcommon.Resource) {
	if process == nil || process.ServiceName == tracetranslator.ResourceNoServiceName {
		return
	}

	serviceName := process.ServiceName
	tags := process.Tags
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
	jTagsToInternalAttributes(tags, attrs)

	// Handle special keys translations.
	translateHostnameAttr(attrs)
	translateJaegerVersionAttr(attrs)
}

// translateHostnameAttr translates "hostname" atttribute
func translateHostnameAttr(attrs pcommon.Map) {
	hostname, hostnameFound := attrs.Get("hostname")
	_, convHostNameFound := attrs.Get(conventions.AttributeHostName)
	if hostnameFound && !convHostNameFound {
		hostname.CopyTo(attrs.PutEmpty(conventions.AttributeHostName))
		attrs.Remove("hostname")
	}
}

// translateHostnameAttr translates "jaeger.version" atttribute
func translateJaegerVersionAttr(attrs pcommon.Map) {
	jaegerVersion, jaegerVersionFound := attrs.Get("jaeger.version")
	_, exporterVersionFound := attrs.Get(occonventions.AttributeExporterVersion)
	if jaegerVersionFound && !exporterVersionFound {
		attrs.PutStr(occonventions.AttributeExporterVersion, "Jaeger-"+jaegerVersion.Str())
		attrs.Remove("jaeger.version")
	}
}

type scope struct {
	name, version string
}

func jSpansToInternal(spans []*model.Span, dest ptrace.ScopeSpansSlice) {
	spansByLibrary := make(map[scope]ptrace.SpanSlice)

	for _, span := range spans {
		if span == nil || reflect.DeepEqual(span, blankJaegerProtoSpan) {
			continue
		}
		il := getScope(span)
		sps, found := spansByLibrary[il]
		if !found {
			ss := dest.AppendEmpty()
			ss.Scope().SetName(il.name)
			ss.Scope().SetVersion(il.version)
			sps = ss.Spans()
			spansByLibrary[il] = sps
		}
		jSpanToInternal(span, sps.AppendEmpty())
	}
}

func jSpanToInternal(span *model.Span, dest ptrace.Span) {
	dest.SetTraceID(idutils.UInt64ToTraceID(span.TraceID.High, span.TraceID.Low))
	dest.SetSpanID(idutils.UInt64ToSpanID(uint64(span.SpanID)))
	dest.SetName(span.OperationName)
	dest.SetStartTimestamp(pcommon.NewTimestampFromTime(span.StartTime))
	dest.SetEndTimestamp(pcommon.NewTimestampFromTime(span.StartTime.Add(span.Duration)))

	parentSpanID := span.ParentSpanID()
	if parentSpanID != model.SpanID(0) {
		dest.SetParentSpanID(idutils.UInt64ToSpanID(uint64(parentSpanID)))
	}

	attrs := dest.Attributes()
	attrs.EnsureCapacity(len(span.Tags))
	jTagsToInternalAttributes(span.Tags, attrs)
	if spanKindAttr, ok := attrs.Get(tracetranslator.TagSpanKind); ok {
		dest.SetKind(jSpanKindToInternal(spanKindAttr.Str()))
		attrs.Remove(tracetranslator.TagSpanKind)
	}
	setInternalSpanStatus(attrs, dest)

	dest.TraceState().FromRaw(getTraceStateFromAttrs(attrs))

	// drop the attributes slice if all of them were replaced during translation
	if attrs.Len() == 0 {
		attrs.Clear()
	}

	jLogsToSpanEvents(span.Logs, dest.Events())
	jReferencesToSpanLinks(span.References, parentSpanID, dest.Links())
}

func jTagsToInternalAttributes(tags []model.KeyValue, dest pcommon.Map) {
	for _, tag := range tags {
		switch tag.GetVType() {
		case model.ValueType_STRING:
			dest.PutStr(tag.Key, tag.GetVStr())
		case model.ValueType_BOOL:
			dest.PutBool(tag.Key, tag.GetVBool())
		case model.ValueType_INT64:
			dest.PutInt(tag.Key, tag.GetVInt64())
		case model.ValueType_FLOAT64:
			dest.PutDouble(tag.Key, tag.GetVFloat64())
		case model.ValueType_BINARY:
			dest.PutEmptyBytes(tag.Key).FromRaw(tag.GetVBinary())
		default:
			dest.PutStr(tag.Key, fmt.Sprintf("<Unknown Jaeger TagType %q>", tag.GetVType()))
		}
	}
}

func setInternalSpanStatus(attrs pcommon.Map, span ptrace.Span) {
	dest := span.Status()
	statusCode := ptrace.StatusCodeUnset
	statusMessage := ""
	statusExists := false

	if errorVal, ok := attrs.Get(tracetranslator.TagError); ok && errorVal.Type() == pcommon.ValueTypeBool {
		if errorVal.Bool() {
			statusCode = ptrace.StatusCodeError
			attrs.Remove(tracetranslator.TagError)
			statusExists = true

			if desc, ok := extractStatusDescFromAttr(attrs); ok {
				statusMessage = desc
			} else if descAttr, ok := attrs.Get(tracetranslator.TagHTTPStatusMsg); ok {
				statusMessage = descAttr.Str()
			}
		}
	}

	if codeAttr, ok := attrs.Get(conventions.OtelStatusCode); ok {
		if !statusExists {
			// The error tag is the ultimate truth for a Jaeger spans' error
			// status. Only parse the otel.status_code tag if the error tag is
			// not set to true.
			statusExists = true
			switch strings.ToUpper(codeAttr.Str()) {
			case statusOk:
				statusCode = ptrace.StatusCodeOk
			case statusError:
				statusCode = ptrace.StatusCodeError
			}

			if desc, ok := extractStatusDescFromAttr(attrs); ok {
				statusMessage = desc
			}
		}
		// Regardless of error tag value, remove the otel.status_code tag. The
		// otel.status_message tag will have already been removed if
		// statusExists is true.
		attrs.Remove(conventions.OtelStatusCode)
	} else if httpCodeAttr, ok := attrs.Get(conventions.AttributeHTTPStatusCode); !statusExists && ok {
		// Fallback to introspecting if this span represents a failed HTTP
		// request or response, but again, only do so if the `error` tag was
		// not set to true and no explicit status was sent.
		if code, err := getStatusCodeFromHTTPStatusAttr(httpCodeAttr, span.Kind()); err == nil {
			if code != ptrace.StatusCodeUnset {
				statusExists = true
				statusCode = code
			}

			if msgAttr, ok := attrs.Get(tracetranslator.TagHTTPStatusMsg); ok {
				statusMessage = msgAttr.Str()
			}
		}
	}

	if statusExists {
		dest.SetCode(statusCode)
		dest.SetMessage(statusMessage)
	}
}

// extractStatusDescFromAttr returns the OTel status description from attrs
// along with true if it is set. Otherwise, an empty string and false are
// returned. The OTel status description attribute is deleted from attrs in
// the process.
func extractStatusDescFromAttr(attrs pcommon.Map) (string, bool) {
	if msgAttr, ok := attrs.Get(conventions.OtelStatusDescription); ok {
		msg := msgAttr.Str()
		attrs.Remove(conventions.OtelStatusDescription)
		return msg, true
	}
	return "", false
}

// codeFromAttr returns the integer code value from attrVal. An error is
// returned if the code is not represented by an integer or string value in
// the attrVal or the value is outside the bounds of an int representation.
func codeFromAttr(attrVal pcommon.Value) (int64, error) {
	var val int64
	switch attrVal.Type() {
	case pcommon.ValueTypeInt:
		val = attrVal.Int()
	case pcommon.ValueTypeStr:
		var err error
		val, err = strconv.ParseInt(attrVal.Str(), 10, 0)
		if err != nil {
			return 0, err
		}
	default:
		return 0, fmt.Errorf("%w: %s", errType, attrVal.Type().String())
	}
	return val, nil
}

func getStatusCodeFromHTTPStatusAttr(attrVal pcommon.Value, kind ptrace.SpanKind) (ptrace.StatusCode, error) {
	statusCode, err := codeFromAttr(attrVal)
	if err != nil {
		return ptrace.StatusCodeUnset, err
	}

	// For HTTP status codes in the 4xx range span status MUST be left unset
	// in case of SpanKind.SERVER and MUST be set to Error in case of SpanKind.CLIENT.
	// For HTTP status codes in the 5xx range, as well as any other code the client
	// failed to interpret, span status MUST be set to Error.
	if statusCode >= 400 && statusCode < 500 {
		switch kind {
		case ptrace.SpanKindClient:
			return ptrace.StatusCodeError, nil
		case ptrace.SpanKindServer:
			return ptrace.StatusCodeUnset, nil
		}
	}

	return tracetranslator.StatusCodeFromHTTP(statusCode), nil
}

func jSpanKindToInternal(spanKind string) ptrace.SpanKind {
	switch spanKind {
	case "client":
		return ptrace.SpanKindClient
	case "server":
		return ptrace.SpanKindServer
	case "producer":
		return ptrace.SpanKindProducer
	case "consumer":
		return ptrace.SpanKindConsumer
	case "internal":
		return ptrace.SpanKindInternal
	}
	return ptrace.SpanKindUnspecified
}

func jLogsToSpanEvents(logs []model.Log, dest ptrace.SpanEventSlice) {
	if len(logs) == 0 {
		return
	}

	dest.EnsureCapacity(len(logs))

	for i, log := range logs {
		var event ptrace.SpanEvent
		if dest.Len() > i {
			event = dest.At(i)
		} else {
			event = dest.AppendEmpty()
		}

		event.SetTimestamp(pcommon.NewTimestampFromTime(log.Timestamp))
		if len(log.Fields) == 0 {
			continue
		}

		attrs := event.Attributes()
		attrs.EnsureCapacity(len(log.Fields))
		jTagsToInternalAttributes(log.Fields, attrs)
		if name, ok := attrs.Get(eventNameAttr); ok {
			event.SetName(name.Str())
			attrs.Remove(eventNameAttr)
		}
	}
}

// jReferencesToSpanLinks sets internal span links based on jaeger span references skipping excludeParentID
func jReferencesToSpanLinks(refs []model.SpanRef, excludeParentID model.SpanID, dest ptrace.SpanLinkSlice) {
	if len(refs) == 0 || len(refs) == 1 && refs[0].SpanID == excludeParentID && refs[0].RefType == model.ChildOf {
		return
	}

	dest.EnsureCapacity(len(refs))
	for _, ref := range refs {
		if ref.SpanID == excludeParentID && ref.RefType == model.ChildOf {
			continue
		}

		link := dest.AppendEmpty()
		link.SetTraceID(idutils.UInt64ToTraceID(ref.TraceID.High, ref.TraceID.Low))
		link.SetSpanID(idutils.UInt64ToSpanID(uint64(ref.SpanID)))
		link.Attributes().PutStr(conventions.AttributeOpentracingRefType, jRefTypeToAttribute(ref.RefType))
	}
}

func getTraceStateFromAttrs(attrs pcommon.Map) string {
	traceState := ""
	// TODO Bring this inline with solution for jaegertracing/jaeger-client-java #702 once available
	if attr, ok := attrs.Get(tracetranslator.TagW3CTraceState); ok {
		traceState = attr.Str()
		attrs.Remove(tracetranslator.TagW3CTraceState)
	}
	return traceState
}

func getScope(span *model.Span) scope {
	il := scope{}
	if libraryName, ok := getAndDeleteTag(span, conventions.AttributeOtelScopeName); ok {
		il.name = libraryName
		if libraryVersion, ok := getAndDeleteTag(span, conventions.AttributeOtelScopeVersion); ok {
			il.version = libraryVersion
		}
	}
	return il
}

func getAndDeleteTag(span *model.Span, key string) (string, bool) {
	for i := range span.Tags {
		if span.Tags[i].Key == key {
			value := span.Tags[i].GetVStr()
			span.Tags = append(span.Tags[:i], span.Tags[i+1:]...)
			return value, true
		}
	}
	return "", false
}

func jRefTypeToAttribute(ref model.SpanRefType) string {
	if ref == model.ChildOf {
		return conventions.AttributeOpentracingRefTypeChildOf
	}
	return conventions.AttributeOpentracingRefTypeFollowsFrom
}
