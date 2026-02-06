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

import "github.com/maypok86/otter/internal/generated/node"

type Fixed[K comparable, V any] struct {
	q          *queue[K, V]
	deleteNode func(node.Node[K, V])
}

func NewFixed[K comparable, V any](deleteNode func(node.Node[K, V])) *Fixed[K, V] {
	return &Fixed[K, V]{
		q:          newQueue[K, V](),
		deleteNode: deleteNode,
	}
}

func (f *Fixed[K, V]) Add(n node.Node[K, V]) {
	f.q.push(n)
}

func (f *Fixed[K, V]) Delete(n node.Node[K, V]) {
	f.q.delete(n)
}

func (f *Fixed[K, V]) DeleteExpired() {
	for !f.q.isEmpty() && f.q.head.HasExpired() {
		f.deleteNode(f.q.pop())
	}
}

func (f *Fixed[K, V]) Clear() {
	f.q.clear()
}
