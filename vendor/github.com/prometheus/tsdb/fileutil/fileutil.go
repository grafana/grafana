// Package fileutil provides utility methods used when dealing with the filesystem in tsdb.
// It is largely copied from github.com/coreos/etcd/pkg/fileutil to avoid the
// dependency chain it brings with it.
// Please check github.com/coreos/etcd for licensing information.
package fileutil

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// CopyDirs copies all directories, subdirectories and files recursively including the empty folders.
// Source and destination must be full paths.
func CopyDirs(src, dest string) error {
	if err := os.MkdirAll(dest, 0777); err != nil {
		return err
	}
	files, err := readDirs(src)
	if err != nil {
		return err
	}

	for _, f := range files {
		dp := filepath.Join(dest, f)
		sp := filepath.Join(src, f)

		stat, err := os.Stat(sp)
		if err != nil {
			return err
		}

		// Empty directories are also created.
		if stat.IsDir() {
			if err := os.MkdirAll(dp, 0777); err != nil {
				return err
			}
			continue
		}

		if err := copyFile(sp, dp); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dest string) error {
	data, err := ioutil.ReadFile(src)
	if err != nil {
		return err
	}

	err = ioutil.WriteFile(dest, data, 0644)
	if err != nil {
		return err
	}
	return nil
}

// readDirs reads the source directory recursively and
// returns relative paths to all files and empty directories.
func readDirs(src string) ([]string, error) {
	var files []string
	var err error

	err = filepath.Walk(src, func(path string, f os.FileInfo, err error) error {
		relativePath := strings.TrimPrefix(path, src)
		if len(relativePath) > 0 {
			files = append(files, relativePath)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

// ReadDir returns the filenames in the given directory in sorted order.
func ReadDir(dirpath string) ([]string, error) {
	dir, err := os.Open(dirpath)
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	names, err := dir.Readdirnames(-1)
	if err != nil {
		return nil, err
	}
	sort.Strings(names)
	return names, nil
}

// Rename safely renames a file.
func Rename(from, to string) error {
	if err := os.Rename(from, to); err != nil {
		return err
	}

	// Directory was renamed; sync parent dir to persist rename.
	pdir, err := OpenDir(filepath.Dir(to))
	if err != nil {
		return err
	}

	if err = Fsync(pdir); err != nil {
		pdir.Close()
		return err
	}
	return pdir.Close()
}

// Replace moves a file or directory to a new location and deletes any previous data.
// It is not atomic.
func Replace(from, to string) error {
	if err := os.RemoveAll(to); err != nil {
		return err
	}
	if err := os.Rename(from, to); err != nil {
		return err
	}

	// Directory was renamed; sync parent dir to persist rename.
	pdir, err := OpenDir(filepath.Dir(to))
	if err != nil {
		return err
	}

	if err = Fsync(pdir); err != nil {
		pdir.Close()
		return err
	}
	return pdir.Close()
}
