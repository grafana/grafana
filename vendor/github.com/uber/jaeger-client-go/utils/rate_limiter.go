// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"sync"
	"time"
)

// RateLimiter is a filter used to check if a message that is worth itemCost units is within the rate limits.
//
// TODO (breaking change) remove this interface in favor of public struct below
//
// Deprecated, use ReconfigurableRateLimiter.
type RateLimiter interface {
	CheckCredit(itemCost float64) bool
}

// ReconfigurableRateLimiter is a rate limiter based on leaky bucket algorithm, formulated in terms of a
// credits balance that is replenished every time CheckCredit() method is called (tick) by the amount proportional
// to the time elapsed since the last tick, up to max of creditsPerSecond. A call to CheckCredit() takes a cost
// of an item we want to pay with the balance. If the balance exceeds the cost of the item, the item is "purchased"
// and the balance reduced, indicated by returned value of true. Otherwise the balance is unchanged and return false.
//
// This can be used to limit a rate of messages emitted by a service by instantiating the Rate Limiter with the
// max number of messages a service is allowed to emit per second, and calling CheckCredit(1.0) for each message
// to determine if the message is within the rate limit.
//
// It can also be used to limit the rate of traffic in bytes, by setting creditsPerSecond to desired throughput
// as bytes/second, and calling CheckCredit() with the actual message size.
//
// TODO (breaking change) rename to RateLimiter once the interface is removed
type ReconfigurableRateLimiter struct {
	lock sync.Mutex

	creditsPerSecond float64
	balance          float64
	maxBalance       float64
	lastTick         time.Time

	timeNow func() time.Time
}

// NewRateLimiter creates a new ReconfigurableRateLimiter.
func NewRateLimiter(creditsPerSecond, maxBalance float64) *ReconfigurableRateLimiter {
	return &ReconfigurableRateLimiter{
		creditsPerSecond: creditsPerSecond,
		balance:          maxBalance,
		maxBalance:       maxBalance,
		lastTick:         time.Now(),
		timeNow:          time.Now,
	}
}

// CheckCredit tries to reduce the current balance by itemCost provided that the current balance
// is not lest than itemCost.
func (rl *ReconfigurableRateLimiter) CheckCredit(itemCost float64) bool {
	rl.lock.Lock()
	defer rl.lock.Unlock()

	// if we have enough credits to pay for current item, then reduce balance and allow
	if rl.balance >= itemCost {
		rl.balance -= itemCost
		return true
	}
	// otherwise check if balance can be increased due to time elapsed, and try again
	rl.updateBalance()
	if rl.balance >= itemCost {
		rl.balance -= itemCost
		return true
	}
	return false
}

// updateBalance recalculates current balance based on time elapsed. Must be called while holding a lock.
func (rl *ReconfigurableRateLimiter) updateBalance() {
	// calculate how much time passed since the last tick, and update current tick
	currentTime := rl.timeNow()
	elapsedTime := currentTime.Sub(rl.lastTick)
	rl.lastTick = currentTime
	// calculate how much credit have we accumulated since the last tick
	rl.balance += elapsedTime.Seconds() * rl.creditsPerSecond
	if rl.balance > rl.maxBalance {
		rl.balance = rl.maxBalance
	}
}

// Update changes the main parameters of the rate limiter in-place, while retaining
// the current accumulated balance (pro-rated to the new maxBalance value). Using this method
// instead of creating a new rate limiter helps to avoid thundering herd when sampling
// strategies are updated.
func (rl *ReconfigurableRateLimiter) Update(creditsPerSecond, maxBalance float64) {
	rl.lock.Lock()
	defer rl.lock.Unlock()

	rl.updateBalance() // get up to date balance
	rl.balance = rl.balance * maxBalance / rl.maxBalance
	rl.creditsPerSecond = creditsPerSecond
	rl.maxBalance = maxBalance
}
