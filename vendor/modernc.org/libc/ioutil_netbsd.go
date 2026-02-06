// Copyright 2010 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE-GO file.

// Modifications Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"fmt"
	"os"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/unix"
)

// Random number state.
// We generate random temporary file names so that there's a good
// chance the file doesn't exist yet - keeps the number of tries in
// TempFile to a minimum.
var randState uint32
var randStateMu sync.Mutex

func reseed() uint32 {
	return uint32(time.Now().UnixNano() + int64(os.Getpid()))
}

func nextRandom(x uintptr) {
	randStateMu.Lock()
	r := randState
	if r == 0 {
		r = reseed()
	}
	r = r*1664525 + 1013904223 // constants from Numerical Recipes
	randState = r
	randStateMu.Unlock()
	copy((*RawMem)(unsafe.Pointer(x))[:6:6], fmt.Sprintf("%06d", int(1e9+r%1e9)%1e6))
}

func tempFile(s, x uintptr, _ int32) (fd int, err error) {
	const maxTry = 10000
	nconflict := 0
	for i := 0; i < maxTry; i++ {
		nextRandom(x)
		if fd, err = unix.Open(GoString(s), os.O_RDWR|os.O_CREATE|os.O_EXCL, 0600); err == nil {
			return fd, nil
		}

		if !os.IsExist(err) {
			return -1, err
		}

		if nconflict++; nconflict > 10 {
			randStateMu.Lock()
			randState = reseed()
			nconflict = 0
			randStateMu.Unlock()
		}
	}
	return -1, err
}
