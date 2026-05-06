// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package log // import "go.opentelemetry.io/otel/sdk/log"

// A ring is an element of a circular list, or ring. Rings do not have a
// beginning or end; a pointer to any ring element serves as reference to the
// entire ring. Empty rings are represented as nil ring pointers. The zero
// value for a ring is a one-element ring with a nil Value.
//
// This is copied from the "container/ring" package. It uses a Record type for
// Value instead of any to avoid allocations.
type ring struct {
	next, prev *ring
	Value      Record
}

func (r *ring) init() *ring {
	r.next = r
	r.prev = r
	return r
}

// Next returns the next ring element. r must not be empty.
func (r *ring) Next() *ring {
	if r.next == nil {
		return r.init()
	}
	return r.next
}

// Prev returns the previous ring element. r must not be empty.
func (r *ring) Prev() *ring {
	if r.next == nil {
		return r.init()
	}
	return r.prev
}

// newRing creates a ring of n elements.
func newRing(n int) *ring {
	if n <= 0 {
		return nil
	}
	r := new(ring)
	p := r
	for i := 1; i < n; i++ {
		p.next = &ring{prev: p}
		p = p.next
	}
	p.next = r
	r.prev = p
	return r
}

// Len computes the number of elements in ring r. It executes in time
// proportional to the number of elements.
func (r *ring) Len() int {
	n := 0
	if r != nil {
		n = 1
		for p := r.Next(); p != r; p = p.next {
			n++
		}
	}
	return n
}

// Do calls function f on each element of the ring, in forward order. The
// behavior of Do is undefined if f changes *r.
func (r *ring) Do(f func(Record)) {
	if r != nil {
		f(r.Value)
		for p := r.Next(); p != r; p = p.next {
			f(p.Value)
		}
	}
}
