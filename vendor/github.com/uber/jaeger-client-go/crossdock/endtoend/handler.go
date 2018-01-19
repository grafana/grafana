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

package endtoend

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/opentracing/opentracing-go"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/config"
	"github.com/uber/jaeger-client-go/crossdock/common"
	"github.com/uber/jaeger-client-go/crossdock/log"
)

var (
	defaultSamplerType = jaeger.SamplerTypeRemote

	endToEndConfig = config.Configuration{
		Disabled: false,
		Sampler: &config.SamplerConfig{
			Type:  defaultSamplerType,
			Param: 1.0,
			SamplingRefreshInterval: 5 * time.Second,
		},
		Reporter: &config.ReporterConfig{
			BufferFlushInterval: time.Second,
		},
	}
)

/*Handler handles creating traces from a http request.
 *
 * json: {
 *   "type": "remote",
 *   "operation": "operationName",
 *   "count": 2,
 *   "tags": {
 *     "key": "value"
 *   }
 * }
 *
 * Given the above json payload, the handler will use a tracer with the RemotelyControlledSampler
 * to create 2 traces for "operationName" operation with the tags: {"key":"value"}. These traces
 * are reported to the agent with the hostname "test_driver".
 */
type Handler struct {
	sync.RWMutex

	tracers           map[string]opentracing.Tracer
	agentHostPort     string
	samplingServerURL string
}

type traceRequest struct {
	Type      string            `json:"type"`
	Operation string            `json:"operation"`
	Tags      map[string]string `json:"tags"`
	Count     int               `json:"count"`
}

// NewHandler returns a Handler.
func NewHandler(agentHostPort string, samplingServerURL string) *Handler {
	return &Handler{
		agentHostPort:     agentHostPort,
		samplingServerURL: samplingServerURL,
		tracers:           make(map[string]opentracing.Tracer),
	}
}

// init initializes the handler with a tracer
func (h *Handler) init(cfg config.Configuration) error {
	if cfg.Sampler != nil && cfg.Sampler.SamplingServerURL == "" {
		cfg.Sampler.SamplingServerURL = h.samplingServerURL
	}
	if cfg.Reporter != nil && cfg.Reporter.LocalAgentHostPort == "" {
		cfg.Reporter.LocalAgentHostPort = h.agentHostPort
	}
	tracer, _, err := cfg.New(common.DefaultTracerServiceName)
	if err != nil {
		return err
	}
	h.tracers[cfg.Sampler.Type] = tracer
	return nil
}

func (h *Handler) getTracer(samplerType string) opentracing.Tracer {
	if samplerType == "" {
		samplerType = defaultSamplerType
	}
	h.Lock()
	defer h.Unlock()
	tracer, ok := h.tracers[samplerType]
	if !ok {
		endToEndConfig.Sampler.Type = samplerType
		if err := h.init(endToEndConfig); err != nil {
			log.Printf("Failed to create tracer: %s", err.Error())
			return nil
		}
		tracer, _ = h.tracers[samplerType]
	}
	return tracer
}

// GenerateTraces creates traces given the parameters in the request.
func (h *Handler) GenerateTraces(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	var req traceRequest
	if err := decoder.Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("JSON payload is invalid: %s", err.Error()), http.StatusBadRequest)
		return
	}
	tracer := h.getTracer(req.Type)
	if tracer == nil {
		http.Error(w, "Tracer is not initialized", http.StatusInternalServerError)
		return
	}
	generateTraces(tracer, &req)
}

func generateTraces(tracer opentracing.Tracer, r *traceRequest) {
	for i := 0; i < r.Count; i++ {
		span := tracer.StartSpan(r.Operation)
		for k, v := range r.Tags {
			span.SetTag(k, v)
		}
		span.Finish()
	}
}
