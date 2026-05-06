// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm)

package libc // import "modernc.org/libc"

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"
)

type pthreadAttr struct {
	detachState int32
}

type pthreadCleanupItem struct {
	routine, arg uintptr
}

// C original, unpatched version
//
// include/alltypes.h.in:86:TYPEDEF struct {
//	union {
//		int __i[sizeof(long)==8?10:6];
//		volatile int __vi[sizeof(long)==8?10:6];
//		volatile void *volatile __p[sizeof(long)==8?5:6];
//	} __u;
// } pthread_mutex_t;

//TODO(jnml) can remove __ccgo_room patches now.

// We overlay the C version with our version below. It must not be larger than
// the C version.
type pthreadMutex struct { // gc  64b       32b        | tinygo   64b       32b
	sync.Mutex        //        0    8    0    4   |            0   16    0    8
	count      int32  //        8    4    4    4   |           16    4    8    4
	typ        uint32 //       12    4    8    4   |           20    4   12    4
	owner      int32  //       16    4   12    4   |           24    4   16    4
	//                         20        16        |           28        20
}

type pthreadConds struct {
	sync.Mutex
	conds map[uintptr][]chan struct{}
}

var (
	// Ensure there's enough space for unsafe type conversions.
	_ [unsafe.Sizeof(Tpthread_mutex_t{}) - unsafe.Sizeof(pthreadMutex{})]byte
	_ [unsafe.Sizeof(Tpthread_attr_t{}) - unsafe.Sizeof(pthreadAttr{})]byte

	pthreadKeysMutex      sync.Mutex
	pthreadKeyDestructors []uintptr
	pthreadKeysFree       []Tpthread_key_t

	conds = pthreadConds{conds: map[uintptr][]chan struct{}{}}
)

func _pthread_setcancelstate(tls *TLS, new int32, old uintptr) int32 {
	//TODO actually respect cancel state
	if uint32(new) > 2 {
		return EINVAL
	}

	p := tls.pthread + unsafe.Offsetof(t__pthread{}.Fcanceldisable)
	if old != 0 {
		r := *(*int32)(unsafe.Pointer(p))
		*(*int32)(unsafe.Pointer(old)) = int32(byte(r))
	}
	*(*int32)(unsafe.Pointer(p)) = new
	return 0
}

func Xpthread_getspecific(tls *TLS, k Tpthread_key_t) uintptr {
	return tls.pthreadKeyValues[k]
}

func Xpthread_setspecific(tls *TLS, k Tpthread_key_t, x uintptr) int32 {
	if tls.pthreadKeyValues == nil {
		tls.pthreadKeyValues = map[Tpthread_key_t]uintptr{}
	}
	tls.pthreadKeyValues[k] = x
	return 0
}

func Xpthread_key_create(tls *TLS, k uintptr, dtor uintptr) int32 {
	pthreadKeysMutex.Lock()

	defer pthreadKeysMutex.Unlock()

	var key Tpthread_key_t
	switch l := Tpthread_key_t(len(pthreadKeysFree)); {
	case l == 0:
		key = Tpthread_key_t(len(pthreadKeyDestructors))
		pthreadKeyDestructors = append(pthreadKeyDestructors, dtor)
	default:
		key = pthreadKeysFree[l-1]
		pthreadKeysFree = pthreadKeysFree[:l-1]
		pthreadKeyDestructors[key] = dtor
	}
	*(*Tpthread_key_t)(unsafe.Pointer(k)) = key
	return 0
}

func Xpthread_key_delete(tls *TLS, k Tpthread_key_t) int32 {
	pthreadKeysMutex.Lock()

	defer pthreadKeysMutex.Unlock()

	pthreadKeysFree = append(pthreadKeysFree, k)
	return 0
}

func Xpthread_create(tls *TLS, res, attrp, entry, arg uintptr) int32 {
	var attr pthreadAttr
	if attrp != 0 {
		attr = *(*pthreadAttr)(unsafe.Pointer(attrp))
	}

	detachState := int32(_DT_JOINABLE)
	if attr.detachState != 0 {
		detachState = _DT_DETACHED
	}
	tls2 := NewTLS()
	tls2.ownsPthread = false
	*(*Tpthread_t)(unsafe.Pointer(res)) = tls2.pthread
	(*t__pthread)(unsafe.Pointer(tls2.pthread)).Fdetach_state = detachState
	if detachState == _DT_JOINABLE {
		(*sync.Mutex)(unsafe.Pointer(tls2.pthread + unsafe.Offsetof(t__pthread{}.F__ccgo_join_mutex))).Lock()
	}

	go func() {
		Xpthread_exit(tls2, (*(*func(*TLS, uintptr) uintptr)(unsafe.Pointer(&struct{ uintptr }{entry})))(tls2, arg))
	}()

	return 0
}

func Xpthread_exit(tls *TLS, result uintptr) {
	state := atomic.LoadInt32((*int32)(unsafe.Pointer(tls.pthread + unsafe.Offsetof(t__pthread{}.Fdetach_state))))
	(*t__pthread)(unsafe.Pointer(tls.pthread)).Fresult = result
	switch state {
	case _DT_JOINABLE, _DT_DETACHED:
		// ok
	default:
		panic(todo("", state))
	}

	for len(tls.pthreadCleanupItems) != 0 {
		Xpthread_cleanup_pop(tls, 1)
	}
	for {
		done := true
		for k, v := range tls.pthreadKeyValues {
			if v != 0 {
				delete(tls.pthreadKeyValues, k)
				pthreadKeysMutex.Lock()
				d := pthreadKeyDestructors[k]
				pthreadKeysMutex.Unlock()
				if d != 0 {
					done = false
					(*(*func(*TLS, uintptr))(unsafe.Pointer(&struct{ uintptr }{d})))(tls, v)
				}
			}
		}
		if done {
			break
		}
	}
	if state == _DT_JOINABLE {
		(*sync.Mutex)(unsafe.Pointer(tls.pthread + unsafe.Offsetof(t__pthread{}.F__ccgo_join_mutex))).Unlock()
	}
	atomic.StoreInt32((*int32)(unsafe.Pointer(tls.pthread+unsafe.Offsetof(t__pthread{}.Fdetach_state))), _DT_EXITED)
	tls.Close()
	runtime.Goexit()
}

func Xpthread_join(tls *TLS, t Tpthread_t, res uintptr) (r int32) {
	if (*t__pthread)(unsafe.Pointer(t)).Fdetach_state > _DT_JOINABLE {
		return EINVAL
	}

	(*sync.Mutex)(unsafe.Pointer(t + unsafe.Offsetof(t__pthread{}.F__ccgo_join_mutex))).Lock()
	if res != 0 {
		*(*uintptr)(unsafe.Pointer(res)) = (*t__pthread)(unsafe.Pointer(tls.pthread)).Fresult
	}
	return 0
}

func Xpthread_cleanup_push(tls *TLS, f, x uintptr) {
	X_pthread_cleanup_push(tls, 0, f, x)
}

func __pthread_cleanup_push(tls *TLS, _, f, x uintptr) {
	tls.pthreadCleanupItems = append(tls.pthreadCleanupItems, pthreadCleanupItem{f, x})
}

func X_pthread_cleanup_push(tls *TLS, _, f, x uintptr) {
	tls.pthreadCleanupItems = append(tls.pthreadCleanupItems, pthreadCleanupItem{f, x})
}

func Xpthread_cleanup_pop(tls *TLS, run int32) {
	X_pthread_cleanup_pop(tls, 0, run)
}

func __pthread_cleanup_pop(tls *TLS, _ uintptr, run int32) {
	X_pthread_cleanup_pop(tls, 0, run)
}

func X_pthread_cleanup_pop(tls *TLS, _ uintptr, run int32) {
	l := len(tls.pthreadCleanupItems)
	item := tls.pthreadCleanupItems[l-1]
	tls.pthreadCleanupItems = tls.pthreadCleanupItems[:l-1]
	if run != 0 {
		(*(*func(*TLS, uintptr))(unsafe.Pointer(&struct{ uintptr }{item.routine})))(tls, item.arg)
	}
}

func Xpthread_attr_init(tls *TLS, a uintptr) int32 {
	*(*Tpthread_attr_t)(unsafe.Pointer(a)) = Tpthread_attr_t{}
	return 0
}

func Xpthread_attr_setscope(tls *TLS, a uintptr, scope int32) int32 {
	switch scope {
	case PTHREAD_SCOPE_SYSTEM:
		return 0
	case PTHREAD_SCOPE_PROCESS:
		return ENOTSUP
	default:
		return EINVAL
	}
}

func Xpthread_attr_setstacksize(tls *TLS, a uintptr, stacksite Tsize_t) int32 {
	return 0
}

func Xpthread_attr_setdetachstate(tls *TLS, a uintptr, state int32) (r int32) {
	if uint32(state) > 1 {
		return EINVAL
	}

	(*pthreadAttr)(unsafe.Pointer(a)).detachState = state
	return 0
}

func Xpthread_attr_getdetachstate(tls *TLS, a uintptr, state uintptr) int32 {
	*(*int32)(unsafe.Pointer(state)) = (*pthreadAttr)(unsafe.Pointer(a)).detachState
	return 0
}

func Xpthread_attr_destroy(tls *TLS, a uintptr) int32 {
	return 0
}

func Xpthread_self(tls *TLS) uintptr {
	return tls.pthread
}

func Xpthread_mutex_init(tls *TLS, m, a uintptr) int32 {
	*(*Tpthread_mutex_t)(unsafe.Pointer(m)) = Tpthread_mutex_t{}
	if a != 0 {
		(*pthreadMutex)(unsafe.Pointer(m)).typ = (*Tpthread_mutexattr_t)(unsafe.Pointer(a)).F__attr
	}
	return 0
}

func Xpthread_mutex_destroy(tls *TLS, m uintptr) int32 {
	*(*Tpthread_mutex_t)(unsafe.Pointer(m)) = Tpthread_mutex_t{}
	return 0
}

func Xpthread_mutex_lock(tls *TLS, m uintptr) int32 {
	switch typ := (*pthreadMutex)(unsafe.Pointer(m)).typ; typ {
	case PTHREAD_MUTEX_NORMAL:
		(*pthreadMutex)(unsafe.Pointer(m)).Lock()
		return 0
	case PTHREAD_MUTEX_RECURSIVE:
		if atomic.CompareAndSwapInt32(&((*pthreadMutex)(unsafe.Pointer(m)).owner), 0, tls.ID) {
			(*pthreadMutex)(unsafe.Pointer(m)).count = 1
			(*pthreadMutex)(unsafe.Pointer(m)).Lock()
			return 0
		}

		if atomic.LoadInt32(&((*pthreadMutex)(unsafe.Pointer(m)).owner)) == tls.ID {
			(*pthreadMutex)(unsafe.Pointer(m)).count++
			return 0
		}

		for {
			(*pthreadMutex)(unsafe.Pointer(m)).Lock()
			if atomic.CompareAndSwapInt32(&((*pthreadMutex)(unsafe.Pointer(m)).owner), 0, tls.ID) {
				(*pthreadMutex)(unsafe.Pointer(m)).count = 1
				return 0
			}

			(*pthreadMutex)(unsafe.Pointer(m)).Unlock()
		}
	default:
		panic(todo("", typ))
	}
}

func Xpthread_mutex_trylock(tls *TLS, m uintptr) int32 {
	switch typ := (*pthreadMutex)(unsafe.Pointer(m)).typ; typ {
	case PTHREAD_MUTEX_NORMAL:
		if (*pthreadMutex)(unsafe.Pointer(m)).TryLock() {
			return 0
		}

		return EBUSY
	default:
		panic(todo("typ=%v", typ))
	}
}

func Xpthread_mutex_unlock(tls *TLS, m uintptr) int32 {
	switch typ := (*pthreadMutex)(unsafe.Pointer(m)).typ; typ {
	case PTHREAD_MUTEX_NORMAL:
		(*pthreadMutex)(unsafe.Pointer(m)).Unlock()
		return 0
	case PTHREAD_MUTEX_RECURSIVE:
		if atomic.LoadInt32(&((*pthreadMutex)(unsafe.Pointer(m)).owner)) != tls.ID {
			return EPERM
		}

		if atomic.AddInt32(&((*pthreadMutex)(unsafe.Pointer(m)).count), -1) == 0 {
			atomic.StoreInt32(&((*pthreadMutex)(unsafe.Pointer(m)).owner), 0)
			(*pthreadMutex)(unsafe.Pointer(m)).Unlock()
		}
		return 0
	default:
		panic(todo("", typ))
	}
}

func Xpthread_cond_init(tls *TLS, c, a uintptr) int32 {
	*(*Tpthread_cond_t)(unsafe.Pointer(c)) = Tpthread_cond_t{}
	if a != 0 {
		panic(todo(""))
	}

	conds.Lock()
	delete(conds.conds, c)
	conds.Unlock()
	return 0
}

func Xpthread_cond_timedwait(tls *TLS, c, m, ts uintptr) (r int32) {
	var to <-chan time.Time
	if ts != 0 {
		deadlineSecs := (*Ttimespec)(unsafe.Pointer(ts)).Ftv_sec
		deadlineNsecs := (*Ttimespec)(unsafe.Pointer(ts)).Ftv_nsec
		deadline := time.Unix(deadlineSecs, int64(deadlineNsecs))
		d := deadline.Sub(time.Now())
		if d <= 0 {
			return ETIMEDOUT
		}

		to = time.After(d)
	}

	conds.Lock()
	waiters := conds.conds[c]
	ch := make(chan struct{}, 1)
	waiters = append(waiters, ch)
	conds.conds[c] = waiters
	conds.Unlock()

	defer func() {
		conds.Lock()

		defer conds.Unlock()

		waiters = conds.conds[c]
		for i, v := range waiters {
			if v == ch {
				conds.conds[c] = append(waiters[:i], waiters[i+1:]...)
				return
			}
		}
	}()

	switch typ := (*pthreadMutex)(unsafe.Pointer(m)).typ; typ {
	case PTHREAD_MUTEX_NORMAL:
		(*pthreadMutex)(unsafe.Pointer(m)).Unlock()
		select {
		case <-ch:
			// ok
		case <-to:
			r = ETIMEDOUT
		}
		(*pthreadMutex)(unsafe.Pointer(m)).Lock()
		return r
	default:
		panic(todo("", typ))
	}
}

func Xpthread_cond_wait(tls *TLS, c, m uintptr) int32 {
	return Xpthread_cond_timedwait(tls, c, m, 0)
}

func Xpthread_cond_signal(tls *TLS, c uintptr) int32 {
	return pthreadSignalN(tls, c, false)
}

func pthreadSignalN(tls *TLS, c uintptr, all bool) int32 {
	conds.Lock()
	waiters := conds.conds[c]
	handle := waiters
	if len(waiters) != 0 {
		switch {
		case all:
			delete(conds.conds, c)
		default:
			handle = handle[:1]
			conds.conds[c] = waiters[1:]
		}
	}
	conds.Unlock()
	for _, v := range handle {
		close(v)
	}
	return 0
}

func Xpthread_cond_broadcast(tls *TLS, c uintptr) int32 {
	return pthreadSignalN(tls, c, true)
}

func Xpthread_cond_destroy(tls *TLS, c uintptr) int32 {
	return Xpthread_cond_broadcast(tls, c)
}

func Xpthread_atfork(tls *TLS, prepare, parent, child uintptr) int32 {
	// fork(2) not supported.
	return 0
}

func Xpthread_mutexattr_init(tls *TLS, a uintptr) int32 {
	*(*Tpthread_mutexattr_t)(unsafe.Pointer(a)) = Tpthread_mutexattr_t{}
	return 0
}

func Xpthread_mutexattr_destroy(tls *TLS, a uintptr) int32 {
	return 0
}

func Xpthread_mutexattr_settype(tls *TLS, a uintptr, typ int32) int32 {
	if uint32(typ) > 2 {
		return EINVAL
	}

	(*Tpthread_mutexattr_t)(unsafe.Pointer(a)).F__attr = uint32(typ) & 3
	return 0
}

func Xpthread_detach(tls *TLS, t uintptr) int32 {
	state := atomic.SwapInt32((*int32)(unsafe.Pointer(tls.pthread+unsafe.Offsetof(t__pthread{}.Fdetach_state))), _DT_DETACHED)
	switch state {
	case _DT_EXITED, _DT_DETACHED:
		return 0
	default:
		panic(todo("", tls.ID, state))
	}
}

// int pthread_equal(pthread_t, pthread_t);
func Xpthread_equal(tls *TLS, t, u uintptr) int32 {
	return Bool32(t == u)
}

// int pthread_sigmask(int how, const sigset_t *restrict set, sigset_t *restrict old)
func _pthread_sigmask(tls *TLS, now int32, set, old uintptr) int32 {
	// ignored
	return 0
}

// 202402251838      all_test.go:589: files=36 buildFails=30 execFails=2 pass=4
// 202402262246      all_test.go:589: files=36 buildFails=26 execFails=2 pass=8
// 202403041858 all_musl_test.go:640: files=36 buildFails=22 execFails=4 pass=10
