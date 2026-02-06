package archive

import (
	"io/fs"
	"os"
)

func statDifferent(oldStat fs.FileInfo, newStat fs.FileInfo) bool {
	// Note there is slight difference between the Linux and Windows
	// implementations here. Due to https://github.com/moby/moby/issues/9874,
	// and the fix at https://github.com/moby/moby/pull/11422, Linux does not
	// consider a change to the directory time as a change. Windows on NTFS
	// does. See https://github.com/moby/moby/pull/37982 for more information.

	if !sameFsTime(oldStat.ModTime(), newStat.ModTime()) ||
		oldStat.Mode() != newStat.Mode() ||
		oldStat.Size() != newStat.Size() && !oldStat.Mode().IsDir() {
		return true
	}
	return false
}

func (info *FileInfo) isDir() bool {
	return info.parent == nil || info.stat.Mode().IsDir()
}

func getIno(fi os.FileInfo) (inode uint64) {
	return
}

func hasHardlinks(fi os.FileInfo) bool {
	return false
}
