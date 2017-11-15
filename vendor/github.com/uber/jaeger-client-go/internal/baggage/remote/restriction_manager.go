// Copyright (c) 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

package remote

import (
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/uber/jaeger-client-go/internal/baggage"
	thrift "github.com/uber/jaeger-client-go/thrift-gen/baggage"
	"github.com/uber/jaeger-client-go/utils"
)

type httpBaggageRestrictionManagerProxy struct {
	url string
}

func newHTTPBaggageRestrictionManagerProxy(hostPort, serviceName string) *httpBaggageRestrictionManagerProxy {
	v := url.Values{}
	v.Set("service", serviceName)
	return &httpBaggageRestrictionManagerProxy{
		url: fmt.Sprintf("http://%s/baggageRestrictions?%s", hostPort, v.Encode()),
	}
}

func (s *httpBaggageRestrictionManagerProxy) GetBaggageRestrictions(serviceName string) ([]*thrift.BaggageRestriction, error) {
	var out []*thrift.BaggageRestriction
	if err := utils.GetJSON(s.url, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// RestrictionManager manages baggage restrictions by retrieving baggage restrictions from agent
type RestrictionManager struct {
	options

	mux                sync.RWMutex
	serviceName        string
	restrictions       map[string]*baggage.Restriction
	thriftProxy        thrift.BaggageRestrictionManager
	pollStopped        sync.WaitGroup
	stopPoll           chan struct{}
	invalidRestriction *baggage.Restriction
	validRestriction   *baggage.Restriction

	// Determines if the manager has successfully retrieved baggage restrictions from agent
	initialized bool
}

// NewRestrictionManager returns a BaggageRestrictionManager that polls the agent for the latest
// baggage restrictions.
func NewRestrictionManager(serviceName string, options ...Option) *RestrictionManager {
	// TODO there is a developing use case where a single tracer can generate traces on behalf of many services.
	// restrictionsMap will need to exist per service
	opts := applyOptions(options...)
	m := &RestrictionManager{
		serviceName:        serviceName,
		options:            opts,
		restrictions:       make(map[string]*baggage.Restriction),
		thriftProxy:        newHTTPBaggageRestrictionManagerProxy(opts.hostPort, serviceName),
		stopPoll:           make(chan struct{}),
		invalidRestriction: baggage.NewRestriction(false, 0),
		validRestriction:   baggage.NewRestriction(true, defaultMaxValueLength),
	}
	m.pollStopped.Add(1)
	go m.pollManager()
	return m
}

// isReady returns true if the manager has retrieved baggage restrictions from the remote source.
func (m *RestrictionManager) isReady() bool {
	m.mux.RLock()
	defer m.mux.RUnlock()
	return m.initialized
}

// GetRestriction implements RestrictionManager#GetRestriction.
func (m *RestrictionManager) GetRestriction(key string) *baggage.Restriction {
	m.mux.RLock()
	defer m.mux.RUnlock()
	if !m.initialized {
		if m.denyBaggageOnInitializationFailure {
			return m.invalidRestriction
		}
		return m.validRestriction
	}
	if restriction, ok := m.restrictions[key]; ok {
		return restriction
	}
	return m.invalidRestriction
}

// Close stops remote polling and closes the RemoteRestrictionManager.
func (m *RestrictionManager) Close() error {
	close(m.stopPoll)
	m.pollStopped.Wait()
	return nil
}

func (m *RestrictionManager) pollManager() {
	defer m.pollStopped.Done()
	// attempt to initialize baggage restrictions
	if err := m.updateRestrictions(); err != nil {
		m.logger.Error(fmt.Sprintf("Failed to initialize baggage restrictions: %s", err.Error()))
	}
	ticker := time.NewTicker(m.refreshInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := m.updateRestrictions(); err != nil {
				m.logger.Error(fmt.Sprintf("Failed to update baggage restrictions: %s", err.Error()))
			}
		case <-m.stopPoll:
			return
		}
	}
}

func (m *RestrictionManager) updateRestrictions() error {
	restrictions, err := m.thriftProxy.GetBaggageRestrictions(m.serviceName)
	if err != nil {
		m.metrics.BaggageRestrictionsUpdateFailure.Inc(1)
		return err
	}
	newRestrictions := m.parseRestrictions(restrictions)
	m.metrics.BaggageRestrictionsUpdateSuccess.Inc(1)
	m.mux.Lock()
	defer m.mux.Unlock()
	m.initialized = true
	m.restrictions = newRestrictions
	return nil
}

func (m *RestrictionManager) parseRestrictions(restrictions []*thrift.BaggageRestriction) map[string]*baggage.Restriction {
	setters := make(map[string]*baggage.Restriction, len(restrictions))
	for _, restriction := range restrictions {
		setters[restriction.BaggageKey] = baggage.NewRestriction(true, int(restriction.MaxValueLength))
	}
	return setters
}
