//go:build !windows

package archive

import (
	"io/fs"
	"os"
	"syscall"
)

func statDifferent(oldStat fs.FileInfo, newStat fs.FileInfo) bool {
	oldSys := oldStat.Sys().(*syscall.Stat_t)
	newSys := newStat.Sys().(*syscall.Stat_t)
	// Don't look at size for dirs, its not a good measure of change
	if oldStat.Mode() != newStat.Mode() ||
		oldSys.Uid != newSys.Uid ||
		oldSys.Gid != newSys.Gid ||
		oldSys.Rdev != newSys.Rdev ||
		// Don't look at size or modification time for dirs, its not a good
		// measure of change. See https://github.com/moby/moby/issues/9874
		// for a description of the issue with modification time, and
		// https://github.com/moby/moby/pull/11422 for the change.
		// (Note that in the Windows implementation of this function,
		// modification time IS taken as a change). See
		// https://github.com/moby/moby/pull/37982 for more information.
		(!oldStat.Mode().IsDir() &&
			(!sameFsTime(oldStat.ModTime(), newStat.ModTime()) || (oldStat.Size() != newStat.Size()))) {
		return true
	}
	return false
}

func (info *FileInfo) isDir() bool {
	return info.parent == nil || info.stat.Mode().IsDir()
}

func getIno(fi os.FileInfo) uint64 {
	return fi.Sys().(*syscall.Stat_t).Ino
}

func hasHardlinks(fi os.FileInfo) bool {
	return fi.Sys().(*syscall.Stat_t).Nlink > 1
}
