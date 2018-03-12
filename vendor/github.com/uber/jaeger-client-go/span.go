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
	"sync"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"github.com/opentracing/opentracing-go/log"
)

// Span implements opentracing.Span
type Span struct {
	sync.RWMutex

	tracer *Tracer

	context SpanContext

	// The name of the "operation" this span is an instance of.
	// Known as a "span name" in some implementations.
	operationName string

	// firstInProcess, if true, indicates that this span is the root of the (sub)tree
	// of spans in the current process. In other words it's true for the root spans,
	// and the ingress spans when the process joins another trace.
	firstInProcess bool

	// startTime is the timestamp indicating when the span began, with microseconds precision.
	startTime time.Time

	// duration returns duration of the span with microseconds precision.
	// Zero value means duration is unknown.
	duration time.Duration

	// tags attached to this span
	tags []Tag

	// The span's "micro-log"
	logs []opentracing.LogRecord

	// references for this span
	references []Reference

	observer ContribSpanObserver
}

// Tag is a simple key value wrapper.
// TODO deprecate in the next major release, use opentracing.Tag instead.
type Tag struct {
	key   string
	value interface{}
}

// SetOperationName sets or changes the operation name.
func (s *Span) SetOperationName(operationName string) opentracing.Span {
	s.Lock()
	defer s.Unlock()
	if s.context.IsSampled() {
		s.operationName = operationName
	}
	s.observer.OnSetOperationName(operationName)
	return s
}

// SetTag implements SetTag() of opentracing.Span
func (s *Span) SetTag(key string, value interface{}) opentracing.Span {
	s.observer.OnSetTag(key, value)
	if key == string(ext.SamplingPriority) && setSamplingPriority(s, value) {
		return s
	}
	s.Lock()
	defer s.Unlock()
	if s.context.IsSampled() {
		s.setTagNoLocking(key, value)
	}
	return s
}

func (s *Span) setTagNoLocking(key string, value interface{}) {
	s.tags = append(s.tags, Tag{key: key, value: value})
}

// LogFields implements opentracing.Span API
func (s *Span) LogFields(fields ...log.Field) {
	s.Lock()
	defer s.Unlock()
	if !s.context.IsSampled() {
		return
	}
	s.logFieldsNoLocking(fields...)
}

// this function should only be called while holding a Write lock
func (s *Span) logFieldsNoLocking(fields ...log.Field) {
	lr := opentracing.LogRecord{
		Fields:    fields,
		Timestamp: time.Now(),
	}
	s.appendLog(lr)
}

// LogKV implements opentracing.Span API
func (s *Span) LogKV(alternatingKeyValues ...interface{}) {
	s.RLock()
	sampled := s.context.IsSampled()
	s.RUnlock()
	if !sampled {
		return
	}
	fields, err := log.InterleavedKVToFields(alternatingKeyValues...)
	if err != nil {
		s.LogFields(log.Error(err), log.String("function", "LogKV"))
		return
	}
	s.LogFields(fields...)
}

// LogEvent implements opentracing.Span API
func (s *Span) LogEvent(event string) {
	s.Log(opentracing.LogData{Event: event})
}

// LogEventWithPayload implements opentracing.Span API
func (s *Span) LogEventWithPayload(event string, payload interface{}) {
	s.Log(opentracing.LogData{Event: event, Payload: payload})
}

// Log implements opentracing.Span API
func (s *Span) Log(ld opentracing.LogData) {
	s.Lock()
	defer s.Unlock()
	if s.context.IsSampled() {
		if ld.Timestamp.IsZero() {
			ld.Timestamp = s.tracer.timeNow()
		}
		s.appendLog(ld.ToLogRecord())
	}
}

// this function should only be called while holding a Write lock
func (s *Span) appendLog(lr opentracing.LogRecord) {
	// TODO add logic to limit number of logs per span (issue #46)
	s.logs = append(s.logs, lr)
}

// SetBaggageItem implements SetBaggageItem() of opentracing.SpanContext
func (s *Span) SetBaggageItem(key, value string) opentracing.Span {
	s.Lock()
	defer s.Unlock()
	s.tracer.setBaggage(s, key, value)
	return s
}

// BaggageItem implements BaggageItem() of opentracing.SpanContext
func (s *Span) BaggageItem(key string) string {
	s.RLock()
	defer s.RUnlock()
	return s.context.baggage[key]
}

// Finish implements opentracing.Span API
func (s *Span) Finish() {
	s.FinishWithOptions(opentracing.FinishOptions{})
}

// FinishWithOptions implements opentracing.Span API
func (s *Span) FinishWithOptions(options opentracing.FinishOptions) {
	if options.FinishTime.IsZero() {
		options.FinishTime = s.tracer.timeNow()
	}
	s.observer.OnFinish(options)
	s.Lock()
	if s.context.IsSampled() {
		s.duration = options.FinishTime.Sub(s.startTime)
		// Note: bulk logs are not subject to maxLogsPerSpan limit
		if options.LogRecords != nil {
			s.logs = append(s.logs, options.LogRecords...)
		}
		for _, ld := range options.BulkLogData {
			s.logs = append(s.logs, ld.ToLogRecord())
		}
	}
	s.Unlock()
	// call reportSpan even for non-sampled traces, to return span to the pool
	s.tracer.reportSpan(s)
}

// Context implements opentracing.Span API
func (s *Span) Context() opentracing.SpanContext {
	return s.context
}

// Tracer implements opentracing.Span API
func (s *Span) Tracer() opentracing.Tracer {
	return s.tracer
}

func (s *Span) String() string {
	s.RLock()
	defer s.RUnlock()
	return s.context.String()
}

// OperationName allows retrieving current operation name.
func (s *Span) OperationName() string {
	s.RLock()
	defer s.RUnlock()
	return s.operationName
}

func (s *Span) serviceName() string {
	return s.tracer.serviceName
}

func setSamplingPriority(s *Span, value interface{}) bool {
	s.Lock()
	defer s.Unlock()
	if val, ok := value.(uint16); ok {
		if val > 0 {
			s.context.flags = s.context.flags | flagDebug | flagSampled
		} else {
			s.context.flags = s.context.flags & (^flagSampled)
		}
		return true
	}
	return false
}
