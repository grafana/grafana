// The merged_fs library implements go1.16's filesystem interface (fs.FS) using
// two underlying FSs, presenting two (or more) filesystems as a single FS.
//
// Usage:
//
//	// fs1 and fs2 can be anything that supports the fs.FS interface,
//	// including other MergedFS instances.
//	fs1, _ := zip.NewReader(zipFile, fileSize)
//	fs2, _ := zip.NewReader(zipFile2, file2Size)
//	// Implements the io.FS interface, resolving conflicts in favor of fs1.
//	merged := NewMergedFS(fs1, fs2)
package merged_fs

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"sort"
	"strings"
	"sync"
	"time"
)

// Implements the fs.FS interface, using the two underlying FS's. If a file is
// present in both filesystems, then the copy in A will always be preferred.
// This has an important implication: if a file is regular in A, but a
// directory in B, the entire directory in B will be ignored. If a file is a
// directory in both, then Open()-ing the file will result in a directory that
// contains the content from both FSs.
type MergedFS struct {
	// The two filesystems that have been merged. Do not modify these directly,
	// instead use NewMergedFS.
	A, B fs.FS

	// Used to speed up checks for whether a path in B is invalid due to it
	// including a directory with the name of a non-directory file in A.
	prefixCachingEnabled bool
	knownOKPrefixes      map[string]bool
	// Protects knownOKPrefixes from concurrent accesses.
	okPrefixesMutex sync.Mutex
}

// Takes two FS instances and returns an initialized MergedFS.
func NewMergedFS(a, b fs.FS) *MergedFS {
	return &MergedFS{
		A:                    a,
		B:                    b,
		prefixCachingEnabled: true,
		knownOKPrefixes:      make(map[string]bool),
	}
}

// This is the key component of this library. It represents a directory that is
// present in both filesystems. Implements the fs.File, fs.DirEntry, and
// fs.FileInfo interfaces.
type MergedDirectory struct {
	// The path to this directory in both FSs
	name string
	// This will simply be the mode bits for FS A.
	mode fs.FileMode
	// This will be the most recent mod time (unix timestamp) from FS's A or
	// B.
	modTime uint64
	// The directory entries from both FS A and B, sorted alphabetically.
	entries []fs.DirEntry
	// The next entry to return with ReadDir.
	readOffset int
}

func (d *MergedDirectory) Name() string {
	return d.name
}

func (d *MergedDirectory) Mode() fs.FileMode {
	return d.mode
}

func (d *MergedDirectory) ModTime() time.Time {
	return time.Unix(int64(d.modTime), 0)
}

func (d *MergedDirectory) IsDir() bool {
	return true
}

func (d *MergedDirectory) Sys() interface{} {
	return nil
}

func (d *MergedDirectory) Stat() (fs.FileInfo, error) {
	return d, nil
}

func (d *MergedDirectory) Info() (fs.FileInfo, error) {
	return d, nil
}

func (d *MergedDirectory) Type() fs.FileMode {
	return d.mode.Type()
}

func (d *MergedDirectory) Size() int64 {
	return 0
}

func (d *MergedDirectory) Read(data []byte) (int, error) {
	return 0, fmt.Errorf("%s is a directory", d.name)
}

func (d *MergedDirectory) Close() error {
	// Note: Do *not* clear the rest of the fields here, since the
	// MergedDirectory also serves as a DirEntry or FileInfo, which must be
	// able to outlive the File itself being closed.
	d.entries = nil
	d.readOffset = 0
	return nil
}

func (d *MergedDirectory) ReadDir(n int) ([]fs.DirEntry, error) {
	if d.readOffset >= len(d.entries) {
		if n <= 0 {
			// A special case required by the FS interface.
			return nil, nil
		}
		return nil, io.EOF
	}
	startEntry := d.readOffset
	var endEntry int
	if n <= 0 {
		endEntry = len(d.entries)
	} else {
		endEntry = startEntry + n
	}
	if endEntry > len(d.entries) {
		endEntry = len(d.entries)
	}
	toReturn := d.entries[startEntry:endEntry]
	d.readOffset = endEntry
	return toReturn, nil
}

// Returns the final element of the path. The path must be valid according to
// the rules of fs.ValidPath.
func baseName(path string) string {
	d := []byte(path)
	i := len(d)
	if i <= 1 {
		return path
	}
	i--
	for i >= 0 {
		if d[i] == '/' {
			break
		}
		i--
	}
	return string(d[i+1:])
}

// Returns a MergedDirectory, but doesn't set the entries slice or anything.
// (Intended to be used solely as a DirEntry, created with the same metadata
// as a MergedDirectory "File".
func getMergedDirEntry(a, b fs.DirEntry) (fs.DirEntry, error) {
	infoA, e := a.Info()
	if e != nil {
		return nil, fmt.Errorf("Failed getting info for file A: %w", e)
	}
	infoB, e := b.Info()
	if e != nil {
		return nil, fmt.Errorf("Failed getting info for file B: %w", e)
	}
	modTime := infoA.ModTime().Unix()
	modTimeB := infoB.ModTime().Unix()
	if modTimeB > modTime {
		modTime = modTimeB
	}
	return &MergedDirectory{
		name:       a.Name(),
		mode:       infoA.Mode(),
		modTime:    uint64(modTime),
		entries:    nil,
		readOffset: 0,
	}, nil
}

// Implements sort.Interface so we can sort entries by name.
type dirEntrySlice []fs.DirEntry

func (s dirEntrySlice) Len() int {
	return len(s)
}

func (s dirEntrySlice) Less(a, b int) bool {
	return s[a].Name() < s[b].Name()
}

func (s dirEntrySlice) Swap(a, b int) {
	s[a], s[b] = s[b], s[a]
}

// Takes two files that must be directories, and combines their contents into
// a single slice, sorted by name.
func mergeDirEntries(a, b fs.File) ([]fs.DirEntry, error) {
	dirA, ok := a.(fs.ReadDirFile)
	if !ok {
		return nil, fmt.Errorf("Directories must implement ReadDirFile")
	}
	dirB, ok := b.(fs.ReadDirFile)
	if !ok {
		return nil, fmt.Errorf("Directories must implement ReadDirFile")
	}
	entriesA, e := dirA.ReadDir(-1)
	if e != nil {
		return nil, fmt.Errorf("Failed reading entries from dir A: %w", e)
	}
	entriesB, e := dirB.ReadDir(-1)
	if e != nil {
		return nil, fmt.Errorf("Failed reading entries from dir B: %w", e)
	}

	// Maps the name to an existing index in toReturn.
	nameConflicts := make(map[string]int)
	toReturn := make([]fs.DirEntry, 0, len(entriesA)+len(entriesB))

	// Add the entries from directory A first.
	for _, entry := range entriesA {
		name := entry.Name()
		_, conflicts := nameConflicts[name]
		if conflicts {
			// Should never happen, as it would imply that FS A contained two
			// files with the same name in the same dir.
			return nil, fmt.Errorf("Duplicate name in dir A: %s", name)
		}
		nameConflicts[name] = len(toReturn)
		toReturn = append(toReturn, entry)
	}
	// Add the entries from directory B, skipping duplicate files, and updating
	// duplicate directory entries to share the same metadata. Otherwise, the
	// metadata returned by getting the info here may not match the metadata
	// returned by calling Open(..) on the dir. (required by testing/fstest)
	for _, entry := range entriesB {
		name := entry.Name()
		existingIndex, conflicts := nameConflicts[name]
		if !conflicts {
			// The name doesn't conflict, just add the entry and continue.
			nameConflicts[name] = len(toReturn)
			toReturn = append(toReturn, entry)
			continue
		}

		// The name conflicts, so look up the entry it conflicts with.
		existingEntry := toReturn[existingIndex]
		if !(existingEntry.IsDir() && entry.IsDir()) {
			// At least one of the conflicting entries isn't a directory so we
			// won't need to worry about a MergedDirectory's metadata not
			// matching.
			continue
		}

		// We have two conflicting directory entries, so we need to update the
		// DirEntry list we're returning to present metadata that matches the
		// data that will be returned by MergedDirectory.Stat().
		mergedDirEntry, e := getMergedDirEntry(existingEntry, entry)
		if e != nil {
			return nil, fmt.Errorf("Failed getting merged DirEntry for %s: %w",
				entry.Name(), e)
		}

		toReturn[existingIndex] = mergedDirEntry
	}

	// Finally, sort the results by name.
	sort.Sort(dirEntrySlice(toReturn))
	return toReturn, nil
}

// Creates and returns a new pseudo-directory "File" that contains the contents
// of both files a and b. Both a and b must be directories at the same
// specified path in m.A and m.B, respectively. Closes files a and b before
// returning, since they aren't needed by the MergedDirectory pseudo-file.
func (m *MergedFS) newMergedDirectory(a, b fs.File, path string) (fs.File,
	error) {
	defer a.Close()
	defer b.Close()
	sA, e := a.Stat()
	if e != nil {
		return nil, fmt.Errorf("Couldn't stat dir %s from FS A: %w", path, e)
	}
	sB, e := b.Stat()
	if e != nil {
		return nil, fmt.Errorf("Couldn't stat dir %s from FS B: %w", path, e)
	}
	modTime := sA.ModTime().Unix()
	modTimeB := sB.ModTime().Unix()
	if modTimeB > modTime {
		modTime = modTimeB
	}
	entries, e := mergeDirEntries(a, b)
	if e != nil {
		return nil, fmt.Errorf("Error merging directory contents: %w", e)
	}
	return &MergedDirectory{
		name:       baseName(path),
		mode:       sA.Mode(),
		modTime:    uint64(modTime),
		entries:    entries,
		readOffset: 0,
	}, nil
}

// Returns true if the given error is one that a filesystem may return when a
// path is invalid.
func isBadPathError(e error) bool {
	return errors.Is(e, fs.ErrNotExist) || errors.Is(e, fs.ErrInvalid)
}

// Returns true if the given prefix p is in the cache of known OK prefixes.
// Only call this while holding m.okPrefixesMutex.
func (m *MergedFS) checkCachedPrefix(p string) bool {
	if !m.prefixCachingEnabled {
		return false
	}
	return m.knownOKPrefixes[p]
}

// Adds a known OK prefix to the cache. Does nothing if caching is disabled.
// Only call this while holding m.okPrefixesMutes.
func (m *MergedFS) addPrefixToCache(p string) {
	if !m.prefixCachingEnabled {
		return
	}
	m.knownOKPrefixes[p] = true
}

// Returns an error if any prefix of the given path corresponds to a
// non-directory in m.A. Prefix components must therefore be either directories
// or nonexistent. Returns an error wrapping fs.ErrNotExist if any error is
// returned.
func (m *MergedFS) validatePathPrefix(path string) error {
	m.okPrefixesMutex.Lock()
	defer m.okPrefixesMutex.Unlock()

	// Return immediately if we've already seen that this path is OK.
	if m.checkCachedPrefix(path) {
		return nil
	}
	components := strings.Split(path, "/")
	for i := range components {
		prefix := strings.Join(components[0:i+1], "/")
		if m.checkCachedPrefix(path) {
			// We've already checked this and it's a directory or nonexistent.
			continue
		}
		f, e := m.A.Open(prefix)
		if e != nil {
			if isBadPathError(e) {
				// The path doesn't conflict--it doesn't exist in A.
				m.addPrefixToCache(prefix)
				m.addPrefixToCache(path)
				return nil
			}
			// We can't handle opening this path in A for some reason.
			return fmt.Errorf("%w: Error opening %s in A: %s", fs.ErrNotExist,
				path, e)
		}
		info, e := f.Stat()
		// We don't need the file handle after reading its info.
		f.Close()
		if e != nil {
			return fmt.Errorf("Couldn't stat file in A: %s", e)
		}
		if !info.IsDir() {
			// We found a non-dir file in A with the same name as the path.
			return fmt.Errorf("%w: %s is a file in A", fs.ErrNotExist,
				prefix)
		}
		// The prefix doesn't conflict (so far)--it is a directory in A.
		m.addPrefixToCache(prefix)
	}
	// The path's prefix is only directories in both FS's
	return nil
}

// Enables or disables path prefix caching, and clears the cache.
//
// I doubt most users will care about this function, but it allows working
// around what may be an occasional bug. Explaining it, however, unfortunately
// requires giving a few implementation details.
//
// First, know that this matters only if *all* of the following conditions
// apply to your use case:
//
// 1) Filesystem A is something that can change during runtime, such as an
// os.DirFS. (It doesn't matter if filesystem B changes.)
//
// 2) You expect filesystem A to actually change at runtime.
//
// 3) You want to make sure that *adding* a regular file to A correctly
// prevents access to the contents of a directory in B with the same name.
//
// Checking whether a regular file in A has the same name as a directory in B
// potentially requires checking every component-wise prefix of a path when
// opening a file. To speed this up, this library uses a cache of path prefixes
// that we know do *not* correspond to regular files in A. (This caching is
// enabled by default.) The problem can then arise if A changes after the cache
// already says that a path doesn't correspond to any regular files. So, if all
// three of the above conditions apply to you, you have two choices:
//
// First, you can use merged_fs in conjunction with another library, such as
// github.com/fsnotify/fsnotify to determine if the contents of FS A have
// changed. If A has changed, then simply call merged.UsePathCaching(true)
// to clear the cache while leaving caching enabled.
//
// Alternatively, call merged.UsePathCaching(false) to disable path caching
// entirely, ensuring correctness but potentially costing performance.
func (m *MergedFS) UsePathCaching(enabled bool) {
	m.okPrefixesMutex.Lock()
	defer m.okPrefixesMutex.Unlock()
	// Clear the cache
	m.knownOKPrefixes = make(map[string]bool)
	m.prefixCachingEnabled = enabled
	// If either sub-FS is a MergedFS, then set the prefix caching on it, too.
	// Note that this is not necessarily exhaustive, for example if a MergedFS
	// is wrapped by some other FS, it will be missed. Nonetheless, this will
	// capture what I expect to be the most common use of nested MergedFS's:
	// usage of MergeMultiple to produce a tree of MergedFS instances.
	nestedMergedFS, ok := m.A.(*MergedFS)
	if ok {
		nestedMergedFS.UsePathCaching(enabled)
	}
	nestedMergedFS, ok = m.B.(*MergedFS)
	if ok {
		nestedMergedFS.UsePathCaching(enabled)
	}
}

// If the path corresponds to a directory present in both A and B, this returns
// a MergedDirectory file. If it's present in both A and B, but isn't a
// directory in both, then this will simply return the copy in A. Otherwise,
// it returns the copy in B, so long as some prefix of the path doesn't
// correspond to a regular file in A.
func (m *MergedFS) Open(path string) (fs.File, error) {
	if !fs.ValidPath(path) {
		return nil, &fs.PathError{"open", "path", fs.ErrInvalid}
	}

	fA, e := m.A.Open(path)
	if e == nil {
		fileInfo, e := fA.Stat()
		if e != nil {
			fA.Close()
			return nil, fmt.Errorf("Couldn't stat %s in FS A: %w", path, e)
		}
		if !fileInfo.IsDir() {
			// If the file isn't a directory, we know it always overrides FS B,
			// so we don't even need to check FS B.
			return fA, nil
		}

		// The file is a directory in A, so we need to see if a directory with
		// the same name exists in B.
		fB, e := m.B.Open(path)
		if e != nil {
			if isBadPathError(e) {
				// The file doesn't exist in B, so return the copy in A.
				return fA, nil
			}
			// Treat any non-path errors in A or B as fatal.
			fA.Close()
			return nil, fmt.Errorf("Couldn't open %s in FS B: %w", path, e)
		}
		// Check if the file in B is a directory.
		fileInfo, e = fB.Stat()
		if e != nil {
			fA.Close()
			fB.Close()
			return nil, fmt.Errorf("Couldn't stat %s in FS B: %w", path, e)
		}
		if !fileInfo.IsDir() {
			// The file wasn't a dir in B, so ignore it in favor of the dir in
			// A.
			fB.Close()
			return fA, nil
		}
		// Finally, we know that the file is a directory in both A and B, so
		// return a MergedDirectory. This takes care of closing fA and fB.
		return m.newMergedDirectory(fA, fB, path)
	}
	if !isBadPathError(e) {
		return nil, fmt.Errorf("Couldn't open %s in FS A: %w", path, e)
	}

	// validatePathPrefix can be kind of expensive, so we'll try to open the
	// file in m.B *first*. This prevents a possible DoS where someone requests
	// paths that don't exist in either FS, but require checking and caching a
	// bunch of pointless path prefixes.
	fB, e := m.B.Open(path)
	if e != nil {
		return nil, e
	}
	// The file exists in B, so make sure a file in A doesn't override a
	// directory in B, rendering this path unreachable.
	e = m.validatePathPrefix(path)
	if e != nil {
		fB.Close()
		return nil, &fs.PathError{"open", path, e}
	}
	return fB, nil
}

// ReadFile reads the named file and returns the contents. A successful call
// returns err == nil, not err == EOF. Because ReadFile reads the whole file, it
// does not treat an EOF from Read as an error to be reported. This fulfills the
// io/fs.ReadFileFS interface. https://pkg.go.dev/io/fs#ReadFileFS
func (m *MergedFS) ReadFile(name string) ([]byte, error) {
	f, err := m.Open(name)
	if err != nil {
		return nil, err
	}
	defer f.Close() // ignore error

	// NOTE: This is the easiest way to implement this, however a longer and
	// more optimized approach is possible. Look at the stdlib
	// implementation for os.ReadFile in golang/src/os/file.go for details.
	return io.ReadAll(f) // shortest
}

// Implements the FS interface, but provides a filesystem containing no files.
// The only path you can "Open" is ".", which provides an empty directory.
type EmptyFS struct{}

func (f *EmptyFS) Open(path string) (fs.File, error) {
	if path != "." {
		return nil, &fs.PathError{"open", path, fs.ErrNotExist}
	}
	// Return an empty directory for "."
	return &MergedDirectory{
		name:    ".",
		mode:    0444 | fs.ModeDir,
		entries: nil,
	}, nil
}

// Used internally to build a balanced tree of merged filesystems. Must never
// be called with an empty slice.
func balancedMergeRecursive(content []fs.FS) fs.FS {
	if len(content) == 1 {
		return content[0]
	}
	if len(content) == 2 {
		return NewMergedFS(content[0], content[1])
	}
	lSize := len(content) / 2
	left := balancedMergeRecursive(content[0:lSize])
	right := balancedMergeRecursive(content[lSize:])
	return NewMergedFS(left, right)
}

// Merges an arbitrary list of filesystems into a single filesystem. The first
// filesystems are higher priority than the later filesystems, and all
// higher-priority FS's abide by the same rules that a two-way MergedFS does.
// For example, a directory in a lower-priority FS will not be reachable if any
// part of its path is a regular file in *any* higher-priority FS.  For now,
// this function simply constructs a balanced tree of MergedFS instances. In
// the future, it may use a different underlying implementation with the same
// semantics. Returns a valid empty filesystem (see the EmptyFS type) if no
// filesystem arguments are provided.
func MergeMultiple(filesystems ...fs.FS) fs.FS {
	if len(filesystems) == 0 {
		return &EmptyFS{}
	}
	return balancedMergeRecursive(filesystems)
}
