// +build !linux,!windows,!darwin,!freebsd,!openbsd,!netbsd

package sysutil

import "time"

func init() {
	btime = time.Now()
}
