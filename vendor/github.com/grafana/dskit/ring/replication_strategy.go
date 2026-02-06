package ring

import (
	"fmt"
	"strings"
	"time"
)

type ReplicationStrategy interface {
	// Filter out unhealthy instances and checks if there are enough instances
	// for an operation to succeed. Returns an error if there are not enough
	// instances.
	Filter(instances []InstanceDesc, op Operation, replicationFactor int, heartbeatTimeout time.Duration, zoneAwarenessEnabled bool) (healthy []InstanceDesc, maxFailures int, err error)

	// SupportsExpandedReplication returns true for replication strategies that
	// support increasing the replication factor beyond a single instance per zone,
	// false otherwise.
	SupportsExpandedReplication() bool
}

type defaultReplicationStrategy struct{}

func NewDefaultReplicationStrategy() ReplicationStrategy {
	return &defaultReplicationStrategy{}
}

// Filter decides, given the set of instances eligible for a key,
// which instances you will try and write to and how many failures you will
// tolerate.
// - Filters out unhealthy instances so the one doesn't even try to write to them.
// - Checks there are enough instances for an operation to succeed.
// The instances argument may be overwritten.
func (s *defaultReplicationStrategy) Filter(instances []InstanceDesc, op Operation, replicationFactor int, heartbeatTimeout time.Duration, zoneAwarenessEnabled bool) ([]InstanceDesc, int, error) {
	// We need a response from a quorum of instances, which is n/2 + 1.  In the
	// case of a node joining/leaving, the actual replica set might be bigger
	// than the replication factor, so use the bigger or the two.
	if len(instances) > replicationFactor {
		replicationFactor = len(instances)
	}

	minSuccess := (replicationFactor / 2) + 1
	now := time.Now()

	// Skip those that have not heartbeated in a while. NB these are still
	// included in the calculation of minSuccess, so if too many failed instances
	// will cause the whole write to fail.
	var unhealthy []string
	for i := 0; i < len(instances); {
		if instances[i].IsHealthy(op, heartbeatTimeout, now) {
			i++
		} else {
			unhealthy = append(unhealthy, instances[i].Addr)
			instances = append(instances[:i], instances[i+1:]...)
		}
	}

	// This is just a shortcut - if there are not minSuccess available instances,
	// after filtering out dead ones, don't even bother trying.
	if len(instances) < minSuccess {
		var err error
		var unhealthyStr string
		if len(unhealthy) > 0 {
			unhealthyStr = fmt.Sprintf(" - unhealthy instances: %s", strings.Join(unhealthy, ","))
		}

		if zoneAwarenessEnabled {
			err = fmt.Errorf("at least %d live replicas required across different availability zones, could only find %d%s", minSuccess, len(instances), unhealthyStr)
		} else {
			err = fmt.Errorf("at least %d live replicas required, could only find %d%s", minSuccess, len(instances), unhealthyStr)
		}

		return nil, 0, err
	}

	return instances, len(instances) - minSuccess, nil
}

func (s *defaultReplicationStrategy) SupportsExpandedReplication() bool {
	// defaultReplicationStrategy assumes that a single instance per zone is returned and that
	// it can treat replication factor as equivalent to the number of zones. This doesn't work
	// when a per-call replication factor increases it beyond the configured replication factor
	// and the number of zones.
	return false
}

type ignoreUnhealthyInstancesReplicationStrategy struct{}

func NewIgnoreUnhealthyInstancesReplicationStrategy() ReplicationStrategy {
	return &ignoreUnhealthyInstancesReplicationStrategy{}
}

func (r *ignoreUnhealthyInstancesReplicationStrategy) Filter(instances []InstanceDesc, op Operation, _ int, heartbeatTimeout time.Duration, _ bool) (healthy []InstanceDesc, maxFailures int, err error) {
	now := time.Now()
	// Filter out unhealthy instances.
	var unhealthy []string
	for i := 0; i < len(instances); {
		if instances[i].IsHealthy(op, heartbeatTimeout, now) {
			i++
		} else {
			unhealthy = append(unhealthy, instances[i].Addr)
			instances = append(instances[:i], instances[i+1:]...)
		}
	}

	// We need at least 1 healthy instance no matter what is the replication factor set to.
	if len(instances) == 0 {
		var unhealthyStr string
		if len(unhealthy) > 0 {
			unhealthyStr = fmt.Sprintf(" - unhealthy instances: %s", strings.Join(unhealthy, ","))
		}
		return nil, 0, fmt.Errorf("at least 1 healthy replica required, could only find 0%s", unhealthyStr)
	}

	return instances, len(instances) - 1, nil
}

func (r *ignoreUnhealthyInstancesReplicationStrategy) SupportsExpandedReplication() bool {
	return true
}

func (r *Ring) IsHealthy(instance *InstanceDesc, op Operation, now time.Time) bool {
	return instance.IsHealthy(op, r.cfg.HeartbeatTimeout, now)
}

// ReplicationFactor of the ring.
func (r *Ring) ReplicationFactor() int {
	return r.cfg.ReplicationFactor
}
