package ring

import (
	"context"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.uber.org/atomic"

	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/services"
)

var (
	ErrPartitionDoesNotExist          = errors.New("the partition does not exist")
	ErrPartitionStateMismatch         = errors.New("the partition state does not match the expected one")
	ErrPartitionStateChangeNotAllowed = errors.New("partition state change not allowed")

	allowedPartitionStateChanges = map[PartitionState][]PartitionState{
		PartitionPending:  {PartitionActive, PartitionInactive},
		PartitionActive:   {PartitionInactive},
		PartitionInactive: {PartitionActive},
	}
)

type PartitionInstanceLifecyclerConfig struct {
	// PartitionID is the ID of the partition managed by the lifecycler.
	PartitionID int32

	// InstanceID is the ID of the instance managed by the lifecycler.
	InstanceID string

	// WaitOwnersCountOnPending is the minimum number of owners to wait before switching a
	// PENDING partition to ACTIVE.
	WaitOwnersCountOnPending int

	// WaitOwnersDurationOnPending is how long each owner should have been added to the
	// partition before it's considered eligible for the WaitOwnersCountOnPending count.
	WaitOwnersDurationOnPending time.Duration

	// DeleteInactivePartitionAfterDuration is how long the lifecycler should wait before
	// deleting inactive partitions with no owners. Inactive partitions are never removed
	// if this value is 0.
	DeleteInactivePartitionAfterDuration time.Duration

	// PollingInterval is the internal polling interval. This setting is useful to let
	// upstream projects to lower it in unit tests.
	PollingInterval time.Duration
}

// PartitionInstanceLifecycler is responsible to manage the lifecycle of a single
// partition and partition owner in the ring.
type PartitionInstanceLifecycler struct {
	*services.BasicService

	// These values are initialised at startup, and never change.
	cfg      PartitionInstanceLifecyclerConfig
	ringName string
	ringKey  string
	store    kv.Client
	logger   log.Logger

	// Channel used to execute logic within the lifecycler loop.
	actorChan chan func()

	// Whether the partitions should be created on startup if it doesn't exist yet.
	createPartitionOnStartup *atomic.Bool

	// Whether the lifecycler should remove the partition owner (identified by instance ID) on shutdown.
	removeOwnerOnShutdown *atomic.Bool

	// Metrics.
	reconcilesTotal       *prometheus.CounterVec
	reconcilesFailedTotal *prometheus.CounterVec
}

func NewPartitionInstanceLifecycler(cfg PartitionInstanceLifecyclerConfig, ringName, ringKey string, store kv.Client, logger log.Logger, reg prometheus.Registerer) *PartitionInstanceLifecycler {
	if cfg.PollingInterval == 0 {
		cfg.PollingInterval = 5 * time.Second
	}

	l := &PartitionInstanceLifecycler{
		cfg:                      cfg,
		ringName:                 ringName,
		ringKey:                  ringKey,
		store:                    store,
		logger:                   log.With(logger, "ring", ringName),
		actorChan:                make(chan func()),
		createPartitionOnStartup: atomic.NewBool(true),
		removeOwnerOnShutdown:    atomic.NewBool(false),
		reconcilesTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name:        "partition_ring_lifecycler_reconciles_total",
			Help:        "Total number of reconciliations started.",
			ConstLabels: map[string]string{"name": ringName},
		}, []string{"type"}),
		reconcilesFailedTotal: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name:        "partition_ring_lifecycler_reconciles_failed_total",
			Help:        "Total number of reconciliations failed.",
			ConstLabels: map[string]string{"name": ringName},
		}, []string{"type"}),
	}

	l.BasicService = services.NewBasicService(l.starting, l.running, l.stopping)

	return l
}

// CreatePartitionOnStartup returns whether the lifecycle creates the partition on startup
// if it doesn't exist.
func (l *PartitionInstanceLifecycler) CreatePartitionOnStartup() bool {
	return l.createPartitionOnStartup.Load()
}

// SetCreatePartitionOnStartup sets whether the lifecycler should create the partition on
// startup if it doesn't exist.
func (l *PartitionInstanceLifecycler) SetCreatePartitionOnStartup(create bool) {
	l.createPartitionOnStartup.Store(create)
}

// RemoveOwnerOnShutdown returns whether the lifecycler has been configured to remove the partition
// owner on shutdown.
func (l *PartitionInstanceLifecycler) RemoveOwnerOnShutdown() bool {
	return l.removeOwnerOnShutdown.Load()
}

// SetRemoveOwnerOnShutdown sets whether the lifecycler should remove the partition owner on shutdown.
func (l *PartitionInstanceLifecycler) SetRemoveOwnerOnShutdown(remove bool) {
	l.removeOwnerOnShutdown.Store(remove)
}

// GetPartitionState returns the current state of the partition, and the timestamp when the state was
// changed the last time.
func (l *PartitionInstanceLifecycler) GetPartitionState(ctx context.Context) (PartitionState, time.Time, error) {
	ring, err := l.getRing(ctx)
	if err != nil {
		return PartitionUnknown, time.Time{}, err
	}

	partition, exists := ring.Partitions[l.cfg.PartitionID]
	if !exists {
		return PartitionUnknown, time.Time{}, ErrPartitionDoesNotExist
	}

	return partition.GetState(), partition.GetStateTime(), nil
}

// ChangePartitionState changes the partition state to toState.
// This function returns ErrPartitionDoesNotExist if the partition doesn't exist,
// and ErrPartitionStateChangeNotAllowed if the state change is not allowed.
func (l *PartitionInstanceLifecycler) ChangePartitionState(ctx context.Context, toState PartitionState) error {
	return l.runOnLifecyclerLoop(func() error {
		err := l.updateRing(ctx, func(ring *PartitionRingDesc) (bool, error) {
			return changePartitionState(ring, l.cfg.PartitionID, toState)
		})

		if err != nil {
			level.Warn(l.logger).Log("msg", "failed to change partition state", "partition", l.cfg.PartitionID, "to_state", toState, "err", err)
		}

		return err
	})
}

func (l *PartitionInstanceLifecycler) starting(ctx context.Context) error {
	if l.CreatePartitionOnStartup() {
		return errors.Wrap(l.createPartitionAndRegisterOwner(ctx), "create partition and register owner")
	}

	return errors.Wrap(l.waitPartitionAndRegisterOwner(ctx), "wait partition and register owner")
}

func (l *PartitionInstanceLifecycler) running(ctx context.Context) error {
	reconcile := func() {
		l.reconcileOwnedPartition(ctx, time.Now())
		l.reconcileOtherPartitions(ctx, time.Now())
	}

	// Run a reconciliation as soon as the lifecycler, in order to not having to wait for the 1st timer tick.
	reconcile()

	reconcileTicker := time.NewTicker(l.cfg.PollingInterval)
	defer reconcileTicker.Stop()

	for {
		select {
		case <-reconcileTicker.C:
			reconcile()

		case f := <-l.actorChan:
			f()

		case <-ctx.Done():
			return nil
		}
	}
}

func (l *PartitionInstanceLifecycler) stopping(_ error) error {
	level.Info(l.logger).Log("msg", "partition ring lifecycler is shutting down", "ring", l.ringName)

	// Remove the instance from partition owners, if configured to do so.
	if l.RemoveOwnerOnShutdown() {
		err := l.updateRing(context.Background(), func(ring *PartitionRingDesc) (bool, error) {
			return ring.RemoveOwner(l.cfg.InstanceID), nil
		})

		if err != nil {
			level.Error(l.logger).Log("msg", "failed to remove instance from partition owners on shutdown", "instance", l.cfg.InstanceID, "partition", l.cfg.PartitionID, "err", err)
		} else {
			level.Info(l.logger).Log("msg", "instance removed from partition owners", "instance", l.cfg.InstanceID, "partition", l.cfg.PartitionID)
		}
	}

	return nil
}

// runOnLifecyclerLoop runs fn within the lifecycler loop.
func (l *PartitionInstanceLifecycler) runOnLifecyclerLoop(fn func() error) error {
	sc := l.ServiceContext()
	if sc == nil {
		return errors.New("lifecycler not running")
	}

	errCh := make(chan error)
	wrappedFn := func() {
		errCh <- fn()
	}

	select {
	case <-sc.Done():
		return errors.New("lifecycler not running")
	case l.actorChan <- wrappedFn:
		return <-errCh
	}
}

func (l *PartitionInstanceLifecycler) getRing(ctx context.Context) (*PartitionRingDesc, error) {
	in, err := l.store.Get(ctx, l.ringKey)
	if err != nil {
		return nil, err
	}

	return GetOrCreatePartitionRingDesc(in), nil
}

func (l *PartitionInstanceLifecycler) updateRing(ctx context.Context, update func(ring *PartitionRingDesc) (bool, error)) error {
	return l.store.CAS(ctx, l.ringKey, func(in interface{}) (out interface{}, retry bool, err error) {
		ringDesc := GetOrCreatePartitionRingDesc(in)

		if changed, err := update(ringDesc); err != nil {
			return nil, false, err
		} else if !changed {
			return nil, false, nil
		}

		return ringDesc, true, nil
	})
}

func (l *PartitionInstanceLifecycler) createPartitionAndRegisterOwner(ctx context.Context) error {
	return l.updateRing(ctx, func(ring *PartitionRingDesc) (bool, error) {
		now := time.Now()
		changed := false

		partitionDesc, exists := ring.Partitions[l.cfg.PartitionID]
		if exists {
			level.Info(l.logger).Log("msg", "partition found in the ring", "partition", l.cfg.PartitionID, "state", partitionDesc.GetState(), "state_timestamp", partitionDesc.GetState().String(), "tokens", len(partitionDesc.GetTokens()))
		} else {
			level.Info(l.logger).Log("msg", "partition not found in the ring", "partition", l.cfg.PartitionID)
		}

		if !exists {
			// The partition doesn't exist, so we create a new one. A new partition should always be created
			// in PENDING state.
			ring.AddPartition(l.cfg.PartitionID, PartitionPending, now)
			changed = true
		}

		// Ensure the instance is added as partition owner.
		if ring.AddOrUpdateOwner(l.cfg.InstanceID, OwnerActive, l.cfg.PartitionID, now) {
			changed = true
		}

		return changed, nil
	})
}

func (l *PartitionInstanceLifecycler) waitPartitionAndRegisterOwner(ctx context.Context) error {
	pollTicker := time.NewTicker(l.cfg.PollingInterval)
	defer pollTicker.Stop()

	// Wait until the partition exists.
	checkPartitionExist := func() (bool, error) {
		level.Info(l.logger).Log("msg", "checking if the partition exist in the ring", "partition", l.cfg.PartitionID)

		ring, err := l.getRing(ctx)
		if err != nil {
			return false, errors.Wrap(err, "read partition ring")
		}

		if ring.HasPartition(l.cfg.PartitionID) {
			level.Info(l.logger).Log("msg", "partition found in the ring", "partition", l.cfg.PartitionID)
			return true, nil
		}

		level.Info(l.logger).Log("msg", "partition not found in the ring", "partition", l.cfg.PartitionID)
		return false, nil
	}

	for {
		if exists, err := checkPartitionExist(); err != nil {
			return err
		} else if exists {
			break
		}

		select {
		case <-ctx.Done():
			return ctx.Err()

		case <-pollTicker.C:
			// Throttle.
		}
	}

	// Ensure the instance is added as partition owner.
	return l.updateRing(ctx, func(ring *PartitionRingDesc) (bool, error) {
		return ring.AddOrUpdateOwner(l.cfg.InstanceID, OwnerActive, l.cfg.PartitionID, time.Now()), nil
	})
}

// reconcileOwnedPartition reconciles the owned partition.
// This function should be called periodically.
func (l *PartitionInstanceLifecycler) reconcileOwnedPartition(ctx context.Context, now time.Time) {
	const reconcileType = "owned-partition"
	l.reconcilesTotal.WithLabelValues(reconcileType).Inc()

	err := l.updateRing(ctx, func(ring *PartitionRingDesc) (bool, error) {
		partitionID := l.cfg.PartitionID

		partition, exists := ring.Partitions[partitionID]
		if !exists {
			return false, ErrPartitionDoesNotExist
		}

		// A pending partition should be switched to active if there are enough owners that
		// have been added since more than the waiting period.
		if partition.IsPending() && ring.PartitionOwnersCountUpdatedBefore(partitionID, now.Add(-l.cfg.WaitOwnersDurationOnPending)) >= l.cfg.WaitOwnersCountOnPending {
			level.Info(l.logger).Log("msg", "switching partition state because enough owners have been registered and minimum waiting time has elapsed", "partition", l.cfg.PartitionID, "from_state", PartitionPending, "to_state", PartitionActive)
			return ring.UpdatePartitionState(partitionID, PartitionActive, now), nil
		}

		return false, nil
	})

	if err != nil {
		l.reconcilesFailedTotal.WithLabelValues(reconcileType).Inc()
		level.Warn(l.logger).Log("msg", "failed to reconcile owned partition", "partition", l.cfg.PartitionID, "err", err)
	}
}

// reconcileOtherPartitions reconciles other partitions.
// This function should be called periodically.
func (l *PartitionInstanceLifecycler) reconcileOtherPartitions(ctx context.Context, now time.Time) {
	const reconcileType = "other-partitions"
	l.reconcilesTotal.WithLabelValues(reconcileType).Inc()

	err := l.updateRing(ctx, func(ring *PartitionRingDesc) (bool, error) {
		changed := false

		if l.cfg.DeleteInactivePartitionAfterDuration > 0 {
			deleteBefore := now.Add(-l.cfg.DeleteInactivePartitionAfterDuration)

			for partitionID, partition := range ring.Partitions {
				// Never delete the partition owned by this lifecycler, since it's expected to have at least
				// this instance as owner.
				if partitionID == l.cfg.PartitionID {
					continue
				}

				// A partition is safe to be removed only if it's inactive since longer than the wait period
				// and it has no owners registered.
				if partition.IsInactiveSince(deleteBefore) && ring.PartitionOwnersCount(partitionID) == 0 {
					level.Info(l.logger).Log("msg", "removing inactive partition with no owners from ring", "partition", partitionID, "state", partition.State.CleanName(), "state_timestamp", partition.GetStateTime().String())
					ring.RemovePartition(partitionID)
					changed = true
				}
			}
		}

		return changed, nil
	})

	if err != nil {
		l.reconcilesFailedTotal.WithLabelValues(reconcileType).Inc()
		level.Warn(l.logger).Log("msg", "failed to reconcile other partitions", "err", err)
	}
}

func isPartitionStateChangeAllowed(from, to PartitionState) bool {
	for _, allowed := range allowedPartitionStateChanges[from] {
		if to == allowed {
			return true
		}
	}

	return false
}
