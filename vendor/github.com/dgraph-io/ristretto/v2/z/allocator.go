/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package z

import (
	"bytes"
	"fmt"
	"math"
	"math/bits"
	"math/rand"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/dustin/go-humanize"
)

// Allocator amortizes the cost of small allocations by allocating memory in
// bigger chunks.  Internally it uses z.Calloc to allocate memory. Once
// allocated, the memory is not moved, so it is safe to use the allocated bytes
// to unsafe cast them to Go struct pointers. Maintaining a freelist is slow.
// Instead, Allocator only allocates memory, with the idea that finally we
// would just release the entire Allocator.
type Allocator struct {
	sync.Mutex
	compIdx uint64 // Stores bufIdx in 32 MSBs and posIdx in 32 LSBs.
	buffers [][]byte
	Ref     uint64
	Tag     string
}

// allocs keeps references to all Allocators, so we can safely discard them later.
var allocsMu *sync.Mutex
var allocRef uint64
var allocs map[uint64]*Allocator
var calculatedLog2 []int

func init() {
	allocsMu = new(sync.Mutex)
	allocs = make(map[uint64]*Allocator)

	// Set up a unique Ref per process.
	allocRef = uint64(rand.Int63n(1<<16)) << 48
	calculatedLog2 = make([]int, 1025)
	for i := 1; i <= 1024; i++ {
		calculatedLog2[i] = int(math.Log2(float64(i)))
	}
}

// NewAllocator creates an allocator starting with the given size.
func NewAllocator(sz int, tag string) *Allocator {
	ref := atomic.AddUint64(&allocRef, 1)
	// We should not allow a zero sized page because addBufferWithMinSize
	// will run into an infinite loop trying to double the pagesize.
	if sz < 512 {
		sz = 512
	}
	a := &Allocator{
		Ref:     ref,
		buffers: make([][]byte, 64),
		Tag:     tag,
	}
	l2 := uint64(log2(sz))
	if bits.OnesCount64(uint64(sz)) > 1 {
		l2 += 1
	}
	a.buffers[0] = Calloc(1<<l2, a.Tag)

	allocsMu.Lock()
	allocs[ref] = a
	allocsMu.Unlock()
	return a
}

func (a *Allocator) Reset() {
	atomic.StoreUint64(&a.compIdx, 0)
}

func Allocators() string {
	allocsMu.Lock()
	tags := make(map[string]uint64)
	num := make(map[string]int)
	for _, ac := range allocs {
		tags[ac.Tag] += ac.Allocated()
		num[ac.Tag] += 1
	}

	var buf bytes.Buffer
	for tag, sz := range tags {
		fmt.Fprintf(&buf, "Tag: %s Num: %d Size: %s . ", tag, num[tag], humanize.IBytes(sz))
	}
	allocsMu.Unlock()
	return buf.String()
}

func (a *Allocator) String() string {
	var s strings.Builder
	s.WriteString(fmt.Sprintf("Allocator: %x\n", a.Ref))
	var cum int
	for i, b := range a.buffers {
		cum += len(b)
		if len(b) == 0 {
			break
		}
		s.WriteString(fmt.Sprintf("idx: %d len: %d cum: %d\n", i, len(b), cum))
	}
	pos := atomic.LoadUint64(&a.compIdx)
	bi, pi := parse(pos)
	s.WriteString(fmt.Sprintf("bi: %d pi: %d\n", bi, pi))
	s.WriteString(fmt.Sprintf("Size: %d\n", a.Size()))
	return s.String()
}

// AllocatorFrom would return the allocator corresponding to the ref.
func AllocatorFrom(ref uint64) *Allocator {
	allocsMu.Lock()
	a := allocs[ref]
	allocsMu.Unlock()
	return a
}

func parse(pos uint64) (bufIdx, posIdx int) {
	return int(pos >> 32), int(pos & 0xFFFFFFFF)
}

// Size returns the size of the allocations so far.
func (a *Allocator) Size() int {
	pos := atomic.LoadUint64(&a.compIdx)
	bi, pi := parse(pos)
	var sz int
	for i, b := range a.buffers {
		if i < bi {
			sz += len(b)
			continue
		}
		sz += pi
		return sz
	}
	panic("Size should not reach here")
}

func log2(sz int) int {
	if sz < len(calculatedLog2) {
		return calculatedLog2[sz]
	}
	pow := 10
	sz >>= 10
	for sz > 1 {
		sz >>= 1
		pow++
	}
	return pow
}

func (a *Allocator) Allocated() uint64 {
	var alloc int
	for _, b := range a.buffers {
		alloc += cap(b)
	}
	return uint64(alloc)
}

func (a *Allocator) TrimTo(max int) {
	var alloc int
	for i, b := range a.buffers {
		if len(b) == 0 {
			break
		}
		alloc += len(b)
		if alloc < max {
			continue
		}
		Free(b)
		a.buffers[i] = nil
	}
}

// Release would release the memory back. Remember to make this call to avoid memory leaks.
func (a *Allocator) Release() {
	if a == nil {
		return
	}

	var alloc int
	for _, b := range a.buffers {
		if len(b) == 0 {
			break
		}
		alloc += len(b)
		Free(b)
	}

	allocsMu.Lock()
	delete(allocs, a.Ref)
	allocsMu.Unlock()
}

const maxAlloc = 1 << 30

func (a *Allocator) MaxAlloc() int {
	return maxAlloc
}

const nodeAlign = unsafe.Sizeof(uint64(0)) - 1

func (a *Allocator) AllocateAligned(sz int) []byte {
	tsz := sz + int(nodeAlign)
	out := a.Allocate(tsz)
	// We are reusing allocators. In that case, it's important to zero out the memory allocated
	// here. We don't always zero it out (in Allocate), because other functions would be immediately
	// overwriting the allocated slices anyway (see Copy).
	ZeroOut(out, 0, len(out))

	addr := uintptr(unsafe.Pointer(&out[0]))
	aligned := (addr + nodeAlign) & ^nodeAlign
	start := int(aligned - addr)

	return out[start : start+sz]
}

func (a *Allocator) Copy(buf []byte) []byte {
	if a == nil {
		return append([]byte{}, buf...)
	}
	out := a.Allocate(len(buf))
	copy(out, buf)
	return out
}

func (a *Allocator) addBufferAt(bufIdx, minSz int) {
	for {
		if bufIdx >= len(a.buffers) {
			panic(fmt.Sprintf("Allocator can not allocate more than %d buffers", len(a.buffers)))
		}
		if len(a.buffers[bufIdx]) == 0 {
			break
		}
		if minSz <= len(a.buffers[bufIdx]) {
			// No need to do anything. We already have a buffer which can satisfy minSz.
			return
		}
		bufIdx++
	}
	assert(bufIdx > 0)
	// We need to allocate a new buffer.
	// Make pageSize double of the last allocation.
	pageSize := 2 * len(a.buffers[bufIdx-1])
	// Ensure pageSize is bigger than sz.
	for pageSize < minSz {
		pageSize *= 2
	}
	// If bigger than maxAlloc, trim to maxAlloc.
	if pageSize > maxAlloc {
		pageSize = maxAlloc
	}

	buf := Calloc(pageSize, a.Tag)
	assert(len(a.buffers[bufIdx]) == 0)
	a.buffers[bufIdx] = buf
}

func (a *Allocator) Allocate(sz int) []byte {
	if a == nil {
		return make([]byte, sz)
	}
	if sz > maxAlloc {
		panic(fmt.Sprintf("Unable to allocate more than %d\n", maxAlloc))
	}
	if sz == 0 {
		return nil
	}
	for {
		pos := atomic.AddUint64(&a.compIdx, uint64(sz))
		bufIdx, posIdx := parse(pos)
		buf := a.buffers[bufIdx]
		if posIdx > len(buf) {
			a.Lock()
			newPos := atomic.LoadUint64(&a.compIdx)
			newBufIdx, _ := parse(newPos)
			if newBufIdx != bufIdx {
				a.Unlock()
				continue
			}
			a.addBufferAt(bufIdx+1, sz)
			atomic.StoreUint64(&a.compIdx, uint64((bufIdx+1)<<32))
			a.Unlock()
			// We added a new buffer. Let's acquire slice the right way by going back to the top.
			continue
		}
		data := buf[posIdx-sz : posIdx]
		return data
	}
}

type AllocatorPool struct {
	numGets int64
	allocCh chan *Allocator
	closer  *Closer
}

func NewAllocatorPool(sz int) *AllocatorPool {
	a := &AllocatorPool{
		allocCh: make(chan *Allocator, sz),
		closer:  NewCloser(1),
	}
	go a.freeupAllocators()
	return a
}

func (p *AllocatorPool) Get(sz int, tag string) *Allocator {
	if p == nil {
		return NewAllocator(sz, tag)
	}
	atomic.AddInt64(&p.numGets, 1)
	select {
	case alloc := <-p.allocCh:
		alloc.Reset()
		alloc.Tag = tag
		return alloc
	default:
		return NewAllocator(sz, tag)
	}
}
func (p *AllocatorPool) Return(a *Allocator) {
	if a == nil {
		return
	}
	if p == nil {
		a.Release()
		return
	}
	a.TrimTo(400 << 20)

	select {
	case p.allocCh <- a:
		return
	default:
		a.Release()
	}
}

func (p *AllocatorPool) Release() {
	if p == nil {
		return
	}
	p.closer.SignalAndWait()
}

func (p *AllocatorPool) freeupAllocators() {
	defer p.closer.Done()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	releaseOne := func() bool {
		select {
		case alloc := <-p.allocCh:
			alloc.Release()
			return true
		default:
			return false
		}
	}

	var last int64
	for {
		select {
		case <-p.closer.HasBeenClosed():
			close(p.allocCh)
			for alloc := range p.allocCh {
				alloc.Release()
			}
			return

		case <-ticker.C:
			gets := atomic.LoadInt64(&p.numGets)
			if gets != last {
				// Some retrievals were made since the last time. So, let's avoid doing a release.
				last = gets
				continue
			}
			releaseOne()
		}
	}
}
