package kuberesolver

import (
	"runtime/debug"
	"time"

	"google.golang.org/grpc/grpclog"
)

func until(f func(), initialPeriod, maxPeriod time.Duration, stopCh <-chan struct{}) {
	select {
	case <-stopCh:
		return
	default:
	}
	period := initialPeriod
	for {
		func() {
			defer handleCrash()
			f()
		}()
		select {
		case <-stopCh:
			return
		case <-time.After(period):
			if period*2 <= maxPeriod {
				period *= 2
			} else {
				period = initialPeriod
			}
		}
	}
}

// HandleCrash simply catches a crash and logs an error. Meant to be called via defer.
func handleCrash() {
	if r := recover(); r != nil {
		callers := string(debug.Stack())
		grpclog.Errorf("kuberesolver: recovered from panic: %#v (%v)\n%v", r, r, callers)
	}
}
