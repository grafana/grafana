package timers

import (
	"sync"
	"time"
)

var timerPool sync.Pool

// AcquireTimer from pool.
func AcquireTimer(d time.Duration) *time.Timer {
	v := timerPool.Get()
	if v == nil {
		return time.NewTimer(d)
	}

	tm := v.(*time.Timer)
	if tm.Reset(d) {
		panic("Received an active timer from the pool!")
	}
	return tm
}

// ReleaseTimer to pool.
func ReleaseTimer(tm *time.Timer) {
	if !tm.Stop() {
		// Do not reuse timer that has been already stopped.
		// See https://groups.google.com/forum/#!topic/golang-nuts/-8O3AknKpwk
		return
	}
	timerPool.Put(tm)
}
