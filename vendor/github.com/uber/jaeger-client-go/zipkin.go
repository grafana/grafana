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

// ZipkinSpanFormat is an OpenTracing carrier format constant
const ZipkinSpanFormat = "zipkin-span-format"

// ExtractableZipkinSpan is a type of Carrier used for integration with Zipkin-aware
// RPC frameworks (like TChannel). It does not support baggage, only trace IDs.
type ExtractableZipkinSpan interface {
	TraceID() uint64
	SpanID() uint64
	ParentID() uint64
	Flags() byte
}

// InjectableZipkinSpan is a type of Carrier used for integration with Zipkin-aware
// RPC frameworks (like TChannel). It does not support baggage, only trace IDs.
type InjectableZipkinSpan interface {
	SetTraceID(traceID uint64)
	SetSpanID(spanID uint64)
	SetParentID(parentID uint64)
	SetFlags(flags byte)
}

type zipkinPropagator struct {
	tracer *Tracer
}

func (p *zipkinPropagator) Inject(
	ctx SpanContext,
	abstractCarrier interface{},
) error {
	carrier, ok := abstractCarrier.(InjectableZipkinSpan)
	if !ok {
		return opentracing.ErrInvalidCarrier
	}

	carrier.SetTraceID(ctx.TraceID().Low) // TODO this cannot work with 128bit IDs
	carrier.SetSpanID(uint64(ctx.SpanID()))
	carrier.SetParentID(uint64(ctx.ParentID()))
	carrier.SetFlags(ctx.samplingState.flags())
	return nil
}

func (p *zipkinPropagator) Extract(abstractCarrier interface{}) (SpanContext, error) {
	carrier, ok := abstractCarrier.(ExtractableZipkinSpan)
	if !ok {
		return emptyContext, opentracing.ErrInvalidCarrier
	}
	if carrier.TraceID() == 0 {
		return emptyContext, opentracing.ErrSpanContextNotFound
	}
	var ctx SpanContext
	ctx.traceID.Low = carrier.TraceID()
	ctx.spanID = SpanID(carrier.SpanID())
	ctx.parentID = SpanID(carrier.ParentID())
	ctx.samplingState = &samplingState{}
	ctx.samplingState.setFlags(carrier.Flags())
	return ctx, nil
}
