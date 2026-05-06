// Copyright 2023 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package blob

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"path/filepath"
	"time"

	"gocloud.dev/gcerrors"
	"gocloud.dev/internal/gcerr"
)

// Ensure that Bucket implements various io/fs interfaces.
var (
	_ = fs.FS(&Bucket{})
	_ = fs.SubFS(&Bucket{})
)

// iofsFileInfo describes a single file in an io/fs.FS.
// It implements fs.FileInfo and fs.DirEntry.
type iofsFileInfo struct {
	lo   *ListObject
	name string
}

func (f *iofsFileInfo) Name() string               { return f.name }
func (f *iofsFileInfo) Size() int64                { return f.lo.Size }
func (f *iofsFileInfo) Mode() fs.FileMode          { return fs.ModeIrregular }
func (f *iofsFileInfo) ModTime() time.Time         { return f.lo.ModTime }
func (f *iofsFileInfo) IsDir() bool                { return false }
func (f *iofsFileInfo) Sys() any                   { return f.lo }
func (f *iofsFileInfo) Info() (fs.FileInfo, error) { return f, nil }
func (f *iofsFileInfo) Type() fs.FileMode          { return fs.ModeIrregular }

// iofsOpenFile describes a single open file in an io/fs.FS.
// It implements fs.FileInfo and fs.File.
type iofsOpenFile struct {
	*Reader
	name string
}

func (f *iofsOpenFile) Name() string               { return f.name }
func (f *iofsOpenFile) Mode() fs.FileMode          { return fs.ModeIrregular }
func (f *iofsOpenFile) IsDir() bool                { return false }
func (f *iofsOpenFile) Sys() any                   { return f.r }
func (f *iofsOpenFile) Stat() (fs.FileInfo, error) { return f, nil }

// iofsDir describes a single directory in an io/fs.FS.
// It implements fs.FileInfo, fs.DirEntry, and fs.File.
type iofsDir struct {
	b    *Bucket
	key  string
	name string
	// If opened is true, we've read entries via openOnce().
	opened  bool
	entries []fs.DirEntry
	offset  int
}

func newDir(b *Bucket, key, name string) *iofsDir {
	return &iofsDir{b: b, key: key, name: name}
}

func (d *iofsDir) Name() string               { return d.name }
func (d *iofsDir) Size() int64                { return 0 }
func (d *iofsDir) Mode() fs.FileMode          { return fs.ModeDir }
func (d *iofsDir) Type() fs.FileMode          { return fs.ModeDir }
func (d *iofsDir) ModTime() time.Time         { return time.Time{} }
func (d *iofsDir) IsDir() bool                { return true }
func (d *iofsDir) Sys() any                   { return d }
func (d *iofsDir) Info() (fs.FileInfo, error) { return d, nil }
func (d *iofsDir) Stat() (fs.FileInfo, error) { return d, nil }
func (d *iofsDir) Read([]byte) (int, error) {
	return 0, &fs.PathError{Op: "read", Path: d.key, Err: fs.ErrInvalid}
}
func (d *iofsDir) Close() error { return nil }
func (d *iofsDir) ReadDir(count int) ([]fs.DirEntry, error) {
	if err := d.openOnce(); err != nil {
		return nil, err
	}
	n := len(d.entries) - d.offset
	if n == 0 && count > 0 {
		return nil, io.EOF
	}
	if count > 0 && n > count {
		n = count
	}
	list := make([]fs.DirEntry, n)
	for i := range list {
		list[i] = d.entries[d.offset+i]
	}
	d.offset += n
	return list, nil
}

func (d *iofsDir) openOnce() error {
	if d.opened {
		return nil
	}
	d.opened = true

	// blob expects directories to end in the delimiter, except at the top level.
	prefix := d.key
	if prefix != "" {
		prefix += "/"
	}
	listOpts := ListOptions{
		Prefix:    prefix,
		Delimiter: "/",
	}
	ctx, _ := d.b.ioFSCallback()

	// Fetch all the directory entries.
	// Conceivably we could only fetch a few here, and fetch the rest lazily
	// on demand, but that would add significant complexity.
	iter := d.b.List(&listOpts)
	for {
		item, err := iter.Next(ctx)
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		name := filepath.Base(item.Key)
		if item.IsDir {
			d.entries = append(d.entries, newDir(d.b, item.Key, name))
		} else {
			d.entries = append(d.entries, &iofsFileInfo{item, name})
		}
	}
	// There is no such thing as an empty directory in Bucket, so if
	// we didn't find anything, it doesn't exist.
	if len(d.entries) == 0 {
		return fs.ErrNotExist
	}
	return nil
}

// SetIOFSCallback sets a callback that is used during Open and calls on the objects
// returned from Open.
//
// fn should return a context.Context and *ReaderOptions that can be used in
// calls to List and NewReader on b. It may be called more than once.
//
// If SetIOFSCallback is never called, io.FS functions will use context.Background
// and a default ReaderOptions.
func (b *Bucket) SetIOFSCallback(fn func() (context.Context, *ReaderOptions)) {
	b.ioFSCallback = fn
}

// Open implements fs.FS.Open (https://pkg.go.dev/io/fs#FS).
func (b *Bucket) Open(path string) (fs.File, error) {
	if !fs.ValidPath(path) {
		return nil, &fs.PathError{Op: "open", Path: path, Err: fs.ErrInvalid}
	}

	// Check if it's a file. If not, assume it's a directory until proven otherwise.
	ctx, readerOpts := b.ioFSCallback()
	var isDir bool
	var key, name string // name is the last part of the path
	if path == "." {
		// Root is always a directory, but blob doesn't want the "." in the key.
		isDir = true
		key, name = "", "."
	} else {
		exists, _ := b.Exists(ctx, path)
		isDir = !exists
		key, name = path, filepath.Base(path)
	}

	// If it's a directory, list the directory contents. We can't do this lazily
	// because we need to error out here if it doesn't exist.
	if isDir {
		dir := newDir(b, key, name)
		err := dir.openOnce()
		if err != nil {
			if err == fs.ErrNotExist && path == "." {
				// The root directory must exist.
				return dir, nil
			}
			return nil, &fs.PathError{Op: "open", Path: path, Err: err}
		}
		return dir, nil
	}

	// It's a file; open it and return a wrapper.
	r, err := b.NewReader(ctx, path, readerOpts)
	if err != nil {
		code := gcerrors.Code(err)
		switch code {
		case gcerrors.NotFound:
			err = fmt.Errorf("%w: %w", err, fs.ErrNotExist)
		case gcerrors.PermissionDenied:
			err = fmt.Errorf("%w: %w", err, fs.ErrPermission)
		}
		return nil, &fs.PathError{Op: "open", Path: path, Err: err}
	}
	return &iofsOpenFile{r, filepath.Base(path)}, nil
}

// Sub implements fs.SubFS.Sub.
//
// SetIOFSCallback must be called prior to calling this function.
func (b *Bucket) Sub(dir string) (fs.FS, error) {
	if b.ioFSCallback == nil {
		return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: Sub -- SetIOFSCallback must be called before Sub")
	}
	if dir == "." {
		return b, nil
	}
	// blob expects directories to end in the delimiter, except at the top level.
	pb := PrefixedBucket(b, dir+"/")
	pb.SetIOFSCallback(b.ioFSCallback)
	return pb, nil
}
