// Copyright 2021 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

package libc // import "modernc.org/libc"

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"modernc.org/libc/errno"
	"modernc.org/libc/pthread"
	"modernc.org/libc/sys/types"
	ctime "modernc.org/libc/time"
)

var (
	mutexes   = map[uintptr]*mutex{}
	mutexesMu sync.Mutex

	threads   = map[int32]*TLS{}
	threadsMu sync.Mutex

	threadKey            pthread.Pthread_key_t
	threadKeyDestructors = map[pthread.Pthread_key_t][]uintptr{} // key: []destructor
	threadsKeysMu        sync.Mutex

	conds   = map[uintptr]*cond{}
	condsMu sync.Mutex
)

// Thread local storage.
type TLS struct {
	errnop      uintptr
	allocaStack [][]uintptr
	allocas     []uintptr
	jumpBuffers []uintptr
	lastError   uint32
	pthreadData
	sp    int
	stack stackHeader

	ID                 int32
	reentryGuard       int32 // memgrind
	stackHeaderBalance int32
}

var errno0 int32 // Temp errno for NewTLS

func NewTLS() *TLS {
	return newTLS(false)
}

func newTLS(detached bool) *TLS {
	id := atomic.AddInt32(&tid, 1)
	t := &TLS{ID: id, errnop: uintptr(unsafe.Pointer(&errno0))}
	t.pthreadData.init(t, detached)
	if memgrind {
		atomic.AddInt32(&tlsBalance, 1)
	}
	t.errnop = t.Alloc(int(unsafe.Sizeof(int32(0))))
	*(*int32)(unsafe.Pointer(t.errnop)) = 0
	return t
}

// StackSlots reports the number of tls stack slots currently in use.
func (tls *TLS) StackSlots() int {
	return tls.sp
}

func (t *TLS) alloca(n size_t) (r uintptr) {
	r = Xmalloc(t, n)
	t.allocas = append(t.allocas, r)
	return r
}

func (t *TLS) FreeAlloca() func() {
	t.allocaStack = append(t.allocaStack, t.allocas)
	t.allocas = nil
	return func() {
		for _, v := range t.allocas {
			Xfree(t, v)
		}
		n := len(t.allocaStack)
		t.allocas = t.allocaStack[n-1]
		t.allocaStack = t.allocaStack[:n-1]
	}
}

func (tls *TLS) PushJumpBuffer(jb uintptr) {
	tls.jumpBuffers = append(tls.jumpBuffers, jb)
}

type LongjmpRetval int32

func (tls *TLS) PopJumpBuffer(jb uintptr) {
	n := len(tls.jumpBuffers)
	if n == 0 || tls.jumpBuffers[n-1] != jb {
		panic(todo("unsupported setjmp/longjmp usage"))
	}

	tls.jumpBuffers = tls.jumpBuffers[:n-1]
}

func (tls *TLS) Longjmp(jb uintptr, val int32) {
	tls.PopJumpBuffer(jb)
	if val == 0 {
		val = 1
	}
	panic(LongjmpRetval(val))
}

func Xalloca(tls *TLS, size size_t) uintptr {
	if __ccgo_strace {
		trc("tls=%v size=%v, (%v:)", tls, size, origin(2))
	}
	return tls.alloca(size)
}

func X__builtin_alloca(tls *TLS, size size_t) uintptr {
	if __ccgo_strace {
		trc("tls=%v size=%v, (%v:)", tls, size, origin(2))
	}
	return Xalloca(tls, size)
}

// Pthread specific part of a TLS.
type pthreadData struct {
	done   chan struct{}
	kv     map[pthread.Pthread_key_t]uintptr
	retVal uintptr
	wait   chan struct{} // cond var interaction

	detached bool
}

func (d *pthreadData) init(t *TLS, detached bool) {
	d.detached = detached
	d.wait = make(chan struct{}, 1)
	if detached {
		return
	}

	d.done = make(chan struct{})

	threadsMu.Lock()

	defer threadsMu.Unlock()

	threads[t.ID] = t
}

func (d *pthreadData) close(t *TLS) {
	threadsMu.Lock()

	defer threadsMu.Unlock()

	delete(threads, t.ID)
}

// int pthread_attr_destroy(pthread_attr_t *attr);
func Xpthread_attr_destroy(t *TLS, pAttr uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pAttr=%v, (%v:)", t, pAttr, origin(2))
	}
	return 0
}

// int pthread_attr_setscope(pthread_attr_t *attr, int contentionscope);
func Xpthread_attr_setscope(t *TLS, pAttr uintptr, contentionScope int32) int32 {
	if __ccgo_strace {
		trc("t=%v pAttr=%v contentionScope=%v, (%v:)", t, pAttr, contentionScope, origin(2))
	}
	switch contentionScope {
	case pthread.PTHREAD_SCOPE_SYSTEM:
		return 0
	default:
		panic(todo("", contentionScope))
	}
}

// int pthread_attr_setstacksize(pthread_attr_t *attr, size_t stacksize);
func Xpthread_attr_setstacksize(t *TLS, attr uintptr, stackSize types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v attr=%v stackSize=%v, (%v:)", t, attr, stackSize, origin(2))
	}
	return 0
}

// Go side data of pthread_cond_t.
type cond struct {
	sync.Mutex
	waiters map[*TLS]struct{}
}

func newCond() *cond {
	return &cond{
		waiters: map[*TLS]struct{}{},
	}
}

func (c *cond) signal(all bool) int32 {
	if c == nil {
		return errno.EINVAL
	}

	c.Lock()

	defer c.Unlock()

	// The pthread_cond_broadcast() and pthread_cond_signal() functions shall have
	// no effect if there are no threads currently blocked on cond.
	for tls := range c.waiters {
		tls.wait <- struct{}{}
		delete(c.waiters, tls)
		if !all {
			break
		}
	}
	return 0
}

// The pthread_cond_init() function shall initialize the condition variable
// referenced by cond with attributes referenced by attr. If attr is NULL, the
// default condition variable attributes shall be used; the effect is the same
// as passing the address of a default condition variable attributes object.
// Upon successful initialization, the state of the condition variable shall
// become initialized.
//
// If successful, the pthread_cond_destroy() and pthread_cond_init() functions
// shall return zero; otherwise, an error number shall be returned to indicate
// the error.
//
// int pthread_cond_init(pthread_cond_t *restrict cond, const pthread_condattr_t *restrict attr);
func Xpthread_cond_init(t *TLS, pCond, pAttr uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pAttr=%v, (%v:)", t, pAttr, origin(2))
	}
	if pCond == 0 {
		return errno.EINVAL
	}

	if pAttr != 0 {
		panic(todo("%#x %#x", pCond, pAttr))
	}

	condsMu.Lock()

	defer condsMu.Unlock()

	conds[pCond] = newCond()
	return 0
}

// int pthread_cond_destroy(pthread_cond_t *cond);
func Xpthread_cond_destroy(t *TLS, pCond uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pCond=%v, (%v:)", t, pCond, origin(2))
	}
	if pCond == 0 {
		return errno.EINVAL
	}

	condsMu.Lock()

	defer condsMu.Unlock()

	cond := conds[pCond]
	if cond == nil {
		return errno.EINVAL
	}

	cond.Lock()

	defer cond.Unlock()

	if len(cond.waiters) != 0 {
		return errno.EBUSY
	}

	delete(conds, pCond)
	return 0
}

// int pthread_cond_signal(pthread_cond_t *cond);
func Xpthread_cond_signal(t *TLS, pCond uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pCond=%v, (%v:)", t, pCond, origin(2))
	}
	return condSignal(pCond, false)
}

// int pthread_cond_broadcast(pthread_cond_t *cond);
func Xpthread_cond_broadcast(t *TLS, pCond uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pCond=%v, (%v:)", t, pCond, origin(2))
	}
	return condSignal(pCond, true)
}

func condSignal(pCond uintptr, all bool) int32 {
	if pCond == 0 {
		return errno.EINVAL
	}

	condsMu.Lock()
	cond := conds[pCond]
	condsMu.Unlock()

	return cond.signal(all)
}

// int pthread_cond_wait(pthread_cond_t *restrict cond, pthread_mutex_t *restrict mutex);
func Xpthread_cond_wait(t *TLS, pCond, pMutex uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pMutex=%v, (%v:)", t, pMutex, origin(2))
	}
	if pCond == 0 {
		return errno.EINVAL
	}

	condsMu.Lock()
	cond := conds[pCond]
	if cond == nil { // static initialized condition variables are valid
		cond = newCond()
		conds[pCond] = cond
	}

	cond.Lock()
	cond.waiters[t] = struct{}{}
	cond.Unlock()

	condsMu.Unlock()

	mutexesMu.Lock()
	mu := mutexes[pMutex]
	mutexesMu.Unlock()

	mu.Unlock()
	<-t.wait
	mu.Lock()
	return 0
}

// int pthread_cond_timedwait(pthread_cond_t *restrict cond, pthread_mutex_t *restrict mutex, const struct timespec *restrict abstime);
func Xpthread_cond_timedwait(t *TLS, pCond, pMutex, pAbsTime uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pAbsTime=%v, (%v:)", t, pAbsTime, origin(2))
	}
	if pCond == 0 {
		return errno.EINVAL
	}

	condsMu.Lock()
	cond := conds[pCond]
	if cond == nil { // static initialized condition variables are valid
		cond = newCond()
		conds[pCond] = cond
	}

	cond.Lock()
	cond.waiters[t] = struct{}{}
	cond.Unlock()

	condsMu.Unlock()

	mutexesMu.Lock()
	mu := mutexes[pMutex]
	mutexesMu.Unlock()

	deadlineSecs := (*ctime.Timespec)(unsafe.Pointer(pAbsTime)).Ftv_sec
	deadlineNsecs := (*ctime.Timespec)(unsafe.Pointer(pAbsTime)).Ftv_nsec
	deadline := time.Unix(int64(deadlineSecs), int64(deadlineNsecs))
	d := deadline.Sub(time.Now())
	switch {
	case d <= 0:
		return errno.ETIMEDOUT
	default:
		to := time.After(d)
		mu.Unlock()

		defer mu.Lock()

		select {
		case <-t.wait:
			return 0
		case <-to:
			cond.Lock()

			defer cond.Unlock()

			delete(cond.waiters, t)
			return errno.ETIMEDOUT
		}
	}
}

// Go side data of pthread_mutex_t
type mutex struct {
	sync.Mutex
	typ  int // PTHREAD_MUTEX_NORMAL, ...
	wait sync.Mutex

	id  int32 // owner's t.ID
	cnt int32

	robust bool
}

func newMutex(typ int) *mutex {
	return &mutex{
		typ: typ,
	}
}

func (m *mutex) lock(id int32) int32 {
	if m.robust {
		panic(todo(""))
	}

	// If successful, the pthread_mutex_lock() and pthread_mutex_unlock() functions
	// shall return zero; otherwise, an error number shall be returned to indicate
	// the error.
	switch m.typ {
	default:
		fallthrough
	case pthread.PTHREAD_MUTEX_NORMAL:
		// If the mutex type is PTHREAD_MUTEX_NORMAL, deadlock detection shall not be
		// provided. Attempting to relock the mutex causes deadlock. If a thread
		// attempts to unlock a mutex that it has not locked or a mutex which is
		// unlocked, undefined behavior results.
		m.Lock()
		m.id = id
		return 0
	case pthread.PTHREAD_MUTEX_RECURSIVE:
		for {
			m.Lock()
			switch m.id {
			case 0:
				m.cnt = 1
				m.id = id
				m.wait.Lock()
				m.Unlock()
				return 0
			case id:
				m.cnt++
				m.Unlock()
				return 0
			}

			m.Unlock()
			m.wait.Lock()
			// intentional empty section - wake up other waiters
			m.wait.Unlock()
		}
	}
}

func (m *mutex) tryLock(id int32) int32 {
	if m.robust {
		panic(todo(""))
	}

	switch m.typ {
	default:
		fallthrough
	case pthread.PTHREAD_MUTEX_NORMAL:
		return errno.EBUSY
	case pthread.PTHREAD_MUTEX_RECURSIVE:
		m.Lock()
		switch m.id {
		case 0:
			m.cnt = 1
			m.id = id
			m.wait.Lock()
			m.Unlock()
			return 0
		case id:
			m.cnt++
			m.Unlock()
			return 0
		}

		m.Unlock()
		return errno.EBUSY
	}
}

func (m *mutex) unlock() int32 {
	if m.robust {
		panic(todo(""))
	}

	// If successful, the pthread_mutex_lock() and pthread_mutex_unlock() functions
	// shall return zero; otherwise, an error number shall be returned to indicate
	// the error.
	switch m.typ {
	default:
		fallthrough
	case pthread.PTHREAD_MUTEX_NORMAL:
		// If the mutex type is PTHREAD_MUTEX_NORMAL, deadlock detection shall not be
		// provided. Attempting to relock the mutex causes deadlock. If a thread
		// attempts to unlock a mutex that it has not locked or a mutex which is
		// unlocked, undefined behavior results.
		m.id = 0
		m.Unlock()
		return 0
	case pthread.PTHREAD_MUTEX_RECURSIVE:
		m.Lock()
		m.cnt--
		if m.cnt == 0 {
			m.id = 0
			m.wait.Unlock()
		}
		m.Unlock()
		return 0
	}
}

// int pthread_mutex_destroy(pthread_mutex_t *mutex);
func Xpthread_mutex_destroy(t *TLS, pMutex uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pMutex=%v, (%v:)", t, pMutex, origin(2))
	}
	mutexesMu.Lock()

	defer mutexesMu.Unlock()

	delete(mutexes, pMutex)
	return 0
}

// int pthread_mutex_lock(pthread_mutex_t *mutex);
func Xpthread_mutex_lock(t *TLS, pMutex uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pMutex=%v, (%v:)", t, pMutex, origin(2))
	}
	mutexesMu.Lock()
	mu := mutexes[pMutex]
	if mu == nil { // static initialized mutexes are valid
		mu = newMutex(int(X__ccgo_getMutexType(t, pMutex)))
		mutexes[pMutex] = mu
	}
	mutexesMu.Unlock()
	return mu.lock(t.ID)
}

// int pthread_mutex_trylock(pthread_mutex_t *mutex);
func Xpthread_mutex_trylock(t *TLS, pMutex uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pMutex=%v, (%v:)", t, pMutex, origin(2))
	}
	mutexesMu.Lock()
	mu := mutexes[pMutex]
	if mu == nil { // static initialized mutexes are valid
		mu = newMutex(int(X__ccgo_getMutexType(t, pMutex)))
		mutexes[pMutex] = mu
	}
	mutexesMu.Unlock()
	return mu.tryLock(t.ID)
}

// int pthread_mutex_unlock(pthread_mutex_t *mutex);
func Xpthread_mutex_unlock(t *TLS, pMutex uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pMutex=%v, (%v:)", t, pMutex, origin(2))
	}
	mutexesMu.Lock()

	defer mutexesMu.Unlock()

	return mutexes[pMutex].unlock()
}

// int pthread_key_create(pthread_key_t *key, void (*destructor)(void*));
func Xpthread_key_create(t *TLS, pKey, destructor uintptr) int32 {
	threadsKeysMu.Lock()

	defer threadsKeysMu.Unlock()

	threadKey++
	r := threadKey
	if destructor != 0 {
		threadKeyDestructors[r] = append(threadKeyDestructors[r], destructor)
	}
	*(*pthread.Pthread_key_t)(unsafe.Pointer(pKey)) = pthread.Pthread_key_t(r)
	return 0
}

// int pthread_key_delete(pthread_key_t key);
func Xpthread_key_delete(t *TLS, key pthread.Pthread_key_t) int32 {
	if __ccgo_strace {
		trc("t=%v key=%v, (%v:)", t, key, origin(2))
	}
	if _, ok := t.kv[key]; ok {
		delete(t.kv, key)
		return 0
	}

	panic(todo(""))

}

// void *pthread_getspecific(pthread_key_t key);
func Xpthread_getspecific(t *TLS, key pthread.Pthread_key_t) uintptr {
	if __ccgo_strace {
		trc("t=%v key=%v, (%v:)", t, key, origin(2))
	}
	return t.kv[key]
}

// int pthread_setspecific(pthread_key_t key, const void *value);
func Xpthread_setspecific(t *TLS, key pthread.Pthread_key_t, value uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v key=%v value=%v, (%v:)", t, key, value, origin(2))
	}
	if t.kv == nil {
		t.kv = map[pthread.Pthread_key_t]uintptr{}
	}
	t.kv[key] = value
	return 0
}

// int pthread_create(pthread_t *thread, const pthread_attr_t *attr, void *(*start_routine) (void *), void *arg);
func Xpthread_create(t *TLS, pThread, pAttr, startRoutine, arg uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v arg=%v, (%v:)", t, arg, origin(2))
	}
	fn := (*struct {
		f func(*TLS, uintptr) uintptr
	})(unsafe.Pointer(&struct{ uintptr }{startRoutine})).f
	detached := pAttr != 0 && X__ccgo_pthreadAttrGetDetachState(t, pAttr) == pthread.PTHREAD_CREATE_DETACHED
	tls := newTLS(detached)
	*(*pthread.Pthread_t)(unsafe.Pointer(pThread)) = pthread.Pthread_t(tls.ID)

	go func() {
		Xpthread_exit(tls, fn(tls, arg))
	}()

	return 0
}

// int pthread_detach(pthread_t thread);
func Xpthread_detach(t *TLS, thread pthread.Pthread_t) int32 {
	if __ccgo_strace {
		trc("t=%v thread=%v, (%v:)", t, thread, origin(2))
	}
	threadsMu.Lock()
	threads[int32(thread)].detached = true
	threadsMu.Unlock()
	return 0
}

// int pthread_equal(pthread_t t1, pthread_t t2);
func Xpthread_equal(t *TLS, t1, t2 pthread.Pthread_t) int32 {
	if __ccgo_strace {
		trc("t=%v t2=%v, (%v:)", t, t2, origin(2))
	}
	return Bool32(t1 == t2)
}

// void pthread_exit(void *value_ptr);
func Xpthread_exit(t *TLS, value uintptr) {
	if __ccgo_strace {
		trc("t=%v value=%v, (%v:)", t, value, origin(2))
	}
	t.retVal = value

	// At thread exit, if a key value has a non-NULL destructor pointer, and the
	// thread has a non-NULL value associated with that key, the value of the key
	// is set to NULL, and then the function pointed to is called with the
	// previously associated value as its sole argument. The order of destructor
	// calls is unspecified if more than one destructor exists for a thread when it
	// exits.
	for k, v := range t.kv {
		if v == 0 {
			continue
		}

		threadsKeysMu.Lock()
		destructors := threadKeyDestructors[k]
		threadsKeysMu.Unlock()

		for _, destructor := range destructors {
			delete(t.kv, k)
			panic(todo("%#x", destructor)) //TODO call destructor(v)
		}
	}

	switch {
	case t.detached:
		threadsMu.Lock()
		delete(threads, t.ID)
		threadsMu.Unlock()
	default:
		close(t.done)
	}
	runtime.Goexit()
}

// int pthread_join(pthread_t thread, void **value_ptr);
func Xpthread_join(t *TLS, thread pthread.Pthread_t, pValue uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v thread=%v pValue=%v, (%v:)", t, thread, pValue, origin(2))
	}
	threadsMu.Lock()
	tls := threads[int32(thread)]
	delete(threads, int32(thread))
	threadsMu.Unlock()
	<-tls.done
	if pValue != 0 {
		*(*uintptr)(unsafe.Pointer(pValue)) = tls.retVal
	}
	return 0
}

// pthread_t pthread_self(void);
func Xpthread_self(t *TLS) pthread.Pthread_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return pthread.Pthread_t(t.ID)
}
