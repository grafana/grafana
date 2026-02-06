// Copyright (c) 2024 Alexey Mayshev. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package expiry

import (
	"math"
	"math/bits"
	"time"

	"github.com/maypok86/otter/internal/generated/node"
	"github.com/maypok86/otter/internal/unixtime"
	"github.com/maypok86/otter/internal/xmath"
)

var (
	buckets = []uint32{64, 64, 32, 4, 1}
	spans   = []uint32{
		xmath.RoundUpPowerOf2(uint32((1 * time.Second).Seconds())),             // 1s
		xmath.RoundUpPowerOf2(uint32((1 * time.Minute).Seconds())),             // 1.07m
		xmath.RoundUpPowerOf2(uint32((1 * time.Hour).Seconds())),               // 1.13h
		xmath.RoundUpPowerOf2(uint32((24 * time.Hour).Seconds())),              // 1.52d
		buckets[3] * xmath.RoundUpPowerOf2(uint32((24 * time.Hour).Seconds())), // 6.07d
		buckets[3] * xmath.RoundUpPowerOf2(uint32((24 * time.Hour).Seconds())), // 6.07d
	}
	shift = []uint32{
		uint32(bits.TrailingZeros32(spans[0])),
		uint32(bits.TrailingZeros32(spans[1])),
		uint32(bits.TrailingZeros32(spans[2])),
		uint32(bits.TrailingZeros32(spans[3])),
		uint32(bits.TrailingZeros32(spans[4])),
	}
)

type Variable[K comparable, V any] struct {
	wheel      [][]node.Node[K, V]
	time       uint32
	deleteNode func(node.Node[K, V])
}

func NewVariable[K comparable, V any](nodeManager *node.Manager[K, V], deleteNode func(node.Node[K, V])) *Variable[K, V] {
	wheel := make([][]node.Node[K, V], len(buckets))
	for i := 0; i < len(wheel); i++ {
		wheel[i] = make([]node.Node[K, V], buckets[i])
		for j := 0; j < len(wheel[i]); j++ {
			var k K
			var v V
			fn := nodeManager.Create(k, v, math.MaxUint32, 1)
			fn.SetPrevExp(fn)
			fn.SetNextExp(fn)
			wheel[i][j] = fn
		}
	}
	return &Variable[K, V]{
		wheel:      wheel,
		deleteNode: deleteNode,
	}
}

// findBucket determines the bucket that the timer event should be added to.
func (v *Variable[K, V]) findBucket(expiration uint32) node.Node[K, V] {
	duration := expiration - v.time
	length := len(v.wheel) - 1
	for i := 0; i < length; i++ {
		if duration < spans[i+1] {
			ticks := expiration >> shift[i]
			index := ticks & (buckets[i] - 1)
			return v.wheel[i][index]
		}
	}
	return v.wheel[length][0]
}

// Add schedules a timer event for the node.
func (v *Variable[K, V]) Add(n node.Node[K, V]) {
	root := v.findBucket(n.Expiration())
	link(root, n)
}

// Delete removes a timer event for this entry if present.
func (v *Variable[K, V]) Delete(n node.Node[K, V]) {
	unlink(n)
	n.SetNextExp(nil)
	n.SetPrevExp(nil)
}

func (v *Variable[K, V]) DeleteExpired() {
	currentTime := unixtime.Now()
	prevTime := v.time
	v.time = currentTime

	for i := 0; i < len(shift); i++ {
		previousTicks := prevTime >> shift[i]
		currentTicks := currentTime >> shift[i]
		delta := currentTicks - previousTicks
		if delta == 0 {
			break
		}

		v.deleteExpiredFromBucket(i, previousTicks, delta)
	}
}

func (v *Variable[K, V]) deleteExpiredFromBucket(index int, prevTicks, delta uint32) {
	mask := buckets[index] - 1
	steps := buckets[index]
	if delta < steps {
		steps = delta
	}
	start := prevTicks & mask
	end := start + steps
	timerWheel := v.wheel[index]
	for i := start; i < end; i++ {
		root := timerWheel[i&mask]
		n := root.NextExp()
		root.SetPrevExp(root)
		root.SetNextExp(root)

		for !node.Equals(n, root) {
			next := n.NextExp()
			n.SetPrevExp(nil)
			n.SetNextExp(nil)

			if n.Expiration() <= v.time {
				v.deleteNode(n)
			} else {
				v.Add(n)
			}

			n = next
		}
	}
}

func (v *Variable[K, V]) Clear() {
	for i := 0; i < len(v.wheel); i++ {
		for j := 0; j < len(v.wheel[i]); j++ {
			root := v.wheel[i][j]
			n := root.NextExp()
			// NOTE(maypok86): Maybe we should use the same approach as in DeleteExpired?

			for !node.Equals(n, root) {
				next := n.NextExp()
				v.Delete(n)

				n = next
			}
		}
	}
	v.time = unixtime.Now()
}

// link adds the entry at the tail of the bucket's list.
func link[K comparable, V any](root, n node.Node[K, V]) {
	n.SetPrevExp(root.PrevExp())
	n.SetNextExp(root)

	root.PrevExp().SetNextExp(n)
	root.SetPrevExp(n)
}

// unlink removes the entry from its bucket, if scheduled.
func unlink[K comparable, V any](n node.Node[K, V]) {
	next := n.NextExp()
	if !node.Equals(next, nil) {
		prev := n.PrevExp()
		next.SetPrevExp(prev)
		prev.SetNextExp(next)
	}
}
