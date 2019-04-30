// +build darwin freebsd

package sysutil

type timeval struct {
	Sec  int32
	Usec int32
}
