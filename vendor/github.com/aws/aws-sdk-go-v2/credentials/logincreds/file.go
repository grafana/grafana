package logincreds

import (
	"io"
	"os"
)

var openFile func(string) (io.ReadCloser, error) = func(name string) (io.ReadCloser, error) {
	return os.Open(name)
}

var createFile func(string) (io.WriteCloser, error) = func(name string) (io.WriteCloser, error) {
	return os.Create(name)
}
