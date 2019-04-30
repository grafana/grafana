package sysutil

import "time"

var btime time.Time

// BootTime returns the time the system was started.
func BootTime() time.Time {
	return btime
}

// Uptime returns the duration the system has been up.
func Uptime() time.Duration {
	return time.Now().Sub(btime)
}
