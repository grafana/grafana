// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	gotime "time"
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
	"modernc.org/libc/stdio"
	"modernc.org/libc/sys/socket"
	"modernc.org/libc/sys/stat"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/termios"
	"modernc.org/libc/time"
	"modernc.org/libc/unistd"
	"modernc.org/libc/utime"
	"modernc.org/libc/uuid"
)

var (
	startTime    = gotime.Now() // For clock(3)
	in6_addr_any in.In6_addr
)

type Tsize_t = types.Size_t

type syscallErrno = unix.Errno

// // Keep these outside of the var block otherwise go generate will miss them.
var X__stderrp = Xstdout
var X__stdinp = Xstdin
var X__stdoutp = Xstdout
var X__sF [3]stdio.FILE
var X_tolower_tab_ uintptr
var X_toupper_tab_ uintptr

func init() {
	// fake a TLS since this comes before NewTLS() or Start()
	t := &TLS{errnop: uintptr(unsafe.Pointer(&errno0))}
	X_tolower_tab_ = Xmalloc(t, 2*65537)
	if X_tolower_tab_ == 0 {
		panic("unable to allocate tolower table")
	}

	X_toupper_tab_ = Xmalloc(t, 2*65537)
	if X_tolower_tab_ == 0 {
		panic("unable to allocate toupper table")
	}

	for c := rune(0); c < 0xffff; c++ {
		y := c
		s := strings.ToLower(string(c))
		a := []rune(s)
		if len(a) != 0 {
			y = a[0]
		}
		(*[65536]uint16)(unsafe.Pointer(X_tolower_tab_))[c+1] = uint16(y)
		y = c
		s = strings.ToUpper(string(c))
		a = []rune(s)
		if len(a) != 0 {
			y = a[0]
		}
		(*[65536]uint16)(unsafe.Pointer(X_toupper_tab_))[c+1] = uint16(y)
	}
}

// include/stdio.h:486:extern int __isthreaded;
var X__isthreaded int32

// lib/libc/locale/mblocal.h:62:	int __mb_sb_limit;
var X__mb_sb_limit int32 = 128 // UTF-8

// include/runetype.h:94:extern _Thread_local const _RuneLocale *_ThreadRuneLocale;
var X_ThreadRuneLocale uintptr //TODO initialize and implement _Thread_local semantics.

// include/xlocale/_ctype.h:54:_RuneLocale	*__runes_for_locale(locale_t, int*);
func X__runes_for_locale(t *TLS, l locale_t, p uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v l=%v p=%v, (%v:)", t, l, p, origin(2))
	}
	panic(todo(""))
}

type file uintptr

func (f file) fd() int32      { return int32((*stdio.FILE)(unsafe.Pointer(f)).F_file) }
func (f file) setFd(fd int32) { (*stdio.FILE)(unsafe.Pointer(f)).F_file = int16(fd) }

func (f file) err() bool {
	return (*stdio.FILE)(unsafe.Pointer(f)).F_flags&1 != 0
}

func (f file) setErr() {
	(*stdio.FILE)(unsafe.Pointer(f)).F_flags |= 1
}

func (f file) close(t *TLS) int32 {
	fd := f.fd()
	r := Xclose(t, fd)
	switch fd {
	case unistd.STDIN_FILENO, unistd.STDOUT_FILENO, unistd.STDERR_FILENO:
		X__sF[fd] = stdio.FILE{}
	default:
		Xfree(t, uintptr(f))
	}
	if r < 0 {
		return stdio.EOF
	}

	return 0
}

func newFile(t *TLS, fd int32) uintptr {
	var p uintptr
	switch fd {
	case unistd.STDIN_FILENO:
		p = uintptr(unsafe.Pointer(&X__sF[0]))
	case unistd.STDOUT_FILENO:
		p = uintptr(unsafe.Pointer(&X__sF[1]))
	case unistd.STDERR_FILENO:
		p = uintptr(unsafe.Pointer(&X__sF[2]))
	default:
		if p = Xcalloc(t, 1, types.Size_t(unsafe.Sizeof(stdio.FILE{}))); p == 0 {
			return 0
		}
	}
	file(p).setFd(fd)
	return p
}

func fwrite(fd int32, b []byte) (int, error) {
	if fd == unistd.STDOUT_FILENO {
		return write(b)
	}

	// if dmesgs {
	// 	dmesg("%v: fd %v: %s", origin(1), fd, b)
	// }
	return unix.Write(int(fd), b) //TODO use Xwrite
}

// unsigned long	___runetype(__ct_rune_t) __pure;
func X___runetype(t *TLS, x int32) ulong {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	panic(todo(""))
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
func Xusleep(t *TLS, usec uint32) int32 {
	if __ccgo_strace {
		trc("t=%v usec=%v, (%v:)", t, usec, origin(2))
	}
	gotime.Sleep(gotime.Microsecond * gotime.Duration(usec))
	return 0
}

// int getrusage(int who, struct rusage *usage);
func Xgetrusage(t *TLS, who int32, usage uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v who=%v usage=%v, (%v:)", t, who, usage, origin(2))
	}
	ru := unix.Rusage{}
	if err := unix.Getrusage(int(who), &ru); err != nil {
		t.setErrno(err)
		return -1
	}
	*(*unix.Rusage)(unsafe.Pointer(usage)) = ru
	return 0
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
	return uintptr(unsafe.Pointer(&localtime))
}

// struct tm *localtime_r(const time_t *timep, struct tm *result);
func Xlocaltime_r(_ *TLS, timep, result uintptr) uintptr {
	loc := getLocalLocation()
	ut := *(*time.Time_t)(unsafe.Pointer(timep))
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
	return result
}

// int open(const char *pathname, int flags, ...);
func Xopen(t *TLS, pathname uintptr, flags int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%s flags=%v args=%v, (%v:)", t, GoString(pathname), flags, args, origin(2))
	}
	return Xopen64(t, pathname, flags, args)
}

// int open(const char *pathname, int flags, ...);
func Xopen64(t *TLS, pathname uintptr, flags int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%s flags=%v args=%v, (%v:)", t, GoString(pathname), flags, args, origin(2))
	}
	var mode types.Mode_t
	if args != 0 {
		mode = (types.Mode_t)(VaUint32(&args))
	}
	fd, err := unix.Open(GoString(pathname), int(flags), mode)
	if err != nil {
		if __ccgo_strace {
			trc("%s: %s", err.Error(), GoString(pathname))
		}
		if dmesgs {
			dmesg("%v: %q %#x: %v", origin(1), GoString(pathname), flags, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q flags %#x mode %#o: fd %v", origin(1), GoString(pathname), flags, mode, fd)
	}
	if __ccgo_strace {
		trc("%s fd=%d", GoString(pathname), fd)
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
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %d: ok", origin(1), fd)
	// }
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
	case unistd.X_SC_GETPW_R_SIZE_MAX:
		return -1
	case unistd.X_SC_GETGR_R_SIZE_MAX:
		return -1
	case unistd.X_SC_NPROCESSORS_ONLN:
		return long(runtime.NumCPU())
	}

	panic(todo("", name))
}

// int close(int fd);
func Xclose(t *TLS, fd int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}
	if err := unix.Close(int(fd)); err != nil {
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %d: ok", origin(1), fd)
	// }
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
		dmesg("%v: fd %d length %#0x: ok", origin(1), fd, length)
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
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %d %#o: ok", origin(1), fd, mode)
	// }
	return 0
}

// int fchown(int fd, uid_t owner, gid_t group);
func Xfchown(t *TLS, fd int32, owner types.Uid_t, group types.Gid_t) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v owner=%v group=%v, (%v:)", t, fd, owner, group, origin(2))
	}
	if err := unix.Fchown(int(fd), int(owner), int(group)); err != nil {
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
	n := unix.Geteuid()
	return types.Uid_t(n)
}

// int munmap(void *addr, size_t length);
func Xmunmap(t *TLS, addr uintptr, length types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v, (%v:)", t, addr, length, origin(2))
	}
	b := unsafe.Slice((*byte)(unsafe.Pointer(addr)), length)
	if err := unix.Munmap(b); err != nil {
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
		panic(todo("", "will fail on OpenBSD 7.5"))
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
		panic(todo("", "will fail on OpenBSD 7.5"))
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
		panic(todo("", "will fail on OpenBSD 7.5"))
		return -1
	}

	return int32(n)
}

// int getsockname(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
func Xgetsockname(t *TLS, sockfd int32, addr, addrlen uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addrlen=%v, (%v:)", t, sockfd, addrlen, origin(2))
	}
	sn, err := unix.Getsockname(int(sockfd))
	if err != nil {
		if dmesgs {
			dmesg("%v: fd %v: %v", origin(1), sockfd, err)
		}
		t.setErrno(err)
		return -1
	}
	*(*unix.Sockaddr)(unsafe.Pointer(addr)) = sn
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
		t.setErrno(err)
		return -1
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

// int execvp(const char *file, char *const argv[]);
func Xexecvp(t *TLS, file, argv uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v argv=%v, (%v:)", t, argv, origin(2))
	}
	if err := unix.Exec(GoString(file), getVaList(argv), GetEnviron()); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// pid_t waitpid(pid_t pid, int *wstatus, int options);
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
	p := make([]byte, len)
	n, _, err := unix.Recvfrom(int(sockfd), p, int(flags))
	if err != nil {
		t.setErrno(err)
		return -1
	}
	copy((*RawMem)(unsafe.Pointer(buf))[:n:n], p[:])
	return types.Ssize_t(n)
}

// ssize_t send(int sockfd, const void *buf, size_t len, int flags);
func Xsend(t *TLS, sockfd int32, buf uintptr, len types.Size_t, flags int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v sockfd=%v buf=%v len=%v flags=%v, (%v:)", t, sockfd, buf, len, flags, origin(2))
	}

	p := unsafe.Slice((*byte)(unsafe.Pointer(buf)), len)
	if err := unix.Send(int(sockfd), p, int(flags)); err != nil {
		t.setErrno(err)
		return -1
	}

	return types.Ssize_t(len)
}

// int shutdown(int sockfd, int how);
func Xshutdown(t *TLS, sockfd, how int32) int32 {
	if __ccgo_strace {
		trc("t=%v how=%v, (%v:)", t, how, origin(2))
	}
	if err := unix.Shutdown(int(sockfd), int(how)); err != nil {
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
	sa, err := unix.Getpeername(int(sockfd))
	if err != nil {
		t.setErrno(err)
		return -1
	}
	if __ccgo_strace {
		trc("sa=%v", sa)
	}

	panic(todo(""))
	// populate addr & addrlen from sa
	// , addr, uintptr(addrlen))

	return 0
}

// int socket(int domain, int type, int protocol);
func Xsocket(t *TLS, domain, type1, protocol int32) int32 {
	if __ccgo_strace {
		trc("t=%v protocol=%v, (%v:)", t, protocol, origin(2))
	}
	fd, err := unix.Socket(int(domain), int(type1), int(protocol))
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return int32(fd)
}

// int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
func Xbind(t *TLS, sockfd int32, addr uintptr, addrlen uint32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	if err := unix.Bind(int(sockfd), *(*unix.Sockaddr)(unsafe.Pointer(addr))); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
func Xconnect(t *TLS, sockfd int32, addr uintptr, addrlen uint32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	if err := unix.Connect(int(sockfd), *(*unix.Sockaddr)(unsafe.Pointer(addr))); err != nil {
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
	if err := unix.Listen(int(sockfd), int(backlog)); err != nil {
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

	nfd, sa, err := unix.Accept(int(sockfd))
	if err != nil {
		t.setErrno(err)
		return -1
	}
	if __ccgo_strace {
		trc("sa=%v", sa)
	}

	panic(todo(""))
	// populate addr, addrlen from sa
	return int32(nfd)
}

// int getrlimit(int resource, struct rlimit *rlim);
func Xgetrlimit(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	return Xgetrlimit64(t, resource, rlim)
}

// int setrlimit(int resource, const struct rlimit *rlim);
func Xsetrlimit(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	return Xsetrlimit64(t, resource, rlim)
}

// int setrlimit(int resource, const struct rlimit *rlim);
func Xsetrlimit64(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	if err := unix.Setrlimit(int(resource), (*unix.Rlimit)(unsafe.Pointer(rlim))); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// uid_t getuid(void);
func Xgetuid(t *TLS) types.Uid_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return types.Uid_t(os.Getuid())
}

// pid_t getpid(void);
func Xgetpid(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return int32(os.Getpid())
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

// int backtrace(void **buffer, int size);
func Xbacktrace(t *TLS, buf uintptr, size int32) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v size=%v, (%v:)", t, buf, size, origin(2))
	}
	panic(todo(""))
}

// void backtrace_symbols_fd(void *const *buffer, int size, int fd);
func Xbacktrace_symbols_fd(t *TLS, buffer uintptr, size, fd int32) {
	if __ccgo_strace {
		trc("t=%v buffer=%v fd=%v, (%v:)", t, buffer, fd, origin(2))
	}
	panic(todo(""))
}

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
	return Xfts64_open(t, path_argv, options, compar)
}

// FTS *fts_open(char * const *path_argv, int options, int (*compar)(const FTSENT **, const FTSENT **));
func Xfts64_open(t *TLS, path_argv uintptr, options int32, compar uintptr) uintptr {
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
	return Xfts64_read(t, ftsp)
}

// FTSENT *fts_read(FTS *ftsp);
func Xfts64_read(t *TLS, ftsp uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v ftsp=%v, (%v:)", t, ftsp, origin(2))
	}
	f := getObject(ftsp).(*ftstream)
	if f.x == len(f.s) {
		t.setErrno(0)
		return 0
	}

	r := f.s[f.x]
	if e := (*fts.FTSENT)(unsafe.Pointer(r)).Ffts_errno; e != 0 {
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
	return Xfts64_close(t, ftsp)
}

// int fts_close(FTS *ftsp);
func Xfts64_close(t *TLS, ftsp uintptr) int32 {
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
	if dmesgs {
		dmesg("%v: %v\n%s", origin(1), errnum, debug.Stack())
	}
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

var gai_strerrorBuf [100]byte

// const char *gai_strerror(int errcode);
func Xgai_strerror(t *TLS, errcode int32) uintptr {
	if __ccgo_strace {
		trc("t=%v errcode=%v, (%v:)", t, errcode, origin(2))
	}
	copy(gai_strerrorBuf[:], fmt.Sprintf("gai error %d\x00", errcode))
	return uintptr(unsafe.Pointer(&gai_strerrorBuf))
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
func Xcfsetospeed(t *TLS, termios_p uintptr, speed uint32) int32 {
	if __ccgo_strace {
		trc("t=%v termios_p=%v speed=%v, (%v:)", t, termios_p, speed, origin(2))
	}
	panic(todo(""))
}

// int cfsetispeed(struct termios *termios_p, speed_t speed);
func Xcfsetispeed(t *TLS, termios_p uintptr, speed uint32) int32 {
	if __ccgo_strace {
		trc("t=%v termios_p=%v speed=%v, (%v:)", t, termios_p, speed, origin(2))
	}
	panic(todo(""))
}

// pid_t fork(void);
func Xfork(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
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
			// if dmesgs {
			// 	dmesg("%v: %q: %v", origin(1), GoString(path), err)
			// }
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
	return uintptr(unsafe.Pointer(&in6_addr_any))
}

func Xabort(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo("")) //TODO
	// if dmesgs {
	// 	dmesg("%v:", origin(1))
	// }
	// p := Xcalloc(t, 1, types.Size_t(unsafe.Sizeof(signal.Sigaction{})))
	// if p == 0 {
	// 	panic("OOM")
	// }

	// (*signal.Sigaction)(unsafe.Pointer(p)).F__sigaction_u.F__sa_handler = signal.SIG_DFL
	// Xsigaction(t, signal.SIGABRT, p, 0)
	// Xfree(t, p)
	// unix.Kill(unix.Getpid(), unix.Signal(signal.SIGABRT))
	// panic(todo("unrechable"))
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
		trc("t=%v ptr=%+v nmemb=%d stream=%v, (%v:)", t, unsafe.Slice((*byte)(unsafe.Pointer(ptr)), nmemb), nmemb, *(*int32)(unsafe.Pointer(stream)), origin(2))
	}
	buf := unsafe.Slice((*byte)(unsafe.Pointer(ptr)), nmemb*size)
	m, err := unix.Read(int(file(stream).fd()), buf)
	if err != nil {
		file(stream).setErr()
		return 0
	}

	if dmesgs {
		// 	// dmesg("%v: %d %#x x %#x: %#x\n%s", origin(1), file(stream).fd(), size, nmemb, types.Size_t(m)/size, hex.Dump(GoBytes(ptr, int(m))))
		dmesg("%v: %d %#x x %#x: %#x", origin(1), file(stream).fd(), size, nmemb, types.Size_t(m)/size)
	}
	return types.Size_t(m) / size
}

// size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *stream);
func Xfwrite(t *TLS, ptr uintptr, size, nmemb types.Size_t, stream uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v ptr=%v nmemb=%v stream=%v, (%v:)", t, ptr, nmemb, stream, origin(2))
	}
	buf := unsafe.Slice((*byte)(unsafe.Pointer(ptr)), nmemb*size)
	m, err := unix.Write(int(file(stream).fd()), buf)
	if err != nil {
		file(stream).setErr()
		return 0
	}

	// if dmesgs {
	// 	// dmesg("%v: %d %#x x %#x: %#x\n%s", origin(1), file(stream).fd(), size, nmemb, types.Size_t(m)/size, hex.Dump(GoBytes(ptr, int(m))))
	// 	dmesg("%v: %d %#x x %#x: %#x", origin(1), file(stream).fd(), size, nmemb, types.Size_t(m)/size)
	// }
	return types.Size_t(m) / size
}

// int fclose(FILE *stream);
func Xfclose(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	return file(stream).close(t)
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
		// if dmesgs {
		// 	dmesg("%v: fd %v, off %#x, whence %v: %v", origin(1), file(stream).fd(), offset, whenceStr(whence), n)
		// }
		file(stream).setErr()
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: fd %v, off %#x, whence %v: ok", origin(1), file(stream).fd(), offset, whenceStr(whence))
	// }
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

	// if dmesgs {
	// 	dmesg("%v: fd %v, n %#x: ok %#x", origin(1), file(stream).fd(), n, long(n))
	// }
	return long(n)
}

// int ferror(FILE *stream);
func Xferror(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	return Bool32(file(stream).err())
}

// int ungetc(int c, FILE *stream);
func Xungetc(t *TLS, c int32, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v stream=%v, (%v:)", t, c, stream, origin(2))
	}
	panic(todo(""))
}

// int fscanf(FILE *stream, const char *format, ...);
func Xfscanf(t *TLS, stream, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	panic(todo(""))
}

// int fputs(const char *s, FILE *stream);
func Xfputs(t *TLS, s, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	buf := unsafe.Slice((*byte)(unsafe.Pointer(s)), uintptr(Xstrlen(t, s)))
	if _, err := unix.Write(int(file(stream).fd()), buf); err != nil {
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
		// if dmesgs {
		// 	dmesg("%q %q: nil (protoent %+v)", GoString(name), GoString(proto), protoent)
		// }
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

func Xreaddir64(t *TLS, dir uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v dir=%v, (%v:)", t, dir, origin(2))
	}
	return Xreaddir(t, dir)
}

func __syscall(r, _ uintptr, errno syscallErrno) long {
	if errno != 0 {
		return long(-errno)
	}

	return long(r)
}

func X__syscall1(t *TLS, trap, p1 long) long {
	if __ccgo_strace {
		trc("t=%v p1=%v, (%v:)", t, p1, origin(2))
	}
	return __syscall(unix.Syscall(uintptr(trap), uintptr(p1), 0, 0))
}

func X__syscall3(t *TLS, trap, p1, p2, p3 long) long {
	if __ccgo_strace {
		trc("t=%v p3=%v, (%v:)", t, p3, origin(2))
	}
	return __syscall(unix.Syscall(uintptr(trap), uintptr(p1), uintptr(p2), uintptr(p3)))
}

func X__syscall4(t *TLS, trap, p1, p2, p3, p4 long) long {
	if __ccgo_strace {
		trc("t=%v p4=%v, (%v:)", t, p4, origin(2))
	}
	return __syscall(unix.Syscall6(uintptr(trap), uintptr(p1), uintptr(p2), uintptr(p3), uintptr(p4), 0, 0))
}

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

// int setenv(const char *name, const char *value, int overwrite);
func Xsetenv(t *TLS, name, value uintptr, overwrite int32) int32 {
	if __ccgo_strace {
		trc("t=%v value=%v overwrite=%v, (%v:)", t, value, overwrite, origin(2))
	}
	panic(todo(""))
}

// int unsetenv(const char *name);
func Xunsetenv(t *TLS, name uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v name=%v, (%v:)", t, name, origin(2))
	}
	panic(todo(""))
}

// int pause(void);
func Xpause(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// ssize_t writev(int fd, const struct iovec *iov, int iovcnt);
func Xwritev(t *TLS, fd int32, iov uintptr, iovcnt int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v iov=%v iovcnt=%v, (%v:)", t, fd, iov, iovcnt, origin(2))
	}
	panic(todo(""))
}

// int __isoc99_sscanf(const char *str, const char *format, ...);
func X__isoc99_sscanf(t *TLS, str, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	r := Xsscanf(t, str, format, va)
	// if dmesgs {
	// 	dmesg("%v: %q %q: %d", origin(1), GoString(str), GoString(format), r)
	// }
	return r
}

// void __assert(const char * func, const char * file, int line, const char *expr) __dead2;
func X__assert(t *TLS, fn, file uintptr, line int32, expr uintptr) {
	if __ccgo_strace {
		trc("t=%v file=%v line=%v expr=%v, (%v:)", t, file, line, expr, origin(2))
	}
	X__assert_fail(t, expr, file, uint32(line), fn)
}

func X__assert13(t *TLS, file uintptr, line int32, fn, msg uintptr) {
	if __ccgo_strace {
		trc("t=%v file=%v line=%v msg=%v, (%v:)", t, file, line, msg, origin(2))
	}
	X__assert_fail(t, msg, file, uint32(line), fn)
}

// include/stdio.h:456:int	__swbuf(int, FILE *);
func X__swbuf(t *TLS, n int32, file uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v n=%v file=%v, (%v:)", t, n, file, origin(2))
	}
	return Xfputc(t, n, file) //TODO improve performance, use a real buffer.
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

// struct dirent *readdir(DIR *dirp);
func Xreaddir(t *TLS, dir uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v dir=%v, (%v:)", t, dir, origin(2))
	}
	if (*darwinDir)(unsafe.Pointer(dir)).eof {
		return 0
	}

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
	(*darwinDir)(unsafe.Pointer(dir)).l += int((*unix.Dirent)(unsafe.Pointer(de)).Reclen)
	return de
}

type darwinDir struct {
	buf [4096]byte
	fd  int
	h   int
	l   int

	eof bool
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

// int * __error(void);
func X__error(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return t.errnop
}

func Xclosedir(t *TLS, dir uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v dir=%v, (%v:)", t, dir, origin(2))
	}
	r := Xclose(t, int32((*darwinDir)(unsafe.Pointer(dir)).fd))
	Xfree(t, dir)
	return r
}

// int __xuname(int namesize, void *namebuf)
func X__xuname(t *TLS, namesize int32, namebuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v namesize=%v namebuf=%v, (%v:)", t, namesize, namebuf, origin(2))
	}
	return Xuname(t, namebuf)
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

// char *inet_ntoa(struct in_addr in);
func X__inet_ntoa(t *TLS, in1 in.In_addr) uintptr {
	if __ccgo_strace {
		trc("t=%v in1=%v, (%v:)", t, in1, origin(2))
	}
	panic(todo(""))
}

func Xmmap(t *TLS, addr uintptr, length types.Size_t, prot, flags, fd int32, offset types.Off_t) uintptr {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v fd=%v offset=%v, (%v:)", t, addr, length, fd, offset, origin(2))
	}

	if addr == 0 {
		data, err := unix.Mmap(int(fd), int64(offset), int(length), int(prot), int(flags))
		if err != nil {
			t.setErrno(err)
			return ^uintptr(0)
		}
		if __ccgo_strace {
			trc("Xmmap returning %v", uintptr(unsafe.Pointer(&data)))
		}
		return uintptr(unsafe.Pointer(&data[0]))
	}

	// On 2021-12-23, a new syscall for mmap was introduced:
	//
	// 	49	STD NOLOCK	{ void *sys_mmap(void *addr, size_t len, int prot, \
	// 			    int flags, int fd, off_t pos); }
	//  src: https://github.com/golang/go/issues/59661
	if __ccgo_strace {
		trc("Xmmap with addr %d (%v:)", addr, origin(2))
	}

	panic(todo(""))

	const unix_SYS_MMAP = 49

	// Cannot avoid the syscall here, addr sometimes matter.
	data, _, err := unix.RawSyscall6(unix_SYS_MMAP, addr, uintptr(length), uintptr(prot), uintptr(flags), uintptr(fd), uintptr(offset))
	if err != 0 {
		//if dmesgs {
		dmesg("%v: %v FAIL", origin(1), err)
		//}
		t.setErrno(err)
		return ^uintptr(0) // (void*)-1
	}

	if dmesgs {
		dmesg("%v: addr %#0x, length %#x0, prot %#0x, flags %#0x, fd %d, offset %#0x returns %#0x", origin(1), addr, length, prot, flags, fd, offset, data)
	}
	return data
}

func X__errno(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return X__errno_location(t)
}

func X__ccgo_pthreadMutexattrGettype(tls *TLS, a uintptr) int32 { /* pthread_attr_get.c:93:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return (int32((*pthread_mutexattr_t)(unsafe.Pointer(a)).F__attr & uint32(3)))
}

func X__ccgo_getMutexType(tls *TLS, m uintptr) int32 { /* pthread_mutex_lock.c:3:5: */
	if __ccgo_strace {
		trc("tls=%v m=%v, (%v:)", tls, m, origin(2))
	}
	return (*(*int32)(unsafe.Pointer((m /* &.__u */ /* &.__i */))) & 15)
}

func X__ccgo_pthreadAttrGetDetachState(tls *TLS, a uintptr) int32 { /* pthread_attr_get.c:3:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return *(*int32)(unsafe.Pointer((a /* &.__u */ /* &.__i */) + 6*4))
}

func Xpthread_attr_getdetachstate(tls *TLS, a uintptr, state uintptr) int32 { /* pthread_attr_get.c:7:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v state=%v, (%v:)", tls, a, state, origin(2))
	}
	*(*int32)(unsafe.Pointer(state)) = *(*int32)(unsafe.Pointer((a /* &.__u */ /* &.__i */) + 6*4))
	return 0
}

func Xpthread_attr_setdetachstate(tls *TLS, a uintptr, state int32) int32 { /* pthread_attr_setdetachstate.c:3:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v state=%v, (%v:)", tls, a, state, origin(2))
	}
	if uint32(state) > 1 {
		return 22
	}
	*(*int32)(unsafe.Pointer((a /* &.__u */ /* &.__i */) + 6*4)) = state
	return 0
}

func Xpthread_mutexattr_destroy(tls *TLS, a uintptr) int32 { /* pthread_mutexattr_destroy.c:3:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return 0
}

func Xpthread_mutexattr_init(tls *TLS, a uintptr) int32 { /* pthread_mutexattr_init.c:3:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	*(*pthread_mutexattr_t)(unsafe.Pointer(a)) = pthread_mutexattr_t{}
	return 0
}

func Xpthread_mutexattr_settype(tls *TLS, a uintptr, type1 int32) int32 { /* pthread_mutexattr_settype.c:3:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v type1=%v, (%v:)", tls, a, type1, origin(2))
	}
	if uint32(type1) > uint32(2) {
		return 22
	}
	(*pthread_mutexattr_t)(unsafe.Pointer(a)).F__attr = (((*pthread_mutexattr_t)(unsafe.Pointer(a)).F__attr & Uint32FromInt32(CplInt32(3))) | uint32(type1))
	return 0
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

func X__srget(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	return Xgetc(t, stream)
}

// void __assert2(const char *, int, const char *, const char *);
// __assert2(__FILE__, __LINE__, __func__, #e))
func X__assert2(t *TLS, file uintptr, line int32, fn, expr uintptr) {
	if __ccgo_strace {
		trc("t=%v file=%v line=%v expr=%v, (%v:)", t, file, line, expr, origin(2))
	}
	X__assert_fail(t, expr, file, uint32(line), fn)
}

// int getpagesize(void);
func Xgetpagesize(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return int32(unix.Getpagesize())
}

const PTHREAD_MUTEX_DEFAULT = 0

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
	typ := PTHREAD_MUTEX_DEFAULT
	if pAttr != 0 {
		typ = int(X__ccgo_pthreadMutexattrGettype(t, pAttr))
	}
	mutexesMu.Lock()

	defer mutexesMu.Unlock()

	mutexes[pMutex] = newMutex(typ)
	return 0
}

// uint16_t __builtin_bswap16 (uint32_t x)
func Xbswap16(t *TLS, x uint16) uint16 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return X__builtin_bswap16(t, x)
}

func X__swap16md(t *TLS, x uint16) uint16 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return X__builtin_bswap16(t, x)
}

// uint32_t __builtin_bswap32 (uint32_t x)
func Xbswap32(t *TLS, x uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return X__builtin_bswap32(t, x)
}

// uint64_t __builtin_bswap64 (uint64_t x)
func Xbswap64(t *TLS, x uint64) uint64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return X__builtin_bswap64(t, x)
}

func X__builtin_isblank(t *TLS, _c int32) int32 {
	if __ccgo_strace {
		trc("t=%v _c=%v, (%v:)", t, _c, origin(2))
	}
	return Xisblank(t, _c)
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
		// 		if dmesgs {
		// 			dmesg("%v: fd %v, off %#x, count %#x\n%s", origin(1), fd, offset, count, hex.Dump((*RawMem)(unsafe.Pointer(buf))[:count:count]))
		// 		}
	}
	if err != nil {
		// 		if dmesgs {
		// 			dmesg("%v: %v FAIL", origin(1), err)
		// 		}
		t.setErrno(err)
		return -1
	}

	// 	if dmesgs {
	// 		dmesg("%v: ok", origin(1))
	// 	}
	return types.Ssize_t(n)
}

// int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);
func Xsigaction(t *TLS, signum int32, act, oldact uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v signum=%v oldact=%v, (%v:)", t, signum, oldact, origin(2))
	}
	panic(todo("SYS_SIGACTION not supported"))
}

// FILE *fopen64(const char *pathname, const char *mode);
func Xfopen64(t *TLS, pathname, mode uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v mode=%v, (%v:)", t, mode, origin(2))
	}
	m := strings.ReplaceAll(GoString(mode), "b", "")
	var flags int
	switch m {
	case "r":
		flags = fcntl.O_RDONLY
	case "r+":
		flags = fcntl.O_RDWR
	case "w":
		flags = fcntl.O_WRONLY | fcntl.O_CREAT | fcntl.O_TRUNC
	case "w+":
		flags = fcntl.O_RDWR | fcntl.O_CREAT | fcntl.O_TRUNC
	case "a":
		flags = fcntl.O_WRONLY | fcntl.O_CREAT | fcntl.O_APPEND
	case "a+":
		flags = fcntl.O_RDWR | fcntl.O_CREAT | fcntl.O_APPEND
	default:
		panic(m)
	}
	fd, err := unix.Open(GoString(pathname), int(flags), 0666)
	if err != nil {
		if dmesgs {
			dmesg("%v: %q %q: %v FAIL", origin(1), GoString(pathname), GoString(mode), err)
		}
		t.setErrno(err)
		return 0
	}

	if dmesgs {
		dmesg("%v: %q %q: fd %v", origin(1), GoString(pathname), GoString(mode), fd)
	}
	if p := newFile(t, int32(fd)); p != 0 {
		return p
	}

	panic("OOM")
}

// int lstat(const char *pathname, struct stat *statbuf);
func Xlstat64(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%s statbuf=%v, (%v:)", t, GoString(pathname), statbuf, origin(2))
	}
	if err := unix.Lstat(GoString(pathname), (*unix.Stat_t)(unsafe.Pointer(statbuf))); err != nil {
		if dmesgs {
			dmesg("%v: %q: %v FAIL", origin(1), GoString(pathname), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q: ok", origin(1), GoString(pathname))
	}
	return 0
}

// int stat(const char *pathname, struct stat *statbuf);
func Xstat64(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%s statbuf=%v, (%v:)", t, GoString(pathname), statbuf, origin(2))
	}
	if err := unix.Stat(GoString(pathname), (*unix.Stat_t)(unsafe.Pointer(statbuf))); err != nil {
		if dmesgs {
			dmesg("%v: %q: %v FAIL", origin(1), GoString(pathname), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q: ok", origin(1), GoString(pathname))
	}
	return 0
}

// int mkdir(const char *path, mode_t mode);
func Xmkdir(t *TLS, path uintptr, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v mode=%v, (%v:)", t, GoString(path), mode, origin(2))
	}
	if err := unix.Mkdir(GoString(path), uint32(mode)); err != nil {
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

// int access(const char *pathname, int mode);
func Xaccess(t *TLS, pathname uintptr, mode int32) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v, (%v:)", t, GoString(pathname), mode, origin(2))
	}
	if err := unix.Access(GoString(pathname), uint32(mode)); err != nil {
		if dmesgs {
			dmesg("%v: %q %#o: %v FAIL", origin(1), GoString(pathname), mode, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q %#o: ok", origin(1), GoString(pathname), mode)
	}
	return 0
}

// int unlink(const char *pathname);
func Xunlink(t *TLS, pathname uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v, (%v:)", t, GoString(pathname), origin(2))
	}
	if err := unix.Unlink(GoString(pathname)); err != nil {
		if dmesgs {
			dmesg("%v: %q: %v", origin(1), GoString(pathname), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	return 0
}

// ssize_t readlink(const char *restrict path, char *restrict buf, size_t bufsize);
func Xreadlink(t *TLS, path, buf uintptr, bufsize types.Size_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v buf=%v bufsize=%v, (%v:)", t, buf, bufsize, origin(2))
	}
	var n int
	var err error
	switch {
	case buf == 0 || bufsize == 0:
		n, err = unix.Readlink(GoString(path), nil)
	default:
		n, err = unix.Readlink(GoString(path), (*RawMem)(unsafe.Pointer(buf))[:bufsize:bufsize])
	}
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: ok")
	}
	return types.Ssize_t(n)
}

// int symlink(const char *target, const char *linkpath);
func Xsymlink(t *TLS, target, linkpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v linkpath=%v, (%v:)", t, GoString(linkpath), origin(2))
	}
	if err := unix.Symlink(GoString(target), GoString(linkpath)); err != nil {
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

// int chmod(const char *pathname, mode_t mode)
func Xchmod(t *TLS, pathname uintptr, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v, (%v:)", t, GoString(pathname), mode, origin(2))
	}
	if err := unix.Chmod(GoString(pathname), uint32(mode)); err != nil {
		if dmesgs {
			dmesg("%v: %q %#o: %v FAIL", origin(1), GoString(pathname), mode, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q %#o: ok", origin(1), GoString(pathname), mode)
	}
	return 0
}

// time_t time(time_t *tloc);
func Xtime(t *TLS, tloc uintptr) time.Time_t {
	if __ccgo_strace {
		trc("t=%v tloc=%v, (%v:)", t, tloc, origin(2))
	}

	var tvs unix.Timeval
	err := unix.Gettimeofday(&tvs)
	if err != nil {
		t.setErrno(err)
		return types.Time_t(-1)
	}

	if tloc != 0 {
		*(*types.Time_t)(unsafe.Pointer(tloc)) = types.Time_t(tvs.Sec)
	}
	return types.Time_t(tvs.Sec)
}

// int utimes(const char *filename, const struct timeval times[2]);
func Xutimes(t *TLS, filename, times uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v filename=%v, times=%v, (%v:)", t, GoString(filename), times, origin(2))
	}
	var a []unix.Timeval
	if times != 0 {
		a = make([]unix.Timeval, 2)
		a[0] = *(*unix.Timeval)(unsafe.Pointer(times))
		a[1] = *(*unix.Timeval)(unsafe.Pointer(times + unsafe.Sizeof(unix.Timeval{})))
	}
	if err := unix.Utimes(GoString(filename), a); err != nil {
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

// int fstat(int fd, struct stat *statbuf);
func Xfstat64(t *TLS, fd int32, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v statbuf=%v, (%v:)", t, fd, *(*unix.Stat_t)(unsafe.Pointer(statbuf)), origin(2))
	}
	if err := unix.Fstat(int(fd), (*unix.Stat_t)(unsafe.Pointer(statbuf))); err != nil {
		if dmesgs {
			dmesg("%v: fd %d: %v FAIL", origin(1), fd, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %d: ok", origin(1), fd)
	}
	return 0
}

// off64_t lseek64(int fd, off64_t offset, int whence);
func Xlseek64(t *TLS, fd int32, offset types.Off_t, whence int32) types.Off_t {
	if __ccgo_strace {
		trc("t=%v fd=%v offset=%v whence=%v, (%v:)", t, fd, offset, whence, origin(2))
	}
	n, err := unix.Seek(int(fd), int64(offset), int(whence))
	if err != nil {
		if dmesgs {
			dmesg("%v: %v FAIL", origin(1), err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %d, offset %#0x, whence %d, ok", origin(1), fd, offset, whence)
	}
	return types.Off_t(n)
}

// int fcntl(int fd, int cmd, ... /* arg */ );
func Xfcntl64(t *TLS, fd, cmd int32, args uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v cmd=%v args=%v, (%v:)", t, cmd, args, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	var err error
	var p uintptr
	var i int
	switch cmd {
	case fcntl.F_GETLK, fcntl.F_SETLK:
		p = *(*uintptr)(unsafe.Pointer(args))
		err = unix.FcntlFlock(uintptr(fd), int(cmd), (*unix.Flock_t)(unsafe.Pointer(p)))
	case fcntl.F_GETFL:
		i, err = unix.FcntlInt(uintptr(fd), int(cmd), 0)
		r = int32(i)
	case fcntl.F_SETFD, fcntl.F_SETFL:
		arg := *(*int32)(unsafe.Pointer(args))
		_, err = unix.FcntlInt(uintptr(fd), int(cmd), int(arg))
	default:
		panic(todo("%v: %v %v", origin(1), fd, cmd))
	}
	if err != nil {
		if dmesgs {
			dmesg("%v: fd %v cmd %v p %#x: %v FAIL", origin(1), fcntlCmdStr(fd), cmd, p, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %d %s %#x: ok", origin(1), fd, fcntlCmdStr(cmd), p)
	}
	return r
}

// int rename(const char *oldpath, const char *newpath);
func Xrename(t *TLS, oldpath, newpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v newpath=%v, (%v:)", t, newpath, origin(2))
	}
	if err := unix.Rename(GoString(oldpath), GoString(newpath)); err != nil {
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

// int mknod(const char *pathname, mode_t mode, dev_t dev);
func Xmknod(t *TLS, pathname uintptr, mode types.Mode_t, dev types.Dev_t) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v dev=%v, (%v:)", t, pathname, mode, dev, origin(2))
	}
	if err := unix.Mknod(GoString(pathname), uint32(mode), int(dev)); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int utime(const char *filename, const struct utimbuf *times);
func Xutime(t *TLS, filename, times uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v times=%v, (%v:)", t, times, origin(2))
	}
	var a []unix.Timeval
	if times != 0 {
		a = make([]unix.Timeval, 2)
		a[0].Sec = (*utime.Utimbuf)(unsafe.Pointer(times)).Factime
		a[1].Sec = (*utime.Utimbuf)(unsafe.Pointer(times)).Fmodtime
	}
	if err := unix.Utimes(GoString(filename), a); err != nil {
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

// int chown(const char *pathname, uid_t owner, gid_t group);
func Xchown(t *TLS, pathname uintptr, owner types.Uid_t, group types.Gid_t) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v owner=%v group=%v, (%v:)", t, pathname, owner, group, origin(2))
	}
	if err := unix.Chown(GoString(pathname), int(owner), int(group)); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int link(const char *oldpath, const char *newpath);
func Xlink(t *TLS, oldpath, newpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v newpath=%v, (%v:)", t, newpath, origin(2))
	}
	if err := unix.Link(GoString(oldpath), GoString(newpath)); err != nil {
		t.setErrno(err)
		return -1
	}
	return 0
}

// int dup2(int oldfd, int newfd);
func Xdup2(t *TLS, oldfd, newfd int32) int32 {
	if __ccgo_strace {
		trc("t=%v newfd=%v, (%v:)", t, newfd, origin(2))
	}
	if err := unix.Dup2(int(oldfd), int(newfd)); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// unsigned int alarm(unsigned int seconds);
func Xalarm(t *TLS, seconds uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v seconds=%v, (%v:)", t, seconds, origin(2))
	}
	panic("SYS_ALARM not supported")

	/* n, err := unix.Alarm(uint(seconds))
	if err != nil {
		t.setErrno(err)
		return 0
	}

	return uint32(n)
	*/
}

// int getnameinfo(const struct sockaddr * restrict sa, socklen_t salen, char * restrict host, socklen_t hostlen, char * restrict serv,  socklen_t servlen, int flags);
func Xgetnameinfo(tls *TLS, sa1 uintptr, sl socklen_t, node uintptr, nodelen size_t, serv uintptr, servlen size_t, flags int32) int32 { /* getnameinfo.c:125:5: */
	if __ccgo_strace {
		trc("tls=%v sa1=%v sl=%v node=%v nodelen=%v serv=%v servlen=%v flags=%v, (%v:)", tls, sa1, sl, node, nodelen, serv, servlen, flags, origin(2))
	}
	panic(todo(""))
	//TODO bp := tls.Alloc(347)
	//TODO defer tls.Free(347)

	//TODO // var ptr [78]int8 at bp, 78

	//TODO // var buf [256]int8 at bp+78, 256

	//TODO // var num [13]int8 at bp+334, 13

	//TODO var af int32 = int32((*sockaddr)(unsafe.Pointer(sa1)).sa_family)
	//TODO var a uintptr
	//TODO var scopeid uint32

	//TODO switch af {
	//TODO case 2:
	//TODO 	a = (sa1 + 4 /* &.sin_addr */)
	//TODO 	if (uint64(sl) < uint64(unsafe.Sizeof(sockaddr_in{}))) {
	//TODO 		return -6
	//TODO 	}
	//TODO 	mkptr4(tls, bp /* &ptr[0] */, a)
	//TODO 	scopeid = uint32(0)
	//TODO 	break
	//TODO case 10:
	//TODO 	a = (sa1 + 8 /* &.sin6_addr */)
	//TODO 	if (uint64(sl) < uint64(unsafe.Sizeof(sockaddr_in6{}))) {
	//TODO 		return -6
	//TODO 	}
	//TODO 	if Xmemcmp(tls, a, ts+88 /* "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xff" */, uint64(12)) != 0 {
	//TODO 		mkptr6(tls, bp /* &ptr[0] */, a)
	//TODO 	} else {
	//TODO 		mkptr4(tls, bp /* &ptr[0] */, (a + uintptr(12)))
	//TODO 	}
	//TODO 	scopeid = (*sockaddr_in6)(unsafe.Pointer(sa1)).sin6_scope_id
	//TODO 	break
	//TODO default:
	//TODO 	return -6
	//TODO }

	//TODO if (node != 0) && (nodelen != 0) {
	//TODO 	*(*int8)(unsafe.Pointer(bp + 78 /* &buf[0] */)) = int8(0)
	//TODO 	if !((flags & 0x01) != 0) {
	//TODO 		reverse_hosts(tls, bp+78 /* &buf[0] */, a, scopeid, af)
	//TODO 	}
	//TODO 	if !(int32(*(*int8)(unsafe.Pointer(bp + 78 /* buf */))) != 0) && !((flags & 0x01) != 0) {
	//TODO 		Xabort(tls) //TODO-
	//TODO 		// unsigned char query[18+PTR_MAX], reply[512];
	//TODO 		// int qlen = __res_mkquery(0, ptr, 1, RR_PTR,
	//TODO 		// 	0, 0, 0, query, sizeof query);
	//TODO 		// query[3] = 0; /* don't need AD flag */
	//TODO 		// int rlen = __res_send(query, qlen, reply, sizeof reply);
	//TODO 		// buf[0] = 0;
	//TODO 		// if (rlen > 0)
	//TODO 		// 	__dns_parse(reply, rlen, dns_parse_callback, buf);
	//TODO 	}
	//TODO 	if !(int32(*(*int8)(unsafe.Pointer(bp + 78 /* buf */))) != 0) {
	//TODO 		if (flags & 0x08) != 0 {
	//TODO 			return -2
	//TODO 		}
	//TODO 		Xinet_ntop(tls, af, a, bp+78 /* &buf[0] */, uint32(unsafe.Sizeof([256]int8{})))
	//TODO 		if scopeid != 0 {
	//TODO 			Xabort(tls) //TODO-
	//TODO 			// char *p = 0, tmp[IF_NAMESIZE+1];
	//TODO 			// if (!(flags & NI_NUMERICSCOPE) &&
	//TODO 			//     (IN6_IS_ADDR_LINKLOCAL(a) ||
	//TODO 			//      IN6_IS_ADDR_MC_LINKLOCAL(a)))
	//TODO 			// 	p = if_indextoname(scopeid, tmp+1);
	//TODO 			// if (!p)
	//TODO 			// 	p = itoa(num, scopeid);
	//TODO 			// *--p = '%';
	//TODO 			// strcat(buf, p);
	//TODO 		}
	//TODO 	}
	//TODO 	if Xstrlen(tls, bp+78 /* &buf[0] */) >= size_t(nodelen) {
	//TODO 		return -12
	//TODO 	}
	//TODO 	Xstrcpy(tls, node, bp+78 /* &buf[0] */)
	//TODO }

	//TODO if (serv != 0) && (servlen != 0) {
	//TODO 	var p uintptr = bp + 78 /* buf */
	//TODO 	var port int32 = int32(Xntohs(tls, (*sockaddr_in)(unsafe.Pointer(sa1)).sin_port))
	//TODO 	*(*int8)(unsafe.Pointer(bp + 78 /* &buf[0] */)) = int8(0)
	//TODO 	if !((flags & 0x02) != 0) {
	//TODO 		reverse_services(tls, bp+78 /* &buf[0] */, port, (flags & 0x10))
	//TODO 	}
	//TODO 	if !(int32(*(*int8)(unsafe.Pointer(p))) != 0) {
	//TODO 		p = itoa(tls, bp+334 /* &num[0] */, uint32(port))
	//TODO 	}
	//TODO 	if Xstrlen(tls, p) >= size_t(servlen) {
	//TODO 		return -12
	//TODO 	}
	//TODO 	Xstrcpy(tls, serv, p)
	//TODO }

	//TODO return 0
}

func Xgethostbyaddr_r(tls *TLS, a uintptr, l socklen_t, af int32, h uintptr, buf uintptr, buflen size_t, res uintptr, err uintptr) int32 { /* gethostbyaddr_r.c:10:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v l=%v af=%v h=%v buf=%v buflen=%v res=%v err=%v, (%v:)", tls, a, l, af, h, buf, buflen, res, err, origin(2))
	}
	panic(todo(""))
	//TODO bp := tls.Alloc(28)
	//TODO defer tls.Free(28)

	//TODO //TODO union {
	//TODO //TODO 	struct sockaddr_in sin;
	//TODO //TODO 	struct sockaddr_in6 sin6;
	//TODO //TODO } sa = { .sin.sin_family = af };
	//TODO *(*struct {
	//TODO 	sin sockaddr_in
	//TODO 	_   [12]byte
	//TODO })(unsafe.Pointer(bp /* sa1 */)) = struct {
	//TODO 	sin sockaddr_in
	//TODO 	_   [12]byte
	//TODO }{} //TODO-
	//TODO (*sockaddr_in)(unsafe.Pointer(bp /* &sa1 */)).sin_family = sa_family_t(af) //TODO-
	//TODO var sl socklen_t
	//TODO if af == 10 {
	//TODO 	sl = uint32(unsafe.Sizeof(sockaddr_in6{}))
	//TODO } else {
	//TODO 	sl = uint32(unsafe.Sizeof(sockaddr_in{}))
	//TODO }
	//TODO var i int32

	//TODO *(*uintptr)(unsafe.Pointer(res)) = uintptr(0)

	//TODO // Load address argument into sockaddr structure
	//TODO if (af == 10) && (l == socklen_t(16)) {
	//TODO 	Xmemcpy(tls, (bp /* &sa1 */ /* &.sin6 */ + 8 /* &.sin6_addr */), a, uint64(16))
	//TODO } else if (af == 2) && (l == socklen_t(4)) {
	//TODO 	Xmemcpy(tls, (bp /* &sa1 */ /* &.sin */ + 4 /* &.sin_addr */), a, uint64(4))
	//TODO } else {
	//TODO 	*(*int32)(unsafe.Pointer(err)) = 3
	//TODO 	return 22
	//TODO }

	//TODO // Align buffer and check for space for pointers and ip address
	//TODO i = (int32(uintptr_t(buf) & (uint64(unsafe.Sizeof(uintptr(0))) - uint64(1))))
	//TODO if !(i != 0) {
	//TODO 	i = int32(unsafe.Sizeof(uintptr(0)))
	//TODO }
	//TODO if buflen <= (((uint64(5) * uint64(unsafe.Sizeof(uintptr(0)))) - uint64(i)) + uint64(l)) {
	//TODO 	return 34
	//TODO }
	//TODO buf += (uintptr(uint64(unsafe.Sizeof(uintptr(0))) - uint64(i)))
	//TODO buflen = buflen - (((uint64(5) * uint64(unsafe.Sizeof(uintptr(0)))) - uint64(i)) + uint64(l))

	//TODO (*hostent)(unsafe.Pointer(h)).h_addr_list = buf
	//TODO buf += (uintptr(uint64(2) * uint64(unsafe.Sizeof(uintptr(0)))))
	//TODO (*hostent)(unsafe.Pointer(h)).h_aliases = buf
	//TODO buf += (uintptr(uint64(2) * uint64(unsafe.Sizeof(uintptr(0)))))

	//TODO *(*uintptr)(unsafe.Pointer((*hostent)(unsafe.Pointer(h)).h_addr_list)) = buf
	//TODO Xmemcpy(tls, *(*uintptr)(unsafe.Pointer((*hostent)(unsafe.Pointer(h)).h_addr_list)), a, uint64(l))
	//TODO buf += uintptr(l)
	//TODO *(*uintptr)(unsafe.Pointer((*hostent)(unsafe.Pointer(h)).h_addr_list + 1*8)) = uintptr(0)
	//TODO *(*uintptr)(unsafe.Pointer((*hostent)(unsafe.Pointer(h)).h_aliases)) = buf
	//TODO *(*uintptr)(unsafe.Pointer((*hostent)(unsafe.Pointer(h)).h_aliases + 1*8)) = uintptr(0)

	//TODO switch Xgetnameinfo(tls, bp /* &sa1 */, sl, buf, uint32(buflen), uintptr(0), uint32(0), 0) {
	//TODO case -3:
	//TODO 	*(*int32)(unsafe.Pointer(err)) = 2
	//TODO 	return 11
	//TODO case -12:
	//TODO 	return 34
	//TODO default:
	//TODO 	fallthrough
	//TODO case -10:
	//TODO 	fallthrough
	//TODO case -11:
	//TODO 	fallthrough
	//TODO case -4:
	//TODO 	*(*int32)(unsafe.Pointer(err)) = 3
	//TODO 	return *(*int32)(unsafe.Pointer(X___errno_location(tls)))
	//TODO case 0:
	//TODO 	break
	//TODO }

	//TODO (*hostent)(unsafe.Pointer(h)).h_addrtype = af
	//TODO (*hostent)(unsafe.Pointer(h)).h_length = int32(l)
	//TODO (*hostent)(unsafe.Pointer(h)).h_name = *(*uintptr)(unsafe.Pointer((*hostent)(unsafe.Pointer(h)).h_aliases))
	//TODO *(*uintptr)(unsafe.Pointer(res)) = h
	//TODO return 0
}

// int getrlimit(int resource, struct rlimit *rlim);
func Xgetrlimit64(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	if err := unix.Getrlimit(int(resource), (*unix.Rlimit)(unsafe.Pointer(rlim))); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
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
		Ffts_pathlen: types.Size_t(len(path)),
		Ffts_statp:   statp,
		Ffts_errno:   int32(err),
	}
}

// DIR *opendir(const char *name);
func Xopendir(t *TLS, name uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v name=%v, (%v:)", t, name, origin(2))
	}
	p := Xmalloc(t, types.Size_t(unsafe.Sizeof(darwinDir{})))
	if p == 0 {
		panic("OOM")
	}

	fd := int(Xopen(t, name, fcntl.O_RDONLY|fcntl.O_DIRECTORY|fcntl.O_CLOEXEC, 0))
	if fd < 0 {
		if dmesgs {
			dmesg("%v: FAIL %v", origin(1), (*darwinDir)(unsafe.Pointer(p)).fd)
		}
		Xfree(t, p)
		return 0
	}

	if dmesgs {
		dmesg("%v: ok", origin(1))
	}
	(*darwinDir)(unsafe.Pointer(p)).fd = fd
	(*darwinDir)(unsafe.Pointer(p)).h = 0
	(*darwinDir)(unsafe.Pointer(p)).l = 0
	(*darwinDir)(unsafe.Pointer(p)).eof = false
	return p
}

func Xrewinddir(tls *TLS, f uintptr) {
	if __ccgo_strace {
		trc("tls=%v f=%v, (%v:)", tls, f, origin(2))
	}
	Xfseek(tls, f, 0, stdio.SEEK_SET)
}

// clock_t clock(void);
func Xclock(t *TLS) time.Clock_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return time.Clock_t(gotime.Since(startTime) * gotime.Duration(time.CLOCKS_PER_SEC) / gotime.Second)
}

// ssize_t recvmsg(int sockfd, struct msghdr *msg, int flags);
func Xrecvmsg(t *TLS, sockfd int32, msg uintptr, flags int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v sockfd=%v msg=%v flags=%v, (%v:)", t, sockfd, msg, flags, origin(2))
	}
	oob := []byte{}
	buf := []byte{}

	n, _, _, _, err := unix.Recvmsg(int(sockfd), buf, oob, int(flags))
	if err != nil {
		t.setErrno(err)
		return -1
	}
	copy((*RawMem)(unsafe.Pointer(msg))[:n:n], buf[:])

	return types.Ssize_t(n)
}
