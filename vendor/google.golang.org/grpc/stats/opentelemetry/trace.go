/*
 * Copyright 2024 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package opentelemetry

import (
	"sync/atomic"

	"go.opentelemetry.io/otel/attribute"
	otelcodes "go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/stats"
	"google.golang.org/grpc/status"
)

// populateSpan populates span information based on stats passed in, representing
// invariants of the RPC lifecycle. It ends the span, triggering its export.
// This function handles attempt spans on the client-side and call spans on the
// server-side.
func populateSpan(rs stats.RPCStats, ai *attemptInfo) {
	if ai == nil || ai.traceSpan == nil {
		// Shouldn't happen, tagRPC call comes before this function gets called
		// which populates this information.
		logger.Error("ctx passed into stats handler tracing event handling has no traceSpan present")
		return
	}
	span := ai.traceSpan

	switch rs := rs.(type) {
	case *stats.Begin:
		// Note: Go always added Client and FailFast attributes even though they are not
		// defined by the OpenCensus gRPC spec. Thus, they are unimportant for
		// correctness.
		span.SetAttributes(
			attribute.Bool("Client", rs.Client),
			attribute.Bool("FailFast", rs.FailFast),
			attribute.Int64("previous-rpc-attempts", int64(ai.previousRPCAttempts)),
			attribute.Bool("transparent-retry", rs.IsTransparentRetryAttempt),
		)
		// increment previous rpc attempts applicable for next attempt
		atomic.AddUint32(&ai.previousRPCAttempts, 1)
	case *stats.DelayedPickComplete:
		span.AddEvent("Delayed LB pick complete")
	case *stats.InPayload:
		// message id - "must be calculated as two different counters starting
		// from one for sent messages and one for received messages."
		attrs := []attribute.KeyValue{
			attribute.Int64("sequence-number", int64(ai.countRecvMsg)),
			attribute.Int64("message-size", int64(rs.Length)),
		}
		if rs.CompressedLength != rs.Length {
			attrs = append(attrs, attribute.Int64("message-size-compressed", int64(rs.CompressedLength)))
		}
		span.AddEvent("Inbound message", trace.WithAttributes(attrs...))
		ai.countRecvMsg++
	case *stats.OutPayload:
		attrs := []attribute.KeyValue{
			attribute.Int64("sequence-number", int64(ai.countSentMsg)),
			attribute.Int64("message-size", int64(rs.Length)),
		}
		if rs.CompressedLength != rs.Length {
			attrs = append(attrs, attribute.Int64("message-size-compressed", int64(rs.CompressedLength)))
		}
		span.AddEvent("Outbound message", trace.WithAttributes(attrs...))
		ai.countSentMsg++
	case *stats.End:
		if rs.Error != nil {
			s := status.Convert(rs.Error)
			span.SetStatus(otelcodes.Error, s.Message())
		} else {
			span.SetStatus(otelcodes.Ok, "Ok")
		}
		span.End()
	}
}
