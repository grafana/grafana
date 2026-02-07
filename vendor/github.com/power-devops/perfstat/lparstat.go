//go:build aix
// +build aix

package perfstat

/*
#cgo LDFLAGS: -lperfstat

#include <libperfstat.h>
#include <sys/dr.h>
*/
import "C"

import (
	"fmt"
	"unsafe"
)

func PartitionStat() (*PartitionConfig, error) {
	var part C.perfstat_partition_config_t

	rc := C.perfstat_partition_config(nil, &part, C.sizeof_perfstat_partition_config_t, 1)
	if rc != 1 {
		return nil, fmt.Errorf("perfstat_partition_config() error")
	}
	p := perfstatpartitionconfig2partitionconfig(part)
	return &p, nil

}

func LparInfo() (*PartitionInfo, error) {
	var pinfo C.lpar_info_format2_t

	rc := C.lpar_get_info(C.LPAR_INFO_FORMAT2, unsafe.Pointer(&pinfo), C.sizeof_lpar_info_format2_t)
	if rc != 0 {
		return nil, fmt.Errorf("lpar_get_info() error")
	}
	p := lparinfo2partinfo(pinfo)
	return &p, nil
}
