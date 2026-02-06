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

func NetIfaceTotalStat() (*NetIfaceTotal, error) {
	var nif C.perfstat_netinterface_total_t

	rc := C.perfstat_netinterface_total(nil, &nif, C.sizeof_perfstat_netinterface_total_t, 1)
	if rc != 1 {
		return nil, fmt.Errorf("perfstat_netinterface_total() error")
	}
	n := perfstatnetinterfacetotal2netifacetotal(nif)
	return &n, nil
}

func NetBufferStat() ([]NetBuffer, error) {
	var nbuf *C.perfstat_netbuffer_t
	var first C.perfstat_id_t

	numbuf := C.perfstat_netbuffer(nil, nil, C.sizeof_perfstat_netbuffer_t, 0)
	if numbuf < 1 {
		return nil, fmt.Errorf("perfstat_netbuffer() error")
	}

	nblen := C.sizeof_perfstat_netbuffer_t * C.ulong(numbuf)
	nbuf = (*C.perfstat_netbuffer_t)(C.malloc(nblen))
	defer C.free(unsafe.Pointer(nbuf))
	C.strcpy(&first.name[0], C.CString(C.FIRST_NETBUFFER))
	r := C.perfstat_netbuffer(&first, nbuf, C.sizeof_perfstat_netbuffer_t, numbuf)
	if r < 0 {
		return nil, fmt.Errorf("perfstat_netbuffer() error")
	}
	nb := make([]NetBuffer, r)
	for i := 0; i < int(r); i++ {
		b := C.get_netbuffer_stat(nbuf, C.int(i))
		if b != nil {
			nb[i] = perfstatnetbuffer2netbuffer(b)
		}
	}
	return nb, nil
}

func NetIfaceStat() ([]NetIface, error) {
	var nif *C.perfstat_netinterface_t
	var first C.perfstat_id_t

	numif := C.perfstat_netinterface(nil, nil, C.sizeof_perfstat_netinterface_t, 0)
	if numif < 0 {
		return nil, fmt.Errorf("perfstat_netinterface() error")
	}
	if numif == 0 {
		return []NetIface{}, fmt.Errorf("no network interfaces found")
	}

	iflen := C.sizeof_perfstat_netinterface_t * C.ulong(numif)
	nif = (*C.perfstat_netinterface_t)(C.malloc(iflen))
	defer C.free(unsafe.Pointer(nif))
	C.strcpy(&first.name[0], C.CString(C.FIRST_NETINTERFACE))
	r := C.perfstat_netinterface(&first, nif, C.sizeof_perfstat_netinterface_t, numif)
	if r < 0 {
		return nil, fmt.Errorf("perfstat_netinterface() error")
	}
	ifs := make([]NetIface, r)
	for i := 0; i < int(r); i++ {
		b := C.get_netinterface_stat(nif, C.int(i))
		if b != nil {
			ifs[i] = perfstatnetinterface2netiface(b)
		}
	}
	return ifs, nil
}

func NetAdapterStat() ([]NetAdapter, error) {
	var adapters *C.perfstat_netadapter_t
	var first C.perfstat_id_t

	numad := C.perfstat_netadapter(nil, nil, C.sizeof_perfstat_netadapter_t, 0)
	if numad < 0 {
		return nil, fmt.Errorf("perfstat_netadater() error")
	}
	if numad == 0 {
		return []NetAdapter{}, fmt.Errorf("no network adapters found")
	}

	adplen := C.sizeof_perfstat_netadapter_t * C.ulong(numad)
	adapters = (*C.perfstat_netadapter_t)(C.malloc(adplen))
	defer C.free(unsafe.Pointer(adapters))
	C.strcpy(&first.name[0], C.CString(C.FIRST_NETINTERFACE))
	r := C.perfstat_netadapter(&first, adapters, C.sizeof_perfstat_netadapter_t, numad)
	if r < 0 {
		return nil, fmt.Errorf("perfstat_netadapter() error")
	}
	ads := make([]NetAdapter, r)
	for i := 0; i < int(r); i++ {
		b := C.get_netadapter_stat(adapters, C.int(i))
		if b != nil {
			ads[i] = perfstatnetadapter2netadapter(b)
		}
	}
	return ads, nil
}
