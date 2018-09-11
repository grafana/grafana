// +build !js

package gls

// This file is used for standard Go builds, which have the expected runtime
// support

import (
	"runtime"
)

var (
	findPtr = func() uintptr {
		var pc [1]uintptr
		n := runtime.Callers(4, pc[:])
		if n != 1 {
			panic("failed to find function pointer")
		}
		return pc[0]
	}

	getStack = func(offset, amount int) (stack []uintptr, next_offset int) {
		stack = make([]uintptr, amount)
		stack = stack[:runtime.Callers(offset, stack)]
		if len(stack) < amount {
			return stack, 0
		}
		return stack, offset + len(stack)
	}
)
