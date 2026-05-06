// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"fmt"
	"math"
	"sync"
	"time"
)

// dynamicDelay dynamically calculates the delay at a fixed percentile, based on
// delay samples.
//
// dynamicDelay is goroutine-safe.
type dynamicDelay struct {
	increaseFactor float64
	decreaseFactor float64
	minDelay       time.Duration
	maxDelay       time.Duration
	value          time.Duration

	// Guards the value
	mu *sync.RWMutex
}

// validateDynamicDelayParams ensures,
// targetPercentile is a valid fraction (between 0 and 1).
// increaseRate is a positive number.
// minDelay is less than maxDelay.
func validateDynamicDelayParams(targetPercentile, increaseRate float64, minDelay, maxDelay time.Duration) error {
	if targetPercentile < 0 || targetPercentile > 1 {
		return fmt.Errorf("invalid targetPercentile (%v): must be within [0, 1]", targetPercentile)
	}
	if increaseRate <= 0 {
		return fmt.Errorf("invalid increaseRate (%v): must be > 0", increaseRate)
	}
	if minDelay >= maxDelay {
		return fmt.Errorf("invalid minDelay (%v) and maxDelay (%v) combination: minDelay must be smaller than maxDelay", minDelay, maxDelay)
	}
	return nil
}

// NewDynamicDelay returns a dynamicDelay.
//
// targetPercentile is the desired percentile to be computed. For example, a
// targetPercentile of 0.99 computes the delay at the 99th percentile. Must be
// in the range [0, 1].
//
// increaseRate (must be > 0) determines how many increase calls it takes for
// Value to double.
//
// initialDelay is the start value of the delay.
//
// decrease can never lower the delay past minDelay, increase can never raise
// the delay past maxDelay.
func newDynamicDelay(targetPercentile float64, increaseRate float64, initialDelay, minDelay, maxDelay time.Duration) *dynamicDelay {
	if initialDelay < minDelay {
		initialDelay = minDelay
	}
	if initialDelay > maxDelay {
		initialDelay = maxDelay
	}

	// Compute increaseFactor and decreaseFactor such that:
	// (increaseFactor ^ (1 - targetPercentile)) * (decreaseFactor ^ targetPercentile) = 1
	increaseFactor := math.Exp(math.Log(2) / increaseRate)
	if increaseFactor < 1.001 {
		increaseFactor = 1.001
	}
	decreaseFactor := math.Exp(-math.Log(increaseFactor) * (1 - targetPercentile) / targetPercentile)
	if decreaseFactor > 0.9999 {
		decreaseFactor = 0.9999
	}

	return &dynamicDelay{
		increaseFactor: increaseFactor,
		decreaseFactor: decreaseFactor,
		minDelay:       minDelay,
		maxDelay:       maxDelay,
		value:          initialDelay,
		mu:             &sync.RWMutex{},
	}
}

func (d *dynamicDelay) unsafeIncrease() {
	v := time.Duration(float64(d.value) * d.increaseFactor)
	if v > d.maxDelay {
		d.value = d.maxDelay
	} else {
		d.value = v
	}
}

// increase notes that the operation took longer than the delay returned by Value.
func (d *dynamicDelay) increase() {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.unsafeIncrease()
}

func (d *dynamicDelay) unsafeDecrease() {
	v := time.Duration(float64(d.value) * d.decreaseFactor)
	if v < d.minDelay {
		d.value = d.minDelay
	} else {
		d.value = v
	}
}

// decrease notes that the operation completed before the delay returned by getValue.
func (d *dynamicDelay) decrease() {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.unsafeDecrease()
}

// update updates the delay value depending on the specified latency.
func (d *dynamicDelay) update(latency time.Duration) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if latency > d.value {
		d.unsafeIncrease()
	} else {
		d.unsafeDecrease()
	}
}

// getValue returns the desired delay to wait before retry the operation.
func (d *dynamicDelay) getValue() time.Duration {
	d.mu.RLock()
	defer d.mu.RUnlock()

	return d.value
}

// printDelay prints the state of delay, helpful in debugging.
func (d *dynamicDelay) printDelay() {
	d.mu.RLock()
	defer d.mu.RUnlock()

	fmt.Println("IncreaseFactor: ", d.increaseFactor)
	fmt.Println("DecreaseFactor: ", d.decreaseFactor)
	fmt.Println("MinDelay: ", d.minDelay)
	fmt.Println("MaxDelay: ", d.maxDelay)
	fmt.Println("Value: ", d.value)
}

// bucketDelayManager wraps dynamicDelay to provide bucket-specific delays.
type bucketDelayManager struct {
	targetPercentile float64
	increaseRate     float64
	initialDelay     time.Duration
	minDelay         time.Duration
	maxDelay         time.Duration

	// delays maps bucket names to their dynamic delay instance.
	delays map[string]*dynamicDelay

	// mu guards delays.
	mu *sync.RWMutex
}

// newBucketDelayManager returns a new bucketDelayManager instance.
func newBucketDelayManager(targetPercentile float64, increaseRate float64, initialDelay, minDelay, maxDelay time.Duration) (*bucketDelayManager, error) {
	err := validateDynamicDelayParams(targetPercentile, increaseRate, minDelay, maxDelay)
	if err != nil {
		return nil, err
	}

	return &bucketDelayManager{
		targetPercentile: targetPercentile,
		increaseRate:     increaseRate,
		initialDelay:     initialDelay,
		minDelay:         minDelay,
		maxDelay:         maxDelay,
		delays:           make(map[string]*dynamicDelay),
		mu:               &sync.RWMutex{},
	}, nil
}

// getDelay retrieves the dynamicDelay instance for the given bucket name. If no delay
// exists for the bucket, a new one is created with the configured parameters.
func (b *bucketDelayManager) getDelay(bucketName string) *dynamicDelay {
	b.mu.RLock()
	delay, ok := b.delays[bucketName]
	b.mu.RUnlock()

	if !ok {
		b.mu.Lock()
		defer b.mu.Unlock()

		// Check again, as someone might create b/w the execution of mu.RUnlock() and mu.Lock().
		delay, ok = b.delays[bucketName]
		if !ok {
			// Create a new dynamicDelay for the bucket if it doesn't exist
			delay = newDynamicDelay(b.targetPercentile, b.increaseRate, b.initialDelay, b.minDelay, b.maxDelay)
			b.delays[bucketName] = delay
		}
	}
	return delay
}

// increase notes that the operation took longer than the delay for the given bucket.
func (b *bucketDelayManager) increase(bucketName string) {
	b.getDelay(bucketName).increase()
}

// decrease notes that the operation completed before the delay for the given bucket.
func (b *bucketDelayManager) decrease(bucketName string) {
	b.getDelay(bucketName).decrease()
}

// update updates the delay value for the bucket depending on the specified latency.
func (b *bucketDelayManager) update(bucketName string, latency time.Duration) {
	b.getDelay(bucketName).update(latency)
}

// getValue returns the desired delay to wait before retrying the operation for the given bucket.
func (b *bucketDelayManager) getValue(bucketName string) time.Duration {
	return b.getDelay(bucketName).getValue()
}
