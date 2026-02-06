// Copyright 2017 The Memory Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package memory implements a memory allocator.
//
// # Build status
//
// available at https://modern-c.appspot.com/-/builder/?importpath=modernc.org%2fmemory
//
// # Changelog
//
// 2017-10-03 Added alternative, unsafe.Pointer-based API.
//
// Package memory implements a memory allocator.
//
// # Changelog
//
// 2017-10-03 Added alternative, unsafe.Pointer-based API.
//
// # Benchmarks
//
//	jnml@3900x:~/src/modernc.org/memory$ date ; go version ; go test -run @ -bench . -benchmem |& tee log
//	Mon Sep 25 16:02:02 CEST 2023
//	go version go1.21.1 linux/amd64
//	goos: linux
//	goarch: amd64
//	pkg: modernc.org/memory
//	cpu: AMD Ryzen 9 3900X 12-Core Processor
//	BenchmarkFree16-24             	123506772	         9.802 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkFree32-24             	73853230	        15.08 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkFree64-24             	43070334	        25.15 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkCalloc16-24           	59353304	        18.92 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkCalloc32-24           	39415004	        29.00 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkCalloc64-24           	35825725	        32.02 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkGoCalloc16-24         	38274313	        26.99 ns/op	      16 B/op	       1 allocs/op
//	BenchmarkGoCalloc32-24         	44590477	        33.06 ns/op	      32 B/op	       1 allocs/op
//	BenchmarkGoCalloc64-24         	44233016	        37.20 ns/op	      64 B/op	       1 allocs/op
//	BenchmarkMalloc16-24           	145736911	         7.720 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkMalloc32-24           	128898334	         7.887 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkMalloc64-24           	149569483	         7.994 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrFree16-24      	117043012	         9.205 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrFree32-24      	77399617	        14.20 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrFree64-24      	48770785	        25.04 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrCalloc16-24    	79257636	        15.44 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrCalloc32-24    	49644562	        23.62 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrCalloc64-24    	39854710	        28.22 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrMalloc16-24    	252987727	         4.525 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrMalloc32-24    	241423840	         4.433 ns/op	       0 B/op	       0 allocs/op
//	BenchmarkUintptrMalloc64-24    	256450324	         4.669 ns/op	       0 B/op	       0 allocs/op
//	PASS
//	ok  	modernc.org/memory	93.178s
//	jnml@3900x:~/src/modernc.org/memory$
package memory // import "modernc.org/memory"

import (
	"fmt"
	"math/bits"
	"os"
	"unsafe"
)

const (
	headerSize     = unsafe.Sizeof(page{})
	mallocAllign   = 2 * unsafe.Sizeof(uintptr(0))
	maxSlotSize    = 1 << maxSlotSizeLog
	maxSlotSizeLog = pageSizeLog - 2
	pageAvail      = pageSize - headerSize
	pageMask       = pageSize - 1
	pageSize       = 1 << pageSizeLog
)

func init() {
	if unsafe.Sizeof(page{})%mallocAllign != 0 {
		panic("internal error")
	}
}

// if n%m != 0 { n += m-n%m }. m must be a power of 2.
func roundup(n, m int) int { return (n + m - 1) &^ (m - 1) }

type node struct {
	prev, next uintptr // *node
}

type page struct {
	brk  int
	log  uint
	size int
	used int
}

// Allocator allocates and frees memory. Its zero value is ready for use.  The
// exported counters are updated only when build tag memory.counters is
// present.
type Allocator struct {
	Allocs int // # of allocs.
	Bytes  int // Asked from OS.
	cap    [64]int
	lists  [64]uintptr          // *node
	Mmaps  int                  // Asked from OS.
	pages  [64]uintptr          // *page
	regs   map[uintptr]struct{} // map[*page]struct{}
}

func (a *Allocator) mmap(size int) (uintptr /* *page */, error) {
	p, size, err := mmap(size)
	if err != nil {
		return 0, err
	}

	//TODO(jnml) The returned size may now be nearly as twice as large as we asked
	//for. Use that extra capacity. For that we need to move the respective
	//Allocator.cap item into the page struct so the page cap becomes dynamic.
	//
	// Related: This is a consequence of fixing the bigsort.test failures on
	// linux/s390x, see: https://gitlab.com/cznic/sqlite/-/issues/207
	if counters {
		a.Mmaps++
		a.Bytes += size
	}
	if a.regs == nil {
		a.regs = map[uintptr]struct{}{}
	}
	(*page)(unsafe.Pointer(p)).size = size
	a.regs[p] = struct{}{}
	return p, nil
}

func (a *Allocator) newPage(size int) (uintptr /* *page */, error) {
	size += int(headerSize)
	p, err := a.mmap(size)
	if err != nil {
		return 0, err
	}

	(*page)(unsafe.Pointer(p)).log = 0
	return p, nil
}

func (a *Allocator) newSharedPage(log uint) (uintptr /* *page */, error) {
	if a.cap[log] == 0 {
		a.cap[log] = int(pageAvail) / (1 << log)
	}
	size := int(headerSize) + a.cap[log]<<log
	p, err := a.mmap(size)
	if err != nil {
		return 0, err
	}

	a.pages[log] = p
	(*page)(unsafe.Pointer(p)).log = log
	return p, nil
}

func (a *Allocator) unmap(p uintptr /* *page */) error {
	delete(a.regs, p)
	if counters {
		a.Mmaps--
	}
	return unmap(p, (*page)(unsafe.Pointer(p)).size)
}

// UintptrCalloc is like Calloc except it returns an uintptr.
func (a *Allocator) UintptrCalloc(size int) (r uintptr, err error) {
	if trace {
		defer func() {
			fmt.Fprintf(os.Stderr, "Calloc(%#x) %#x, %v\n", size, r, err)
		}()
	}
	if r, err = a.UintptrMalloc(size); r == 0 || err != nil {
		return 0, err
	}
	b := ((*rawmem)(unsafe.Pointer(r)))[:size:size]
	for i := range b {
		b[i] = 0
	}
	return r, nil
}

// UintptrFree is like Free except its argument is an uintptr, which must have
// been acquired from UintptrCalloc or UintptrMalloc or UintptrRealloc.
func (a *Allocator) UintptrFree(p uintptr) (err error) {
	if trace {
		defer func() {
			fmt.Fprintf(os.Stderr, "Free(%#x) %v\n", p, err)
		}()
	}
	if p == 0 {
		return nil
	}

	if counters {
		a.Allocs--
	}
	pg := p &^ uintptr(pageMask)
	log := (*page)(unsafe.Pointer(pg)).log
	if log == 0 {
		if counters {
			a.Bytes -= (*page)(unsafe.Pointer(pg)).size
		}
		return a.unmap(pg)
	}

	(*node)(unsafe.Pointer(p)).prev = 0
	(*node)(unsafe.Pointer(p)).next = a.lists[log]
	if next := (*node)(unsafe.Pointer(p)).next; next != 0 {
		(*node)(unsafe.Pointer(next)).prev = p
	}
	a.lists[log] = p
	(*page)(unsafe.Pointer(pg)).used--
	if (*page)(unsafe.Pointer(pg)).used != 0 {
		return nil
	}

	for i := 0; i < (*page)(unsafe.Pointer(pg)).brk; i++ {
		n := pg + headerSize + uintptr(i)<<log
		next := (*node)(unsafe.Pointer(n)).next
		prev := (*node)(unsafe.Pointer(n)).prev
		switch {
		case prev == 0:
			a.lists[log] = next
			if next != 0 {
				(*node)(unsafe.Pointer(next)).prev = 0
			}
		case next == 0:
			(*node)(unsafe.Pointer(prev)).next = 0
		default:
			(*node)(unsafe.Pointer(prev)).next = next
			(*node)(unsafe.Pointer(next)).prev = prev
		}
	}

	if a.pages[log] == pg {
		a.pages[log] = 0
	}
	if counters {
		a.Bytes -= (*page)(unsafe.Pointer(pg)).size
	}
	return a.unmap(pg)
}

// UintptrMalloc is like Malloc except it returns an uinptr.
func (a *Allocator) UintptrMalloc(size int) (r uintptr, err error) {
	if trace {
		defer func() {
			fmt.Fprintf(os.Stderr, "Malloc(%#x) %#x, %v\n", size, r, err)
		}()
	}
	if size < 0 {
		panic("invalid malloc size")
	}

	if size == 0 {
		return 0, nil
	}

	if counters {
		a.Allocs++
	}
	log := uint(bits.Len(uint((size+int(mallocAllign)-1)&^int(mallocAllign-1) - 1)))
	if log > maxSlotSizeLog {
		p, err := a.newPage(size)
		if err != nil {
			return 0, err
		}

		return p + headerSize, nil
	}

	if a.lists[log] == 0 && a.pages[log] == 0 {
		if _, err := a.newSharedPage(log); err != nil {
			return 0, err
		}
	}

	if p := a.pages[log]; p != 0 {
		(*page)(unsafe.Pointer(p)).used++
		(*page)(unsafe.Pointer(p)).brk++
		if (*page)(unsafe.Pointer(p)).brk == a.cap[log] {
			a.pages[log] = 0
		}
		return p + headerSize + uintptr((*page)(unsafe.Pointer(p)).brk-1)<<log, nil
	}

	n := a.lists[log]
	p := n &^ uintptr(pageMask)
	a.lists[log] = (*node)(unsafe.Pointer(n)).next
	if next := (*node)(unsafe.Pointer(n)).next; next != 0 {
		(*node)(unsafe.Pointer(next)).prev = 0
	}
	(*page)(unsafe.Pointer(p)).used++
	return n, nil
}

// UintptrRealloc is like Realloc except its first argument is an uintptr,
// which must have been returned from UintptrCalloc, UintptrMalloc or
// UintptrRealloc.
func (a *Allocator) UintptrRealloc(p uintptr, size int) (r uintptr, err error) {
	if trace {
		defer func() {
			fmt.Fprintf(os.Stderr, "UnsafeRealloc(%#x, %#x) %#x, %v\n", p, size, r, err)
		}()
	}
	switch {
	case p == 0:
		return a.UintptrMalloc(size)
	case size == 0 && p != 0:
		return 0, a.UintptrFree(p)
	}

	us := UintptrUsableSize(p)
	if us >= size {
		return p, nil
	}

	if r, err = a.UintptrMalloc(size); err != nil {
		return 0, err
	}

	if us < size {
		size = us
	}
	copy((*rawmem)(unsafe.Pointer(r))[:size:size], (*rawmem)(unsafe.Pointer(p))[:size:size])
	return r, a.UintptrFree(p)
}

// UintptrUsableSize is like UsableSize except its argument is an uintptr,
// which must have been returned from UintptrCalloc, UintptrMalloc or
// UintptrRealloc.
func UintptrUsableSize(p uintptr) (r int) {
	if trace {
		defer func() {
			fmt.Fprintf(os.Stderr, "UsableSize(%#x) %#x\n", p, r)
		}()
	}
	if p == 0 {
		return 0
	}

	return usableSize(p)
}

func usableSize(p uintptr) (r int) {
	pg := p &^ uintptr(pageMask)
	if log := (*page)(unsafe.Pointer(pg)).log; log != 0 {
		return 1 << log
	}

	return (*page)(unsafe.Pointer(pg)).size - int(headerSize)
}

// Calloc is like Malloc except the allocated memory is zeroed.
func (a *Allocator) Calloc(size int) (r []byte, err error) {
	p, err := a.UintptrCalloc(size)
	if err != nil {
		return nil, err
	}

	return (*rawmem)(unsafe.Pointer(p))[:size:usableSize(p)], nil
}

// Close releases all OS resources used by a and sets it to its zero value.
//
// It's not necessary to Close the Allocator when exiting a process.
func (a *Allocator) Close() (err error) {
	for p := range a.regs {
		if e := a.unmap(p); e != nil && err == nil {
			err = e
		}
	}
	*a = Allocator{}
	return err
}

// Free deallocates memory (as in C.free). The argument of Free must have been
// acquired from Calloc or Malloc or Realloc.
func (a *Allocator) Free(b []byte) (err error) {
	if b = b[:cap(b)]; len(b) == 0 {
		return nil
	}

	return a.UintptrFree(uintptr(unsafe.Pointer(&b[0])))
}

// Malloc allocates size bytes and returns a byte slice of the allocated
// memory. The memory is not initialized. Malloc panics for size < 0 and
// returns (nil, nil) for zero size.
//
// It's ok to reslice the returned slice but the result of appending to it
// cannot be passed to Free or Realloc as it may refer to a different backing
// array afterwards.
func (a *Allocator) Malloc(size int) (r []byte, err error) {
	p, err := a.UintptrMalloc(size)
	if p == 0 || err != nil {
		return nil, err
	}

	return (*rawmem)(unsafe.Pointer(p))[:size:usableSize(p)], nil
}

// Realloc changes the size of the backing array of b to size bytes or returns
// an error, if any.  The contents will be unchanged in the range from the
// start of the region up to the minimum of the old and new  sizes.   If the
// new size is larger than the old size, the added memory will not be
// initialized.  If b's backing array is of zero size, then the call is
// equivalent to Malloc(size), for all values of size; if size is equal to
// zero, and b's backing array is not of zero size, then the call is equivalent
// to Free(b).  Unless b's backing array is of zero size, it must have been
// returned by an earlier call to Malloc, Calloc or Realloc.  If the area
// pointed to was moved, a Free(b) is done.
func (a *Allocator) Realloc(b []byte, size int) (r []byte, err error) {
	var p uintptr
	if b = b[:cap(b)]; len(b) != 0 {
		p = uintptr(unsafe.Pointer(&b[0]))
	}
	if p, err = a.UintptrRealloc(p, size); p == 0 || err != nil {
		return nil, err
	}

	return (*rawmem)(unsafe.Pointer(p))[:size:usableSize(p)], nil
}

// UsableSize reports the size of the memory block allocated at p, which must
// point to the first byte of a slice returned from Calloc, Malloc or Realloc.
// The allocated memory block size can be larger than the size originally
// requested from Calloc, Malloc or Realloc.
func UsableSize(p *byte) (r int) { return UintptrUsableSize(uintptr(unsafe.Pointer(p))) }

// UnsafeCalloc is like Calloc except it returns an unsafe.Pointer.
func (a *Allocator) UnsafeCalloc(size int) (r unsafe.Pointer, err error) {
	p, err := a.UintptrCalloc(size)
	if err != nil {
		return nil, err
	}

	return unsafe.Pointer(p), nil
}

// UnsafeFree is like Free except its argument is an unsafe.Pointer, which must
// have been acquired from UnsafeCalloc or UnsafeMalloc or UnsafeRealloc.
func (a *Allocator) UnsafeFree(p unsafe.Pointer) (err error) { return a.UintptrFree(uintptr(p)) }

// UnsafeMalloc is like Malloc except it returns an unsafe.Pointer.
func (a *Allocator) UnsafeMalloc(size int) (r unsafe.Pointer, err error) {
	p, err := a.UintptrMalloc(size)
	if err != nil {
		return nil, err
	}

	return unsafe.Pointer(p), nil
}

// UnsafeRealloc is like Realloc except its first argument is an
// unsafe.Pointer, which must have been returned from UnsafeCalloc,
// UnsafeMalloc or UnsafeRealloc.
func (a *Allocator) UnsafeRealloc(p unsafe.Pointer, size int) (r unsafe.Pointer, err error) {
	q, err := a.UintptrRealloc(uintptr(p), size)
	if err != nil {
		return nil, err
	}

	return unsafe.Pointer(q), nil
}

// UnsafeUsableSize is like UsableSize except its argument is an
// unsafe.Pointer, which must have been returned from UnsafeCalloc,
// UnsafeMalloc or UnsafeRealloc.
func UnsafeUsableSize(p unsafe.Pointer) (r int) { return UintptrUsableSize(uintptr(p)) }
