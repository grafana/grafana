//go:build aix
// +build aix

package perfstat

/*
#cgo LDFLAGS: -lperfstat

#include <libperfstat.h>
*/
import "C"

func EnableLVMStat() {
	C.perfstat_config(C.PERFSTAT_ENABLE|C.PERFSTAT_LV|C.PERFSTAT_VG, nil)
}

func DisableLVMStat() {
	C.perfstat_config(C.PERFSTAT_DISABLE|C.PERFSTAT_LV|C.PERFSTAT_VG, nil)
}
