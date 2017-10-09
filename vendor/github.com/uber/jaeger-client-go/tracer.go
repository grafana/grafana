// Copyright (c) 2016 Uber Technologies, Inc.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

package jaeger

import (
	"fmt"
	"io"
	"os"
	"reflect"
	"sync"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"

	"github.com/uber/jaeger-client-go/internal/baggage"
	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/utils"
)

// Tracer implements opentracing.Tracer.
type Tracer struct {
	serviceName string
	hostIPv4    uint32 // this is for zipkin endpoint conversion

	sampler  Sampler
	reporter Reporter
	metrics  Metrics
	logger   log.Logger

	timeNow      func() time.Time
	randomNumber func() uint64

	options struct {
		poolSpans           bool
		gen128Bit           bool // whether to generate 128bit trace IDs
		zipkinSharedRPCSpan bool
		// more options to come
	}
	// pool for Span objects
	spanPool sync.Pool

	injectors  map[interface{}]Injector
	extractors map[interface{}]Extractor

	observer compositeObserver

	tags []Tag

	baggageRestrictionManager baggage.RestrictionManager
	baggageSetter             *baggageSetter
}

// NewTracer creates Tracer implementation that reports tracing to Jaeger.
// The returned io.Closer can be used in shutdown hooks to ensure that the internal
// queue of the Reporter is drained and all buffered spans are submitted to collectors.
func NewTracer(
	serviceName string,
	sampler Sampler,
	reporter Reporter,
	options ...TracerOption,
) (opentracing.Tracer, io.Closer) {
	t := &Tracer{
		serviceName: serviceName,
		sampler:     sampler,
		reporter:    reporter,
		injectors:   make(map[interface{}]Injector),
		extractors:  make(map[interface{}]Extractor),
		metrics:     *NewNullMetrics(),
		spanPool: sync.Pool{New: func() interface{} {
			return &Span{}
		}},
	}

	for _, option := range options {
		option(t)
	}

	// register default injectors/extractors unless they are already provided via options
	textPropagator := newTextMapPropagator(getDefaultHeadersConfig(), t.metrics)
	t.addCodec(opentracing.TextMap, textPropagator, textPropagator)

	httpHeaderPropagator := newHTTPHeaderPropagator(getDefaultHeadersConfig(), t.metrics)
	t.addCodec(opentracing.HTTPHeaders, httpHeaderPropagator, httpHeaderPropagator)

	binaryPropagator := newBinaryPropagator(t)
	t.addCodec(opentracing.Binary, binaryPropagator, binaryPropagator)

	// TODO remove after TChannel supports OpenTracing
	interopPropagator := &jaegerTraceContextPropagator{tracer: t}
	t.addCodec(SpanContextFormat, interopPropagator, interopPropagator)

	zipkinPropagator := &zipkinPropagator{tracer: t}
	t.addCodec(ZipkinSpanFormat, zipkinPropagator, zipkinPropagator)

	if t.baggageRestrictionManager != nil {
		t.baggageSetter = newBaggageSetter(t.baggageRestrictionManager, &t.metrics)
	} else {
		t.baggageSetter = newBaggageSetter(baggage.NewDefaultRestrictionManager(0), &t.metrics)
	}
	if t.randomNumber == nil {
		rng := utils.NewRand(time.Now().UnixNano())
		t.randomNumber = func() uint64 {
			return uint64(rng.Int63())
		}
	}
	if t.timeNow == nil {
		t.timeNow = time.Now
	}
	if t.logger == nil {
		t.logger = log.NullLogger
	}
	// Set tracer-level tags
	t.tags = append(t.tags, Tag{key: JaegerClientVersionTagKey, value: JaegerClientVersion})
	if hostname, err := os.Hostname(); err == nil {
		t.tags = append(t.tags, Tag{key: TracerHostnameTagKey, value: hostname})
	}
	if ip, err := utils.HostIP(); err == nil {
		t.tags = append(t.tags, Tag{key: TracerIPTagKey, value: ip.String()})
		t.hostIPv4 = utils.PackIPAsUint32(ip)
	} else {
		t.logger.Error("Unable to determine this host's IP address: " + err.Error())
	}

	return t, t
}

// addCodec adds registers injector and extractor for given propagation format if not already defined.
func (t *Tracer) addCodec(format interface{}, injector Injector, extractor Extractor) {
	if _, ok := t.injectors[format]; !ok {
		t.injectors[format] = injector
	}
	if _, ok := t.extractors[format]; !ok {
		t.extractors[format] = extractor
	}
}

// StartSpan implements StartSpan() method of opentracing.Tracer.
func (t *Tracer) StartSpan(
	operationName string,
	options ...opentracing.StartSpanOption,
) opentracing.Span {
	sso := opentracing.StartSpanOptions{}
	for _, o := range options {
		o.Apply(&sso)
	}
	return t.startSpanWithOptions(operationName, sso)
}

func (t *Tracer) startSpanWithOptions(
	operationName string,
	options opentracing.StartSpanOptions,
) opentracing.Span {
	if options.StartTime.IsZero() {
		options.StartTime = t.timeNow()
	}

	var references []Reference
	var parent SpanContext
	var hasParent bool // need this because `parent` is a value, not reference
	for _, ref := range options.References {
		ctx, ok := ref.ReferencedContext.(SpanContext)
		if !ok {
			t.logger.Error(fmt.Sprintf(
				"Reference contains invalid type of SpanReference: %s",
				reflect.ValueOf(ref.ReferencedContext)))
			continue
		}
		if !(ctx.IsValid() || ctx.isDebugIDContainerOnly() || len(ctx.baggage) != 0) {
			continue
		}
		references = append(references, Reference{Type: ref.Type, Context: ctx})
		if !hasParent {
			parent = ctx
			hasParent = ref.Type == opentracing.ChildOfRef
		}
	}
	if !hasParent && parent.IsValid() {
		// If ChildOfRef wasn't found but a FollowFromRef exists, use the context from
		// the FollowFromRef as the parent
		hasParent = true
	}

	rpcServer := false
	if v, ok := options.Tags[ext.SpanKindRPCServer.Key]; ok {
		rpcServer = (v == ext.SpanKindRPCServerEnum || v == string(ext.SpanKindRPCServerEnum))
	}

	var samplerTags []Tag
	var ctx SpanContext
	newTrace := false
	if !hasParent || !parent.IsValid() {
		newTrace = true
		ctx.traceID.Low = t.randomID()
		if t.options.gen128Bit {
			ctx.traceID.High = t.randomID()
		}
		ctx.spanID = SpanID(ctx.traceID.Low)
		ctx.parentID = 0
		ctx.flags = byte(0)
		if hasParent && parent.isDebugIDContainerOnly() {
			ctx.flags |= (flagSampled | flagDebug)
			samplerTags = []Tag{{key: JaegerDebugHeader, value: parent.debugID}}
		} else if sampled, tags := t.sampler.IsSampled(ctx.traceID, operationName); sampled {
			ctx.flags |= flagSampled
			samplerTags = tags
		}
	} else {
		ctx.traceID = parent.traceID
		if rpcServer && t.options.zipkinSharedRPCSpan {
			// Support Zipkin's one-span-per-RPC model
			ctx.spanID = parent.spanID
			ctx.parentID = parent.parentID
		} else {
			ctx.spanID = SpanID(t.randomID())
			ctx.parentID = parent.spanID
		}
		ctx.flags = parent.flags
	}
	if hasParent {
		// copy baggage items
		if l := len(parent.baggage); l > 0 {
			ctx.baggage = make(map[string]string, len(parent.baggage))
			for k, v := range parent.baggage {
				ctx.baggage[k] = v
			}
		}
	}

	sp := t.newSpan()
	sp.context = ctx
	sp.observer = t.observer.OnStartSpan(sp, operationName, options)
	return t.startSpanInternal(
		sp,
		operationName,
		options.StartTime,
		samplerTags,
		options.Tags,
		newTrace,
		rpcServer,
		references,
	)
}

// Inject implements Inject() method of opentracing.Tracer
func (t *Tracer) Inject(ctx opentracing.SpanContext, format interface{}, carrier interface{}) error {
	c, ok := ctx.(SpanContext)
	if !ok {
		return opentracing.ErrInvalidSpanContext
	}
	if injector, ok := t.injectors[format]; ok {
		return injector.Inject(c, carrier)
	}
	return opentracing.ErrUnsupportedFormat
}

// Extract implements Extract() method of opentracing.Tracer
func (t *Tracer) Extract(
	format interface{},
	carrier interface{},
) (opentracing.SpanContext, error) {
	if extractor, ok := t.extractors[format]; ok {
		return extractor.Extract(carrier)
	}
	return nil, opentracing.ErrUnsupportedFormat
}

// Close releases all resources used by the Tracer and flushes any remaining buffered spans.
func (t *Tracer) Close() error {
	t.reporter.Close()
	t.sampler.Close()
	if mgr, ok := t.baggageRestrictionManager.(io.Closer); ok {
		mgr.Close()
	}
	return nil
}

// Tags returns a slice of tracer-level tags.
func (t *Tracer) Tags() []opentracing.Tag {
	tags := make([]opentracing.Tag, len(t.tags))
	for i, tag := range t.tags {
		tags[i] = opentracing.Tag{Key: tag.key, Value: tag.value}
	}
	return tags
}

// newSpan returns an instance of a clean Span object.
// If options.PoolSpans is true, the spans are retrieved from an object pool.
func (t *Tracer) newSpan() *Span {
	if !t.options.poolSpans {
		return &Span{}
	}
	sp := t.spanPool.Get().(*Span)
	sp.context = emptyContext
	sp.tracer = nil
	sp.tags = nil
	sp.logs = nil
	return sp
}

func (t *Tracer) startSpanInternal(
	sp *Span,
	operationName string,
	startTime time.Time,
	internalTags []Tag,
	tags opentracing.Tags,
	newTrace bool,
	rpcServer bool,
	references []Reference,
) *Span {
	sp.tracer = t
	sp.operationName = operationName
	sp.startTime = startTime
	sp.duration = 0
	sp.references = references
	sp.firstInProcess = rpcServer || sp.context.parentID == 0
	if len(tags) > 0 || len(internalTags) > 0 {
		sp.tags = make([]Tag, len(internalTags), len(tags)+len(internalTags))
		copy(sp.tags, internalTags)
		for k, v := range tags {
			sp.observer.OnSetTag(k, v)
			if k == string(ext.SamplingPriority) && setSamplingPriority(sp, v) {
				continue
			}
			sp.setTagNoLocking(k, v)
		}
	}
	// emit metrics
	t.metrics.SpansStarted.Inc(1)
	if sp.context.IsSampled() {
		t.metrics.SpansSampled.Inc(1)
		if newTrace {
			// We cannot simply check for parentID==0 because in Zipkin model the
			// server-side RPC span has the exact same trace/span/parent IDs as the
			// calling client-side span, but obviously the server side span is
			// no longer a root span of the trace.
			t.metrics.TracesStartedSampled.Inc(1)
		} else if sp.firstInProcess {
			t.metrics.TracesJoinedSampled.Inc(1)
		}
	} else {
		t.metrics.SpansNotSampled.Inc(1)
		if newTrace {
			t.metrics.TracesStartedNotSampled.Inc(1)
		} else if sp.firstInProcess {
			t.metrics.TracesJoinedNotSampled.Inc(1)
		}
	}
	return sp
}

func (t *Tracer) reportSpan(sp *Span) {
	t.metrics.SpansFinished.Inc(1)
	if sp.context.IsSampled() {
		t.reporter.Report(sp)
	}
	if t.options.poolSpans {
		t.spanPool.Put(sp)
	}
}

// randomID generates a random trace/span ID, using tracer.random() generator.
// It never returns 0.
func (t *Tracer) randomID() uint64 {
	val := t.randomNumber()
	for val == 0 {
		val = t.randomNumber()
	}
	return val
}

// (NB) span should hold the lock before making this call
func (t *Tracer) setBaggage(sp *Span, key, value string) {
	t.baggageSetter.setBaggage(sp, key, value)
}
