package memberlist

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/go-kit/log"
	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/atomic"

	"github.com/grafana/dskit/services"
)

// KVInitService initializes a memberlist.KV on first call to GetMemberlistKV, and starts it. On stop,
// KV is stopped too. If KV fails, error is reported from the service.
type KVInitService struct {
	services.Service

	// config used for initialization
	cfg         *KVConfig
	logger      log.Logger
	dnsProvider DNSProvider
	registerer  prometheus.Registerer

	// init function, to avoid multiple initializations.
	init sync.Once

	// state
	kv      atomic.Value
	err     error
	watcher *services.FailureWatcher
}

func NewKVInitService(cfg *KVConfig, logger log.Logger, dnsProvider DNSProvider, registerer prometheus.Registerer) *KVInitService {
	kvinit := &KVInitService{
		cfg:         cfg,
		watcher:     services.NewFailureWatcher(),
		logger:      logger,
		registerer:  registerer,
		dnsProvider: dnsProvider,
	}
	kvinit.Service = services.NewBasicService(nil, kvinit.running, kvinit.stopping).WithName("memberlist KV service")
	return kvinit
}

// GetMemberlistKV will initialize Memberlist.KV on first call, and add it to service failure watcher.
func (kvs *KVInitService) GetMemberlistKV() (*KV, error) {
	// Validate WatchPrefixBufferSize before initialization
	if kvs.cfg.WatchPrefixBufferSize <= 0 {
		return nil, fmt.Errorf("invalid WatchPrefixBufferSize: must be greater than 0")
	}

	kvs.init.Do(func() {
		kv := NewKV(*kvs.cfg, kvs.logger, kvs.dnsProvider, kvs.registerer)
		kvs.watcher.WatchService(kv)
		kvs.err = kv.StartAsync(context.Background())

		kvs.kv.Store(kv)
	})

	return kvs.getKV(), kvs.err
}

// Returns KV if it was initialized, or nil.
func (kvs *KVInitService) getKV() *KV {
	kv := kvs.kv.Load()
	if kv == nil {
		return nil
	}
	return kv.(*KV)
}

func (kvs *KVInitService) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return nil
	case err := <-kvs.watcher.Chan():
		// Only happens if KV service was actually initialized in GetMemberlistKV and it fails.
		return err
	}
}

func (kvs *KVInitService) stopping(_ error) error {
	kv := kvs.getKV()
	if kv == nil {
		return nil
	}

	return services.StopAndAwaitTerminated(context.Background(), kv)
}

func (kvs *KVInitService) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	NewHTTPStatusHandler(kvs, defaultPageTemplate).ServeHTTP(w, req)
}
