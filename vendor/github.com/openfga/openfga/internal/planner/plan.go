package planner

import (
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// keyPlan manages the statistics for a single key and makes decisions about its resolvers.
// This struct is now entirely lock-free, using a sync.Map to manage its stats.
type keyPlan struct {
	stats   sync.Map // Stores map[string]*ThompsonStats
	planner *Planner
	// lastAccessed stores the UnixNano timestamp of the last access.
	// Using atomic guarantees thread-safe updates without a mutex.
	lastAccessed atomic.Int64
}

var _ Selector = (*keyPlan)(nil)

// touch updates the lastAccessed timestamp to the current time.
func (kp *keyPlan) touch() {
	kp.lastAccessed.Store(time.Now().UnixNano())
}

// getOrCreateStats atomically retrieves or creates the ThompsonStats for a given resolver name.
// This avoids the allocation overhead of calling LoadOrStore directly on the hot path.
func (kp *keyPlan) getOrCreateStats(plan *PlanConfig) *ThompsonStats {
	// Fast path: Try a simple load first. This avoids the allocation in the common case.
	val, ok := kp.stats.Load(plan.Name)
	if ok {
		return val.(*ThompsonStats)
	}

	// Slow path: The stats don't exist. Create a new one.
	newTS := NewThompsonStats(plan.InitialGuess, plan.Lambda, plan.Alpha, plan.Beta)

	// Use LoadOrStore to handle the race where another goroutine might have created it
	// in the time between our Load and now. The newTs object is only stored if
	// no entry existed.
	actual, _ := kp.stats.LoadOrStore(plan.Name, newTS)
	return actual.(*ThompsonStats)
}

// Select implements the Thompson Sampling decision rule.
func (kp *keyPlan) Select(resolvers map[string]*PlanConfig) *PlanConfig {
	kp.touch() // Mark this key as recently used.

	rng := kp.planner.rngPool.Get().(*rand.Rand)
	defer kp.planner.rngPool.Put(rng)

	bestResolver := ""
	var minSampledTime float64 = -1

	for k, plan := range resolvers {
		// Use the optimized helper method to get stats without unnecessary allocations.
		ts := kp.getOrCreateStats(plan)

		sampledTime := ts.Sample(rng)
		if bestResolver == "" || sampledTime < minSampledTime {
			minSampledTime = sampledTime
			bestResolver = k
		}
	}

	return resolvers[bestResolver]
}

// UpdateStats performs the Bayesian update for the given resolver's statistics.
func (kp *keyPlan) UpdateStats(plan *PlanConfig, duration time.Duration) {
	kp.touch() // Mark this key as recently used.

	// Use the optimized helper method to avoid allocations.
	ts := kp.getOrCreateStats(plan)
	ts.Update(duration)
}
