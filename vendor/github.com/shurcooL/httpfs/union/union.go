// Package union offers a simple http.FileSystem that can unify multiple filesystems at various mount points.
package union

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// New creates an union filesystem with the provided mapping of mount points to filesystems.
//
// Each mount point must be of form "/mydir". It must start with a '/', and contain a single directory name.
func New(mapping map[string]http.FileSystem) http.FileSystem {
	u := &unionFS{
		ns: make(map[string]http.FileSystem),
		root: &dirInfo{
			name: "/",
		},
	}
	for mountPoint, fs := range mapping {
		u.bind(mountPoint, fs)
	}
	return u
}

type unionFS struct {
	ns   map[string]http.FileSystem // Key is mount point, e.g., "/mydir".
	root *dirInfo
}

// bind mounts fs at mountPoint.
// mountPoint must be of form "/mydir". It must start with a '/', and contain a single directory name.
func (u *unionFS) bind(mountPoint string, fs http.FileSystem) {
	u.ns[mountPoint] = fs
	u.root.entries = append(u.root.entries, &dirInfo{
		name: mountPoint[1:],
	})
}

// Open opens the named file.
func (u *unionFS) Open(path string) (http.File, error) {
	// TODO: Maybe clean path?
	if path == "/" {
		return &dir{
			dirInfo: u.root,
		}, nil
	}
	for prefix, fs := range u.ns {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			innerPath := path[len(prefix):]
			if innerPath == "" {
				innerPath = "/"
			}
			return fs.Open(innerPath)
		}
	}
	return nil, &os.PathError{Op: "open", Path: path, Err: os.ErrNotExist}
}

// dirInfo is a static definition of a directory.
type dirInfo struct {
	name    string
	entries []os.FileInfo
}

func (d *dirInfo) Read([]byte) (int, error) {
	return 0, fmt.Errorf("cannot Read from directory %s", d.name)
}
func (d *dirInfo) Close() error               { return nil }
func (d *dirInfo) Stat() (os.FileInfo, error) { return d, nil }

func (d *dirInfo) Name() string       { return d.name }
func (d *dirInfo) Size() int64        { return 0 }
func (d *dirInfo) Mode() os.FileMode  { return 0755 | os.ModeDir }
func (d *dirInfo) ModTime() time.Time { return time.Time{} } // Actual mod time is not computed because it's expensive and rarely needed.
func (d *dirInfo) IsDir() bool        { return true }
func (d *dirInfo) Sys() interface{}   { return nil }

// dir is an opened dir instance.
type dir struct {
	*dirInfo
	pos int // Position within entries for Seek and Readdir.
}

func (d *dir) Seek(offset int64, whence int) (int64, error) {
	if offset == 0 && whence == io.SeekStart {
		d.pos = 0
		return 0, nil
	}
	return 0, fmt.Errorf("unsupported Seek in directory %s", d.dirInfo.name)
}

func (d *dir) Readdir(count int) ([]os.FileInfo, error) {
	if d.pos >= len(d.dirInfo.entries) && count > 0 {
		return nil, io.EOF
	}
	if count <= 0 || count > len(d.dirInfo.entries)-d.pos {
		count = len(d.dirInfo.entries) - d.pos
	}
	e := d.dirInfo.entries[d.pos : d.pos+count]
	d.pos += count
	return e, nil
}
