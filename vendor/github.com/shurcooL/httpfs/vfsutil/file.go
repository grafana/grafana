package vfsutil

import (
	"net/http"
	"os"
)

// File implements http.FileSystem using the native file system restricted to a
// specific file served at root.
//
// While the FileSystem.Open method takes '/'-separated paths, a File's string
// value is a filename on the native file system, not a URL, so it is separated
// by filepath.Separator, which isn't necessarily '/'.
type File string

func (f File) Open(name string) (http.File, error) {
	if name != "/" {
		return nil, &os.PathError{Op: "open", Path: name, Err: os.ErrNotExist}
	}
	return os.Open(string(f))
}
