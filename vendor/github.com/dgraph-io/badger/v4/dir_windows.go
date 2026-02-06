//go:build windows
// +build windows

/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

// OpenDir opens a directory in windows with write access for syncing.
import (
	"os"
	"path/filepath"
	"syscall"

	"github.com/dgraph-io/badger/v4/y"
)

// FILE_ATTRIBUTE_TEMPORARY - A file that is being used for temporary storage.
// FILE_FLAG_DELETE_ON_CLOSE - The file is to be deleted immediately after all of its handles are
// closed, which includes the specified handle and any other open or duplicated handles.
// See: https://docs.microsoft.com/en-us/windows/desktop/FileIO/file-attribute-constants
// NOTE: Added here to avoid importing golang.org/x/sys/windows
const (
	FILE_ATTRIBUTE_TEMPORARY  = 0x00000100
	FILE_FLAG_DELETE_ON_CLOSE = 0x04000000
)

func openDir(path string) (*os.File, error) {
	fd, err := openDirWin(path)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(fd), path), nil
}

func openDirWin(path string) (fd syscall.Handle, err error) {
	if len(path) == 0 {
		return syscall.InvalidHandle, syscall.ERROR_FILE_NOT_FOUND
	}
	pathp, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return syscall.InvalidHandle, err
	}
	access := uint32(syscall.GENERIC_READ | syscall.GENERIC_WRITE)
	sharemode := uint32(syscall.FILE_SHARE_READ | syscall.FILE_SHARE_WRITE)
	createmode := uint32(syscall.OPEN_EXISTING)
	fl := uint32(syscall.FILE_FLAG_BACKUP_SEMANTICS)
	return syscall.CreateFile(pathp, access, sharemode, nil, createmode, fl, 0)
}

// DirectoryLockGuard holds a lock on the directory.
type directoryLockGuard struct {
	h    syscall.Handle
	path string
}

// AcquireDirectoryLock acquires exclusive access to a directory.
func acquireDirectoryLock(dirPath string, pidFileName string, readOnly bool) (*directoryLockGuard, error) {
	if readOnly {
		return nil, ErrWindowsNotSupported
	}

	// Convert to absolute path so that Release still works even if we do an unbalanced
	// chdir in the meantime.
	absLockFilePath, err := filepath.Abs(filepath.Join(dirPath, pidFileName))
	if err != nil {
		return nil, y.Wrap(err, "Cannot get absolute path for pid lock file")
	}

	// This call creates a file handler in memory that only one process can use at a time. When
	// that process ends, the file is deleted by the system.
	// FILE_ATTRIBUTE_TEMPORARY is used to tell Windows to try to create the handle in memory.
	// FILE_FLAG_DELETE_ON_CLOSE is not specified in syscall_windows.go but tells Windows to delete
	// the file when all processes holding the handler are closed.
	// XXX: this works but it's a bit klunky. i'd prefer to use LockFileEx but it needs unsafe pkg.
	h, err := syscall.CreateFile(
		syscall.StringToUTF16Ptr(absLockFilePath), 0, 0, nil,
		syscall.OPEN_ALWAYS,
		uint32(FILE_ATTRIBUTE_TEMPORARY|FILE_FLAG_DELETE_ON_CLOSE),
		0)
	if err != nil {
		return nil, y.Wrapf(err,
			"Cannot create lock file %q.  Another process is using this Badger database",
			absLockFilePath)
	}

	return &directoryLockGuard{h: h, path: absLockFilePath}, nil
}

// Release removes the directory lock.
func (g *directoryLockGuard) release() error {
	g.path = ""
	return syscall.CloseHandle(g.h)
}

// Windows doesn't support syncing directories to the file system. See
// https://github.com/hypermodeinc/badger/issues/699#issuecomment-504133587 for more details.
func syncDir(dir string) error { return nil }
