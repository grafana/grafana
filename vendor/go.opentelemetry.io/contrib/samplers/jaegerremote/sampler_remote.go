// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Copyright (c) 2021 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package jaegerremote // import "go.opentelemetry.io/contrib/samplers/jaegerremote"

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gogo/protobuf/jsonpb"
	jaeger_api_v2 "github.com/jaegertracing/jaeger-idl/proto-gen/api_v2"
	"go.opentelemetry.io/otel/sdk/trace"
)

const (
	defaultRemoteSamplingTimeout            = 10 * time.Second
	defaultSamplingRefreshInterval          = time.Minute
	defaultSamplingMaxOperations            = 256
	defaultSamplingOperationNameLateBinding = true
)

// SamplingStrategyFetcher is used to fetch sampling strategy updates from remote server.
type SamplingStrategyFetcher interface {
	Fetch(service string) ([]byte, error)
}

// samplingStrategyParser is used to parse sampling strategy updates. The output object
// should be of the type that is recognized by the SamplerUpdaters.
type samplingStrategyParser interface {
	Parse(response []byte) (any, error)
}

// samplerUpdater is used by Sampler to apply sampling strategies,
// retrieved from remote config server, to the current sampler. The updater can modify
// the sampler in-place if sampler supports it, or create a new one.
//
// If the strategy does not contain configuration for the sampler in question,
// updater must return modifiedSampler=nil to give other updaters a chance to inspect
// the sampling strategy response.
//
// Sampler invokes the updaters while holding a lock on the main sampler.
type samplerUpdater interface {
	Update(sampler trace.Sampler, strategy any) (modified trace.Sampler, err error)
}

// Sampler is a delegating sampler that polls a remote server
// for the appropriate sampling strategy, constructs a corresponding sampler and
// delegates to it for sampling decisions.
type Sampler struct {
	// These fields must be first in the struct because `sync/atomic` expects 64-bit alignment.
	// Cf. https://github.com/jaegertracing/jaeger-client-go/issues/155, https://pkg.go.dev/sync/atomic#pkg-note-BUG
	closed int64 // 0 - not closed, 1 - closed

	sync.RWMutex // used to serialize access to samplerConfig.sampler
	config

	serviceName string
	doneChan    chan *sync.WaitGroup
}

// New creates a sampler that periodically pulls
// the sampling strategy from an HTTP sampling server (e.g. jaeger-agent).
func New(
	serviceName string,
	opts ...Option,
) *Sampler {
	options := newConfig(opts...)
	sampler := &Sampler{
		config:      options,
		serviceName: serviceName,
		doneChan:    make(chan *sync.WaitGroup),
	}
	go sampler.pollController()
	return sampler
}

// ShouldSample returns a sampling choice based on the passed sampling
// parameters.
func (s *Sampler) ShouldSample(p trace.SamplingParameters) trace.SamplingResult {
	s.RLock()
	defer s.RUnlock()
	return s.sampler.ShouldSample(p)
}

// Close does a clean shutdown of the sampler, stopping any background
// go-routines it may have started.
func (s *Sampler) Close() {
	if swapped := atomic.CompareAndSwapInt64(&s.closed, 0, 1); !swapped {
		s.logger.Info("repeated attempt to close the sampler is ignored")
		return
	}

	var wg sync.WaitGroup
	wg.Add(1)
	s.doneChan <- &wg
	wg.Wait()
}

// Description returns a human-readable name for the Sampler.
func (*Sampler) Description() string {
	return "JaegerRemoteSampler{}"
}

func (s *Sampler) pollController() {
	ticker := time.NewTicker(s.samplingRefreshInterval)
	defer ticker.Stop()
	s.pollControllerWithTicker(ticker)
}

func (s *Sampler) pollControllerWithTicker(ticker *time.Ticker) {
	s.UpdateSampler()

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

func (s *Sampler) setSampler(sampler trace.Sampler) {
	s.Lock()
	defer s.Unlock()
	s.sampler = sampler
}

// UpdateSampler forces the sampler to fetch sampling strategy from backend server.
// This function is called automatically on a timer, but can also be safely called manually, e.g. from tests.
func (s *Sampler) UpdateSampler() {
	res, err := s.samplingFetcher.Fetch(s.serviceName)
	if err != nil {
		s.logger.Error(err, "failed to fetch sampling strategy")
		return
	}
	strategy, err := s.samplingParser.Parse(res)
	if err != nil {
		s.logger.Error(err, "failed to parse sampling strategy response")
		return
	}

	s.Lock()
	defer s.Unlock()

	if err := s.updateSamplerViaUpdaters(strategy); err != nil {
		s.logger.Error(err, "failed to handle sampling strategy response", "response", res)
		return
	}
}

// NB: this function should only be called while holding a Write lock.
func (s *Sampler) updateSamplerViaUpdaters(strategy any) error {
	for _, updater := range s.updaters {
		sampler, err := updater.Update(s.sampler, strategy)
		if err != nil {
			return err
		}
		if sampler != nil {
			s.sampler = sampler
			return nil
		}
	}
	return fmt.Errorf("unsupported sampling strategy %+v", strategy)
}

// -----------------------

// probabilisticSamplerUpdater is used by Sampler to parse sampling configuration.
type probabilisticSamplerUpdater struct {
	attributesDisabled bool
}

// Update implements Update of samplerUpdater.
func (u *probabilisticSamplerUpdater) Update(sampler trace.Sampler, strategy any) (trace.Sampler, error) {
	type response interface {
		GetProbabilisticSampling() *jaeger_api_v2.ProbabilisticSamplingStrategy
	}
	var _ response = new(jaeger_api_v2.SamplingStrategyResponse) // sanity signature check
	if resp, ok := strategy.(response); ok {
		if probabilistic := resp.GetProbabilisticSampling(); probabilistic != nil {
			if ps, ok := sampler.(*probabilisticSampler); ok {
				if err := ps.Update(probabilistic.SamplingRate); err != nil {
					return nil, err
				}
				return sampler, nil
			}
			return newProbabilisticSampler(probabilistic.SamplingRate, u.attributesDisabled), nil
		}
	}
	return nil, nil
}

// -----------------------

// rateLimitingSamplerUpdater is used by Sampler to parse sampling configuration.
type rateLimitingSamplerUpdater struct {
	attributesDisabled bool
}

// Update implements Update of samplerUpdater.
func (u *rateLimitingSamplerUpdater) Update(sampler trace.Sampler, strategy any) (trace.Sampler, error) {
	type response interface {
		GetRateLimitingSampling() *jaeger_api_v2.RateLimitingSamplingStrategy
	}
	var _ response = new(jaeger_api_v2.SamplingStrategyResponse) // sanity signature check
	if resp, ok := strategy.(response); ok {
		if rateLimiting := resp.GetRateLimitingSampling(); rateLimiting != nil {
			rateLimit := float64(rateLimiting.MaxTracesPerSecond)
			if rl, ok := sampler.(*rateLimitingSampler); ok {
				rl.Update(rateLimit)
				return rl, nil
			}
			return newRateLimitingSampler(rateLimit, u.attributesDisabled), nil
		}
	}
	return nil, nil
}

// -----------------------

// perOperationSamplerUpdater is used by Sampler to parse sampling configuration.
// Fields have the same meaning as in perOperationSamplerParams.
type perOperationSamplerUpdater struct {
	MaxOperations            int
	OperationNameLateBinding bool
	attributesDisabled       bool
}

// Update implements Update of samplerUpdater.
func (u *perOperationSamplerUpdater) Update(sampler trace.Sampler, strategy any) (trace.Sampler, error) {
	type response interface {
		GetOperationSampling() *jaeger_api_v2.PerOperationSamplingStrategies
	}
	var _ response = new(jaeger_api_v2.SamplingStrategyResponse) // sanity signature check
	if p, ok := strategy.(response); ok {
		if operations := p.GetOperationSampling(); operations != nil {
			if as, ok := sampler.(*perOperationSampler); ok {
				as.update(operations)
				return as, nil
			}
			return newPerOperationSampler(perOperationSamplerParams{
				MaxOperations:            u.MaxOperations,
				OperationNameLateBinding: u.OperationNameLateBinding,
				Strategies:               operations,
			}, u.attributesDisabled), nil
		}
	}
	return nil, nil
}

// -----------------------

type httpSamplingStrategyFetcher struct {
	serverURL  string
	httpClient http.Client
}

func newHTTPSamplingStrategyFetcher(serverURL string) *httpSamplingStrategyFetcher {
	return &httpSamplingStrategyFetcher{
		serverURL: serverURL,
		httpClient: http.Client{
			Timeout: defaultRemoteSamplingTimeout,
		},
	}
}

func (f *httpSamplingStrategyFetcher) Fetch(serviceName string) ([]byte, error) {
	v := url.Values{}
	v.Set("service", serviceName)
	uri := f.serverURL + "?" + v.Encode()

	resp, err := f.httpClient.Get(uri)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("status code: %d, body: %c", resp.StatusCode, body)
	}

	return body, nil
}

// -----------------------

type samplingStrategyParserImpl struct{}

func (*samplingStrategyParserImpl) Parse(response []byte) (any, error) {
	strategy := new(jaeger_api_v2.SamplingStrategyResponse)
	// Official Jaeger Remote Sampling protocol contains enums encoded as strings.
	// Legacy protocol contains enums as numbers.
	// Gogo's jsonpb module can parse either format.
	// Cf. https://github.com/open-telemetry/opentelemetry-go-contrib/issues/3184
	if err := jsonpb.Unmarshal(bytes.NewReader(response), strategy); err != nil {
		return nil, err
	}
	return strategy, nil
}
