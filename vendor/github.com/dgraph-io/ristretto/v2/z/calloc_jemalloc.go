// Copyright 2020 The LevelDB-Go and Pebble Authors. All rights reserved. Use
// of this source code is governed by a BSD-style license that can be found in
// the LICENSE file.

//go:build jemalloc
// +build jemalloc

package z

/*
#cgo LDFLAGS: /usr/local/lib/libjemalloc.a -L/usr/local/lib -Wl,-rpath,/usr/local/lib -ljemalloc -lm -lstdc++ -pthread -ldl
#include <stdlib.h>
#include <jemalloc/jemalloc.h>
*/
import "C"
import (
	"bytes"
	"fmt"
	"sync"
	"sync/atomic"
	"unsafe"

	"github.com/dustin/go-humanize"
)

// The go:linkname directives provides backdoor access to private functions in
// the runtime. Below we're accessing the throw function.

//go:linkname throw runtime.throw
func throw(s string)

// New allocates a slice of size n. The returned slice is from manually managed
// memory and MUST be released by calling Free. Failure to do so will result in
// a memory leak.
//
// Compile jemalloc with ./configure --with-jemalloc-prefix="je_"
// https://android.googlesource.com/platform/external/jemalloc_new/+/6840b22e8e11cb68b493297a5cd757d6eaa0b406/TUNING.md
// These two config options seems useful for frequent allocations and deallocations in
// multi-threaded programs (like we have).
// JE_MALLOC_CONF="background_thread:true,metadata_thp:auto"
//
// Compile Go program with `go build -tags=jemalloc` to enable this.

type dalloc struct {
	t  string
	sz int
}

var dallocsMu sync.Mutex
var dallocs map[unsafe.Pointer]*dalloc

func init() {
	// By initializing dallocs, we can start tracking allocations and deallocations via z.Calloc.
	dallocs = make(map[unsafe.Pointer]*dalloc)
}

func Calloc(n int, tag string) []byte {
	if n == 0 {
		return make([]byte, 0)
	}
	// We need to be conscious of the Cgo pointer passing rules:
	//
	//   https://golang.org/cmd/cgo/#hdr-Passing_pointers
	//
	//   ...
	//   Note: the current implementation has a bug. While Go code is permitted
	//   to write nil or a C pointer (but not a Go pointer) to C memory, the
	//   current implementation may sometimes cause a runtime error if the
	//   contents of the C memory appear to be a Go pointer. Therefore, avoid
	//   passing uninitialized C memory to Go code if the Go code is going to
	//   store pointer values in it. Zero out the memory in C before passing it
	//   to Go.

	ptr := C.je_calloc(C.size_t(n), 1)
	if ptr == nil {
		// NB: throw is like panic, except it guarantees the process will be
		// terminated. The call below is exactly what the Go runtime invokes when
		// it cannot allocate memory.
		throw("out of memory")
	}

	uptr := unsafe.Pointer(ptr)
	dallocsMu.Lock()
	dallocs[uptr] = &dalloc{
		t:  tag,
		sz: n,
	}
	dallocsMu.Unlock()
	atomic.AddInt64(&numBytes, int64(n))
	// Interpret the C pointer as a pointer to a Go array, then slice.
	return (*[MaxArrayLen]byte)(uptr)[:n:n]
}

// CallocNoRef does the exact same thing as Calloc with jemalloc enabled.
func CallocNoRef(n int, tag string) []byte {
	return Calloc(n, tag)
}

// Free frees the specified slice.
func Free(b []byte) {
	if sz := cap(b); sz != 0 {
		b = b[:cap(b)]
		ptr := unsafe.Pointer(&b[0])
		C.je_free(ptr)
		atomic.AddInt64(&numBytes, -int64(sz))
		dallocsMu.Lock()
		delete(dallocs, ptr)
		dallocsMu.Unlock()
	}
}

func Leaks() string {
	if dallocs == nil {
		return "Leak detection disabled. Enable with 'leak' build flag."
	}
	dallocsMu.Lock()
	defer dallocsMu.Unlock()
	if len(dallocs) == 0 {
		return "NO leaks found."
	}
	m := make(map[string]int)
	for _, da := range dallocs {
		m[da.t] += da.sz
	}
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "Allocations:\n")
	for f, sz := range m {
		fmt.Fprintf(&buf, "%s at file: %s\n", humanize.IBytes(uint64(sz)), f)
	}
	return buf.String()
}

// ReadMemStats populates stats with JE Malloc statistics.
func ReadMemStats(stats *MemStats) {
	if stats == nil {
		return
	}
	// Call an epoch mallclt to refresh the stats data as mentioned in the docs.
	// http://jemalloc.net/jemalloc.3.html#epoch
	// Note: This epoch mallctl is as expensive as a malloc call. It takes up the
	// malloc_mutex_lock.
	epoch := 1
	sz := unsafe.Sizeof(&epoch)
	C.je_mallctl(
		(C.CString)("epoch"),
		unsafe.Pointer(&epoch),
		(*C.size_t)(unsafe.Pointer(&sz)),
		unsafe.Pointer(&epoch),
		(C.size_t)(unsafe.Sizeof(epoch)))
	stats.Allocated = fetchStat("stats.allocated")
	stats.Active = fetchStat("stats.active")
	stats.Resident = fetchStat("stats.resident")
	stats.Retained = fetchStat("stats.retained")
}

// fetchStat is used to read a specific attribute from je malloc stats using mallctl.
func fetchStat(s string) uint64 {
	var out uint64
	sz := unsafe.Sizeof(&out)
	C.je_mallctl(
		(C.CString)(s),                   // Query: eg: stats.allocated, stats.resident, etc.
		unsafe.Pointer(&out),             // Variable to store the output.
		(*C.size_t)(unsafe.Pointer(&sz)), // Size of the output variable.
		nil,                              // Input variable used to set a value.
		0)                                // Size of the input variable.
	return out
}

func StatsPrint() {
	opts := C.CString("mdablxe")
	C.je_malloc_stats_print(nil, nil, opts)
	C.free(unsafe.Pointer(opts))
}
