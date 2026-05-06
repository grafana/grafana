//go:build windows

package file

import (
	"errors"
	"os"
	"syscall"
	"unsafe"
)

var (
	modkernel32      = syscall.NewLazyDLL("kernel32.dll")
	procLockFileEx   = modkernel32.NewProc("LockFileEx")
	procUnlockFileEx = modkernel32.NewProc("UnlockFileEx")
)

const (
	LOCKFILE_EXCLUSIVE_LOCK   = 0x00000002
	LOCKFILE_FAIL_IMMEDIATELY = 0x00000001
)

// LockSH places a shared lock on the file. If the file is already locked, waits until the file is released.
func LockSH(fp *os.File) error {
	r1, errNo := wlock(fp, 0x0)
	return isWError(r1, errNo)
}

// LockEX places an exclusive lock on the file. If the file is already locked, waits until the file is released.
func LockEX(fp *os.File) error {
	r1, errNo := wlock(fp, LOCKFILE_EXCLUSIVE_LOCK)
	return isWError(r1, errNo)
}

// TryLockSH places a shared lock on the file. If the file is already locked, returns an error immediately.
func TryLockSH(fp *os.File) error {
	r1, errNo := wlock(fp, LOCKFILE_FAIL_IMMEDIATELY)
	return isWError(r1, errNo)
}

// TryLockEX places an exclusive lock on the file. If the file is already locked, returns an error immediately.
func TryLockEX(fp *os.File) error {
	r1, errNo := wlock(fp, LOCKFILE_EXCLUSIVE_LOCK|LOCKFILE_FAIL_IMMEDIATELY)
	return isWError(r1, errNo)
}

// Unlock the file.
func Unlock(fp *os.File) error {
	r1, _, errNo := syscall.Syscall6(
		procUnlockFileEx.Addr(),
		5,
		fp.Fd(),
		uintptr(0),
		uintptr(1),
		uintptr(0),
		uintptr(unsafe.Pointer(&syscall.Overlapped{})),
		0,
	)
	return isWError(r1, errNo)
}

func wlock(fp *os.File, flags uintptr) (uintptr, syscall.Errno) {
	r1, _, errNo := syscall.Syscall6(
		procLockFileEx.Addr(),
		6,
		fp.Fd(),
		flags,
		uintptr(0),
		uintptr(1),
		uintptr(0),
		uintptr(unsafe.Pointer(&syscall.Overlapped{})),
	)
	return r1, errNo
}

func isWError(r1 uintptr, errNo syscall.Errno) error {
	if r1 != 1 {
		if errNo != 0 {
			return errors.New(errNo.Error())
		} else {
			return syscall.EINVAL
		}
	}
	return nil
}
