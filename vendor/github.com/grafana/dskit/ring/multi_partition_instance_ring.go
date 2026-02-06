package ring

import (
	"fmt"
	"math"
	"strconv"
	"time"
)

// MultiPartitionInstanceRing holds a partitions ring and a instances ring,
// and provide functions to look up the intersection of the two (e.g. healthy instances by partition).
// The difference between this and PartitionInstanceRing is that this ring supports multi-partition owners, i.e. an instance can own multiple partitions.
type MultiPartitionInstanceRing struct {
	partitionsRingReader PartitionRingReader
	instancesRing        InstanceRingReader
	heartbeatTimeout     time.Duration
}

func NewMultiPartitionInstanceRing(partitionsRingWatcher PartitionRingReader, instancesRing InstanceRingReader, heartbeatTimeout time.Duration) *MultiPartitionInstanceRing {
	return &MultiPartitionInstanceRing{
		partitionsRingReader: partitionsRingWatcher,
		instancesRing:        instancesRing,
		heartbeatTimeout:     heartbeatTimeout,
	}
}

func (r *MultiPartitionInstanceRing) PartitionRing() *PartitionRing {
	return r.partitionsRingReader.PartitionRing()
}

// GetReplicationSetForPartitionAndOperation returns a ReplicationSet for the input partition. If the partition doesn't
// exist or there are no healthy owners for the partition, an error is returned.
// It will pick the highest instance from each zone when building the replication set,
// non-read-only instances are preferred over read-only instances (this is more important than picking the highest instance).
func (r *MultiPartitionInstanceRing) GetReplicationSetForPartitionAndOperation(partitionID int32, op Operation) (ReplicationSet, error) {
	const maxExpectedZones = 8 // Just enough to cover all needs. Allocating 2 or 8 elements on the stack won't make any performance difference.
	var stackZonesBuffer [maxExpectedZones]string
	zonesBuffer := stackZonesBuffer[:0]

	now := time.Now()

	var ownerIDs []string
	var stackOwnerIDs [maxExpectedZones]string
	ownerIDs = r.PartitionRing().MultiPartitionOwnerIDs(partitionID, stackOwnerIDs[:0])
	instances := make([]InstanceDesc, 0, len(ownerIDs))

	if len(ownerIDs) == 0 {
		return ReplicationSet{}, fmt.Errorf("%w: no owners found for partition %d", ErrEmptyRing, partitionID)
	}

	for _, instanceID := range ownerIDs {
		instance, err := r.instancesRing.GetInstance(instanceID)
		if err != nil {
			// If an instance doesn't exist in the instances ring we don't return an error
			// but lookup for other instances of the partition.
			continue
		}

		if !instance.IsHealthy(op, r.heartbeatTimeout, now) {
			continue
		}

		instances = append(instances, instance)
		// Store this in the same position as the instance, so we can use it to compare later.
		ownerIDs[len(instances)-1] = instanceID
	}

	if len(instances) == 0 {
		return ReplicationSet{}, fmt.Errorf("partition %d: %w", partitionID, ErrTooManyUnhealthyInstances)
	}

	// Count the number of unique zones among instances.
	zonesBuffer = uniqueZonesFromInstances(instances, zonesBuffer[:0])
	uniqueZones := len(zonesBuffer)

	instances = highestPreferablyNonReadOnlyFromEachZone(instances, ownerIDs, zonesBuffer)

	return ReplicationSet{
		Instances: instances,

		// Partitions has no concept of zone, but we enable it in order to support ring's requests
		// minimization feature.
		ZoneAwarenessEnabled: true,

		// We need response from at least 1 owner. The assumption is that we have 1 owner per zone
		// but it's not guaranteed (depends on how the application was deployed). The safest thing
		// we can do here is to just request a successful response from at least 1 zone.
		MaxUnavailableZones: uniqueZones - 1,
	}, nil
}

// this method expects instanceIDs to be in the same order as instances.
// instanceIDs should hold the parsed multi-partition owner IDs.
// instances input slice is updated in place and returned.
func highestPreferablyNonReadOnlyFromEachZone(instances []InstanceDesc, instanceIDs []string, instanceZones []string) []InstanceDesc {
	var stackAllInstances [16]InstanceDesc
	allInstances := append(stackAllInstances[:0], instances...)
	instances = instances[:0] // Reset, this is what we're going to return.
	for _, zone := range instanceZones {
		highest := -1
		for i, instance := range allInstances {
			if instance.Zone != zone {
				// Not our zone.
				continue
			}

			// Always pick the first one.
			if highest == -1 {
				highest = i
				continue
			}

			// If highest is read-only, and this one is not, pick it without checking the order.
			if allInstances[highest].ReadOnly && !instance.ReadOnly {
				highest = i
				continue
			}

			// If this one is read only, and highest is not, skip it.
			if instance.ReadOnly && !allInstances[highest].ReadOnly {
				continue
			}

			// If this one has a lower index than the one we have, skip it.
			if indexFromInstanceSuffix(instanceIDs[i]) < indexFromInstanceSuffix(instanceIDs[highest]) {
				continue
			}

			// This one is better than the one we have.
			highest = i
		}

		// We know there's always a highest instance for a zone, because zones were calculated from instances.
		instances = append(instances, allInstances[highest])
	}
	return instances
}

// indexFromInstanceSuffix returns the index from the instance suffix. The suffix is expected to be a number.
func indexFromInstanceSuffix(instance string) int {
	digitsSuffixLen := 0
	for digitsSuffixLen < len(instance) {
		i := len(instance) - digitsSuffixLen - 1
		if instance[i] >= '0' && instance[i] <= '9' {
			digitsSuffixLen++
		} else {
			break
		}
	}
	if digitsSuffixLen == 0 {
		return math.MaxInt
	}
	index, err := strconv.Atoi(instance[len(instance)-digitsSuffixLen:])
	if err != nil {
		return math.MaxInt // Shouldn't happen, we already made sure that the suffix is a number.
	}
	return index
}
