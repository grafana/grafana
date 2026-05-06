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
	"math"
	"strings"
	"sync"

	"github.com/uber/jaeger-client-go/thrift-gen/sampling"
	"github.com/uber/jaeger-client-go/utils"
)

const (
	defaultMaxOperations = 2000
)

// Sampler decides whether a new trace should be sampled or not.
type Sampler interface {
	// IsSampled decides whether a trace with given `id` and `operation`
	// should be sampled. This function will also return the tags that
	// can be used to identify the type of sampling that was applied to
	// the root span. Most simple samplers would return two tags,
	// sampler.type and sampler.param, similar to those used in the Configuration
	IsSampled(id TraceID, operation string) (sampled bool, tags []Tag)

	// Close does a clean shutdown of the sampler, stopping any background
	// go-routines it may have started.
	Close()

	// Equal checks if the `other` sampler is functionally equivalent
	// to this sampler.
	// TODO (breaking change) remove this function. See PerOperationSampler.Equals for explanation.
	Equal(other Sampler) bool
}

// -----------------------

// ConstSampler is a sampler that always makes the same decision.
type ConstSampler struct {
	legacySamplerV1Base
	Decision bool
	tags     []Tag
}

// NewConstSampler creates a ConstSampler.
func NewConstSampler(sample bool) *ConstSampler {
	tags := []Tag{
		{key: SamplerTypeTagKey, value: SamplerTypeConst},
		{key: SamplerParamTagKey, value: sample},
	}
	s := &ConstSampler{
		Decision: sample,
		tags:     tags,
	}
	s.delegate = s.IsSampled
	return s
}

// IsSampled implements IsSampled() of Sampler.
func (s *ConstSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	return s.Decision, s.tags
}

// Close implements Close() of Sampler.
func (s *ConstSampler) Close() {
	// nothing to do
}

// Equal implements Equal() of Sampler.
func (s *ConstSampler) Equal(other Sampler) bool {
	if o, ok := other.(*ConstSampler); ok {
		return s.Decision == o.Decision
	}
	return false
}

// String is used to log sampler details.
func (s *ConstSampler) String() string {
	return fmt.Sprintf("ConstSampler(decision=%t)", s.Decision)
}

// -----------------------

// ProbabilisticSampler is a sampler that randomly samples a certain percentage
// of traces.
type ProbabilisticSampler struct {
	legacySamplerV1Base
	samplingRate     float64
	samplingBoundary uint64
	tags             []Tag
}

const maxRandomNumber = ^(uint64(1) << 63) // i.e. 0x7fffffffffffffff

// NewProbabilisticSampler creates a sampler that randomly samples a certain percentage of traces specified by the
// samplingRate, in the range between 0.0 and 1.0.
//
// It relies on the fact that new trace IDs are 63bit random numbers themselves, thus making the sampling decision
// without generating a new random number, but simply calculating if traceID < (samplingRate * 2^63).
// TODO remove the error from this function for next major release
func NewProbabilisticSampler(samplingRate float64) (*ProbabilisticSampler, error) {
	if samplingRate < 0.0 || samplingRate > 1.0 {
		return nil, fmt.Errorf("Sampling Rate must be between 0.0 and 1.0, received %f", samplingRate)
	}
	return newProbabilisticSampler(samplingRate), nil
}

func newProbabilisticSampler(samplingRate float64) *ProbabilisticSampler {
	s := new(ProbabilisticSampler)
	s.delegate = s.IsSampled
	return s.init(samplingRate)
}

func (s *ProbabilisticSampler) init(samplingRate float64) *ProbabilisticSampler {
	s.samplingRate = math.Max(0.0, math.Min(samplingRate, 1.0))
	s.samplingBoundary = uint64(float64(maxRandomNumber) * s.samplingRate)
	s.tags = []Tag{
		{key: SamplerTypeTagKey, value: SamplerTypeProbabilistic},
		{key: SamplerParamTagKey, value: s.samplingRate},
	}
	return s
}

// SamplingRate returns the sampling probability this sampled was constructed with.
func (s *ProbabilisticSampler) SamplingRate() float64 {
	return s.samplingRate
}

// IsSampled implements IsSampled() of Sampler.
func (s *ProbabilisticSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	return s.samplingBoundary >= id.Low&maxRandomNumber, s.tags
}

// Close implements Close() of Sampler.
func (s *ProbabilisticSampler) Close() {
	// nothing to do
}

// Equal implements Equal() of Sampler.
func (s *ProbabilisticSampler) Equal(other Sampler) bool {
	if o, ok := other.(*ProbabilisticSampler); ok {
		return s.samplingBoundary == o.samplingBoundary
	}
	return false
}

// Update modifies in-place the sampling rate. Locking must be done externally.
func (s *ProbabilisticSampler) Update(samplingRate float64) error {
	if samplingRate < 0.0 || samplingRate > 1.0 {
		return fmt.Errorf("Sampling Rate must be between 0.0 and 1.0, received %f", samplingRate)
	}
	s.init(samplingRate)
	return nil
}

// String is used to log sampler details.
func (s *ProbabilisticSampler) String() string {
	return fmt.Sprintf("ProbabilisticSampler(samplingRate=%v)", s.samplingRate)
}

// -----------------------

// RateLimitingSampler samples at most maxTracesPerSecond. The distribution of sampled traces follows
// burstiness of the service, i.e. a service with uniformly distributed requests will have those
// requests sampled uniformly as well, but if requests are bursty, especially sub-second, then a
// number of sequential requests can be sampled each second.
type RateLimitingSampler struct {
	legacySamplerV1Base
	maxTracesPerSecond float64
	rateLimiter        *utils.ReconfigurableRateLimiter
	tags               []Tag
}

// NewRateLimitingSampler creates new RateLimitingSampler.
func NewRateLimitingSampler(maxTracesPerSecond float64) *RateLimitingSampler {
	s := new(RateLimitingSampler)
	s.delegate = s.IsSampled
	return s.init(maxTracesPerSecond)
}

func (s *RateLimitingSampler) init(maxTracesPerSecond float64) *RateLimitingSampler {
	if s.rateLimiter == nil {
		s.rateLimiter = utils.NewRateLimiter(maxTracesPerSecond, math.Max(maxTracesPerSecond, 1.0))
	} else {
		s.rateLimiter.Update(maxTracesPerSecond, math.Max(maxTracesPerSecond, 1.0))
	}
	s.maxTracesPerSecond = maxTracesPerSecond
	s.tags = []Tag{
		{key: SamplerTypeTagKey, value: SamplerTypeRateLimiting},
		{key: SamplerParamTagKey, value: maxTracesPerSecond},
	}
	return s
}

// IsSampled implements IsSampled() of Sampler.
func (s *RateLimitingSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	return s.rateLimiter.CheckCredit(1.0), s.tags
}

// Update reconfigures the rate limiter, while preserving its accumulated balance.
// Locking must be done externally.
func (s *RateLimitingSampler) Update(maxTracesPerSecond float64) {
	if s.maxTracesPerSecond != maxTracesPerSecond {
		s.init(maxTracesPerSecond)
	}
}

// Close does nothing.
func (s *RateLimitingSampler) Close() {
	// nothing to do
}

// Equal compares with another sampler.
func (s *RateLimitingSampler) Equal(other Sampler) bool {
	if o, ok := other.(*RateLimitingSampler); ok {
		return s.maxTracesPerSecond == o.maxTracesPerSecond
	}
	return false
}

// String is used to log sampler details.
func (s *RateLimitingSampler) String() string {
	return fmt.Sprintf("RateLimitingSampler(maxTracesPerSecond=%v)", s.maxTracesPerSecond)
}

// -----------------------

// GuaranteedThroughputProbabilisticSampler is a sampler that leverages both ProbabilisticSampler and
// RateLimitingSampler. The RateLimitingSampler is used as a guaranteed lower bound sampler such that
// every operation is sampled at least once in a time interval defined by the lowerBound. ie a lowerBound
// of 1.0 / (60 * 10) will sample an operation at least once every 10 minutes.
//
// The ProbabilisticSampler is given higher priority when tags are emitted, ie. if IsSampled() for both
// samplers return true, the tags for ProbabilisticSampler will be used.
type GuaranteedThroughputProbabilisticSampler struct {
	probabilisticSampler *ProbabilisticSampler
	lowerBoundSampler    *RateLimitingSampler
	tags                 []Tag
	samplingRate         float64
	lowerBound           float64
}

// NewGuaranteedThroughputProbabilisticSampler returns a delegating sampler that applies both
// ProbabilisticSampler and RateLimitingSampler.
func NewGuaranteedThroughputProbabilisticSampler(
	lowerBound, samplingRate float64,
) (*GuaranteedThroughputProbabilisticSampler, error) {
	return newGuaranteedThroughputProbabilisticSampler(lowerBound, samplingRate), nil
}

func newGuaranteedThroughputProbabilisticSampler(lowerBound, samplingRate float64) *GuaranteedThroughputProbabilisticSampler {
	s := &GuaranteedThroughputProbabilisticSampler{
		lowerBoundSampler: NewRateLimitingSampler(lowerBound),
		lowerBound:        lowerBound,
	}
	s.setProbabilisticSampler(samplingRate)
	return s
}

func (s *GuaranteedThroughputProbabilisticSampler) setProbabilisticSampler(samplingRate float64) {
	if s.probabilisticSampler == nil {
		s.probabilisticSampler = newProbabilisticSampler(samplingRate)
	} else if s.samplingRate != samplingRate {
		s.probabilisticSampler.init(samplingRate)
	}
	// since we don't validate samplingRate, sampler may have clamped it to [0, 1] interval
	samplingRate = s.probabilisticSampler.SamplingRate()
	if s.samplingRate != samplingRate || s.tags == nil {
		s.samplingRate = s.probabilisticSampler.SamplingRate()
		s.tags = []Tag{
			{key: SamplerTypeTagKey, value: SamplerTypeLowerBound},
			{key: SamplerParamTagKey, value: s.samplingRate},
		}
	}
}

// IsSampled implements IsSampled() of Sampler.
func (s *GuaranteedThroughputProbabilisticSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	if sampled, tags := s.probabilisticSampler.IsSampled(id, operation); sampled {
		s.lowerBoundSampler.IsSampled(id, operation)
		return true, tags
	}
	sampled, _ := s.lowerBoundSampler.IsSampled(id, operation)
	return sampled, s.tags
}

// Close implements Close() of Sampler.
func (s *GuaranteedThroughputProbabilisticSampler) Close() {
	s.probabilisticSampler.Close()
	s.lowerBoundSampler.Close()
}

// Equal implements Equal() of Sampler.
func (s *GuaranteedThroughputProbabilisticSampler) Equal(other Sampler) bool {
	// NB The Equal() function is expensive and will be removed. See PerOperationSampler.Equal() for
	// more information.
	return false
}

// this function should only be called while holding a Write lock
func (s *GuaranteedThroughputProbabilisticSampler) update(lowerBound, samplingRate float64) {
	s.setProbabilisticSampler(samplingRate)
	if s.lowerBound != lowerBound {
		s.lowerBoundSampler.Update(lowerBound)
		s.lowerBound = lowerBound
	}
}

func (s GuaranteedThroughputProbabilisticSampler) String() string {
	return fmt.Sprintf("GuaranteedThroughputProbabilisticSampler(lowerBound=%f, samplingRate=%f)", s.lowerBound, s.samplingRate)
}

// -----------------------

// PerOperationSampler is a delegating sampler that applies GuaranteedThroughputProbabilisticSampler
// on a per-operation basis.
type PerOperationSampler struct {
	sync.RWMutex

	samplers       map[string]*GuaranteedThroughputProbabilisticSampler
	defaultSampler *ProbabilisticSampler
	lowerBound     float64
	maxOperations  int

	// see description in PerOperationSamplerParams
	operationNameLateBinding bool
}

// NewAdaptiveSampler returns a new PerOperationSampler.
// Deprecated: please use NewPerOperationSampler.
func NewAdaptiveSampler(strategies *sampling.PerOperationSamplingStrategies, maxOperations int) (*PerOperationSampler, error) {
	return NewPerOperationSampler(PerOperationSamplerParams{
		MaxOperations: maxOperations,
		Strategies:    strategies,
	}), nil
}

// PerOperationSamplerParams defines parameters when creating PerOperationSampler.
type PerOperationSamplerParams struct {
	// Max number of operations that will be tracked. Other operations will be given default strategy.
	MaxOperations int

	// Opt-in feature for applications that require late binding of span name via explicit call to SetOperationName.
	// When this feature is enabled, the sampler will return retryable=true from OnCreateSpan(), thus leaving
	// the sampling decision as non-final (and the span as writeable). This may lead to degraded performance
	// in applications that always provide the correct span name on trace creation.
	//
	// For backwards compatibility this option is off by default.
	OperationNameLateBinding bool

	// Initial configuration of the sampling strategies (usually retrieved from the backend by Remote Sampler).
	Strategies *sampling.PerOperationSamplingStrategies
}

// NewPerOperationSampler returns a new PerOperationSampler.
func NewPerOperationSampler(params PerOperationSamplerParams) *PerOperationSampler {
	if params.MaxOperations <= 0 {
		params.MaxOperations = defaultMaxOperations
	}
	samplers := make(map[string]*GuaranteedThroughputProbabilisticSampler)
	for _, strategy := range params.Strategies.PerOperationStrategies {
		sampler := newGuaranteedThroughputProbabilisticSampler(
			params.Strategies.DefaultLowerBoundTracesPerSecond,
			strategy.ProbabilisticSampling.SamplingRate,
		)
		samplers[strategy.Operation] = sampler
	}
	return &PerOperationSampler{
		samplers:                 samplers,
		defaultSampler:           newProbabilisticSampler(params.Strategies.DefaultSamplingProbability),
		lowerBound:               params.Strategies.DefaultLowerBoundTracesPerSecond,
		maxOperations:            params.MaxOperations,
		operationNameLateBinding: params.OperationNameLateBinding,
	}
}

// IsSampled is not used and only exists to match Sampler V1 API.
// TODO (breaking change) remove when upgrading everything to SamplerV2
func (s *PerOperationSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	return false, nil
}

func (s *PerOperationSampler) trySampling(span *Span, operationName string) (bool, []Tag) {
	samplerV1 := s.getSamplerForOperation(operationName)
	var sampled bool
	var tags []Tag
	if span.context.samplingState.isLocalRootSpan(span.context.spanID) {
		sampled, tags = samplerV1.IsSampled(span.context.TraceID(), operationName)
	}
	return sampled, tags
}

// OnCreateSpan implements OnCreateSpan of SamplerV2.
func (s *PerOperationSampler) OnCreateSpan(span *Span) SamplingDecision {
	sampled, tags := s.trySampling(span, span.OperationName())
	return SamplingDecision{Sample: sampled, Retryable: s.operationNameLateBinding, Tags: tags}
}

// OnSetOperationName implements OnSetOperationName of SamplerV2.
func (s *PerOperationSampler) OnSetOperationName(span *Span, operationName string) SamplingDecision {
	sampled, tags := s.trySampling(span, operationName)
	return SamplingDecision{Sample: sampled, Retryable: false, Tags: tags}
}

// OnSetTag implements OnSetTag of SamplerV2.
func (s *PerOperationSampler) OnSetTag(span *Span, key string, value interface{}) SamplingDecision {
	return SamplingDecision{Sample: false, Retryable: true}
}

// OnFinishSpan implements OnFinishSpan of SamplerV2.
func (s *PerOperationSampler) OnFinishSpan(span *Span) SamplingDecision {
	return SamplingDecision{Sample: false, Retryable: true}
}

func (s *PerOperationSampler) getSamplerForOperation(operation string) Sampler {
	s.RLock()
	sampler, ok := s.samplers[operation]
	if ok {
		defer s.RUnlock()
		return sampler
	}
	s.RUnlock()
	s.Lock()
	defer s.Unlock()

	// Check if sampler has already been created
	sampler, ok = s.samplers[operation]
	if ok {
		return sampler
	}
	// Store only up to maxOperations of unique ops.
	if len(s.samplers) >= s.maxOperations {
		return s.defaultSampler
	}
	newSampler := newGuaranteedThroughputProbabilisticSampler(s.lowerBound, s.defaultSampler.SamplingRate())
	s.samplers[operation] = newSampler
	return newSampler
}

// Close invokes Close on all underlying samplers.
func (s *PerOperationSampler) Close() {
	s.Lock()
	defer s.Unlock()
	for _, sampler := range s.samplers {
		sampler.Close()
	}
	s.defaultSampler.Close()
}

func (s *PerOperationSampler) String() string {
	var sb strings.Builder

	fmt.Fprintf(&sb, "PerOperationSampler(defaultSampler=%v, ", s.defaultSampler)
	fmt.Fprintf(&sb, "lowerBound=%f, ", s.lowerBound)
	fmt.Fprintf(&sb, "maxOperations=%d, ", s.maxOperations)
	fmt.Fprintf(&sb, "operationNameLateBinding=%t, ", s.operationNameLateBinding)
	fmt.Fprintf(&sb, "numOperations=%d,\n", len(s.samplers))
	fmt.Fprintf(&sb, "samplers=[")
	for operationName, sampler := range s.samplers {
		fmt.Fprintf(&sb, "\n(operationName=%s, sampler=%v)", operationName, sampler)
	}
	fmt.Fprintf(&sb, "])")

	return sb.String()
}

// Equal is not used.
// TODO (breaking change) remove this in the future
func (s *PerOperationSampler) Equal(other Sampler) bool {
	// NB The Equal() function is overly expensive for PerOperationSampler since it's composed of multiple
	// samplers which all need to be initialized before this function can be called for a comparison.
	// Therefore, PerOperationSampler uses the update() function to only alter the samplers that need
	// changing. Hence this function always returns false so that the update function can be called.
	// Once the Equal() function is removed from the Sampler API, this will no longer be needed.
	return false
}

func (s *PerOperationSampler) update(strategies *sampling.PerOperationSamplingStrategies) {
	s.Lock()
	defer s.Unlock()
	newSamplers := map[string]*GuaranteedThroughputProbabilisticSampler{}
	for _, strategy := range strategies.PerOperationStrategies {
		operation := strategy.Operation
		samplingRate := strategy.ProbabilisticSampling.SamplingRate
		lowerBound := strategies.DefaultLowerBoundTracesPerSecond
		if sampler, ok := s.samplers[operation]; ok {
			sampler.update(lowerBound, samplingRate)
			newSamplers[operation] = sampler
		} else {
			sampler := newGuaranteedThroughputProbabilisticSampler(
				lowerBound,
				samplingRate,
			)
			newSamplers[operation] = sampler
		}
	}
	s.lowerBound = strategies.DefaultLowerBoundTracesPerSecond
	if s.defaultSampler.SamplingRate() != strategies.DefaultSamplingProbability {
		s.defaultSampler = newProbabilisticSampler(strategies.DefaultSamplingProbability)
	}
	s.samplers = newSamplers
}
