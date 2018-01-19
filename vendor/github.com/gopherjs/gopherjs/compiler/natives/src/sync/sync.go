// +build js

package sync

import "github.com/gopherjs/gopherjs/js"

var semWaiters = make(map[*uint32][]chan bool)

// semAwoken tracks the number of waiters awoken by runtime_Semrelease (`ch <- true`)
// that have not yet acquired the semaphore (`<-ch` in runtime_SemacquireMutex).
//
// This prevents a new call to runtime_SemacquireMutex to wrongly acquire the semaphore
// in between (because runtime_Semrelease has already incremented the semaphore while
// all the pending calls to runtime_SemacquireMutex have not yet received from the channel
// and thus decremented the semaphore).
//
// See https://github.com/gopherjs/gopherjs/issues/736.
var semAwoken = make(map[*uint32]uint32)

func runtime_Semacquire(s *uint32) {
	runtime_SemacquireMutex(s, false)
}

// SemacquireMutex is like Semacquire, but for profiling contended Mutexes.
// Mutex profiling is not supported, so just use the same implementation as runtime_Semacquire.
// TODO: Investigate this. If it's possible to implement, consider doing so, otherwise remove this comment.
func runtime_SemacquireMutex(s *uint32, lifo bool) {
	if (*s - semAwoken[s]) == 0 {
		ch := make(chan bool)
		if lifo {
			semWaiters[s] = append([]chan bool{ch}, semWaiters[s]...)
		} else {
			semWaiters[s] = append(semWaiters[s], ch)
		}
		<-ch
		semAwoken[s] -= 1
		if semAwoken[s] == 0 {
			delete(semAwoken, s)
		}
	}
	*s--
}

func runtime_Semrelease(s *uint32, handoff bool) {
	// TODO: Use handoff if needed/possible.
	*s++

	w := semWaiters[s]
	if len(w) == 0 {
		return
	}

	ch := w[0]
	w = w[1:]
	semWaiters[s] = w
	if len(w) == 0 {
		delete(semWaiters, s)
	}

	semAwoken[s] += 1

	ch <- true
}

func runtime_notifyListCheck(size uintptr) {}

func runtime_canSpin(i int) bool {
	return false
}

// Copy of time.runtimeNano.
func runtime_nanotime() int64 {
	const millisecond = 1000000
	return js.Global.Get("Date").New().Call("getTime").Int64() * millisecond
}
