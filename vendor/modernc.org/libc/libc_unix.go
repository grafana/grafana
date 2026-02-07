// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build unix && !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

package libc // import "modernc.org/libc"

import (
	"bufio"
	// "encoding/hex"
	"math"
	"math/rand"
	"os"
	gosignal "os/signal"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	guuid "github.com/google/uuid"
	"github.com/ncruces/go-strftime"
	"golang.org/x/sys/unix"
	"modernc.org/libc/errno"
	"modernc.org/libc/grp"
	"modernc.org/libc/limits"
	"modernc.org/libc/poll"
	"modernc.org/libc/pwd"
	"modernc.org/libc/signal"
	"modernc.org/libc/stdio"
	"modernc.org/libc/stdlib"
	"modernc.org/libc/sys/types"
	ctime "modernc.org/libc/time"
)

var staticGetpwnam pwd.Passwd

func init() {
	atExit = append(atExit, func() { closePasswd(&staticGetpwnam) })
}

// sighandler_t signal(int signum, sighandler_t handler);
func Xsignal(t *TLS, signum int32, handler uintptr) uintptr { //TODO use sigaction?
	if __ccgo_strace {
		trc("t=%v signum=%v handler=%v, (%v:)", t, signum, handler, origin(2))
	}
	signalsMu.Lock()

	defer signalsMu.Unlock()

	r := signals[signum]
	signals[signum] = handler
	switch handler {
	case signal.SIG_DFL:
		panic(todo("%v %#x", unix.Signal(signum), handler))
	case signal.SIG_IGN:
		switch r {
		case signal.SIG_DFL:
			gosignal.Ignore(unix.Signal(signum)) //TODO
		case signal.SIG_IGN:
			gosignal.Ignore(unix.Signal(signum))
		default:
			panic(todo("%v %#x", unix.Signal(signum), handler))
		}
	default:
		switch r {
		case signal.SIG_DFL:
			c := make(chan os.Signal, 1)
			gosignal.Notify(c, unix.Signal(signum))
			go func() { //TODO mechanism to stop/cancel
				for {
					<-c
					var f func(*TLS, int32)
					*(*uintptr)(unsafe.Pointer(&f)) = handler
					tls := NewTLS()
					f(tls, signum)
					tls.Close()
				}
			}()
		case signal.SIG_IGN:
			panic(todo("%v %#x", unix.Signal(signum), handler))
		default:
			panic(todo("%v %#x", unix.Signal(signum), handler))
		}
	}
	return r
}

// void rewind(FILE *stream);
func Xrewind(t *TLS, stream uintptr) {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	Xfseek(t, stream, 0, stdio.SEEK_SET)
}

// int putchar(int c);
func Xputchar(t *TLS, c int32) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	if _, err := write([]byte{byte(c)}); err != nil {
		return stdio.EOF
	}

	return int32(c)
}

// int gethostname(char *name, size_t len);
func Xgethostname(t *TLS, name uintptr, slen types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v name=%v slen=%v, (%v:)", t, name, slen, origin(2))
	}

	if slen == 0 {
		return 0
	}

	s, err := os.Hostname()
	if err != nil {
		panic(todo(""))
	}

	n := len(s)
	if len(s) >= int(slen) {
		n = int(slen) - 1
	}
	sh := (*reflect.StringHeader)(unsafe.Pointer(&s))
	copy((*RawMem)(unsafe.Pointer(name))[:n:n], (*RawMem)(unsafe.Pointer(sh.Data))[:n:n])
	*(*byte)(unsafe.Pointer(name + uintptr(n))) = 0
	return 0
}

// int remove(const char *pathname);
func Xremove(t *TLS, pathname uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v, (%v:)", t, pathname, origin(2))
	}
	if err := os.Remove(GoString(pathname)); err != nil {
		t.setErrno(err)
		return -1
	}
	return 0
}

// long pathconf(const char *path, int name);
func Xpathconf(t *TLS, path uintptr, name int32) long {
	if __ccgo_strace {
		trc("t=%v path=%v name=%v, (%v:)", t, path, name, origin(2))
	}
	panic(todo(""))
}

// ssize_t recvfrom(int sockfd, void *buf, size_t len, int flags, struct sockaddr *src_addr, socklen_t *addrlen);
func Xrecvfrom(t *TLS, sockfd int32, buf uintptr, len types.Size_t, flags int32, src_addr, addrlen uintptr) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v sockfd=%v buf=%v len=%v flags=%v addrlen=%v, (%v:)", t, sockfd, buf, len, flags, addrlen, origin(2))
	}
	panic(todo(""))
}

// ssize_t sendto(int sockfd, const void *buf, size_t len, int flags, const struct sockaddr *dest_addr, socklen_t addrlen);
func Xsendto(t *TLS, sockfd int32, buf uintptr, len types.Size_t, flags int32, src_addr uintptr, addrlen socklen_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v sockfd=%v buf=%v len=%v flags=%v src_addr=%v addrlen=%v, (%v:)", t, sockfd, buf, len, flags, src_addr, addrlen, origin(2))
	}
	panic(todo(""))
}

// void srand48(long int seedval);
func Xsrand48(t *TLS, seedval long) {
	if __ccgo_strace {
		trc("t=%v seedval=%v, (%v:)", t, seedval, origin(2))
	}
	panic(todo(""))
}

// long int lrand48(void);
func Xlrand48(t *TLS) long {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// ssize_t sendmsg(int sockfd, const struct msghdr *msg, int flags);
func Xsendmsg(t *TLS, sockfd int32, msg uintptr, flags int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v sockfd=%v msg=%v flags=%v, (%v:)", t, sockfd, msg, flags, origin(2))
	}
	panic(todo(""))
}

// int poll(struct pollfd *fds, nfds_t nfds, int timeout);
func Xpoll(t *TLS, fds uintptr, nfds poll.Nfds_t, timeout int32) int32 {
	if __ccgo_strace {
		trc("t=%v fds=%v nfds=%v timeout=%v, (%v:)", t, fds, nfds, timeout, origin(2))
	}
	if nfds == 0 {
		panic(todo(""))
	}

	// if dmesgs {
	// 	dmesg("%v: %#x %v %v, %+v", origin(1), fds, nfds, timeout, (*[1000]unix.PollFd)(unsafe.Pointer(fds))[:nfds:nfds])
	// }
	n, err := unix.Poll((*[1000]unix.PollFd)(unsafe.Pointer(fds))[:nfds:nfds], int(timeout))
	// if dmesgs {
	// 	dmesg("%v: %v %v", origin(1), n, err)
	// }
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return int32(n)
}

// struct cmsghdr *CMSG_NXTHDR(struct msghdr *msgh, struct cmsghdr *cmsg);
func X__cmsg_nxthdr(t *TLS, msgh, cmsg uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v cmsg=%v, (%v:)", t, cmsg, origin(2))
	}
	panic(todo(""))
}

// wchar_t *wcschr(const wchar_t *wcs, wchar_t wc);
func Xwcschr(t *TLS, wcs uintptr, wc wchar_t) wchar_t {
	if __ccgo_strace {
		trc("t=%v wcs=%v wc=%v, (%v:)", t, wcs, wc, origin(2))
	}
	panic(todo(""))
}

// gid_t getegid(void);
func Xgetegid(t *TLS) types.Gid_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// gid_t getgid(void);
func Xgetgid(t *TLS) types.Gid_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// void *shmat(int shmid, const void *shmaddr, int shmflg);
func Xshmat(t *TLS, shmid int32, shmaddr uintptr, shmflg int32) uintptr {
	if __ccgo_strace {
		trc("t=%v shmid=%v shmaddr=%v shmflg=%v, (%v:)", t, shmid, shmaddr, shmflg, origin(2))
	}
	panic(todo(""))
}

// int shmctl(int shmid, int cmd, struct shmid_ds *buf);
func Xshmctl(t *TLS, shmid, cmd int32, buf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v cmd=%v buf=%v, (%v:)", t, cmd, buf, origin(2))
	}
	panic(todo(""))
}

// int shmdt(const void *shmaddr);
func Xshmdt(t *TLS, shmaddr uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v shmaddr=%v, (%v:)", t, shmaddr, origin(2))
	}
	panic(todo(""))
}

// int getresuid(uid_t *ruid, uid_t *euid, uid_t *suid);
func Xgetresuid(t *TLS, ruid, euid, suid uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v suid=%v, (%v:)", t, suid, origin(2))
	}
	panic(todo(""))
}

// int getresgid(gid_t *rgid, gid_t *egid, gid_t *sgid);
func Xgetresgid(t *TLS, rgid, egid, sgid uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v sgid=%v, (%v:)", t, sgid, origin(2))
	}
	panic(todo(""))
}

// FILE *tmpfile(void);
func Xtmpfile(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	f, err := os.CreateTemp("", "tmpfile-")
	if err != nil {
		t.setErrno(err)
		return 0
	}

	cf := newFile(t, int32(f.Fd()))
	AtExit(func() {
		nm := f.Name()
		file(cf).close(t)
		os.Remove(nm)
	})

	return cf
}

// FILE *fdopen(int fd, const char *mode);
func Xfdopen(t *TLS, fd int32, mode uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v fd=%v mode=%v, (%v:)", t, fd, GoString(mode), origin(2))
	}
	m := strings.ReplaceAll(GoString(mode), "b", "")
	switch m {
	case
		"a",
		"a+",
		"r",
		"r+",
		"w",
		"w+":
	default:
		t.setErrno(errno.EINVAL)
		return 0
	}

	p := newFile(t, fd)
	if p == 0 {
		t.setErrno(errno.EINVAL)
		return 0
	}
	return p
}

// struct passwd *getpwnam(const char *name);
func Xgetpwnam(t *TLS, name uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v name=%v, (%v:)", t, name, origin(2))
	}
	f, err := os.Open("/etc/passwd")
	if err != nil {
		panic(todo("", err))
	}

	defer f.Close()

	sname := GoString(name)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:0:root:/root:/bin/bash"
		a := strings.Split(s, ":")
		if len(a) < 7 {
			panic(todo(""))
		}

		if a[0] == sname {
			uid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			gid, err := strconv.Atoi(a[3])
			if err != nil {
				panic(todo(""))
			}

			closePasswd(&staticGetpwnam)
			gecos := a[4]
			if strings.Contains(gecos, ",") {
				a := strings.Split(gecos, ",")
				gecos = a[0]
			}
			initPasswd(t, &staticGetpwnam, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6])
			return uintptr(unsafe.Pointer(&staticGetpwnam))
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	return 0
}

// int getpwnam_r(char *name, struct passwd *pwd, char *buf, size_t buflen, struct passwd **result);
func Xgetpwnam_r(t *TLS, name, cpwd, buf uintptr, buflen types.Size_t, result uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v buflen=%v result=%v, (%v:)", t, buf, buflen, result, origin(2))
	}
	f, err := os.Open("/etc/passwd")
	if err != nil {
		panic(todo("", err))
	}

	defer f.Close()

	sname := GoString(name)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:0:root:/root:/bin/bash"
		a := strings.Split(s, ":")
		if len(a) < 7 {
			panic(todo("%q", s))
		}

		if a[0] == sname {
			uid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			gid, err := strconv.Atoi(a[3])
			if err != nil {
				panic(todo(""))
			}

			gecos := a[4]
			if strings.Contains(gecos, ",") {
				a := strings.Split(gecos, ",")
				gecos = a[0]
			}
			var v pwd.Passwd
			if initPasswd2(t, buf, buflen, &v, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6]) {
				*(*pwd.Passwd)(unsafe.Pointer(cpwd)) = v
				*(*uintptr)(unsafe.Pointer(result)) = cpwd
				return 0
			}

			*(*uintptr)(unsafe.Pointer(result)) = 0
			return errno.ERANGE
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	*(*uintptr)(unsafe.Pointer(result)) = 0
	return 0
}

func init() {
	atExit = append(atExit, func() { closeGroup(&staticGetgrgid) })
}

var staticGetgrgid grp.Group

// struct group *getgrgid(gid_t gid);
func Xgetgrgid(t *TLS, gid uint32) uintptr {
	if __ccgo_strace {
		trc("t=%v gid=%v, (%v:)", t, gid, origin(2))
	}
	f, err := os.Open("/etc/group")
	if err != nil {
		panic(todo(""))
	}

	defer f.Close()

	sid := strconv.Itoa(int(gid))
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:"
		a := strings.Split(s, ":")
		if len(a) < 4 {
			panic(todo("%q", s))
		}

		if a[2] == sid {
			closeGroup(&staticGetgrgid)
			var names []string
			if a[3] != "" {
				names = strings.Split(a[3], ",")
			}
			initGroup(t, &staticGetgrgid, a[0], a[1], gid, names)
			return uintptr(unsafe.Pointer(&staticGetgrgid))
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	return 0
}

// int getgrgid_r(gid_t gid, struct group *grp, char *buf, size_t buflen, struct group **result);
func Xgetgrgid_r(t *TLS, gid uint32, pGrp, buf uintptr, buflen types.Size_t, result uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v gid=%v buf=%v buflen=%v result=%v, (%v:)", t, gid, buf, buflen, result, origin(2))
	}
	f, err := os.Open("/etc/group")
	if err != nil {
		panic(todo(""))
	}

	defer f.Close()

	sid := strconv.Itoa(int(gid))
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:"
		a := strings.Split(s, ":")
		if len(a) < 4 {
			panic(todo("%q", s))
		}

		if a[2] == sid {
			var names []string
			if a[3] != "" {
				names = strings.Split(a[3], ",")
			}
			var x grp.Group
			if initGroup2(buf, buflen, &x, a[0], a[1], gid, names) {
				*(*grp.Group)(unsafe.Pointer(pGrp)) = x
				*(*uintptr)(unsafe.Pointer(result)) = pGrp
				return 0
			}

			*(*uintptr)(unsafe.Pointer(result)) = 0
			return 0
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	*(*uintptr)(unsafe.Pointer(result)) = 0
	return 0
}

func initPasswd2(t *TLS, buf uintptr, buflen types.Size_t, p *pwd.Passwd, name, pwd string, uid, gid uint32, gecos, dir, shell string) bool {
	p.Fpw_name, buf, buflen = bufString(buf, buflen, name)
	if buf == 0 {
		return false
	}

	p.Fpw_passwd, buf, buflen = bufString(buf, buflen, pwd)
	if buf == 0 {
		return false
	}

	p.Fpw_uid = uid
	p.Fpw_gid = gid
	if buf == 0 {
		return false
	}

	p.Fpw_gecos, buf, buflen = bufString(buf, buflen, gecos)
	if buf == 0 {
		return false
	}

	p.Fpw_dir, buf, buflen = bufString(buf, buflen, dir)
	if buf == 0 {
		return false
	}

	p.Fpw_shell, buf, buflen = bufString(buf, buflen, shell)
	return buf != 0
}

func bufString(buf uintptr, buflen types.Size_t, s string) (uintptr, uintptr, types.Size_t) {
	buf0 := buf
	rq := len(s) + 1
	if rq > int(buflen) {
		return 0, 0, 0
	}

	copy((*RawMem)(unsafe.Pointer(buf))[:len(s):len(s)], s)
	buf += uintptr(len(s))
	*(*byte)(unsafe.Pointer(buf)) = 0
	return buf0, buf + 1, buflen - types.Size_t(rq)
}

func closeGroup(p *grp.Group) {
	Xfree(nil, p.Fgr_name)
	Xfree(nil, p.Fgr_passwd)
	if p := p.Fgr_mem; p != 0 {
		for {
			q := *(*uintptr)(unsafe.Pointer(p))
			if q == 0 {
				break
			}

			Xfree(nil, q)
			p += unsafe.Sizeof(uintptr(0))
		}
	}
	*p = grp.Group{}
}

func initGroup(t *TLS, p *grp.Group, name, pwd string, gid uint32, names []string) {
	p.Fgr_name = cString(t, name)
	p.Fgr_passwd = cString(t, pwd)
	p.Fgr_gid = gid
	a := Xcalloc(t, 1, types.Size_t(unsafe.Sizeof(uintptr(0)))*types.Size_t((len(names)+1)))
	if a == 0 {
		panic("OOM")
	}

	for p := a; len(names) != 0; p += unsafe.Sizeof(uintptr(0)) {
		*(*uintptr)(unsafe.Pointer(p)) = cString(t, names[0])
		names = names[1:]
	}
	p.Fgr_mem = a
}

func initGroup2(buf uintptr, buflen types.Size_t, p *grp.Group, name, pwd string, gid uint32, names []string) bool {
	p.Fgr_name, buf, buflen = bufString(buf, buflen, name)
	if buf == 0 {
		return false
	}

	p.Fgr_passwd, buf, buflen = bufString(buf, buflen, pwd)
	if buf == 0 {
		return false
	}

	p.Fgr_gid = gid
	rq := unsafe.Sizeof(uintptr(0)) * uintptr(len(names)+1)
	if rq > uintptr(buflen) {
		return false
	}

	a := buf
	buf += rq
	for ; len(names) != 0; buf += unsafe.Sizeof(uintptr(0)) {
		if len(names[0])+1 > int(buflen) {
			return false
		}

		*(*uintptr)(unsafe.Pointer(buf)), buf, buflen = bufString(buf, buflen, names[0])
		names = names[1:]
	}
	*(*uintptr)(unsafe.Pointer(buf)) = 0
	p.Fgr_mem = a
	return true
}

func init() {
	atExit = append(atExit, func() { closeGroup(&staticGetgrgid) })
}

var staticGetpwuid pwd.Passwd

func init() {
	atExit = append(atExit, func() { closePasswd(&staticGetpwuid) })
}

func closePasswd(p *pwd.Passwd) {
	Xfree(nil, p.Fpw_name)
	Xfree(nil, p.Fpw_passwd)
	Xfree(nil, p.Fpw_gecos)
	Xfree(nil, p.Fpw_dir)
	Xfree(nil, p.Fpw_shell)
	*p = pwd.Passwd{}
}

var staticGetgrnam grp.Group

func init() {
	atExit = append(atExit, func() { closeGroup(&staticGetgrnam) })
}

// struct passwd *getpwuid(uid_t uid);
func Xgetpwuid(t *TLS, uid uint32) uintptr {
	if __ccgo_strace {
		trc("t=%v uid=%v, (%v:)", t, uid, origin(2))
	}
	f, err := os.Open("/etc/passwd")
	if err != nil {
		panic(todo("", err))
	}

	defer f.Close()

	sid := strconv.Itoa(int(uid))
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if len(s) == 0 || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:0:root:/root:/bin/bash"
		a := strings.Split(s, ":")
		if len(a) < 7 {
			panic(todo("%q", s))
		}

		if a[2] == sid {
			uid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			gid, err := strconv.Atoi(a[3])
			if err != nil {
				panic(todo(""))
			}

			closePasswd(&staticGetpwuid)
			gecos := a[4]
			if strings.Contains(gecos, ",") {
				a := strings.Split(gecos, ",")
				gecos = a[0]
			}
			initPasswd(t, &staticGetpwuid, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6])
			return uintptr(unsafe.Pointer(&staticGetpwuid))
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	return 0
}

func initPasswd(t *TLS, p *pwd.Passwd, name, pwd string, uid, gid uint32, gecos, dir, shell string) {
	p.Fpw_name = cString(t, name)
	p.Fpw_passwd = cString(t, pwd)
	p.Fpw_uid = uid
	p.Fpw_gid = gid
	p.Fpw_gecos = cString(t, gecos)
	p.Fpw_dir = cString(t, dir)
	p.Fpw_shell = cString(t, shell)
}

// struct group *getgrnam(const char *name);
func Xgetgrnam(t *TLS, name uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v name=%v, (%v:)", t, name, origin(2))
	}
	f, err := os.Open("/etc/group")
	if err != nil {
		panic(todo(""))
	}

	defer f.Close()

	sname := GoString(name)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if len(s) == 0 || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:"
		a := strings.Split(s, ":")
		if len(a) < 4 {
			panic(todo("%q", s))
		}

		if a[0] == sname {
			closeGroup(&staticGetgrnam)
			gid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			var names []string
			if a[3] != "" {
				names = strings.Split(a[3], ",")
			}
			initGroup(t, &staticGetgrnam, a[0], a[1], uint32(gid), names)
			return uintptr(unsafe.Pointer(&staticGetgrnam))
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	return 0
}

// int getgrnam_r(const char *name, struct group *grp, char *buf, size_t buflen, struct group **result);
func Xgetgrnam_r(t *TLS, name, pGrp, buf uintptr, buflen types.Size_t, result uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v buflen=%v result=%v, (%v:)", t, buf, buflen, result, origin(2))
	}
	f, err := os.Open("/etc/group")
	if err != nil {
		panic(todo(""))
	}

	defer f.Close()

	sname := GoString(name)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if len(s) == 0 || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:"
		a := strings.Split(s, ":")
		if len(a) < 4 {
			panic(todo("%q", s))
		}

		if a[0] == sname {
			gid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			var names []string
			if a[3] != "" {
				names = strings.Split(a[3], ",")
			}
			var x grp.Group
			if initGroup2(buf, buflen, &x, a[0], a[1], uint32(gid), names) {
				*(*grp.Group)(unsafe.Pointer(pGrp)) = x
				*(*uintptr)(unsafe.Pointer(result)) = pGrp
				return 0
			}

			*(*uintptr)(unsafe.Pointer(result)) = 0
			return 0
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	*(*uintptr)(unsafe.Pointer(result)) = 0
	return 0
}

// int getpwuid_r(uid_t uid, struct passwd *pwd, char *buf, size_t buflen, struct passwd **result);
func Xgetpwuid_r(t *TLS, uid types.Uid_t, cpwd, buf uintptr, buflen types.Size_t, result uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v uid=%v buf=%v buflen=%v result=%v, (%v:)", t, uid, buf, buflen, result, origin(2))
	}
	f, err := os.Open("/etc/passwd")
	if err != nil {
		panic(todo("", err))
	}

	defer f.Close()

	sid := strconv.Itoa(int(uid))
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		s := strings.TrimSpace(sc.Text())
		if len(s) == 0 || strings.HasPrefix(s, "#") {
			continue
		}

		// eg. "root:x:0:0:root:/root:/bin/bash"
		a := strings.Split(s, ":")
		if len(a) < 7 {
			panic(todo("%q", s))
		}

		if a[2] == sid {
			uid, err := strconv.Atoi(a[2])
			if err != nil {
				panic(todo(""))
			}

			gid, err := strconv.Atoi(a[3])
			if err != nil {
				panic(todo(""))
			}

			gecos := a[4]
			if strings.Contains(gecos, ",") {
				a := strings.Split(gecos, ",")
				gecos = a[0]
			}
			var v pwd.Passwd
			if initPasswd2(t, buf, buflen, &v, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6]) {
				*(*pwd.Passwd)(unsafe.Pointer(cpwd)) = v
				*(*uintptr)(unsafe.Pointer(result)) = cpwd
				return 0
			}

			*(*uintptr)(unsafe.Pointer(result)) = 0
			return errno.ERANGE
		}
	}

	if sc.Err() != nil {
		panic(todo(""))
	}

	*(*uintptr)(unsafe.Pointer(result)) = 0
	return 0
}

// int mkostemp(char *template, int flags);
func Xmkostemp(t *TLS, template uintptr, flags int32) int32 {
	if __ccgo_strace {
		trc("t=%v template=%v flags=%v, (%v:)", t, template, flags, origin(2))
	}
	len := uintptr(Xstrlen(t, template))
	x := template + uintptr(len-6)
	for i := uintptr(0); i < 6; i++ {
		if *(*byte)(unsafe.Pointer(x + i)) != 'X' {
			t.setErrno(errno.EINVAL)
			return -1
		}
	}

	fd, err := tempFile(template, x, flags)
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return int32(fd)
}

// void uuid_generate_random(uuid_t out);
func Xuuid_generate_random(t *TLS, out uintptr) {
	if __ccgo_strace {
		trc("t=%v out=%v, (%v:)", t, out, origin(2))
	}
	x := guuid.New()
	copy((*RawMem)(unsafe.Pointer(out))[:], x[:])
}

// void uuid_unparse(uuid_t uu, char *out);
func Xuuid_unparse(t *TLS, uu, out uintptr) {
	if __ccgo_strace {
		trc("t=%v out=%v, (%v:)", t, out, origin(2))
	}
	s := (*guuid.UUID)(unsafe.Pointer(uu)).String()
	copy((*RawMem)(unsafe.Pointer(out))[:], s)
	*(*byte)(unsafe.Pointer(out + uintptr(len(s)))) = 0
}

// no longer used?
// var staticRandomData = &rand.Rand{}

// char *initstate(unsigned seed, char *state, size_t size);
func Xinitstate(t *TLS, seed uint32, statebuf uintptr, statelen types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v seed=%v statebuf=%v statelen=%v, (%v:)", t, seed, statebuf, statelen, origin(2))
	}
	// staticRandomData = rand.New(rand.NewSource(int64(seed)))
	_ = rand.New(rand.NewSource(int64(seed)))
	return 0
}

// char *setstate(const char *state);
func Xsetstate(t *TLS, state uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v state=%v, (%v:)", t, state, origin(2))
	}
	t.setErrno(errno.EINVAL) //TODO
	return 0
}

// The initstate_r() function is like initstate(3) except that it initializes
// the state in the object pointed to by buf, rather than initializing the
// global state  variable.   Before  calling this function, the buf.state field
// must be initialized to NULL.  The initstate_r() function records a pointer
// to the statebuf argument inside the structure pointed to by buf.  Thus,
// state‐ buf should not be deallocated so long as buf is still in use.  (So,
// statebuf should typically be allocated as a static variable, or allocated on
// the heap using malloc(3) or similar.)
//
// char *initstate_r(unsigned int seed, char *statebuf, size_t statelen, struct random_data *buf);
func Xinitstate_r(t *TLS, seed uint32, statebuf uintptr, statelen types.Size_t, buf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v seed=%v statebuf=%v statelen=%v buf=%v, (%v:)", t, seed, statebuf, statelen, buf, origin(2))
	}
	if buf == 0 {
		panic(todo(""))
	}

	randomDataMu.Lock()

	defer randomDataMu.Unlock()

	randomData[buf] = rand.New(rand.NewSource(int64(seed)))
	return 0
}

var (
	randomData   = map[uintptr]*rand.Rand{}
	randomDataMu sync.Mutex
)

// int mkstemps(char *template, int suffixlen);
func Xmkstemps(t *TLS, template uintptr, suffixlen int32) int32 {
	if __ccgo_strace {
		trc("t=%v template=%v suffixlen=%v, (%v:)", t, template, suffixlen, origin(2))
	}
	return Xmkstemps64(t, template, suffixlen)
}

// int mkstemps(char *template, int suffixlen);
func Xmkstemps64(t *TLS, template uintptr, suffixlen int32) int32 {
	if __ccgo_strace {
		trc("t=%v template=%v suffixlen=%v, (%v:)", t, template, suffixlen, origin(2))
	}
	len := uintptr(Xstrlen(t, template))
	x := template + uintptr(len-6) - uintptr(suffixlen)
	for i := uintptr(0); i < 6; i++ {
		if *(*byte)(unsafe.Pointer(x + i)) != 'X' {
			t.setErrno(errno.EINVAL)
			return -1
		}
	}

	fd, err := tempFile(template, x, 0)
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return int32(fd)
}

// int mkstemp(char *template);
func Xmkstemp(t *TLS, template uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v template=%v, (%v:)", t, template, origin(2))
	}
	return Xmkstemp64(t, template)
}

// int mkstemp(char *template);
func Xmkstemp64(t *TLS, template uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v template=%v, (%v:)", t, template, origin(2))
	}
	return Xmkstemps64(t, template, 0)
}

// int random_r(struct random_data *buf, int32_t *result);
func Xrandom_r(t *TLS, buf, result uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v result=%v, (%v:)", t, result, origin(2))
	}
	randomDataMu.Lock()

	defer randomDataMu.Unlock()

	mr := randomData[buf]
	if stdlib.RAND_MAX != math.MaxInt32 {
		panic(todo(""))
	}
	*(*int32)(unsafe.Pointer(result)) = mr.Int31()
	return 0
}

// int strerror_r(int errnum, char *buf, size_t buflen);
func Xstrerror_r(t *TLS, errnum int32, buf uintptr, buflen size_t) int32 {
	if __ccgo_strace {
		trc("t=%v errnum=%v buf=%v buflen=%v, (%v:)", t, errnum, buf, buflen, origin(2))
	}
	panic(todo(""))
}

// void endpwent(void);
func Xendpwent(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	// nop
}

var ctimeStaticBuf [32]byte

// char *ctime(const time_t *timep);
func Xctime(t *TLS, timep uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v timep=%v, (%v:)", t, timep, origin(2))
	}
	return Xctime_r(t, timep, uintptr(unsafe.Pointer(&ctimeStaticBuf[0])))
}

// char *ctime_r(const time_t *timep, char *buf);
func Xctime_r(t *TLS, timep, buf uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v buf=%v, (%v:)", t, buf, origin(2))
	}
	ut := *(*ctime.Time_t)(unsafe.Pointer(timep))
	tm := time.Unix(int64(ut), 0).Local()
	s := tm.Format(time.ANSIC) + "\n\x00"
	copy((*RawMem)(unsafe.Pointer(buf))[:26:26], s)
	return buf
}

// ssize_t pread(int fd, void *buf, size_t count, off_t offset);
func Xpread(t *TLS, fd int32, buf uintptr, count types.Size_t, offset types.Off_t) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v offset=%v, (%v:)", t, fd, buf, count, offset, origin(2))
	}
	var n int
	var err error
	switch {
	case count == 0:
		n, err = unix.Pread(int(fd), nil, int64(offset))
	default:
		n, err = unix.Pread(int(fd), (*RawMem)(unsafe.Pointer(buf))[:count:count], int64(offset))
		// 		if dmesgs && err == nil {
		// 			dmesg("%v: fd %v, off %#x, count %#x, n %#x\n%s", origin(1), fd, offset, count, n, hex.Dump((*RawMem)(unsafe.Pointer(buf))[:n:n]))
		// 		}
	}
	if err != nil {
		// if dmesgs {
		// 	dmesg("%v: %v FAIL", origin(1), err)
		// }
		t.setErrno(err)
		return -1
	}

	// if dmesgs {
	// 	dmesg("%v: ok", origin(1))
	// }
	return types.Ssize_t(n)
}

// // malloc_zone_t * malloc_create_zone(vm_size_t start_size, unsigned flags);
// func Xmalloc_create_zone(t *TLS, start_size types.Size_t, flags uint32) uintptr {
// 	if __ccgo_strace {
// 		trc("t=%v start_size=%v flags=%v, (%v:)", t, start_size, flags, origin(2))
// 	}
// 	panic(todo(""))
// }
//
// // void * malloc_zone_malloc(malloc_zone_t *zone, size_t size);
// func Xmalloc_zone_malloc(t *TLS, zone uintptr, size types.Size_t) uintptr {
// 	if __ccgo_strace {
// 		trc("t=%v zone=%v size=%v, (%v:)", t, zone, size, origin(2))
// 	}
// 	if zone == defaultZone {
// 		return Xmalloc(t, size)
// 	}
//
// 	panic(todo(""))
// }
//
// // malloc_zone_t *  malloc_default_zone(void);
// func Xmalloc_default_zone(t *TLS) uintptr {
// 	if __ccgo_strace {
// 		trc("t=%v (%v:)", t, origin(2))
// 	}
// 	return defaultZone
// }
//
// // void malloc_zone_free(malloc_zone_t *zone, void *ptr);
// func Xmalloc_zone_free(t *TLS, zone, ptr uintptr) {
// 	if __ccgo_strace {
// 		trc("t=%v zone=%v ptr=%v, (%v:)", t, zone, ptr, origin(2))
// 	}
//
// 	if zone == defaultZone {
// 		Xfree(t, ptr)
// 		return
// 	}
//
// 	panic(todo(""))
// }
//
// // void * malloc_zone_realloc(malloc_zone_t *zone, void *ptr, size_t size);
// func Xmalloc_zone_realloc(t *TLS, zone, ptr uintptr, size types.Size_t) uintptr {
// 	if __ccgo_strace {
// 		trc("t=%v zone=%v ptr=%v size=%v, (%v:)", t, zone, ptr, size, origin(2))
// 	}
// 	panic(todo(""))
// }

// int sysctlbyname(const char *name, void *oldp, size_t *oldlenp, void *newp, size_t newlen);
func Xsysctlbyname(t *TLS, name, oldp, oldlenp, newp uintptr, newlen types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v name=%q oldp=%#0x oldlenp=%v newp=%v newlen=%v, (%v:)", t, GoString(name), oldp, *(*types.Size_t)(unsafe.Pointer(oldlenp)), newp, newlen, origin(2))
	}
	oldlen := *(*types.Size_t)(unsafe.Pointer(oldlenp))
	switch GoString(name) {
	case "hw.ncpu":
		if oldlen != 4 {
			panic(todo(""))
		}

		*(*int32)(unsafe.Pointer(oldp)) = int32(runtime.GOMAXPROCS(-1))
		return 0
	default:
		t.setErrno(errno.ENOENT)
		return -1
	}
}

// type mallocZone struct {
// 	a memory.Allocator
// 	mu sync.Mutex
//
// 	isDefault bool
// }
//
// func newMallocZone(isDefault bool) *mallocZone {
// 	return &mallocZone{isDefault: isDefault}
// }
//
// var (
// 	defaultZone uintptr
// )
//
// func init() {
// 	defaultZone = addObject(newMallocZone(true))
// }

// /tmp/libc/musl-master/src/time/gmtime.c:6:19:
var _tm ctime.Tm

// /tmp/libc/musl-master/src/time/gmtime.c:4:11:
func Xgmtime(tls *TLS, t uintptr) (r uintptr) { // /tmp/libc/musl-master/src/time/gmtime.c:7:2:
	if __ccgo_strace {
		trc("tls=%v t=%v, (%v:)", tls, t, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xgmtime_r(tls, t, uintptr(unsafe.Pointer(&_tm)))
}

var _days_in_month = [12]int8{
	0:  int8(31),
	1:  int8(30),
	2:  int8(31),
	3:  int8(30),
	4:  int8(31),
	5:  int8(31),
	6:  int8(30),
	7:  int8(31),
	8:  int8(30),
	9:  int8(31),
	10: int8(31),
	11: int8(29),
}

var x___utc = [4]int8{'U', 'T', 'C'}

func Xstrftime(tls *TLS, s uintptr, n size_t, f uintptr, tm uintptr) (r size_t) {
	if __ccgo_strace {
		trc("tls=%v s=%v n=%v f=%v tm=%v, (%v:)", tls, s, n, f, tm, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	tt := time.Date(
		int((*ctime.Tm)(unsafe.Pointer(tm)).Ftm_year+1900),
		time.Month((*ctime.Tm)(unsafe.Pointer(tm)).Ftm_mon+1),
		int((*ctime.Tm)(unsafe.Pointer(tm)).Ftm_mday),
		int((*ctime.Tm)(unsafe.Pointer(tm)).Ftm_hour),
		int((*ctime.Tm)(unsafe.Pointer(tm)).Ftm_min),
		int((*ctime.Tm)(unsafe.Pointer(tm)).Ftm_sec),
		0,
		time.UTC,
	)
	fmt := GoString(f)
	var result string
	if fmt != "" {
		result = strftime.Format(fmt, tt)
	}
	switch r = size_t(len(result)); {
	case r > n:
		r = 0
	default:
		copy((*RawMem)(unsafe.Pointer(s))[:r:r], result)
		*(*byte)(unsafe.Pointer(s + uintptr(r))) = 0
	}
	return r

}

func x___secs_to_tm(tls *TLS, t int64, tm uintptr) (r int32) {
	var c_cycles, leap, months, q_cycles, qc_cycles, remdays, remsecs, remyears, wday, yday int32
	var days, secs, years int64
	_, _, _, _, _, _, _, _, _, _, _, _, _ = c_cycles, days, leap, months, q_cycles, qc_cycles, remdays, remsecs, remyears, secs, wday, yday, years
	/* Reject time_t values whose year would overflow int */
	if t < int64(-Int32FromInt32(1)-Int32FromInt32(0x7fffffff))*Int64FromInt64(31622400) || t > Int64FromInt32(limits.INT_MAX)*Int64FromInt64(31622400) {
		return -int32(1)
	}
	secs = t - (Int64FromInt64(946684800) + int64(Int32FromInt32(86400)*(Int32FromInt32(31)+Int32FromInt32(29))))
	days = secs / int64(86400)
	remsecs = int32(secs % int64(86400))
	if remsecs < 0 {
		remsecs += int32(86400)
		days--
	}
	wday = int32((int64(3) + days) % int64(7))
	if wday < 0 {
		wday += int32(7)
	}
	qc_cycles = int32(days / int64(Int32FromInt32(365)*Int32FromInt32(400)+Int32FromInt32(97)))
	remdays = int32(days % int64(Int32FromInt32(365)*Int32FromInt32(400)+Int32FromInt32(97)))
	if remdays < 0 {
		remdays += Int32FromInt32(365)*Int32FromInt32(400) + Int32FromInt32(97)
		qc_cycles--
	}
	c_cycles = remdays / (Int32FromInt32(365)*Int32FromInt32(100) + Int32FromInt32(24))
	if c_cycles == int32(4) {
		c_cycles--
	}
	remdays -= c_cycles * (Int32FromInt32(365)*Int32FromInt32(100) + Int32FromInt32(24))
	q_cycles = remdays / (Int32FromInt32(365)*Int32FromInt32(4) + Int32FromInt32(1))
	if q_cycles == int32(25) {
		q_cycles--
	}
	remdays -= q_cycles * (Int32FromInt32(365)*Int32FromInt32(4) + Int32FromInt32(1))
	remyears = remdays / int32(365)
	if remyears == int32(4) {
		remyears--
	}
	remdays -= remyears * int32(365)
	leap = BoolInt32(!(remyears != 0) && (q_cycles != 0 || !(c_cycles != 0)))
	yday = remdays + int32(31) + int32(28) + leap
	if yday >= int32(365)+leap {
		yday -= int32(365) + leap
	}
	years = int64(remyears+int32(4)*q_cycles+int32(100)*c_cycles) + int64(400)*int64(int64(qc_cycles))
	months = 0
	for {
		if !(int32(_days_in_month[months]) <= remdays) {
			break
		}
		remdays -= int32(_days_in_month[months])
		goto _1
	_1:
		months++
	}
	if months >= int32(10) {
		months -= int32(12)
		years++
	}
	if years+int64(100) > int64(limits.INT_MAX) || years+int64(100) < int64(-Int32FromInt32(1)-Int32FromInt32(0x7fffffff)) {
		return -int32(1)
	}
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_year = int32(years + int64(100))
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_mon = months + int32(2)
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_mday = remdays + int32(1)
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_wday = wday
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_yday = yday
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_hour = remsecs / int32(3600)
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_min = remsecs / int32(60) % int32(60)
	(*ctime.Tm)(unsafe.Pointer(tm)).Ftm_sec = remsecs % int32(60)
	return 0
}
