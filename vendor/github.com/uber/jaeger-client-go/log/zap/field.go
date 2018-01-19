// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package zap

import (
	"context"
	"fmt"

	jaeger "github.com/uber/jaeger-client-go"

	opentracing "github.com/opentracing/opentracing-go"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Trace creates a field that extracts tracing information from a context and
// includes it under the "trace" key.
//
// Because the opentracing APIs don't expose this information, the returned
// zap.Field is a no-op for contexts that don't contain a span or contain a
// non-Jaeger span.
func Trace(ctx context.Context) zapcore.Field {
	if ctx == nil {
		return zap.Skip()
	}
	return zap.Object("trace", trace{ctx})
}

type trace struct {
	ctx context.Context
}

func (t trace) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	span := opentracing.SpanFromContext(t.ctx)
	if span == nil {
		return nil
	}
	j, ok := span.Context().(jaeger.SpanContext)
	if !ok {
		return nil
	}
	if !j.IsValid() {
		return fmt.Errorf("invalid span: %v", j.SpanID())
	}
	enc.AddString("span", j.SpanID().String())
	enc.AddString("trace", j.TraceID().String())
	return nil
}
