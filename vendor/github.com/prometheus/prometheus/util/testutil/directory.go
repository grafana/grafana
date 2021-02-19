// Copyright 2013 The Prometheus Authors
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

package testutil

import (
	"crypto/sha256"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

const (
	// The base directory used for test emissions, which instructs the operating
	// system to use the default temporary directory as the base or TMPDIR
	// environment variable.
	defaultDirectory = ""

	// NilCloser is a no-op Closer.
	NilCloser = nilCloser(true)

	// The number of times that a TemporaryDirectory will retry its removal
	temporaryDirectoryRemoveRetries = 2
)

type (
	// Closer is the interface that wraps the Close method.
	Closer interface {
		// Close reaps the underlying directory and its children. The directory
		// could be deleted by its users already.
		Close()
	}

	nilCloser bool

	// TemporaryDirectory models a closeable path for transient POSIX disk
	// activities.
	TemporaryDirectory interface {
		Closer

		// Path returns the underlying path for access.
		Path() string
	}

	// temporaryDirectory is kept as a private type due to private fields and
	// their interactions.
	temporaryDirectory struct {
		path   string
		tester T
	}

	callbackCloser struct {
		fn func()
	}

	// T implements the needed methods of testing.TB so that we do not need
	// to actually import testing (which has the side effect of adding all
	// the test flags, which we do not want in non-test binaries even if
	// they make use of these utilities for some reason).
	T interface {
		Fatal(args ...interface{})
		Fatalf(format string, args ...interface{})
	}
)

func (c nilCloser) Close() {
}

func (c callbackCloser) Close() {
	c.fn()
}

// NewCallbackCloser returns a Closer that calls the provided function upon
// closing.
func NewCallbackCloser(fn func()) Closer {
	return &callbackCloser{
		fn: fn,
	}
}

func (t temporaryDirectory) Close() {
	retries := temporaryDirectoryRemoveRetries
	err := os.RemoveAll(t.path)
	for err != nil && retries > 0 {
		switch {
		case os.IsNotExist(err):
			err = nil
		default:
			retries--
			err = os.RemoveAll(t.path)
		}
	}
	if err != nil {
		t.tester.Fatal(err)
	}
}

func (t temporaryDirectory) Path() string {
	return t.path
}

// NewTemporaryDirectory creates a new temporary directory for transient POSIX
// activities.
func NewTemporaryDirectory(name string, t T) (handler TemporaryDirectory) {
	var (
		directory string
		err       error
	)

	directory, err = ioutil.TempDir(defaultDirectory, name)
	if err != nil {
		t.Fatal(err)
	}

	handler = temporaryDirectory{
		path:   directory,
		tester: t,
	}

	return
}

// DirHash returns a hash of all files attributes and their content within a directory.
func DirHash(t *testing.T, path string) []byte {
	hash := sha256.New()
	err := filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		Ok(t, err)

		if info.IsDir() {
			return nil
		}
		f, err := os.Open(path)
		Ok(t, err)
		defer f.Close()

		_, err = io.Copy(hash, f)
		Ok(t, err)

		_, err = io.WriteString(hash, strconv.Itoa(int(info.Size())))
		Ok(t, err)

		_, err = io.WriteString(hash, info.Name())
		Ok(t, err)

		modTime, err := info.ModTime().GobEncode()
		Ok(t, err)

		_, err = io.WriteString(hash, string(modTime))
		Ok(t, err)
		return nil
	})
	Ok(t, err)

	return hash.Sum(nil)
}
