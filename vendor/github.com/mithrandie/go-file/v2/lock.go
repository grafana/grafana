//go:build !darwin && !dragonfly && !freebsd && !linux && !netbsd && !openbsd && !solaris && !windows

package file

import (
	"os"
)

// LockSH does nothing
func LockSH(_ *os.File) error {
	return nil
}

// LockEX does nothing
func LockEX(_ *os.File) error {
	return nil
}

// TryLockSH does nothing
func TryLockSH(_ *os.File) error {
	return nil
}

// TryLockEX does nothing
func TryLockEX(_ *os.File) error {
	return nil
}

// Unlock does nothing
func Unlock(_ *os.File) error {
	return nil
}
