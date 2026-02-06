// Copyright (c) 2019 Uber Technologies, Inc.
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

// SamplingDecision is returned by the V2 samplers.
type SamplingDecision struct {
	Sample    bool
	Retryable bool
	Tags      []Tag
}

// SamplerV2 is an extension of the V1 samplers that allows sampling decisions
// be made at different points of the span lifecycle.
type SamplerV2 interface {
	OnCreateSpan(span *Span) SamplingDecision
	OnSetOperationName(span *Span, operationName string) SamplingDecision
	OnSetTag(span *Span, key string, value interface{}) SamplingDecision
	OnFinishSpan(span *Span) SamplingDecision

	// Close does a clean shutdown of the sampler, stopping any background
	// go-routines it may have started.
	Close()
}

// samplerV1toV2 wraps legacy V1 sampler into an adapter that make it look like V2.
func samplerV1toV2(s Sampler) SamplerV2 {
	if s2, ok := s.(SamplerV2); ok {
		return s2
	}
	type legacySamplerV1toV2Adapter struct {
		legacySamplerV1Base
	}
	return &legacySamplerV1toV2Adapter{
		legacySamplerV1Base: legacySamplerV1Base{
			delegate: s.IsSampled,
		},
	}
}

// SamplerV2Base can be used by V2 samplers to implement dummy V1 methods.
// Supporting V1 API is required because Tracer configuration only accepts V1 Sampler
// for backwards compatibility reasons.
// TODO (breaking change) remove this in the next major release
type SamplerV2Base struct{}

// IsSampled implements IsSampled of Sampler.
func (SamplerV2Base) IsSampled(id TraceID, operation string) (sampled bool, tags []Tag) {
	return false, nil
}

// Close implements Close of Sampler.
func (SamplerV2Base) Close() {}

// Equal implements Equal of Sampler.
func (SamplerV2Base) Equal(other Sampler) bool { return false }

// legacySamplerV1Base is used as a base for simple samplers that only implement
// the legacy isSampled() function that is not sensitive to its arguments.
type legacySamplerV1Base struct {
	delegate func(id TraceID, operation string) (sampled bool, tags []Tag)
}

func (s *legacySamplerV1Base) OnCreateSpan(span *Span) SamplingDecision {
	isSampled, tags := s.delegate(span.context.traceID, span.operationName)
	return SamplingDecision{Sample: isSampled, Retryable: false, Tags: tags}
}

func (s *legacySamplerV1Base) OnSetOperationName(span *Span, operationName string) SamplingDecision {
	isSampled, tags := s.delegate(span.context.traceID, span.operationName)
	return SamplingDecision{Sample: isSampled, Retryable: false, Tags: tags}
}

func (s *legacySamplerV1Base) OnSetTag(span *Span, key string, value interface{}) SamplingDecision {
	return SamplingDecision{Sample: false, Retryable: true}
}

func (s *legacySamplerV1Base) OnFinishSpan(span *Span) SamplingDecision {
	return SamplingDecision{Sample: false, Retryable: true}
}

func (s *legacySamplerV1Base) Close() {}
