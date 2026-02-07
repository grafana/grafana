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

func ProcessStat() ([]Process, error) {
	var proc *C.perfstat_process_t
	var first C.perfstat_id_t

	numproc := C.perfstat_process(nil, nil, C.sizeof_perfstat_process_t, 0)
	if numproc < 1 {
		return nil, fmt.Errorf("perfstat_process() error")
	}

	plen := C.sizeof_perfstat_process_t * C.ulong(numproc)
	proc = (*C.perfstat_process_t)(C.malloc(plen))
	defer C.free(unsafe.Pointer(proc))
	C.strcpy(&first.name[0], C.CString(""))
	r := C.perfstat_process(&first, proc, C.sizeof_perfstat_process_t, numproc)
	if r < 0 {
		return nil, fmt.Errorf("perfstat_process() error")
	}

	ps := make([]Process, r)
	for i := 0; i < int(r); i++ {
		p := C.get_process_stat(proc, C.int(i))
		if p != nil {
			ps[i] = perfstatprocess2process(p)
		}
	}
	return ps, nil
}

func ThreadStat() ([]Thread, error) {
	var thread *C.perfstat_thread_t
	var first C.perfstat_id_t

	numthr := C.perfstat_thread(nil, nil, C.sizeof_perfstat_thread_t, 0)
	if numthr < 1 {
		return nil, fmt.Errorf("perfstat_thread() error")
	}

	thlen := C.sizeof_perfstat_thread_t * C.ulong(numthr)
	thread = (*C.perfstat_thread_t)(C.malloc(thlen))
	defer C.free(unsafe.Pointer(thread))
	C.strcpy(&first.name[0], C.CString(""))
	r := C.perfstat_thread(&first, thread, C.sizeof_perfstat_thread_t, numthr)
	if r < 0 {
		return nil, fmt.Errorf("perfstat_thread() error")
	}

	th := make([]Thread, r)
	for i := 0; i < int(r); i++ {
		t := C.get_thread_stat(thread, C.int(i))
		if t != nil {
			th[i] = perfstatthread2thread(t)
		}
	}
	return th, nil
}
