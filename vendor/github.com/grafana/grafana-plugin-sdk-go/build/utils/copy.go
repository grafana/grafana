package utils

import (
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
)

// CopyFile copies a file from src to dst. If src and dst files exist, and are
// the same, then return success. Otherise, attempt to create a hard link
// between the two files. If that fail, copy the file contents from src to dst.
func CopyFile(src, dst string) error {
	absSrc, err := filepath.Abs(src)
	if err != nil {
		return fmt.Errorf("failed to get absolute path of source file %q: %w", src, err)
	}
	sfi, err := os.Stat(src)
	if err != nil {
		return fmt.Errorf("couldn't stat source file %q: %w", absSrc, err)
	}
	if !sfi.Mode().IsRegular() {
		// Cannot copy non-regular files (e.g., directories, symlinks, devices, etc.)
		return fmt.Errorf("non-regular source file %s (%q)", absSrc, sfi.Mode().String())
	}
	dpath := filepath.Dir(dst)
	exists, err := Exists(dpath)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("destination directory doesn't exist: %q", dpath)
	}

	var dfi os.FileInfo
	dfi, err = os.Stat(dst)
	if err != nil {
		if !os.IsNotExist(err) {
			return err
		}
	} else {
		if !(dfi.Mode().IsRegular()) {
			return fmt.Errorf("non-regular destination file %s (%q)", dfi.Name(), dfi.Mode().String())
		}
		if os.SameFile(sfi, dfi) {
			return err
		}
	}

	if err = os.Link(src, dst); err == nil {
		return err
	}

	err = copyFileContents(src, dst)

	return err
}

// copyFileContents copies the contents of the file named src to the file named
// by dst. The file will be created if it does not already exist. If the
// destination file exists, all it's contents will be replaced by the contents
// of the source file.
func copyFileContents(src, dst string) (err error) {
	in, err := os.Open(src) // #nosec G304
	if err != nil {
		return
	}
	defer func() { _ = in.Close() }()

	out, err := os.Create(dst) // #nosec G304
	if err != nil {
		return
	}
	defer func() {
		if cerr := out.Close(); err == nil {
			err = cerr
		}
	}()

	if _, err = io.Copy(out, in); err != nil {
		return
	}

	err = out.Sync()
	return
}

// CopyRecursive copies files and directories recursively.
func CopyRecursive(src, dst string) error {
	sfi, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !sfi.Mode().IsDir() {
		return CopyFile(src, dst)
	}

	if _, err := os.Stat(dst); os.IsNotExist(err) {
		if err := os.MkdirAll(dst, sfi.Mode()); err != nil {
			return fmt.Errorf("failed to create directory %q: %w", dst, err)
		}
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := path.Join(src, entry.Name())
		dstPath := path.Join(dst, entry.Name())

		srcFi, err := os.Stat(srcPath)
		if err != nil {
			return err
		}

		switch srcFi.Mode() & os.ModeType {
		case os.ModeDir:
			if err := CopyRecursive(srcPath, dstPath); err != nil {
				return err
			}
		case os.ModeSymlink:
			link, err := os.Readlink(srcPath)
			if err != nil {
				return err
			}
			if err := os.Symlink(link, dstPath); err != nil {
				return err
			}
		default:
			if err := CopyFile(srcPath, dstPath); err != nil {
				return err
			}
		}

		if srcFi.Mode()&os.ModeSymlink != 0 {
			if err := os.Chmod(dstPath, srcFi.Mode()); err != nil {
				return err
			}
		}
	}

	return nil
}
