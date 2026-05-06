// Copyright 2021 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"strings"
	"unsafe"

	"golang.org/x/sys/unix"
	"modernc.org/libc/fcntl"
	"modernc.org/libc/fts"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/time"
	"modernc.org/libc/utime"
)

type (
	long  = int64
	ulong = uint64
)

// int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact);
func Xsigaction(t *TLS, signum int32, act, oldact uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v signum=%v oldact=%v, (%v:)", t, signum, oldact, origin(2))
	}
	panic(todo(""))
	// if _, _, err := unix.Syscall(unix.SYS_SIGACTION, uintptr(signum), act, oldact); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
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

// time_t time(time_t *tloc);
func Xtime(t *TLS, tloc uintptr) time.Time_t {
	if __ccgo_strace {
		trc("t=%v tloc=%v, (%v:)", t, tloc, origin(2))
	}
	panic(todo(""))
	// n := time.Now().UTC().Unix()
	// if tloc != 0 {
	// 	*(*types.Time_t)(unsafe.Pointer(tloc)) = types.Time_t(n)
	// }
	// return types.Time_t(n)
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

func Xfcntl64(t *TLS, fd, cmd int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v cmd=%v args=%v, (%v:)", t, cmd, args, origin(2))
	}
	var arg uintptr
	if args != 0 {
		arg = *(*uintptr)(unsafe.Pointer(args))
	}
	n, _, err := unix.Syscall(unix.SYS_FCNTL, uintptr(fd), uintptr(cmd), arg)
	if err != 0 {
		if dmesgs {
			dmesg("%v: fd %v cmd %v", origin(1), fcntlCmdStr(fd), cmd)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %d %s %#x: %d", origin(1), fd, fcntlCmdStr(cmd), arg, n)
	}
	return int32(n)
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
	if _, _, err := unix.Syscall(unix.SYS_CHOWN, pathname, uintptr(owner), uintptr(group)); err != 0 {
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
	panic(todo(""))
	// if _, _, err := unix.Syscall(unix.SYS_LINK, oldpath, newpath, 0); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
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

// int getnameinfo(const struct sockaddr * restrict sa, socklen_t salen, char * restrict host, socklen_t hostlen, char * restrict serv,  socklen_t servlen, int flags);
func Xgetnameinfo(tls *TLS, sa1 uintptr, sl socklen_t, node uintptr, nodelen socklen_t, serv uintptr, servlen socklen_t, flags int32) int32 { /* getnameinfo.c:125:5: */
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
	if _, _, err := unix.Syscall(unix.SYS_GETRLIMIT, uintptr(resource), uintptr(rlim), 0); err != 0 {
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
		Ffts_pathlen: uint32(len(path)),
		Ffts_statp:   statp,
		Ffts_errno:   int32(err),
	}
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

func AtomicLoadPInt8(addr uintptr) (val int8) {
	return int8(a_load_8(addr))
}

func AtomicLoadPInt16(addr uintptr) (val int16) {
	return int16(a_load_16(addr))
}

func AtomicLoadPUint8(addr uintptr) byte {
	return byte(a_load_8(addr))
}

func AtomicLoadPUint16(addr uintptr) uint16 {
	return uint16(a_load_16(addr))
}

func AtomicLoadNUint8(ptr uintptr, memorder int32) uint8 {
	return byte(a_load_8(ptr))
}
