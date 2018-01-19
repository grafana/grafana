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
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"

	"github.com/apache/thrift/lib/go/thrift"

	"github.com/uber/jaeger-client-go/thrift-gen/agent"
	"github.com/uber/jaeger-client-go/thrift-gen/jaeger"
	"github.com/uber/jaeger-client-go/thrift-gen/sampling"
	"github.com/uber/jaeger-client-go/thrift-gen/zipkincore"
	"github.com/uber/jaeger-client-go/utils"
)

// StartMockAgent runs a mock representation of jaeger-agent.
// This function returns a started server.
func StartMockAgent() (*MockAgent, error) {
	transport, err := NewTUDPServerTransport("127.0.0.1:0")
	if err != nil {
		return nil, err
	}

	samplingManager := newSamplingManager()
	samplingHandler := &samplingHandler{manager: samplingManager}
	samplingServer := httptest.NewServer(samplingHandler)

	agent := &MockAgent{
		transport:   transport,
		samplingMgr: samplingManager,
		samplingSrv: samplingServer,
	}

	var started sync.WaitGroup
	started.Add(1)
	go agent.serve(&started)
	started.Wait()

	return agent, nil
}

// Close stops the serving of traffic
func (s *MockAgent) Close() {
	atomic.StoreUint32(&s.serving, 0)
	s.transport.Close()
	s.samplingSrv.Close()
}

// MockAgent is a mock representation of Jaeger Agent.
// It receives spans over UDP, and has an HTTP endpoint for sampling strategies.
type MockAgent struct {
	transport     *TUDPTransport
	jaegerBatches []*jaeger.Batch
	mutex         sync.Mutex
	serving       uint32
	samplingMgr   *samplingManager
	samplingSrv   *httptest.Server
}

// SpanServerAddr returns the UDP host:port where MockAgent listens for spans
func (s *MockAgent) SpanServerAddr() string {
	return s.transport.Addr().String()
}

// SpanServerClient returns a UDP client that can be used to send spans to the MockAgent
func (s *MockAgent) SpanServerClient() (agent.Agent, error) {
	return utils.NewAgentClientUDP(s.SpanServerAddr(), 0)
}

// SamplingServerAddr returns the host:port of HTTP server exposing sampling strategy endpoint
func (s *MockAgent) SamplingServerAddr() string {
	return s.samplingSrv.Listener.Addr().String()
}

func (s *MockAgent) serve(started *sync.WaitGroup) {
	handler := agent.NewAgentProcessor(s)
	protocolFact := thrift.NewTCompactProtocolFactory()
	buf := make([]byte, utils.UDPPacketMaxLength, utils.UDPPacketMaxLength)
	trans := thrift.NewTMemoryBufferLen(utils.UDPPacketMaxLength)

	atomic.StoreUint32(&s.serving, 1)
	started.Done()
	for s.IsServing() {
		n, err := s.transport.Read(buf)
		if err == nil {
			trans.Write(buf[:n])
			protocol := protocolFact.GetProtocol(trans)
			handler.Process(protocol, protocol)
		}
	}
}

// EmitZipkinBatch is deprecated, use EmitBatch
func (s *MockAgent) EmitZipkinBatch(spans []*zipkincore.Span) (err error) {
	// TODO remove this for 3.0.0
	return errors.New("Not implemented")
}

// GetZipkinSpans is deprecated use GetJaegerBatches
func (s *MockAgent) GetZipkinSpans() []*zipkincore.Span {
	return nil
}

// ResetZipkinSpans is deprecated use ResetJaegerBatches
func (s *MockAgent) ResetZipkinSpans() {}

// EmitBatch implements EmitBatch() of TChanSamplingManagerServer
func (s *MockAgent) EmitBatch(batch *jaeger.Batch) (err error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.jaegerBatches = append(s.jaegerBatches, batch)
	return err
}

// IsServing indicates whether the server is currently serving traffic
func (s *MockAgent) IsServing() bool {
	return atomic.LoadUint32(&s.serving) == 1
}

// AddSamplingStrategy registers a sampling strategy for a service
func (s *MockAgent) AddSamplingStrategy(service string, strategy *sampling.SamplingStrategyResponse) {
	s.samplingMgr.AddSamplingStrategy(service, strategy)
}

// GetJaegerBatches returns accumulated Jaeger batches
func (s *MockAgent) GetJaegerBatches() []*jaeger.Batch {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	n := len(s.jaegerBatches)
	batches := make([]*jaeger.Batch, n, n)
	copy(batches, s.jaegerBatches)
	return batches
}

// ResetJaegerBatches discards accumulated Jaeger batches
func (s *MockAgent) ResetJaegerBatches() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.jaegerBatches = nil
}

type samplingHandler struct {
	manager *samplingManager
}

func (h *samplingHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	services := r.URL.Query()["service"]
	if len(services) == 0 {
		http.Error(w, "'service' parameter is empty", http.StatusBadRequest)
		return
	}
	if len(services) > 1 {
		http.Error(w, "'service' parameter must occur only once", http.StatusBadRequest)
		return
	}
	resp, err := h.manager.GetSamplingStrategy(services[0])
	if err != nil {
		http.Error(w, fmt.Sprintf("Error retrieving strategy: %+v", err), http.StatusInternalServerError)
		return
	}
	json, err := json.Marshal(resp)
	if err != nil {
		http.Error(w, "Cannot marshall Thrift to JSON", http.StatusInternalServerError)
		return
	}
	w.Header().Add("Content-Type", "application/json")
	if _, err := w.Write(json); err != nil {
		return
	}
}
