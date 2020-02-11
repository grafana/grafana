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

package jaeger

import (
	"github.com/opentracing/opentracing-go"
)

// TODO this file should not be needed after TChannel PR.

type formatKey int

// SpanContextFormat is a constant used as OpenTracing Format.
// Requires *SpanContext as carrier.
// This format is intended for interop with TChannel or other Zipkin-like tracers.
const SpanContextFormat formatKey = iota

type jaegerTraceContextPropagator struct {
	tracer *Tracer
}

func (p *jaegerTraceContextPropagator) Inject(
	ctx SpanContext,
	abstractCarrier interface{},
) error {
	carrier, ok := abstractCarrier.(*SpanContext)
	if !ok {
		return opentracing.ErrInvalidCarrier
	}

	carrier.CopyFrom(&ctx)
	return nil
}

func (p *jaegerTraceContextPropagator) Extract(abstractCarrier interface{}) (SpanContext, error) {
	carrier, ok := abstractCarrier.(*SpanContext)
	if !ok {
		return emptyContext, opentracing.ErrInvalidCarrier
	}
	ctx := new(SpanContext)
	ctx.CopyFrom(carrier)
	return *ctx, nil
}
