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
	opentracing "github.com/opentracing/opentracing-go"
)

// ContribObserver can be registered with the Tracer to receive notifications
// about new Spans. Modelled after github.com/opentracing-contrib/go-observer.
type ContribObserver interface {
	// Create and return a span observer. Called when a span starts.
	// If the Observer is not interested in the given span, it must return (nil, false).
	// E.g :
	//     func StartSpan(opName string, opts ...opentracing.StartSpanOption) {
	//         var sp opentracing.Span
	//         sso := opentracing.StartSpanOptions{}
	//         if spanObserver, ok := Observer.OnStartSpan(span, opName, sso); ok {
	//             // we have a valid SpanObserver
	//         }
	//         ...
	//     }
	OnStartSpan(sp opentracing.Span, operationName string, options opentracing.StartSpanOptions) (ContribSpanObserver, bool)
}

// ContribSpanObserver is created by the Observer and receives notifications
// about other Span events. This interface is meant to match
// github.com/opentracing-contrib/go-observer, via duck typing, without
// directly importing the go-observer package.
type ContribSpanObserver interface {
	OnSetOperationName(operationName string)
	OnSetTag(key string, value interface{})
	OnFinish(options opentracing.FinishOptions)
}

// wrapper observer for the old observers (see observer.go)
type oldObserver struct {
	obs Observer
}

func (o *oldObserver) OnStartSpan(sp opentracing.Span, operationName string, options opentracing.StartSpanOptions) (ContribSpanObserver, bool) {
	spanObserver := o.obs.OnStartSpan(operationName, options)
	return spanObserver, spanObserver != nil
}
