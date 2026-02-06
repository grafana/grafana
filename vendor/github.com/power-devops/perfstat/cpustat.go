//go:build aix
// +build aix

package perfstat

/*
#cgo LDFLAGS: -lperfstat

#include <libperfstat.h>
#include <stdlib.h>
#include <string.h>

#include "c_helpers.h"
*/
import "C"

import (
	"fmt"
	"runtime"
	"time"
	"unsafe"
)

var old_cpu_total_stat *C.perfstat_cpu_total_t

func init() {
	old_cpu_total_stat = (*C.perfstat_cpu_total_t)(C.malloc(C.sizeof_perfstat_cpu_total_t))
	C.perfstat_cpu_total(nil, old_cpu_total_stat, C.sizeof_perfstat_cpu_total_t, 1)
}

func CpuStat() ([]CPU, error) {
	var cpustat *C.perfstat_cpu_t
	var cpu C.perfstat_id_t

	ncpu := runtime.NumCPU()

	cpustat_len := C.sizeof_perfstat_cpu_t * C.ulong(ncpu)
	cpustat = (*C.perfstat_cpu_t)(C.malloc(cpustat_len))
	defer C.free(unsafe.Pointer(cpustat))
	C.strcpy(&cpu.name[0], C.CString(C.FIRST_CPU))
	r := C.perfstat_cpu(&cpu, cpustat, C.sizeof_perfstat_cpu_t, C.int(ncpu))
	if r <= 0 {
		return nil, fmt.Errorf("error perfstat_cpu()")
	}
	c := make([]CPU, r)
	for i := 0; i < int(r); i++ {
		n := C.get_cpu_stat(cpustat, C.int(i))
		if n != nil {
			c[i] = perfstatcpu2cpu(n)
		}
	}
	return c, nil
}

func CpuTotalStat() (*CPUTotal, error) {
	var cpustat *C.perfstat_cpu_total_t

	cpustat = (*C.perfstat_cpu_total_t)(C.malloc(C.sizeof_perfstat_cpu_total_t))
	defer C.free(unsafe.Pointer(cpustat))
	r := C.perfstat_cpu_total(nil, cpustat, C.sizeof_perfstat_cpu_total_t, 1)
	if r <= 0 {
		return nil, fmt.Errorf("error perfstat_cpu_total()")
	}
	c := perfstatcputotal2cputotal(cpustat)
	return &c, nil
}

func CpuUtilStat(intvl time.Duration) (*CPUUtil, error) {
	var cpuutil *C.perfstat_cpu_util_t
	var newt *C.perfstat_cpu_total_t
	var oldt *C.perfstat_cpu_total_t
	var data C.perfstat_rawdata_t

	oldt = (*C.perfstat_cpu_total_t)(C.malloc(C.sizeof_perfstat_cpu_total_t))
	newt = (*C.perfstat_cpu_total_t)(C.malloc(C.sizeof_perfstat_cpu_total_t))
	cpuutil = (*C.perfstat_cpu_util_t)(C.malloc(C.sizeof_perfstat_cpu_util_t))
	defer C.free(unsafe.Pointer(oldt))
	defer C.free(unsafe.Pointer(newt))
	defer C.free(unsafe.Pointer(cpuutil))

	r := C.perfstat_cpu_total(nil, oldt, C.sizeof_perfstat_cpu_total_t, 1)
	if r <= 0 {
		return nil, fmt.Errorf("error perfstat_cpu_total()")
	}

	time.Sleep(intvl)

	r = C.perfstat_cpu_total(nil, newt, C.sizeof_perfstat_cpu_total_t, 1)
	if r <= 0 {
		return nil, fmt.Errorf("error perfstat_cpu_total()")
	}

	data._type = C.UTIL_CPU_TOTAL
	data.curstat = unsafe.Pointer(newt)
	data.prevstat = unsafe.Pointer(oldt)
	data.sizeof_data = C.sizeof_perfstat_cpu_total_t
	data.cur_elems = 1
	data.prev_elems = 1

	r = C.perfstat_cpu_util(&data, cpuutil, C.sizeof_perfstat_cpu_util_t, 1)
	if r <= 0 {
		return nil, fmt.Errorf("error perfstat_cpu_util()")
	}
	u := perfstatcpuutil2cpuutil(cpuutil)
	return &u, nil
}

func CpuUtilTotalStat() (*CPUUtil, error) {
	var cpuutil *C.perfstat_cpu_util_t
	var new_cpu_total_stat *C.perfstat_cpu_total_t
	var data C.perfstat_rawdata_t

	new_cpu_total_stat = (*C.perfstat_cpu_total_t)(C.malloc(C.sizeof_perfstat_cpu_total_t))
	cpuutil = (*C.perfstat_cpu_util_t)(C.malloc(C.sizeof_perfstat_cpu_util_t))
	defer C.free(unsafe.Pointer(cpuutil))

	r := C.perfstat_cpu_total(nil, new_cpu_total_stat, C.sizeof_perfstat_cpu_total_t, 1)
	if r <= 0 {
		C.free(unsafe.Pointer(new_cpu_total_stat))
		return nil, fmt.Errorf("error perfstat_cpu_total()")
	}

	data._type = C.UTIL_CPU_TOTAL
	data.curstat = unsafe.Pointer(new_cpu_total_stat)
	data.prevstat = unsafe.Pointer(old_cpu_total_stat)
	data.sizeof_data = C.sizeof_perfstat_cpu_total_t
	data.cur_elems = 1
	data.prev_elems = 1

	r = C.perfstat_cpu_util(&data, cpuutil, C.sizeof_perfstat_cpu_util_t, 1)
	C.free(unsafe.Pointer(old_cpu_total_stat))
	old_cpu_total_stat = new_cpu_total_stat
	if r <= 0 {
		return nil, fmt.Errorf("error perfstat_cpu_util()")
	}
	u := perfstatcpuutil2cpuutil(cpuutil)
	return &u, nil
}
