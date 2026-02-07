package vfsutil

import (
	"io"
	"net/http"
	"os"
	pathpkg "path"
	"path/filepath"
	"sort"
)

// Walk walks the filesystem rooted at root, calling walkFn for each file or
// directory in the filesystem, including root. All errors that arise visiting files
// and directories are filtered by walkFn. The files are walked in lexical
// order.
func Walk(fs http.FileSystem, root string, walkFn filepath.WalkFunc) error {
	info, err := Stat(fs, root)
	if err != nil {
		return walkFn(root, nil, err)
	}
	return walk(fs, root, info, walkFn)
}

// readDirNames reads the directory named by dirname and returns
// a sorted list of directory entries.
func readDirNames(fs http.FileSystem, dirname string) ([]string, error) {
	fis, err := ReadDir(fs, dirname)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(fis))
	for i := range fis {
		names[i] = fis[i].Name()
	}
	sort.Strings(names)
	return names, nil
}

// walk recursively descends path, calling walkFn.
func walk(fs http.FileSystem, path string, info os.FileInfo, walkFn filepath.WalkFunc) error {
	err := walkFn(path, info, nil)
	if err != nil {
		if info.IsDir() && err == filepath.SkipDir {
			return nil
		}
		return err
	}

	if !info.IsDir() {
		return nil
	}

	names, err := readDirNames(fs, path)
	if err != nil {
		return walkFn(path, info, err)
	}

	for _, name := range names {
		filename := pathpkg.Join(path, name)
		fileInfo, err := Stat(fs, filename)
		if err != nil {
			if err := walkFn(filename, fileInfo, err); err != nil && err != filepath.SkipDir {
				return err
			}
		} else {
			err = walk(fs, filename, fileInfo, walkFn)
			if err != nil {
				if !fileInfo.IsDir() || err != filepath.SkipDir {
					return err
				}
			}
		}
	}
	return nil
}

// WalkFilesFunc is the type of the function called for each file or directory visited by WalkFiles.
// It's like filepath.WalkFunc, except it provides an additional ReadSeeker parameter for file being visited.
type WalkFilesFunc func(path string, info os.FileInfo, rs io.ReadSeeker, err error) error

// WalkFiles walks the filesystem rooted at root, calling walkFn for each file or
// directory in the filesystem, including root. In addition to FileInfo, it passes an
// ReadSeeker to walkFn for each file it visits.
func WalkFiles(fs http.FileSystem, root string, walkFn WalkFilesFunc) error {
	file, info, err := openStat(fs, root)
	if err != nil {
		return walkFn(root, nil, nil, err)
	}
	return walkFiles(fs, root, info, file, walkFn)
}

// walkFiles recursively descends path, calling walkFn.
// It closes the input file after it's done with it, so the caller shouldn't.
func walkFiles(fs http.FileSystem, path string, info os.FileInfo, file http.File, walkFn WalkFilesFunc) error {
	err := walkFn(path, info, file, nil)
	file.Close()
	if err != nil {
		if info.IsDir() && err == filepath.SkipDir {
			return nil
		}
		return err
	}

	if !info.IsDir() {
		return nil
	}

	names, err := readDirNames(fs, path)
	if err != nil {
		return walkFn(path, info, nil, err)
	}

	for _, name := range names {
		filename := pathpkg.Join(path, name)
		file, fileInfo, err := openStat(fs, filename)
		if err != nil {
			if err := walkFn(filename, nil, nil, err); err != nil && err != filepath.SkipDir {
				return err
			}
		} else {
			err = walkFiles(fs, filename, fileInfo, file, walkFn)
			// file is closed by walkFiles, so we don't need to close it here.
			if err != nil {
				if !fileInfo.IsDir() || err != filepath.SkipDir {
					return err
				}
			}
		}
	}
	return nil
}

// openStat performs Open and Stat and returns results, or first error encountered.
// The caller is responsible for closing the returned file when done.
func openStat(fs http.FileSystem, name string) (http.File, os.FileInfo, error) {
	f, err := fs.Open(name)
	if err != nil {
		return nil, nil, err
	}
	fi, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, nil, err
	}
	return f, fi, nil
}
