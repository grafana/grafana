// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

package libc // import "modernc.org/libc"

import (
	// "encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	// "runtime/debug"
	"time"
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
	ctime "modernc.org/libc/time"
	"modernc.org/libc/unistd"
	"modernc.org/libc/uuid/uuid"
)

const (
	// musl/src/internal/stdio_impl.h:16:#define F_EOF 16
	m_F_EOF = 16
)

var (
	in6_addr_any in.In6_addr
	_            = X__ctype_b_loc
)

type (
	syscallErrno = unix.Errno
	long         = types.X__syscall_slong_t
	ulong        = types.X__syscall_ulong_t
)

type file uintptr

func (f file) fd() int32        { return (*stdio.FILE)(unsafe.Pointer(f)).F_fileno }
func (f file) setFd(fd int32)   { (*stdio.FILE)(unsafe.Pointer(f)).F_fileno = fd }
func (f file) err() bool        { return (*stdio.FILE)(unsafe.Pointer(f)).F_flags2&stdio.X_IO_ERR_SEEN != 0 }
func (f file) setErr()          { (*stdio.FILE)(unsafe.Pointer(f)).F_flags2 |= stdio.X_IO_ERR_SEEN }
func (f file) flags() int32     { return (*stdio.FILE)(unsafe.Pointer(f)).F_flags }
func (f file) orFlags(n int32)  { (*stdio.FILE)(unsafe.Pointer(f)).F_flags |= n }
func (f file) xorFlags(n int32) { (*stdio.FILE)(unsafe.Pointer(f)).F_flags ^= n }

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

	// if dmesgs {
	// 	dmesg("%v: fd %v: %s", origin(1), fd, b)
	// }
	return unix.Write(int(fd), b) //TODO use Xwrite
}

// int fprintf(FILE *stream, const char *format, ...);
func Xfprintf(t *TLS, stream, format, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
	}
	n, _ := fwrite((*stdio.FILE)(unsafe.Pointer(stream)).F_fileno, printf(format, args))
	return int32(n)
}

// int usleep(useconds_t usec);
func Xusleep(t *TLS, usec types.X__useconds_t) int32 {
	if __ccgo_strace {
		trc("t=%v usec=%v, (%v:)", t, usec, origin(2))
	}
	time.Sleep(time.Microsecond * time.Duration(usec))
	return 0
}

// int getrusage(int who, struct rusage *usage);
func Xgetrusage(t *TLS, who int32, usage uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v who=%v usage=%v, (%v:)", t, who, usage, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_GETRUSAGE, uintptr(who), usage, 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
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
	if _, _, err := unix.Syscall(unix.SYS_CHDIR, path, 0, 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %q: ok", origin(1), GoString(path))
	// }
	return 0
}

var localtime ctime.Tm

// struct tm *localtime(const time_t *timep);
func Xlocaltime(_ *TLS, timep uintptr) uintptr {
	loc := getLocalLocation()
	ut := *(*unix.Time_t)(unsafe.Pointer(timep))
	t := time.Unix(int64(ut), 0).In(loc)
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
	ut := *(*unix.Time_t)(unsafe.Pointer(timep))
	t := time.Unix(int64(ut), 0).In(loc)
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_sec = int32(t.Second())
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_min = int32(t.Minute())
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_hour = int32(t.Hour())
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_mday = int32(t.Day())
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_mon = int32(t.Month() - 1)
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_year = int32(t.Year() - 1900)
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_wday = int32(t.Weekday())
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_yday = int32(t.YearDay())
	(*ctime.Tm)(unsafe.Pointer(result)).Ftm_isdst = Bool32(isTimeDST(t))
	return result
}

// int open(const char *pathname, int flags, ...);
func Xopen(t *TLS, pathname uintptr, flags int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v flags=%v args=%v, (%v:)", t, pathname, flags, args, origin(2))
	}
	return Xopen64(t, pathname, flags, args)
}

// int open(const char *pathname, int flags, ...);
func Xopen64(t *TLS, pathname uintptr, flags int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v flags=%v args=%v, (%v:)", t, pathname, flags, args, origin(2))
	}
	//TODO- flags |= fcntl.O_LARGEFILE
	var mode types.Mode_t
	if args != 0 {
		mode = (types.Mode_t)(VaUint32(&args))
	}
	fdcwd := fcntl.AT_FDCWD
	n, _, err := unix.Syscall6(unix.SYS_OPENAT, uintptr(fdcwd), pathname, uintptr(flags|unix.O_LARGEFILE), uintptr(mode), 0, 0)
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

// int openat(int dirfd, const char *pathname, int flags, mode_t mode);
func Xopenat(t *TLS, dirfd int32, pathname uintptr, flags int32, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v dirfd=%v pathname=%v flags=%v mode=%v, (%v:)", t, dirfd, pathname, flags, mode, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	fd, _, err := unix.Syscall6(unix.SYS_OPENAT, uintptr(dirfd), pathname, uintptr(flags), uintptr(mode), 0, 0)
	if err != 0 {
		t.setErrno(err)
		return -1
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

	if _, _, err := unix.Syscall(unix.SYS_FSYNC, uintptr(fd), 0, 0); err != 0 {
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
	if _, _, err := unix.Syscall(unix.SYS_CLOSE, uintptr(fd), 0, 0); err != 0 {
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
	n, _, err := unix.Syscall(unix.SYS_GETCWD, buf, uintptr(size), 0)
	if err != 0 {
		t.setErrno(err)
		return 0
	}

	// if dmesgs {
	// 	dmesg("%v: %q: ok", origin(1), GoString(buf))
	// }
	return n
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
	return Xftruncate64(t, fd, length)
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
	n, _, err := unix.Syscall(unix.SYS_READ, uintptr(fd), buf, uintptr(count))
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	// dmesg("%v: %d %#x: %#x\n%s", origin(1), fd, count, n, hex.Dump(GoBytes(buf, int(n))))
	// 	dmesg("%v: %d %#x: %#x", origin(1), fd, count, n)
	// }
	return types.Ssize_t(n)
}

// ssize_t write(int fd, const void *buf, size_t count);
func Xwrite(t *TLS, fd int32, buf uintptr, count types.Size_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v, (%v:)", t, fd, buf, count, origin(2))
	}
	const retry = 5
	var err syscallErrno
	for i := 0; i < retry; i++ {
		var n uintptr
		switch n, _, err = unix.Syscall(unix.SYS_WRITE, uintptr(fd), buf, uintptr(count)); err {
		case 0:
			// if dmesgs {
			// 	// dmesg("%v: %d %#x: %#x\n%s", origin(1), fd, count, n, hex.Dump(GoBytes(buf, int(n))))
			// 	dmesg("%v: %d %#x: %#x", origin(1), fd, count, n)
			// }
			return types.Ssize_t(n)
		case errno.EAGAIN:
			// nop
		}
	}

	// if dmesgs {
	// 	dmesg("%v: fd %v, count %#x: %v", origin(1), fd, count, err)
	// }
	t.setErrno(err)
	return -1
}

// int fchmod(int fd, mode_t mode);
func Xfchmod(t *TLS, fd int32, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v mode=%v, (%v:)", t, fd, mode, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_FCHMOD, uintptr(fd), uintptr(mode), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: %d %#o: ok", origin(1), fd, mode)
	// }
	return 0
}

// int fchmodat(int dirfd, const char *pathname, mode_t mode, int flags);
func Xfchmodat(t *TLS, dirfd int32, pathname uintptr, mode types.Mode_t, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v dirfd=%v pathname=%v mode=%v flags=%v, (%v:)", t, dirfd, pathname, mode, flags, origin(2))
	}
	// From golang.org/x/sys/unix/syscall_linux.go
	// Linux fchmodat doesn't support the flags parameter. Mimick glibc's behavior
	// and check the flags. Otherwise the mode would be applied to the symlink
	// destination which is not what the user expects.
	if flags&^unix.AT_SYMLINK_NOFOLLOW != 0 {
		t.setErrno(unix.EINVAL)
		return -1
	} else if flags&unix.AT_SYMLINK_NOFOLLOW != 0 {
		t.setErrno(unix.EOPNOTSUPP)
		return -1
	}

	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall(unix.SYS_FCHMODAT, uintptr(dirfd), pathname, uintptr(mode)); err != 0 {
		t.setErrno(err)
		return -1
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
	n, _, _ := unix.Syscall(unix.SYS_GETEUID, 0, 0, 0)
	return types.Uid_t(n)
}

// int munmap(void *addr, size_t length);
func Xmunmap(t *TLS, addr uintptr, length types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v, (%v:)", t, addr, length, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_MUNMAP, addr, uintptr(length), 0); err != 0 {
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
	if _, _, err := unix.Syscall(unix.SYS_GETSOCKNAME, uintptr(sockfd), addr, addrlen); err != 0 {
		// if dmesgs {
		// 	dmesg("%v: fd %v: %v", origin(1), sockfd, err)
		// }
		t.setErrno(err)
		return -1
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
	if err := unix.Mkfifo(GoString(pathname), mode); err != nil {
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
	n, _, _ := unix.Syscall(unix.SYS_UMASK, uintptr(mask), 0, 0)
	return types.Mode_t(n)
}

// int execvp(const char *file, char *const argv[]);
func Xexecvp(t *TLS, file, argv uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v argv=%v, (%v:)", t, argv, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_EXECVE, file, argv, Environ()); err != 0 {
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
	n, _, err := unix.Syscall6(unix.SYS_WAIT4, uintptr(pid), wstatus, uintptr(optname), 0, 0, 0)
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return types.Pid_t(n)
}

// int uname(struct utsname *buf);
func Xuname(t *TLS, buf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v, (%v:)", t, buf, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_UNAME, buf, 0, 0); err != 0 {
		t.setErrno(err)
		return -1
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
	n, _, err := unix.Syscall6(unix.SYS_ACCEPT4, uintptr(sockfd), addr, uintptr(addrlen), 0, 0, 0)
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return int32(n)
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
		t.setErrno(errno.EBADF)
		return -1
	}

	if fd := (*stdio.FILE)(unsafe.Pointer(stream)).F_fileno; fd >= 0 {
		return fd
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
	panic(todo("%q", GoString(filename)))
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
func Xperror(t *TLS, s uintptr) {
	if __ccgo_strace {
		trc("t=%v s=%v, (%v:)", t, s, origin(2))
	}
	panic(todo(""))
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
	// if dmesgs {
	// 	dmesg("%v:\n%s", origin(1), debug.Stack())
	// }
	p := Xmalloc(t, types.Size_t(unsafe.Sizeof(signal.Sigaction{})))
	if p == 0 {
		panic("OOM")
	}

	*(*signal.Sigaction)(unsafe.Pointer(p)) = signal.Sigaction{
		F__sigaction_handler: struct{ Fsa_handler signal.X__sighandler_t }{Fsa_handler: signal.SIG_DFL},
	}
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
	m, _, err := unix.Syscall(unix.SYS_READ, uintptr(file(stream).fd()), ptr, uintptr(size*nmemb))
	if m == 0 {
		file(stream).orFlags(m_F_EOF)
	}
	if err != 0 {
		file(stream).setErr()
		return 0
	}

	// if dmesgs {
	// 	// dmesg("%v: %d %#x x %#x: %#x\n%s", origin(1), file(stream).fd(), size, nmemb, types.Size_t(m)/size, hex.Dump(GoBytes(ptr, int(m))))
	// 	dmesg("%v: %d %#x x %#x: %#x", origin(1), file(stream).fd(), size, nmemb, types.Size_t(m)/size)
	// }
	return types.Size_t(m) / size
}

// size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *stream);
func Xfwrite(t *TLS, ptr uintptr, size, nmemb types.Size_t, stream uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v ptr=%v nmemb=%v stream=%v, (%v:)", t, ptr, nmemb, stream, origin(2))
	}
	m, _, err := unix.Syscall(unix.SYS_WRITE, uintptr(file(stream).fd()), ptr, uintptr(size*nmemb))
	if err != 0 {
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
	file(stream).xorFlags(m_F_EOF)
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
	if c == stdio.EOF {
		return c
	}

	ungetcMu.Lock()
	ungetc[stream] = byte(c)
	ungetcMu.Unlock()
	return int32(byte(c))
}

// int fscanf(FILE *stream, const char *format, ...);
func Xfscanf(t *TLS, stream, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	return scanf(&byteScanner{t: t, stream: stream}, format, va)
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
	err := unix.Pause()
	if err != nil {
		t.setErrno(err)
	}

	return -1
}

// ssize_t writev(int fd, const struct iovec *iov, int iovcnt);
func Xwritev(t *TLS, fd int32, iov uintptr, iovcnt int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v iov=%v iovcnt=%v, (%v:)", t, fd, iov, iovcnt, origin(2))
	}
	// if dmesgs {
	// 	dmesg("%v: fd %v iov %#x iovcnt %v", origin(1), fd, iov, iovcnt)
	// }
	if iovcnt == 0 {
		panic(todo(""))
	}

	iovs := make([][]byte, iovcnt)
	for ; iovcnt != 0; iovcnt-- {
		base := (*unix.Iovec)(unsafe.Pointer(iov)).Base
		len := (*unix.Iovec)(unsafe.Pointer(iov)).Len
		// if dmesgs {
		// 	dmesg("%v: base %#x len %v", origin(1), base, len)
		// }
		if base != nil && len != 0 {
			iovs = append(iovs, (*RawMem)(unsafe.Pointer(base))[:len:len])
			iov += unsafe.Sizeof(unix.Iovec{})
		}
	}
	n, err := unix.Writev(int(fd), iovs)
	if err != nil {
		// if dmesgs {
		// 	dmesg("%v: %v", origin(1), err)
		// }
		panic(todo(""))
	}

	return types.Ssize_t(n)
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

// var ctimeStaticBuf [32]byte
//
// // char *ctime(const time_t *timep);
// func Xctime(t *TLS, timep uintptr) uintptr {
// 	return Xctime_r(t, timep, uintptr(unsafe.Pointer(&ctimeStaticBuf[0])))
// }
//
// // char *ctime_r(const time_t *timep, char *buf);
// func Xctime_r(t *TLS, timep, buf uintptr) uintptr {
// 	ut := *(*unix.Time_t)(unsafe.Pointer(timep))
// 	tm := time.Unix(int64(ut), 0).Local()
// 	s := tm.Format(time.ANSIC) + "\n\x00"
// 	copy((*RawMem)(unsafe.Pointer(buf))[:26:26], s)
// 	return buf
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

// int fstatfs(int fd, struct statfs *buf);
func Xfstatfs(t *TLS, fd int32, buf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v, (%v:)", t, fd, buf, origin(2))
	}
	if err := unix.Fstatfs(int(fd), (*unix.Statfs_t)(unsafe.Pointer(buf))); err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// ssize_t getrandom(void *buf, size_t buflen, unsigned int flags);
func Xgetrandom(t *TLS, buf uintptr, buflen size_t, flags uint32) ssize_t {
	if __ccgo_strace {
		trc("t=%v buf=%v buflen=%v flags=%v, (%v:)", t, buf, buflen, flags, origin(2))
	}
	n, err := unix.Getrandom((*RawMem)(unsafe.Pointer(buf))[:buflen], int(flags))
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return ssize_t(n)
}

// int posix_fadvise(int fd, off_t offset, off_t len, int advice);
func Xposix_fadvise(t *TLS, fd int32, offset, len types.Off_t, advice int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v len=%v advice=%v, (%v:)", t, fd, len, advice, origin(2))
	}
	if err := unix.Fadvise(int(fd), int64(offset), int64(len), int(advice)); err != nil {
		return int32(err.(unix.Errno))
	}

	return 0
}

// int fgetc(FILE *stream);
func Xfgetc(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	ungetcMu.Lock()
	c, ok := ungetc[stream]
	delete(ungetc, stream)
	ungetcMu.Unlock()
	if ok {
		return int32(c)
	}

	fd := int((*stdio.FILE)(unsafe.Pointer(stream)).F_fileno)
	var buf [1]byte
	if n, _ := unix.Read(fd, buf[:]); n != 0 {
		return int32(buf[0])
	}

	file(stream).orFlags(m_F_EOF)
	return stdio.EOF
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

// int mkdirat(int dirfd, const char *pathname, mode_t mode);
func Xmkdirat(t *TLS, dirfd int32, pathname uintptr, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v dirfd=%v pathname=%v mode=%v, (%v:)", t, dirfd, pathname, mode, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall(unix.SYS_MKDIRAT, uintptr(dirfd), pathname, uintptr(mode)); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int symlinkat(const char *target, int newdirfd, const char *linkpath);
func Xsymlinkat(t *TLS, target uintptr, newdirfd int32, linkpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v target=%v newdirfd=%v linkpath=%v, (%v:)", t, target, newdirfd, linkpath, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall(unix.SYS_SYMLINKAT, target, uintptr(newdirfd), linkpath); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int utimensat(int dirfd, const char *pathname, const struct timespec times[2], int flags);
func Xutimensat(t *TLS, dirfd int32, pathname, times uintptr, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v dirfd=%v times=%v flags=%v, (%v:)", t, dirfd, times, flags, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall6(unix.SYS_UTIMENSAT, uintptr(dirfd), pathname, times, uintptr(flags), 0, 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int unlinkat(int dirfd, const char *pathname, int flags);
func Xunlinkat(t *TLS, dirfd int32, pathname uintptr, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v dirfd=%v pathname=%v flags=%v, (%v:)", t, dirfd, pathname, flags, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall(unix.SYS_UNLINKAT, uintptr(dirfd), pathname, uintptr(flags)); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int faccessat(int dirfd, const char *pathname, int mode, int flags);
func Xfaccessat(t *TLS, dirfd int32, pathname uintptr, mode, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v dirfd=%v pathname=%v flags=%v, (%v:)", t, dirfd, pathname, flags, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall(unix.SYS_FACCESSAT, uintptr(dirfd), pathname, uintptr(mode)); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int renameat2(int olddirfd, const char *oldpath,	int newdirfd, const char *newpath, unsigned int flags);
func Xrenameat2(t *TLS, olddirfd int32, oldpath uintptr, newdirfd int32, newpath uintptr, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v olddirfd=%v oldpath=%v newdirfd=%v newpath=%v flags=%v, (%v:)", t, olddirfd, oldpath, newdirfd, newpath, flags, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall6(unix.SYS_RENAMEAT2, uintptr(olddirfd), oldpath, uintptr(newdirfd), newpath, uintptr(flags), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int mknodat(int dirfd, const char *pathname, mode_t mode, dev_t dev);
func Xmknodat(t *TLS, dirfd int32, pathname uintptr, mode types.Mode_t, dev types.Dev_t) int32 {
	if __ccgo_strace {
		trc("t=%v dirfd=%v pathname=%v mode=%v dev=%v, (%v:)", t, dirfd, pathname, mode, dev, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall6(unix.SYS_MKNODAT, uintptr(dirfd), pathname, uintptr(mode), uintptr(dev), 0, 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int fchownat(int dirfd, const char *pathname, uid_t owner, gid_t group, int flags);
func Xfchownat(t *TLS, dirfd int32, pathname uintptr, uid types.Uid_t, gid types.Gid_t, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v dirfd=%v pathname=%v uid=%v gid=%v flags=%v, (%v:)", t, dirfd, pathname, uid, gid, flags, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall6(unix.SYS_FCHOWNAT, uintptr(dirfd), pathname, uintptr(uid), uintptr(gid), uintptr(flags), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int linkat(int olddirfd, const char *oldpath, int newdirfd, const char *newpath, int flags);
func Xlinkat(t *TLS, olddirfd int32, oldpath uintptr, newdirfd int32, newpath uintptr, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v olddirfd=%v oldpath=%v newdirfd=%v newpath=%v flags=%v, (%v:)", t, olddirfd, oldpath, newdirfd, newpath, flags, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall6(unix.SYS_LINKAT, uintptr(olddirfd), oldpath, uintptr(newdirfd), newpath, uintptr(flags), 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int pipe2(int pipefd[2], int flags);
func Xpipe2(t *TLS, pipefd uintptr, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v pipefd=%v flags=%v, (%v:)", t, pipefd, flags, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall(unix.SYS_PIPE2, pipefd, uintptr(flags), 0); err != 0 {
		t.setErrno(t)
		return -1
	}

	return 0
}

// int dup3(int oldfd, int newfd, int flags);
func Xdup3(t *TLS, oldfd int32, newfd int32, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v oldfd=%v newfd=%v flags=%v, (%v:)", t, oldfd, newfd, flags, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	if _, _, err := unix.Syscall(unix.SYS_DUP3, uintptr(oldfd), uintptr(newfd), uintptr(flags)); err != 0 {
		t.setErrno(err)
		return -1
	}

	return 0
}

// ssize_t readlinkat(int dirfd, const char *pathname, char *buf, size_t bufsiz);
func Xreadlinkat(t *TLS, dirfd int32, pathname, buf uintptr, bufsiz types.Size_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v dirfd=%v buf=%v bufsiz=%v, (%v:)", t, dirfd, buf, bufsiz, origin(2))
	}
	// From golang.org/x/sys/unix/zsyscall_linux.go
	n, _, err := unix.Syscall6(unix.SYS_READLINKAT, uintptr(dirfd), pathname, buf, uintptr(bufsiz), 0, 0)
	if err != 0 {
		t.setErrno(err)
		return -1
	}

	return types.Ssize_t(n)
}

// int nanosleep(const struct timespec *req, struct timespec *rem);
func Xnanosleep(t *TLS, req, rem uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v rem=%v, (%v:)", t, rem, origin(2))
	}
	v := *(*ctime.Timespec)(unsafe.Pointer(req))
	time.Sleep(time.Second*time.Duration(v.Ftv_sec) + time.Duration(v.Ftv_nsec))
	return 0
}

func Xfeof(t *TLS, f uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v f=%v, (%v:)", t, f, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	X__lockfile(t, f)
	r = BoolInt32(!!((*stdio.FILE)(unsafe.Pointer(f)).F_flags&Int32FromInt32(m_F_EOF) != 0))
	X__unlockfile(t, f)
	return r
}

type byteScanner struct {
	t      *TLS
	stream uintptr

	last byte
}

func (s *byteScanner) ReadByte() (byte, error) {
	c := Xfgetc(s.t, s.stream)
	if c < 0 {
		return 0, io.EOF
	}

	s.last = byte(c)
	return byte(c), nil
}

func (s *byteScanner) UnreadByte() error {
	Xungetc(s.t, int32(s.last), s.stream)
	return nil
}
