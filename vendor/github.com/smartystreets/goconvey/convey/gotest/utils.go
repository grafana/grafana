// Package gotest contains internal functionality. Although this package
// contains one or more exported names it is not intended for public
// consumption. See the examples package for how to use this project.
package gotest

import (
	"runtime"
	"strings"
)

func ResolveExternalCaller() (file string, line int, name string) {
	var caller_id uintptr
	callers := runtime.Callers(0, callStack)

	for x := 0; x < callers; x++ {
		caller_id, file, line, _ = runtime.Caller(x)
		if strings.HasSuffix(file, "_test.go") || strings.HasSuffix(file, "_tests.go") {
			name = runtime.FuncForPC(caller_id).Name()
			return
		}
	}
	file, line, name = "<unkown file>", -1, "<unknown name>"
	return // panic?
}

const maxStackDepth = 100 // This had better be enough...

var callStack []uintptr = make([]uintptr, maxStackDepth, maxStackDepth)
