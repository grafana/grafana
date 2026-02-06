package yamux

import (
	"sync"
	"time"
)

// Logger is a abstract of *log.Logger
type Logger interface {
	Print(v ...interface{})
	Printf(format string, v ...interface{})
	Println(v ...interface{})
}

var (
	timerPool = &sync.Pool{
		New: func() interface{} {
			timer := time.NewTimer(time.Hour * 1e6)
			timer.Stop()
			return timer
		},
	}
)

// asyncSendErr is used to try an async send of an error
func asyncSendErr(ch chan error, err error) {
	if ch == nil {
		return
	}
	select {
	case ch <- err:
	default:
	}
}

// asyncNotify is used to signal a waiting goroutine
func asyncNotify(ch chan struct{}) {
	select {
	case ch <- struct{}{}:
	default:
	}
}

// min computes the minimum of two values
func min(a, b uint32) uint32 {
	if a < b {
		return a
	}
	return b
}
