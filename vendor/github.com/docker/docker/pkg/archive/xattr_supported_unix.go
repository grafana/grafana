//go:build !linux && !windows

package archive

import "golang.org/x/sys/unix"

var noattr = unix.ENOATTR
