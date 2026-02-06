//go:build !windows

package archive

import (
	"os"
	"time"

	"golang.org/x/sys/unix"
)

// chtimes changes the access time and modified time of a file at the given path.
// If the modified time is prior to the Unix Epoch (unixMinTime), or after the
// end of Unix Time (unixEpochTime), os.Chtimes has undefined behavior. In this
// case, Chtimes defaults to Unix Epoch, just in case.
func chtimes(name string, atime time.Time, mtime time.Time) error {
	return os.Chtimes(name, atime, mtime)
}

func timeToTimespec(time time.Time) (ts unix.Timespec) {
	if time.IsZero() {
		// Return UTIME_OMIT special value
		ts.Sec = 0
		ts.Nsec = (1 << 30) - 2
		return
	}
	return unix.NsecToTimespec(time.UnixNano())
}

func lchtimes(name string, atime time.Time, mtime time.Time) error {
	utimes := [2]unix.Timespec{
		timeToTimespec(atime),
		timeToTimespec(mtime),
	}
	err := unix.UtimesNanoAt(unix.AT_FDCWD, name, utimes[0:], unix.AT_SYMLINK_NOFOLLOW)
	if err != nil && err != unix.ENOSYS {
		return err
	}
	return err
}
