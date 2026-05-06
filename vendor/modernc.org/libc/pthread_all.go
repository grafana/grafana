// Copyright 2021 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !freebsd && !openbsd && !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

package libc // import "modernc.org/libc"

import (
	"unsafe"

	"modernc.org/libc/pthread"
)

type pthreadAttr struct {
	detachState int32
}

// int pthread_attr_init(pthread_attr_t *attr);
func Xpthread_attr_init(t *TLS, pAttr uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pAttr=%v, (%v:)", t, pAttr, origin(2))
	}
	*(*pthreadAttr)(unsafe.Pointer(pAttr)) = pthreadAttr{}
	return 0
}

// The pthread_mutex_init() function shall initialize the mutex referenced by
// mutex with attributes specified by attr. If attr is NULL, the default mutex
// attributes are used; the effect shall be the same as passing the address of
// a default mutex attributes object. Upon successful initialization, the state
// of the mutex becomes initialized and unlocked.
//
// If successful, the pthread_mutex_destroy() and pthread_mutex_init()
// functions shall return zero; otherwise, an error number shall be returned to
// indicate the error.
//
// int pthread_mutex_init(pthread_mutex_t *restrict mutex, const pthread_mutexattr_t *restrict attr);
func Xpthread_mutex_init(t *TLS, pMutex, pAttr uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pAttr=%v, (%v:)", t, pAttr, origin(2))
	}
	typ := pthread.PTHREAD_MUTEX_DEFAULT
	if pAttr != 0 {
		typ = int(X__ccgo_pthreadMutexattrGettype(t, pAttr))
	}
	mutexesMu.Lock()

	defer mutexesMu.Unlock()

	mutexes[pMutex] = newMutex(typ)
	return 0
}

func Xpthread_atfork(tls *TLS, prepare, parent, child uintptr) int32 {
	// fork(2) not supported.
	return 0
}

// int pthread_sigmask(int how, const sigset_t *restrict set, sigset_t *restrict old)
func Xpthread_sigmask(tls *TLS, now int32, set, old uintptr) int32 {
	// ignored
	return 0
}
