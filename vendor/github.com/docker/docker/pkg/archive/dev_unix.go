//go:build !windows && !freebsd

package archive

import "golang.org/x/sys/unix"

func mknod(path string, mode uint32, dev uint64) error {
	return unix.Mknod(path, mode, int(dev))
}
