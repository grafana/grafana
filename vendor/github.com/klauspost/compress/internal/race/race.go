// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build race

package race

import (
	"runtime"
	"unsafe"
)

func ReadSlice[T any](s []T) {
	if len(s) == 0 {
		return
	}
	runtime.RaceReadRange(unsafe.Pointer(&s[0]), len(s)*int(unsafe.Sizeof(s[0])))
}

func WriteSlice[T any](s []T) {
	if len(s) == 0 {
		return
	}
	runtime.RaceWriteRange(unsafe.Pointer(&s[0]), len(s)*int(unsafe.Sizeof(s[0])))
}
