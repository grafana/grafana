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

func LogicalVolumeStat() ([]LogicalVolume, error) {
	var lv *C.perfstat_logicalvolume_t
	var lvname C.perfstat_id_t

	numlvs := C.perfstat_logicalvolume(nil, nil, C.sizeof_perfstat_logicalvolume_t, 0)
	if numlvs <= 0 {
		return nil, fmt.Errorf("perfstat_logicalvolume() error")
	}

	lv_len := C.sizeof_perfstat_logicalvolume_t * C.ulong(numlvs)
	lv = (*C.perfstat_logicalvolume_t)(C.malloc(lv_len))
	defer C.free(unsafe.Pointer(lv))
	C.strcpy(&lvname.name[0], C.CString(""))
	r := C.perfstat_logicalvolume(&lvname, lv, C.sizeof_perfstat_logicalvolume_t, numlvs)
	if r < 0 {
		return nil, fmt.Errorf("perfstat_logicalvolume() error")
	}
	lvs := make([]LogicalVolume, r)
	for i := 0; i < int(r); i++ {
		l := C.get_logicalvolume_stat(lv, C.int(i))
		if l != nil {
			lvs[i] = perfstatlogicalvolume2logicalvolume(l)
		}
	}
	return lvs, nil
}

func VolumeGroupStat() ([]VolumeGroup, error) {
	var vg *C.perfstat_volumegroup_t
	var vgname C.perfstat_id_t

	numvgs := C.perfstat_volumegroup(nil, nil, C.sizeof_perfstat_volumegroup_t, 0)
	if numvgs <= 0 {
		return nil, fmt.Errorf("perfstat_volumegroup() error")
	}

	vg_len := C.sizeof_perfstat_volumegroup_t * C.ulong(numvgs)
	vg = (*C.perfstat_volumegroup_t)(C.malloc(vg_len))
	defer C.free(unsafe.Pointer(vg))
	C.strcpy(&vgname.name[0], C.CString(""))
	r := C.perfstat_volumegroup(&vgname, vg, C.sizeof_perfstat_volumegroup_t, numvgs)
	if r < 0 {
		return nil, fmt.Errorf("perfstat_volumegroup() error")
	}
	vgs := make([]VolumeGroup, r)
	for i := 0; i < int(r); i++ {
		v := C.get_volumegroup_stat(vg, C.int(i))
		if v != nil {
			vgs[i] = perfstatvolumegroup2volumegroup(v)
		}
	}
	return vgs, nil
}
