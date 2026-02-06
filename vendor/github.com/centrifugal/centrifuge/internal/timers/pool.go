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
		// Collect possibly added time from the channel
		// If timer has been stopped and nobody collected its value.
		select {
		case <-tm.C:
		default:
		}
	}
	timerPool.Put(tm)
}
