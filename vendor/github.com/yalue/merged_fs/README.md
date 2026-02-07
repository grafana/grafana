Merged FS: Compose Multiple Go Filesystems
==========================================

The [release of version 1.16](https://golang.org/doc/go1.16) of the Go
programming language included a standard interface for read-only filesystems,
defined in Go's `io/fs` standard library package.  With this change came some
other standard-library changes, including the fact that `archive/zip` now
provides a "filesystem" interface for zip files, or the ability of `net/http`
to serve files from any filesystem providing the `io/fs` interface.  In
conjunction, this means utilities like the HTTP server can now directly serve
content from zip files, without the data needing to be extracted manually.

While that's already pretty cool, wouldn't it be nice if you could, for
example, transparently serve data from multiple zip files as if they were a
single directory?  This library provides the means to do so: it implements the
`io/fs.FS` interface using two underlying filesystems.  The underlying
filesystems can even include additional `MergedFS` instances, enabling
combining an arbitrary number of filesystems into a single `io/fs.FS`.

This repository provides a roughly similar function to [laher/mergefs](https://github.com/laher/mergefs),
but it offers one key distinction: correctly listing contents of merged
directories present in both FS's. This adds quite a bit of complexity. However,
laher/mergefs will be more performant for filesystems not requiring directory-
listing capabilities.

Usage
-----

[Documentation on pkg.go.dev](https://pkg.go.dev/github.com/yalue/merged_fs)

Simply pass two `io/fs.FS` instances to `merged_fs.NewMergedFS(...)` to obtain
a new `FS` serving data from both.  See the following example:

```go
import (
    "archive/zip"
    "github.com/yalue/merged_fs"
    "net/http"
)

func main() {
    // ...

    // Assume that zipFile1 and zipFile2 are two zip files that have been
    // opened using os.Open(...).
    zipFS1, _ := zip.NewReader(zipFile1, file1Size)
    zipFS2, _ := zip.NewReader(zipFile2, file2Size)

    // Serve files contained in either zip file.
    mergedFS := NewMergedFS(zipFS1, zipFS2)
    http.Handle("/", http.FileServer(http.FS(mergedFS)))

    // ...
}
```

Additional notes:

 - Both underlying FS's must support the `ReadDirFile` interface when opening
   directories.  Without this, we have no way for determining the contents of
   merged directories.

 - If a file with the same name is present in both `FS`s given to
   `NewMergedFS`, then the file in the first of the two always overrides the
   file with the same name in the second FS.

 - Following the prior point, if a directory in the second FS has the same name
   as a regular file in the first, neither the directory in the second FS nor
   any of its contents will be present in the merged FS (the regular file will
   take priority).  For example, if FS `A` contains a regular file named `a/b`,
   and FS `B` contains a regular file `c` at the path `a/b/c` (in which `a/b`
   is a directory), then `a/b/c` will not be available in the FS returned by
   `NewMergedFS(A, B)`, because the directory `b` is overridden by the regular
   file `b` in the first FS.

Multi-Way Merging
-----------------

If you want to merge more than two filesystems, you can use the `MergeMultiple`
function, which takes an arbitrary number of filesystem arguments:

```go
    merged := merged_fs.MergeMultiple(fs_1, fs_2, fs_3, fs_4)
```

The earlier arguments to `MergeMultiple` will have higher priority over the
later filesystems, in the same way that the first argument to `NewMergedFS` has
priority over the second. For now, the `MergeMultiple` function just provides
a convenient wrapper for building a tree of `MergedFS` instances.

