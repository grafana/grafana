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
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"go.uber.org/atomic"
)

const (
	flagSampled  = 1
	flagDebug    = 2
	flagFirehose = 8
)

var (
	errEmptyTracerStateString     = errors.New("Cannot convert empty string to tracer state")
	errMalformedTracerStateString = errors.New("String does not match tracer state format")

	emptyContext = SpanContext{}
)

// TraceID represents unique 128bit identifier of a trace
type TraceID struct {
	High, Low uint64
}

// SpanID represents unique 64bit identifier of a span
type SpanID uint64

// SpanContext represents propagated span identity and state
type SpanContext struct {
	// traceID represents globally unique ID of the trace.
	// Usually generated as a random number.
	traceID TraceID

	// spanID represents span ID that must be unique within its trace,
	// but does not have to be globally unique.
	spanID SpanID

	// parentID refers to the ID of the parent span.
	// Should be 0 if the current span is a root span.
	parentID SpanID

	// Distributed Context baggage. The is a snapshot in time.
	baggage map[string]string

	// debugID can be set to some correlation ID when the context is being
	// extracted from a TextMap carrier.
	//
	// See JaegerDebugHeader in constants.go
	debugID string

	// samplingState is shared across all spans
	samplingState *samplingState

	// remote indicates that span context represents a remote parent
	remote bool
}

type samplingState struct {
	// Span context's state flags that are propagated across processes. Only lower 8 bits are used.
	// We use an int32 instead of byte to be able to use CAS operations.
	stateFlags atomic.Int32

	// When state is not final, sampling will be retried on other span write operations,
	// like SetOperationName / SetTag, and the spans will remain writable.
	final atomic.Bool

	// localRootSpan stores the SpanID of the first span created in this process for a given trace.
	localRootSpan SpanID

	// extendedState allows samplers to keep intermediate state.
	// The keys and values in this map are completely opaque: interface{} -> interface{}.
	extendedState sync.Map
}

func (s *samplingState) isLocalRootSpan(id SpanID) bool {
	return id == s.localRootSpan
}

func (s *samplingState) setFlag(newFlag int32) {
	swapped := false
	for !swapped {
		old := s.stateFlags.Load()
		swapped = s.stateFlags.CAS(old, old|newFlag)
	}
}

func (s *samplingState) unsetFlag(newFlag int32) {
	swapped := false
	for !swapped {
		old := s.stateFlags.Load()
		swapped = s.stateFlags.CAS(old, old&^newFlag)
	}
}

func (s *samplingState) setSampled() {
	s.setFlag(flagSampled)
}

func (s *samplingState) unsetSampled() {
	s.unsetFlag(flagSampled)
}

func (s *samplingState) setDebugAndSampled() {
	s.setFlag(flagDebug | flagSampled)
}

func (s *samplingState) setFirehose() {
	s.setFlag(flagFirehose)
}

func (s *samplingState) setFlags(flags byte) {
	s.stateFlags.Store(int32(flags))
}

func (s *samplingState) setFinal() {
	s.final.Store(true)
}

func (s *samplingState) flags() byte {
	return byte(s.stateFlags.Load())
}

func (s *samplingState) isSampled() bool {
	return s.stateFlags.Load()&flagSampled == flagSampled
}

func (s *samplingState) isDebug() bool {
	return s.stateFlags.Load()&flagDebug == flagDebug
}

func (s *samplingState) isFirehose() bool {
	return s.stateFlags.Load()&flagFirehose == flagFirehose
}

func (s *samplingState) isFinal() bool {
	return s.final.Load()
}

func (s *samplingState) extendedStateForKey(key interface{}, initValue func() interface{}) interface{} {
	if value, ok := s.extendedState.Load(key); ok {
		return value
	}
	value := initValue()
	value, _ = s.extendedState.LoadOrStore(key, value)
	return value
}

// ForeachBaggageItem implements ForeachBaggageItem() of opentracing.SpanContext
func (c SpanContext) ForeachBaggageItem(handler func(k, v string) bool) {
	for k, v := range c.baggage {
		if !handler(k, v) {
			break
		}
	}
}

// IsSampled returns whether this trace was chosen for permanent storage
// by the sampling mechanism of the tracer.
func (c SpanContext) IsSampled() bool {
	return c.samplingState.isSampled()
}

// IsDebug indicates whether sampling was explicitly requested by the service.
func (c SpanContext) IsDebug() bool {
	return c.samplingState.isDebug()
}

// IsSamplingFinalized indicates whether the sampling decision has been finalized.
func (c SpanContext) IsSamplingFinalized() bool {
	return c.samplingState.isFinal()
}

// IsFirehose indicates whether the firehose flag was set
func (c SpanContext) IsFirehose() bool {
	return c.samplingState.isFirehose()
}

// ExtendedSamplingState returns the custom state object for a given key. If the value for this key does not exist,
// it is initialized via initValue function. This state can be used by samplers (e.g. x.PrioritySampler).
func (c SpanContext) ExtendedSamplingState(key interface{}, initValue func() interface{}) interface{} {
	return c.samplingState.extendedStateForKey(key, initValue)
}

// IsValid indicates whether this context actually represents a valid trace.
func (c SpanContext) IsValid() bool {
	return c.traceID.IsValid() && c.spanID != 0
}

// SetFirehose enables firehose mode for this trace.
func (c SpanContext) SetFirehose() {
	c.samplingState.setFirehose()
}

func (c SpanContext) String() string {
	var flags int32
	if c.samplingState != nil {
		flags = c.samplingState.stateFlags.Load()
	}
	if c.traceID.High == 0 {
		return fmt.Sprintf("%016x:%016x:%016x:%x", c.traceID.Low, uint64(c.spanID), uint64(c.parentID), flags)
	}
	return fmt.Sprintf("%016x%016x:%016x:%016x:%x", c.traceID.High, c.traceID.Low, uint64(c.spanID), uint64(c.parentID), flags)
}

// ContextFromString reconstructs the Context encoded in a string
func ContextFromString(value string) (SpanContext, error) {
	var context SpanContext
	if value == "" {
		return emptyContext, errEmptyTracerStateString
	}
	parts := strings.Split(value, ":")
	if len(parts) != 4 {
		return emptyContext, errMalformedTracerStateString
	}
	var err error
	if context.traceID, err = TraceIDFromString(parts[0]); err != nil {
		return emptyContext, err
	}
	if context.spanID, err = SpanIDFromString(parts[1]); err != nil {
		return emptyContext, err
	}
	if context.parentID, err = SpanIDFromString(parts[2]); err != nil {
		return emptyContext, err
	}
	flags, err := strconv.ParseUint(parts[3], 10, 8)
	if err != nil {
		return emptyContext, err
	}
	context.samplingState = &samplingState{}
	context.samplingState.setFlags(byte(flags))
	return context, nil
}

// TraceID returns the trace ID of this span context
func (c SpanContext) TraceID() TraceID {
	return c.traceID
}

// SpanID returns the span ID of this span context
func (c SpanContext) SpanID() SpanID {
	return c.spanID
}

// ParentID returns the parent span ID of this span context
func (c SpanContext) ParentID() SpanID {
	return c.parentID
}

// Flags returns the bitmap containing such bits as 'sampled' and 'debug'.
func (c SpanContext) Flags() byte {
	return c.samplingState.flags()
}

// Span can be written to if it is sampled or the sampling decision has not been finalized.
func (c SpanContext) isWriteable() bool {
	state := c.samplingState
	return !state.isFinal() || state.isSampled()
}

func (c SpanContext) isSamplingFinalized() bool {
	return c.samplingState.isFinal()
}

// NewSpanContext creates a new instance of SpanContext
func NewSpanContext(traceID TraceID, spanID, parentID SpanID, sampled bool, baggage map[string]string) SpanContext {
	samplingState := &samplingState{}
	if sampled {
		samplingState.setSampled()
	}

	return SpanContext{
		traceID:       traceID,
		spanID:        spanID,
		parentID:      parentID,
		samplingState: samplingState,
		baggage:       baggage}
}

// CopyFrom copies data from ctx into this context, including span identity and baggage.
// TODO This is only used by interop.go. Remove once TChannel Go supports OpenTracing.
func (c *SpanContext) CopyFrom(ctx *SpanContext) {
	c.traceID = ctx.traceID
	c.spanID = ctx.spanID
	c.parentID = ctx.parentID
	c.samplingState = ctx.samplingState
	if l := len(ctx.baggage); l > 0 {
		c.baggage = make(map[string]string, l)
		for k, v := range ctx.baggage {
			c.baggage[k] = v
		}
	} else {
		c.baggage = nil
	}
}

// WithBaggageItem creates a new context with an extra baggage item.
// Delete a baggage item if provided blank value.
//
// The SpanContext is designed to be immutable and passed by value. As such,
// it cannot contain any locks, and should only hold immutable data, including baggage.
// Another reason for why baggage is immutable is when the span context is passed
// as a parent when starting a new span. The new span's baggage cannot affect the parent
// span's baggage, so the child span either needs to take a copy of the parent baggage
// (which is expensive and unnecessary since baggage rarely changes in the life span of
// a trace), or it needs to do a copy-on-write, which is the approach taken here.
func (c SpanContext) WithBaggageItem(key, value string) SpanContext {
	var newBaggage map[string]string
	// unset baggage item
	if value == "" {
		if _, ok := c.baggage[key]; !ok {
			return c
		}
		newBaggage = make(map[string]string, len(c.baggage))
		for k, v := range c.baggage {
			newBaggage[k] = v
		}
		delete(newBaggage, key)
		return SpanContext{c.traceID, c.spanID, c.parentID, newBaggage, "", c.samplingState, c.remote}
	}
	if c.baggage == nil {
		newBaggage = map[string]string{key: value}
	} else {
		newBaggage = make(map[string]string, len(c.baggage)+1)
		for k, v := range c.baggage {
			newBaggage[k] = v
		}
		newBaggage[key] = value
	}
	// Use positional parameters so the compiler will help catch new fields.
	return SpanContext{c.traceID, c.spanID, c.parentID, newBaggage, "", c.samplingState, c.remote}
}

// isDebugIDContainerOnly returns true when the instance of the context is only
// used to return the debug/correlation ID from extract() method. This happens
// in the situation when "jaeger-debug-id" header is passed in the carrier to
// the extract() method, but the request otherwise has no span context in it.
// Previously this would've returned opentracing.ErrSpanContextNotFound from the
// extract method, but now it returns a dummy context with only debugID filled in.
//
// See JaegerDebugHeader in constants.go
// See TextMapPropagator#Extract
func (c *SpanContext) isDebugIDContainerOnly() bool {
	return !c.traceID.IsValid() && c.debugID != ""
}

// ------- TraceID -------

func (t TraceID) String() string {
	if t.High == 0 {
		return fmt.Sprintf("%016x", t.Low)
	}
	return fmt.Sprintf("%016x%016x", t.High, t.Low)
}

// TraceIDFromString creates a TraceID from a hexadecimal string
func TraceIDFromString(s string) (TraceID, error) {
	var hi, lo uint64
	var err error
	if len(s) > 32 {
		return TraceID{}, fmt.Errorf("TraceID cannot be longer than 32 hex characters: %s", s)
	} else if len(s) > 16 {
		hiLen := len(s) - 16
		if hi, err = strconv.ParseUint(s[0:hiLen], 16, 64); err != nil {
			return TraceID{}, err
		}
		if lo, err = strconv.ParseUint(s[hiLen:], 16, 64); err != nil {
			return TraceID{}, err
		}
	} else {
		if lo, err = strconv.ParseUint(s, 16, 64); err != nil {
			return TraceID{}, err
		}
	}
	return TraceID{High: hi, Low: lo}, nil
}

// IsValid checks if the trace ID is valid, i.e. not zero.
func (t TraceID) IsValid() bool {
	return t.High != 0 || t.Low != 0
}

// ------- SpanID -------

func (s SpanID) String() string {
	return fmt.Sprintf("%016x", uint64(s))
}

// SpanIDFromString creates a SpanID from a hexadecimal string
func SpanIDFromString(s string) (SpanID, error) {
	if len(s) > 16 {
		return SpanID(0), fmt.Errorf("SpanID cannot be longer than 16 hex characters: %s", s)
	}
	id, err := strconv.ParseUint(s, 16, 64)
	if err != nil {
		return SpanID(0), err
	}
	return SpanID(id), nil
}
