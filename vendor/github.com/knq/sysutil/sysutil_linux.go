// +build linux

package sysutil

import (
	"bytes"
	"io/ioutil"
	"strconv"
	"time"
)

var (
	btimePrefix = []byte("btime ")
	lineEnd     = []byte("\n")
)

func init() {
	buf, err := ioutil.ReadFile("/proc/stat")
	if err != nil {
		btime = time.Now()
		return
	}

	for _, line := range bytes.SplitN(buf, lineEnd, -1) {
		if bytes.HasPrefix(line, btimePrefix) {
			t, err := strconv.ParseInt(string(line[len(btimePrefix):]), 10, 64)
			if err != nil {
				btime = time.Now()
				return
			}

			btime = time.Unix(t, 0)
			break
		}
	}
}
