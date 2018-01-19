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

package testutils

import (
	"sync"

	"github.com/uber/jaeger-client-go/thrift-gen/sampling"
)

func newSamplingManager() *samplingManager {
	return &samplingManager{
		sampling: make(map[string]*sampling.SamplingStrategyResponse),
	}
}

type samplingManager struct {
	sampling map[string]*sampling.SamplingStrategyResponse
	mutex    sync.Mutex
}

// GetSamplingStrategy implements handler method of sampling.SamplingManager
func (s *samplingManager) GetSamplingStrategy(serviceName string) (*sampling.SamplingStrategyResponse, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if strategy, ok := s.sampling[serviceName]; ok {
		return strategy, nil
	}
	return &sampling.SamplingStrategyResponse{
		StrategyType: sampling.SamplingStrategyType_PROBABILISTIC,
		ProbabilisticSampling: &sampling.ProbabilisticSamplingStrategy{
			SamplingRate: 0.01,
		}}, nil
}

// AddSamplingStrategy registers a sampling strategy for a service
func (s *samplingManager) AddSamplingStrategy(service string, strategy *sampling.SamplingStrategyResponse) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.sampling[service] = strategy
}
