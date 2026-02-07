package planner

import (
	"math/rand"
	"sync"
	"time"
)

// Planner is the top-level entry point for creating and managing plans for different keys.
// It is safe for concurrent use and includes a background routine to evict old keys.
type Planner struct {
	keys              sync.Map // Stores *keyPlan, ensuring fine-grained concurrency per key.
	evictionThreshold time.Duration
	// Use a pool of RNGs to reduce allocation overhead and initialization cost on the hot path.
	rngPool sync.Pool

	wg          sync.WaitGroup
	stopCleanup chan struct{}
}

var _ Manager = (*Planner)(nil)

// Config holds configuration for the planner.
type Config struct {
	EvictionThreshold time.Duration // How long a key can be unused before being evicted. (e.g., 30 * time.Minute)
	CleanupInterval   time.Duration // How often the planner checks for stale keys. (e.g., 5 * time.Minute)
}

// New creates a new Planner with the specified configuration and starts its cleanup routine.
func New(config *Config) *Planner {
	p := &Planner{
		evictionThreshold: config.EvictionThreshold,
		stopCleanup:       make(chan struct{}),
		wg:                sync.WaitGroup{},
	}
	p.rngPool.New = func() interface{} {
		// Each new RNG is seeded to ensure different sequences.
		return rand.New(rand.NewSource(time.Now().UnixNano()))
	}

	if config.EvictionThreshold > 0 && config.CleanupInterval > 0 {
		p.startCleanupRoutine(config.CleanupInterval)
	}

	return p
}

func NewNoopPlanner() *Planner {
	p := &Planner{
		evictionThreshold: 0,
		stopCleanup:       make(chan struct{}),
		wg:                sync.WaitGroup{},
	}
	p.rngPool.New = func() interface{} {
		// Each new RNG is seeded to ensure different sequences.
		return rand.New(rand.NewSource(time.Now().UnixNano()))
	}
	return p
}

// GetPlanSelector retrieves the plan for a specific key, creating it if it doesn't exist.
func (p *Planner) GetPlanSelector(key string) Selector {
	upsertPlan := &keyPlan{planner: p}
	upsertPlan.touch()
	kp, loaded := p.keys.LoadOrStore(key, upsertPlan)
	plan := kp.(*keyPlan)
	if loaded {
		plan.touch() // Mark as accessed.
	}
	return plan
}

// startCleanupRoutine runs a background goroutine that periodically evicts stale keys.
func (p *Planner) startCleanupRoutine(interval time.Duration) {
	ticker := time.NewTicker(interval)
	p.wg.Add(1)
	go func() {
		for {
			select {
			case <-ticker.C:
				p.evictStaleKeys()
			case <-p.stopCleanup:
				ticker.Stop()
				p.wg.Done()
				return
			}
		}
	}()
}

// evictStaleKeys iterates over all keys and removes any that haven't been accessed
// within the evictionThreshold.
func (p *Planner) evictStaleKeys() {
	evictionThresholdNano := p.evictionThreshold.Nanoseconds()
	nowNano := time.Now().UnixNano()

	// NOTE: Consider also bounding the total number of keys stored.

	p.keys.Range(func(key, value interface{}) bool {
		kp := value.(*keyPlan)
		lastAccessed := kp.lastAccessed.Load()
		if (nowNano - lastAccessed) > evictionThresholdNano {
			p.keys.Delete(key)
		}
		return true // continue iteration
	})
}

// Stop gracefully terminates the background cleanup goroutine.
func (p *Planner) Stop() {
	close(p.stopCleanup)
	p.wg.Wait()
}
