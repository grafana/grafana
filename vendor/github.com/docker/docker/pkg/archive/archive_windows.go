package archive

import (
	"archive/tar"
	"os"
	"path/filepath"
	"strings"

	"github.com/docker/docker/pkg/idtools"
)

// longPathPrefix is the longpath prefix for Windows file paths.
const longPathPrefix = `\\?\`

// addLongPathPrefix adds the Windows long path prefix to the path provided if
// it does not already have it. It is a no-op on platforms other than Windows.
//
// addLongPathPrefix is a copy of [github.com/docker/docker/pkg/longpath.AddPrefix].
func addLongPathPrefix(srcPath string) string {
	if strings.HasPrefix(srcPath, longPathPrefix) {
		return srcPath
	}
	if strings.HasPrefix(srcPath, `\\`) {
		// This is a UNC path, so we need to add 'UNC' to the path as well.
		return longPathPrefix + `UNC` + srcPath[1:]
	}
	return longPathPrefix + srcPath
}

// getWalkRoot calculates the root path when performing a TarWithOptions.
// We use a separate function as this is platform specific.
func getWalkRoot(srcPath string, include string) string {
	return filepath.Join(srcPath, include)
}

// chmodTarEntry is used to adjust the file permissions used in tar header based
// on the platform the archival is done.
func chmodTarEntry(perm os.FileMode) os.FileMode {
	// Remove group- and world-writable bits.
	perm &= 0o755

	// Add the x bit: make everything +x on Windows
	return perm | 0o111
}

func setHeaderForSpecialDevice(hdr *tar.Header, name string, stat interface{}) (err error) {
	// do nothing. no notion of Rdev, Nlink in stat on Windows
	return
}

func getInodeFromStat(stat interface{}) (inode uint64, err error) {
	// do nothing. no notion of Inode in stat on Windows
	return
}

// handleTarTypeBlockCharFifo is an OS-specific helper function used by
// createTarFile to handle the following types of header: Block; Char; Fifo
func handleTarTypeBlockCharFifo(hdr *tar.Header, path string) error {
	return nil
}

func handleLChmod(hdr *tar.Header, path string, hdrInfo os.FileInfo) error {
	return nil
}

func getFileUIDGID(stat interface{}) (idtools.Identity, error) {
	// no notion of file ownership mapping yet on Windows
	return idtools.Identity{UID: 0, GID: 0}, nil
}
