package ring

import (
	"context"
	"time"

	"github.com/pkg/errors"

	"github.com/grafana/dskit/kv"
)

// PartitionRingEditor is standalone component that can be used to modify the partitions ring.
// If you want to implement the partition lifecycle you should use PartitionInstanceLifecycler instead.
type PartitionRingEditor struct {
	ringKey string
	store   kv.Client
}

func NewPartitionRingEditor(ringKey string, store kv.Client) *PartitionRingEditor {
	return &PartitionRingEditor{
		ringKey: ringKey,
		store:   store,
	}
}

// ChangePartitionState changes the partition state to toState.
// This function returns ErrPartitionDoesNotExist if the partition doesn't exist,
// and ErrPartitionStateChangeNotAllowed if the state change is not allowed.
func (l *PartitionRingEditor) ChangePartitionState(ctx context.Context, partitionID int32, toState PartitionState) error {
	return l.updateRing(ctx, func(ring *PartitionRingDesc) (bool, error) {
		return changePartitionState(ring, partitionID, toState)
	})
}

func (l *PartitionRingEditor) updateRing(ctx context.Context, update func(ring *PartitionRingDesc) (bool, error)) error {
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

func changePartitionState(ring *PartitionRingDesc, partitionID int32, toState PartitionState) (changed bool, _ error) {
	partition, exists := ring.Partitions[partitionID]
	if !exists {
		return false, ErrPartitionDoesNotExist
	}

	if partition.State == toState {
		return false, nil
	}

	if !isPartitionStateChangeAllowed(partition.State, toState) {
		return false, errors.Wrapf(ErrPartitionStateChangeNotAllowed, "change partition state from %s to %s", partition.State.CleanName(), toState.CleanName())
	}

	return ring.UpdatePartitionState(partitionID, toState, time.Now()), nil
}
