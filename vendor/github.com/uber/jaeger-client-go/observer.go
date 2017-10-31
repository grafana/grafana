// Copyright (c) 2017 Uber Technologies, Inc.
//
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

import opentracing "github.com/opentracing/opentracing-go"

// Observer can be registered with the Tracer to receive notifications about
// new Spans.
//
// Deprecated: use jaeger.ContribObserver instead.
type Observer interface {
	OnStartSpan(operationName string, options opentracing.StartSpanOptions) SpanObserver
}

// SpanObserver is created by the Observer and receives notifications about
// other Span events.
//
// Deprecated: use jaeger.ContribSpanObserver instead.
type SpanObserver interface {
	OnSetOperationName(operationName string)
	OnSetTag(key string, value interface{})
	OnFinish(options opentracing.FinishOptions)
}

// compositeObserver is a dispatcher to other observers
type compositeObserver struct {
	observers []ContribObserver
}

// compositeSpanObserver is a dispatcher to other span observers
type compositeSpanObserver struct {
	observers []ContribSpanObserver
}

// noopSpanObserver is used when there are no observers registered
// on the Tracer or none of them returns span observers from OnStartSpan.
var noopSpanObserver = &compositeSpanObserver{}

func (o *compositeObserver) append(contribObserver ContribObserver) {
	o.observers = append(o.observers, contribObserver)
}

func (o *compositeObserver) OnStartSpan(sp opentracing.Span, operationName string, options opentracing.StartSpanOptions) ContribSpanObserver {
	var spanObservers []ContribSpanObserver
	for _, obs := range o.observers {
		spanObs, ok := obs.OnStartSpan(sp, operationName, options)
		if ok {
			if spanObservers == nil {
				spanObservers = make([]ContribSpanObserver, 0, len(o.observers))
			}
			spanObservers = append(spanObservers, spanObs)
		}
	}
	if len(spanObservers) == 0 {
		return noopSpanObserver
	}
	return &compositeSpanObserver{observers: spanObservers}
}

func (o *compositeSpanObserver) OnSetOperationName(operationName string) {
	for _, obs := range o.observers {
		obs.OnSetOperationName(operationName)
	}
}

func (o *compositeSpanObserver) OnSetTag(key string, value interface{}) {
	for _, obs := range o.observers {
		obs.OnSetTag(key, value)
	}
}

func (o *compositeSpanObserver) OnFinish(options opentracing.FinishOptions) {
	for _, obs := range o.observers {
		obs.OnFinish(options)
	}
}
