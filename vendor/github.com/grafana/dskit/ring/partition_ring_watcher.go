package ring

import (
	"context"
	"sync"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/services"
)

// PartitionRingWatcher watches the partitions ring for changes in the KV store.
type PartitionRingWatcher struct {
	services.Service

	key      string
	kv       kv.Client
	delegate PartitionRingWatcherDelegate
	logger   log.Logger

	ringMx sync.Mutex
	ring   *PartitionRing

	// Metrics.
	numPartitionsGaugeVec *prometheus.GaugeVec
}

type PartitionRingWatcherDelegate interface {
	// OnPartitionRingChanged provides the old and new partition ring descriptions, which must not be modified.
	OnPartitionRingChanged(oldRing, newRing *PartitionRingDesc)
}

func NewPartitionRingWatcher(name, key string, kv kv.Client, logger log.Logger, reg prometheus.Registerer) *PartitionRingWatcher {
	emptyRing, err := NewPartitionRing(*NewPartitionRingDesc())
	if err != nil {
		panic(err) // This should never executes.
	}
	r := &PartitionRingWatcher{
		key:    key,
		kv:     kv,
		logger: logger,
		ring:   emptyRing,
		numPartitionsGaugeVec: promauto.With(reg).NewGaugeVec(prometheus.GaugeOpts{
			Name:        "partition_ring_partitions",
			Help:        "Number of partitions by state in the partitions ring.",
			ConstLabels: map[string]string{"name": name},
		}, []string{"state"}),
	}

	r.Service = services.NewBasicService(r.starting, r.loop, nil).WithName("partitions-ring-watcher")
	return r
}

// WithDelegate adds the delegate to be called when the partition ring changes.
//
// Not concurrency safe.
func (w *PartitionRingWatcher) WithDelegate(delegate PartitionRingWatcherDelegate) *PartitionRingWatcher {
	w.delegate = delegate
	return w
}

func (w *PartitionRingWatcher) starting(ctx context.Context) error {
	// Get the initial ring state so that, as soon as the service will be running, the in-memory
	// ring would be already populated and there's no race condition between when the service is
	// running and the WatchKey() callback is called for the first time.
	value, err := w.kv.Get(ctx, w.key)
	if err != nil {
		return errors.Wrap(err, "unable to initialise ring state")
	}

	if value == nil {
		level.Info(w.logger).Log("msg", "partition ring doesn't exist in KV store yet")
		value = NewPartitionRingDesc()
	}

	return w.updatePartitionRing(value.(*PartitionRingDesc))
}

func (w *PartitionRingWatcher) loop(ctx context.Context) error {
	var watchErr error
	w.kv.WatchKey(ctx, w.key, func(value interface{}) bool {
		if value == nil {
			level.Info(w.logger).Log("msg", "partition ring doesn't exist in KV store yet")
			return true
		}

		if err := w.updatePartitionRing(value.(*PartitionRingDesc)); err != nil {
			watchErr = err
			return false
		}
		return true
	})
	return watchErr
}

func (w *PartitionRingWatcher) updatePartitionRing(desc *PartitionRingDesc) error {
	newRing, err := NewPartitionRing(*desc)
	if err != nil {
		return errors.Wrap(err, "failed to create partition ring from descriptor")
	}
	w.ringMx.Lock()
	oldRing := w.ring
	w.ring = newRing
	w.ringMx.Unlock()

	if w.delegate != nil {
		w.delegate.OnPartitionRingChanged(&oldRing.desc, desc)
	}

	// Update metrics.
	for state, count := range desc.countPartitionsByState() {
		w.numPartitionsGaugeVec.WithLabelValues(state.CleanName()).Set(float64(count))
	}

	// Check partitions whose state change lock status has changed and log them.
	for partitionID, partition := range desc.Partitions {
		state := partition.GetState().CleanName()

		oldPartition, existedBefore := oldRing.desc.Partitions[partitionID]
		if !existedBefore || partition.StateChangeLocked != oldPartition.StateChangeLocked {
			if partition.StateChangeLocked {
				level.Warn(w.logger).Log("msg", "partition state change is locked", "partition_id", partitionID, "partition_state", state)
			} else if existedBefore {
				level.Info(w.logger).Log("msg", "partition state change is unlocked", "partition_id", partitionID, "partition_state", state)
			}
		}
	}
	return nil
}

// PartitionRing returns the most updated snapshot of the PartitionRing. The returned instance
// is immutable and will not be updated if new changes are done to the ring.
func (w *PartitionRingWatcher) PartitionRing() *PartitionRing {
	w.ringMx.Lock()
	defer w.ringMx.Unlock()

	return w.ring
}
