// +build js

package gls

// This file is used for GopherJS builds, which don't have normal runtime
// stack trace support

import (
	"strconv"
	"strings"

	"github.com/gopherjs/gopherjs/js"
)

const (
	jsFuncNamePrefix = "github_com_jtolds_gls_mark"
)

func jsMarkStack() (f []uintptr) {
	lines := strings.Split(
		js.Global.Get("Error").New().Get("stack").String(), "\n")
	f = make([]uintptr, 0, len(lines))
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if i == 0 {
			if line != "Error" {
				panic("didn't understand js stack trace")
			}
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 || fields[0] != "at" {
			panic("didn't understand js stack trace")
		}

		pos := strings.Index(fields[1], jsFuncNamePrefix)
		if pos < 0 {
			continue
		}
		pos += len(jsFuncNamePrefix)
		if pos >= len(fields[1]) {
			panic("didn't understand js stack trace")
		}
		char := string(fields[1][pos])
		switch char {
		case "S":
			f = append(f, uintptr(0))
		default:
			val, err := strconv.ParseUint(char, 16, 8)
			if err != nil {
				panic("didn't understand js stack trace")
			}
			f = append(f, uintptr(val)+1)
		}
	}
	return f
}

// variables to prevent inlining
var (
	findPtr = func() uintptr {
		funcs := jsMarkStack()
		if len(funcs) == 0 {
			panic("failed to find function pointer")
		}
		return funcs[0]
	}

	getStack = func(offset, amount int) (stack []uintptr, next_offset int) {
		return jsMarkStack(), 0
	}
)
