package kv

import (
	"context"
	"flag"
	"fmt"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.uber.org/atomic"
)

// MultiConfig is a configuration for MultiClient.
type MultiConfig struct {
	Primary   string `yaml:"primary" category:"advanced"`
	Secondary string `yaml:"secondary" category:"advanced"`

	MirrorEnabled bool          `yaml:"mirror_enabled" category:"advanced"`
	MirrorTimeout time.Duration `yaml:"mirror_timeout" category:"advanced"`

	// ConfigProvider returns channel with MultiRuntimeConfig updates.
	ConfigProvider func() <-chan MultiRuntimeConfig `yaml:"-"`
}

// RegisterFlagsWithPrefix registers flags with prefix.
func (cfg *MultiConfig) RegisterFlagsWithPrefix(f *flag.FlagSet, prefix string) {
	f.StringVar(&cfg.Primary, prefix+"multi.primary", "", "Primary backend storage used by multi-client.")
	f.StringVar(&cfg.Secondary, prefix+"multi.secondary", "", "Secondary backend storage used by multi-client.")
	f.BoolVar(&cfg.MirrorEnabled, prefix+"multi.mirror-enabled", false, "Mirror writes to secondary store.")
	f.DurationVar(&cfg.MirrorTimeout, prefix+"multi.mirror-timeout", 2*time.Second, "Timeout for storing value to secondary store.")
}

// MultiRuntimeConfig has values that can change in runtime (via overrides)
type MultiRuntimeConfig struct {
	// Primary store used by MultiClient. Can be updated in runtime to switch to a different store (eg. consul -> etcd,
	// or to gossip). Doing this allows nice migration between stores. Empty values are ignored.
	PrimaryStore string `yaml:"primary"`

	// Mirroring enabled or not. Nil = no change.
	Mirroring *bool `yaml:"mirror_enabled"`
}

type kvclient struct {
	client Client
	name   string
}

type clientInProgress struct {
	client int
	cancel context.CancelFunc
}

// MultiClient implements kv.Client by forwarding all API calls to primary client.
// Writes performed via CAS method are also (optionally) forwarded to secondary clients.
type MultiClient struct {
	// Available KV clients
	clients []kvclient

	mirrorTimeout    time.Duration
	mirroringEnabled *atomic.Bool

	// logger with "multikv" component
	logger log.Logger

	// The primary client used for interaction.
	primaryID *atomic.Int32

	cancel context.CancelFunc

	inProgressMu sync.Mutex
	// Cancel functions for ongoing operations. key is a value from inProgressCnt.
	// What we really need is a []context.CancelFunc, but functions cannot be compared against each other using ==,
	// so we use this map instead.
	inProgress    map[int]clientInProgress
	inProgressCnt int

	primaryStoreGauge     *prometheus.GaugeVec
	mirrorEnabledGauge    prometheus.Gauge
	mirrorWritesCounter   prometheus.Counter
	mirrorFailuresCounter prometheus.Counter
}

// NewMultiClient creates new MultiClient with given KV Clients.
// First client in the slice is the primary client.
func NewMultiClient(cfg MultiConfig, clients []kvclient, logger log.Logger, registerer prometheus.Registerer) *MultiClient {
	c := &MultiClient{
		clients:    clients,
		primaryID:  atomic.NewInt32(0),
		inProgress: map[int]clientInProgress{},

		mirrorTimeout:    cfg.MirrorTimeout,
		mirroringEnabled: atomic.NewBool(cfg.MirrorEnabled),

		logger: log.With(logger, "component", "multikv"),
	}

	c.registerMetrics(registerer)
	c.updatePrimaryStoreGauge()
	c.updateMirrorEnabledGauge()

	ctx, cancelFn := context.WithCancel(context.Background())
	c.cancel = cancelFn

	if cfg.ConfigProvider != nil {
		go c.watchConfigChannel(ctx, cfg.ConfigProvider())
	}

	return c
}

func (m *MultiClient) watchConfigChannel(ctx context.Context, configChannel <-chan MultiRuntimeConfig) {
	for {
		select {
		case cfg, ok := <-configChannel:
			if !ok {
				return
			}

			if cfg.Mirroring != nil {
				enabled := *cfg.Mirroring
				old := m.mirroringEnabled.Swap(enabled)
				if old != enabled {
					level.Info(m.logger).Log("msg", "toggled mirroring", "enabled", enabled)
				}
				m.updateMirrorEnabledGauge()
			}

			if cfg.PrimaryStore != "" {
				switched, err := m.setNewPrimaryClient(cfg.PrimaryStore)
				if switched {
					level.Info(m.logger).Log("msg", "switched primary KV store", "primary", cfg.PrimaryStore)
				}
				if err != nil {
					level.Error(m.logger).Log("msg", "failed to switch primary KV store", "primary", cfg.PrimaryStore, "err", err)
				}
			}

		case <-ctx.Done():
			return
		}
	}
}

func (m *MultiClient) getPrimaryClient() (int, kvclient) {
	v := m.primaryID.Load()
	return int(v), m.clients[v]
}

// returns true, if primary client has changed
func (m *MultiClient) setNewPrimaryClient(store string) (bool, error) {
	newPrimaryIx := -1
	for ix, c := range m.clients {
		if c.name == store {
			newPrimaryIx = ix
			break
		}
	}

	if newPrimaryIx < 0 {
		return false, fmt.Errorf("KV store not found")
	}

	prev := int(m.primaryID.Swap(int32(newPrimaryIx)))
	if prev == newPrimaryIx {
		return false, nil
	}

	defer m.updatePrimaryStoreGauge() // do as the last thing, after releasing the lock

	// switching to new primary... cancel clients using previous one
	m.inProgressMu.Lock()
	defer m.inProgressMu.Unlock()

	for _, inp := range m.inProgress {
		if inp.client == prev {
			inp.cancel()
		}
	}
	return true, nil
}

func (m *MultiClient) registerMetrics(registerer prometheus.Registerer) {
	m.primaryStoreGauge = promauto.With(registerer).NewGaugeVec(prometheus.GaugeOpts{
		Name: "multikv_primary_store",
		Help: "Selected primary KV store",
	}, []string{"store"})

	m.mirrorEnabledGauge = promauto.With(registerer).NewGauge(prometheus.GaugeOpts{
		Name: "multikv_mirror_enabled",
		Help: "Is mirroring to secondary store enabled",
	})

	m.mirrorWritesCounter = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Name: "multikv_mirror_writes_total",
		Help: "Number of mirror-writes to secondary store",
	})

	m.mirrorFailuresCounter = promauto.With(registerer).NewCounter(prometheus.CounterOpts{
		Name: "multikv_mirror_write_errors_total",
		Help: "Number of failures to mirror-write to secondary store",
	})
}

func (m *MultiClient) updatePrimaryStoreGauge() {
	_, pkv := m.getPrimaryClient()

	for _, kv := range m.clients {
		value := float64(0)
		if pkv == kv {
			value = 1
		}

		m.primaryStoreGauge.WithLabelValues(kv.name).Set(value)
	}
}

func (m *MultiClient) updateMirrorEnabledGauge() {
	if m.mirroringEnabled.Load() {
		m.mirrorEnabledGauge.Set(1)
	} else {
		m.mirrorEnabledGauge.Set(0)
	}
}

func (m *MultiClient) registerCancelFn(clientID int, fn context.CancelFunc) int {
	m.inProgressMu.Lock()
	defer m.inProgressMu.Unlock()

	m.inProgressCnt++
	id := m.inProgressCnt
	m.inProgress[id] = clientInProgress{client: clientID, cancel: fn}
	return id
}

func (m *MultiClient) unregisterCancelFn(id int) {
	m.inProgressMu.Lock()
	defer m.inProgressMu.Unlock()

	delete(m.inProgress, id)
}

// Runs supplied fn with current primary client. If primary client changes, fn is restarted.
// When fn finishes (with or without error), this method returns given error value.
func (m *MultiClient) runWithPrimaryClient(origCtx context.Context, fn func(newCtx context.Context, primary kvclient) error) error {
	cancelFn := context.CancelFunc(nil)
	cancelFnID := 0

	cleanup := func() {
		if cancelFn != nil {
			cancelFn()
		}
		if cancelFnID > 0 {
			m.unregisterCancelFn(cancelFnID)
		}
	}

	defer cleanup()

	// This only loops if switchover to a new primary backend happens while calling 'fn', which is very rare.
	for {
		cleanup()
		pid, kv := m.getPrimaryClient()

		var cancelCtx context.Context
		cancelCtx, cancelFn = context.WithCancel(origCtx)
		cancelFnID = m.registerCancelFn(pid, cancelFn)

		err := fn(cancelCtx, kv)

		if err == nil {
			return nil
		}

		if cancelCtx.Err() == context.Canceled && origCtx.Err() == nil {
			// our context was cancelled, but outer context is not done yet. retry
			continue
		}

		return err
	}
}

// List is a part of the kv.Client interface.
func (m *MultiClient) List(ctx context.Context, prefix string) ([]string, error) {
	_, kv := m.getPrimaryClient()
	return kv.client.List(ctx, prefix)
}

// Get is a part of kv.Client interface.
func (m *MultiClient) Get(ctx context.Context, key string) (interface{}, error) {
	_, kv := m.getPrimaryClient()
	return kv.client.Get(ctx, key)
}

// Delete is a part of the kv.Client interface.
func (m *MultiClient) Delete(ctx context.Context, key string) error {
	_, kv := m.getPrimaryClient()
	return kv.client.Delete(ctx, key)
}

// CAS is a part of kv.Client interface.
func (m *MultiClient) CAS(ctx context.Context, key string, f func(in interface{}) (out interface{}, retry bool, err error)) error {
	_, kv := m.getPrimaryClient()

	updatedValue := interface{}(nil)
	err := kv.client.CAS(ctx, key, func(in interface{}) (interface{}, bool, error) {
		out, retry, err := f(in)
		updatedValue = out
		return out, retry, err
	})

	if err == nil && updatedValue != nil && m.mirroringEnabled.Load() {
		m.writeToSecondary(ctx, kv, key, updatedValue)
	}

	return err
}

// WatchKey is a part of kv.Client interface.
func (m *MultiClient) WatchKey(ctx context.Context, key string, f func(interface{}) bool) {
	_ = m.runWithPrimaryClient(ctx, func(newCtx context.Context, primary kvclient) error {
		primary.client.WatchKey(newCtx, key, f)
		return newCtx.Err()
	})
}

// WatchPrefix is a part of kv.Client interface.
func (m *MultiClient) WatchPrefix(ctx context.Context, prefix string, f func(string, interface{}) bool) {
	_ = m.runWithPrimaryClient(ctx, func(newCtx context.Context, primary kvclient) error {
		primary.client.WatchPrefix(newCtx, prefix, f)
		return newCtx.Err()
	})
}

func (m *MultiClient) writeToSecondary(ctx context.Context, primary kvclient, key string, newValue interface{}) {
	if m.mirrorTimeout > 0 {
		var cfn context.CancelFunc
		ctx, cfn = context.WithTimeout(ctx, m.mirrorTimeout)
		defer cfn()
	}

	// let's propagate new value to all remaining clients
	for _, kvc := range m.clients {
		if kvc == primary {
			continue
		}

		m.mirrorWritesCounter.Inc()
		err := kvc.client.CAS(ctx, key, func(interface{}) (out interface{}, retry bool, err error) {
			// try once
			return newValue, false, nil
		})

		if err != nil {
			m.mirrorFailuresCounter.Inc()
			level.Warn(m.logger).Log("msg", "failed to update value in secondary store", "key", key, "err", err, "primary", primary.name, "secondary", kvc.name)
		} else {
			level.Debug(m.logger).Log("msg", "stored updated value to secondary store", "key", key, "primary", primary.name, "secondary", kvc.name)
		}
	}
}
