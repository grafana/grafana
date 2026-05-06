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

type Disabled[K comparable, V any] struct{}

func NewDisabled[K comparable, V any]() *Disabled[K, V] {
	return &Disabled[K, V]{}
}

func (d *Disabled[K, V]) Add(n node.Node[K, V]) {
}

func (d *Disabled[K, V]) Delete(n node.Node[K, V]) {
}

func (d *Disabled[K, V]) DeleteExpired() {
}

func (d *Disabled[K, V]) Clear() {
}
