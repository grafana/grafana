package testcontainers

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/testcontainers/testcontainers-go/log"
)

func isDir(path string) (bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return false, err
	}

	if fileInfo.IsDir() {
		return true, nil
	}

	return false, nil
}

// tarDir compress a directory using tar + gzip algorithms
func tarDir(src string, fileMode int64) (*bytes.Buffer, error) {
	// always pass src as absolute path
	abs, err := filepath.Abs(src)
	if err != nil {
		return &bytes.Buffer{}, fmt.Errorf("error getting absolute path: %w", err)
	}
	src = abs

	buffer := &bytes.Buffer{}

	log.Printf(">> creating TAR file from directory: %s\n", src)

	// tar > gzip > buffer
	zr := gzip.NewWriter(buffer)
	tw := tar.NewWriter(zr)

	_, baseDir := filepath.Split(src)
	// keep the path relative to the parent directory
	index := strings.LastIndex(src, baseDir)

	// walk through every file in the folder
	err = filepath.Walk(src, func(file string, fi os.FileInfo, errFn error) error {
		if errFn != nil {
			return fmt.Errorf("error traversing the file system: %w", errFn)
		}

		// if a symlink, skip file
		if fi.Mode().Type() == os.ModeSymlink {
			log.Printf(">> skipping symlink: %s\n", file)
			return nil
		}

		// generate tar header
		header, err := tar.FileInfoHeader(fi, file)
		if err != nil {
			return fmt.Errorf("error getting file info header: %w", err)
		}

		// see https://pkg.go.dev/archive/tar#FileInfoHeader:
		// Since fs.FileInfo's Name method only returns the base name of the file it describes,
		// it may be necessary to modify Header.Name to provide the full path name of the file.
		header.Name = filepath.ToSlash(file[index:])
		header.Mode = fileMode

		// write header
		if err := tw.WriteHeader(header); err != nil {
			return fmt.Errorf("error writing header: %w", err)
		}

		// if not a dir, write file content
		if !fi.IsDir() {
			data, err := os.Open(file)
			if err != nil {
				return fmt.Errorf("error opening file: %w", err)
			}
			defer data.Close()
			if _, err := io.Copy(tw, data); err != nil {
				return fmt.Errorf("error compressing file: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return buffer, err
	}

	// produce tar
	if err := tw.Close(); err != nil {
		return buffer, fmt.Errorf("error closing tar file: %w", err)
	}
	// produce gzip
	if err := zr.Close(); err != nil {
		return buffer, fmt.Errorf("error closing gzip file: %w", err)
	}

	return buffer, nil
}

// tarFile compress a single file using tar + gzip algorithms
func tarFile(basePath string, fileContent func(tw io.Writer) error, fileContentSize int64, fileMode int64) (*bytes.Buffer, error) {
	buffer := &bytes.Buffer{}

	zr := gzip.NewWriter(buffer)
	tw := tar.NewWriter(zr)

	hdr := &tar.Header{
		Name: basePath,
		Mode: fileMode,
		Size: fileContentSize,
	}
	if err := tw.WriteHeader(hdr); err != nil {
		return buffer, err
	}
	if err := fileContent(tw); err != nil {
		return buffer, err
	}

	// produce tar
	if err := tw.Close(); err != nil {
		return buffer, fmt.Errorf("error closing tar file: %w", err)
	}
	// produce gzip
	if err := zr.Close(); err != nil {
		return buffer, fmt.Errorf("error closing gzip file: %w", err)
	}

	return buffer, nil
}
