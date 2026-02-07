// Copyright 2021 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"fmt"
	"math"
	"os"
	"sync"
	"unsafe"
)

var (
	watches   = map[uintptr]watch{}
	watchesMu sync.Mutex
)

type watch interface {
	msg() string
}

type watcher string

func (w watcher) msg() string {
	if w == "" {
		return ""
	}

	return fmt.Sprintf(": %s", w)
}

type watchInt8 struct {
	val int8
	watcher
}

func WatchInt8(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchInt8{*(*int8)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchUint8 struct {
	val uint8
	watcher
}

func WatchUint8(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchUint8{*(*uint8)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchInt16 struct {
	val int16
	watcher
}

func WatchInt16(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchInt16{*(*int16)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchUint16 struct {
	val uint16
	watcher
}

func WatchUint16(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchUint16{*(*uint16)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchInt32 struct {
	val int32
	watcher
}

func WatchInt32(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchInt32{*(*int32)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchUint32 struct {
	val uint32
	watcher
}

func WatchUint32(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchUint32{*(*uint32)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchInt64 struct {
	val int64
	watcher
}

func WatchInt64(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchInt64{*(*int64)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchUint64 struct {
	val uint64
	watcher
}

func WatchUint64(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchUint64{*(*uint64)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchFloat32 struct {
	val float32
	watcher
}

func WatchFloat32(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchFloat32{*(*float32)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchFloat64 struct {
	val float64
	watcher
}

func WatchFloat64(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchFloat64{*(*float64)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

type watchPtr struct {
	val uintptr
	watcher
}

func WatchPtr(p uintptr, msg string) {
	watchesMu.Lock()
	watches[p] = &watchPtr{*(*uintptr)(unsafe.Pointer(p)), watcher(msg)}
	watchesMu.Unlock()
}

func Watch() {
	watchesMu.Lock()
	flush := false
	for p, v := range watches {
		switch x := v.(type) {
		case *watchInt8:
			if val := *(*int8)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: int8@%#x was %d, new %d%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		case *watchUint8:
			if val := *(*uint8)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: uint8@%#x was %d, new %d%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		case *watchInt16:
			if val := *(*int16)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: int16@%#x was %d, new %d%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		case *watchUint16:
			if val := *(*uint16)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: uint16@%#x was %d, new %d%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		case *watchInt32:
			if val := *(*int32)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: int32@%#x was %d, new %d%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		case *watchUint32:
			if val := *(*uint32)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: uint32@%#x was %d, new %d%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		case *watchInt64:
			if val := *(*int64)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: int64@%#x was %d, new %d%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		case *watchUint64:
			if val := *(*uint64)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: uint64@%#x was %d, new %d%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		case *watchFloat32:
			if val := *(*float32)(unsafe.Pointer(p)); math.Float32bits(val) != math.Float32bits(x.val) {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: float32@%#x was %v(%#x), new %v(%#x)%s\n", origin(2), p, x.val, math.Float32bits(x.val), val, math.Float32bits(val), x.msg())
				x.val = val
			}
		case *watchFloat64:
			if val := *(*float64)(unsafe.Pointer(p)); math.Float64bits(val) != math.Float64bits(x.val) {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: float64@%#x was %v(%#x), new %v(%#x)%s\n", origin(2), p, x.val, math.Float64bits(x.val), val, math.Float64bits(val), x.msg())
				x.val = val
			}
		case *watchPtr:
			if val := *(*uintptr)(unsafe.Pointer(p)); val != x.val {
				flush = true
				fmt.Fprintf(os.Stderr, "%v: ptr@%#x was %#x, new %#x%s\n", origin(2), p, x.val, val, x.msg())
				x.val = val
			}
		default:
			panic(todo("%T", x))
		}
	}
	if flush {
		os.Stderr.Sync()
	}
	watchesMu.Unlock()
}

func WatchDelete(p uintptr) {
	watchesMu.Lock()
	delete(watches, p)
	watchesMu.Unlock()
}
