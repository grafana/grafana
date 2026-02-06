//go:build freebsd

package archive

import "golang.org/x/sys/unix"

var mknod = unix.Mknod
