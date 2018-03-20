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
)

// SamplerOption is a function that sets some option on the sampler
type SamplerOption func(options *samplerOptions)

// SamplerOptions is a factory for all available SamplerOption's
var SamplerOptions samplerOptions

type samplerOptions struct {
	metrics                 *Metrics
	maxOperations           int
	sampler                 Sampler
	logger                  Logger
	samplingServerURL       string
	samplingRefreshInterval time.Duration
}

// Metrics creates a SamplerOption that initializes Metrics on the sampler,
// which is used to emit statistics.
func (samplerOptions) Metrics(m *Metrics) SamplerOption {
	return func(o *samplerOptions) {
		o.metrics = m
	}
}

// MaxOperations creates a SamplerOption that sets the maximum number of
// operations the sampler will keep track of.
func (samplerOptions) MaxOperations(maxOperations int) SamplerOption {
	return func(o *samplerOptions) {
		o.maxOperations = maxOperations
	}
}

// InitialSampler creates a SamplerOption that sets the initial sampler
// to use before a remote sampler is created and used.
func (samplerOptions) InitialSampler(sampler Sampler) SamplerOption {
	return func(o *samplerOptions) {
		o.sampler = sampler
	}
}

// Logger creates a SamplerOption that sets the logger used by the sampler.
func (samplerOptions) Logger(logger Logger) SamplerOption {
	return func(o *samplerOptions) {
		o.logger = logger
	}
}

// SamplingServerURL creates a SamplerOption that sets the sampling server url
// of the local agent that contains the sampling strategies.
func (samplerOptions) SamplingServerURL(samplingServerURL string) SamplerOption {
	return func(o *samplerOptions) {
		o.samplingServerURL = samplingServerURL
	}
}

// SamplingRefreshInterval creates a SamplerOption that sets how often the
// sampler will poll local agent for the appropriate sampling strategy.
func (samplerOptions) SamplingRefreshInterval(samplingRefreshInterval time.Duration) SamplerOption {
	return func(o *samplerOptions) {
		o.samplingRefreshInterval = samplingRefreshInterval
	}
}
