// Copyright 2019-2025 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package otel

import (
	"context"
	"fmt"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
	"gocloud.dev/gcerrors"
	"reflect"
	"time"
)

// Common attribute keys used across the Go CDK.
var (
	methodKey   = attribute.Key("gocdk_method")
	packageKey  = attribute.Key("gocdk_package")
	providerKey = attribute.Key("gocdk_provider")
	statusKey   = attribute.Key("gocdk_status")
	errorKey    = attribute.Key("gocdk_error")
)

const (
	startTimeContextKey  = "spanStartTimeCtxKey"
	methodNameContextKey = "methodNameCtxKey"
)

// Tracer provides OpenTelemetry tracing for Go CDK packages.
type Tracer struct {
	pkg            string
	provider       string
	tracer         trace.Tracer
	latencyMeasure metric.Float64Histogram
}

// ProviderName returns the name of the provider associated with the driver value.
// It is intended to be used as the provider argument to NewTracer.
// It actually returns the package path of the driver's type.
func ProviderName(driver any) string {
	// Return the last component of the package path.
	if driver == nil {
		return ""
	}
	t := reflect.TypeOf(driver)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t.PkgPath()
}

// NewTracer creates a new Tracer for a package and provider.
func NewTracer(pkg string, provider string) *Tracer {

	attrs := []attribute.KeyValue{
		packageKey.String(pkg),
		providerKey.String(provider),
	}

	tracer := otel.Tracer(pkg, trace.WithInstrumentationAttributes(attrs...))

	return &Tracer{
		pkg:            pkg,
		provider:       provider,
		tracer:         tracer,
		latencyMeasure: LatencyMeasure(pkg, provider),
	}
}

// Start creates and starts a new span and returns the updated context and span.
func (t *Tracer) Start(ctx context.Context, methodName string) (context.Context, trace.Span) {
	fullName := t.pkg + "." + methodName

	sCtx, span := t.tracer.Start(ctx, fullName, trace.WithAttributes(methodKey.String(methodName)))
	sCtx = context.WithValue(sCtx, startTimeContextKey, time.Now())
	return context.WithValue(sCtx, methodNameContextKey, fullName), span
}

// End completes a span with error information if applicable.
func (t *Tracer) End(ctx context.Context, span trace.Span, err error) {
	startTime := ctx.Value(startTimeContextKey).(time.Time)
	elapsed := time.Since(startTime)

	code := gcerrors.OK

	if err != nil {
		code = gcerrors.Code(err)
		span.SetAttributes(
			errorKey.String(err.Error()),
			statusKey.String(fmt.Sprint(code)),
		)
		span.SetStatus(codes.Error, err.Error())
		span.RecordError(err)
	} else {
		span.SetStatus(codes.Ok, "")
	}

	span.End()

	methodName := ctx.Value(methodNameContextKey).(string)

	t.latencyMeasure.Record(ctx,
		float64(elapsed.Milliseconds()),

		metric.WithAttributes(
			statusKey.String(fmt.Sprint(code)),
			methodKey.String(methodName)),
	)
}
