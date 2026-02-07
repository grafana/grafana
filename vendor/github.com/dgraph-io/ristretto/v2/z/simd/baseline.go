/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package simd

import (
	"fmt"
	"runtime"
	"sort"
	"sync"
)

// Search finds the key using the naive way
func Naive(xs []uint64, k uint64) int16 {
	var i int
	for i = 0; i < len(xs); i += 2 {
		x := xs[i]
		if x >= k {
			return int16(i / 2)
		}
	}
	return int16(i / 2)
}

func Clever(xs []uint64, k uint64) int16 {
	if len(xs) < 8 {
		return Naive(xs, k)
	}
	var twos, pk [4]uint64
	pk[0] = k
	pk[1] = k
	pk[2] = k
	pk[3] = k
	for i := 0; i < len(xs); i += 8 {
		twos[0] = xs[i]
		twos[1] = xs[i+2]
		twos[2] = xs[i+4]
		twos[3] = xs[i+6]
		if twos[0] >= pk[0] {
			return int16(i / 2)
		}
		if twos[1] >= pk[1] {
			return int16((i + 2) / 2)
		}
		if twos[2] >= pk[2] {
			return int16((i + 4) / 2)
		}
		if twos[3] >= pk[3] {
			return int16((i + 6) / 2)
		}

	}
	return int16(len(xs) / 2)
}

func Parallel(xs []uint64, k uint64) int16 {
	cpus := runtime.NumCPU()
	if cpus%2 != 0 {
		panic(fmt.Sprintf("odd number of CPUs %v", cpus))
	}
	sz := len(xs)/cpus + 1
	var wg sync.WaitGroup
	retChan := make(chan int16, cpus)
	for i := 0; i < len(xs); i += sz {
		end := i + sz
		if end >= len(xs) {
			end = len(xs)
		}
		chunk := xs[i:end]
		wg.Add(1)
		go func(hd int16, xs []uint64, k uint64, wg *sync.WaitGroup, ch chan int16) {
			for i := 0; i < len(xs); i += 2 {
				if xs[i] >= k {
					ch <- (int16(i) + hd) / 2
					break
				}
			}
			wg.Done()
		}(int16(i), chunk, k, &wg, retChan)
	}
	wg.Wait()
	close(retChan)
	var min int16 = (1 << 15) - 1
	for i := range retChan {
		if i < min {
			min = i
		}
	}
	if min == (1<<15)-1 {
		return int16(len(xs) / 2)
	}
	return min
}

func Binary(keys []uint64, key uint64) int16 {
	return int16(sort.Search(len(keys), func(i int) bool {
		if i*2 >= len(keys) {
			return true
		}
		return keys[i*2] >= key
	}))
}

//nolint:unused
func cmp2_native(twos, pk [2]uint64) int16 {
	if twos[0] == pk[0] {
		return 0
	}
	if twos[1] == pk[1] {
		return 1
	}
	return 2
}

//nolint:unused
func cmp4_native(fours, pk [4]uint64) int16 {
	for i := range fours {
		if fours[i] >= pk[i] {
			return int16(i)
		}
	}
	return 4
}

//nolint:unused
func cmp8_native(a [8]uint64, pk [4]uint64) int16 {
	for i := range a {
		if a[i] >= pk[0] {
			return int16(i)
		}
	}
	return 8
}
