package archive

import (
	"os"
	"time"

	"golang.org/x/sys/windows"
)

func chtimes(name string, atime time.Time, mtime time.Time) error {
	if err := os.Chtimes(name, atime, mtime); err != nil {
		return err
	}

	pathp, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return err
	}
	h, err := windows.CreateFile(pathp,
		windows.FILE_WRITE_ATTRIBUTES, windows.FILE_SHARE_WRITE, nil,
		windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if err != nil {
		return err
	}
	defer windows.Close(h)
	c := windows.NsecToFiletime(mtime.UnixNano())
	return windows.SetFileTime(h, &c, nil, nil)
}

func lchtimes(name string, atime time.Time, mtime time.Time) error {
	return nil
}
