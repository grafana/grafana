// +build windows

package sysutil

import (
	"syscall"
	"time"
)

var (
	kernel32DLL        = syscall.MustLoadDLL("kernel32")
	procGetTickCount64 = kernel32DLL.MustFindProc("GetTickCount64")
)

func init() {
	res, _, err := syscall.Syscall(procGetTickCount64.Addr(), 0, 0, 0, 0)
	if err != 0 {
		btime = time.Now()
		return
	}

	btime = time.Now().Add(time.Duration(-res) * time.Millisecond)
}
