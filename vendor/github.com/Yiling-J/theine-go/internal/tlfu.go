package internal

import (
	"math"

	"github.com/Yiling-J/theine-go/internal/hasher"
	"github.com/Yiling-J/theine-go/internal/xruntime"
)

const (
	ADMIT_HASHDOS_THRESHOLD      = 6
	HILL_CLIMBER_STEP_DECAY_RATE = 0.98
	HILL_CLIMBER_STEP_PERCENT    = 0.0625
)

type TinyLfu[K comparable, V any] struct {
	window         *List[K, V]
	slru           *Slru[K, V]
	sketch         *CountMinSketch
	hasher         *hasher.Hasher[K]
	capacity       uint
	weightedSize   uint
	misses         *UnsignedCounter
	hits           *UnsignedCounter
	hitsInSample   uint64
	missesInSample uint64
	hr             float32
	step           float32
	amount         int
	removeCallback func(entry *Entry[K, V])
}

func NewTinyLfu[K comparable, V any](size uint, hasher *hasher.Hasher[K]) *TinyLfu[K, V] {
	windowSize := uint(float32(size) * 0.01)
	if windowSize < 1 {
		windowSize = 1
	}
	mainSize := size - windowSize
	tlfu := &TinyLfu[K, V]{
		capacity: size,
		slru:     NewSlru[K, V](mainSize),
		sketch:   NewCountMinSketch(),
		step:     -float32(size) * 0.0625,
		hasher:   hasher,
		misses:   NewUnsignedCounter(),
		hits:     NewUnsignedCounter(),
		window:   NewList[K, V](windowSize, LIST_WINDOW),
	}

	return tlfu
}

func (t *TinyLfu[K, V]) increaseWindow(amount int) int {
	// try move from protected/probation to window
	for {
		probation := true
		entry := t.slru.probation.Back()
		if entry == nil || entry.policyWeight > int64(amount) {
			probation = false
			entry = t.slru.protected.Back()
		}
		if entry == nil {
			break
		}

		weight := entry.policyWeight
		if weight > int64(amount) {
			break
		}
		amount -= int(weight)
		if probation {
			t.slru.probation.Remove(entry)
		} else {
			t.slru.protected.Remove(entry)
		}
		t.window.PushFront(entry)
	}
	return amount
}

func (t *TinyLfu[K, V]) decreaseWindow(amount int) int {
	// try move from window to probation
	for {
		entry := t.window.Back()
		if entry == nil {
			break
		}
		weight := entry.policyWeight
		if weight > int64(amount) {
			break
		}
		amount -= int(weight)
		t.window.Remove(entry)
		t.slru.probation.PushFront(entry)
	}
	return amount
}

func (t *TinyLfu[K, V]) resizeWindow() {
	t.window.capacity += uint(t.amount)
	t.slru.protected.capacity -= uint(t.amount)
	// demote first to make sure policy size is right
	t.demoteFromProtected()

	var remain int
	if t.amount > 0 {
		remain = t.increaseWindow(t.amount)
		t.amount = remain
	} else if t.amount < 0 {
		remain = t.decreaseWindow(-t.amount)
		t.amount = -remain
	}

	t.window.capacity -= uint(t.amount)
	t.slru.protected.capacity += uint(t.amount)
}

func (t *TinyLfu[K, V]) climb() {
	var delta float32
	if t.hitsInSample+t.missesInSample == 0 {
		delta = 0
	} else {
		current := float32(t.hitsInSample) / float32(t.hitsInSample+t.missesInSample)
		delta = current - t.hr
		t.hr = current
	}
	t.hitsInSample = 0
	t.missesInSample = 0

	var amount float32
	if delta >= 0 {
		amount = t.step
	} else {
		amount = -t.step
	}

	nextStepSize := amount * HILL_CLIMBER_STEP_DECAY_RATE
	if math.Abs(float64(delta)) >= 0.05 {
		nextStepSizeAbs := float32(t.capacity) * HILL_CLIMBER_STEP_PERCENT
		if amount >= 0 {
			nextStepSize = nextStepSizeAbs
		} else {
			nextStepSize = -nextStepSizeAbs
		}
	}

	t.step = nextStepSize
	t.amount = int(amount)
	// decrease protected, min protected is 0
	if t.amount > 0 && t.amount > int(t.slru.protected.capacity) {
		t.amount = int(t.slru.protected.capacity)
	}

	// decrease window, min window size is 1
	if t.amount < 0 && -t.amount > int(t.window.capacity-1) {
		t.amount = -int(t.window.capacity - 1)
	}
}

func (t *TinyLfu[K, V]) Set(entry *Entry[K, V]) {
	if uint(t.hitsInSample)+uint(t.missesInSample) > t.sketch.SampleSize {
		t.climb()
		t.resizeWindow()
	}

	t.weightedSize += uint(entry.policyWeight)

	if entry.meta.prev == nil {
		t.missesInSample++
		t.window.PushFront(entry)
	}

	t.demoteFromProtected()
	t.EvictEntries()

	if t.weightedSize <= t.capacity {
		count := t.slru.probation.count + t.slru.protected.count + t.window.count
		t.sketch.EnsureCapacity(uint(count))
	}
}

func (t *TinyLfu[K, V]) Access(item ReadBufItem[K, V]) {
	if uint(t.hitsInSample)+uint(t.missesInSample) > t.sketch.SampleSize {
		t.climb()
		t.resizeWindow()
	}

	if entry := item.entry; entry != nil {
		t.hitsInSample++
		t.sketch.Add(item.hash)
		if entry.meta.prev != nil {
			if entry.flag.IsWindow() {
				t.window.MoveToFront(entry)
			} else {
				t.slru.access(entry)
			}
		}
	}
	// Access may promote entry from probation to protected,
	// cause protected size larger then its capacity,
	// but we can delay demote until next set
	// because on Access the total size of cache won't change.
}

func (t *TinyLfu[K, V]) Remove(entry *Entry[K, V], callback bool) {
	if entry.flag.IsWindow() {
		t.window.Remove(entry)
	} else {
		t.slru.remove(entry)
	}
	t.weightedSize -= uint(entry.policyWeight)
	if callback {
		t.removeCallback(entry)
	}
}

func (t *TinyLfu[K, V]) UpdateCost(entry *Entry[K, V], weightChange int64) {
	// entry's policy weigh already updated
	// so update weightedSize to keep sync
	t.weightedSize += uint(weightChange)

	// update window/slru
	// if entry new weight > max size
	// evict immediately
	if entry.flag.IsWindow() {
		t.window.len += weightChange
		if entry.policyWeight > int64(t.capacity) {
			t.Remove(entry, true)
		} else {
			t.window.MoveToFront(entry)
		}
	} else {
		t.slru.updateCost(entry, weightChange)
		if entry.policyWeight > int64(t.capacity) {
			t.Remove(entry, true)
		} else {
			t.slru.access(entry)
		}
	}

	if t.weightedSize > t.capacity {
		t.EvictEntries()
	}
}

// move entry from protected to probation
func (t *TinyLfu[K, V]) demoteFromProtected() {
	for t.slru.protected.Len() > int(t.slru.protected.capacity) {
		entry := t.slru.protected.PopTail()
		t.slru.probation.PushFront(entry)
	}
}

func (t *TinyLfu[K, V]) evictFromWindow() *Entry[K, V] {
	var first *Entry[K, V]
	for t.window.Len() > int(t.window.capacity) {
		if victim := t.window.PopTail(); victim != nil {
			if first == nil {
				first = victim
			}
			t.slru.insert(victim)
		}
	}
	return first
}

func (t *TinyLfu[K, V]) admit(candidateKey, victimKey K) bool {
	victimFreq := t.sketch.Estimate(t.hasher.Hash(victimKey))
	candidateFreq := t.sketch.Estimate(t.hasher.Hash(candidateKey))
	if candidateFreq > victimFreq {
		return true
	} else if candidateFreq >= ADMIT_HASHDOS_THRESHOLD {
		// The maximum frequency is 15 and halved to 7 after a reset to age the history. An attack
		// exploits that a hot candidate is rejected in favor of a hot victim. The threshold of a warm
		// candidate reduces the number of random acceptances to minimize the impact on the hit rate.
		rand := xruntime.Fastrand()
		return (rand & 127) == 0
	}
	return false
}

// compare and evict entries until cache size fit.
// candidate is the first entry evicted from window,
// if head is null, start from last entry from window.
func (t *TinyLfu[K, V]) evictFromMain(candidate *Entry[K, V]) {
	victimQueue := LIST_PROBATION
	candidateQueue := LIST_PROBATION
	victim := t.slru.probation.Back()

	for t.weightedSize > t.capacity {
		if candidate == nil && candidateQueue == LIST_PROBATION {
			candidate = t.window.Back()
			candidateQueue = LIST_WINDOW
		}

		if candidate == nil && victim == nil {
			if victimQueue == LIST_PROBATION {
				victim = t.slru.protected.Back()
				victimQueue = LIST_PROTECTED
				continue
			} else if victimQueue == LIST_PROTECTED {
				victim = t.window.Back()
				victimQueue = LIST_WINDOW
				continue
			}
			break
		}

		if victim == nil {
			previous := candidate.PrevPolicy()
			evict := candidate
			candidate = previous
			t.Remove(evict, true)
			continue
		} else if candidate == nil {
			evict := victim
			victim = victim.PrevPolicy()
			t.Remove(evict, true)
			continue
		}

		if victim == candidate {
			victim = victim.PrevPolicy()
			t.Remove(candidate, true)
			candidate = nil
			continue
		}

		if candidate.policyWeight > int64(t.weightedSize) {
			evict := candidate
			candidate = candidate.PrevPolicy()
			t.Remove(evict, true)
			continue
		}

		if t.admit(candidate.key, victim.key) {
			evict := victim
			victim = victim.PrevPolicy()
			t.Remove(evict, true)
			candidate = candidate.PrevPolicy()
		} else {
			evict := candidate
			candidate = candidate.PrevPolicy()
			t.Remove(evict, true)
		}
	}
}

func (t *TinyLfu[K, V]) EvictEntries() {
	first := t.evictFromWindow()
	t.evictFromMain(first)
}
