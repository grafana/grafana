/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package badger

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dgraph-io/badger/v4/y"
)

// directoryLockGuard holds a lock on a directory and a pid file inside.  The pid file isn't part
// of the locking mechanism, it's just advisory.
type directoryLockGuard struct {
	// File handle on the directory, which we've locked.
	f *os.File
	// The absolute path to our pid file.
	path string
}

// acquireDirectoryLock gets a lock on the directory.
// It will also write our pid to dirPath/pidFileName for convenience.
// readOnly is not supported on Plan 9.
func acquireDirectoryLock(dirPath string, pidFileName string, readOnly bool) (
	*directoryLockGuard, error) {
	if readOnly {
		return nil, ErrPlan9NotSupported
	}

	// Convert to absolute path so that Release still works even if we do an unbalanced
	// chdir in the meantime.
	absPidFilePath, err := filepath.Abs(filepath.Join(dirPath, pidFileName))
	if err != nil {
		return nil, y.Wrap(err, "cannot get absolute path for pid lock file")
	}

	// If the file was unpacked or created by some other program, it might not
	// have the ModeExclusive bit set. Set it before we call OpenFile, so that we
	// can be confident that a successful OpenFile implies exclusive use.
	//
	// OpenFile fails if the file ModeExclusive bit set *and* the file is already open.
	// So, if the file is closed when the DB crashed, we're fine. When the process
	// that was managing the DB crashes, the OS will close the file for us.
	//
	// This bit of code is copied from Go's lockedfile internal package:
	// https://github.com/golang/go/blob/go1.15rc1/src/cmd/go/internal/lockedfile/lockedfile_plan9.go#L58
	if fi, err := os.Stat(absPidFilePath); err == nil {
		if fi.Mode()&os.ModeExclusive == 0 {
			if err := os.Chmod(absPidFilePath, fi.Mode()|os.ModeExclusive); err != nil {
				return nil, y.Wrapf(err, "could not set exclusive mode bit")
			}
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	f, err := os.OpenFile(absPidFilePath, os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0666|os.ModeExclusive)
	if err != nil {
		if isLocked(err) {
			return nil, y.Wrapf(err,
				"Cannot open pid lock file %q.  Another process is using this Badger database",
				absPidFilePath)
		}
		return nil, y.Wrapf(err, "Cannot open pid lock file %q", absPidFilePath)
	}

	if _, err = fmt.Fprintf(f, "%d\n", os.Getpid()); err != nil {
		f.Close()
		return nil, y.Wrapf(err, "could not write pid")
	}
	return &directoryLockGuard{f, absPidFilePath}, nil
}

// Release deletes the pid file and releases our lock on the directory.
func (guard *directoryLockGuard) release() error {
	// It's important that we remove the pid file first.
	err := os.Remove(guard.path)

	if closeErr := guard.f.Close(); err == nil {
		err = closeErr
	}
	guard.path = ""
	guard.f = nil

	return err
}

// openDir opens a directory for syncing.
func openDir(path string) (*os.File, error) { return os.Open(path) }

// When you create or delete a file, you have to ensure the directory entry for the file is synced
// in order to guarantee the file is visible (if the system crashes). (See the man page for fsync,
// or see https://github.com/coreos/etcd/issues/6368 for an example.)
func syncDir(dir string) error {
	f, err := openDir(dir)
	if err != nil {
		return y.Wrapf(err, "While opening directory: %s.", dir)
	}

	err = f.Sync()
	closeErr := f.Close()
	if err != nil {
		return y.Wrapf(err, "While syncing directory: %s.", dir)
	}
	return y.Wrapf(closeErr, "While closing directory: %s.", dir)
}

// Opening an exclusive-use file returns an error.
// The expected error strings are:
//
//   - "open/create -- file is locked" (cwfs, kfs)
//   - "exclusive lock" (fossil)
//   - "exclusive use file already open" (ramfs)
//
// See https://github.com/golang/go/blob/go1.15rc1/src/cmd/go/internal/lockedfile/lockedfile_plan9.go#L16
var lockedErrStrings = [...]string{
	"file is locked",
	"exclusive lock",
	"exclusive use file already open",
}

// Even though plan9 doesn't support the Lock/RLock/Unlock functions to
// manipulate already-open files, IsLocked is still meaningful: os.OpenFile
// itself may return errors that indicate that a file with the ModeExclusive bit
// set is already open.
func isLocked(err error) bool {
	s := err.Error()

	for _, frag := range lockedErrStrings {
		if strings.Contains(s, frag) {
			return true
		}
	}
	return false
}
