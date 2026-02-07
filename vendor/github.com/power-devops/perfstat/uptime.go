//go:build aix
// +build aix

package perfstat

/*
#include "c_helpers.h"
*/
import "C"

import (
	"fmt"
	"time"
)

func timeSince(ts uint64) uint64 {
	return uint64(time.Now().Unix()) - ts
}

// BootTime() returns the time of the last boot in UNIX seconds
func BootTime() (uint64, error) {
	sec := C.boottime()
	if sec == -1 {
		return 0, fmt.Errorf("Can't determine boot time")
	}
	return uint64(sec), nil
}

// UptimeSeconds() calculates uptime in seconds
func UptimeSeconds() (uint64, error) {
	boot, err := BootTime()
	if err != nil {
		return 0, err
	}
	return timeSince(boot), nil
}
