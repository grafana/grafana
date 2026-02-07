// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/unix"
	"modernc.org/libc/fcntl"
	"modernc.org/libc/signal"
	"modernc.org/libc/stdio"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/utime"
)

// #define FE_UPWARD           0x00400000
// #define FE_DOWNWARD         0x00800000
const FE_UPWARD = 0x00400000
const FE_DOWNWARD = 0x00800000

// int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);
func Xsigaction(t *TLS, signum int32, act, oldact uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v signum=%v oldact=%v, (%v:)", t, signum, oldact, origin(2))
	}
	var kact, koldact uintptr
	if act != 0 {
		sz := int(unsafe.Sizeof(signal.X__sigaction{}))
		kact = t.Alloc(sz)
		defer t.Free(sz)
		(*signal.X__sigaction)(unsafe.Pointer(kact)).F__sigaction_u.F__sa_handler = (*signal.Sigaction)(unsafe.Pointer(act)).F__sigaction_u.F__sa_handler
		(*signal.X__sigaction)(unsafe.Pointer(kact)).Fsa_flags = (*signal.Sigaction)(unsafe.Pointer(act)).Fsa_flags
		Xmemcpy(t, kact+unsafe.Offsetof(signal.X__sigaction{}.Fsa_mask), act+unsafe.Offsetof(signal.Sigaction{}.Fsa_mask), types.Size_t(unsafe.Sizeof(signal.Sigset_t(0))))
	}
	if oldact != 0 {
		panic(todo(""))
	}

	if _, _, err := unix.Syscall6(unix.SYS_SIGACTION, uintptr(signum), kact, koldact, unsafe.Sizeof(signal.Sigset_t(0)), 0, 0); err != 0 {
		t.setErrno(err)
		return -1
	}

	if oldact != 0 {
		panic(todo(""))
	}

	return 0
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
	case fcntl.F_GETLK, fcntl.F_SETLK, fcntl.F_SETLKW:
		p = *(*uintptr)(unsafe.Pointer(args))
		err = unix.FcntlFlock(uintptr(fd), int(cmd), (*unix.Flock_t)(unsafe.Pointer(p)))
	case fcntl.F_GETFL, fcntl.F_FULLFSYNC:
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

// int lstat(const char *pathname, struct stat *statbuf);
func Xlstat64(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v statbuf=%v, (%v:)", t, statbuf, origin(2))
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
		trc("t=%v statbuf=%v, (%v:)", t, statbuf, origin(2))
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

// int fstatfs(int fd, struct statfs *buf);
func Xfstatfs(t *TLS, fd int32, buf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v, (%v:)", t, fd, buf, origin(2))
	}
	if err := unix.Fstatfs(int(fd), (*unix.Statfs_t)(unsafe.Pointer(buf))); err != nil {
		if dmesgs {
			dmesg("%v: %v: %v FAIL", origin(1), fd, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %v: ok", origin(1), fd)
	}
	return 0
}

// int statfs(const char *path, struct statfs *buf);
func Xstatfs(t *TLS, path uintptr, buf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v buf=%v, (%v:)", t, path, buf, origin(2))
	}
	if err := unix.Statfs(GoString(path), (*unix.Statfs_t)(unsafe.Pointer(buf))); err != nil {
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

// int fstat(int fd, struct stat *statbuf);
func Xfstat64(t *TLS, fd int32, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v statbuf=%v, (%v:)", t, fd, statbuf, origin(2))
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
		dmesg("%v: ok", origin(1))
	}
	return types.Off_t(n)
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

// unsigned int alarm(unsigned int seconds);
func Xalarm(t *TLS, seconds uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v seconds=%v, (%v:)", t, seconds, origin(2))
	}
	panic(todo(""))
	// n, _, err := unix.Syscall(unix.SYS_ALARM, uintptr(seconds), 0, 0)
	// if err != 0 {
	// 	panic(todo(""))
	// }

	// return uint32(n)
}

// time_t time(time_t *tloc);
func Xtime(t *TLS, tloc uintptr) types.Time_t {
	if __ccgo_strace {
		trc("t=%v tloc=%v, (%v:)", t, tloc, origin(2))
	}
	n := time.Now().UTC().Unix()
	if tloc != 0 {
		*(*types.Time_t)(unsafe.Pointer(tloc)) = types.Time_t(n)
	}
	return types.Time_t(n)
}

// // int getrlimit(int resource, struct rlimit *rlim);
// func Xgetrlimit64(t *TLS, resource int32, rlim uintptr) int32 {
// 	if _, _, err := unix.Syscall(unix.SYS_GETRLIMIT, uintptr(resource), uintptr(rlim), 0); err != 0 {
// 		t.setErrno(err)
// 		return -1
// 	}
//
// 	return 0
// }

// int mkdir(const char *path, mode_t mode);
func Xmkdir(t *TLS, path uintptr, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v mode=%v, (%v:)", t, path, mode, origin(2))
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

// int symlink(const char *target, const char *linkpath);
func Xsymlink(t *TLS, target, linkpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v linkpath=%v, (%v:)", t, linkpath, origin(2))
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
		trc("t=%v pathname=%v mode=%v, (%v:)", t, pathname, mode, origin(2))
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

// int utimes(const char *filename, const struct timeval times[2]);
func Xutimes(t *TLS, filename, times uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v times=%v, (%v:)", t, times, origin(2))
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

// int unlink(const char *pathname);
func Xunlink(t *TLS, pathname uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v, (%v:)", t, pathname, origin(2))
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

// int access(const char *pathname, int mode);
func Xaccess(t *TLS, pathname uintptr, mode int32) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v, (%v:)", t, pathname, mode, origin(2))
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
	panic(todo(""))
	// if _, _, err := unix.Syscall(unix.SYS_MKNOD, pathname, uintptr(mode), uintptr(dev)); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
}

// int chown(const char *pathname, uid_t owner, gid_t group);
func Xchown(t *TLS, pathname uintptr, owner types.Uid_t, group types.Gid_t) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v owner=%v group=%v, (%v:)", t, pathname, owner, group, origin(2))
	}
	panic(todo(""))
	// if _, _, err := unix.Syscall(unix.SYS_CHOWN, pathname, uintptr(owner), uintptr(group)); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
}

// int link(const char *oldpath, const char *newpath);
func Xlink(t *TLS, oldpath, newpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v newpath=%v, (%v:)", t, newpath, origin(2))
	}
	if _, _, err := unix.Syscall(unix.SYS_LINK, oldpath, newpath, 0); err != 0 {
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
	panic(todo(""))
	// n, _, err := unix.Syscall(unix.SYS_DUP2, uintptr(oldfd), uintptr(newfd), 0)
	// if err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return int32(n)
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

func Xrewinddir(tls *TLS, f uintptr) {
	if __ccgo_strace {
		trc("tls=%v f=%v, (%v:)", tls, f, origin(2))
	}
	Xfseek(tls, f, 0, stdio.SEEK_SET)
}
