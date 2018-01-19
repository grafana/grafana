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

package server

import (
	"fmt"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"golang.org/x/net/context"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/crossdock/common"
	"github.com/uber/jaeger-client-go/crossdock/log"
	"github.com/uber/jaeger-client-go/crossdock/thrift/tracetest"
)

func (s *Server) doStartTrace(req *tracetest.StartTraceRequest) (*tracetest.TraceResponse, error) {
	span := s.Tracer.StartSpan(req.ServerRole)
	if req.Sampled {
		ext.SamplingPriority.Set(span, 1)
	}
	span.SetBaggageItem(BaggageKey, req.Baggage)
	defer span.Finish()

	ctx := opentracing.ContextWithSpan(context.Background(), span)

	return s.prepareResponse(ctx, req.ServerRole, req.Downstream)
}

func (s *Server) doJoinTrace(ctx context.Context, req *tracetest.JoinTraceRequest) (*tracetest.TraceResponse, error) {
	return s.prepareResponse(ctx, req.ServerRole, req.Downstream)
}

func (s *Server) prepareResponse(ctx context.Context, role string, reqDwn *tracetest.Downstream) (*tracetest.TraceResponse, error) {
	observedSpan, err := observeSpan(ctx, s.Tracer)
	if err != nil {
		return nil, err
	}

	resp := tracetest.NewTraceResponse()
	resp.Span = observedSpan

	if reqDwn != nil {
		downstreamResp, err := s.callDownstream(ctx, role, reqDwn)
		if err != nil {
			return nil, err
		}
		resp.Downstream = downstreamResp
	}

	return resp, nil
}

func (s *Server) callDownstream(ctx context.Context, role string, downstream *tracetest.Downstream) (*tracetest.TraceResponse, error) {
	switch downstream.Transport {
	case tracetest.Transport_HTTP:
		return s.callDownstreamHTTP(ctx, downstream)
	case tracetest.Transport_TCHANNEL:
		return s.callDownstreamTChannel(ctx, downstream)
	case tracetest.Transport_DUMMY:
		return &tracetest.TraceResponse{NotImplementedError: "DUMMY transport not implemented"}, nil
	default:
		return nil, errUnrecognizedProtocol
	}
}

func (s *Server) callDownstreamHTTP(ctx context.Context, target *tracetest.Downstream) (*tracetest.TraceResponse, error) {
	req := &tracetest.JoinTraceRequest{
		ServerRole: target.ServerRole,
		Downstream: target.Downstream,
	}
	url := fmt.Sprintf("http://%s:%s/join_trace", target.Host, target.Port)
	log.Printf("Calling downstream service '%s' at %s", target.ServiceName, url)
	return common.PostJSON(ctx, url, req)
}

func observeSpan(ctx context.Context, tracer opentracing.Tracer) (*tracetest.ObservedSpan, error) {
	span := opentracing.SpanFromContext(ctx)
	if span == nil {
		return nil, errNoSpanObserved
	}
	sc := span.Context().(jaeger.SpanContext)
	observedSpan := tracetest.NewObservedSpan()
	observedSpan.TraceId = sc.TraceID().String()
	observedSpan.Sampled = sc.IsSampled()
	observedSpan.Baggage = span.BaggageItem(BaggageKey)
	return observedSpan, nil
}
