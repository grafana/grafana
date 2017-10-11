package redis

import (
	"sync"
	"testing"
	"time"
)

func TestRateLimiter(t *testing.T) {
	var n = 100000
	if testing.Short() {
		n = 1000
	}
	rl := newRateLimiter(time.Minute, n)

	wg := &sync.WaitGroup{}
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			if !rl.Check() {
				panic("check failed")
			}
			wg.Done()
		}()
	}
	wg.Wait()

	if rl.Check() && rl.Check() {
		t.Fatal("check passed")
	}
}
