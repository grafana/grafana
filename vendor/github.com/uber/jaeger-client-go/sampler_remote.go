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
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"sync"
	"sync/atomic"
	"time"

	"github.com/uber/jaeger-client-go/log"
	"github.com/uber/jaeger-client-go/thrift-gen/sampling"
)

const (
	defaultSamplingRefreshInterval = time.Minute
)

// SamplingStrategyFetcher is used to fetch sampling strategy updates from remote server.
type SamplingStrategyFetcher interface {
	Fetch(service string) ([]byte, error)
}

// SamplingStrategyParser is used to parse sampling strategy updates. The output object
// should be of the type that is recognized by the SamplerUpdaters.
type SamplingStrategyParser interface {
	Parse(response []byte) (interface{}, error)
}

// SamplerUpdater is used by RemotelyControlledSampler to apply sampling strategies,
// retrieved from remote config server, to the current sampler. The updater can modify
// the sampler in-place if sampler supports it, or create a new one.
//
// If the strategy does not contain configuration for the sampler in question,
// updater must return modifiedSampler=nil to give other updaters a chance to inspect
// the sampling strategy response.
//
// RemotelyControlledSampler invokes the updaters while holding a lock on the main sampler.
type SamplerUpdater interface {
	Update(sampler SamplerV2, strategy interface{}) (modified SamplerV2, err error)
}

// RemotelyControlledSampler is a delegating sampler that polls a remote server
// for the appropriate sampling strategy, constructs a corresponding sampler and
// delegates to it for sampling decisions.
type RemotelyControlledSampler struct {
	// These fields must be first in the struct because `sync/atomic` expects 64-bit alignment.
	// Cf. https://github.com/uber/jaeger-client-go/issues/155, https://goo.gl/zW7dgq
	closed int64 // 0 - not closed, 1 - closed

	sync.RWMutex // used to serialize access to samplerOptions.sampler
	samplerOptions

	serviceName string
	doneChan    chan *sync.WaitGroup
}

// NewRemotelyControlledSampler creates a sampler that periodically pulls
// the sampling strategy from an HTTP sampling server (e.g. jaeger-agent).
func NewRemotelyControlledSampler(
	serviceName string,
	opts ...SamplerOption,
) *RemotelyControlledSampler {
	options := new(samplerOptions).applyOptionsAndDefaults(opts...)
	sampler := &RemotelyControlledSampler{
		samplerOptions: *options,
		serviceName:    serviceName,
		doneChan:       make(chan *sync.WaitGroup),
	}
	go sampler.pollController()
	return sampler
}

// IsSampled implements IsSampled() of Sampler.
// TODO (breaking change) remove when Sampler V1 is removed
func (s *RemotelyControlledSampler) IsSampled(id TraceID, operation string) (bool, []Tag) {
	return false, nil
}

// OnCreateSpan implements OnCreateSpan of SamplerV2.
func (s *RemotelyControlledSampler) OnCreateSpan(span *Span) SamplingDecision {
	return s.Sampler().OnCreateSpan(span)
}

// OnSetOperationName implements OnSetOperationName of SamplerV2.
func (s *RemotelyControlledSampler) OnSetOperationName(span *Span, operationName string) SamplingDecision {
	return s.Sampler().OnSetOperationName(span, operationName)
}

// OnSetTag implements OnSetTag of SamplerV2.
func (s *RemotelyControlledSampler) OnSetTag(span *Span, key string, value interface{}) SamplingDecision {
	return s.Sampler().OnSetTag(span, key, value)
}

// OnFinishSpan implements OnFinishSpan of SamplerV2.
func (s *RemotelyControlledSampler) OnFinishSpan(span *Span) SamplingDecision {
	return s.Sampler().OnFinishSpan(span)
}

// Close implements Close() of Sampler.
func (s *RemotelyControlledSampler) Close() {
	if swapped := atomic.CompareAndSwapInt64(&s.closed, 0, 1); !swapped {
		s.logger.Error("Repeated attempt to close the sampler is ignored")
		return
	}

	var wg sync.WaitGroup
	wg.Add(1)
	s.doneChan <- &wg
	wg.Wait()
}

// Equal implements Equal() of Sampler.
func (s *RemotelyControlledSampler) Equal(other Sampler) bool {
	// NB The Equal() function is expensive and will be removed. See PerOperationSampler.Equal() for
	// more information.
	return false
}

func (s *RemotelyControlledSampler) pollController() {
	ticker := time.NewTicker(s.samplingRefreshInterval)
	defer ticker.Stop()
	s.pollControllerWithTicker(ticker)
}

func (s *RemotelyControlledSampler) pollControllerWithTicker(ticker *time.Ticker) {
	for {
		select {
		case <-ticker.C:
			s.UpdateSampler()
		case wg := <-s.doneChan:
			wg.Done()
			return
		}
	}
}

// Sampler returns the currently active sampler.
func (s *RemotelyControlledSampler) Sampler() SamplerV2 {
	s.RLock()
	defer s.RUnlock()
	return s.sampler
}

func (s *RemotelyControlledSampler) setSampler(sampler SamplerV2) {
	s.Lock()
	defer s.Unlock()
	s.sampler = sampler
}

// UpdateSampler forces the sampler to fetch sampling strategy from backend server.
// This function is called automatically on a timer, but can also be safely called manually, e.g. from tests.
func (s *RemotelyControlledSampler) UpdateSampler() {
	res, err := s.samplingFetcher.Fetch(s.serviceName)
	if err != nil {
		s.metrics.SamplerQueryFailure.Inc(1)
		s.logger.Infof("failed to fetch sampling strategy: %v", err)
		return
	}
	strategy, err := s.samplingParser.Parse(res)
	if err != nil {
		s.metrics.SamplerUpdateFailure.Inc(1)
		s.logger.Infof("failed to parse sampling strategy response: %v", err)
		return
	}

	s.Lock()
	defer s.Unlock()

	s.metrics.SamplerRetrieved.Inc(1)
	if err := s.updateSamplerViaUpdaters(strategy); err != nil {
		s.metrics.SamplerUpdateFailure.Inc(1)
		s.logger.Infof("failed to handle sampling strategy response %+v. Got error: %v", res, err)
		return
	}
	s.metrics.SamplerUpdated.Inc(1)
}

// NB: this function should only be called while holding a Write lock
func (s *RemotelyControlledSampler) updateSamplerViaUpdaters(strategy interface{}) error {
	for _, updater := range s.updaters {
		sampler, err := updater.Update(s.sampler, strategy)
		if err != nil {
			return err
		}
		if sampler != nil {
			s.logger.Debugf("sampler updated: %+v", sampler)
			s.sampler = sampler
			return nil
		}
	}
	return fmt.Errorf("unsupported sampling strategy %+v", strategy)
}

// -----------------------

// ProbabilisticSamplerUpdater is used by RemotelyControlledSampler to parse sampling configuration.
type ProbabilisticSamplerUpdater struct{}

// Update implements Update of SamplerUpdater.
func (u *ProbabilisticSamplerUpdater) Update(sampler SamplerV2, strategy interface{}) (SamplerV2, error) {
	type response interface {
		GetProbabilisticSampling() *sampling.ProbabilisticSamplingStrategy
	}
	var _ response = new(sampling.SamplingStrategyResponse) // sanity signature check
	if resp, ok := strategy.(response); ok {
		if probabilistic := resp.GetProbabilisticSampling(); probabilistic != nil {
			if ps, ok := sampler.(*ProbabilisticSampler); ok {
				if err := ps.Update(probabilistic.SamplingRate); err != nil {
					return nil, err
				}
				return sampler, nil
			}
			return newProbabilisticSampler(probabilistic.SamplingRate), nil
		}
	}
	return nil, nil
}

// -----------------------

// RateLimitingSamplerUpdater is used by RemotelyControlledSampler to parse sampling configuration.
type RateLimitingSamplerUpdater struct{}

// Update implements Update of SamplerUpdater.
func (u *RateLimitingSamplerUpdater) Update(sampler SamplerV2, strategy interface{}) (SamplerV2, error) {
	type response interface {
		GetRateLimitingSampling() *sampling.RateLimitingSamplingStrategy
	}
	var _ response = new(sampling.SamplingStrategyResponse) // sanity signature check
	if resp, ok := strategy.(response); ok {
		if rateLimiting := resp.GetRateLimitingSampling(); rateLimiting != nil {
			rateLimit := float64(rateLimiting.MaxTracesPerSecond)
			if rl, ok := sampler.(*RateLimitingSampler); ok {
				rl.Update(rateLimit)
				return rl, nil
			}
			return NewRateLimitingSampler(rateLimit), nil
		}
	}
	return nil, nil
}

// -----------------------

// AdaptiveSamplerUpdater is used by RemotelyControlledSampler to parse sampling configuration.
// Fields have the same meaning as in PerOperationSamplerParams.
type AdaptiveSamplerUpdater struct {
	MaxOperations            int
	OperationNameLateBinding bool
}

// Update implements Update of SamplerUpdater.
func (u *AdaptiveSamplerUpdater) Update(sampler SamplerV2, strategy interface{}) (SamplerV2, error) {
	type response interface {
		GetOperationSampling() *sampling.PerOperationSamplingStrategies
	}
	var _ response = new(sampling.SamplingStrategyResponse) // sanity signature check
	if p, ok := strategy.(response); ok {
		if operations := p.GetOperationSampling(); operations != nil {
			if as, ok := sampler.(*PerOperationSampler); ok {
				as.update(operations)
				return as, nil
			}
			return NewPerOperationSampler(PerOperationSamplerParams{
				MaxOperations:            u.MaxOperations,
				OperationNameLateBinding: u.OperationNameLateBinding,
				Strategies:               operations,
			}), nil
		}
	}
	return nil, nil
}

// -----------------------

type httpSamplingStrategyFetcher struct {
	serverURL string
	logger    log.DebugLogger
}

func (f *httpSamplingStrategyFetcher) Fetch(serviceName string) ([]byte, error) {
	v := url.Values{}
	v.Set("service", serviceName)
	uri := f.serverURL + "?" + v.Encode()

	// TODO create and reuse http.Client with proper timeout settings, etc.
	resp, err := http.Get(uri)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			f.logger.Error(fmt.Sprintf("failed to close HTTP response body: %+v", err))
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("StatusCode: %d, Body: %s", resp.StatusCode, body)
	}

	return body, nil
}

// -----------------------

type samplingStrategyParser struct{}

func (p *samplingStrategyParser) Parse(response []byte) (interface{}, error) {
	strategy := new(sampling.SamplingStrategyResponse)
	if err := json.Unmarshal(response, strategy); err != nil {
		return nil, err
	}
	return strategy, nil
}
