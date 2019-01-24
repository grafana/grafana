// Copyright (c) 2018 The Jaeger Authors.
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

package remote

import (
	"fmt"
	"net/url"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pkg/errors"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/utils"
)

const (
	// minimumCredits is the minimum amount of credits necessary to not be throttled.
	// i.e. if currentCredits > minimumCredits, then the operation will not be throttled.
	minimumCredits = 1.0
)

var (
	errorUUIDNotSet = errors.New("Throttler UUID must be set")
)

type operationBalance struct {
	Operation string  `json:"operation"`
	Balance   float64 `json:"balance"`
}

type creditResponse struct {
	Balances []operationBalance `json:"balances"`
}

type httpCreditManagerProxy struct {
	hostPort string
}

func newHTTPCreditManagerProxy(hostPort string) *httpCreditManagerProxy {
	return &httpCreditManagerProxy{
		hostPort: hostPort,
	}
}

// N.B. Operations list must not be empty.
func (m *httpCreditManagerProxy) FetchCredits(uuid, serviceName string, operations []string) (*creditResponse, error) {
	params := url.Values{}
	params.Set("service", serviceName)
	params.Set("uuid", uuid)
	for _, op := range operations {
		params.Add("operations", op)
	}
	var resp creditResponse
	if err := utils.GetJSON(fmt.Sprintf("http://%s/credits?%s", m.hostPort, params.Encode()), &resp); err != nil {
		return nil, errors.Wrap(err, "Failed to receive credits from agent")
	}
	return &resp, nil
}

// Throttler retrieves credits from agent and uses it to throttle operations.
type Throttler struct {
	options

	mux           sync.RWMutex
	service       string
	uuid          atomic.Value
	creditManager *httpCreditManagerProxy
	credits       map[string]float64 // map of operation->credits
	close         chan struct{}
	stopped       sync.WaitGroup
}

// NewThrottler returns a Throttler that polls agent for credits and uses them to throttle
// the service.
func NewThrottler(service string, options ...Option) *Throttler {
	opts := applyOptions(options...)
	creditManager := newHTTPCreditManagerProxy(opts.hostPort)
	t := &Throttler{
		options:       opts,
		creditManager: creditManager,
		service:       service,
		credits:       make(map[string]float64),
		close:         make(chan struct{}),
	}
	t.stopped.Add(1)
	go t.pollManager()
	return t
}

// IsAllowed implements Throttler#IsAllowed.
func (t *Throttler) IsAllowed(operation string) bool {
	t.mux.Lock()
	defer t.mux.Unlock()
	value, ok := t.credits[operation]
	if !ok || value == 0 {
		if !ok {
			// NOTE: This appears to be a no-op at first glance, but it stores
			// the operation key in the map. Necessary for functionality of
			// Throttler#operations method.
			t.credits[operation] = 0
		}
		if !t.synchronousInitialization {
			t.metrics.ThrottledDebugSpans.Inc(1)
			return false
		}
		// If it is the first time this operation is being checked, synchronously fetch
		// the credits.
		credits, err := t.fetchCredits([]string{operation})
		if err != nil {
			// Failed to receive credits from agent, try again next time
			t.logger.Error("Failed to fetch credits: " + err.Error())
			return false
		}
		if len(credits.Balances) == 0 {
			// This shouldn't happen but just in case
			return false
		}
		for _, opBalance := range credits.Balances {
			t.credits[opBalance.Operation] += opBalance.Balance
		}
	}
	return t.isAllowed(operation)
}

// Close stops the throttler from fetching credits from remote.
func (t *Throttler) Close() error {
	close(t.close)
	t.stopped.Wait()
	return nil
}

// SetProcess implements ProcessSetter#SetProcess. It's imperative that the UUID is set before any remote
// requests are made.
func (t *Throttler) SetProcess(process jaeger.Process) {
	if process.UUID != "" {
		t.uuid.Store(process.UUID)
	}
}

// N.B. This function must be called with the Write Lock
func (t *Throttler) isAllowed(operation string) bool {
	credits := t.credits[operation]
	if credits < minimumCredits {
		t.metrics.ThrottledDebugSpans.Inc(1)
		return false
	}
	t.credits[operation] = credits - minimumCredits
	return true
}

func (t *Throttler) pollManager() {
	defer t.stopped.Done()
	ticker := time.NewTicker(t.refreshInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			t.refreshCredits()
		case <-t.close:
			return
		}
	}
}

func (t *Throttler) operations() []string {
	t.mux.RLock()
	defer t.mux.RUnlock()
	operations := make([]string, 0, len(t.credits))
	for op := range t.credits {
		operations = append(operations, op)
	}
	return operations
}

func (t *Throttler) refreshCredits() {
	operations := t.operations()
	if len(operations) == 0 {
		return
	}
	newCredits, err := t.fetchCredits(operations)
	if err != nil {
		t.metrics.ThrottlerUpdateFailure.Inc(1)
		t.logger.Error("Failed to fetch credits: " + err.Error())
		return
	}
	t.metrics.ThrottlerUpdateSuccess.Inc(1)

	t.mux.Lock()
	defer t.mux.Unlock()
	for _, opBalance := range newCredits.Balances {
		t.credits[opBalance.Operation] += opBalance.Balance
	}
}

func (t *Throttler) fetchCredits(operations []string) (*creditResponse, error) {
	uuid := t.uuid.Load()
	uuidStr, _ := uuid.(string)
	if uuid == nil || uuidStr == "" {
		return nil, errorUUIDNotSet
	}
	return t.creditManager.FetchCredits(uuidStr, t.service, operations)
}
