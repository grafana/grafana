package filter

import (
	"os"
	pathpkg "path"
)

// FilesWithExtensions returns a filter func that selects files (but not directories)
// that have any of the given extensions. For example:
//
//	filter.FilesWithExtensions(".go", ".html")
//
// Would select both .go and .html files. It would not select any directories.
func FilesWithExtensions(exts ...string) Func {
	return func(path string, fi os.FileInfo) bool {
		if fi.IsDir() {
			return false
		}
		for _, ext := range exts {
			if pathpkg.Ext(path) == ext {
				return true
			}
		}
		return false
	}
}
