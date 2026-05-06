// Copyright (C) 2019 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

//go:build cgo && sqlite_unlock_notify
// +build cgo,sqlite_unlock_notify

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_ENABLE_UNLOCK_NOTIFY

#include <stdlib.h>
#include "sqlite3-binding.h"

extern void unlock_notify_callback(void *arg, int argc);
*/
import "C"
import (
	"fmt"
	"math"
	"sync"
	"unsafe"
)

type unlock_notify_table struct {
	sync.Mutex
	seqnum uint
	table  map[uint]chan struct{}
}

var unt unlock_notify_table = unlock_notify_table{table: make(map[uint]chan struct{})}

func (t *unlock_notify_table) add(c chan struct{}) uint {
	t.Lock()
	defer t.Unlock()
	h := t.seqnum
	t.table[h] = c
	t.seqnum++
	return h
}

func (t *unlock_notify_table) remove(h uint) {
	t.Lock()
	defer t.Unlock()
	delete(t.table, h)
}

func (t *unlock_notify_table) get(h uint) chan struct{} {
	t.Lock()
	defer t.Unlock()
	c, ok := t.table[h]
	if !ok {
		panic(fmt.Sprintf("Non-existent key for unlcok-notify channel: %d", h))
	}
	return c
}

//export unlock_notify_callback
func unlock_notify_callback(argv unsafe.Pointer, argc C.int) {
	for i := 0; i < int(argc); i++ {
		parg := ((*(*[(math.MaxInt32 - 1) / unsafe.Sizeof((*C.uint)(nil))]*[1]uint)(argv))[i])
		arg := *parg
		h := arg[0]
		c := unt.get(h)
		c <- struct{}{}
	}
}

//export unlock_notify_wait
func unlock_notify_wait(db *C.sqlite3) C.int {
	// It has to be a bufferred channel to not block in sqlite_unlock_notify
	// as sqlite_unlock_notify could invoke the callback before it returns.
	c := make(chan struct{}, 1)
	defer close(c)

	h := unt.add(c)
	defer unt.remove(h)

	pargv := C.malloc(C.sizeof_uint)
	defer C.free(pargv)

	argv := (*[1]uint)(pargv)
	argv[0] = h
	if rv := C.sqlite3_unlock_notify(db, (*[0]byte)(C.unlock_notify_callback), unsafe.Pointer(pargv)); rv != C.SQLITE_OK {
		return rv
	}

	<-c

	return C.SQLITE_OK
}
