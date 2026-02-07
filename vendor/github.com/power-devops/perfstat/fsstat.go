//go:build aix
// +build aix

package perfstat

/*
#include "c_helpers.h"
*/
import "C"

import (
	"fmt"
)

func FileSystemStat() ([]FileSystem, error) {
	var fsinfo *C.struct_fsinfo
	var nmounts C.int

	fsinfo = C.get_all_fs(&nmounts)
	if nmounts <= 0 {
		return nil, fmt.Errorf("No mounts found")
	}

	fs := make([]FileSystem, nmounts)
	for i := 0; i < int(nmounts); i++ {
		f := C.get_filesystem_stat(fsinfo, C.int(i))
		if f != nil {
			fs[i] = fsinfo2filesystem(f)
		}
	}
	return fs, nil
}
