//go:build aix
// +build aix

package perfstat

/*
#cgo LDFLAGS: -lperfstat

#include <libperfstat.h>
#include <string.h>
#include <stdlib.h>

#include "c_helpers.h"
*/
import "C"

import (
	"fmt"
	"unsafe"
)

func MemoryTotalStat() (*MemoryTotal, error) {
	var memory C.perfstat_memory_total_t

	rc := C.perfstat_memory_total(nil, &memory, C.sizeof_perfstat_memory_total_t, 1)
	if rc != 1 {
		return nil, fmt.Errorf("perfstat_memory_total() error")
	}
	m := perfstatmemorytotal2memorytotal(memory)
	return &m, nil
}

func MemoryPageStat() ([]MemoryPage, error) {
	var mempage *C.perfstat_memory_page_t
	var fps C.perfstat_psize_t

	numps := C.perfstat_memory_page(nil, nil, C.sizeof_perfstat_memory_page_t, 0)
	if numps < 1 {
		return nil, fmt.Errorf("perfstat_memory_page() error")
	}

	mp_len := C.sizeof_perfstat_memory_page_t * C.ulong(numps)
	mempage = (*C.perfstat_memory_page_t)(C.malloc(mp_len))
	defer C.free(unsafe.Pointer(mempage))
	fps.psize = C.FIRST_PSIZE
	r := C.perfstat_memory_page(&fps, mempage, C.sizeof_perfstat_memory_page_t, numps)
	if r < 1 {
		return nil, fmt.Errorf("perfstat_memory_page() error")
	}
	ps := make([]MemoryPage, r)
	for i := 0; i < int(r); i++ {
		p := C.get_memory_page_stat(mempage, C.int(i))
		if p != nil {
			ps[i] = perfstatmemorypage2memorypage(p)
		}
	}
	return ps, nil
}

func PagingSpaceStat() ([]PagingSpace, error) {
	var pspace *C.perfstat_pagingspace_t
	var fps C.perfstat_id_t

	numps := C.perfstat_pagingspace(nil, nil, C.sizeof_perfstat_pagingspace_t, 0)
	if numps <= 0 {
		return nil, fmt.Errorf("perfstat_pagingspace() error")
	}

	ps_len := C.sizeof_perfstat_pagingspace_t * C.ulong(numps)
	pspace = (*C.perfstat_pagingspace_t)(C.malloc(ps_len))
	defer C.free(unsafe.Pointer(pspace))
	C.strcpy(&fps.name[0], C.CString(C.FIRST_PAGINGSPACE))
	r := C.perfstat_pagingspace(&fps, pspace, C.sizeof_perfstat_pagingspace_t, numps)
	if r < 1 {
		return nil, fmt.Errorf("perfstat_pagingspace() error")
	}
	ps := make([]PagingSpace, r)
	for i := 0; i < int(r); i++ {
		p := C.get_pagingspace_stat(pspace, C.int(i))
		if p != nil {
			ps[i] = perfstatpagingspace2pagingspace(p)
		}
	}
	return ps, nil
}
