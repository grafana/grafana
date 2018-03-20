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
	"github.com/uber/jaeger-lib/metrics"
)

// Metrics is a container of all stats emitted by Jaeger tracer.
type Metrics struct {
	// Number of traces started by this tracer as sampled
	TracesStartedSampled metrics.Counter `metric:"traces" tags:"state=started,sampled=y"`

	// Number of traces started by this tracer as not sampled
	TracesStartedNotSampled metrics.Counter `metric:"traces" tags:"state=started,sampled=n"`

	// Number of externally started sampled traces this tracer joined
	TracesJoinedSampled metrics.Counter `metric:"traces" tags:"state=joined,sampled=y"`

	// Number of externally started not-sampled traces this tracer joined
	TracesJoinedNotSampled metrics.Counter `metric:"traces" tags:"state=joined,sampled=n"`

	// Number of sampled spans started by this tracer
	SpansStartedSampled metrics.Counter `metric:"started_spans" tags:"sampled=y"`

	// Number of unsampled spans started by this tracer
	SpansStartedNotSampled metrics.Counter `metric:"started_spans" tags:"sampled=n"`

	// Number of spans finished by this tracer
	SpansFinished metrics.Counter `metric:"finished_spans"`

	// Number of errors decoding tracing context
	DecodingErrors metrics.Counter `metric:"span_context_decoding_errors"`

	// Number of spans successfully reported
	ReporterSuccess metrics.Counter `metric:"reporter_spans" tags:"result=ok"`

	// Number of spans not reported due to a Sender failure
	ReporterFailure metrics.Counter `metric:"reporter_spans" tags:"result=err"`

	// Number of spans dropped due to internal queue overflow
	ReporterDropped metrics.Counter `metric:"reporter_spans" tags:"result=dropped"`

	// Current number of spans in the reporter queue
	ReporterQueueLength metrics.Gauge `metric:"reporter_queue_length"`

	// Number of times the Sampler succeeded to retrieve sampling strategy
	SamplerRetrieved metrics.Counter `metric:"sampler_queries" tags:"result=ok"`

	// Number of times the Sampler failed to retrieve sampling strategy
	SamplerQueryFailure metrics.Counter `metric:"sampler_queries" tags:"result=err"`

	// Number of times the Sampler succeeded to retrieve and update sampling strategy
	SamplerUpdated metrics.Counter `metric:"sampler_updates" tags:"result=ok"`

	// Number of times the Sampler failed to update sampling strategy
	SamplerUpdateFailure metrics.Counter `metric:"sampler_updates" tags:"result=err"`

	// Number of times baggage was successfully written or updated on spans.
	BaggageUpdateSuccess metrics.Counter `metric:"baggage_updates" tags:"result=ok"`

	// Number of times baggage failed to write or update on spans.
	BaggageUpdateFailure metrics.Counter `metric:"baggage_updates" tags:"result=err"`

	// Number of times baggage was truncated as per baggage restrictions.
	BaggageTruncate metrics.Counter `metric:"baggage_truncations"`

	// Number of times baggage restrictions were successfully updated.
	BaggageRestrictionsUpdateSuccess metrics.Counter `metric:"baggage_restrictions_updates" tags:"result=ok"`

	// Number of times baggage restrictions failed to update.
	BaggageRestrictionsUpdateFailure metrics.Counter `metric:"baggage_restrictions_updates" tags:"result=err"`
}

// NewMetrics creates a new Metrics struct and initializes it.
func NewMetrics(factory metrics.Factory, globalTags map[string]string) *Metrics {
	m := &Metrics{}
	// TODO the namespace "jaeger" should be configurable (e.g. in all-in-one "jaeger-client" would make more sense)
	metrics.Init(m, factory.Namespace("jaeger", nil), globalTags)
	return m
}

// NewNullMetrics creates a new Metrics struct that won't report any metrics.
func NewNullMetrics() *Metrics {
	return NewMetrics(metrics.NullFactory, nil)
}
