// Copyright 2021 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !linux

package sqlite3

import (
	"fmt"
	"sync"
	"sync/atomic"
	"unsafe"

	"modernc.org/libc"
	"modernc.org/libc/sys/types"
)

func init() {
	tls := libc.NewTLS()
	if Xsqlite3_threadsafe(tls) == 0 {
		panic(fmt.Errorf("sqlite: thread safety configuration error"))
	}

	varArgs := libc.Xmalloc(tls, types.Size_t(unsafe.Sizeof(uintptr(0))))
	if varArgs == 0 {
		panic(fmt.Errorf("cannot allocate memory"))
	}

	// int sqlite3_config(int, ...);
	if rc := Xsqlite3_config(tls, SQLITE_CONFIG_MUTEX, libc.VaList(varArgs, uintptr(unsafe.Pointer(&mutexMethods)))); rc != SQLITE_OK {
		p := Xsqlite3_errstr(tls, rc)
		str := libc.GoString(p)
		panic(fmt.Errorf("sqlite: failed to configure mutex methods: %v", str))
	}

	libc.Xfree(tls, varArgs)
	tls.Close()
}

var (
	mutexMethods = Sqlite3_mutex_methods{
		FxMutexInit: *(*uintptr)(unsafe.Pointer(&struct{ f func(*libc.TLS) int32 }{mutexInit})),
		FxMutexEnd:  *(*uintptr)(unsafe.Pointer(&struct{ f func(*libc.TLS) int32 }{mutexEnd})),
		FxMutexAlloc: *(*uintptr)(unsafe.Pointer(&struct {
			f func(*libc.TLS, int32) uintptr
		}{mutexAlloc})),
		FxMutexFree:  *(*uintptr)(unsafe.Pointer(&struct{ f func(*libc.TLS, uintptr) }{mutexFree})),
		FxMutexEnter: *(*uintptr)(unsafe.Pointer(&struct{ f func(*libc.TLS, uintptr) }{mutexEnter})),
		FxMutexTry: *(*uintptr)(unsafe.Pointer(&struct {
			f func(*libc.TLS, uintptr) int32
		}{mutexTry})),
		FxMutexLeave: *(*uintptr)(unsafe.Pointer(&struct{ f func(*libc.TLS, uintptr) }{mutexLeave})),
		FxMutexHeld: *(*uintptr)(unsafe.Pointer(&struct {
			f func(*libc.TLS, uintptr) int32
		}{mutexHeld})),
		FxMutexNotheld: *(*uintptr)(unsafe.Pointer(&struct {
			f func(*libc.TLS, uintptr) int32
		}{mutexNotheld})),
	}

	mutexApp10   mutex
	mutexApp20   mutex
	mutexApp30   mutex
	mutexLRU0    mutex
	mutexMaster0 mutex
	mutexMem0    mutex
	mutexOpen0   mutex
	mutexPMem0   mutex
	mutexPRNG0   mutex
	mutexVFS10   mutex
	mutexVFS20   mutex
	mutexVFS30   mutex

	mutexApp1   = uintptr(unsafe.Pointer(&mutexApp10))
	mutexApp2   = uintptr(unsafe.Pointer(&mutexApp20))
	mutexApp3   = uintptr(unsafe.Pointer(&mutexApp30))
	mutexLRU    = uintptr(unsafe.Pointer(&mutexLRU0))
	mutexMaster = uintptr(unsafe.Pointer(&mutexMaster0))
	mutexMem    = uintptr(unsafe.Pointer(&mutexMem0))
	mutexOpen   = uintptr(unsafe.Pointer(&mutexOpen0))
	mutexPMem   = uintptr(unsafe.Pointer(&mutexPMem0))
	mutexPRNG   = uintptr(unsafe.Pointer(&mutexPRNG0))
	mutexVFS1   = uintptr(unsafe.Pointer(&mutexVFS10))
	mutexVFS2   = uintptr(unsafe.Pointer(&mutexVFS20))
	mutexVFS3   = uintptr(unsafe.Pointer(&mutexVFS30))
)

type mutex struct {
	sync.Mutex
	cnt       int32
	id        int32 // tls.ID
	recursive bool
}

// int (*xMutexInit)(void);
//
// The xMutexInit method defined by this structure is invoked as part of system
// initialization by the sqlite3_initialize() function. The xMutexInit routine
// is called by SQLite exactly once for each effective call to
// sqlite3_initialize().
//
// The xMutexInit() method must be threadsafe. It must be harmless to invoke
// xMutexInit() multiple times within the same process and without intervening
// calls to xMutexEnd(). Second and subsequent calls to xMutexInit() must be
// no-ops. xMutexInit() must not use SQLite memory allocation (sqlite3_malloc()
// and its associates).
//
// If xMutexInit fails in any way, it is expected to clean up after itself
// prior to returning.
func mutexInit(tls *libc.TLS) int32 { return SQLITE_OK }

// int (*xMutexEnd)(void);
func mutexEnd(tls *libc.TLS) int32 { return SQLITE_OK }

// sqlite3_mutex *(*xMutexAlloc)(int);
//
// The sqlite3_mutex_alloc() routine allocates a new mutex and returns a
// pointer to it. The sqlite3_mutex_alloc() routine returns NULL if it is
// unable to allocate the requested mutex. The argument to
// sqlite3_mutex_alloc() must one of these integer constants:
//
//	SQLITE_MUTEX_FAST
//	SQLITE_MUTEX_RECURSIVE
//	SQLITE_MUTEX_STATIC_MASTER
//	SQLITE_MUTEX_STATIC_MEM
//	SQLITE_MUTEX_STATIC_OPEN
//	SQLITE_MUTEX_STATIC_PRNG
//	SQLITE_MUTEX_STATIC_LRU
//	SQLITE_MUTEX_STATIC_PMEM
//	SQLITE_MUTEX_STATIC_APP1
//	SQLITE_MUTEX_STATIC_APP2
//	SQLITE_MUTEX_STATIC_APP3
//	SQLITE_MUTEX_STATIC_VFS1
//	SQLITE_MUTEX_STATIC_VFS2
//	SQLITE_MUTEX_STATIC_VFS3
//
// The first two constants (SQLITE_MUTEX_FAST and SQLITE_MUTEX_RECURSIVE) cause
// sqlite3_mutex_alloc() to create a new mutex. The new mutex is recursive when
// SQLITE_MUTEX_RECURSIVE is used but not necessarily so when SQLITE_MUTEX_FAST
// is used. The mutex implementation does not need to make a distinction
// between SQLITE_MUTEX_RECURSIVE and SQLITE_MUTEX_FAST if it does not want to.
// SQLite will only request a recursive mutex in cases where it really needs
// one. If a faster non-recursive mutex implementation is available on the host
// platform, the mutex subsystem might return such a mutex in response to
// SQLITE_MUTEX_FAST.
//
// The other allowed parameters to sqlite3_mutex_alloc() (anything other than
// SQLITE_MUTEX_FAST and SQLITE_MUTEX_RECURSIVE) each return a pointer to a
// static preexisting mutex. Nine static mutexes are used by the current
// version of SQLite. Future versions of SQLite may add additional static
// mutexes. Static mutexes are for internal use by SQLite only. Applications
// that use SQLite mutexes should use only the dynamic mutexes returned by
// SQLITE_MUTEX_FAST or SQLITE_MUTEX_RECURSIVE.
//
// Note that if one of the dynamic mutex parameters (SQLITE_MUTEX_FAST or
// SQLITE_MUTEX_RECURSIVE) is used then sqlite3_mutex_alloc() returns a
// different mutex on every call. For the static mutex types, the same mutex is
// returned on every call that has the same type number.
func mutexAlloc(tls *libc.TLS, typ int32) (r uintptr) {
	switch typ {
	case SQLITE_MUTEX_FAST:
		r = libc.Xcalloc(tls, 1, types.Size_t(unsafe.Sizeof(mutex{})))
		return r
	case SQLITE_MUTEX_RECURSIVE:
		r = libc.Xcalloc(tls, 1, types.Size_t(unsafe.Sizeof(mutex{})))
		(*mutex)(unsafe.Pointer(r)).recursive = true
		return r
	case SQLITE_MUTEX_STATIC_MASTER:
		return mutexMaster
	case SQLITE_MUTEX_STATIC_MEM:
		return mutexMem
	case SQLITE_MUTEX_STATIC_OPEN:
		return mutexOpen
	case SQLITE_MUTEX_STATIC_PRNG:
		return mutexPRNG
	case SQLITE_MUTEX_STATIC_LRU:
		return mutexLRU
	case SQLITE_MUTEX_STATIC_PMEM:
		return mutexPMem
	case SQLITE_MUTEX_STATIC_APP1:
		return mutexApp1
	case SQLITE_MUTEX_STATIC_APP2:
		return mutexApp2
	case SQLITE_MUTEX_STATIC_APP3:
		return mutexApp3
	case SQLITE_MUTEX_STATIC_VFS1:
		return mutexVFS1
	case SQLITE_MUTEX_STATIC_VFS2:
		return mutexVFS2
	case SQLITE_MUTEX_STATIC_VFS3:
		return mutexVFS3
	default:
		return 0
	}
}

// void (*xMutexFree)(sqlite3_mutex *);
func mutexFree(tls *libc.TLS, m uintptr) {
	libc.Xfree(tls, m)
}

// The sqlite3_mutex_enter() and sqlite3_mutex_try() routines attempt to enter
// a mutex. If another thread is already within the mutex,
// sqlite3_mutex_enter() will block and sqlite3_mutex_try() will return
// SQLITE_BUSY. The sqlite3_mutex_try() interface returns SQLITE_OK upon
// successful entry. Mutexes created using SQLITE_MUTEX_RECURSIVE can be
// entered multiple times by the same thread. In such cases, the mutex must be
// exited an equal number of times before another thread can enter. If the same
// thread tries to enter any mutex other than an SQLITE_MUTEX_RECURSIVE more
// than once, the behavior is undefined.
//
// If the argument to sqlite3_mutex_enter(), sqlite3_mutex_try(), or
// sqlite3_mutex_leave() is a NULL pointer, then all three routines behave as
// no-ops.

// void (*xMutexEnter)(sqlite3_mutex *);
func mutexEnter(tls *libc.TLS, m uintptr) {
	if m == 0 {
		return
	}

	if !(*mutex)(unsafe.Pointer(m)).recursive {
		(*mutex)(unsafe.Pointer(m)).Lock()
		(*mutex)(unsafe.Pointer(m)).id = tls.ID
		return
	}

	id := tls.ID
	if atomic.CompareAndSwapInt32(&(*mutex)(unsafe.Pointer(m)).id, 0, id) {
		(*mutex)(unsafe.Pointer(m)).cnt = 1
		(*mutex)(unsafe.Pointer(m)).Lock()
		return
	}

	if atomic.LoadInt32(&(*mutex)(unsafe.Pointer(m)).id) == id {
		(*mutex)(unsafe.Pointer(m)).cnt++
		return
	}

	for {
		(*mutex)(unsafe.Pointer(m)).Lock()
		if atomic.CompareAndSwapInt32(&(*mutex)(unsafe.Pointer(m)).id, 0, id) {
			(*mutex)(unsafe.Pointer(m)).cnt = 1
			return
		}

		(*mutex)(unsafe.Pointer(m)).Unlock()
	}
}

// int (*xMutexTry)(sqlite3_mutex *);
func mutexTry(tls *libc.TLS, m uintptr) int32 {
	if m == 0 {
		return SQLITE_OK
	}

	if !(*mutex)(unsafe.Pointer(m)).recursive {
		if (*mutex)(unsafe.Pointer(m)).TryLock() {
			return SQLITE_OK
		}
	}

	return SQLITE_BUSY
}

// void (*xMutexLeave)(sqlite3_mutex *);
func mutexLeave(tls *libc.TLS, m uintptr) {
	if m == 0 {
		return
	}

	if !(*mutex)(unsafe.Pointer(m)).recursive {
		(*mutex)(unsafe.Pointer(m)).id = 0
		(*mutex)(unsafe.Pointer(m)).Unlock()
		return
	}

	if atomic.AddInt32(&(*mutex)(unsafe.Pointer(m)).cnt, -1) == 0 {
		atomic.StoreInt32(&(*mutex)(unsafe.Pointer(m)).id, 0)
		(*mutex)(unsafe.Pointer(m)).Unlock()
	}
}

// The sqlite3_mutex_held() and sqlite3_mutex_notheld() routines are intended
// for use inside assert() statements. The SQLite core never uses these
// routines except inside an assert() and applications are advised to follow
// the lead of the core. The SQLite core only provides implementations for
// these routines when it is compiled with the SQLITE_DEBUG flag. External
// mutex implementations are only required to provide these routines if
// SQLITE_DEBUG is defined and if NDEBUG is not defined.
//
// These routines should return true if the mutex in their argument is held or
// not held, respectively, by the calling thread.
//
// The implementation is not required to provide versions of these routines
// that actually work. If the implementation does not provide working versions
// of these routines, it should at least provide stubs that always return true
// so that one does not get spurious assertion failures.
//
// If the argument to sqlite3_mutex_held() is a NULL pointer then the routine
// should return 1. This seems counter-intuitive since clearly the mutex cannot
// be held if it does not exist. But the reason the mutex does not exist is
// because the build is not using mutexes. And we do not want the assert()
// containing the call to sqlite3_mutex_held() to fail, so a non-zero return is
// the appropriate thing to do. The sqlite3_mutex_notheld() interface should
// also return 1 when given a NULL pointer.

// int (*xMutexHeld)(sqlite3_mutex *);
func mutexHeld(tls *libc.TLS, m uintptr) int32 {
	if m == 0 {
		return 1
	}

	return libc.Bool32(atomic.LoadInt32(&(*mutex)(unsafe.Pointer(m)).id) == tls.ID)
}

// int (*xMutexNotheld)(sqlite3_mutex *);
func mutexNotheld(tls *libc.TLS, m uintptr) int32 {
	if m == 0 {
		return 1
	}

	return libc.Bool32(atomic.LoadInt32(&(*mutex)(unsafe.Pointer(m)).id) != tls.ID)
}
