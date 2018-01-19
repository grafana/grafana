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

package common

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/uber/jaeger-client-go/crossdock/thrift/tracetest"
	"github.com/uber/jaeger-client-go/utils"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"golang.org/x/net/context"
)

// PostJSON sends a POST request to `url` with body containing JSON-serialized `req`.
// It injects tracing span into the headers (if found in the context).
// It returns parsed TraceResponse, or error.
func PostJSON(ctx context.Context, url string, req interface{}) (*tracetest.TraceResponse, error) {
	data, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	span, err := injectSpan(ctx, httpReq)
	if span != nil {
		defer span.Finish()
	}
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, err
	}

	var result tracetest.TraceResponse
	err = utils.ReadJSON(resp, &result)
	return &result, err
}

func injectSpan(ctx context.Context, req *http.Request) (opentracing.Span, error) {
	span := opentracing.SpanFromContext(ctx)
	if span == nil {
		return nil, nil
	}
	span = span.Tracer().StartSpan("post", opentracing.ChildOf(span.Context()))
	ext.SpanKindRPCClient.Set(span)
	c := opentracing.HTTPHeadersCarrier(req.Header)
	err := span.Tracer().Inject(span.Context(), opentracing.HTTPHeaders, c)
	return span, err
}
