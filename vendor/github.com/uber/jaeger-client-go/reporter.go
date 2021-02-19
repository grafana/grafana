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
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/opentracing/opentracing-go"

	"github.com/uber/jaeger-client-go/log"
)

// Reporter is called by the tracer when a span is completed to report the span to the tracing collector.
type Reporter interface {
	// Report submits a new span to collectors, possibly asynchronously and/or with buffering.
	// If the reporter is processing Span asynchronously then it needs to Retain() the span,
	// and then Release() it when no longer needed, to avoid span data corruption.
	Report(span *Span)

	// Close does a clean shutdown of the reporter, flushing any traces that may be buffered in memory.
	Close()
}

// ------------------------------

type nullReporter struct{}

// NewNullReporter creates a no-op reporter that ignores all reported spans.
func NewNullReporter() Reporter {
	return &nullReporter{}
}

// Report implements Report() method of Reporter by doing nothing.
func (r *nullReporter) Report(span *Span) {
	// no-op
}

// Close implements Close() method of Reporter by doing nothing.
func (r *nullReporter) Close() {
	// no-op
}

// ------------------------------

type loggingReporter struct {
	logger Logger
}

// NewLoggingReporter creates a reporter that logs all reported spans to provided logger.
func NewLoggingReporter(logger Logger) Reporter {
	return &loggingReporter{logger}
}

// Report implements Report() method of Reporter by logging the span to the logger.
func (r *loggingReporter) Report(span *Span) {
	r.logger.Infof("Reporting span %+v", span)
}

// Close implements Close() method of Reporter by doing nothing.
func (r *loggingReporter) Close() {
	// no-op
}

// ------------------------------

// InMemoryReporter is used for testing, and simply collects spans in memory.
type InMemoryReporter struct {
	spans []opentracing.Span
	lock  sync.Mutex
}

// NewInMemoryReporter creates a reporter that stores spans in memory.
// NOTE: the Tracer should be created with options.PoolSpans = false.
func NewInMemoryReporter() *InMemoryReporter {
	return &InMemoryReporter{
		spans: make([]opentracing.Span, 0, 10),
	}
}

// Report implements Report() method of Reporter by storing the span in the buffer.
func (r *InMemoryReporter) Report(span *Span) {
	r.lock.Lock()
	// Need to retain the span otherwise it will be released
	r.spans = append(r.spans, span.Retain())
	r.lock.Unlock()
}

// Close implements Close() method of Reporter
func (r *InMemoryReporter) Close() {
	r.Reset()
}

// SpansSubmitted returns the number of spans accumulated in the buffer.
func (r *InMemoryReporter) SpansSubmitted() int {
	r.lock.Lock()
	defer r.lock.Unlock()
	return len(r.spans)
}

// GetSpans returns accumulated spans as a copy of the buffer.
func (r *InMemoryReporter) GetSpans() []opentracing.Span {
	r.lock.Lock()
	defer r.lock.Unlock()
	copied := make([]opentracing.Span, len(r.spans))
	copy(copied, r.spans)
	return copied
}

// Reset clears all accumulated spans.
func (r *InMemoryReporter) Reset() {
	r.lock.Lock()
	defer r.lock.Unlock()

	// Before reset the collection need to release Span memory
	for _, span := range r.spans {
		span.(*Span).Release()
	}
	r.spans = r.spans[:0]
}

// ------------------------------

type compositeReporter struct {
	reporters []Reporter
}

// NewCompositeReporter creates a reporter that ignores all reported spans.
func NewCompositeReporter(reporters ...Reporter) Reporter {
	return &compositeReporter{reporters: reporters}
}

// Report implements Report() method of Reporter by delegating to each underlying reporter.
func (r *compositeReporter) Report(span *Span) {
	for _, reporter := range r.reporters {
		reporter.Report(span)
	}
}

// Close implements Close() method of Reporter by closing each underlying reporter.
func (r *compositeReporter) Close() {
	for _, reporter := range r.reporters {
		reporter.Close()
	}
}

// ------------- REMOTE REPORTER -----------------

type reporterQueueItemType int

const (
	defaultQueueSize           = 100
	defaultBufferFlushInterval = 1 * time.Second

	reporterQueueItemSpan reporterQueueItemType = iota
	reporterQueueItemClose
)

type reporterQueueItem struct {
	itemType reporterQueueItemType
	span     *Span
	close    *sync.WaitGroup
}

type remoteReporter struct {
	// These fields must be first in the struct because `sync/atomic` expects 64-bit alignment.
	// Cf. https://github.com/uber/jaeger-client-go/issues/155, https://goo.gl/zW7dgq
	queueLength int64
	closed      int64 // 0 - not closed, 1 - closed

	reporterOptions

	sender Transport
	queue  chan reporterQueueItem
}

// NewRemoteReporter creates a new reporter that sends spans out of process by means of Sender.
// Calls to Report(Span) return immediately (side effect: if internal buffer is full the span is dropped).
// Periodically the transport buffer is flushed even if it hasn't reached max packet size.
// Calls to Close() block until all spans reported prior to the call to Close are flushed.
func NewRemoteReporter(sender Transport, opts ...ReporterOption) Reporter {
	options := reporterOptions{}
	for _, option := range opts {
		option(&options)
	}
	if options.bufferFlushInterval <= 0 {
		options.bufferFlushInterval = defaultBufferFlushInterval
	}
	if options.logger == nil {
		options.logger = log.NullLogger
	}
	if options.metrics == nil {
		options.metrics = NewNullMetrics()
	}
	if options.queueSize <= 0 {
		options.queueSize = defaultQueueSize
	}
	reporter := &remoteReporter{
		reporterOptions: options,
		sender:          sender,
		queue:           make(chan reporterQueueItem, options.queueSize),
	}
	go reporter.processQueue()
	return reporter
}

// Report implements Report() method of Reporter.
// It passes the span to a background go-routine for submission to Jaeger backend.
// If the internal queue is full, the span is dropped and metrics.ReporterDropped counter is incremented.
// If Report() is called after the reporter has been Close()-ed, the additional spans will not be
// sent to the backend, but the metrics.ReporterDropped counter may not reflect them correctly,
// because some of them may still be successfully added to the queue.
func (r *remoteReporter) Report(span *Span) {
	select {
	// Need to retain the span otherwise it will be released
	case r.queue <- reporterQueueItem{itemType: reporterQueueItemSpan, span: span.Retain()}:
		atomic.AddInt64(&r.queueLength, 1)
	default:
		r.metrics.ReporterDropped.Inc(1)
	}
}

// Close implements Close() method of Reporter by waiting for the queue to be drained.
func (r *remoteReporter) Close() {
	if swapped := atomic.CompareAndSwapInt64(&r.closed, 0, 1); !swapped {
		r.logger.Error("Repeated attempt to close the reporter is ignored")
		return
	}
	r.sendCloseEvent()
	r.sender.Close()
}

func (r *remoteReporter) sendCloseEvent() {
	wg := &sync.WaitGroup{}
	wg.Add(1)
	item := reporterQueueItem{itemType: reporterQueueItemClose, close: wg}

	r.queue <- item // if the queue is full we will block until there is space
	atomic.AddInt64(&r.queueLength, 1)
	wg.Wait()
}

// processQueue reads spans from the queue, converts them to Thrift, and stores them in an internal buffer.
// When the buffer length reaches batchSize, it is flushed by submitting the accumulated spans to Jaeger.
// Buffer also gets flushed automatically every batchFlushInterval seconds, just in case the tracer stopped
// reporting new spans.
func (r *remoteReporter) processQueue() {
	// flush causes the Sender to flush its accumulated spans and clear the buffer
	flush := func() {
		if flushed, err := r.sender.Flush(); err != nil {
			r.metrics.ReporterFailure.Inc(int64(flushed))
			r.logger.Error(fmt.Sprintf("error when flushing the buffer: %s", err.Error()))
		} else if flushed > 0 {
			r.metrics.ReporterSuccess.Inc(int64(flushed))
		}
	}

	timer := time.NewTicker(r.bufferFlushInterval)
	for {
		select {
		case <-timer.C:
			flush()
		case item := <-r.queue:
			atomic.AddInt64(&r.queueLength, -1)
			switch item.itemType {
			case reporterQueueItemSpan:
				span := item.span
				if flushed, err := r.sender.Append(span); err != nil {
					r.metrics.ReporterFailure.Inc(int64(flushed))
					r.logger.Error(fmt.Sprintf("error reporting span %q: %s", span.OperationName(), err.Error()))
				} else if flushed > 0 {
					r.metrics.ReporterSuccess.Inc(int64(flushed))
					// to reduce the number of gauge stats, we only emit queue length on flush
					r.metrics.ReporterQueueLength.Update(atomic.LoadInt64(&r.queueLength))
				}
				span.Release()
			case reporterQueueItemClose:
				timer.Stop()
				flush()
				item.close.Done()
				return
			}
		}
	}
}
