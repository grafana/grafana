package kv

import (
	"context"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"go.uber.org/atomic"
)

// The mockClient does not anything.
// This is used for testing only.
type mockClient struct{}

func buildMockClient(logger log.Logger) (Client, error) {
	level.Warn(logger).Log("msg", "created mockClient for testing only")
	return mockClient{}, nil
}

func (m mockClient) List(_ context.Context, _ string) ([]string, error) {
	return []string{}, nil
}

func (m mockClient) Get(_ context.Context, _ string) (interface{}, error) {
	return "", nil
}

func (m mockClient) Delete(_ context.Context, _ string) error {
	return nil
}

func (m mockClient) CAS(_ context.Context, _ string, _ func(in interface{}) (out interface{}, retry bool, err error)) error {
	return nil
}

func (m mockClient) WatchKey(_ context.Context, _ string, _ func(interface{}) bool) {
}

func (m mockClient) WatchPrefix(_ context.Context, _ string, _ func(string, interface{}) bool) {
}

// MockCountingClient is a wrapper around the Client interface that counts the number of times its functions are called.
// This is used for testing only.
type MockCountingClient struct {
	client Client

	ListCalls        *atomic.Uint32
	GetCalls         *atomic.Uint32
	DeleteCalls      *atomic.Uint32
	CASCalls         *atomic.Uint32
	WatchKeyCalls    *atomic.Uint32
	WatchPrefixCalls *atomic.Uint32
}

func NewMockCountingClient(client Client) *MockCountingClient {
	return &MockCountingClient{
		client:           client,
		ListCalls:        atomic.NewUint32(0),
		GetCalls:         atomic.NewUint32(0),
		DeleteCalls:      atomic.NewUint32(0),
		CASCalls:         atomic.NewUint32(0),
		WatchKeyCalls:    atomic.NewUint32(0),
		WatchPrefixCalls: atomic.NewUint32(0),
	}
}

func (mc *MockCountingClient) List(ctx context.Context, prefix string) ([]string, error) {
	mc.ListCalls.Inc()

	return mc.client.List(ctx, prefix)
}
func (mc *MockCountingClient) Get(ctx context.Context, key string) (interface{}, error) {
	mc.GetCalls.Inc()

	return mc.client.Get(ctx, key)
}

func (mc *MockCountingClient) Delete(ctx context.Context, key string) error {
	mc.DeleteCalls.Inc()

	return mc.client.Delete(ctx, key)
}

func (mc *MockCountingClient) CAS(ctx context.Context, key string, f func(in interface{}) (out interface{}, retry bool, err error)) error {
	mc.CASCalls.Inc()

	return mc.client.CAS(ctx, key, f)
}

func (mc *MockCountingClient) WatchKey(ctx context.Context, key string, f func(interface{}) bool) {
	mc.WatchKeyCalls.Inc()

	mc.client.WatchKey(ctx, key, f)
}

func (mc *MockCountingClient) WatchPrefix(ctx context.Context, key string, f func(string, interface{}) bool) {
	mc.WatchPrefixCalls.Inc()

	mc.client.WatchPrefix(ctx, key, f)
}
