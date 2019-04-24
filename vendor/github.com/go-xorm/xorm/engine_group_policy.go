// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"math/rand"
	"sync"
	"time"
)

// GroupPolicy is be used by chosing the current slave from slaves
type GroupPolicy interface {
	Slave(*EngineGroup) *Engine
}

// GroupPolicyHandler should be used when a function is a GroupPolicy
type GroupPolicyHandler func(*EngineGroup) *Engine

// Slave implements the chosen of slaves
func (h GroupPolicyHandler) Slave(eg *EngineGroup) *Engine {
	return h(eg)
}

// RandomPolicy implmentes randomly chose the slave of slaves
func RandomPolicy() GroupPolicyHandler {
	var r = rand.New(rand.NewSource(time.Now().UnixNano()))
	return func(g *EngineGroup) *Engine {
		return g.Slaves()[r.Intn(len(g.Slaves()))]
	}
}

// WeightRandomPolicy implmentes randomly chose the slave of slaves
func WeightRandomPolicy(weights []int) GroupPolicyHandler {
	var rands = make([]int, 0, len(weights))
	for i := 0; i < len(weights); i++ {
		for n := 0; n < weights[i]; n++ {
			rands = append(rands, i)
		}
	}
	var r = rand.New(rand.NewSource(time.Now().UnixNano()))

	return func(g *EngineGroup) *Engine {
		var slaves = g.Slaves()
		idx := rands[r.Intn(len(rands))]
		if idx >= len(slaves) {
			idx = len(slaves) - 1
		}
		return slaves[idx]
	}
}

func RoundRobinPolicy() GroupPolicyHandler {
	var pos = -1
	var lock sync.Mutex
	return func(g *EngineGroup) *Engine {
		var slaves = g.Slaves()

		lock.Lock()
		defer lock.Unlock()
		pos++
		if pos >= len(slaves) {
			pos = 0
		}

		return slaves[pos]
	}
}

func WeightRoundRobinPolicy(weights []int) GroupPolicyHandler {
	var rands = make([]int, 0, len(weights))
	for i := 0; i < len(weights); i++ {
		for n := 0; n < weights[i]; n++ {
			rands = append(rands, i)
		}
	}
	var pos = -1
	var lock sync.Mutex

	return func(g *EngineGroup) *Engine {
		var slaves = g.Slaves()
		lock.Lock()
		defer lock.Unlock()
		pos++
		if pos >= len(rands) {
			pos = 0
		}

		idx := rands[pos]
		if idx >= len(slaves) {
			idx = len(slaves) - 1
		}
		return slaves[idx]
	}
}

// LeastConnPolicy implements GroupPolicy, every time will get the least connections slave
func LeastConnPolicy() GroupPolicyHandler {
	return func(g *EngineGroup) *Engine {
		var slaves = g.Slaves()
		connections := 0
		idx := 0
		for i := 0; i < len(slaves); i++ {
			openConnections := slaves[i].DB().Stats().OpenConnections
			if i == 0 {
				connections = openConnections
				idx = i
			} else if openConnections <= connections {
				connections = openConnections
				idx = i
			}
		}
		return slaves[idx]
	}
}
