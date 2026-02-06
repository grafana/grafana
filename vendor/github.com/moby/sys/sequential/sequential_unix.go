//go:build !windows
// +build !windows

package sequential

import "os"

// Create is an alias for [os.Create] on non-Windows platforms.
func Create(name string) (*os.File, error) {
	return os.Create(name)
}

// Open is an alias for [os.Open] on non-Windows platforms.
func Open(name string) (*os.File, error) {
	return os.Open(name)
}

// OpenFile is an alias for [os.OpenFile] on non-Windows platforms.
func OpenFile(name string, flag int, perm os.FileMode) (*os.File, error) {
	return os.OpenFile(name, flag, perm)
}

// CreateTemp is an alias for [os.CreateTemp] on non-Windows platforms.
func CreateTemp(dir, prefix string) (f *os.File, err error) {
	return os.CreateTemp(dir, prefix)
}
