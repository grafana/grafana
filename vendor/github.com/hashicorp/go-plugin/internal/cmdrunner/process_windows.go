// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package cmdrunner

import (
	"syscall"
)

const (
	// Weird name but matches the MSDN docs
	exit_STILL_ACTIVE = 259

	processDesiredAccess = syscall.STANDARD_RIGHTS_READ |
		syscall.PROCESS_QUERY_INFORMATION |
		syscall.SYNCHRONIZE
)

// _pidAlive tests whether a process is alive or not
func _pidAlive(pid int) bool {
	h, err := syscall.OpenProcess(processDesiredAccess, false, uint32(pid))
	if err != nil {
		return false
	}
	defer syscall.CloseHandle(h)

	var ec uint32
	if e := syscall.GetExitCodeProcess(h, &ec); e != nil {
		return false
	}

	return ec == exit_STILL_ACTIVE
}
