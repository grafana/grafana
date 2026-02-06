// Copyright (c) 2023 Alexey Mayshev. All rights reserved.
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

package core

import (
	"github.com/maypok86/otter/internal/generated/node"
)

// reason represents the reason for writing the item to the cache.
type reason uint8

const (
	addReason reason = iota + 1
	deleteReason
	updateReason
	clearReason
	closeReason
	expiredReason
)

// task is a set of information to update the cache:
// node, reason for write, difference after node cost change, etc.
type task[K comparable, V any] struct {
	n           node.Node[K, V]
	old         node.Node[K, V]
	writeReason reason
}

// newAddTask creates a task to add a node to policies.
func newAddTask[K comparable, V any](n node.Node[K, V]) task[K, V] {
	return task[K, V]{
		n:           n,
		writeReason: addReason,
	}
}

// newDeleteTask creates a task to delete a node from policies.
func newDeleteTask[K comparable, V any](n node.Node[K, V]) task[K, V] {
	return task[K, V]{
		n:           n,
		writeReason: deleteReason,
	}
}

// newExpireTask creates a task to delete a expired node from policies.
func newExpiredTask[K comparable, V any](n node.Node[K, V]) task[K, V] {
	return task[K, V]{
		n:           n,
		writeReason: expiredReason,
	}
}

// newUpdateTask creates a task to update the node in the policies.
func newUpdateTask[K comparable, V any](n, oldNode node.Node[K, V]) task[K, V] {
	return task[K, V]{
		n:           n,
		old:         oldNode,
		writeReason: updateReason,
	}
}

// newClearTask creates a task to clear policies.
func newClearTask[K comparable, V any]() task[K, V] {
	return task[K, V]{
		writeReason: clearReason,
	}
}

// newCloseTask creates a task to clear policies and stop all goroutines.
func newCloseTask[K comparable, V any]() task[K, V] {
	return task[K, V]{
		writeReason: closeReason,
	}
}

// node returns the node contained in the task. If node was not specified, it returns nil.
func (t *task[K, V]) node() node.Node[K, V] {
	return t.n
}

// oldNode returns the old node contained in the task. If old node was not specified, it returns nil.
func (t *task[K, V]) oldNode() node.Node[K, V] {
	return t.old
}

// isAdd returns true if this is an add task.
func (t *task[K, V]) isAdd() bool {
	return t.writeReason == addReason
}

// isDelete returns true if this is a delete task.
func (t *task[K, V]) isDelete() bool {
	return t.writeReason == deleteReason
}

// isExpired returns true if this is an expired task.
func (t *task[K, V]) isExpired() bool {
	return t.writeReason == expiredReason
}

// isUpdate returns true if this is an update task.
func (t *task[K, V]) isUpdate() bool {
	return t.writeReason == updateReason
}

// isClear returns true if this is a clear task.
func (t *task[K, V]) isClear() bool {
	return t.writeReason == clearReason
}

// isClose returns true if this is a close task.
func (t *task[K, V]) isClose() bool {
	return t.writeReason == closeReason
}
