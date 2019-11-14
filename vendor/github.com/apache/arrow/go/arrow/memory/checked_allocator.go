// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package memory

type CheckedAllocator struct {
	mem  Allocator
	base int
	sz   int
}

func NewCheckedAllocator(mem Allocator) *CheckedAllocator {
	return &CheckedAllocator{mem: mem}
}

func (a *CheckedAllocator) Allocate(size int) []byte {
	a.sz += size
	return a.mem.Allocate(size)
}

func (a *CheckedAllocator) Reallocate(size int, b []byte) []byte {
	a.sz += size - len(b)
	return a.mem.Reallocate(size, b)
}

func (a *CheckedAllocator) Free(b []byte) {
	a.sz -= len(b)
	a.mem.Free(b)
}

type TestingT interface {
	Errorf(format string, args ...interface{})
	Helper()
}

func (a *CheckedAllocator) AssertSize(t TestingT, sz int) {
	if a.sz != sz {
		t.Helper()
		t.Errorf("invalid memory size exp=%d, got=%d", sz, a.sz)
	}
}

type CheckedAllocatorScope struct {
	alloc *CheckedAllocator
	sz    int
}

func NewCheckedAllocatorScope(alloc *CheckedAllocator) *CheckedAllocatorScope {
	return &CheckedAllocatorScope{alloc: alloc, sz: alloc.sz}
}

func (c *CheckedAllocatorScope) CheckSize(t TestingT) {
	if c.sz != c.alloc.sz {
		t.Helper()
		t.Errorf("invalid memory size exp=%d, got=%d", c.sz, c.alloc.sz)
	}
}

var (
	_ Allocator = (*CheckedAllocator)(nil)
)
