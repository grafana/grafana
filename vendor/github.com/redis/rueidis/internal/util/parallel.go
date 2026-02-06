package util

import (
	"sync"
)

func ParallelKeys[K comparable, V any](maxp int, p map[K]V, fn func(k K)) {
	ch := make(chan K, len(p))
	for k := range p {
		ch <- k
	}
	closeThenParallel(maxp, ch, fn)
}

func ParallelVals[K comparable, V any](maxp int, p map[K]V, fn func(k V)) {
	ch := make(chan V, len(p))
	for _, v := range p {
		ch <- v
	}
	closeThenParallel(maxp, ch, fn)
}

func worker[V any](wg *sync.WaitGroup, ch chan V, fn func(k V)) {
	for v := range ch {
		fn(v)
	}
	wg.Done()
}

func closeThenParallel[V any](maxp int, ch chan V, fn func(k V)) {
	close(ch)
	concurrency := len(ch)
	if concurrency > maxp {
		concurrency = maxp
	}
	var wg sync.WaitGroup
	wg.Add(concurrency)
	for i := 1; i < concurrency; i++ {
		go worker(&wg, ch, fn)
	}
	if concurrency > 0 {
		worker(&wg, ch, fn)
	}
	wg.Wait()
}
