// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm)

package libc // import "modernc.org/libc"

func X__vm_wait(tls *TLS) {}

// static volatile int *const dummy_lockptr = 0;
//
// weak_alias(dummy_lockptr, __atexit_lockptr);
// weak_alias(dummy_lockptr, __bump_lockptr);
// weak_alias(dummy_lockptr, __sem_open_lockptr);
var X__atexit_lockptr int32
var X__bump_lockptr int32
var X__sem_open_lockptr int32

// static int dummy(int fd)
//
//	{
//		return fd;
//	}
//
// weak_alias(dummy, __aio_close);
func X__aio_close(tls *TLS, fd int32) int32 {
	return fd
}

func Xtzset(tls *TLS) {
	___tzset(tls)
}

type DIR = TDIR

const DT_DETACHED = _DT_DETACHED

const DT_EXITING = _DT_EXITING

const DT_JOINABLE = _DT_JOINABLE

type FILE = TFILE

type HEADER = THEADER

func Xfcntl64(tls *TLS, fd int32, cmd int32, va uintptr) (r int32) {
	return Xfcntl(tls, fd, cmd, va)
}

func Xfopen64(tls *TLS, filename uintptr, mode uintptr) (r uintptr) {
	return Xfopen(tls, filename, mode)
}

func Xfstat64(tls *TLS, fd int32, st uintptr) (r int32) {
	return Xfstat(tls, fd, st)
}

func Xftruncate64(tls *TLS, fd int32, length Toff_t) (r int32) {
	return Xftruncate(tls, fd, length)
}

func Xgetrlimit64(tls *TLS, resource int32, rlim uintptr) (r int32) {
	return Xgetrlimit(tls, resource, rlim)
}

func Xlseek64(tls *TLS, fd int32, offset Toff_t, whence int32) (r Toff_t) {
	return Xlseek(tls, fd, offset, whence)
}

func Xlstat64(tls *TLS, path uintptr, buf uintptr) (r int32) {
	return Xlstat(tls, path, buf)
}

func Xmkstemp64(tls *TLS, template uintptr) (r int32) {
	return Xmkstemp(tls, template)
}

func Xmkstemps64(tls *TLS, template uintptr, len1 int32) (r int32) {
	return Xmkstemps(tls, template, len1)
}

func Xmmap64(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr) {
	return Xmmap(tls, start, len1, prot, flags, fd, off)
}

func Xopen64(tls *TLS, filename uintptr, flags int32, va uintptr) (r int32) {
	return Xopen(tls, filename, flags, va)
}

func Xreaddir64(tls *TLS, dir uintptr) (r uintptr) {
	return Xreaddir(tls, dir)
}

func Xsetrlimit64(tls *TLS, resource int32, rlim uintptr) (r int32) {
	return Xsetrlimit(tls, resource, rlim)
}

func Xstat64(tls *TLS, path uintptr, buf uintptr) (r int32) {
	return Xstat(tls, path, buf)
}

func Xpthread_setcancelstate(tls *TLS, new int32, old uintptr) int32 {
	return _pthread_setcancelstate(tls, new, old)
}

func Xpthread_sigmask(tls *TLS, now int32, set, old uintptr) int32 {
	return _pthread_sigmask(tls, now, set, old)
}
