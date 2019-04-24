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
	"github.com/opentracing/opentracing-go/log"

	"github.com/uber/jaeger-client-go/internal/baggage"
)

// baggageSetter is an actor that can set a baggage value on a Span given certain
// restrictions (eg. maxValueLength).
type baggageSetter struct {
	restrictionManager baggage.RestrictionManager
	metrics            *Metrics
}

func newBaggageSetter(restrictionManager baggage.RestrictionManager, metrics *Metrics) *baggageSetter {
	return &baggageSetter{
		restrictionManager: restrictionManager,
		metrics:            metrics,
	}
}

// (NB) span should hold the lock before making this call
func (s *baggageSetter) setBaggage(span *Span, key, value string) {
	var truncated bool
	var prevItem string
	restriction := s.restrictionManager.GetRestriction(span.serviceName(), key)
	if !restriction.KeyAllowed() {
		s.logFields(span, key, value, prevItem, truncated, restriction.KeyAllowed())
		s.metrics.BaggageUpdateFailure.Inc(1)
		return
	}
	if len(value) > restriction.MaxValueLength() {
		truncated = true
		value = value[:restriction.MaxValueLength()]
		s.metrics.BaggageTruncate.Inc(1)
	}
	prevItem = span.context.baggage[key]
	s.logFields(span, key, value, prevItem, truncated, restriction.KeyAllowed())
	span.context = span.context.WithBaggageItem(key, value)
	s.metrics.BaggageUpdateSuccess.Inc(1)
}

func (s *baggageSetter) logFields(span *Span, key, value, prevItem string, truncated, valid bool) {
	if !span.context.IsSampled() {
		return
	}
	fields := []log.Field{
		log.String("event", "baggage"),
		log.String("key", key),
		log.String("value", value),
	}
	if prevItem != "" {
		fields = append(fields, log.String("override", "true"))
	}
	if truncated {
		fields = append(fields, log.String("truncated", "true"))
	}
	if !valid {
		fields = append(fields, log.String("invalid", "true"))
	}
	span.logFieldsNoLocking(fields...)
}
