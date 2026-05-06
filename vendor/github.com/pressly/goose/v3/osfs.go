package goose

import (
	"io/fs"
	"os"
	"path/filepath"
)

// osFS wraps functions working with os filesystem to implement fs.FS interfaces.
type osFS struct{}

func (osFS) Open(name string) (fs.File, error) { return os.Open(filepath.FromSlash(name)) }

func (osFS) ReadDir(name string) ([]fs.DirEntry, error) { return os.ReadDir(filepath.FromSlash(name)) }

func (osFS) Stat(name string) (fs.FileInfo, error) { return os.Stat(filepath.FromSlash(name)) }

func (osFS) ReadFile(name string) ([]byte, error) { return os.ReadFile(filepath.FromSlash(name)) }

func (osFS) Glob(pattern string) ([]string, error) { return filepath.Glob(filepath.FromSlash(pattern)) }

type noopFS struct{}

var _ fs.FS = noopFS{}

func (f noopFS) Open(name string) (fs.File, error) {
	return nil, os.ErrNotExist
}
