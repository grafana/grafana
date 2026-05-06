// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"golang.org/x/sys/windows"
	"os"
	"strings"
	gotime "time"
	"unsafe"

	"modernc.org/libc/errno"
	"modernc.org/libc/sys/stat"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/time"
)

// int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);
func Xsigaction(t *TLS, signum int32, act, oldact uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v signum=%v oldact=%v, (%v:)", t, signum, oldact, origin(2))
	}
	panic(todo(""))
	// // 	musl/arch/x32/ksigaction.h
	// //
	// //	struct k_sigaction {
	// //		void (*handler)(int);
	// //		unsigned long flags;
	// //		void (*restorer)(void);
	// //		unsigned mask[2];
	// //	};
	// type k_sigaction struct {
	// 	handler  uintptr
	// 	flags    ulong
	// 	restorer uintptr
	// 	mask     [2]uint32
	// }

	// var kact, koldact uintptr
	// if act != 0 {
	// 	kact = t.Alloc(int(unsafe.Sizeof(k_sigaction{})))
	// 	defer Xfree(t, kact)
	// 	*(*k_sigaction)(unsafe.Pointer(kact)) = k_sigaction{
	// 		handler:  (*signal.Sigaction)(unsafe.Pointer(act)).F__sigaction_handler.Fsa_handler,
	// 		flags:    ulong((*signal.Sigaction)(unsafe.Pointer(act)).Fsa_flags),
	// 		restorer: (*signal.Sigaction)(unsafe.Pointer(act)).Fsa_restorer,
	// 	}
	// 	Xmemcpy(t, kact+unsafe.Offsetof(k_sigaction{}.mask), act+unsafe.Offsetof(signal.Sigaction{}.Fsa_mask), types.Size_t(unsafe.Sizeof(k_sigaction{}.mask)))
	// }
	// if oldact != 0 {
	// 	panic(todo(""))
	// }

	// if _, _, err := unix.Syscall6(unix.SYS_RT_SIGACTION, uintptr(signal.SIGABRT), kact, koldact, unsafe.Sizeof(k_sigaction{}.mask), 0, 0); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// if oldact != 0 {
	// 	panic(todo(""))
	// }

	// return 0
}

// int fcntl(int fd, int cmd, ... /* arg */ );
func Xfcntl64(t *TLS, fd, cmd int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v cmd=%v args=%v, (%v:)", t, cmd, args, origin(2))
	}
	panic(todo(""))
	// 	var arg uintptr
	// 	if args != 0 {
	// 		arg = *(*uintptr)(unsafe.Pointer(args))
	// 	}
	// 	n, _, err := unix.Syscall(unix.SYS_FCNTL64, uintptr(fd), uintptr(cmd), arg)
	// 	if err != 0 {
	// 		if dmesgs {
	// 			dmesg("%v: fd %v cmd %v", origin(1), fcntlCmdStr(fd), cmd)
	// 		}
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %d %s %#x: %d", origin(1), fd, fcntlCmdStr(cmd), arg, n)
	// 	}
	// 	return int32(n)
}

// int lstat(const char *pathname, struct stat *statbuf);
func Xlstat64(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v statbuf=%v, (%v:)", t, statbuf, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_LSTAT64, pathname, statbuf, 0); err != 0 {
	// 		if dmesgs {
	// 			dmesg("%v: %q: %v", origin(1), GoString(pathname), err)
	// 		}
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %q: ok", origin(1), GoString(pathname))
	// 	}
	// 	return 0
}

// int stat(const char *pathname, struct stat *statbuf);
func Xstat64(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v statbuf=%v, (%v:)", t, statbuf, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_STAT64, pathname, statbuf, 0); err != 0 {
	// 		if dmesgs {
	// 			dmesg("%v: %q: %v", origin(1), GoString(pathname), err)
	// 		}
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %q: ok", origin(1), GoString(pathname))
	// 	}
	// 	return 0
}

// int fstat(int fd, struct stat *statbuf);
func Xfstat64(t *TLS, fd int32, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v statbuf=%v, (%v:)", t, fd, statbuf, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_FSTAT64, uintptr(fd), statbuf, 0); err != 0 {
	// 		if dmesgs {
	// 			dmesg("%v: fd %d: %v", origin(1), fd, err)
	// 		}
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %d, size %#x: ok\n%+v", origin(1), fd, (*stat.Stat)(unsafe.Pointer(statbuf)).Fst_size, (*stat.Stat)(unsafe.Pointer(statbuf)))
	// 	}
	// 	return 0
}

// void *mremap(void *old_address, size_t old_size, size_t new_size, int flags, ... /* void *new_address */);
func Xmremap(t *TLS, old_address uintptr, old_size, new_size types.Size_t, flags int32, args uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v old_address=%v new_size=%v flags=%v args=%v, (%v:)", t, old_address, new_size, flags, args, origin(2))
	}
	panic(todo(""))
	// 	var arg uintptr
	// 	if args != 0 {
	// 		arg = *(*uintptr)(unsafe.Pointer(args))
	// 	}
	// 	data, _, err := unix.Syscall6(unix.SYS_MREMAP, old_address, uintptr(old_size), uintptr(new_size), uintptr(flags), arg, 0)
	// 	if err != 0 {
	// 		if dmesgs {
	// 			dmesg("%v: %v", origin(1), err)
	// 		}
	// 		t.setErrno(err)
	// 		return ^uintptr(0) // (void*)-1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %#x", origin(1), data)
	// 	}
	// 	return data
}

func Xmmap(t *TLS, addr uintptr, length types.Size_t, prot, flags, fd int32, offset types.Off_t) uintptr {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v fd=%v offset=%v, (%v:)", t, addr, length, fd, offset, origin(2))
	}
	return Xmmap64(t, addr, length, prot, flags, fd, offset)
}

// void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
func Xmmap64(t *TLS, addr uintptr, length types.Size_t, prot, flags, fd int32, offset types.Off_t) uintptr {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v fd=%v offset=%v, (%v:)", t, addr, length, fd, offset, origin(2))
	}
	panic(todo(""))
	// 	data, _, err := unix.Syscall6(unix.SYS_MMAP2, addr, uintptr(length), uintptr(prot), uintptr(flags), uintptr(fd), uintptr(offset>>12))
	// 	if err != 0 {
	// 		if dmesgs {
	// 			dmesg("%v: %v", origin(1), err)
	// 		}
	// 		t.setErrno(err)
	// 		return ^uintptr(0) // (void*)-1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %#x", origin(1), data)
	// 	}
	// 	return data
}

// int ftruncate(int fd, off_t length);
func Xftruncate64(t *TLS, fd int32, length types.Off_t) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v length=%v, (%v:)", t, fd, length, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_FTRUNCATE64, uintptr(fd), uintptr(length), uintptr(length>>32)); err != 0 {
	// 		if dmesgs {
	// 			dmesg("%v: fd %d: %v", origin(1), fd, err)
	// 		}
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %d %#x: ok", origin(1), fd, length)
	// 	}
	// 	return 0
}

// off64_t lseek64(int fd, off64_t offset, int whence);
func Xlseek64(t *TLS, fd int32, offset types.Off_t, whence int32) types.Off_t {
	if __ccgo_strace {
		trc("t=%v fd=%v offset=%v whence=%v, (%v:)", t, fd, offset, whence, origin(2))
	}

	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	n, err := windows.Seek(f.Handle, offset, int(whence))
	if err != nil {
		if dmesgs {
			dmesg("%v: fd %v, off %#x, whence %v: %v", origin(1), f._fd, offset, whenceStr(whence), n)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %v, off %#x, whence %v: ok", origin(1), f._fd, offset, whenceStr(whence))
	}
	return n
}

// int utime(const char *filename, const struct utimbuf *times);
func Xutime(t *TLS, filename, times uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v times=%v, (%v:)", t, times, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_UTIME, filename, times, 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// unsigned int alarm(unsigned int seconds);
func Xalarm(t *TLS, seconds uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v seconds=%v, (%v:)", t, seconds, origin(2))
	}
	panic(todo(""))
	// 	n, _, err := unix.Syscall(unix.SYS_ALARM, uintptr(seconds), 0, 0)
	// 	if err != 0 {
	// 		panic(todo(""))
	// 	}
	//
	// 	return uint32(n)
}

// int getrlimit(int resource, struct rlimit *rlim);
func Xgetrlimit64(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_GETRLIMIT, uintptr(resource), uintptr(rlim), 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// time_t time(time_t *tloc);
func Xtime(t *TLS, tloc uintptr) types.Time_t {
	if __ccgo_strace {
		trc("t=%v tloc=%v, (%v:)", t, tloc, origin(2))
	}
	panic(todo(""))
	// 	n, _, err := unix.Syscall(unix.SYS_TIME, tloc, 0, 0)
	// 	if err != 0 {
	// 		t.setErrno(err)
	// 		return types.Time_t(-1)
	// 	}
	//
	// 	if tloc != 0 {
	// 		*(*types.Time_t)(unsafe.Pointer(tloc)) = types.Time_t(n)
	// 	}
	// 	return types.Time_t(n)
}

// int mkdir(const char *path, mode_t mode);
func Xmkdir(t *TLS, path uintptr, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v mode=%v, (%v:)", t, path, mode, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_MKDIR, path, uintptr(mode), 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %q: ok", origin(1), GoString(path))
	// 	}
	// 	return 0
}

// int symlink(const char *target, const char *linkpath);
func Xsymlink(t *TLS, target, linkpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v linkpath=%v, (%v:)", t, linkpath, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_SYMLINK, target, linkpath, 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %q %q: ok", origin(1), GoString(target), GoString(linkpath))
	// 	}
	// 	return 0
}

// int utimes(const char *filename, const struct timeval times[2]);
func Xutimes(t *TLS, filename, times uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v times=%v, (%v:)", t, times, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_UTIMES, filename, times, 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %q: ok", origin(1), GoString(filename))
	// 	}
	// 	return 0
}

// int unlink(const char *pathname);
func Xunlink(t *TLS, pathname uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v, (%v:)", t, pathname, origin(2))
	}
	err := windows.DeleteFile((*uint16)(unsafe.Pointer(pathname)))
	if err != nil {
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q: ok", origin(1), GoString(pathname))
	}

	return 0

}

// int rmdir(const char *pathname);
func Xrmdir(t *TLS, pathname uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v, (%v:)", t, pathname, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_RMDIR, pathname, 0, 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	if dmesgs {
	// 		dmesg("%v: %q: ok", origin(1), GoString(pathname))
	// 	}
	// 	return 0
}

// int mknod(const char *pathname, mode_t mode, dev_t dev);
func Xmknod(t *TLS, pathname uintptr, mode types.Mode_t, dev types.Dev_t) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v dev=%v, (%v:)", t, pathname, mode, dev, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_MKNOD, pathname, uintptr(mode), uintptr(dev)); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// // int chown(const char *pathname, uid_t owner, gid_t group);
// func Xchown(t *TLS, pathname uintptr, owner types.Uid_t, group types.Gid_t) int32 {
// 	panic(todo(""))
// 	// 	if _, _, err := unix.Syscall(unix.SYS_CHOWN, pathname, uintptr(owner), uintptr(group)); err != 0 {
// 	// 		t.setErrno(err)
// 	// 		return -1
// 	// 	}
// 	//
// 	// 	return 0
// }

// int link(const char *oldpath, const char *newpath);
func Xlink(t *TLS, oldpath, newpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v newpath=%v, (%v:)", t, newpath, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_LINK, oldpath, newpath, 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// int pipe(int pipefd[2]);
func Xpipe(t *TLS, pipefd uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pipefd=%v, (%v:)", t, pipefd, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_PIPE, pipefd, 0, 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// int dup2(int oldfd, int newfd);
func Xdup2(t *TLS, oldfd, newfd int32) int32 {
	if __ccgo_strace {
		trc("t=%v newfd=%v, (%v:)", t, newfd, origin(2))
	}
	panic(todo(""))
	// 	n, _, err := unix.Syscall(unix.SYS_DUP2, uintptr(oldfd), uintptr(newfd), 0)
	// 	if err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return int32(n)
}

// ssize_t readlink(const char *restrict path, char *restrict buf, size_t bufsize);
func Xreadlink(t *TLS, path, buf uintptr, bufsize types.Size_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v buf=%v bufsize=%v, (%v:)", t, buf, bufsize, origin(2))
	}
	panic(todo(""))
	// 	n, _, err := unix.Syscall(unix.SYS_READLINK, path, buf, uintptr(bufsize))
	// 	if err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return types.Ssize_t(n)
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
		flags = os.O_RDONLY
	case "r+":
		flags = os.O_RDWR
	case "w":
		flags = os.O_WRONLY | os.O_CREATE | os.O_TRUNC
	case "w+":
		flags = os.O_RDWR | os.O_CREATE | os.O_TRUNC
	case "a":
		flags = os.O_WRONLY | os.O_CREATE | os.O_APPEND
	case "a+":
		flags = os.O_RDWR | os.O_CREATE | os.O_APPEND
	default:
		panic(m)
	}
	//TODO- flags |= fcntl.O_LARGEFILE
	h, err := windows.Open(GoString(pathname), int(flags), uint32(0666))
	if err != nil {
		t.setErrno(err)
		return 0
	}

	p, _ := wrapFdHandle(h)
	if p != 0 {
		return p
	}
	_ = windows.Close(h)
	t.setErrno(errno.ENOMEM)
	return 0
}

func Xrecv(t *TLS, sockfd uint32, buf uintptr, len, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v buf=%v flags=%v, (%v:)", t, sockfd, buf, flags, origin(2))
	}
	panic(todo(""))
}

func Xsend(t *TLS, sockfd uint32, buf uintptr, len, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v buf=%v flags=%v, (%v:)", t, sockfd, buf, flags, origin(2))
	}
	panic(todo(""))
}

func Xshutdown(t *TLS, sockfd uint32, how int32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v how=%v, (%v:)", t, sockfd, how, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_SHUTDOWN, uintptr(sockfd), uintptr(how), 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

func Xgetpeername(t *TLS, sockfd uint32, addr uintptr, addrlen uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	panic(todo(""))
}

func Xgetsockname(t *TLS, sockfd uint32, addr, addrlen uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addrlen=%v, (%v:)", t, sockfd, addrlen, origin(2))
	}
	panic(todo(""))
}

func Xsocket(t *TLS, domain, type1, protocol int32) uint32 {
	if __ccgo_strace {
		trc("t=%v protocol=%v, (%v:)", t, protocol, origin(2))
	}
	panic(todo(""))
}

func Xbind(t *TLS, sockfd uint32, addr uintptr, addrlen int32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	panic(todo(""))
}

func Xconnect(t *TLS, sockfd uint32, addr uintptr, addrlen int32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	panic(todo(""))
}

func Xlisten(t *TLS, sockfd uint32, backlog int32) int32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v backlog=%v, (%v:)", t, sockfd, backlog, origin(2))
	}
	panic(todo(""))
}

func Xaccept(t *TLS, sockfd uint32, addr uintptr, addrlen uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v sockfd=%v addr=%v addrlen=%v, (%v:)", t, sockfd, addr, addrlen, origin(2))
	}
	panic(todo(""))
}

// struct tm *_localtime32( const __time32_t *sourceTime );
func X_localtime32(_ *TLS, sourceTime uintptr) uintptr {
	loc := getLocalLocation()
	ut := *(*time.Time_t)(unsafe.Pointer(sourceTime))
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

// struct tm *_gmtime32( const __time32_t *sourceTime );
func X_gmtime32(t *TLS, sourceTime uintptr) uintptr {
	r0, _, err := procGmtime32.Call(uintptr(sourceTime))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return uintptr(r0)
}

// LONG SetWindowLongW(
//
//	HWND hWnd,
//	int  nIndex,
//	LONG dwNewLong
//
// );
func XSetWindowLongW(t *TLS, hwnd uintptr, nIndex int32, dwNewLong long) long {
	if __ccgo_strace {
		trc("t=%v hwnd=%v nIndex=%v dwNewLong=%v, (%v:)", t, hwnd, nIndex, dwNewLong, origin(2))
	}
	panic(todo(""))
}

// LONG GetWindowLongW(
//
//	HWND hWnd,
//	int  nIndex
//
// );
func XGetWindowLongW(t *TLS, hwnd uintptr, nIndex int32) long {
	if __ccgo_strace {
		trc("t=%v hwnd=%v nIndex=%v, (%v:)", t, hwnd, nIndex, origin(2))
	}
	panic(todo(""))
}

// LRESULT LRESULT DefWindowProcW(
//
//	HWND   hWnd,
//	UINT   Msg,
//	WPARAM wParam,
//	LPARAM lParam
//
// );
func XDefWindowProcW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XSendMessageTimeoutW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// int _fstat(
//
//	int fd,
//	struct __stat *buffer
//
// );
func X_fstat(t *TLS, fd int32, buffer uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v buffer=%v, (%v:)", t, fd, buffer, origin(2))
	}
	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(EBADF)
		return -1
	}

	var d windows.ByHandleFileInformation
	err := windows.GetFileInformationByHandle(f.Handle, &d)
	if err != nil {
		t.setErrno(EBADF)
		return -1
	}

	var bStat32 = (*stat.X_stat32)(unsafe.Pointer(buffer))
	var accessTime = int64(d.LastAccessTime.HighDateTime)<<32 + int64(d.LastAccessTime.LowDateTime)
	bStat32.Fst_atime = int32(WindowsTickToUnixSeconds(accessTime))
	var modTime = int64(d.LastWriteTime.HighDateTime)<<32 + int64(d.LastWriteTime.LowDateTime)
	bStat32.Fst_mtime = int32(WindowsTickToUnixSeconds(modTime))
	var crTime = int64(d.CreationTime.HighDateTime)<<32 + int64(d.CreationTime.LowDateTime)
	bStat32.Fst_ctime = int32(WindowsTickToUnixSeconds(crTime))
	var fSz = int64(d.FileSizeHigh)<<32 + int64(d.FileSizeLow)
	bStat32.Fst_size = int32(fSz)
	bStat32.Fst_mode = WindowsAttrbiutesToStat(d.FileAttributes)

	return 0
}

func Xstrspn(tls *TLS, s uintptr, c uintptr) size_t { /* strspn.c:6:8: */
	if __ccgo_strace {
		trc("tls=%v s=%v c=%v, (%v:)", tls, s, c, origin(2))
	}
	bp := tls.Alloc(32)
	defer tls.Free(32)

	var a uintptr = s
	*(*[8]size_t)(unsafe.Pointer(bp /* byteset */)) = [8]size_t{0: size_t(0)}

	if !(int32(*(*int8)(unsafe.Pointer(c))) != 0) {
		return size_t(0)
	}
	if !(int32(*(*int8)(unsafe.Pointer(c + 1))) != 0) {
		for ; int32(*(*int8)(unsafe.Pointer(s))) == int32(*(*int8)(unsafe.Pointer(c))); s++ {
		}
		return size_t((int32(s) - int32(a)) / 1)
	}

	for ; *(*int8)(unsafe.Pointer(c)) != 0 && AssignOrPtrUint32(bp+uintptr(size_t(*(*uint8)(unsafe.Pointer(c)))/(uint32(8)*uint32(unsafe.Sizeof(size_t(0)))))*4, size_t(size_t(1))<<(size_t(*(*uint8)(unsafe.Pointer(c)))%(uint32(8)*uint32(unsafe.Sizeof(size_t(0)))))) != 0; c++ {
	}
	for ; *(*int8)(unsafe.Pointer(s)) != 0 && *(*size_t)(unsafe.Pointer(bp + uintptr(size_t(*(*uint8)(unsafe.Pointer(s)))/(uint32(8)*uint32(unsafe.Sizeof(size_t(0)))))*4))&(size_t(size_t(1))<<(size_t(*(*uint8)(unsafe.Pointer(s)))%(uint32(8)*uint32(unsafe.Sizeof(size_t(0)))))) != 0; s++ {
	}
	return size_t((int32(s) - int32(a)) / 1)
}
