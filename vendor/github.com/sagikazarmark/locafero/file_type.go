package locafero

import "io/fs"

// FileType represents the kind of entries [Finder] can return.
type FileType int

// FileType represents the kind of entries [Finder] can return.
const (
	FileTypeAll FileType = iota
	FileTypeFile
	FileTypeDir
)

func (ft FileType) matchFileInfo(info fs.FileInfo) bool {
	switch ft {
	case FileTypeAll:
		return true

	case FileTypeFile:
		return !info.IsDir()

	case FileTypeDir:
		return info.IsDir()

	default:
		return false
	}
}
