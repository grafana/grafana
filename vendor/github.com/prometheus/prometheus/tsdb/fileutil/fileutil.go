// Copyright 2018 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package fileutil provides utility methods used when dealing with the filesystem in tsdb.
// It is largely copied from github.com/coreos/etcd/pkg/fileutil to avoid the
// dependency chain it brings with it.
// Please check github.com/coreos/etcd for licensing information.
package fileutil

import (
	"io/ioutil"
	"os"
	"path/filepath"
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

	err = ioutil.WriteFile(dest, data, 0666)
	if err != nil {
		return err
	}
	return nil
}

// readDirs reads the source directory recursively and
// returns relative paths to all files and empty directories.
func readDirs(src string) ([]string, error) {
	var files []string

	err := filepath.Walk(src, func(path string, f os.FileInfo, err error) error {
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

	if err = pdir.Sync(); err != nil {
		pdir.Close()
		return err
	}
	return pdir.Close()
}

// Replace moves a file or directory to a new location and deletes any previous data.
// It is not atomic.
func Replace(from, to string) error {
	// Remove destination only if it is a dir otherwise leave it to os.Rename
	// as it replaces the destination file and is atomic.
	{
		f, err := os.Stat(to)
		if !os.IsNotExist(err) {
			if err == nil && f.IsDir() {
				if err := os.RemoveAll(to); err != nil {
					return err
				}
			}
		}
	}

	return Rename(from, to)
}
