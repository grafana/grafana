// +build darwin freebsd openbsd netbsd

package sysutil

import (
	"bytes"
	"encoding/binary"
	"syscall"
	"time"
)

func init() {
	var err error

	// get boot time
	res, err := syscall.Sysctl("kern.boottime")
	if err != nil {
		btime = time.Now()
		return
	}

	// decode
	var t timeval
	err = binary.Read(bytes.NewBuffer([]byte(res)), binary.LittleEndian, &t)
	if err != nil {
		btime = time.Now()
		return
	}

	btime = time.Unix(int64(t.Sec), int64(t.Usec))
}
