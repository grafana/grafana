package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

const numRequests = 10000

var count int64

func networkRequest() {
	time.Sleep(time.Millisecond)
	atomic.AddInt64(&count, 1)
}

func main() {
	wg := &sync.WaitGroup{}
	started := time.Now()
	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			networkRequest()
		}()
	}

	wg.Wait()
	fmt.Println(count, time.Since(started))
}
