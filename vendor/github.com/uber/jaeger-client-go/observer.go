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
