// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package trace

import (
	"context"
	"errors"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/api/googleapi"
	"google.golang.org/grpc/status"
)

const (
	OpenTelemetryTracerName = "cloud.google.com/go"
)

// StartSpan adds an OpenTelemetry span to the trace with the given name.
//
// The default experimental tracing support for OpenCensus is now deprecated in
// the Google Cloud client libraries for Go.
func StartSpan(ctx context.Context, name string) context.Context {
	ctx, _ = otel.GetTracerProvider().Tracer(OpenTelemetryTracerName).Start(ctx, name)
	return ctx
}

// EndSpan ends an OpenTelemetry span with the given error.
//
// The default experimental tracing support for OpenCensus is now deprecated in
// the Google Cloud client libraries for Go.
func EndSpan(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	if err != nil {
		span.SetStatus(codes.Error, toOpenTelemetryStatusDescription(err))
		span.RecordError(err)
	}
	span.End()
}

// toOpenTelemetryStatus converts an error to an equivalent OpenTelemetry status description.
func toOpenTelemetryStatusDescription(err error) string {
	var err2 *googleapi.Error
	if ok := errors.As(err, &err2); ok {
		return err2.Message
	} else if s, ok := status.FromError(err); ok {
		return s.Message()
	} else {
		return err.Error()
	}
}

// TracePrintf retrieves the current OpenTelemetry span from context, then calls
// Span.AddEvent. The expected span must be an OpenTelemetry span. The default
// experimental tracing support for OpenCensus is now deprecated in the Google
// Cloud client libraries for Go.
func TracePrintf(ctx context.Context, attrMap map[string]interface{}, format string, args ...interface{}) {
	attrs := otAttrs(attrMap)
	trace.SpanFromContext(ctx).AddEvent(fmt.Sprintf(format, args...), trace.WithAttributes(attrs...))
}

// otAttrs converts a generic map to OpenTelemetry attributes.
func otAttrs(attrMap map[string]interface{}) []attribute.KeyValue {
	var attrs []attribute.KeyValue
	for k, v := range attrMap {
		var a attribute.KeyValue
		switch v := v.(type) {
		case string:
			a = attribute.Key(k).String(v)
		case bool:
			a = attribute.Key(k).Bool(v)
		case int:
			a = attribute.Key(k).Int(v)
		case int64:
			a = attribute.Key(k).Int64(v)
		default:
			a = attribute.Key(k).String(fmt.Sprintf("%#v", v))
		}
		attrs = append(attrs, a)
	}
	return attrs
}
