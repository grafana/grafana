// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	crand "crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	mbits "math/bits"
	"os"
	"os/exec"
	gosignal "os/signal"
	"path/filepath"
	"runtime"
	"strings"
	gotime "time"
	"unicode"
	"unsafe"

	guuid "github.com/google/uuid"
	"golang.org/x/sys/unix"
	"modernc.org/libc/errno"
	"modernc.org/libc/fcntl"
	"modernc.org/libc/fts"
	gonetdb "modernc.org/libc/honnef.co/go/netdb"
	"modernc.org/libc/langinfo"
	"modernc.org/libc/limits"
	"modernc.org/libc/netdb"
	"modernc.org/libc/netinet/in"
	"modernc.org/libc/signal"
	"modernc.org/libc/stdio"
	"modernc.org/libc/sys/socket"
	"modernc.org/libc/sys/stat"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/termios"
	"modernc.org/libc/time"
	"modernc.org/libc/unistd"
	"modernc.org/libc/uuid/uuid"
	"modernc.org/libc/wctype"
	"modernc.org/memory"
)

const (
	maxPathLen = 1024
)

// var (
// 	in6_addr_any in.In6_addr
// )

type Tsize_t = types.Size_t

type (
	syscallErrno = unix.Errno
	long         = types.User_long_t
	ulong        = types.User_ulong_t
)

// // Keep these outside of the var block otherwise go generate will miss them.
var X__stderrp = Xstdout
var X__stdinp = Xstdin
var X__stdoutp = Xstdout

// user@darwin-m1:~/tmp$ cat main.c
//
//	#include <xlocale.h>
//	#include <stdio.h>
//
//	int main() {
//		printf("%i\n", ___mb_cur_max());
//		return 0;
//	}
//
// user@darwin-m1:~/tmp$ gcc main.c && ./a.out
// 1
// user@darwin-m1:~/tmp$
var X__mb_cur_max int32 = 1

var startTime = gotime.Now() // For clock(3)

type file uintptr

func (f file) fd() int32      { return int32((*stdio.FILE)(unsafe.Pointer(f)).F_file) }
func (f file) setFd(fd int32) { (*stdio.FILE)(unsafe.Pointer(f)).F_file = int16(fd) }

func (f file) err() bool {
	return (*stdio.FILE)(unsafe.Pointer(f)).F_flags&1 != 0
}

func (f file) setErr() {
	(*stdio.FILE)(unsafe.Pointer(f)).F_flags |= 1
}

func (f file) clearErr() {
	(*stdio.FILE)(unsafe.Pointer(f)).F_flags &^= 3
}

func (f file) eof() bool {
	return (*stdio.FILE)(unsafe.Pointer(f)).F_flags&2 != 0
}

func (f file) setEOF() {
	(*stdio.FILE)(unsafe.Pointer(f)).F_flags |= 2
}

func (f file) close(t *TLS) int32 {
	r := Xclose(t, f.fd())
	Xfree(t, uintptr(f))
	if r < 0 {
		return stdio.EOF
	}

	return 0
}

func newFile(t *TLS, fd int32) uintptr {
	p := Xcalloc(t, 1, types.Size_t(unsafe.Sizeof(stdio.FILE{})))
	if p == 0 {
		return 0
	}

	file(p).setFd(fd)
	return p
}

func fwrite(fd int32, b []byte) (int, error) {
	if fd == unistd.STDOUT_FILENO {
		return write(b)
	}

	if dmesgs {
		dmesg("%v: fd %v: %s", origin(1), fd, hex.Dump(b))
	}
	return unix.Write(int(fd), b)
}

func Xclearerr(tls *TLS, f uintptr) {
	file(f).clearErr()
}

func Xfeof(t *TLS, f uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v f=%v, (%v:)", t, f, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	r = BoolInt32(file(f).eof())
	return r
}

func X__inline_isnand(t *TLS, x float64) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Xisnan(t, x)
}

func X__inline_isnanf(t *TLS, x float32) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Xisnanf(t, x)
}

func X__inline_isnanl(t *TLS, x float64) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Xisnan(t, x)
}

// int fprintf(FILE *stream, const char *format, ...);
func Xfprintf(t *TLS, stream, format, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
	}
	n, _ := fwrite(int32((*stdio.FILE)(unsafe.Pointer(stream)).F_file), printf(format, args))
	return int32(n)
}

// int usleep(useconds_t usec);
func Xusleep(t *TLS, usec types.Useconds_t) int32 {
	if __ccgo_strace {
		trc("t=%v usec=%v, (%v:)", t, usec, origin(2))
	}
	gotime.Sleep(gotime.Microsecond * gotime.Duration(usec))
	return 0
}

// int futimes(int fd, const struct timeval tv[2]);
func Xfutimes(t *TLS, fd int32, tv uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v tv=%v, (%v:)", t, fd, tv, origin(2))
	}
	var a []unix.Timeval
	if tv != 0 {
		a = make([]unix.Timeval, 2)
		a[0] = *(*unix.Timeval)(unsafe.Pointer(tv))
		a[1] = *(*unix.Timeval)(unsafe.Pointer(tv + unsafe.Sizeof(unix.Timeval{})))
	}
	if err := unix.Futimes(int(fd), a); err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// void srandomdev(void);
func Xsrandomdev(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// int gethostuuid(uuid_t id, const struct timespec *wait);
func Xgethostuuid(t *TLS, id uintptr, wait uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v id=%v wait=%v, (%v:)", t, id, wait, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_GETHOSTUUID, id, wait, 0); err != 0 { // Cannot avoid the syscall here.
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// int flock(int fd, int operation);
func Xflock(t *TLS, fd, operation int32) int32 {
	if __ccgo_strace {
		trc("t=%v operation=%v, (%v:)", t, operation, origin(2))
	}
	if err := unix.Flock(int(fd), int(operation)); err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// int fsctl(const char *,unsigned long,void*,unsigned int);
func Xfsctl(t *TLS, path uintptr, request ulong, data uintptr, options uint32) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v request=%v data=%v options=%v, (%v:)", t, path, request, data, options, origin(2))
	}
	panic(todo(""))
	// if _, _, err := unix.Syscall6(unix.SYS_FSCTL, path, uintptr(request), data, uintptr(options), 0, 0); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
}

// int * __error(void);
func X__error(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return t.errnop
}

// int isspace(int c);
func Xisspace(t *TLS, c int32) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	return __isspace(t, c)
}

// void __assert_rtn(const char *, const char *, int, const char *)
func X__assert_rtn(t *TLS, function, file uintptr, line int32, assertion uintptr) {
	if __ccgo_strace {
		trc("t=%v file=%v line=%v assertion=%v, (%v:)", t, file, line, assertion, origin(2))
	}
	panic(todo(""))
	// fmt.Fprintf(os.Stderr, "assertion failure: %s:%d.%s: %s\n", GoString(file), line, GoString(function), GoString(assertion))
	// os.Stderr.Sync()
	// Xexit(t, 1)
}

// int getrusage(int who, struct rusage *usage);
func Xgetrusage(t *TLS, who int32, usage uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v who=%v usage=%v, (%v:)", t, who, usage, origin(2))
	}
	panic(todo(""))
	// if _, _, err := unix.Syscall(unix.SYS_GETRUSAGE, uintptr(who), usage, 0); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
}

// int fgetc(FILE *stream);
func Xfgetc(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	fd := int((*stdio.FILE)(unsafe.Pointer(stream)).F_file)
	var buf [1]byte
	if n, _ := unix.Read(fd, buf[:]); n != 0 {
		return int32(buf[0])
	}

	return stdio.EOF
}

// int lstat(const char *pathname, struct stat *statbuf);
func Xlstat(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v statbuf=%v, (%v:)", t, statbuf, origin(2))
	}
	return Xlstat64(t, pathname, statbuf)
}

// int stat(const char *pathname, struct stat *statbuf);
func Xstat(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v statbuf=%v, (%v:)", t, statbuf, origin(2))
	}
	return Xstat64(t, pathname, statbuf)
}

// int chdir(const char *path);
func Xchdir(t *TLS, path uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v, (%v:)", t, path, origin(2))
	}
	if err := unix.Chdir(GoString(path)); err != nil {
		if dmesgs {
			dmesg("%v: %q: %v FAIL", origin(1), GoString(path), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q: ok", origin(1), GoString(path))
	}
	return 0
}

var localtime time.Tm

// struct tm *localtime(const time_t *timep);
func Xlocaltime(_ *TLS, timep uintptr) uintptr {
	loc := getLocalLocation()
	ut := *(*time.Time_t)(unsafe.Pointer(timep))
	t := gotime.Unix(int64(ut), 0).In(loc)
	localtime.Ftm_sec = int32(t.Second())
	localtime.Ftm_min = int32(t.Minute())
	localtime.Ftm_hour = int32(t.Hour())
	localtime.Ftm_mday = int32(t.Day())
	localtime.Ftm_mon = int32(t.Month() - 1)
	localtime.Ftm_year = int32(t.Year() - 1900)
	localtime.Ftm_wday = int32(t.Weekday())
	localtime.Ftm_yday = int32(t.YearDay())
	localtime.Ftm_isdst = Bool32(isTimeDST(t))
	_, off := t.Zone()
	localtime.Ftm_gmtoff = int64(off)
	localtime.Ftm_zone = 0
	return uintptr(unsafe.Pointer(&localtime))
}

// struct tm *localtime_r(const time_t *timep, struct tm *result);
func Xlocaltime_r(_ *TLS, timep, result uintptr) uintptr {
	loc := getLocalLocation()
	ut := *(*time_t)(unsafe.Pointer(timep))
	t := gotime.Unix(int64(ut), 0).In(loc)
	(*time.Tm)(unsafe.Pointer(result)).Ftm_sec = int32(t.Second())
	(*time.Tm)(unsafe.Pointer(result)).Ftm_min = int32(t.Minute())
	(*time.Tm)(unsafe.Pointer(result)).Ftm_hour = int32(t.Hour())
	(*time.Tm)(unsafe.Pointer(result)).Ftm_mday = int32(t.Day())
	(*time.Tm)(unsafe.Pointer(result)).Ftm_mon = int32(t.Month() - 1)
	(*time.Tm)(unsafe.Pointer(result)).Ftm_year = int32(t.Year() - 1900)
	(*time.Tm)(unsafe.Pointer(result)).Ftm_wday = int32(t.Weekday())
	(*time.Tm)(unsafe.Pointer(result)).Ftm_yday = int32(t.YearDay())
	(*time.Tm)(unsafe.Pointer(result)).Ftm_isdst = Bool32(isTimeDST(t))
	_, off := t.Zone()
	(*time.Tm)(unsafe.Pointer(result)).Ftm_gmtoff = int64(off)
	(*time.Tm)(unsafe.Pointer(result)).Ftm_zone = 0
	return result
}

// int open(const char *pathname, int flags, ...);
func Xopen(t *TLS, pathname uintptr, flags int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v flags=%v args=%v, (%v:)", t, pathname, flags, args, origin(2))
	}
	var mode types.Mode_t
	if args != 0 {
		mode = (types.Mode_t)(VaUint32(&args))
	}
	fd, err := unix.Open(GoString(pathname), int(flags), uint32(mode))
	if err != nil {
		if dmesgs {
			dmesg("%v: %q %#x %#o: %v FAIL", origin(1), GoString(pathname), flags, mode, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q flags %#x mode %#o: fd %v", origin(1), GoString(pathname), flags, mode, fd)
	}
	return int32(fd)
}

// off_t lseek(int fd, off_t offset, int whence);
func Xlseek(t *TLS, fd int32, offset types.Off_t, whence int32) types.Off_t {
	if __ccgo_strace {
		trc("t=%v fd=%v offset=%v whence=%v, (%v:)", t, fd, offset, whence, origin(2))
	}
	return types.Off_t(Xlseek64(t, fd, offset, whence))
}

func whenceStr(whence int32) string {
	switch whence {
	case fcntl.SEEK_CUR:
		return "SEEK_CUR"
	case fcntl.SEEK_END:
		return "SEEK_END"
	case fcntl.SEEK_SET:
		return "SEEK_SET"
	default:
		return fmt.Sprintf("whence(%d)", whence)
	}
}

var fsyncStatbuf stat.Stat

// int fsync(int fd);
func Xfsync(t *TLS, fd int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}
	if noFsync {
		// Simulate -DSQLITE_NO_SYNC for sqlite3 testfixture, see function full_sync in sqlite3.c
		return Xfstat(t, fd, uintptr(unsafe.Pointer(&fsyncStatbuf)))
	}

	if err := unix.Fsync(int(fd)); err != nil {
		if dmesgs {
			dmesg("%v: %v: %v FAIL", origin(1), fd, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %d: ok", origin(1), fd)
	}
	return 0
}

// long sysconf(int name);
func Xsysconf(t *TLS, name int32) long {
	if __ccgo_strace {
		trc("t=%v name=%v, (%v:)", t, name, origin(2))
	}
	switch name {
	case unistd.X_SC_PAGESIZE:
		return long(unix.Getpagesize())
	case unistd.X_SC_NPROCESSORS_ONLN:
		return long(runtime.NumCPU())
	case unistd.X_SC_GETPW_R_SIZE_MAX:
		return 128
	}

	panic(todo("", name))
}

// int close(int fd);
func Xclose(t *TLS, fd int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}
	if err := unix.Close(int(fd)); err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %d: ok", origin(1), fd)
	}
	return 0
}

// char *getcwd(char *buf, size_t size);
func Xgetcwd(t *TLS, buf uintptr, size types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v buf=%v size=%v, (%v:)", t, buf, size, origin(2))
	}
	if _, err := unix.Getcwd((*RawMem)(unsafe.Pointer(buf))[:size:size]); err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return 0
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return buf
}

// int fstat(int fd, struct stat *statbuf);
func Xfstat(t *TLS, fd int32, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v statbuf=%v, (%v:)", t, fd, statbuf, origin(2))
	}
	return Xfstat64(t, fd, statbuf)
}

// int ftruncate(int fd, off_t length);
func Xftruncate(t *TLS, fd int32, length types.Off_t) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v length=%v, (%v:)", t, fd, length, origin(2))
	}
	if err := unix.Ftruncate(int(fd), int64(length)); err != nil {
		if dmesgs {
			dmesg("%v: fd %d: %v FAIL", origin(1), fd, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %d %#x: ok", origin(1), fd, length)
	}
	return 0
}

// int fcntl(int fd, int cmd, ... /* arg */ );
func Xfcntl(t *TLS, fd, cmd int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v cmd=%v args=%v, (%v:)", t, cmd, args, origin(2))
	}
	return Xfcntl64(t, fd, cmd, args)
}

// ssize_t read(int fd, void *buf, size_t count);
func Xread(t *TLS, fd int32, buf uintptr, count types.Size_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v, (%v:)", t, fd, buf, count, origin(2))
	}
	var n int
	var err error
	switch {
	case count == 0:
		n, err = unix.Read(int(fd), nil)
	default:
		n, err = unix.Read(int(fd), (*RawMem)(unsafe.Pointer(buf))[:count:count])
		if dmesgs && err == nil {
			dmesg("%v: fd %v, count %#x, n %#x\n%s", origin(1), fd, count, n, hex.Dump((*RawMem)(unsafe.Pointer(buf))[:n:n]))
		}
	}
	if err != nil {
		if dmesgs {
			dmesg("%v: fd %v, %v FAIL", origin(1), fd, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return types.Ssize_t(n)
}

// ssize_t write(int fd, const void *buf, size_t count);
func Xwrite(t *TLS, fd int32, buf uintptr, count types.Size_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v, (%v:)", t, fd, buf, count, origin(2))
	}
	var n int
	var err error
	switch {
	case count == 0:
		n, err = unix.Write(int(fd), nil)
	default:
		n, err = unix.Write(int(fd), (*RawMem)(unsafe.Pointer(buf))[:count:count])
		if dmesgs {
			dmesg("%v: fd %v, count %#x\n%s", origin(1), fd, count, hex.Dump((*RawMem)(unsafe.Pointer(buf))[:count:count]))
		}
	}
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return types.Ssize_t(n)
}

// int fchmod(int fd, mode_t mode);
func Xfchmod(t *TLS, fd int32, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v mode=%v, (%v:)", t, fd, mode, origin(2))
	}
	if err := unix.Fchmod(int(fd), uint32(mode)); err != nil {
		if dmesgs {
			dmesg("%v: %d %#o: %v FAIL", origin(1), fd, mode, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %d %#o: ok", origin(1), fd, mode)
	}
	return 0
}

// int fchown(int fd, uid_t owner, gid_t group);
func Xfchown(t *TLS, fd int32, owner types.Uid_t, group types.Gid_t) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v owner=%v group=%v, (%v:)", t, fd, owner, group, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_FCHOWN, uintptr(fd), uintptr(owner), uintptr(group)); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// uid_t geteuid(void);
func Xgeteuid(t *TLS) types.Uid_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r := types.Uid_t(unix.Geteuid())
	if dmesgs {
		dmesg("%v: %v", origin(1), r)
	}
	return r
}

// void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
func Xmmap(t *TLS, addr uintptr, length types.Size_t, prot, flags, fd int32, offset types.Off_t) uintptr {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v fd=%v offset=%v, (%v:)", t, addr, length, fd, offset, origin(2))
	}
	// Cannot avoid the syscall here, addr sometimes matter.
	data, _, err := unix.Syscall6(unix.SYS_MMAP, addr, uintptr(length), uintptr(prot), uintptr(flags), uintptr(fd), uintptr(offset))
	if err != 0 {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return ^uintptr(0) // (void*)-1
	}

	if dmesgs {
		dmesg("%v: %#x", origin(1), data)
	}
	return data
}

// int munmap(void *addr, size_t length);
func Xmunmap(t *TLS, addr uintptr, length types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v, (%v:)", t, addr, length, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_MUNMAP, addr, uintptr(length), 0); err != 0 { // Cannot avoid the syscall here, must pair with mmap.
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	return 0
}

// int gettimeofday(struct timeval *tv, struct timezone *tz);
func Xgettimeofday(t *TLS, tv, tz uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v tz=%v, (%v:)", t, tz, origin(2))
	}
	if tz != 0 {
		panic(todo(""))
	}

	var tvs unix.Timeval
	err := unix.Gettimeofday(&tvs)
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	*(*unix.Timeval)(unsafe.Pointer(tv)) = tvs
	return 0
}

// int getsockopt(int sockfd, int level, int optname, void *optval, socklen_t *optlen);
func Xgetsockopt(t *TLS, sockfd, level, optname int32, optval, optlen uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v optname=%v optlen=%v, (%v:)", t, optname, optlen, origin(2))
	}
	if _, _, err := unix.Syscall6(unix.SYS_GETSOCKOPT, uintptr(sockfd), uintptr(level), uintptr(optname), optval, optlen, 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int setsockopt(int sockfd, int level, int optname, const void *optval, socklen_t optlen);
func Xsetsockopt(t *TLS, sockfd, level, optname int32, optval uintptr, optlen socket.Socklen_t) int32 {
	if __ccgo_strace {
		trc("t=%v optname=%v optval=%v optlen=%v, (%v:)", t, optname, optval, optlen, origin(2))
	}
	if _, _, err := unix.Syscall6(unix.SYS_SETSOCKOPT, uintptr(sockfd), uintptr(level), uintptr(optname), optval, uintptr(optlen), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int ioctl(int fd, unsigned long request, ...);
func Xioctl(t *TLS, fd int32, request ulong, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v request=%v va=%v, (%v:)", t, fd, request, va, origin(2))
	}
	var argp uintptr
	if va != 0 {
		argp = VaUintptr(&va)
	}
	n, _, err := unix.Syscall(unix.SYS_IOCTL, uintptr(fd), uintptr(request), argp)
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return int32(n)
}

// int getsockname(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
func Xgetsockname(t *TLS, sockfd int32, addr, addrlen uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addrlen=%v, (%v:)", t, sockfd, addrlen, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_GETSOCKNAME, uintptr(sockfd), addr, addrlen); err != 0 { // Cannot avoid the syscall here.
		if dmesgs {
			dmesg("%v: fd %v: %v FAIL", origin(1), sockfd, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %v: ok", origin(1), sockfd)
	}
	return 0
}

// int select(int nfds, fd_set *readfds, fd_set *writefds, fd_set *exceptfds, struct timeval *timeout);
func Xselect(t *TLS, nfds int32, readfds, writefds, exceptfds, timeout uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v nfds=%v timeout=%v, (%v:)", t, nfds, timeout, origin(2))
	}
	n, err := unix.Select(
		int(nfds),
		(*unix.FdSet)(unsafe.Pointer(readfds)),
		(*unix.FdSet)(unsafe.Pointer(writefds)),
		(*unix.FdSet)(unsafe.Pointer(exceptfds)),
		(*unix.Timeval)(unsafe.Pointer(timeout)),
	)
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return int32(n)
}

// int mkfifo(const char *pathname, mode_t mode);
func Xmkfifo(t *TLS, pathname uintptr, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v, (%v:)", t, pathname, mode, origin(2))
	}
	if err := unix.Mkfifo(GoString(pathname), uint32(mode)); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// mode_t umask(mode_t mask);
func Xumask(t *TLS, mask types.Mode_t) types.Mode_t {
	if __ccgo_strace {
		trc("t=%v mask=%v, (%v:)", t, mask, origin(2))
	}
	return types.Mode_t(unix.Umask(int(mask)))
}

// // int execvp(const char *file, char *const argv[]);
// func Xexecvp(t *TLS, file, argv uintptr) int32 {
// 	if _, _, err := unix.Syscall(unix.SYS_EXECVE, file, argv, Environ()); err != 0 {
// 		t.setErrno(err)
// 		return -1
// 	}
//
// 	return 0
// }

// pid_t (pid_t pid, int *wstatus, int options);
func Xwaitpid(t *TLS, pid types.Pid_t, wstatus uintptr, optname int32) types.Pid_t {
	if __ccgo_strace {
		trc("t=%v pid=%v wstatus=%v optname=%v, (%v:)", t, pid, wstatus, optname, origin(2))
	}
	n, err := unix.Wait4(int(pid), (*unix.WaitStatus)(unsafe.Pointer(wstatus)), int(optname), nil)
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return types.Pid_t(n)
}

// int uname(struct utsname *buf);
func Xuname(t *TLS, buf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v, (%v:)", t, buf, origin(2))
	}
	if err := unix.Uname((*unix.Utsname)(unsafe.Pointer(buf))); err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// ssize_t recv(int sockfd, void *buf, size_t len, int flags);
func Xrecv(t *TLS, sockfd int32, buf uintptr, len types.Size_t, flags int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v sockfd=%v buf=%v len=%v flags=%v, (%v:)", t, sockfd, buf, len, flags, origin(2))
	}
	n, _, err := unix.Syscall6(unix.SYS_RECVFROM, uintptr(sockfd), buf, uintptr(len), uintptr(flags), 0, 0)
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return types.Ssize_t(n)
}

// ssize_t send(int sockfd, const void *buf, size_t len, int flags);
func Xsend(t *TLS, sockfd int32, buf uintptr, len types.Size_t, flags int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v sockfd=%v buf=%v len=%v flags=%v, (%v:)", t, sockfd, buf, len, flags, origin(2))
	}
	n, _, err := unix.Syscall6(unix.SYS_SENDTO, uintptr(sockfd), buf, uintptr(len), uintptr(flags), 0, 0)
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return types.Ssize_t(n)
}

// int shutdown(int sockfd, int how);
func Xshutdown(t *TLS, sockfd, how int32) int32 {
	if __ccgo_strace {
		trc("t=%v how=%v, (%v:)", t, how, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_SHUTDOWN, uintptr(sockfd), uintptr(how), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int getpeername(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
func Xgetpeername(t *TLS, sockfd int32, addr uintptr, addrlen uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_GETPEERNAME, uintptr(sockfd), addr, uintptr(addrlen)); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int socket(int domain, int type, int protocol);
func Xsocket(t *TLS, domain, type1, protocol int32) int32 {
	if __ccgo_strace {
		trc("t=%v protocol=%v, (%v:)", t, protocol, origin(2))
	}
	n, _, err := unix.Syscall(unix.SYS_SOCKET, uintptr(domain), uintptr(type1), uintptr(protocol))
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return int32(n)
}

// int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
func Xbind(t *TLS, sockfd int32, addr uintptr, addrlen uint32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	n, _, err := unix.Syscall(unix.SYS_BIND, uintptr(sockfd), addr, uintptr(addrlen))
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return int32(n)
}

// int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
func Xconnect(t *TLS, sockfd int32, addr uintptr, addrlen uint32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_CONNECT, uintptr(sockfd), addr, uintptr(addrlen)); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int listen(int sockfd, int backlog);
func Xlisten(t *TLS, sockfd, backlog int32) int32 {
	if __ccgo_strace {
		trc("t=%v backlog=%v, (%v:)", t, backlog, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_LISTEN, uintptr(sockfd), uintptr(backlog), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
func Xaccept(t *TLS, sockfd int32, addr uintptr, addrlen uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	panic(todo(""))
	// n, _, err := unix.Syscall6(unix.SYS_ACCEPT4, uintptr(sockfd), addr, uintptr(addrlen), 0, 0, 0)
	// if err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return int32(n)
}

// // int getrlimit(int resource, struct rlimit *rlim);
// func Xgetrlimit(t *TLS, resource int32, rlim uintptr) int32 {
// 	return Xgetrlimit64(t, resource, rlim)
// }
//
// // int setrlimit(int resource, const struct rlimit *rlim);
// func Xsetrlimit(t *TLS, resource int32, rlim uintptr) int32 {
// 	return Xsetrlimit64(t, resource, rlim)
// }
//
// // int setrlimit(int resource, const struct rlimit *rlim);
// func Xsetrlimit64(t *TLS, resource int32, rlim uintptr) int32 {
// 	if _, _, err := unix.Syscall(unix.SYS_SETRLIMIT, uintptr(resource), uintptr(rlim), 0); err != 0 {
// 		t.setErrno(err)
// 		return -1
// 	}
//
// 	return 0
// }

// uid_t getuid(void);
func Xgetuid(t *TLS) types.Uid_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r := types.Uid_t(os.Getuid())
	if dmesgs {
		dmesg("%v: %v", origin(1), r)
	}
	return r
}

// pid_t getpid(void);
func Xgetpid(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r := int32(os.Getpid())
	if dmesgs {
		dmesg("%v: %v", origin(1), r)
	}
	return r
}

// int system(const char *command);
func Xsystem(t *TLS, command uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v command=%v, (%v:)", t, command, origin(2))
	}
	s := GoString(command)
	if command == 0 {
		panic(todo(""))
	}

	cmd := exec.Command("sh", "-c", s)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		ps := err.(*exec.ExitError)
		return int32(ps.ExitCode())
	}

	return 0
}

// int setvbuf(FILE *stream, char *buf, int mode, size_t size);
func Xsetvbuf(t *TLS, stream, buf uintptr, mode int32, size types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v mode=%v size=%v, (%v:)", t, buf, mode, size, origin(2))
	}
	return 0 //TODO
}

// int raise(int sig);
func Xraise(t *TLS, sig int32) int32 {
	if __ccgo_strace {
		trc("t=%v sig=%v, (%v:)", t, sig, origin(2))
	}
	panic(todo(""))
}

// // int backtrace(void **buffer, int size);
// func Xbacktrace(t *TLS, buf uintptr, size int32) int32 {
// 	panic(todo(""))
// }
//
// // void backtrace_symbols_fd(void *const *buffer, int size, int fd);
// func Xbacktrace_symbols_fd(t *TLS, buffer uintptr, size, fd int32) {
// 	panic(todo(""))
// }

// int fileno(FILE *stream);
func Xfileno(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	if stream == 0 {
		if dmesgs {
			dmesg("%v: FAIL", origin(1))
		}
		t.setErrno(errno.EBADF)
		return -1
	}

	if fd := int32((*stdio.FILE)(unsafe.Pointer(stream)).F_file); fd >= 0 {
		return fd
	}

	if dmesgs {
		dmesg("%v: FAIL", origin(1))
	}
	t.setErrno(errno.EBADF)
	return -1
}

func newFtsent(t *TLS, info int, path string, stat *unix.Stat_t, err syscallErrno) (r *fts.FTSENT) {
	var statp uintptr
	if stat != nil {
		statp = Xmalloc(t, types.Size_t(unsafe.Sizeof(unix.Stat_t{})))
		if statp == 0 {
			panic("OOM")
		}

		*(*unix.Stat_t)(unsafe.Pointer(statp)) = *stat
	}
	csp, errx := CString(path)
	if errx != nil {
		panic("OOM")
	}

	return &fts.FTSENT{
		Ffts_info:    uint16(info),
		Ffts_path:    csp,
		Ffts_pathlen: uint16(len(path)),
		Ffts_statp:   statp,
		Ffts_errno:   int32(err),
	}
}

func newCFtsent(t *TLS, info int, path string, stat *unix.Stat_t, err syscallErrno) uintptr {
	p := Xcalloc(t, 1, types.Size_t(unsafe.Sizeof(fts.FTSENT{})))
	if p == 0 {
		panic("OOM")
	}

	*(*fts.FTSENT)(unsafe.Pointer(p)) = *newFtsent(t, info, path, stat, err)
	return p
}

func ftsentClose(t *TLS, p uintptr) {
	Xfree(t, (*fts.FTSENT)(unsafe.Pointer(p)).Ffts_path)
	Xfree(t, (*fts.FTSENT)(unsafe.Pointer(p)).Ffts_statp)
}

type ftstream struct {
	s []uintptr
	x int
}

func (f *ftstream) close(t *TLS) {
	for _, p := range f.s {
		ftsentClose(t, p)
		Xfree(t, p)
	}
	*f = ftstream{}
}

// FTS *fts_open(char * const *path_argv, int options, int (*compar)(const FTSENT **, const FTSENT **));
func Xfts_open(t *TLS, path_argv uintptr, options int32, compar uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v path_argv=%v options=%v compar=%v, (%v:)", t, path_argv, options, compar, origin(2))
	}
	f := &ftstream{}

	var walk func(string)
	walk = func(path string) {
		var fi os.FileInfo
		var err error
		switch {
		case options&fts.FTS_LOGICAL != 0:
			fi, err = os.Stat(path)
		case options&fts.FTS_PHYSICAL != 0:
			fi, err = os.Lstat(path)
		default:
			panic(todo(""))
		}

		if err != nil {
			return
		}

		var statp *unix.Stat_t
		if options&fts.FTS_NOSTAT == 0 {
			var stat unix.Stat_t
			switch {
			case options&fts.FTS_LOGICAL != 0:
				if err := unix.Stat(path, &stat); err != nil {
					panic(todo(""))
				}
			case options&fts.FTS_PHYSICAL != 0:
				if err := unix.Lstat(path, &stat); err != nil {
					panic(todo(""))
				}
			default:
				panic(todo(""))
			}

			statp = &stat
		}

	out:
		switch {
		case fi.IsDir():
			f.s = append(f.s, newCFtsent(t, fts.FTS_D, path, statp, 0))
			g, err := os.Open(path)
			switch x := err.(type) {
			case nil:
				// ok
			case *os.PathError:
				f.s = append(f.s, newCFtsent(t, fts.FTS_DNR, path, statp, errno.EACCES))
				break out
			default:
				panic(todo("%q: %v %T", path, x, x))
			}

			names, err := g.Readdirnames(-1)
			g.Close()
			if err != nil {
				panic(todo(""))
			}

			for _, name := range names {
				walk(path + "/" + name)
				if f == nil {
					break out
				}
			}

			f.s = append(f.s, newCFtsent(t, fts.FTS_DP, path, statp, 0))
		default:
			info := fts.FTS_F
			if fi.Mode()&os.ModeSymlink != 0 {
				info = fts.FTS_SL
			}
			switch {
			case statp != nil:
				f.s = append(f.s, newCFtsent(t, info, path, statp, 0))
			case options&fts.FTS_NOSTAT != 0:
				f.s = append(f.s, newCFtsent(t, fts.FTS_NSOK, path, nil, 0))
			default:
				panic(todo(""))
			}
		}
	}

	for {
		p := *(*uintptr)(unsafe.Pointer(path_argv))
		if p == 0 {
			if f == nil {
				return 0
			}

			if compar != 0 {
				panic(todo(""))
			}

			return addObject(f)
		}

		walk(GoString(p))
		path_argv += unsafe.Sizeof(uintptr(0))
	}
}

// FTSENT *fts_read(FTS *ftsp);
func Xfts_read(t *TLS, ftsp uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v ftsp=%v, (%v:)", t, ftsp, origin(2))
	}
	f := getObject(ftsp).(*ftstream)
	if f.x == len(f.s) {
		if dmesgs {
			dmesg("%v: FAIL", origin(1))
		}
		t.setErrno(0)
		return 0
	}

	r := f.s[f.x]
	if e := (*fts.FTSENT)(unsafe.Pointer(r)).Ffts_errno; e != 0 {
		if dmesgs {
			dmesg("%v: FAIL", origin(1))
		}
		t.setErrno(e)
	}
	f.x++
	return r
}

// int fts_close(FTS *ftsp);
func Xfts_close(t *TLS, ftsp uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ftsp=%v, (%v:)", t, ftsp, origin(2))
	}
	getObject(ftsp).(*ftstream).close(t)
	removeObject(ftsp)
	return 0
}

// void tzset (void);
func Xtzset(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	//TODO
}

var strerrorBuf [100]byte

// char *strerror(int errnum);
func Xstrerror(t *TLS, errnum int32) uintptr {
	if __ccgo_strace {
		trc("t=%v errnum=%v, (%v:)", t, errnum, origin(2))
	}
	// 	if dmesgs {
	// 		dmesg("%v: %v\n%s", origin(1), errnum, debug.Stack())
	// 	}
	copy(strerrorBuf[:], fmt.Sprintf("strerror(%d)\x00", errnum))
	return uintptr(unsafe.Pointer(&strerrorBuf[0]))
}

// void *dlopen(const char *filename, int flags);
func Xdlopen(t *TLS, filename uintptr, flags int32) uintptr {
	if __ccgo_strace {
		trc("t=%v filename=%v flags=%v, (%v:)", t, filename, flags, origin(2))
	}
	panic(todo(""))
}

// char *dlerror(void);
func Xdlerror(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// int dlclose(void *handle);
func Xdlclose(t *TLS, handle uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v handle=%v, (%v:)", t, handle, origin(2))
	}
	panic(todo(""))
}

// void *dlsym(void *handle, const char *symbol);
func Xdlsym(t *TLS, handle, symbol uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v symbol=%v, (%v:)", t, symbol, origin(2))
	}
	panic(todo(""))
}

// void perror(const char *s);
func Xperror(tls *TLS, msg uintptr) {
	if __ccgo_strace {
		trc("tls=%v msg=%v, (%v:)", tls, msg, origin(2))
	}
	if msg != 0 && *(*int8)(unsafe.Pointer(msg)) != 0 {
		fmt.Fprintf(os.Stderr, "%s: ", GoString(msg))
	}
	errstr := Xstrerror(tls, *(*int32)(unsafe.Pointer(X__errno_location(tls))))
	fmt.Fprintf(os.Stderr, "%s\n", GoString(errstr))
}

// int pclose(FILE *stream);
func Xpclose(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	panic(todo(""))
}

// var gai_strerrorBuf [100]byte

// const char *gai_strerror(int errcode);
func Xgai_strerror(t *TLS, errcode int32) uintptr {
	if __ccgo_strace {
		trc("t=%v errcode=%v, (%v:)", t, errcode, origin(2))
	}
	panic(todo(""))
	// copy(gai_strerrorBuf[:], fmt.Sprintf("gai error %d\x00", errcode))
	// return uintptr(unsafe.Pointer(&gai_strerrorBuf))
}

// int tcgetattr(int fd, struct termios *termios_p);
func Xtcgetattr(t *TLS, fd int32, termios_p uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v termios_p=%v, (%v:)", t, fd, termios_p, origin(2))
	}
	panic(todo(""))
}

// int tcsetattr(int fd, int optional_actions, const struct termios *termios_p);
func Xtcsetattr(t *TLS, fd, optional_actions int32, termios_p uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v optional_actions=%v termios_p=%v, (%v:)", t, optional_actions, termios_p, origin(2))
	}
	panic(todo(""))
}

// speed_t cfgetospeed(const struct termios *termios_p);
func Xcfgetospeed(t *TLS, termios_p uintptr) termios.Speed_t {
	if __ccgo_strace {
		trc("t=%v termios_p=%v, (%v:)", t, termios_p, origin(2))
	}
	panic(todo(""))
}

// int cfsetospeed(struct termios *termios_p, speed_t speed);
// func Xcfsetospeed(t *TLS, termios_p uintptr, speed uint32) int32 {
func Xcfsetospeed(...interface{}) int32 {
	panic(todo(""))
}

// int cfsetispeed(struct termios *termios_p, speed_t speed);
// func Xcfsetispeed(t *TLS, termios_p uintptr, speed uint32) int32 {
func Xcfsetispeed(...interface{}) int32 {
	panic(todo(""))
}

// pid_t fork(void);
func Xfork(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	if dmesgs {
		dmesg("%v: FAIL", origin(1))
	}
	t.setErrno(errno.ENOSYS)
	return -1
}

var emptyStr = [1]byte{}

// char *setlocale(int category, const char *locale);
func Xsetlocale(t *TLS, category int32, locale uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v category=%v locale=%v, (%v:)", t, category, locale, origin(2))
	}
	return uintptr(unsafe.Pointer(&emptyStr)) //TODO
}

// char *nl_langinfo(nl_item item);
func Xnl_langinfo(t *TLS, item langinfo.Nl_item) uintptr {
	if __ccgo_strace {
		trc("t=%v item=%v, (%v:)", t, item, origin(2))
	}
	return uintptr(unsafe.Pointer(&emptyStr)) //TODO
}

// FILE *popen(const char *command, const char *type);
func Xpopen(t *TLS, command, type1 uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v type1=%v, (%v:)", t, type1, origin(2))
	}
	panic(todo(""))
}

// char *realpath(const char *path, char *resolved_path);
func Xrealpath(t *TLS, path, resolved_path uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v resolved_path=%v, (%v:)", t, resolved_path, origin(2))
	}
	s, err := filepath.EvalSymlinks(GoString(path))
	if err != nil {
		if os.IsNotExist(err) {
			if dmesgs {
				dmesg("%v: %q: %v FAIL", origin(1), GoString(path), err)
			}
			t.setErrno(errno.ENOENT)
			return 0
		}

		panic(todo("", err))
	}

	if resolved_path == 0 {
		panic(todo(""))
	}

	if len(s) >= limits.PATH_MAX {
		s = s[:limits.PATH_MAX-1]
	}

	copy((*RawMem)(unsafe.Pointer(resolved_path))[:len(s):len(s)], s)
	(*RawMem)(unsafe.Pointer(resolved_path))[len(s)] = 0
	if dmesgs {
		dmesg("%v: %q: ok", origin(1), GoString(path))
	}
	return resolved_path
}

// char *inet_ntoa(struct in_addr in);
func Xinet_ntoa(t *TLS, in1 in.In_addr) uintptr {
	if __ccgo_strace {
		trc("t=%v in1=%v, (%v:)", t, in1, origin(2))
	}
	panic(todo(""))
}

func X__ccgo_in6addr_anyp(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
	// return uintptr(unsafe.Pointer(&in6_addr_any))
}

func Xabort(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	if dmesgs {
		dmesg("%v:", origin(1))
	}
	p := Xcalloc(t, 1, types.Size_t(unsafe.Sizeof(signal.Sigaction{})))
	if p == 0 {
		panic("OOM")
	}

	(*signal.Sigaction)(unsafe.Pointer(p)).F__sigaction_u.F__sa_handler = signal.SIG_DFL
	Xsigaction(t, signal.SIGABRT, p, 0)
	Xfree(t, p)
	unix.Kill(unix.Getpid(), unix.Signal(signal.SIGABRT))
	panic(todo("unrechable"))
}

// int fflush(FILE *stream);
func Xfflush(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	return 0 //TODO
}

// size_t fread(void *ptr, size_t size, size_t nmemb, FILE *stream);
func Xfread(t *TLS, ptr uintptr, size, nmemb types.Size_t, stream uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v ptr=%v nmemb=%v stream=%v, (%v:)", t, ptr, nmemb, stream, origin(2))
	}
	fd := uintptr(file(stream).fd())
	count := size * nmemb
	var n int
	var err error
	switch {
	case count == 0:
		n, err = unix.Read(int(fd), nil)
	default:
		n, err = unix.Read(int(fd), (*RawMem)(unsafe.Pointer(ptr))[:count:count])
		if n == 0 {
			file(stream).setEOF()
		}
		if dmesgs && err == nil {
			dmesg("%v: fd %v, n %#x\n%s", origin(1), fd, n, hex.Dump((*RawMem)(unsafe.Pointer(ptr))[:n:n]))
		}
	}
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		file(stream).setErr()
		return types.Size_t(n) / size
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return types.Size_t(n) / size
}

// size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *stream);
func Xfwrite(t *TLS, ptr uintptr, size, nmemb types.Size_t, stream uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v ptr=%v nmemb=%v stream=%v, (%v:)", t, ptr, nmemb, stream, origin(2))
	}
	fd := uintptr(file(stream).fd())
	count := size * nmemb
	var n int
	var err error
	switch {
	case count == 0:
		n, err = unix.Write(int(fd), nil)
	default:
		n, err = unix.Write(int(fd), (*RawMem)(unsafe.Pointer(ptr))[:count:count])
		if dmesgs {
			dmesg("%v: fd %v, count %#x\n%s", origin(1), fd, count, hex.Dump((*RawMem)(unsafe.Pointer(ptr))[:count:count]))
		}
	}
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		file(stream).setErr()
		return types.Size_t(n) / size
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return types.Size_t(n) / size
}

// int fclose(FILE *stream);
func Xfclose(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	r := file(stream).close(t)
	if r != 0 {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), r)
		}
		t.setErrno(r)
		return stdio.EOF
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// int fputc(int c, FILE *stream);
func Xfputc(t *TLS, c int32, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v stream=%v, (%v:)", t, c, stream, origin(2))
	}
	if _, err := fwrite(file(stream).fd(), []byte{byte(c)}); err != nil {
		return stdio.EOF
	}

	return int32(byte(c))
}

// int fseek(FILE *stream, long offset, int whence);
func Xfseek(t *TLS, stream uintptr, offset long, whence int32) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v offset=%v whence=%v, (%v:)", t, stream, offset, whence, origin(2))
	}
	if n := Xlseek(t, int32(file(stream).fd()), types.Off_t(offset), whence); n < 0 {
		if dmesgs {
			dmesg("%v: fd %v, off %#x, whence %v: %v", origin(1), file(stream).fd(), offset, whenceStr(whence), n)
		}
		file(stream).setErr()
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %v, off %#x, whence %v: ok", origin(1), file(stream).fd(), offset, whenceStr(whence))
	}
	return 0
}

// long ftell(FILE *stream);
func Xftell(t *TLS, stream uintptr) long {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	n := Xlseek(t, file(stream).fd(), 0, stdio.SEEK_CUR)
	if n < 0 {
		file(stream).setErr()
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %v, n %#x: ok %#x", origin(1), file(stream).fd(), n, long(n))
	}
	return long(n)
}

// int ferror(FILE *stream);
func Xferror(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	return Bool32(file(stream).err())
}

// int fputs(const char *s, FILE *stream);
func Xfputs(t *TLS, s, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_WRITE, uintptr(file(stream).fd()), s, uintptr(Xstrlen(t, s))); err != 0 {
		return -1
	}

	return 0
}

var getservbynameStaticResult netdb.Servent

// struct servent *getservbyname(const char *name, const char *proto);
func Xgetservbyname(t *TLS, name, proto uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v proto=%v, (%v:)", t, proto, origin(2))
	}
	var protoent *gonetdb.Protoent
	if proto != 0 {
		protoent = gonetdb.GetProtoByName(GoString(proto))
	}
	servent := gonetdb.GetServByName(GoString(name), protoent)
	if servent == nil {
		if dmesgs {
			dmesg("%q %q: nil (protoent %+v)", GoString(name), GoString(proto), protoent)
		}
		return 0
	}

	Xfree(t, (*netdb.Servent)(unsafe.Pointer(&getservbynameStaticResult)).Fs_name)
	if v := (*netdb.Servent)(unsafe.Pointer(&getservbynameStaticResult)).Fs_aliases; v != 0 {
		for {
			p := *(*uintptr)(unsafe.Pointer(v))
			if p == 0 {
				break
			}

			Xfree(t, p)
			v += unsafe.Sizeof(uintptr(0))
		}
		Xfree(t, v)
	}
	Xfree(t, (*netdb.Servent)(unsafe.Pointer(&getservbynameStaticResult)).Fs_proto)
	cname, err := CString(servent.Name)
	if err != nil {
		getservbynameStaticResult = netdb.Servent{}
		return 0
	}

	var protoname uintptr
	if protoent != nil {
		if protoname, err = CString(protoent.Name); err != nil {
			Xfree(t, cname)
			getservbynameStaticResult = netdb.Servent{}
			return 0
		}
	}
	var a []uintptr
	for _, v := range servent.Aliases {
		cs, err := CString(v)
		if err != nil {
			for _, v := range a {
				Xfree(t, v)
			}
			return 0
		}

		a = append(a, cs)
	}
	v := Xcalloc(t, types.Size_t(len(a)+1), types.Size_t(unsafe.Sizeof(uintptr(0))))
	if v == 0 {
		Xfree(t, cname)
		Xfree(t, protoname)
		for _, v := range a {
			Xfree(t, v)
		}
		getservbynameStaticResult = netdb.Servent{}
		return 0
	}
	for _, p := range a {
		*(*uintptr)(unsafe.Pointer(v)) = p
		v += unsafe.Sizeof(uintptr(0))
	}

	getservbynameStaticResult = netdb.Servent{
		Fs_name:    cname,
		Fs_aliases: v,
		Fs_port:    int32(servent.Port),
		Fs_proto:   protoname,
	}
	return uintptr(unsafe.Pointer(&getservbynameStaticResult))
}

// //TODO- func Xreaddir64(t *TLS, dir uintptr) uintptr {
// //TODO- 	return Xreaddir(t, dir)
// //TODO- }
//
// func __syscall(r, _ uintptr, errno syscallErrno) long {
// 	if errno != 0 {
// 		return long(-errno)
// 	}
//
// 	return long(r)
// }

func fcntlCmdStr(cmd int32) string {
	switch cmd {
	case fcntl.F_GETOWN:
		return "F_GETOWN"
	case fcntl.F_SETLK:
		return "F_SETLK"
	case fcntl.F_GETLK:
		return "F_GETLK"
	case fcntl.F_SETFD:
		return "F_SETFD"
	case fcntl.F_GETFD:
		return "F_GETFD"
	default:
		return fmt.Sprintf("cmd(%d)", cmd)
	}
}

// // struct __float2 { float __sinval; float __cosval; };
// // struct __double2 { double __sinval; double __cosval; };
// //
// // extern struct __float2 __sincosf_stret(float);
// // extern struct __double2 __sincos_stret(double);
// // extern struct __float2 __sincospif_stret(float);
// // extern struct __double2 __sincospi_stret(double);
//
// type X__float2 struct{ F__sinval, F__cosval float32 }
// type X__double2 struct{ F__sinval, F__cosval float32 }
//
// func X__sincosf_stret(*TLS, float32) X__float2 {
// 	panic(todo(""))
// }
//
// func X__sincos_stret(*TLS, float64) X__double2 {
// 	panic(todo(""))
// }
//
// func X__sincospif_stret(*TLS, float32) X__float2 {
// 	panic(todo(""))
// }
//
// func X__sincospi_stret(*TLS, float64) X__double2 {
// 	panic(todo(""))
// }

// ssize_t pwrite(int fd, const void *buf, size_t count, off_t offset);
func Xpwrite(t *TLS, fd int32, buf uintptr, count types.Size_t, offset types.Off_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v offset=%v, (%v:)", t, fd, buf, count, offset, origin(2))
	}
	var n int
	var err error
	switch {
	case count == 0:
		n, err = unix.Pwrite(int(fd), nil, int64(offset))
	default:
		n, err = unix.Pwrite(int(fd), (*RawMem)(unsafe.Pointer(buf))[:count:count], int64(offset))
		if dmesgs {
			dmesg("%v: fd %v, off %#x, count %#x\n%s", origin(1), fd, offset, count, hex.Dump((*RawMem)(unsafe.Pointer(buf))[:count:count]))
		}
	}
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return types.Ssize_t(n)
}

// char***_NSGetEnviron()
func X_NSGetEnviron(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return EnvironP()
}

// int chflags(const char *path, u_int flags);
func Xchflags(t *TLS, path uintptr, flags uint32) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v flags=%v, (%v:)", t, path, flags, origin(2))
	}
	if err := unix.Chflags(GoString(path), int(flags)); err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// int rmdir(const char *pathname);
func Xrmdir(t *TLS, pathname uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v, (%v:)", t, pathname, origin(2))
	}
	if err := unix.Rmdir(GoString(pathname)); err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// uint64_t mach_absolute_time(void);
func Xmach_absolute_time(t *TLS) uint64 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return uint64(gotime.Now().UnixNano())
}

// See https://developer.apple.com/library/archive/qa/qa1398/_index.html
type machTimebaseInfo = struct {
	Fnumer uint32
	Fdenom uint32
} /* mach_time.h:36:1 */

// kern_return_t mach_timebase_info(mach_timebase_info_t info);
func Xmach_timebase_info(t *TLS, info uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v info=%v, (%v:)", t, info, origin(2))
	}
	*(*machTimebaseInfo)(unsafe.Pointer(info)) = machTimebaseInfo{Fnumer: 1, Fdenom: 1}
	return 0
}

// int getattrlist(const char* path, struct attrlist * attrList, void * attrBuf, size_t attrBufSize, unsigned long options);
func Xgetattrlist(t *TLS, path, attrList, attrBuf uintptr, attrBufSize types.Size_t, options uint32) int32 {
	if __ccgo_strace {
		trc("t=%v attrBuf=%v attrBufSize=%v options=%v, (%v:)", t, attrBuf, attrBufSize, options, origin(2))
	}
	if _, _, err := unix.Syscall6(unix.SYS_GETATTRLIST, path, attrList, attrBuf, uintptr(attrBufSize), uintptr(options), 0); err != 0 { // Cannot avoid the syscall here.
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// int setattrlist(const char* path, struct attrlist * attrList, void * attrBuf, size_t attrBufSize, unsigned long options);
func Xsetattrlist(t *TLS, path, attrList, attrBuf uintptr, attrBufSize types.Size_t, options uint32) int32 {
	if __ccgo_strace {
		trc("t=%v attrBuf=%v attrBufSize=%v options=%v, (%v:)", t, attrBuf, attrBufSize, options, origin(2))
	}
	if _, _, err := unix.Syscall6(unix.SYS_SETATTRLIST, path, attrList, attrBuf, uintptr(attrBufSize), uintptr(options), 0); err != 0 { // Cannot avoid the syscall here.
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// int copyfile(const char *from, const char *to, copyfile_state_t state, copyfile_flags_t flags);
func Xcopyfile(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// int truncate(const char *path, off_t length);
func Xtruncate(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

type darwinDir struct {
	buf [4096]byte
	fd  int
	h   int
	l   int

	eof bool
}

// DIR *opendir(const char *name);
func Xopendir(t *TLS, name uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v name=%v, (%v:)", t, name, origin(2))
	}
	p := Xmalloc(t, uint64(unsafe.Sizeof(darwinDir{})))
	if p == 0 {
		panic("OOM")
	}

	fd := int(Xopen(t, name, fcntl.O_RDONLY|fcntl.O_DIRECTORY|fcntl.O_CLOEXEC, 0))
	if fd < 0 {
		if dmesgs {
			dmesg("%v: FAIL %v", origin(1), (*darwinDir)(unsafe.Pointer(p)).fd)
		}
		Xfree(t, p)
		// trc("==== opendir: %#x", 0)
		return 0
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	(*darwinDir)(unsafe.Pointer(p)).fd = fd
	(*darwinDir)(unsafe.Pointer(p)).h = 0
	(*darwinDir)(unsafe.Pointer(p)).l = 0
	(*darwinDir)(unsafe.Pointer(p)).eof = false
	// trc("==== opendir: %#x", p)
	return p
}

// struct dirent *readdir(DIR *dirp);
func Xreaddir(t *TLS, dir uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v dir=%v, (%v:)", t, dir, origin(2))
	}
	if (*darwinDir)(unsafe.Pointer(dir)).eof {
		return 0
	}

	// trc(".... readdir %#x: l %v, h %v", dir, (*darwinDir)(unsafe.Pointer(dir)).l, (*darwinDir)(unsafe.Pointer(dir)).h)
	if (*darwinDir)(unsafe.Pointer(dir)).l == (*darwinDir)(unsafe.Pointer(dir)).h {
		n, err := unix.Getdirentries((*darwinDir)(unsafe.Pointer(dir)).fd, (*darwinDir)(unsafe.Pointer(dir)).buf[:], nil)
		// trc("must read: %v %v", n, err)
		if n == 0 {
			if err != nil && err != io.EOF {
				if dmesgs {
					dmesg("%v: %v FAIL", origin(1), err)
				}
				t.setErrno(err)
			}
			(*darwinDir)(unsafe.Pointer(dir)).eof = true
			return 0
		}

		(*darwinDir)(unsafe.Pointer(dir)).l = 0
		(*darwinDir)(unsafe.Pointer(dir)).h = n
		// trc("new l %v, h %v", (*darwinDir)(unsafe.Pointer(dir)).l, (*darwinDir)(unsafe.Pointer(dir)).h)
	}
	de := dir + unsafe.Offsetof(darwinDir{}.buf) + uintptr((*darwinDir)(unsafe.Pointer(dir)).l)
	// trc("dir %#x de %#x", dir, de)
	(*darwinDir)(unsafe.Pointer(dir)).l += int((*unix.Dirent)(unsafe.Pointer(de)).Reclen)
	// trc("final l %v, h %v", (*darwinDir)(unsafe.Pointer(dir)).l, (*darwinDir)(unsafe.Pointer(dir)).h)
	return de
}

func Xclosedir(t *TLS, dir uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v dir=%v, (%v:)", t, dir, origin(2))
	}
	// trc("---- closedir: %#x", dir)
	r := Xclose(t, int32((*darwinDir)(unsafe.Pointer(dir)).fd))
	Xfree(t, dir)
	return r
}

// int pipe(int pipefd[2]);
func Xpipe(t *TLS, pipefd uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pipefd=%v, (%v:)", t, pipefd, origin(2))
	}
	var a [2]int
	if err := unix.Pipe(a[:]); err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	*(*[2]int32)(unsafe.Pointer(pipefd)) = [2]int32{int32(a[0]), int32(a[1])}
	if dmesgs {
		dmesg("%v: %v ok", origin(1), a)
	}
	return 0
}

// int __isoc99_sscanf(const char *str, const char *format, ...);
func X__isoc99_sscanf(t *TLS, str, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	r := scanf(strings.NewReader(GoString(str)), format, va)
	// if dmesgs {
	// 	dmesg("%v: %q %q: %d", origin(1), GoString(str), GoString(format), r)
	// }
	return r
}

// int sscanf(const char *str, const char *format, ...);
func Xsscanf(t *TLS, str, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	r := scanf(strings.NewReader(GoString(str)), format, va)
	// if dmesgs {
	// 	dmesg("%v: %q %q: %d", origin(1), GoString(str), GoString(format), r)
	// }
	return r
}

// int posix_fadvise(int fd, off_t offset, off_t len, int advice);
func Xposix_fadvise(t *TLS, fd int32, offset, len types.Off_t, advice int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v len=%v advice=%v, (%v:)", t, fd, len, advice, origin(2))
	}
	panic(todo(""))
}

// clock_t clock(void);
func Xclock(t *TLS) time.Clock_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return time.Clock_t(gotime.Since(startTime) * gotime.Duration(time.CLOCKS_PER_SEC) / gotime.Second)
}

// int iswspace(wint_t wc);
func Xiswspace(t *TLS, wc wctype.Wint_t) int32 {
	if __ccgo_strace {
		trc("t=%v wc=%v, (%v:)", t, wc, origin(2))
	}
	return Bool32(unicode.IsSpace(rune(wc)))
}

// int iswalnum(wint_t wc);
func Xiswalnum(t *TLS, wc wctype.Wint_t) int32 {
	if __ccgo_strace {
		trc("t=%v wc=%v, (%v:)", t, wc, origin(2))
	}
	return Bool32(unicode.IsLetter(rune(wc)) || unicode.IsNumber(rune(wc)))
}

// void arc4random_buf(void *buf, size_t nbytes);
func Xarc4random_buf(t *TLS, buf uintptr, buflen size_t) {
	if __ccgo_strace {
		trc("t=%v buf=%v buflen=%v, (%v:)", t, buf, buflen, origin(2))
	}
	if _, err := crand.Read((*RawMem)(unsafe.Pointer(buf))[:buflen]); err != nil {
		panic(todo(""))
	}
}

type darwin_mutexattr_t struct {
	sig int64
	x   [8]byte
}

type darwin_mutex_t struct {
	sig int64
	x   [65]byte
}

func X__ccgo_pthreadMutexattrGettype(tls *TLS, a uintptr) int32 {
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return (int32((*darwin_mutexattr_t)(unsafe.Pointer(a)).x[4] >> 2 & 3))
}

func X__ccgo_getMutexType(tls *TLS, m uintptr) int32 {
	if __ccgo_strace {
		trc("tls=%v m=%v, (%v:)", tls, m, origin(2))
	}
	return (int32((*darwin_mutex_t)(unsafe.Pointer(m)).x[4] >> 2 & 3))
}

func X__ccgo_pthreadAttrGetDetachState(tls *TLS, a uintptr) int32 {
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return (*pthreadAttr)(unsafe.Pointer(a)).detachState
}

func Xpthread_attr_getdetachstate(tls *TLS, a uintptr, state uintptr) int32 {
	if __ccgo_strace {
		trc("tls=%v a=%v state=%v, (%v:)", tls, a, state, origin(2))
	}
	panic(todo(""))
}

func Xpthread_attr_setdetachstate(tls *TLS, a uintptr, state int32) (r int32) {
	if uint32(state) > 1 {
		return errno.EINVAL
	}

	(*pthreadAttr)(unsafe.Pointer(a)).detachState = state
	return 0
}

func Xpthread_mutexattr_destroy(tls *TLS, a uintptr) int32 {
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return 0
}

func Xpthread_mutexattr_init(tls *TLS, a uintptr) int32 {
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	*(*darwin_mutexattr_t)(unsafe.Pointer(a)) = darwin_mutexattr_t{}
	return 0
}

func Xpthread_mutexattr_settype(tls *TLS, a uintptr, type1 int32) int32 {
	if __ccgo_strace {
		trc("tls=%v a=%v type1=%v, (%v:)", tls, a, type1, origin(2))
	}
	if uint32(type1) > uint32(2) {
		return errno.EINVAL
	}
	(*darwin_mutexattr_t)(unsafe.Pointer(a)).x[4] = byte(type1 << 2)
	return 0
}

// ssize_t writev(int fd, const struct iovec *iov, int iovcnt);
func Xwritev(t *TLS, fd int32, iov uintptr, iovcnt int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v iov=%v iovcnt=%v, (%v:)", t, fd, iov, iovcnt, origin(2))
	}
	// if dmesgs {
	// 	dmesg("%v: fd %v iov %#x iovcnt %v", origin(1), fd, iov, iovcnt)
	// }
	r, _, err := unix.Syscall(unix.SYS_WRITEV, uintptr(fd), iov, uintptr(iovcnt))
	if err != 0 {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	return types.Ssize_t(r)
}

// int pause(void);
func Xpause(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	c := make(chan os.Signal)
	gosignal.Notify(c,
		unix.SIGABRT,
		unix.SIGALRM,
		unix.SIGBUS,
		unix.SIGCHLD,
		unix.SIGCONT,
		unix.SIGFPE,
		unix.SIGHUP,
		unix.SIGILL,
		// unix.SIGINT,
		unix.SIGIO,
		unix.SIGIOT,
		unix.SIGKILL,
		unix.SIGPIPE,
		unix.SIGPROF,
		unix.SIGQUIT,
		unix.SIGSEGV,
		unix.SIGSTOP,
		unix.SIGSYS,
		unix.SIGTERM,
		unix.SIGTRAP,
		unix.SIGTSTP,
		unix.SIGTTIN,
		unix.SIGTTOU,
		unix.SIGURG,
		unix.SIGUSR1,
		unix.SIGUSR2,
		unix.SIGVTALRM,
		unix.SIGWINCH,
		unix.SIGXCPU,
		unix.SIGXFSZ,
	)
	switch <-c {
	case unix.SIGINT:
		panic(todo(""))
	default:
		t.setErrno(errno.EINTR)
		return -1
	}
}

// #define __DARWIN_FD_SETSIZE     1024
// #define __DARWIN_NFDBITS        (sizeof(__int32_t) * __DARWIN_NBBY) /* bits per mask */
// #define __DARWIN_NBBY           8                               /* bits in a byte */
// #define __DARWIN_howmany(x, y)  ((((x) % (y)) == 0) ? ((x) / (y)) : (((x) / (y)) + 1)) /* # y's == x bits? */

// typedef struct fd_set {
//         __int32_t       fds_bits[__DARWIN_howmany(__DARWIN_FD_SETSIZE, __DARWIN_NFDBITS)];
// } fd_set;

// __darwin_fd_set(int _fd, struct fd_set *const _p)
//
//	{
//	        (_p->fds_bits[(unsigned long)_fd / __DARWIN_NFDBITS] |= ((__int32_t)(((unsigned long)1) << ((unsigned long)_fd % __DARWIN_NFDBITS))));
//	}
func X__darwin_fd_set(tls *TLS, _fd int32, _p uintptr) int32 { /* main.c:12:1: */
	if __ccgo_strace {
		trc("tls=%v _fd=%v _p=%v, (%v:)", tls, _fd, _p, origin(2))
	}
	*(*int32)(unsafe.Pointer(_p + uintptr(uint64(_fd)/(uint64(unsafe.Sizeof(int32(0)))*uint64(8)))*4)) |= int32(uint64(uint64(1)) << (uint64(_fd) % (uint64(unsafe.Sizeof(int32(0))) * uint64(8))))
	return int32(0)
}

// __darwin_fd_isset(int _fd, const struct fd_set *_p)
//
//	{
//	        return _p->fds_bits[(unsigned long)_fd / __DARWIN_NFDBITS] & ((__int32_t)(((unsigned long)1) << ((unsigned long)_fd % __DARWIN_NFDBITS)));
//	}
func X__darwin_fd_isset(tls *TLS, _fd int32, _p uintptr) int32 { /* main.c:17:1: */
	if __ccgo_strace {
		trc("tls=%v _fd=%v _p=%v, (%v:)", tls, _fd, _p, origin(2))
	}
	return *(*int32)(unsafe.Pointer(_p + uintptr(uint64(_fd)/(uint64(unsafe.Sizeof(int32(0)))*uint64(8)))*4)) & int32(uint64(uint64(1))<<(uint64(_fd)%(uint64(unsafe.Sizeof(int32(0)))*uint64(8))))
}

// __darwin_fd_clr(int _fd, struct fd_set *const _p)
//
//	{
//	        (_p->fds_bits[(unsigned long)_fd / __DARWIN_NFDBITS] &= ~((__int32_t)(((unsigned long)1) << ((unsigned long)_fd % __DARWIN_NFDBITS))));
//	}
func X__darwin_fd_clr(tls *TLS, _fd int32, _p uintptr) int32 { /* main.c:22:1: */
	if __ccgo_strace {
		trc("tls=%v _fd=%v _p=%v, (%v:)", tls, _fd, _p, origin(2))
	}
	*(*int32)(unsafe.Pointer(_p + uintptr(uint64(_fd)/(uint64(unsafe.Sizeof(int32(0)))*uint64(8)))*4)) &= ^int32(uint64(uint64(1)) << (uint64(_fd) % (uint64(unsafe.Sizeof(int32(0))) * uint64(8))))
	return int32(0)
}

// int ungetc(int c, FILE *stream);
func Xungetc(t *TLS, c int32, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v stream=%v, (%v:)", t, c, stream, origin(2))
	}
	panic(todo(""))
}

// int issetugid(void);
func Xissetugid(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

var progname uintptr

// const char *getprogname(void);
func Xgetprogname(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	if progname != 0 {
		return progname
	}

	var err error
	progname, err = CString(filepath.Base(os.Args[0]))
	if err != nil {
		t.setErrno(err)
		return 0
	}

	return progname
}

// void uuid_copy(uuid_t dst, uuid_t src);
func Xuuid_copy(t *TLS, dst, src uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v, (%v:)", t, src, origin(2))
	}
	*(*uuid.Uuid_t)(unsafe.Pointer(dst)) = *(*uuid.Uuid_t)(unsafe.Pointer(src))
}

// int uuid_parse( char *in, uuid_t uu);
func Xuuid_parse(t *TLS, in uintptr, uu uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v in=%v uu=%v, (%v:)", t, in, uu, origin(2))
	}
	r, err := guuid.Parse(GoString(in))
	if err != nil {
		return -1
	}

	copy((*RawMem)(unsafe.Pointer(uu))[:unsafe.Sizeof(uuid.Uuid_t{})], r[:])
	return 0
}

// struct __float2 { float __sinval; float __cosval; };

// struct __float2 __sincosf_stret(float);
func X__sincosf_stret(t *TLS, f float32) struct{ F__sinval, F__cosval float32 } {
	panic(todo(""))
}

// struct __double2 { double __sinval; double __cosval; };

// struct __double2 __sincos_stret(double);
func X__sincos_stret(t *TLS, f float64) struct{ F__sinval, F__cosval float64 } {
	panic(todo(""))
}

// struct __float2 __sincospif_stret(float);
func X__sincospif_stret(t *TLS, f float32) struct{ F__sinval, F__cosval float32 } {
	panic(todo(""))
}

// struct _double2 __sincospi_stret(double);
func X__sincospi_stret(t *TLS, f float64) struct{ F__sinval, F__cosval float64 } {
	panic(todo(""))
}

// int	__srget(FILE *);
func X__srget(t *TLS, f uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v f=%v, (%v:)", t, f, origin(2))
	}
	panic(todo(""))
}

// int	__svfscanf(FILE *, const char *, va_list) __scanflike(2, 0);
func X__svfscanf(t *TLS, f uintptr, p, q uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v f=%v q=%v, (%v:)", t, f, q, origin(2))
	}
	panic(todo(""))
}

// int	__swbuf(int, FILE *);
func X__swbuf(t *TLS, i int32, f uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v i=%v f=%v, (%v:)", t, i, f, origin(2))
	}
	panic(todo(""))
}

// int nanosleep(const struct timespec *req, struct timespec *rem);
func Xnanosleep(t *TLS, req, rem uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v rem=%v, (%v:)", t, rem, origin(2))
	}
	v := *(*time.Timespec)(unsafe.Pointer(req))
	gotime.Sleep(gotime.Second*gotime.Duration(v.Ftv_sec) + gotime.Duration(v.Ftv_nsec))
	return 0
}

// // void malloc_set_zone_name(malloc_zone_t *zone, const char *name)
// func Xmalloc_set_zone_name(t *TLS, zone, name uintptr) {
// 	if __ccgo_strace {
// 		trc("t=%v zone=%v name=%v, (%v:)", t, zone, name, origin(2))
// 	}
// 	// nop
// }

// size_t malloc_size(const void *ptr);
func Xmalloc_size(t *TLS, p uintptr) (r types.Size_t) {
	if __ccgo_strace {
		trc("t=%v p=%v, (%v:)", t, p, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if p == 0 {
		return 0
	}

	allocMu.Lock()

	defer allocMu.Unlock()

	return types.Size_t(memory.UintptrUsableSize(p))
}

// int open(const char *pathname, int flags, ...);
func Xopen64(t *TLS, pathname uintptr, flags int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v flags=%v args=%v, (%v:)", t, pathname, flags, args, origin(2))
	}
	var mode types.Mode_t
	if args != 0 {
		mode = (types.Mode_t)(VaUint32(&args))
	}
	fdcwd := fcntl.AT_FDCWD
	n, _, err := unix.Syscall6(unix.SYS_OPENAT, uintptr(fdcwd), pathname, uintptr(flags), uintptr(mode), 0, 0)
	if err != 0 {
		// if dmesgs {
		// 	dmesg("%v: %q %#x: %v", origin(1), GoString(pathname), flags, err)
		// }
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %q flags %#x mode %#o: fd %v", origin(1), GoString(pathname), flags, mode, n)
	// }
	return int32(n)
}

// int getrlimit(int resource, struct rlimit *rlim);
func Xgetrlimit(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_GETRLIMIT, uintptr(resource), uintptr(rlim), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int setrlimit(int resource, const struct rlimit *rlim);
func Xsetrlimit(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_SETRLIMIT, uintptr(resource), uintptr(rlim), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

func X__fpclassifyd(tls *TLS, x float64) (r int32) {
	return X__fpclassify(tls, x)
}

var Xin6addr_any = in6_addr{}

func X__builtin_lround(tls *TLS, x float64) (r long) {
	return Xlround(tls, x)
}

func Xlround(tls *TLS, x float64) (r long) {
	return long(Xround(tls, x))
}

// https://g.co/gemini/share/2c37d5b57994

// Constants mirroring C's ftw type flags
const (
	FTW_F   = 0 // Regular file
	FTW_D   = 1 // Directory (visited pre-order)
	FTW_DNR = 2 // Directory that cannot be read
	FTW_NS  = 4 // Stat failed (permissions, broken link, etc.)
	FTW_SL  = 4 // Symbolic link (lstat was used)
	// Note: C's ftw might have other flags like FTW_DP (post-order dir) or FTW_SLN
	// which are not directly supported by filepath.WalkDir's simple pre-order traversal.
	// This emulation focuses on the most common flags associated with stat/lstat results.
)

// ftwStopError is used internally to signal that the walk should stop
// because the user callback returned a non-zero value.
type ftwStopError struct {
	stopValue int
}

func (e *ftwStopError) Error() string {
	return fmt.Sprintf("ftw walk stopped by callback with return value %d", e.stopValue)
}

// goFtwFunc is the callback function type, mirroring the C ftw callback.
// It receives the path, file info (if available), and a type flag.
// Returning a non-zero value stops the walk and becomes the return value of Ftw.
// Returning 0 continues the walk.
type goFtwFunc func(path string, info os.FileInfo, typeflag int) int

// Ftw emulates the C standard library function ftw(3).
// It walks the directory tree starting at 'dirpath' and calls the 'callback'
// function for each entry encountered.
//
// Parameters:
//   - dirpath: The root directory path for the traversal.
//   - callback: The goFtwFunc to call for each file system entry.
//   - nopenfd: This parameter is part of the C ftw signature but is IGNORED
//     in this Go implementation. Go's filepath.WalkDir manages concurrency
//     and file descriptors internally.
//
// Returns:
//   - 0 on successful completion of the walk.
//   - The non-zero value returned by the callback, if the callback terminated the walk.
//   - -1 if an error occurred during the walk that wasn't handled by calling
//     the callback with FTW_DNR or FTW_NS (e.g., error accessing the initial dirpath).
func ftw(dirpath string, callback goFtwFunc, nopenfd int) int {
	// nopenfd is ignored in this Go implementation.

	walkErr := filepath.WalkDir(dirpath, func(path string, d fs.DirEntry, err error) error {
		var info os.FileInfo
		var typeflag int

		// --- Handle errors passed by WalkDir ---
		if err != nil {
			// Check if the error is related to accessing a directory
			if errors.Is(err, fs.ErrPermission) || errors.Is(err, unix.EACCES) { // Added syscall.EACCES check
				// Try to determine if it's a directory we can't read
				// We might not have 'd' if the error occurred trying to list 'path' contents
				// Let's try a direct Lstat on the path itself if d is nil
				lstatInfo, lstatErr := os.Lstat(path)
				if lstatErr == nil && lstatInfo.IsDir() {
					typeflag = FTW_DNR // Directory, but WalkDir errored (likely reading it)
					info = lstatInfo   // Provide the info we could get
				} else {
					// Can't confirm it's a directory, or Lstat itself failed
					typeflag = FTW_NS // Treat as general stat failure
					// info remains nil
				}
			} else {
				// Other errors (e.g., broken symlink during traversal, I/O error)
				typeflag = FTW_NS
				// Attempt to get Lstat info even if WalkDir had an error, maybe it's available
				lstatInfo, _ := os.Lstat(path) // Ignore error here, if it fails info stays nil
				info = lstatInfo
			}
			// Even with errors, call the callback with the path and appropriate flag
			stopVal := callback(path, info, typeflag)
			if stopVal != 0 {
				return &ftwStopError{stopValue: stopVal}
			}
			// If the error was on a directory, returning the error might stop WalkDir
			// from descending. If it was fs.ErrPermission on a dir, WalkDir might
			// pass filepath.SkipDir implicitly or continue depending on implementation.
			// Let's return nil here to *try* to continue the walk for other siblings
			// if the callback didn't stop it. The callback *was* notified.
			// If the error prevents further progress WalkDir will stop anyway.
			return nil // Allow walk to potentially continue elsewhere
		}

		// --- No error from WalkDir, process the DirEntry ---
		info, err = d.Info() // Get FileInfo (like C's stat/lstat result)
		if err != nil {
			// Error getting info for an entry WalkDir *could* list (rare, maybe permissions changed?)
			typeflag = FTW_NS
			// info remains nil
		} else {
			// Determine type flag based on file mode
			mode := info.Mode()
			if mode&fs.ModeSymlink != 0 {
				typeflag = FTW_SL
			} else if mode.IsDir() {
				typeflag = FTW_D // Visited pre-order
			} else if mode.IsRegular() {
				typeflag = FTW_F
			} else {
				// Other types (device, socket, pipe, etc.) - C ftw usually lumps these under FTW_F
				// or might have FTW_NS if stat fails. Let's treat non-dir, non-link, non-regular
				// as FTW_F for simplicity, aligning with common C practice, or FTW_NS if stat failed above.
				// Since we have info here, we know stat didn't fail.
				// Let's be more specific, maybe treat others as FTW_NS? Or stick to FTW_F?
				// C ftw man page isn't super specific about all types. FTW_F seems reasonable.
				typeflag = FTW_F // Treat other valid types as 'files' for simplicity
			}
		}

		// --- Call the user callback ---
		stopVal := callback(path, info, typeflag)
		if stopVal != 0 {
			// User wants to stop the walk
			return &ftwStopError{stopValue: stopVal}
		}

		return nil // Continue walk
	})

	// --- Handle WalkDir's final return value ---
	if walkErr == nil {
		return 0 // Success
	}

	// Check if the error was our custom stop signal
	var stopErr *ftwStopError
	if errors.As(walkErr, &stopErr) {
		return stopErr.stopValue // Return the value from the callback
	}

	// Otherwise, it was an unhandled error during the walk
	// (e.g., initial dirpath access error, or other error not mapped to FTW_NS/DNR)
	return -1 // General error return
}

func Xftw(tls *TLS, path uintptr, fn uintptr, fd_limit int32) (r int32) {
	statp := tls.Alloc(int(unsafe.Sizeof(unix.Stat_t{})))

	defer tls.Free(int(unsafe.Sizeof(unix.Stat_t{})))

	return int32(ftw(
		GoString(path),
		func(path string, info os.FileInfo, typeflag int) int {
			cs, _ := CString(path)

			defer Xfree(tls, cs)

			Xstat(tls, cs, statp)
			return int((*(*func(*TLS, uintptr, uintptr, int32) int32)(unsafe.Pointer(&struct{ uintptr }{fn})))(tls, cs, statp, int32(typeflag)))
		},
		int(fd_limit),
	))
}

func Xexecve(tls *TLS, path uintptr, argv uintptr, envp uintptr) (r int32) {
	goPath := GoString(path)
	var goArgv, goEnvp []string
	for p := *(*uintptr)(unsafe.Pointer(argv)); p != 0; p = *(*uintptr)(unsafe.Pointer(argv)) {
		goArgv = append(goArgv, GoString(p))
		argv += unsafe.Sizeof(uintptr(0))
	}
	for p := *(*uintptr)(unsafe.Pointer(envp)); p != 0; p = *(*uintptr)(unsafe.Pointer(envp)) {
		goEnvp = append(goEnvp, GoString(p))
		envp += unsafe.Sizeof(uintptr(0))
	}
	if err := unix.Exec(goPath, goArgv, goEnvp); err != nil {
		tls.setErrno(err)
		return -1
	}
	panic("unreachable")
}

func Xsetuid(tls *TLS, uid uint32) (r int32) {
	if __ccgo_strace {
		trc("tls=%v uid=%v, (%v:)", tls, uid, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if err := unix.Setuid(int(uid)); err != nil {
		tls.setErrno(err)
		return -1
	}

	return 0
}

func Xsetgid(tls *TLS, gid uint32) (r int32) {
	if __ccgo_strace {
		trc("tls=%v gid=%v, (%v:)", tls, gid, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if err := unix.Setgid(int(gid)); err != nil {
		tls.setErrno(err)
		return -1
	}

	return 0
}

func Xdup(tls *TLS, fd int32) (r int32) {
	if __ccgo_strace {
		trc("tls=%v fd=%v, (%v:)", tls, fd, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	nfd, err := unix.Dup(int(fd))
	if err != nil {
		tls.setErrno(err)
		return -1
	}

	return int32(nfd)
}

func X__builtin_ctz(t *TLS, n uint32) int32 {
	return int32(mbits.TrailingZeros32(n))
}
