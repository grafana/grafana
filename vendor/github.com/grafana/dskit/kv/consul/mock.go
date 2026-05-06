package consul

import (
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	consul "github.com/hashicorp/consul/api"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/dskit/kv/codec"
)

// The max wait time allowed for mockKV operations, in order to have faster tests.
const maxWaitTime = 100 * time.Millisecond

type mockKV struct {
	mtx     sync.Mutex
	cond    *sync.Cond
	kvps    map[string]*consul.KVPair
	current uint64 // the current 'index in the log'
	logger  log.Logger

	// Channel closed once the in-memory consul mock should be closed.
	close   chan struct{}
	closeWG sync.WaitGroup
}

// NewInMemoryClient makes a new mock consul client.
func NewInMemoryClient(codec codec.Codec, logger log.Logger, registerer prometheus.Registerer) (*Client, io.Closer) {
	return NewInMemoryClientWithConfig(codec, Config{}, logger, registerer)
}

// NewInMemoryClientWithConfig makes a new mock consul client with supplied Config.
func NewInMemoryClientWithConfig(codec codec.Codec, cfg Config, logger log.Logger, registerer prometheus.Registerer) (*Client, io.Closer) {
	m := mockKV{
		kvps: map[string]*consul.KVPair{},
		// Always start from 1, we NEVER want to report back index 0 in the responses.
		// This is in line with Consul, and our new checks for index return value in client.go.
		current: 1,
		logger:  logger,
		close:   make(chan struct{}),
	}
	m.cond = sync.NewCond(&m.mtx)

	// Create a closer function used to close the main loop and wait until it's done.
	// We need to wait until done, otherwise the goroutine leak finder used in tests
	// may still report it as leaked.
	closer := closerFunc(func() error {
		close(m.close)
		m.closeWG.Wait()
		return nil
	})

	// Start the main loop in a dedicated goroutine.
	m.closeWG.Add(1)
	go m.loop()

	return &Client{
		kv:            &m,
		codec:         codec,
		cfg:           cfg,
		logger:        logger,
		consulMetrics: newConsulMetrics(registerer),
	}, closer
}

type closerFunc func() error

func (c closerFunc) Close() error {
	return c()
}

func copyKVPair(in *consul.KVPair) *consul.KVPair {
	out := *in
	out.Value = make([]byte, len(in.Value))
	copy(out.Value, in.Value)
	return &out
}

// periodic loop to wake people up, so they can honour timeouts
func (m *mockKV) loop() {
	defer m.closeWG.Done()

	for {
		select {
		case <-m.close:
			return
		case <-time.After(maxWaitTime):
			m.mtx.Lock()
			m.cond.Broadcast()
			m.mtx.Unlock()
		}
	}
}

func (m *mockKV) Put(p *consul.KVPair, _ *consul.WriteOptions) (*consul.WriteMeta, error) {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	m.current++
	existing, ok := m.kvps[p.Key]
	if ok {
		existing.Value = p.Value
		existing.ModifyIndex = m.current
	} else {
		m.kvps[p.Key] = &consul.KVPair{
			Key:         p.Key,
			Value:       p.Value,
			CreateIndex: m.current,
			ModifyIndex: m.current,
		}
	}

	m.cond.Broadcast()

	level.Debug(m.logger).Log("msg", "Put", "key", p.Key, "value", fmt.Sprintf("%.40q", p.Value), "modify_index", m.current)
	return nil, nil
}

func (m *mockKV) CAS(p *consul.KVPair, _ *consul.WriteOptions) (bool, *consul.WriteMeta, error) {
	level.Debug(m.logger).Log("msg", "CAS", "key", p.Key, "modify_index", p.ModifyIndex, "value", fmt.Sprintf("%.40q", p.Value))

	m.mtx.Lock()
	defer m.mtx.Unlock()
	existing, ok := m.kvps[p.Key]
	if ok && existing.ModifyIndex != p.ModifyIndex {
		return false, nil, nil
	}

	m.current++
	if ok {
		existing.Value = p.Value
		existing.ModifyIndex = m.current
	} else {
		m.kvps[p.Key] = &consul.KVPair{
			Key:         p.Key,
			Value:       p.Value,
			CreateIndex: m.current,
			ModifyIndex: m.current,
		}
	}

	m.cond.Broadcast()
	return true, nil, nil
}

func (m *mockKV) Get(key string, q *consul.QueryOptions) (*consul.KVPair, *consul.QueryMeta, error) {
	level.Debug(m.logger).Log("msg", "Get", "key", key, "wait_index", q.WaitIndex)

	m.mtx.Lock()
	defer m.mtx.Unlock()

	value := m.kvps[key]
	if value == nil && q.WaitIndex == 0 {
		level.Debug(m.logger).Log("msg", "Get - not found", "key", key)
		return nil, &consul.QueryMeta{LastIndex: m.current}, nil
	}

	var valueModifyIndex uint64
	if value != nil {
		valueModifyIndex = value.ModifyIndex
	} else {
		valueModifyIndex = m.current
	}

	if q.WaitIndex >= valueModifyIndex && q.WaitTime > 0 {
		deadline := time.Now().Add(mockedMaxWaitTime(q.WaitTime))
		if ctxDeadline, ok := q.Context().Deadline(); ok && ctxDeadline.Before(deadline) {
			// respect deadline from context, if set.
			deadline = ctxDeadline
		}

		// simply wait until value.ModifyIndex changes. This allows us to test reporting old index values by resetting them.
		startModify := valueModifyIndex
		for startModify == valueModifyIndex && time.Now().Before(deadline) {
			m.cond.Wait()
			value = m.kvps[key]

			if value != nil {
				valueModifyIndex = value.ModifyIndex
			}
		}
		if time.Now().After(deadline) {
			level.Debug(m.logger).Log("msg", "Get - deadline exceeded", "key", key)
			return nil, &consul.QueryMeta{LastIndex: q.WaitIndex}, nil
		}
	}

	if value == nil {
		level.Debug(m.logger).Log("msg", "Get - not found", "key", key)
		return nil, &consul.QueryMeta{LastIndex: m.current}, nil
	}

	level.Debug(m.logger).Log("msg", "Get", "key", key, "modify_index", value.ModifyIndex, "value", fmt.Sprintf("%.40q", value.Value))
	return copyKVPair(value), &consul.QueryMeta{LastIndex: value.ModifyIndex}, nil
}

func (m *mockKV) List(prefix string, q *consul.QueryOptions) (consul.KVPairs, *consul.QueryMeta, error) {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	if q.WaitTime > 0 {
		deadline := time.Now().Add(mockedMaxWaitTime(q.WaitTime))
		if ctxDeadline, ok := q.Context().Deadline(); ok && ctxDeadline.Before(deadline) {
			// respect deadline from context, if set.
			deadline = ctxDeadline
		}

		for q.WaitIndex >= m.current && time.Now().Before(deadline) {
			m.cond.Wait()
		}
		if time.Now().After(deadline) {
			return nil, &consul.QueryMeta{LastIndex: q.WaitIndex}, nil
		}
	}

	result := consul.KVPairs{}
	for _, kvp := range m.kvps {
		if strings.HasPrefix(kvp.Key, prefix) && kvp.ModifyIndex >= q.WaitIndex {
			// unfortunately real consul doesn't do index check and returns everything with given prefix.
			result = append(result, copyKVPair(kvp))
		}
	}
	return result, &consul.QueryMeta{LastIndex: m.current}, nil
}

func (m *mockKV) Delete(key string, _ *consul.WriteOptions) (*consul.WriteMeta, error) {
	m.mtx.Lock()
	defer m.mtx.Unlock()
	delete(m.kvps, key)
	return nil, nil
}

func (m *mockKV) ResetIndex() {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	m.current = 0
	m.cond.Broadcast()

	level.Debug(m.logger).Log("msg", "Reset")
}

func (m *mockKV) ResetIndexForKey(key string) {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	if value, ok := m.kvps[key]; ok {
		value.ModifyIndex = 0
	}

	m.cond.Broadcast()
	level.Debug(m.logger).Log("msg", "ResetIndexForKey", "key", key)
}

// mockedMaxWaitTime returns the minimum duration between the input duration
// and the max wait time allowed in this mock, in order to have faster tests.
func mockedMaxWaitTime(queryWaitTime time.Duration) time.Duration {
	if queryWaitTime > maxWaitTime {
		return maxWaitTime
	}

	return queryWaitTime
}
