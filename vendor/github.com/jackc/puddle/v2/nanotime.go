package puddle

import "time"

// nanotime returns the time in nanoseconds since process start.
//
// This approach, described at
// https://github.com/golang/go/issues/61765#issuecomment-1672090302,
// is fast, monotonic, and portable, and avoids the previous
// dependence on runtime.nanotime using the (unsafe) linkname hack.
// In particular, time.Since does less work than time.Now.
func nanotime() int64 {
	return time.Since(globalStart).Nanoseconds()
}

var globalStart = time.Now()
