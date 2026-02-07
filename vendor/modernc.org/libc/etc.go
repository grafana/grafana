// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !(linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm))

package libc // import "modernc.org/libc"

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"modernc.org/libc/errno"
	"modernc.org/libc/signal"
	"modernc.org/libc/sys/types"
)

const (
	allocatorPageOverhead = 4 * unsafe.Sizeof(int(0))
	stackHeaderSize       = unsafe.Sizeof(stackHeader{})
	stackSegmentSize      = 1<<12 - allocatorPageOverhead
	uintptrSize           = unsafe.Sizeof(uintptr(0))
)

var (
	Covered  = map[uintptr]struct{}{}
	CoveredC = map[string]struct{}{}
	fToken   uintptr
	tid      int32

	atExit   []func()
	atExitMu sync.Mutex

	signals   [signal.NSIG]uintptr
	signalsMu sync.Mutex

	objectMu sync.Mutex
	objects  = map[uintptr]interface{}{}

	tlsBalance int32

	_ = origin
	_ = trc
)

func init() {
	if n := stackHeaderSize; n%16 != 0 {
		panic(fmt.Errorf("internal error: stackHeaderSize %v == %v (mod 16)", n, n%16))
	}
}

func origin(skip int) string {
	pc, fn, fl, _ := runtime.Caller(skip)
	f := runtime.FuncForPC(pc)
	var fns string
	if f != nil {
		fns = f.Name()
		if x := strings.LastIndex(fns, "."); x > 0 {
			fns = fns[x+1:]
		}
	}
	return fmt.Sprintf("%s:%d:%s", filepath.Base(fn), fl, fns)
}

func trc(s string, args ...interface{}) string { //TODO-
	switch {
	case s == "":
		s = fmt.Sprintf(strings.Repeat("%v ", len(args)), args...)
	default:
		s = fmt.Sprintf(s, args...)
	}
	r := fmt.Sprintf("%s: TRC %s", origin(2), s)
	fmt.Fprintf(os.Stdout, "%s\n", r)
	os.Stdout.Sync()
	return r
}

func todo(s string, args ...interface{}) string { //TODO-
	switch {
	case s == "":
		s = fmt.Sprintf(strings.Repeat("%v ", len(args)), args...)
	default:
		s = fmt.Sprintf(s, args...)
	}
	r := fmt.Sprintf("%s: TODOTODO %s", origin(2), s) //TODOOK
	if dmesgs {
		dmesg("%s", r)
	}
	fmt.Fprintf(os.Stdout, "%s\n", r)
	os.Stdout.Sync()
	os.Exit(1)
	panic("unrechable")
}

var coverPCs [1]uintptr //TODO not concurrent safe

func Cover() {
	runtime.Callers(2, coverPCs[:])
	Covered[coverPCs[0]] = struct{}{}
}

func CoverReport(w io.Writer) error {
	var a []string
	pcs := make([]uintptr, 1)
	for pc := range Covered {
		pcs[0] = pc
		frame, _ := runtime.CallersFrames(pcs).Next()
		a = append(a, fmt.Sprintf("%s:%07d:%s", filepath.Base(frame.File), frame.Line, frame.Func.Name()))
	}
	sort.Strings(a)
	_, err := fmt.Fprintf(w, "%s\n", strings.Join(a, "\n"))
	return err
}

func CoverC(s string) {
	CoveredC[s] = struct{}{}
}

func CoverCReport(w io.Writer) error {
	var a []string
	for k := range CoveredC {
		a = append(a, k)
	}
	sort.Strings(a)
	_, err := fmt.Fprintf(w, "%s\n", strings.Join(a, "\n"))
	return err
}

func token() uintptr { return atomic.AddUintptr(&fToken, 1) }

func addObject(o interface{}) uintptr {
	t := token()
	objectMu.Lock()
	objects[t] = o
	objectMu.Unlock()
	return t
}

func getObject(t uintptr) interface{} {
	objectMu.Lock()
	o := objects[t]
	if o == nil {
		panic(todo("", t))
	}

	objectMu.Unlock()
	return o
}

func removeObject(t uintptr) {
	objectMu.Lock()
	if _, ok := objects[t]; !ok {
		panic(todo(""))
	}

	delete(objects, t)
	objectMu.Unlock()
}

func (t *TLS) setErrno(err interface{}) {
	if t == nil {
		panic("nil TLS")
	}

	if memgrind {
		if atomic.SwapInt32(&t.reentryGuard, 1) != 0 {
			panic(todo("concurrent use of TLS instance %p", t))
		}

		defer func() {
			if atomic.SwapInt32(&t.reentryGuard, 0) != 1 {
				panic(todo("concurrent use of TLS instance %p", t))
			}
		}()
	}
	// if dmesgs {
	// 	dmesg("%v: %T(%v)\n%s", origin(1), err, err, debug.Stack())
	// }
again:
	switch x := err.(type) {
	case int:
		*(*int32)(unsafe.Pointer(t.errnop)) = int32(x)
	case int32:
		*(*int32)(unsafe.Pointer(t.errnop)) = x
	case *os.PathError:
		err = x.Err
		goto again
	case syscallErrno:
		*(*int32)(unsafe.Pointer(t.errnop)) = int32(x)
	case *os.SyscallError:
		err = x.Err
		goto again
	default:
		panic(todo("%T", x))
	}
}

// Close frees the resources of t.
func (t *TLS) Close() {
	t.Free(int(unsafe.Sizeof(int32(0))))
	if memgrind {
		if t.stackHeaderBalance != 0 {
			panic(todo("non zero stack header balance: %d", t.stackHeaderBalance))
		}

		atomic.AddInt32(&tlsBalance, -1)
	}
	t.pthreadData.close(t)
	*t = TLS{}
}

// Alloc allocates n bytes of thread-local storage. It must be paired with a
// call to t.Free(n), using the same n. The order matters. This is ok:
//
//	t.Alloc(11)
//		t.Alloc(22)
//		t.Free(22)
//	t.Free(11)
//
// This is not correct:
//
//	t.Alloc(11)
//		t.Alloc(22)
//		t.Free(11)
//	t.Free(22)
func (t *TLS) Alloc(n int) (r uintptr) {
	t.sp++
	if memgrind {
		if atomic.SwapInt32(&t.reentryGuard, 1) != 0 {
			panic(todo("concurrent use of TLS instance %p", t))
		}

		defer func() {
			if atomic.SwapInt32(&t.reentryGuard, 0) != 1 {
				panic(todo("concurrent use of TLS instance %p", t))
			}
		}()
	}
	n += 15
	n &^= 15
	if t.stack.free >= n {
		r = t.stack.sp
		t.stack.free -= n
		t.stack.sp += uintptr(n)
		return r
	}
	//if we have a next stack
	if nstack := t.stack.next; nstack != 0 {
		if (*stackHeader)(unsafe.Pointer(nstack)).free >= n {
			*(*stackHeader)(unsafe.Pointer(t.stack.page)) = t.stack
			t.stack = *(*stackHeader)(unsafe.Pointer(nstack))
			r = t.stack.sp
			t.stack.free -= n
			t.stack.sp += uintptr(n)
			return r
		}
		nstack := *(*stackHeader)(unsafe.Pointer(t.stack.next))
		for ; ; nstack = *(*stackHeader)(unsafe.Pointer(nstack.next)) {
			if memgrind {
				if atomic.AddInt32(&t.stackHeaderBalance, -1) < 0 {
					panic(todo("negative stack header balance"))
				}
			}
			Xfree(t, nstack.page)
			if nstack.next == 0 {
				break
			}
		}
		t.stack.next = 0
	}

	if t.stack.page != 0 {
		*(*stackHeader)(unsafe.Pointer(t.stack.page)) = t.stack
	}

	rq := n + int(stackHeaderSize)
	if rq%int(stackSegmentSize) != 0 {
		rq -= rq % int(stackSegmentSize)
		rq += int(stackSegmentSize)
	}
	t.stack.free = rq - int(stackHeaderSize)
	t.stack.prev = t.stack.page

	rq += 15
	rq &^= 15
	t.stack.page = Xmalloc(t, types.Size_t(rq))
	if t.stack.page == 0 {
		panic("OOM")
	}

	if memgrind {
		atomic.AddInt32(&t.stackHeaderBalance, 1)
	}
	t.stack.sp = t.stack.page + stackHeaderSize

	r = t.stack.sp
	t.stack.free -= n
	t.stack.sp += uintptr(n)
	if t.stack.prev != 0 {
		(*stackHeader)(unsafe.Pointer(t.stack.prev)).next = t.stack.page
	}

	return r
}

// this declares how many stack frames are kept alive before being freed
const stackFrameKeepalive = 2

// Free deallocates n bytes of thread-local storage. See TLS.Alloc for details
// on correct usage.
func (t *TLS) Free(n int) {
	t.sp--
	if memgrind {
		if atomic.SwapInt32(&t.reentryGuard, 1) != 0 {
			panic(todo("concurrent use of TLS instance %p", t))
		}

		defer func() {
			if atomic.SwapInt32(&t.reentryGuard, 0) != 1 {
				panic(todo("concurrent use of TLS instance %p", t))
			}
		}()
	}
	n += 15
	n &^= 15
	t.stack.free += n
	t.stack.sp -= uintptr(n)
	if t.stack.sp != t.stack.page+stackHeaderSize {
		return
	}

	nstack := t.stack

	//if we are the first one, just free all of them
	if t.stack.prev == 0 {
		for ; ; nstack = *(*stackHeader)(unsafe.Pointer(nstack.next)) {
			if memgrind {
				if atomic.AddInt32(&t.stackHeaderBalance, -1) < 0 {
					panic(todo("negative stack header balance"))
				}
			}
			Xfree(t, nstack.page)
			if nstack.next == 0 {
				break
			}
		}
		t.stack = stackHeader{}
		return
	}

	//look if we are in the last n stackframes (n=stackFrameKeepalive)
	//if we find something just return and set the current stack pointer to the previous one
	for i := 0; i < stackFrameKeepalive; i++ {
		if nstack.next == 0 {
			*((*stackHeader)(unsafe.Pointer(t.stack.page))) = t.stack
			t.stack = *(*stackHeader)(unsafe.Pointer(t.stack.prev))
			return
		}
		nstack = *(*stackHeader)(unsafe.Pointer(nstack.next))
	}

	//else only free the last
	if memgrind {
		if atomic.AddInt32(&t.stackHeaderBalance, -1) < 0 {
			panic(todo("negative stack header balance"))
		}
	}
	Xfree(t, nstack.page)
	(*stackHeader)(unsafe.Pointer(nstack.prev)).next = 0
	*(*stackHeader)(unsafe.Pointer(t.stack.page)) = t.stack
	t.stack = *(*stackHeader)(unsafe.Pointer(t.stack.prev))
}

type stackHeader struct {
	free int     // bytes left in page
	page uintptr // stack page
	prev uintptr // prev stack page = prev stack header
	next uintptr // next stack page = next stack header
	sp   uintptr // next allocation address
	_    stackHeaderPadding
}

func cString(t *TLS, s string) uintptr { //TODO-
	n := len(s)
	p := Xmalloc(t, types.Size_t(n)+1)
	if p == 0 {
		panic("OOM")
	}

	copy((*RawMem)(unsafe.Pointer(p))[:n:n], s)
	*(*byte)(unsafe.Pointer(p + uintptr(n))) = 0
	return p
}

// VaList fills a varargs list at p with args and returns p.  The list must
// have been allocated by caller and it must not be in Go managed memory, ie.
// it must be pinned. Caller is responsible for freeing the list.
//
// Individual arguments must be one of int, uint, int32, uint32, int64, uint64,
// float64, uintptr or Intptr. Other types will panic.
//
// This function supports code generated by ccgo/v3. For manually constructed
// var args it's recommended to use the NewVaList function instead.
//
// Note: The C translated to Go varargs ABI alignment for all types is 8 on all
// architectures.
func VaList(p uintptr, args ...interface{}) (r uintptr) {
	if p&7 != 0 {
		panic("internal error")
	}

	r = p
	for _, v := range args {
		switch x := v.(type) {
		case int:
			*(*int64)(unsafe.Pointer(p)) = int64(x)
		case int32:
			*(*int64)(unsafe.Pointer(p)) = int64(x)
		case int64:
			*(*int64)(unsafe.Pointer(p)) = x
		case uint:
			*(*uint64)(unsafe.Pointer(p)) = uint64(x)
		case uint16:
			*(*uint64)(unsafe.Pointer(p)) = uint64(x)
		case uint32:
			*(*uint64)(unsafe.Pointer(p)) = uint64(x)
		case uint64:
			*(*uint64)(unsafe.Pointer(p)) = x
		case float64:
			*(*float64)(unsafe.Pointer(p)) = x
		case uintptr:
			*(*uintptr)(unsafe.Pointer(p)) = x
		default:
			sz := reflect.TypeOf(v).Size()
			copy(unsafe.Slice((*byte)(unsafe.Pointer(p)), sz), unsafe.Slice((*byte)(unsafe.Pointer((*[2]uintptr)(unsafe.Pointer(&v))[1])), sz))
			p += roundup(sz, 8)
			continue
		}
		p += 8
	}
	return r
}

// NewVaListN returns a newly allocated va_list for n items. The caller of
// NewVaListN is responsible for freeing the va_list.
func NewVaListN(n int) (va_list uintptr) {
	return Xmalloc(nil, types.Size_t(8*n))
}

// NewVaList is like VaList but automatically allocates the correct amount of
// memory for all of the items in args.
//
// The va_list return value is used to pass the constructed var args to var
// args accepting functions. The caller of NewVaList is responsible for freeing
// the va_list.
func NewVaList(args ...interface{}) (va_list uintptr) {
	return VaList(NewVaListN(len(args)), args...)
}

func VaOther(app *uintptr, sz uint64) (r uintptr) {
	ap := *(*uintptr)(unsafe.Pointer(app))
	if ap == 0 {
		return 0
	}

	r = ap
	ap = roundup(ap+uintptr(sz), 8)
	*(*uintptr)(unsafe.Pointer(app)) = ap
	return r
}

func VaInt32(app *uintptr) int32 {
	ap := *(*uintptr)(unsafe.Pointer(app))
	if ap == 0 {
		return 0
	}

	ap = roundup(ap, 8)
	v := int32(*(*int64)(unsafe.Pointer(ap)))
	ap += 8
	*(*uintptr)(unsafe.Pointer(app)) = ap
	return v
}

func VaUint32(app *uintptr) uint32 {
	ap := *(*uintptr)(unsafe.Pointer(app))
	if ap == 0 {
		return 0
	}

	ap = roundup(ap, 8)
	v := uint32(*(*uint64)(unsafe.Pointer(ap)))
	ap += 8
	*(*uintptr)(unsafe.Pointer(app)) = ap
	return v
}

func VaInt64(app *uintptr) int64 {
	ap := *(*uintptr)(unsafe.Pointer(app))
	if ap == 0 {
		return 0
	}

	ap = roundup(ap, 8)
	v := *(*int64)(unsafe.Pointer(ap))
	ap += 8
	*(*uintptr)(unsafe.Pointer(app)) = ap
	return v
}

func VaUint64(app *uintptr) uint64 {
	ap := *(*uintptr)(unsafe.Pointer(app))
	if ap == 0 {
		return 0
	}

	ap = roundup(ap, 8)
	v := *(*uint64)(unsafe.Pointer(ap))
	ap += 8
	*(*uintptr)(unsafe.Pointer(app)) = ap
	return v
}

func VaFloat32(app *uintptr) float32 {
	ap := *(*uintptr)(unsafe.Pointer(app))
	if ap == 0 {
		return 0
	}

	ap = roundup(ap, 8)
	v := *(*float64)(unsafe.Pointer(ap))
	ap += 8
	*(*uintptr)(unsafe.Pointer(app)) = ap
	return float32(v)
}

func VaFloat64(app *uintptr) float64 {
	ap := *(*uintptr)(unsafe.Pointer(app))
	if ap == 0 {
		return 0
	}

	ap = roundup(ap, 8)
	v := *(*float64)(unsafe.Pointer(ap))
	ap += 8
	*(*uintptr)(unsafe.Pointer(app)) = ap
	return v
}

func VaUintptr(app *uintptr) uintptr {
	ap := *(*uintptr)(unsafe.Pointer(app))
	if ap == 0 {
		return 0
	}

	ap = roundup(ap, 8)
	v := *(*uintptr)(unsafe.Pointer(ap))
	ap += 8
	*(*uintptr)(unsafe.Pointer(app)) = ap
	return v
}

func getVaList(va uintptr) []string {
	r := []string{}

	for p := va; ; p += 8 {
		st := *(*uintptr)(unsafe.Pointer(p))
		if st == 0 {
			return r
		}
		r = append(r, GoString(st))
	}
	return r
}

func roundup(n, to uintptr) uintptr {
	if r := n % to; r != 0 {
		return n + to - r
	}

	return n
}

func Bool(v bool) bool { return v }

func Bool32(b bool) int32 {
	if b {
		return 1
	}

	return 0
}

func Bool64(b bool) int64 {
	if b {
		return 1
	}

	return 0
}

type sorter struct {
	len  int
	base uintptr
	sz   uintptr
	f    func(*TLS, uintptr, uintptr) int32
	t    *TLS
}

func (s *sorter) Len() int { return s.len }

func (s *sorter) Less(i, j int) bool {
	return s.f(s.t, s.base+uintptr(i)*s.sz, s.base+uintptr(j)*s.sz) < 0
}

func (s *sorter) Swap(i, j int) {
	p := uintptr(s.base + uintptr(i)*s.sz)
	q := uintptr(s.base + uintptr(j)*s.sz)
	for i := 0; i < int(s.sz); i++ {
		*(*byte)(unsafe.Pointer(p)), *(*byte)(unsafe.Pointer(q)) = *(*byte)(unsafe.Pointer(q)), *(*byte)(unsafe.Pointer(p))
		p++
		q++
	}
}

func CString(s string) (uintptr, error) {
	n := len(s)
	p := Xmalloc(nil, types.Size_t(n)+1)
	if p == 0 {
		return 0, fmt.Errorf("CString: cannot allocate %d bytes", n+1)
	}

	copy((*RawMem)(unsafe.Pointer(p))[:n:n], s)
	*(*byte)(unsafe.Pointer(p + uintptr(n))) = 0
	return p, nil
}

func GetEnviron() (r []string) {
	for p := Environ(); ; p += unsafe.Sizeof(p) {
		q := *(*uintptr)(unsafe.Pointer(p))
		if q == 0 {
			return r
		}

		r = append(r, GoString(q))
	}
}

func strToUint64(t *TLS, s uintptr, base int32) (seenDigits, neg bool, next uintptr, n uint64, err int32) {
	var c byte
out:
	for {
		c = *(*byte)(unsafe.Pointer(s))
		switch c {
		case ' ', '\t', '\n', '\r', '\v', '\f':
			s++
		case '+':
			s++
			break out
		case '-':
			s++
			neg = true
			break out
		default:
			break out
		}
	}
	for {
		c = *(*byte)(unsafe.Pointer(s))
		var digit uint64
		switch base {
		case 10:
			switch {
			case c >= '0' && c <= '9':
				seenDigits = true
				digit = uint64(c) - '0'
			default:
				return seenDigits, neg, s, n, 0
			}
		case 16:
			if c >= 'A' && c <= 'F' {
				c = c + ('a' - 'A')
			}
			switch {
			case c >= '0' && c <= '9':
				seenDigits = true
				digit = uint64(c) - '0'
			case c >= 'a' && c <= 'f':
				seenDigits = true
				digit = uint64(c) - 'a' + 10
			default:
				return seenDigits, neg, s, n, 0
			}
		default:
			panic(todo("", base))
		}
		n0 := n
		n = uint64(base)*n + digit
		if n < n0 { // overflow
			return seenDigits, neg, s, n0, errno.ERANGE
		}

		s++
	}
}

func strToFloatt64(t *TLS, s uintptr, bits int) (n float64, errno int32) {
	var b []byte
	var neg bool

	defer func() {
		var err error
		if n, err = strconv.ParseFloat(string(b), bits); err != nil {
			panic(todo(""))
		}

		if neg {
			n = -n
		}
	}()

	var c byte
out:
	for {
		c = *(*byte)(unsafe.Pointer(s))
		switch c {
		case ' ', '\t', '\n', '\r', '\v', '\f':
			s++
		case '+':
			s++
			break out
		case '-':
			s++
			neg = true
			break out
		default:
			break out
		}
	}
	for {
		c = *(*byte)(unsafe.Pointer(s))
		switch {
		case c >= '0' && c <= '9':
			b = append(b, c)
		case c == '.':
			b = append(b, c)
			s++
			for {
				c = *(*byte)(unsafe.Pointer(s))
				switch {
				case c >= '0' && c <= '9':
					b = append(b, c)
				case c == 'e' || c == 'E':
					b = append(b, c)
					s++
					for {
						c = *(*byte)(unsafe.Pointer(s))
						switch {
						case c == '+' || c == '-':
							b = append(b, c)
							s++
							for {
								c = *(*byte)(unsafe.Pointer(s))
								switch {
								case c >= '0' && c <= '9':
									b = append(b, c)
								default:
									return
								}

								s++
							}
						default:
							panic(todo("%q %q", b, string(c)))
						}
					}
				default:
					return
				}

				s++
			}
		default:
			panic(todo("%q %q", b, string(c)))
		}

		s++
	}
}

func parseZone(s string) (name string, off int) {
	_, name, off, _ = parseZoneOffset(s, false)
	return name, off
}

func parseZoneOffset(s string, offOpt bool) (string, string, int, bool) {
	s0 := s
	name := s
	for len(s) != 0 {
		switch c := s[0]; {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c == '_', c == '/':
			s = s[1:]
		default:
			name = name[:len(name)-len(s)]
			if len(name) < 3 {
				panic(todo("%q", s0))
			}

			if offOpt {
				if len(s) == 0 {
					return "", name, 0, false
				}

				if c := s[0]; (c < '0' || c > '9') && c != '+' && c != '-' {
					return s, name, 0, false
				}
			}

			s, off := parseOffset(s)
			return s, name, off, true
		}
	}
	return "", s0, 0, true
}

// [+|-]hh[:mm[:ss]]
func parseOffset(s string) (string, int) {
	if len(s) == 0 {
		panic(todo(""))
	}

	k := 1
	switch s[0] {
	case '+':
		// nop
		s = s[1:]
	case '-':
		k = -1
		s = s[1:]
	}
	s, hh, ok := parseUint(s)
	if !ok {
		panic(todo(""))
	}

	n := hh * 3600
	if len(s) == 0 || s[0] != ':' {
		return s, k * n
	}

	s = s[1:] // ':'
	if len(s) == 0 {
		panic(todo(""))
	}

	s, mm, ok := parseUint(s)
	if !ok {
		panic(todo(""))
	}

	n += mm * 60
	if len(s) == 0 || s[0] != ':' {
		return s, k * n
	}

	s = s[1:] // ':'
	if len(s) == 0 {
		panic(todo(""))
	}

	s, ss, _ := parseUint(s)
	return s, k * (n + ss)
}

func parseUint(s string) (string, int, bool) {
	var ok bool
	var r int
	for len(s) != 0 {
		switch c := s[0]; {
		case c >= '0' && c <= '9':
			ok = true
			r0 := r
			r = 10*r + int(c) - '0'
			if r < r0 {
				panic(todo(""))
			}

			s = s[1:]
		default:
			return s, r, ok
		}
	}
	return s, r, ok
}

// https://stackoverflow.com/a/53052382
//
// isTimeDST returns true if time t occurs within daylight saving time
// for its time zone.
func isTimeDST(t time.Time) bool {
	// If the most recent (within the last year) clock change
	// was forward then assume the change was from std to dst.
	hh, mm, _ := t.UTC().Clock()
	tClock := hh*60 + mm
	for m := -1; m > -12; m-- {
		// assume dst lasts for at least one month
		hh, mm, _ := t.AddDate(0, m, 0).UTC().Clock()
		clock := hh*60 + mm
		if clock != tClock {
			return clock > tClock
		}
	}
	// assume no dst
	return false
}
