// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

//go:build !windows
// +build !windows

package cmdrunner

import (
	"os"
	"syscall"
)

// _pidAlive tests whether a process is alive or not by sending it Signal 0,
// since Go otherwise has no way to test this.
func _pidAlive(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err == nil {
		err = proc.Signal(syscall.Signal(0))
	}

	return err == nil
}
