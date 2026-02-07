//go:build !windows

package archive

import (
	"archive/tar"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"

	"github.com/docker/docker/pkg/idtools"
	"golang.org/x/sys/unix"
)

func init() {
	sysStat = statUnix
}

// addLongPathPrefix adds the Windows long path prefix to the path provided if
// it does not already have it. It is a no-op on platforms other than Windows.
func addLongPathPrefix(srcPath string) string {
	return srcPath
}

// getWalkRoot calculates the root path when performing a TarWithOptions.
// We use a separate function as this is platform specific. On Linux, we
// can't use filepath.Join(srcPath,include) because this will clean away
// a trailing "." or "/" which may be important.
func getWalkRoot(srcPath string, include string) string {
	return strings.TrimSuffix(srcPath, string(filepath.Separator)) + string(filepath.Separator) + include
}

// chmodTarEntry is used to adjust the file permissions used in tar header based
// on the platform the archival is done.
func chmodTarEntry(perm os.FileMode) os.FileMode {
	return perm // noop for unix as golang APIs provide perm bits correctly
}

// statUnix populates hdr from system-dependent fields of fi without performing
// any OS lookups.
func statUnix(fi os.FileInfo, hdr *tar.Header) error {
	// Devmajor and Devminor are only needed for special devices.

	// In FreeBSD, RDev for regular files is -1 (unless overridden by FS):
	// https://cgit.freebsd.org/src/tree/sys/kern/vfs_default.c?h=stable/13#n1531
	// (NODEV is -1: https://cgit.freebsd.org/src/tree/sys/sys/param.h?h=stable/13#n241).

	// ZFS in particular does not override the default:
	// https://cgit.freebsd.org/src/tree/sys/contrib/openzfs/module/os/freebsd/zfs/zfs_vnops_os.c?h=stable/13#n2027

	// Since `Stat_t.Rdev` is uint64, the cast turns -1 into (2^64 - 1).
	// Such large values cannot be encoded in a tar header.
	if runtime.GOOS == "freebsd" && hdr.Typeflag != tar.TypeBlock && hdr.Typeflag != tar.TypeChar {
		return nil
	}
	s, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return nil
	}

	hdr.Uid = int(s.Uid)
	hdr.Gid = int(s.Gid)

	if s.Mode&unix.S_IFBLK != 0 ||
		s.Mode&unix.S_IFCHR != 0 {
		hdr.Devmajor = int64(unix.Major(uint64(s.Rdev))) //nolint: unconvert
		hdr.Devminor = int64(unix.Minor(uint64(s.Rdev))) //nolint: unconvert
	}

	return nil
}

func getInodeFromStat(stat interface{}) (inode uint64, err error) {
	s, ok := stat.(*syscall.Stat_t)

	if ok {
		inode = s.Ino
	}

	return
}

func getFileUIDGID(stat interface{}) (idtools.Identity, error) {
	s, ok := stat.(*syscall.Stat_t)

	if !ok {
		return idtools.Identity{}, errors.New("cannot convert stat value to syscall.Stat_t")
	}
	return idtools.Identity{UID: int(s.Uid), GID: int(s.Gid)}, nil
}

// handleTarTypeBlockCharFifo is an OS-specific helper function used by
// createTarFile to handle the following types of header: Block; Char; Fifo.
//
// Creating device nodes is not supported when running in a user namespace,
// produces a [syscall.EPERM] in most cases.
func handleTarTypeBlockCharFifo(hdr *tar.Header, path string) error {
	mode := uint32(hdr.Mode & 0o7777)
	switch hdr.Typeflag {
	case tar.TypeBlock:
		mode |= unix.S_IFBLK
	case tar.TypeChar:
		mode |= unix.S_IFCHR
	case tar.TypeFifo:
		mode |= unix.S_IFIFO
	}

	return mknod(path, mode, unix.Mkdev(uint32(hdr.Devmajor), uint32(hdr.Devminor)))
}

func handleLChmod(hdr *tar.Header, path string, hdrInfo os.FileInfo) error {
	if hdr.Typeflag == tar.TypeLink {
		if fi, err := os.Lstat(hdr.Linkname); err == nil && (fi.Mode()&os.ModeSymlink == 0) {
			if err := os.Chmod(path, hdrInfo.Mode()); err != nil {
				return err
			}
		}
	} else if hdr.Typeflag != tar.TypeSymlink {
		if err := os.Chmod(path, hdrInfo.Mode()); err != nil {
			return err
		}
	}
	return nil
}
