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
	"time"

	"github.com/uber/jaeger-client-go/log"
)

// SamplerOption is a function that sets some option on the sampler
type SamplerOption func(options *samplerOptions)

// SamplerOptions is a factory for all available SamplerOption's.
var SamplerOptions SamplerOptionsFactory

// SamplerOptionsFactory is a factory for all available SamplerOption's.
// The type acts as a namespace for factory functions. It is public to
// make the functions discoverable via godoc. Recommended to be used
// via global SamplerOptions variable.
type SamplerOptionsFactory struct{}

type samplerOptions struct {
	metrics                 *Metrics
	sampler                 SamplerV2
	logger                  Logger
	samplingServerURL       string
	samplingRefreshInterval time.Duration
	samplingFetcher         SamplingStrategyFetcher
	samplingParser          SamplingStrategyParser
	updaters                []SamplerUpdater
	posParams               PerOperationSamplerParams
}

// Metrics creates a SamplerOption that initializes Metrics on the sampler,
// which is used to emit statistics.
func (SamplerOptionsFactory) Metrics(m *Metrics) SamplerOption {
	return func(o *samplerOptions) {
		o.metrics = m
	}
}

// MaxOperations creates a SamplerOption that sets the maximum number of
// operations the sampler will keep track of.
func (SamplerOptionsFactory) MaxOperations(maxOperations int) SamplerOption {
	return func(o *samplerOptions) {
		o.posParams.MaxOperations = maxOperations
	}
}

// OperationNameLateBinding creates a SamplerOption that sets the respective
// field in the PerOperationSamplerParams.
func (SamplerOptionsFactory) OperationNameLateBinding(enable bool) SamplerOption {
	return func(o *samplerOptions) {
		o.posParams.OperationNameLateBinding = enable
	}
}

// InitialSampler creates a SamplerOption that sets the initial sampler
// to use before a remote sampler is created and used.
func (SamplerOptionsFactory) InitialSampler(sampler Sampler) SamplerOption {
	return func(o *samplerOptions) {
		o.sampler = samplerV1toV2(sampler)
	}
}

// Logger creates a SamplerOption that sets the logger used by the sampler.
func (SamplerOptionsFactory) Logger(logger Logger) SamplerOption {
	return func(o *samplerOptions) {
		o.logger = logger
	}
}

// SamplingServerURL creates a SamplerOption that sets the sampling server url
// of the local agent that contains the sampling strategies.
func (SamplerOptionsFactory) SamplingServerURL(samplingServerURL string) SamplerOption {
	return func(o *samplerOptions) {
		o.samplingServerURL = samplingServerURL
	}
}

// SamplingRefreshInterval creates a SamplerOption that sets how often the
// sampler will poll local agent for the appropriate sampling strategy.
func (SamplerOptionsFactory) SamplingRefreshInterval(samplingRefreshInterval time.Duration) SamplerOption {
	return func(o *samplerOptions) {
		o.samplingRefreshInterval = samplingRefreshInterval
	}
}

// SamplingStrategyFetcher creates a SamplerOption that initializes sampling strategy fetcher.
func (SamplerOptionsFactory) SamplingStrategyFetcher(fetcher SamplingStrategyFetcher) SamplerOption {
	return func(o *samplerOptions) {
		o.samplingFetcher = fetcher
	}
}

// SamplingStrategyParser creates a SamplerOption that initializes sampling strategy parser.
func (SamplerOptionsFactory) SamplingStrategyParser(parser SamplingStrategyParser) SamplerOption {
	return func(o *samplerOptions) {
		o.samplingParser = parser
	}
}

// Updaters creates a SamplerOption that initializes sampler updaters.
func (SamplerOptionsFactory) Updaters(updaters ...SamplerUpdater) SamplerOption {
	return func(o *samplerOptions) {
		o.updaters = updaters
	}
}

func (o *samplerOptions) applyOptionsAndDefaults(opts ...SamplerOption) *samplerOptions {
	for _, option := range opts {
		option(o)
	}
	if o.sampler == nil {
		o.sampler = newProbabilisticSampler(0.001)
	}
	if o.logger == nil {
		o.logger = log.NullLogger
	}
	if o.samplingServerURL == "" {
		o.samplingServerURL = DefaultSamplingServerURL
	}
	if o.metrics == nil {
		o.metrics = NewNullMetrics()
	}
	if o.samplingRefreshInterval <= 0 {
		o.samplingRefreshInterval = defaultSamplingRefreshInterval
	}
	if o.samplingFetcher == nil {
		o.samplingFetcher = &httpSamplingStrategyFetcher{
			serverURL: o.samplingServerURL,
			logger:    o.logger,
		}
	}
	if o.samplingParser == nil {
		o.samplingParser = new(samplingStrategyParser)
	}
	if o.updaters == nil {
		o.updaters = []SamplerUpdater{
			&AdaptiveSamplerUpdater{
				MaxOperations:            o.posParams.MaxOperations,
				OperationNameLateBinding: o.posParams.OperationNameLateBinding,
			},
			new(ProbabilisticSamplerUpdater),
			new(RateLimitingSamplerUpdater),
		}
	}
	return o
}
