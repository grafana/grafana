/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package z

import "sync/atomic"

var numBytes int64

// NumAllocBytes returns the number of bytes allocated using calls to z.Calloc. The allocations
// could be happening via either Go or jemalloc, depending upon the build flags.
func NumAllocBytes() int64 {
	return atomic.LoadInt64(&numBytes)
}

// MemStats is used to fetch JE Malloc Stats. The stats are fetched from
// the mallctl namespace http://jemalloc.net/jemalloc.3.html#mallctl_namespace.
type MemStats struct {
	// Total number of bytes allocated by the application.
	// http://jemalloc.net/jemalloc.3.html#stats.allocated
	Allocated uint64
	// Total number of bytes in active pages allocated by the application. This
	// is a multiple of the page size, and greater than or equal to
	// Allocated.
	// http://jemalloc.net/jemalloc.3.html#stats.active
	Active uint64
	// Maximum number of bytes in physically resident data pages mapped by the
	// allocator, comprising all pages dedicated to allocator metadata, pages
	// backing active allocations, and unused dirty pages. This is a maximum
	// rather than precise because pages may not actually be physically
	// resident if they correspond to demand-zeroed virtual memory that has not
	// yet been touched. This is a multiple of the page size, and is larger
	// than stats.active.
	// http://jemalloc.net/jemalloc.3.html#stats.resident
	Resident uint64
	// Total number of bytes in virtual memory mappings that were retained
	// rather than being returned to the operating system via e.g. munmap(2) or
	// similar. Retained virtual memory is typically untouched, decommitted, or
	// purged, so it has no strongly associated physical memory (see extent
	// hooks http://jemalloc.net/jemalloc.3.html#arena.i.extent_hooks for
	// details). Retained memory is excluded from mapped memory statistics,
	// e.g. stats.mapped (http://jemalloc.net/jemalloc.3.html#stats.mapped).
	// http://jemalloc.net/jemalloc.3.html#stats.retained
	Retained uint64
}
