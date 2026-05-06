package codejen

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/google/go-cmp/cmp"
	"github.com/hashicorp/go-multierror"
	"golang.org/x/sync/errgroup"
)

// FS is a pseudo-filesystem that supports batch-writing its contents to the
// real filesystem, or batch-comparing its contents to the real filesystem. Its
// intended use is for idiomatic `go generate`-style code generators, where it
// is expected that the results of codegen are committed to version control.
//
// In such cases, the normal behavior of a generator is to write files to disk,
// but in CI, that behavior should change to verify that what is already on disk
// is identical to the results of code generation. This allows CI to ensure that
// the results of code generation are always up to date. FS supports these
// related behaviors through its [FS.Write] and [FS.Verify] methods, respectively.
//
// FS behaves like an immutable append-only data structure - [File]s may not be
// removed once [FS.Add]ed. If a path conflict occurs when adding a new file or
// merging another FS, an error is returned.
//
// Every File added to FS must have a relative path. An absolute path may be
// provided as a universal prefix on calls to FS.Write or FS.Verify.
//
// FS implements [io/fs.FS], backed by [fstest.MapFS]. Added mutexes make FS
// safe for concurrent use, but it has the same scaling limitations as
// [fstest.MapFS] for large numbers of files.
//
// Note that the statelessness of FS entails that if a particular Jenny Input
// goes away, FS.Verify cannot know what orphaned generated files should be
// removed.
type FS struct {
	mapFS
	mu sync.RWMutex
}

// ShouldExistErr is an error that indicates a file should exist, but does not.
type ShouldExistErr struct {
	// TODO
}

// ContentsDifferErr is an error that indicates the contents of a file on disk are
// different than those in the FS.
type ContentsDifferErr struct {
	// TODO
}

type jennystack []NamedJenny

func (js jennystack) String() string {
	strs := make([]string, len(js))
	for i, j := range js {
		strs[i] = j.JennyName()
	}
	return strings.Join(strs, ":")
}

// NewFS creates a new FS, ready for use.
func NewFS() *FS {
	return &FS{
		mapFS: make(mapFS),
	}
}

// Verify checks the contents of each file against the filesystem. It emits an error
// if any of its contained files differ.
//
// If the provided prefix path is non-empty, it will be prepended to all file
// entries in the map for writing. prefix may be an absolute path.
func (fs *FS) Verify(ctx context.Context, prefix string) error {
	g, _ := errgroup.WithContext(ctx)
	g.SetLimit(12)
	var result *multierror.Error

	for _, it := range fs.AsFiles() {
		item := it
		g.Go(func() error {
			ipath := filepath.Join(prefix, item.RelativePath)
			if _, err := os.Stat(ipath); err != nil {
				if errors.Is(err, os.ErrNotExist) {
					result = multierror.Append(result, fmt.Errorf("%s: generated file should exist, but does not", ipath))
				} else {
					return fmt.Errorf("%s: could not stat generated file: %w", ipath, err)
				}
				return nil
			}

			ob, err := os.ReadFile(ipath) //nolint:gosec
			if err != nil {
				return fmt.Errorf("%s: error reading file: %w", ipath, err)
			}
			dstr := cmp.Diff(string(ob), string(item.Data))
			if dstr != "" {
				result = multierror.Append(result, fmt.Errorf("%s would have changed:\n\n%s", ipath, dstr))
			}
			return nil
		})
	}
	err := g.Wait()
	if err != nil {
		return fmt.Errorf("io error while verifying tree: %w", err)
	}

	return result.ErrorOrNil()
}

// Write writes all of the files to their indicated paths.
//
// If the provided prefix path is non-empty, it will be prepended to all file
// entries in the map for writing. prefix may be an absolute path.
// TODO try to undo already-written files on error (only best effort, it's impossible to guarantee)
func (fs *FS) Write(ctx context.Context, prefix string) error {
	g, _ := errgroup.WithContext(ctx)
	g.SetLimit(12)

	for _, item := range fs.AsFiles() {
		it := item
		g.Go(func() error {
			path := filepath.Join(prefix, it.RelativePath)
			err := os.MkdirAll(filepath.Dir(path), os.ModePerm)
			if err != nil {
				return fmt.Errorf("%s: failed to ensure parent directory exists: %w", path, err)
			}

			if err := os.WriteFile(path, it.Data, 0644); err != nil {
				return fmt.Errorf("%s: error while writing file: %w", path, err)
			}
			return nil
		})
	}

	return g.Wait()
}

// AsFiles returns a Files representing the contents of the FS.
//
// The contents are sorted lexicographically, and it is guaranteed that the
// invariants enforced by [Files.Validate] are met.
func (fs *FS) AsFiles() []File {
	if fs == nil {
		return nil
	}

	fs.mu.RLock()
	sl := make([]File, 0, len(fs.mapFS))

	for path, fi := range fs.mapFS {
		sl = append(sl, toFile(path, fi))
	}

	sort.Slice(sl, func(i, j int) bool {
		return sl[i].RelativePath < sl[j].RelativePath
	})

	fs.mu.RUnlock()
	return sl
}

// Add adds one or more files to the FS. An error is returned if the
// RelativePath of any provided files already exists in the FS.
func (fs *FS) Add(flist ...File) error {
	fs.mu.Lock()
	err := fs.add(flist...)
	fs.mu.Unlock()
	return err
}

func (fs *FS) add(flist ...File) error {
	if err := Files(flist).Validate(); err != nil {
		return err
	}

	return fs.addValidated(flist...)
}

func (fs *FS) addValidated(flist ...File) error {
	var result *multierror.Error

	for _, f := range flist {
		if rf, has := fs.mapFS[f.RelativePath]; has {
			result = multierror.Append(result, fmt.Errorf("cannot create %s for jenny %q, path already created by jenny %q", f.RelativePath, jennystack(f.From), stack(rf)))
		} else if filepath.IsAbs(f.RelativePath) {
			result = multierror.Append(result, fmt.Errorf("files must have relative paths, got %s from %q", f.RelativePath, jennystack(f.From)))
		}
	}

	if result.ErrorOrNil() != nil {
		return result
	}

	for _, f := range flist {
		fs.mapFS[f.RelativePath] = &mapFile{Data: f.Data, Sys: f.From}
	}
	return nil
}

// Merge combines all the entries from the provided FS into the receiver
// FS. Duplicate paths result in an error.
func (fs *FS) Merge(fs2 *FS) error {
	if fs2 == nil {
		return nil
	}

	fs.mu.Lock()
	defer fs.mu.Unlock()

	flist := make([]File, 0, len(fs2.mapFS))
	for k, inf := range fs2.mapFS {
		flist = append(flist, toFile(k, inf))
	}

	return fs.add(flist...)
}

// Len returns the number of items in the FS.
func (fs *FS) Len() int {
	fs.mu.Lock()
	ret := len(fs.mapFS)
	fs.mu.Unlock()
	return ret
}

// FileMapper takes a File and transforms it into a new File.
//
// codejen generally assumes that FileMappers will reuse an
// unmodified byte slice.
type FileMapper func(File) (File, error)

// Map creates a new FS by passing each [File] element in the receiver FS
// through the provided [FileMapper].
func (fs *FS) Map(fn FileMapper) (*FS, error) {
	flist := fs.AsFiles()
	nflist := make([]File, 0, len(flist))
	for _, file := range flist {
		nf, err := fn(file)
		if err != nil {
			return nil, err
		}
		nflist = append(nflist, nf)
	}
	fs2 := NewFS()
	if err := fs2.add(nflist...); err != nil {
		return nil, err
	}
	return fs2, nil
}

func toFile(path string, mf *mapFile) File {
	return File{
		RelativePath: path,
		Data:         mf.Data,
		From:         mf.Sys.([]NamedJenny),
	}
}

func stack(mf *mapFile) jennystack {
	return jennystack(mf.Sys.([]NamedJenny))
}
