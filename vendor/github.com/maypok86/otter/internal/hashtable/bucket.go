// Copyright (c) 2023 Alexey Mayshev. All rights reserved.
// Copyright (c) 2021 Andrey Pechkurov
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
//
// Copyright notice. This code is a fork of xsync.MapOf from this file with some changes:
// https://github.com/puzpuzpuz/xsync/blob/main/mapof.go
//
// Use of this source code is governed by a MIT license that can be found
// at https://github.com/puzpuzpuz/xsync/blob/main/LICENSE

package hashtable

import (
	"sync"
	"unsafe"

	"github.com/maypok86/otter/internal/xruntime"
)

// paddedBucket is a CL-sized map bucket holding up to
// bucketSize nodes.
type paddedBucket struct {
	// ensure each bucket takes two cache lines on both 32 and 64-bit archs
	padding [xruntime.CacheLineSize - unsafe.Sizeof(bucket{})]byte

	bucket
}

type bucket struct {
	hashes [bucketSize]uint64
	nodes  [bucketSize]unsafe.Pointer
	next   unsafe.Pointer
	mutex  sync.Mutex
}

func (root *paddedBucket) isEmpty() bool {
	b := root
	for {
		for i := 0; i < bucketSize; i++ {
			if b.nodes[i] != nil {
				return false
			}
		}
		if b.next == nil {
			return true
		}
		b = (*paddedBucket)(b.next)
	}
}

func (root *paddedBucket) add(h uint64, nodePtr unsafe.Pointer) {
	b := root
	for {
		for i := 0; i < bucketSize; i++ {
			if b.nodes[i] == nil {
				b.hashes[i] = h
				b.nodes[i] = nodePtr
				return
			}
		}
		if b.next == nil {
			newBucket := &paddedBucket{}
			newBucket.hashes[0] = h
			newBucket.nodes[0] = nodePtr
			b.next = unsafe.Pointer(newBucket)
			return
		}
		b = (*paddedBucket)(b.next)
	}
}
