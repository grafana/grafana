// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build !linux || mips64le

///go.generate echo package libc > ccgo.go
///go:generate go fmt -l -s -w ./...

package libc // import "modernc.org/libc"

//TODO use O_RDONLY etc. from fcntl header

//TODO use t.Alloc/Free where appropriate

import (
	"bufio"
	crand "crypto/rand"
	"fmt"
	"math"
	mbits "math/bits"
	"math/rand"
	"os"
	"runtime"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	gotime "time"
	"unsafe"

	"github.com/mattn/go-isatty"
	"modernc.org/libc/errno"
	"modernc.org/libc/stdio"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/time"
	"modernc.org/libc/unistd"
	"modernc.org/mathutil"
)

const (
	ENOENT = errno.ENOENT
)

type (
	// RawMem64 represents the biggest uint64 array the runtime can handle.
	RawMem64 [unsafe.Sizeof(RawMem{}) / unsafe.Sizeof(uint64(0))]uint64
)

var (
	allocMu            sync.Mutex
	environInitialized bool
	isWindows          bool
	ungetcMu           sync.Mutex
	ungetc             = map[uintptr]byte{}
)

// Keep these outside of the var block otherwise go generate will miss them.
var Xenviron uintptr
var Xstdin = newFile(nil, unistd.STDIN_FILENO)
var Xstdout = newFile(nil, unistd.STDOUT_FILENO)
var Xstderr = newFile(nil, unistd.STDERR_FILENO)

func setEnviron() {
	SetEnviron(nil, os.Environ())
}

func Environ() uintptr {
	if !environInitialized {
		SetEnviron(nil, os.Environ())
	}
	return Xenviron
}

func EnvironP() uintptr {
	if !environInitialized {
		SetEnviron(nil, os.Environ())
	}
	return uintptr(unsafe.Pointer(&Xenviron))
}

func X___errno_location(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return X__errno_location(t)
}

// int * __errno_location(void);
func X__errno_location(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return t.errnop
}

func Start(main func(*TLS, int32, uintptr) int32) {
	if dmesgs {
		wd, err := os.Getwd()
		dmesg("%v: %v, wd %v, %v", origin(1), os.Args, wd, err)

		defer func() {
			if err := recover(); err != nil {
				dmesg("%v: CRASH: %v\n%s", origin(1), err, debug.Stack())
			}
		}()
	}
	runtime.LockOSThread()
	t := &TLS{errnop: uintptr(unsafe.Pointer(&errno0))}
	argv := Xcalloc(t, 1, types.Size_t((len(os.Args)+1)*int(uintptrSize)))
	if argv == 0 {
		panic("OOM")
	}

	p := argv
	for _, v := range os.Args {
		s := Xcalloc(t, 1, types.Size_t(len(v)+1))
		if s == 0 {
			panic("OOM")
		}

		copy((*RawMem)(unsafe.Pointer(s))[:len(v):len(v)], v)
		*(*uintptr)(unsafe.Pointer(p)) = s
		p += uintptrSize
	}
	SetEnviron(t, os.Environ())
	audit := false
	if memgrind {
		if s := os.Getenv("LIBC_MEMGRIND_START"); s != "0" {
			MemAuditStart()
			audit = true
		}
	}
	t = NewTLS()
	rc := main(t, int32(len(os.Args)), argv)
	exit(t, rc, audit)
}

func Xexit(t *TLS, status int32) {
	if __ccgo_strace {
		trc("t=%v status=%v, (%v:)", t, status, origin(2))
	}
	exit(t, status, false)
}

func exit(t *TLS, status int32, audit bool) {
	if len(Covered) != 0 {
		buf := bufio.NewWriter(os.Stdout)
		CoverReport(buf)
		buf.Flush()
	}
	if len(CoveredC) != 0 {
		buf := bufio.NewWriter(os.Stdout)
		CoverCReport(buf)
		buf.Flush()
	}
	for _, v := range atExit {
		v()
	}
	if audit {
		t.Close()
		if tlsBalance != 0 {
			fmt.Fprintf(os.Stderr, "non zero TLS balance: %d\n", tlsBalance)
			status = 1
		}
	}
	X_exit(nil, status)
}

// void _exit(int status);
func X_exit(_ *TLS, status int32) {
	if dmesgs {
		dmesg("%v: EXIT %v", origin(1), status)
	}
	os.Exit(int(status))
}

func SetEnviron(t *TLS, env []string) {
	if environInitialized {
		return
	}

	environInitialized = true
	p := Xcalloc(t, 1, types.Size_t((len(env)+1)*(int(uintptrSize))))
	if p == 0 {
		panic("OOM")
	}

	Xenviron = p
	for _, v := range env {
		s := Xcalloc(t, 1, types.Size_t(len(v)+1))
		if s == 0 {
			panic("OOM")
		}

		copy((*(*RawMem)(unsafe.Pointer(s)))[:len(v):len(v)], v)
		*(*uintptr)(unsafe.Pointer(p)) = s
		p += uintptrSize
	}
}

// void setbuf(FILE *stream, char *buf);
func Xsetbuf(t *TLS, stream, buf uintptr) {
	if __ccgo_strace {
		trc("t=%v buf=%v, (%v:)", t, buf, origin(2))
	}
	//TODO panic(todo(""))
}

// size_t confstr(int name, char *buf, size_t len);
func Xconfstr(t *TLS, name int32, buf uintptr, len types.Size_t) types.Size_t {
	if __ccgo_strace {
		trc("t=%v name=%v buf=%v len=%v, (%v:)", t, name, buf, len, origin(2))
	}
	panic(todo(""))
}

// int puts(const char *s);
func Xputs(t *TLS, s uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v s=%v, (%v:)", t, s, origin(2))
	}
	n, err := fmt.Printf("%s\n", GoString(s))
	if err != nil {
		return stdio.EOF
	}

	return int32(n)
}

var (
	randomMu  sync.Mutex
	randomGen = rand.New(rand.NewSource(42))
)

// long int random(void);
func Xrandom(t *TLS) long {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	randomMu.Lock()
	r := randomGen.Int63n(math.MaxInt32 + 1)
	randomMu.Unlock()
	return long(r)
}

func write(b []byte) (int, error) {
	// if dmesgs {
	// 	dmesg("%v: %s", origin(1), b)
	// }
	if _, err := os.Stdout.Write(b); err != nil {
		return -1, err
	}

	return len(b), nil
}

func X__builtin_bzero(t *TLS, s uintptr, n types.Size_t) {
	if __ccgo_strace {
		trc("t=%v s=%v n=%v, (%v:)", t, s, n, origin(2))
	}
	Xbzero(t, s, n)
}

func X__builtin_abort(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	Xabort(t)
}

func X__builtin_abs(t *TLS, j int32) int32 {
	if __ccgo_strace {
		trc("t=%v j=%v, (%v:)", t, j, origin(2))
	}
	return Xabs(t, j)
}

func X__builtin_clz(t *TLS, n uint32) int32 {
	if __ccgo_strace {
		trc("t=%v n=%v, (%v:)", t, n, origin(2))
	}
	return int32(mbits.LeadingZeros32(n))
}

func X__builtin_clzl(t *TLS, n ulong) int32 {
	if __ccgo_strace {
		trc("t=%v n=%v, (%v:)", t, n, origin(2))
	}
	return int32(mbits.LeadingZeros64(uint64(n)))
}

func X__builtin_clzll(t *TLS, n uint64) int32 {
	if __ccgo_strace {
		trc("t=%v n=%v, (%v:)", t, n, origin(2))
	}
	return int32(mbits.LeadingZeros64(n))
}
func X__builtin_constant_p_impl() { panic(todo("internal error: should never be called")) }

func X__builtin_copysign(t *TLS, x, y float64) float64 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return Xcopysign(t, x, y)
}

func X__builtin_copysignf(t *TLS, x, y float32) float32 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return Xcopysignf(t, x, y)
}

func X__builtin_copysignl(t *TLS, x, y float64) float64 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return Xcopysign(t, x, y)
}

func X__builtin_exit(t *TLS, status int32) {
	if __ccgo_strace {
		trc("t=%v status=%v, (%v:)", t, status, origin(2))
	}
	Xexit(t, status)
}

func X__builtin_expect(t *TLS, exp, c long) long {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	return exp
}

func X__builtin_fabs(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Xfabs(t, x)
}

func X__builtin_fabsf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Xfabsf(t, x)
}

func X__builtin_fabsl(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Xfabsl(t, x)
}

func X__builtin_free(t *TLS, ptr uintptr) {
	if __ccgo_strace {
		trc("t=%v ptr=%v, (%v:)", t, ptr, origin(2))
	}
	Xfree(t, ptr)
}

func X__builtin_getentropy(t *TLS, buf uintptr, n types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v n=%v, (%v:)", t, buf, n, origin(2))
	}
	return Xgetentropy(t, buf, n)
}

func X__builtin_huge_val(t *TLS) float64 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return math.Inf(1)
}

func X__builtin_huge_valf(t *TLS) float32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return float32(math.Inf(1))
}

func X__builtin_inf(t *TLS) float64 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return math.Inf(1)
}

func X__builtin_inff(t *TLS) float32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return float32(math.Inf(1))
}

func X__builtin_infl(t *TLS) float64 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return math.Inf(1)
}

func X__builtin_malloc(t *TLS, size types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v size=%v, (%v:)", t, size, origin(2))
	}
	return Xmalloc(t, size)
}

func X__builtin_memcmp(t *TLS, s1, s2 uintptr, n types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v s2=%v n=%v, (%v:)", t, s2, n, origin(2))
	}
	return Xmemcmp(t, s1, s2, n)
}

func X__builtin_nan(t *TLS, s uintptr) float64 {
	if __ccgo_strace {
		trc("t=%v s=%v, (%v:)", t, s, origin(2))
	}
	return math.NaN()
}

func X__builtin_nanf(t *TLS, s uintptr) float32 {
	if __ccgo_strace {
		trc("t=%v s=%v, (%v:)", t, s, origin(2))
	}
	return float32(math.NaN())
}

func X__builtin_nanl(t *TLS, s uintptr) float64 {
	if __ccgo_strace {
		trc("t=%v s=%v, (%v:)", t, s, origin(2))
	}
	return math.NaN()
}

func X__builtin_prefetch(t *TLS, addr, args uintptr) {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
	}
}

func X__builtin_printf(t *TLS, s, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
	}
	return Xprintf(t, s, args)
}

func X__builtin_strchr(t *TLS, s uintptr, c int32) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v c=%v, (%v:)", t, s, c, origin(2))
	}
	return Xstrchr(t, s, c)
}

func X__builtin_strcmp(t *TLS, s1, s2 uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v s2=%v, (%v:)", t, s2, origin(2))
	}
	return Xstrcmp(t, s1, s2)
}

func X__builtin_strcpy(t *TLS, dest, src uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v src=%v, (%v:)", t, src, origin(2))
	}
	return Xstrcpy(t, dest, src)
}

func X__builtin_strlen(t *TLS, s uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v s=%v, (%v:)", t, s, origin(2))
	}
	return Xstrlen(t, s)
}

func X__builtin_trap(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	Xabort(t)
}

func X__isnan(t *TLS, arg float64) int32 {
	if __ccgo_strace {
		trc("t=%v arg=%v, (%v:)", t, arg, origin(2))
	}
	return X__builtin_isnan(t, arg)
}

func X__isnanf(t *TLS, arg float32) int32 {
	if __ccgo_strace {
		trc("t=%v arg=%v, (%v:)", t, arg, origin(2))
	}
	return Xisnanf(t, arg)
}

func X__isnanl(t *TLS, arg float64) int32 {
	if __ccgo_strace {
		trc("t=%v arg=%v, (%v:)", t, arg, origin(2))
	}
	return Xisnanl(t, arg)
}

func Xvfprintf(t *TLS, stream, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	return Xfprintf(t, stream, format, ap)
}

// int __builtin_popcount (unsigned int x)
func X__builtin_popcount(t *TLS, x uint32) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return int32(mbits.OnesCount32(x))
}

// int __builtin_popcountl (unsigned long x)
func X__builtin_popcountl(t *TLS, x ulong) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return int32(mbits.OnesCount64(uint64(x)))
}

// char * __builtin___strcpy_chk (char *dest, const char *src, size_t os);
func X__builtin___strcpy_chk(t *TLS, dest, src uintptr, os types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v src=%v os=%v, (%v:)", t, src, os, origin(2))
	}
	return Xstrcpy(t, dest, src)
}

func X__builtin_mmap(t *TLS, addr uintptr, length types.Size_t, prot, flags, fd int32, offset types.Off_t) uintptr {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v fd=%v offset=%v, (%v:)", t, addr, length, fd, offset, origin(2))
	}
	return Xmmap(t, addr, length, prot, flags, fd, offset)
}

// uint16_t __builtin_bswap16 (uint32_t x)
func X__builtin_bswap16(t *TLS, x uint16) uint16 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return x<<8 |
		x>>8
}

// uint32_t __builtin_bswap32 (uint32_t x)
func X__builtin_bswap32(t *TLS, x uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return x<<24 |
		x&0xff00<<8 |
		x&0xff0000>>8 |
		x>>24
}

// uint64_t __builtin_bswap64 (uint64_t x)
func X__builtin_bswap64(t *TLS, x uint64) uint64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return x<<56 |
		x&0xff00<<40 |
		x&0xff0000<<24 |
		x&0xff000000<<8 |
		x&0xff00000000>>8 |
		x&0xff0000000000>>24 |
		x&0xff000000000000>>40 |
		x>>56
}

// bool __builtin_add_overflow (type1 a, type2 b, type3 *res)
func X__builtin_add_overflowInt64(t *TLS, a, b int64, res uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v b=%v res=%v, (%v:)", t, b, res, origin(2))
	}
	r, ovf := mathutil.AddOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_add_overflow (type1 a, type2 b, type3 *res)
func X__builtin_add_overflowUint32(t *TLS, a, b uint32, res uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v b=%v res=%v, (%v:)", t, b, res, origin(2))
	}
	r := a + b
	*(*uint32)(unsafe.Pointer(res)) = r
	return Bool32(r < a)
}

// bool __builtin_add_overflow (type1 a, type2 b, type3 *res)
func X__builtin_add_overflowUint64(t *TLS, a, b uint64, res uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v b=%v res=%v, (%v:)", t, b, res, origin(2))
	}
	r := a + b
	*(*uint64)(unsafe.Pointer(res)) = r
	return Bool32(r < a)
}

// bool __builtin_sub_overflow (type1 a, type2 b, type3 *res)
func X__builtin_sub_overflowInt64(t *TLS, a, b int64, res uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v b=%v res=%v, (%v:)", t, b, res, origin(2))
	}
	r, ovf := mathutil.SubOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowInt64(t *TLS, a, b int64, res uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v b=%v res=%v, (%v:)", t, b, res, origin(2))
	}
	r, ovf := mathutil.MulOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowUint64(t *TLS, a, b uint64, res uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v b=%v res=%v, (%v:)", t, b, res, origin(2))
	}
	hi, lo := mbits.Mul64(a, b)
	*(*uint64)(unsafe.Pointer(res)) = lo
	return Bool32(hi != 0)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowUint128(t *TLS, a, b Uint128, res uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v b=%v res=%v, (%v:)", t, b, res, origin(2))
	}
	r, ovf := a.mulOvf(b)
	*(*Uint128)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

func X__builtin_unreachable(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	fmt.Fprintf(os.Stderr, "unrechable\n")
	os.Stderr.Sync()
	Xexit(t, 1)
}

func X__builtin_snprintf(t *TLS, str uintptr, size types.Size_t, format, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v str=%v size=%v args=%v, (%v:)", t, str, size, args, origin(2))
	}
	return Xsnprintf(t, str, size, format, args)
}

func X__builtin_sprintf(t *TLS, str, format, args uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xsprintf(t, str, format, args)
}

func X__builtin_memcpy(t *TLS, dest, src uintptr, n types.Size_t) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v n=%v, (%v:)", t, src, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xmemcpy(t, dest, src, n)
}

// void * __builtin___memcpy_chk (void *dest, const void *src, size_t n, size_t os);
func X__builtin___memcpy_chk(t *TLS, dest, src uintptr, n, os types.Size_t) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v os=%v, (%v:)", t, src, os, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if os != ^types.Size_t(0) && n < os {
		Xabort(t)
	}

	return Xmemcpy(t, dest, src, n)
}

func X__builtin_memset(t *TLS, s uintptr, c int32, n types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v c=%v n=%v, (%v:)", t, s, c, n, origin(2))
	}
	return Xmemset(t, s, c, n)
}

// void * __builtin___memset_chk (void *s, int c, size_t n, size_t os);
func X__builtin___memset_chk(t *TLS, s uintptr, c int32, n, os types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v c=%v os=%v, (%v:)", t, s, c, os, origin(2))
	}
	if os < n {
		Xabort(t)
	}

	return Xmemset(t, s, c, n)
}

// size_t __builtin_object_size (const void * ptr, int type)
func X__builtin_object_size(t *TLS, p uintptr, typ int32) types.Size_t {
	if __ccgo_strace {
		trc("t=%v p=%v typ=%v, (%v:)", t, p, typ, origin(2))
	}
	switch typ {
	case 0, 1:
		return ^types.Size_t(0)
	default:
		return 0
	}
}

var atomicLoadStore16 sync.Mutex

func AtomicStoreNUint8(ptr uintptr, val uint8, memorder int32) {
	a_store_8(ptr, val)
}

func AtomicStoreNUint16(ptr uintptr, val uint16, memorder int32) {
	a_store_16(ptr, val)
}

// int sprintf(char *str, const char *format, ...);
func Xsprintf(t *TLS, str, format, args uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	b := printf(format, args)
	r = int32(len(b))
	copy((*RawMem)(unsafe.Pointer(str))[:r:r], b)
	*(*byte)(unsafe.Pointer(str + uintptr(r))) = 0
	return int32(len(b))
}

// int __builtin___sprintf_chk (char *s, int flag, size_t os, const char *fmt, ...);
func X__builtin___sprintf_chk(t *TLS, s uintptr, flag int32, os types.Size_t, format, args uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v s=%v flag=%v os=%v args=%v, (%v:)", t, s, flag, os, args, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xsprintf(t, s, format, args)
}

// void qsort(void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *));
func Xqsort(t *TLS, base uintptr, nmemb, size types.Size_t, compar uintptr) {
	if __ccgo_strace {
		trc("t=%v base=%v size=%v compar=%v, (%v:)", t, base, size, compar, origin(2))
	}
	sort.Sort(&sorter{
		len:  int(nmemb),
		base: base,
		sz:   uintptr(size),
		f: (*struct {
			f func(*TLS, uintptr, uintptr) int32
		})(unsafe.Pointer(&struct{ uintptr }{compar})).f,
		t: t,
	})
}

// void __assert_fail(const char * assertion, const char * file, unsigned int line, const char * function);
func X__assert_fail(t *TLS, assertion, file uintptr, line uint32, function uintptr) {
	if __ccgo_strace {
		trc("t=%v file=%v line=%v function=%v, (%v:)", t, file, line, function, origin(2))
	}
	fmt.Fprintf(os.Stderr, "assertion failure: %s:%d.%s: %s\n", GoString(file), line, GoString(function), GoString(assertion))
	if memgrind {
		fmt.Fprintf(os.Stderr, "%s\n", debug.Stack())
	}
	os.Stderr.Sync()
	Xexit(t, 1)
}

// int vprintf(const char *format, va_list ap);

func Xvprintf(t *TLS, s, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	return Xprintf(t, s, ap)
}

// int vsprintf(char *str, const char *format, va_list ap);
func Xvsprintf(t *TLS, str, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	return Xsprintf(t, str, format, va)
}

// int vsnprintf(char *str, size_t size, const char *format, va_list ap);
func Xvsnprintf(t *TLS, str uintptr, size types.Size_t, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v str=%v size=%v va=%v, (%v:)", t, str, size, va, origin(2))
	}
	return Xsnprintf(t, str, size, format, va)
}

func X__builtin_vsnprintf(t *TLS, str uintptr, size types.Size_t, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v str=%v size=%v va=%v, (%v:)", t, str, size, va, origin(2))
	}
	return Xvsnprintf(t, str, size, format, va)
}

// int obstack_vprintf (struct obstack *obstack, const char *template, va_list ap)
func Xobstack_vprintf(t *TLS, obstack, template, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	panic(todo(""))
}

// extern void _obstack_newchunk(struct obstack *, int);
func X_obstack_newchunk(t *TLS, obstack uintptr, length int32) int32 {
	if __ccgo_strace {
		trc("t=%v obstack=%v length=%v, (%v:)", t, obstack, length, origin(2))
	}
	panic(todo(""))
}

// int _obstack_begin (struct obstack *h, _OBSTACK_SIZE_T size, _OBSTACK_SIZE_T alignment,	void *(*chunkfun) (size_t),  void (*freefun) (void *))
func X_obstack_begin(t *TLS, obstack uintptr, size, alignment int32, chunkfun, freefun uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v obstack=%v alignment=%v freefun=%v, (%v:)", t, obstack, alignment, freefun, origin(2))
	}
	panic(todo(""))
}

// void obstack_free (struct obstack *h, void *obj)
func Xobstack_free(t *TLS, obstack, obj uintptr) {
	if __ccgo_strace {
		trc("t=%v obj=%v, (%v:)", t, obj, origin(2))
	}
	panic(todo(""))
}

// unsigned int sleep(unsigned int seconds);
func Xsleep(t *TLS, seconds uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v seconds=%v, (%v:)", t, seconds, origin(2))
	}
	gotime.Sleep(gotime.Second * gotime.Duration(seconds))
	return 0
}

// size_t strcspn(const char *s, const char *reject);
func Xstrcspn(t *TLS, s, reject uintptr) (r types.Size_t) {
	if __ccgo_strace {
		trc("t=%v reject=%v, (%v:)", t, reject, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bits := newBits(256)
	for {
		c := *(*byte)(unsafe.Pointer(reject))
		if c == 0 {
			break
		}

		reject++
		bits.set(int(c))
	}
	for {
		c := *(*byte)(unsafe.Pointer(s))
		if c == 0 || bits.has(int(c)) {
			return r
		}

		s++
		r++
	}
}

// int printf(const char *format, ...);
func Xprintf(t *TLS, format, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
	}
	n, _ := write(printf(format, args))
	return int32(n)
}

// int snprintf(char *str, size_t size, const char *format, ...);
func Xsnprintf(t *TLS, str uintptr, size types.Size_t, format, args uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v str=%v size=%v args=%v, (%v:)", t, str, size, args, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if format == 0 {
		return 0
	}

	b := printf(format, args)
	r = int32(len(b))
	if size == 0 {
		return r
	}

	if len(b)+1 > int(size) {
		b = b[:size-1]
	}
	n := len(b)
	copy((*RawMem)(unsafe.Pointer(str))[:n:n], b)
	*(*byte)(unsafe.Pointer(str + uintptr(n))) = 0
	return r
}

// int __builtin___snprintf_chk(char * str, size_t maxlen, int flag, size_t os, const char * format, ...);
func X__builtin___snprintf_chk(t *TLS, str uintptr, maxlen types.Size_t, flag int32, os types.Size_t, format, args uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v str=%v maxlen=%v flag=%v os=%v args=%v, (%v:)", t, str, maxlen, flag, os, args, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if os != ^types.Size_t(0) && maxlen > os {
		Xabort(t)
	}

	return Xsnprintf(t, str, maxlen, format, args)
}

// int __builtin___vsnprintf_chk (char *s, size_t maxlen, int flag, size_t os, const char *fmt, va_list ap);
func X__builtin___vsnprintf_chk(t *TLS, str uintptr, maxlen types.Size_t, flag int32, os types.Size_t, format, args uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v str=%v maxlen=%v flag=%v os=%v args=%v, (%v:)", t, str, maxlen, flag, os, args, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if os != ^types.Size_t(0) && maxlen > os {
		Xabort(t)
	}

	return Xsnprintf(t, str, maxlen, format, args)
}

// int abs(int j);
func Xabs(t *TLS, j int32) int32 {
	if __ccgo_strace {
		trc("t=%v j=%v, (%v:)", t, j, origin(2))
	}
	if j >= 0 {
		return j
	}

	return -j
}

// long abs(long j);
func Xlabs(t *TLS, j long) long {
	if __ccgo_strace {
		trc("t=%v j=%v, (%v:)", t, j, origin(2))
	}
	if j >= 0 {
		return j
	}

	return -j
}

func Xllabs(tls *TLS, a int64) int64 {
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	if a >= int64(0) {
		return a
	}

	return -a
}

func X__builtin_isnan(t *TLS, x float64) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Bool32(math.IsNaN(x))
}

func X__builtin_llabs(tls *TLS, a int64) int64 {
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return Xllabs(tls, a)
}

func Xacos(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Acos(x)
}

func Xacosf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Acos(float64(x)))
}

func Xacosh(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Acosh(x)
}

func Xacoshf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Acosh(float64(x)))
}

func Xasin(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Asin(x)
}

func Xasinf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Asin(float64(x)))
}

func Xasinh(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Asinh(x)
}

func Xasinhf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Asinh(float64(x)))
}

func Xatan(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Atan(x)
}

func Xatanf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Atan(float64(x)))
}

func Xatan2(t *TLS, x, y float64) float64 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return math.Atan2(x, y)
}

func Xatan2f(t *TLS, x, y float32) float32 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return float32(math.Atan2(float64(x), float64(y)))
}

func Xatanh(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Atanh(x)
}

func Xatanhf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Atanh(float64(x)))
}

func Xceil(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Ceil(x)
}

func Xceilf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Ceil(float64(x)))
}

func Xcopysign(t *TLS, x, y float64) float64 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return math.Copysign(x, y)
}

func Xcopysignf(t *TLS, x, y float32) float32 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return float32(math.Copysign(float64(x), float64(y)))
}

func Xcos(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Cos(x)
}

func Xcosf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Cos(float64(x)))
}

func Xcosh(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Cosh(x)
}

func Xcoshf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Cosh(float64(x)))
}

func Xexp(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Exp(x)
}

func Xexpf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Exp(float64(x)))
}

func Xfabs(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Abs(x)
}

func Xfabsf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Abs(float64(x)))
}

func Xfloor(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Floor(x)
}

func Xfloorf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Floor(float64(x)))
}

func Xfmod(t *TLS, x, y float64) float64 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return math.Mod(x, y)
}

func Xfmodf(t *TLS, x, y float32) float32 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return float32(math.Mod(float64(x), float64(y)))
}

func X__builtin_hypot(t *TLS, x float64, y float64) (r float64) {
	return Xhypot(t, x, y)
}

func Xhypot(t *TLS, x, y float64) float64 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return math.Hypot(x, y)
}

func Xhypotf(t *TLS, x, y float32) float32 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return float32(math.Hypot(float64(x), float64(y)))
}

func Xisnan(t *TLS, x float64) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return X__builtin_isnan(t, x)
}

func Xisnanf(t *TLS, x float32) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Bool32(math.IsNaN(float64(x)))
}

func Xisnanl(t *TLS, x float64) int32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return Bool32(math.IsNaN(x))
} // ccgo has to handle long double as double as Go does not support long double.

func Xldexp(t *TLS, x float64, exp int32) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v exp=%v, (%v:)", t, x, exp, origin(2))
	}
	return math.Ldexp(x, int(exp))
}

func Xlog(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Log(x)
}

func Xlogf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Log(float64(x)))
}

func Xlog10(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Log10(x)
}

func Xlog10f(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Log10(float64(x)))
}

func X__builtin_log2(t *TLS, x float64) float64 {
	return Xlog2(t, x)
}

func Xlog2(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Log2(x)
}

func Xlog2f(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Log2(float64(x)))
}

func Xround(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Round(x)
}

func Xroundf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Round(float64(x)))
}

func X__builtin_round(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Round(x)
}

func X__builtin_roundf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Round(float64(x)))
}

func Xsin(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Sin(x)
}

func Xsinf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Sin(float64(x)))
}

func Xsinh(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Sinh(x)
}

func Xsinhf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Sinh(float64(x)))
}

func Xsqrt(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Sqrt(x)
}

func Xsqrtf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Sqrt(float64(x)))
}

func Xtan(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Tan(x)
}

func Xtanf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Tan(float64(x)))
}

func Xtanh(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Tanh(x)
}

func Xtanhf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Tanh(float64(x)))
}

func Xtrunc(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Trunc(x)
}

func Xtruncf(t *TLS, x float32) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return float32(math.Trunc(float64(x)))
}

var nextRand = uint64(1)

// int rand(void);
func Xrand(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	nextRand = nextRand*1103515245 + 12345
	return int32(uint32(nextRand / (math.MaxUint32 + 1) % math.MaxInt32))
}

func Xpow(t *TLS, x, y float64) float64 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	r := math.Pow(x, y)
	if x > 0 && r == 1 && y >= -1.0000000000000000715e-18 && y < -1e-30 {
		r = 0.9999999999999999
	}
	return r
}

func Xpowf(t *TLS, x, y float32) float32 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return float32(math.Pow(float64(x), float64(y)))
}

func Xfrexp(t *TLS, x float64, exp uintptr) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v exp=%v, (%v:)", t, x, exp, origin(2))
	}
	f, e := math.Frexp(x)
	*(*int32)(unsafe.Pointer(exp)) = int32(e)
	return f
}

func Xfrexpf(t *TLS, x float32, exp uintptr) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v exp=%v, (%v:)", t, x, exp, origin(2))
	}
	f, e := math.Frexp(float64(x))
	*(*int32)(unsafe.Pointer(exp)) = int32(e)
	return float32(f)
}

func Xmodf(t *TLS, x float64, iptr uintptr) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v iptr=%v, (%v:)", t, x, iptr, origin(2))
	}
	i, f := math.Modf(x)
	*(*float64)(unsafe.Pointer(iptr)) = i
	return f
}

func Xmodff(t *TLS, x float32, iptr uintptr) float32 {
	if __ccgo_strace {
		trc("t=%v x=%v iptr=%v, (%v:)", t, x, iptr, origin(2))
	}
	i, f := math.Modf(float64(x))
	*(*float32)(unsafe.Pointer(iptr)) = float32(i)
	return float32(f)
}

// char *strncpy(char *dest, const char *src, size_t n)
func Xstrncpy(t *TLS, dest, src uintptr, n types.Size_t) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v n=%v, (%v:)", t, src, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	r = dest
	for c := *(*int8)(unsafe.Pointer(src)); c != 0 && n > 0; n-- {
		*(*int8)(unsafe.Pointer(dest)) = c
		dest++
		src++
		c = *(*int8)(unsafe.Pointer(src))
	}
	for ; uintptr(n) > 0; n-- {
		*(*int8)(unsafe.Pointer(dest)) = 0
		dest++
	}
	return r
}

// char * __builtin___strncpy_chk (char *dest, const char *src, size_t n, size_t os);
func X__builtin___strncpy_chk(t *TLS, dest, src uintptr, n, os types.Size_t) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v os=%v, (%v:)", t, src, os, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if n != ^types.Size_t(0) && os < n {
		Xabort(t)
	}

	return Xstrncpy(t, dest, src, n)
}

// int strcmp(const char *s1, const char *s2)
func Xstrcmp(t *TLS, s1, s2 uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v s2=%v, (%v:)", t, s2, origin(2))
	}
	for {
		ch1 := *(*byte)(unsafe.Pointer(s1))
		s1++
		ch2 := *(*byte)(unsafe.Pointer(s2))
		s2++
		if ch1 != ch2 || ch1 == 0 || ch2 == 0 {
			return int32(ch1) - int32(ch2)
		}
	}
}

// size_t strlen(const char *s)
func Xstrlen(t *TLS, s uintptr) (r types.Size_t) {
	if __ccgo_strace {
		trc("t=%v s=%v, (%v:)", t, s, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if s == 0 {
		return 0
	}

	for ; *(*int8)(unsafe.Pointer(s)) != 0; s++ {
		r++
	}
	return r
}

// char *strcat(char *dest, const char *src)
func Xstrcat(t *TLS, dest, src uintptr) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v, (%v:)", t, src, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	r = dest
	for *(*int8)(unsafe.Pointer(dest)) != 0 {
		dest++
	}
	for {
		c := *(*int8)(unsafe.Pointer(src))
		src++
		*(*int8)(unsafe.Pointer(dest)) = c
		dest++
		if c == 0 {
			return r
		}
	}
}

// char * __builtin___strcat_chk (char *dest, const char *src, size_t os);
func X__builtin___strcat_chk(t *TLS, dest, src uintptr, os types.Size_t) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v os=%v, (%v:)", t, src, os, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xstrcat(t, dest, src)
}

// int strncmp(const char *s1, const char *s2, size_t n)
func Xstrncmp(t *TLS, s1, s2 uintptr, n types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v s2=%v n=%v, (%v:)", t, s2, n, origin(2))
	}
	var ch1, ch2 byte
	for ; n != 0; n-- {
		ch1 = *(*byte)(unsafe.Pointer(s1))
		s1++
		ch2 = *(*byte)(unsafe.Pointer(s2))
		s2++
		if ch1 != ch2 {
			return int32(ch1) - int32(ch2)
		}

		if ch1 == 0 {
			return 0
		}
	}
	return 0
}

// char *strcpy(char *dest, const char *src)
func Xstrcpy(t *TLS, dest, src uintptr) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v, (%v:)", t, src, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	r = dest
	// src0 := src
	for ; ; dest++ {
		c := *(*int8)(unsafe.Pointer(src))
		src++
		*(*int8)(unsafe.Pointer(dest)) = c
		if c == 0 {
			return r
		}
	}
}

// char *strchr(const char *s, int c)
func Xstrchr(t *TLS, s uintptr, c int32) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v c=%v, (%v:)", t, s, c, origin(2))
	}
	for {
		ch2 := *(*byte)(unsafe.Pointer(s))
		if ch2 == byte(c) {
			return s
		}

		if ch2 == 0 {
			return 0
		}

		s++
	}
}

// char *strrchr(const char *s, int c)
func Xstrrchr(t *TLS, s uintptr, c int32) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v s=%v c=%v, (%v:)", t, s, c, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	for {
		ch2 := *(*byte)(unsafe.Pointer(s))
		if ch2 == 0 {
			return r
		}

		if ch2 == byte(c) {
			r = s
		}
		s++
	}
}

// void *memset(void *s, int c, size_t n)
func Xmemset(t *TLS, dest uintptr, c int32, n types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v c=%v n=%v, (%v:)", t, dest, c, n, origin(2))
	}
	var c8 uint8
	var c32 uint32
	var c64 uint64
	var k types.Size_t
	var s uintptr

	s = dest
	/* Fill head and tail with minimal branching. Each
	 * conditional ensures that all the subsequently used
	 * offsets are well-defined and in the dest region. */
	if n == 0 {
		return dest
	}
	c8 = uint8(c)
	*(*uint8)(unsafe.Pointer(s)) = c8
	*(*uint8)(unsafe.Pointer(s + uintptr(n-1))) = c8
	if n <= types.Size_t(2) {
		return dest
	}
	*(*uint8)(unsafe.Pointer(s + 1)) = c8
	*(*uint8)(unsafe.Pointer(s + 2)) = c8
	*(*uint8)(unsafe.Pointer(s + uintptr(n-2))) = c8
	*(*uint8)(unsafe.Pointer(s + uintptr(n-3))) = c8
	if n <= types.Size_t(6) {
		return dest
	}
	*(*uint8)(unsafe.Pointer(s + 3)) = c8
	*(*uint8)(unsafe.Pointer(s + uintptr(n-4))) = c8
	if n <= types.Size_t(8) {
		return dest
	}
	/* Advance pointer to align it at a 4-byte boundary,
	 * and truncate n to a multiple of 4. The previous code
	 * already took care of any head/tail that get cut off
	 * by the alignment. */
	k = -types.Size_t(s) & types.Size_t(3)
	s += uintptr(k)
	n -= k
	n &= types.Size_t(-Int32FromInt32(4))
	c32 = uint32(0x01010101) * uint32(c8)
	/* In preparation to copy 32 bytes at a time, aligned on
	 * an 8-byte bounary, fill head/tail up to 28 bytes each.
	 * As in the initial byte-based head/tail fill, each
	 * conditional below ensures that the subsequent offsets
	 * are valid (e.g. !(n<=24) implies n>=28). */
	*(*uint32)(unsafe.Pointer(s + uintptr(0))) = c32
	*(*uint32)(unsafe.Pointer(s + uintptr(n-4))) = c32
	if n <= types.Size_t(8) {
		return dest
	}
	c64 = uint64(c32) | (uint64(c32) << 32)
	*(*uint64)(unsafe.Pointer(s + uintptr(4))) = c64
	*(*uint64)(unsafe.Pointer(s + uintptr(n-12))) = c64
	if n <= types.Size_t(24) {
		return dest
	}
	*(*uint64)(unsafe.Pointer(s + uintptr(12))) = c64
	*(*uint64)(unsafe.Pointer(s + uintptr(20))) = c64
	*(*uint64)(unsafe.Pointer(s + uintptr(n-28))) = c64
	*(*uint64)(unsafe.Pointer(s + uintptr(n-20))) = c64
	/* Align to a multiple of 8 so we can fill 64 bits at a time,
	 * and avoid writing the same bytes twice as much as is
	 * practical without introducing additional branching. */
	k = types.Size_t(24) + types.Size_t(s)&types.Size_t(4)
	s += uintptr(k)
	n -= k
	/* If this loop is reached, 28 tail bytes have already been
	 * filled, so any remainder when n drops below 32 can be
	 * safely ignored. */
	for {
		if !(n >= types.Size_t(32)) {
			break
		}
		*(*uint64)(unsafe.Pointer(s + uintptr(0))) = c64
		*(*uint64)(unsafe.Pointer(s + uintptr(8))) = c64
		*(*uint64)(unsafe.Pointer(s + uintptr(16))) = c64
		*(*uint64)(unsafe.Pointer(s + uintptr(24))) = c64
		n -= types.Size_t(32)
		s += uintptr(32)
	}
	return dest
}

// void *memcpy(void *dest, const void *src, size_t n);
func Xmemcpy(t *TLS, dest, src uintptr, n types.Size_t) (r uintptr) {
	if __ccgo_strace {
		trc("t=%v src=%v n=%v, (%v:)", t, src, n, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if n != 0 {
		copy((*RawMem)(unsafe.Pointer(dest))[:n:n], (*RawMem)(unsafe.Pointer(src))[:n:n])
	}
	return dest
}

// int memcmp(const void *s1, const void *s2, size_t n);
func Xmemcmp(t *TLS, s1, s2 uintptr, n types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v s2=%v n=%v, (%v:)", t, s2, n, origin(2))
	}
	for ; n != 0; n-- {
		c1 := *(*byte)(unsafe.Pointer(s1))
		s1++
		c2 := *(*byte)(unsafe.Pointer(s2))
		s2++
		if c1 < c2 {
			return -1
		}

		if c1 > c2 {
			return 1
		}
	}
	return 0
}

// void *memchr(const void *s, int c, size_t n);
func Xmemchr(t *TLS, s uintptr, c int32, n types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v c=%v n=%v, (%v:)", t, s, c, n, origin(2))
	}
	for ; n != 0; n-- {
		if *(*byte)(unsafe.Pointer(s)) == byte(c) {
			return s
		}

		s++
	}
	return 0
}

// void *memmove(void *dest, const void *src, size_t n);
func Xmemmove(t *TLS, dest, src uintptr, n types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v src=%v n=%v, (%v:)", t, src, n, origin(2))
	}
	if n == 0 {
		return dest
	}

	copy((*RawMem)(unsafe.Pointer(uintptr(dest)))[:n:n], (*RawMem)(unsafe.Pointer(uintptr(src)))[:n:n])
	return dest
}

// void * __builtin___memmove_chk (void *dest, const void *src, size_t n, size_t os);
func X__builtin___memmove_chk(t *TLS, dest, src uintptr, n, os types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v src=%v os=%v, (%v:)", t, src, os, origin(2))
	}
	if os != ^types.Size_t(0) && os < n {
		Xabort(t)
	}

	return Xmemmove(t, dest, src, n)
}

// char *getenv(const char *name);
func Xgetenv(t *TLS, name uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v name=%v, (%v:)", t, name, origin(2))
	}
	return getenv(Environ(), GoString(name))
}

func getenv(p uintptr, nm string) uintptr {
	for ; ; p += uintptrSize {
		q := *(*uintptr)(unsafe.Pointer(p))
		if q == 0 {
			return 0
		}

		s := GoString(q)
		a := strings.SplitN(s, "=", 2)
		if len(a) != 2 {
			panic(todo("%q %q %q", nm, s, a))
		}

		if a[0] == nm {
			return q + uintptr(len(nm)) + 1
		}
	}
}

// char *strstr(const char *haystack, const char *needle);
func Xstrstr(t *TLS, haystack, needle uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v needle=%v, (%v:)", t, needle, origin(2))
	}
	hs := GoString(haystack)
	nd := GoString(needle)
	if i := strings.Index(hs, nd); i >= 0 {
		r := haystack + uintptr(i)
		return r
	}

	return 0
}

// int putc(int c, FILE *stream);
func Xputc(t *TLS, c int32, fp uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v fp=%v, (%v:)", t, c, fp, origin(2))
	}
	return Xfputc(t, c, fp)
}

// int atoi(const char *nptr);
func Xatoi(t *TLS, nptr uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v nptr=%v, (%v:)", t, nptr, origin(2))
	}

	_, neg, _, n, _ := strToUint64(t, nptr, 10)
	switch {
	case neg:
		return int32(-n)
	default:
		return int32(n)
	}
}

// double atof(const char *nptr);
func Xatof(t *TLS, nptr uintptr) float64 {
	if __ccgo_strace {
		trc("t=%v nptr=%v, (%v:)", t, nptr, origin(2))
	}
	n, _ := strToFloatt64(t, nptr, 64)
	// if dmesgs {
	// 	dmesg("%v: %q: %v", origin(1), GoString(nptr), n)
	// }
	return n
}

// int tolower(int c);
func Xtolower(t *TLS, c int32) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	if c >= 'A' && c <= 'Z' {
		return c + ('a' - 'A')
	}

	return c
}

// int toupper(int c);
func Xtoupper(t *TLS, c int32) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	if c >= 'a' && c <= 'z' {
		return c - ('a' - 'A')
	}

	return c
}

// int isatty(int fd);
func Xisatty(t *TLS, fd int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}
	return Bool32(isatty.IsTerminal(uintptr(fd)))
}

// long atol(const char *nptr);
func Xatol(t *TLS, nptr uintptr) long {
	if __ccgo_strace {
		trc("t=%v nptr=%v, (%v:)", t, nptr, origin(2))
	}
	_, neg, _, n, _ := strToUint64(t, nptr, 10)
	switch {
	case neg:
		return long(-n)
	default:
		return long(n)
	}
}

func getLocalLocation() (loc *gotime.Location) {
	loc = gotime.Local
	if r := getenv(Environ(), "TZ"); r != 0 {
		zname := GoString(r)
		zone, off := parseZone(zname)
		loc = gotime.FixedZone(zone, -off)
		loc2, _ := gotime.LoadLocation(zname)
		if loc2 != nil {
			loc = loc2
		}
	}
	return loc

}

// time_t mktime(struct tm *tm);
func Xmktime(t *TLS, ptm uintptr) (r time.Time_t) {
	if __ccgo_strace {
		trc("t=%v ptm=%v, (%v:)", t, ptm, origin(2))
	}
	loc := getLocalLocation()
	tt := gotime.Date(
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_year+1900),
		gotime.Month((*time.Tm)(unsafe.Pointer(ptm)).Ftm_mon+1),
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_mday),
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_hour),
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_min),
		int((*time.Tm)(unsafe.Pointer(ptm)).Ftm_sec),
		0,
		loc,
	)
	(*time.Tm)(unsafe.Pointer(ptm)).Ftm_wday = int32(tt.Weekday())
	(*time.Tm)(unsafe.Pointer(ptm)).Ftm_yday = int32(tt.YearDay() - 1)
	r = time.Time_t(tt.Unix())
	return r
}

// char *strpbrk(const char *s, const char *accept);
func Xstrpbrk(t *TLS, s, accept uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v accept=%v, (%v:)", t, accept, origin(2))
	}
	bits := newBits(256)
	for {
		b := *(*byte)(unsafe.Pointer(accept))
		if b == 0 {
			break
		}

		bits.set(int(b))
		accept++
	}
	for {
		b := *(*byte)(unsafe.Pointer(s))
		if b == 0 {
			return 0
		}

		if bits.has(int(b)) {
			return s
		}

		s++
	}
}

// int strcasecmp(const char *s1, const char *s2);
func Xstrcasecmp(t *TLS, s1, s2 uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v s2=%v, (%v:)", t, s2, origin(2))
	}
	for {
		ch1 := *(*byte)(unsafe.Pointer(s1))
		if ch1 >= 'a' && ch1 <= 'z' {
			ch1 = ch1 - ('a' - 'A')
		}
		s1++
		ch2 := *(*byte)(unsafe.Pointer(s2))
		if ch2 >= 'a' && ch2 <= 'z' {
			ch2 = ch2 - ('a' - 'A')
		}
		s2++
		if ch1 != ch2 || ch1 == 0 || ch2 == 0 {
			r := int32(ch1) - int32(ch2)
			return r
		}
	}
}

func Xntohs(t *TLS, netshort uint16) uint16 {
	if __ccgo_strace {
		trc("t=%v netshort=%v, (%v:)", t, netshort, origin(2))
	}
	return uint16((*[2]byte)(unsafe.Pointer(&netshort))[0])<<8 | uint16((*[2]byte)(unsafe.Pointer(&netshort))[1])
}

// uint16_t htons(uint16_t hostshort);
func Xhtons(t *TLS, hostshort uint16) uint16 {
	if __ccgo_strace {
		trc("t=%v hostshort=%v, (%v:)", t, hostshort, origin(2))
	}
	var a [2]byte
	a[0] = byte(hostshort >> 8)
	a[1] = byte(hostshort)
	return *(*uint16)(unsafe.Pointer(&a))
}

// uint32_t htonl(uint32_t hostlong);
func Xhtonl(t *TLS, hostlong uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v hostlong=%v, (%v:)", t, hostlong, origin(2))
	}
	var a [4]byte
	a[0] = byte(hostlong >> 24)
	a[1] = byte(hostlong >> 16)
	a[2] = byte(hostlong >> 8)
	a[3] = byte(hostlong)
	return *(*uint32)(unsafe.Pointer(&a))
}

// FILE *fopen(const char *pathname, const char *mode);
func Xfopen(t *TLS, pathname, mode uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v mode=%v, (%v:)", t, mode, origin(2))
	}
	return Xfopen64(t, pathname, mode) //TODO 32 bit
}

func Dmesg(s string, args ...interface{}) {
	if dmesgs {
		dmesg(s, args...)
	}
}

// void sqlite3_log(int iErrCode, const char *zFormat, ...);
func X__ccgo_sqlite3_log(t *TLS, iErrCode int32, zFormat uintptr, args uintptr) {
	if __ccgo_strace {
		trc("t=%v iErrCode=%v zFormat=%v args=%v, (%v:)", t, iErrCode, zFormat, args, origin(2))
	}
	// if dmesgs {
	// 	dmesg("%v: iErrCode: %v, msg: %s\n%s", origin(1), iErrCode, printf(zFormat, args), debug.Stack())
	// }
}

// int _IO_putc(int __c, _IO_FILE *__fp);
func X_IO_putc(t *TLS, c int32, fp uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v fp=%v, (%v:)", t, c, fp, origin(2))
	}
	return Xputc(t, c, fp)
}

// int atexit(void (*function)(void));
func Xatexit(t *TLS, function uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v function=%v, (%v:)", t, function, origin(2))
	}
	AtExit(func() {
		(*struct{ f func(*TLS) })(unsafe.Pointer(&struct{ uintptr }{function})).f(t)
	})
	return 0
}

// int vasprintf(char **strp, const char *fmt, va_list ap);
func Xvasprintf(t *TLS, strp, fmt, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	panic(todo(""))
}

func AtomicLoadInt32(addr *int32) (val int32)       { return atomic.LoadInt32(addr) }
func AtomicLoadInt64(addr *int64) (val int64)       { return atomic.LoadInt64(addr) }
func AtomicLoadUint32(addr *uint32) (val uint32)    { return atomic.LoadUint32(addr) }
func AtomicLoadUint64(addr *uint64) (val uint64)    { return atomic.LoadUint64(addr) }
func AtomicLoadUintptr(addr *uintptr) (val uintptr) { return atomic.LoadUintptr(addr) }

func AtomicLoadFloat32(addr *float32) (val float32) {
	return math.Float32frombits(atomic.LoadUint32((*uint32)(unsafe.Pointer(addr))))
}

func AtomicLoadFloat64(addr *float64) (val float64) {
	return math.Float64frombits(atomic.LoadUint64((*uint64)(unsafe.Pointer(addr))))
}

func AtomicLoadPInt32(addr uintptr) (val int32) {
	return atomic.LoadInt32((*int32)(unsafe.Pointer(addr)))
}

func AtomicLoadPInt64(addr uintptr) (val int64) {
	return atomic.LoadInt64((*int64)(unsafe.Pointer(addr)))
}

func AtomicLoadPUint32(addr uintptr) (val uint32) {
	return atomic.LoadUint32((*uint32)(unsafe.Pointer(addr)))
}

func AtomicLoadPUint64(addr uintptr) (val uint64) {
	return atomic.LoadUint64((*uint64)(unsafe.Pointer(addr)))
}

func AtomicLoadPUintptr(addr uintptr) (val uintptr) {
	return atomic.LoadUintptr((*uintptr)(unsafe.Pointer(addr)))
}

func AtomicLoadPFloat32(addr uintptr) (val float32) {
	return math.Float32frombits(atomic.LoadUint32((*uint32)(unsafe.Pointer(addr))))
}

func AtomicLoadPFloat64(addr uintptr) (val float64) {
	return math.Float64frombits(atomic.LoadUint64((*uint64)(unsafe.Pointer(addr))))
}

func AtomicStoreInt32(addr *int32, val int32)       { atomic.StoreInt32(addr, val) }
func AtomicStoreInt64(addr *int64, val int64)       { atomic.StoreInt64(addr, val) }
func AtomicStoreUint32(addr *uint32, val uint32)    { atomic.StoreUint32(addr, val) }
func AtomicStoreUint64(addr *uint64, val uint64)    { atomic.StoreUint64(addr, val) }
func AtomicStoreUintptr(addr *uintptr, val uintptr) { atomic.StoreUintptr(addr, val) }

func AtomicStoreFloat32(addr *float32, val float32) {
	atomic.StoreUint32((*uint32)(unsafe.Pointer(addr)), math.Float32bits(val))
}

func AtomicStoreFloat64(addr *float64, val float64) {
	atomic.StoreUint64((*uint64)(unsafe.Pointer(addr)), math.Float64bits(val))
}

func AtomicStorePInt32(addr uintptr, val int32) {
	atomic.StoreInt32((*int32)(unsafe.Pointer(addr)), val)
}

func AtomicStorePInt64(addr uintptr, val int64) {
	atomic.StoreInt64((*int64)(unsafe.Pointer(addr)), val)
}

func AtomicStorePUint32(addr uintptr, val uint32) {
	atomic.StoreUint32((*uint32)(unsafe.Pointer(addr)), val)
}

func AtomicStorePUint64(addr uintptr, val uint64) {
	atomic.StoreUint64((*uint64)(unsafe.Pointer(addr)), val)
}

func AtomicStorePUintptr(addr uintptr, val uintptr) {
	atomic.StoreUintptr((*uintptr)(unsafe.Pointer(addr)), val)
}

func AtomicStorePFloat32(addr uintptr, val float32) {
	atomic.StoreUint32((*uint32)(unsafe.Pointer(addr)), math.Float32bits(val))
}

func AtomicStorePFloat64(addr uintptr, val float64) {
	atomic.StoreUint64((*uint64)(unsafe.Pointer(addr)), math.Float64bits(val))
}

func AtomicAddInt32(addr *int32, delta int32) (new int32)     { return atomic.AddInt32(addr, delta) }
func AtomicAddInt64(addr *int64, delta int64) (new int64)     { return atomic.AddInt64(addr, delta) }
func AtomicAddUint32(addr *uint32, delta uint32) (new uint32) { return atomic.AddUint32(addr, delta) }
func AtomicAddUint64(addr *uint64, delta uint64) (new uint64) { return atomic.AddUint64(addr, delta) }

func AtomicAddUintptr(addr *uintptr, delta uintptr) (new uintptr) {
	return atomic.AddUintptr(addr, delta)

}

func AtomicAddFloat32(addr *float32, delta float32) (new float32) {
	v := AtomicLoadFloat32(addr) + delta
	AtomicStoreFloat32(addr, v)
	return v
}

func AtomicAddFloat64(addr *float64, delta float64) (new float64) {
	v := AtomicLoadFloat64(addr) + delta
	AtomicStoreFloat64(addr, v)
	return v
}

// size_t mbstowcs(wchar_t *dest, const char *src, size_t n);
func Xmbstowcs(t *TLS, dest, src uintptr, n types.Size_t) types.Size_t {
	if __ccgo_strace {
		trc("t=%v src=%v n=%v, (%v:)", t, src, n, origin(2))
	}
	panic(todo(""))
}

// int mbtowc(wchar_t *pwc, const char *s, size_t n);
func Xmbtowc(t *TLS, pwc, s uintptr, n types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v s=%v n=%v, (%v:)", t, s, n, origin(2))
	}
	panic(todo(""))
}

// size_t __ctype_get_mb_cur_max(void);
func X__ctype_get_mb_cur_max(t *TLS) types.Size_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// int wctomb(char *s, wchar_t wc);
func Xwctomb(t *TLS, s uintptr, wc wchar_t) int32 {
	if __ccgo_strace {
		trc("t=%v s=%v wc=%v, (%v:)", t, s, wc, origin(2))
	}
	panic(todo(""))
}

// int mblen(const char *s, size_t n);
func Xmblen(t *TLS, s uintptr, n types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v s=%v n=%v, (%v:)", t, s, n, origin(2))
	}
	panic(todo(""))
}

// ssize_t readv(int fd, const struct iovec *iov, int iovcnt);
func Xreadv(t *TLS, fd int32, iov uintptr, iovcnt int32) types.Ssize_t {
	if __ccgo_strace {
		trc("t=%v fd=%v iov=%v iovcnt=%v, (%v:)", t, fd, iov, iovcnt, origin(2))
	}
	panic(todo(""))
}

// int openpty(int *amaster, int *aslave, char *name,
//
//	const struct termios *termp,
//	const struct winsize *winp);
func Xopenpty(t *TLS, amaster, aslave, name, termp, winp uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v winp=%v, (%v:)", t, winp, origin(2))
	}
	panic(todo(""))
}

// pid_t setsid(void);
func Xsetsid(t *TLS) types.Pid_t {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// int pselect(int nfds, fd_set *readfds, fd_set *writefds,
//
//	fd_set *exceptfds, const struct timespec *timeout,
//	const sigset_t *sigmask);
func Xpselect(t *TLS, nfds int32, readfds, writefds, exceptfds, timeout, sigmask uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v nfds=%v sigmask=%v, (%v:)", t, nfds, sigmask, origin(2))
	}
	panic(todo(""))
}

// int kill(pid_t pid, int sig);
func Xkill(t *TLS, pid types.Pid_t, sig int32) int32 {
	if __ccgo_strace {
		trc("t=%v pid=%v sig=%v, (%v:)", t, pid, sig, origin(2))
	}
	panic(todo(""))
}

// int tcsendbreak(int fd, int duration);
func Xtcsendbreak(t *TLS, fd, duration int32) int32 {
	if __ccgo_strace {
		trc("t=%v duration=%v, (%v:)", t, duration, origin(2))
	}
	panic(todo(""))
}

// int wcwidth(wchar_t c);
func Xwcwidth(t *TLS, c wchar_t) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	panic(todo(""))
}

// AtExit will attempt to run f at process exit. The execution cannot be
// guaranteed, neither its ordering with respect to any other handlers
// registered by AtExit.
func AtExit(f func()) {
	atExitMu.Lock()
	atExit = append(atExit, f)
	atExitMu.Unlock()
}

func X__ccgo_dmesg(t *TLS, fmt uintptr, va uintptr) {
	if __ccgo_strace {
		trc("t=%v fmt=%v va=%v, (%v:)", t, fmt, va, origin(2))
	}
	if dmesgs {
		dmesg("%s", printf(fmt, va))
	}
}

// int getentropy(void *buffer, size_t length);
//
// The  getentropy() function writes length bytes of high-quality random data
// to the buffer starting at the location pointed to by buffer. The maximum
// permitted value for the length argument is 256.
func Xgetentropy(t *TLS, buffer uintptr, length size_t) int32 {
	if __ccgo_strace {
		trc("t=%v buffer=%v length=%v, (%v:)", t, buffer, length, origin(2))
	}
	const max = 256
	switch {
	case length == 0:
		return 0
	case buffer == 0:
		t.setErrno(errno.EFAULT)
		return -1
	case length > max:
		t.setErrno(errno.EIO)
		return -1
	}

	if _, err := crand.Read((*RawMem)(unsafe.Pointer(buffer))[:length]); err != nil {
		t.setErrno(errno.EIO)
		return -1
	}

	return 0
}

// void * reallocarray(void *ptr, size_t nmemb, size_t size);
func Xreallocarray(t *TLS, ptr uintptr, nmemb, size size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v ptr=%v size=%v, (%v:)", t, ptr, size, origin(2))
	}
	hi, lo := mathutil.MulUint128_64(uint64(nmemb), uint64(size))
	if hi != 0 || lo > uint64(unsafe.Sizeof(RawMem{})) {
		t.setErrno(errno.ENOMEM)
		return 0
	}

	return Xrealloc(t, ptr, size_t(lo))
}

// int setjmp(jmp_buf env);
func Xsetjmp(t *TLS, env uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v env=%v, (%v:)", t, env, origin(2))
	}
	return 0 //TODO
}

// void longjmp(jmp_buf env, int val);
func Xlongjmp(t *TLS, env uintptr, val int32) {
	if __ccgo_strace {
		trc("t=%v env=%v val=%v, (%v:)", t, env, val, origin(2))
	}
	panic(todo(""))
}

// https://linux.die.net/man/3/_setjmp
//
// The _longjmp() and _setjmp() functions shall be equivalent to longjmp() and
// setjmp(), respectively, with the additional restriction that _longjmp() and
// _setjmp() shall not manipulate the signal mask.

// int _setjmp(jmp_buf env);
func X_setjmp(t *TLS, env uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v env=%v, (%v:)", t, env, origin(2))
	}
	return 0 //TODO
}

// void _longjmp(jmp_buf env, int val);
func X_longjmp(t *TLS, env uintptr, val int32) {
	if __ccgo_strace {
		trc("t=%v env=%v val=%v, (%v:)", t, env, val, origin(2))
	}
	panic(todo(""))
}

// unsigned __sync_add_and_fetch_uint32(*unsigned, unsigned)
func X__sync_add_and_fetch_uint32(t *TLS, p uintptr, v uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v p=%v v=%v, (%v:)", t, p, v, origin(2))
	}
	return atomic.AddUint32((*uint32)(unsafe.Pointer(p)), v)
}

// unsigned __sync_sub_and_fetch_uint32(*unsigned, unsigned)
func X__sync_sub_and_fetch_uint32(t *TLS, p uintptr, v uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v p=%v v=%v, (%v:)", t, p, v, origin(2))
	}
	return atomic.AddUint32((*uint32)(unsafe.Pointer(p)), -v)
}

// int sched_yield(void);
func Xsched_yield(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	runtime.Gosched()
}

// int getc(FILE *stream);
func Xgetc(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	return Xfgetc(t, stream)
}

// char *fgets(char *s, int size, FILE *stream);
func Xfgets(t *TLS, s uintptr, size int32, stream uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v size=%v stream=%v, (%v:)", t, s, size, stream, origin(2))
	}
	var b []byte
out:
	for ; size > 0; size-- {
		switch c := Xfgetc(t, stream); c {
		case '\n':
			b = append(b, byte(c))
			break out
		case stdio.EOF:
			break out
		default:
			b = append(b, byte(c))
		}
	}
	if len(b) == 0 {
		return 0
	}

	b = append(b, 0)
	copy((*RawMem)(unsafe.Pointer(s))[:len(b):len(b)], b)
	return s
}

// void bzero(void *s, size_t n);
func Xbzero(t *TLS, s uintptr, n types.Size_t) {
	if __ccgo_strace {
		trc("t=%v s=%v n=%v, (%v:)", t, s, n, origin(2))
	}
	b := (*RawMem)(unsafe.Pointer(s))[:n]
	for i := range b {
		b[i] = 0
	}
}

// char *rindex(const char *s, int c);
func Xrindex(t *TLS, s uintptr, c int32) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v c=%v, (%v:)", t, s, c, origin(2))
	}
	if s == 0 {
		return 0
	}

	var r uintptr
	for {
		c2 := int32(*(*byte)(unsafe.Pointer(s)))
		if c2 == c {
			r = s
		}

		if c2 == 0 {
			return r
		}

		s++
	}
}

// int isascii(int c);
func Xisascii(t *TLS, c int32) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	return Bool32(c >= 0 && c <= 0x7f)
}

func X__builtin_isunordered(t *TLS, a, b float64) int32 {
	if __ccgo_strace {
		trc("t=%v b=%v, (%v:)", t, b, origin(2))
	}
	return Bool32(math.IsNaN(a) || math.IsNaN(b))
}

func AtomicLoadNUint16(ptr uintptr, memorder int32) uint16 {
	atomicLoadStore16.Lock()
	r := *(*uint16)(unsafe.Pointer(ptr))
	atomicLoadStore16.Unlock()
	return r
}

func PreIncAtomicInt32P(p uintptr, d int32) int32 {
	return atomic.AddInt32((*int32)(unsafe.Pointer(p)), d)
}

func PreIncAtomicInt64P(p uintptr, d int64) int64 {
	return atomic.AddInt64((*int64)(unsafe.Pointer(p)), d)
}

func PreIncAtomicUint32P(p uintptr, d uint32) uint32 {
	return atomic.AddUint32((*uint32)(unsafe.Pointer(p)), d)
}

func PreIncAtomicUint64P(p uintptr, d uint64) uint64 {
	return atomic.AddUint64((*uint64)(unsafe.Pointer(p)), d)
}

func PreInrAtomicUintptrP(p uintptr, d uintptr) uintptr {
	return atomic.AddUintptr((*uintptr)(unsafe.Pointer(p)), d)
}

func X__builtin_ffs(tls *TLS, i int32) (r int32) {
	if __ccgo_strace {
		trc("tls=%v i=%v, (%v:)", tls, i, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xffs(tls, i)
}

func Xffs(tls *TLS, i int32) (r int32) {
	if __ccgo_strace {
		trc("tls=%v i=%v, (%v:)", tls, i, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if i == 0 {
		return 0
	}

	return int32(mbits.TrailingZeros32(uint32(i))) + 1
}

var _toint5 = Float32FromInt32(1) / Float32FromFloat32(1.1920928955078125e-07)

func X__builtin_rintf(tls *TLS, x float32) (r float32) {
	return Xrintf(tls, x)
}

func Xrintf(tls *TLS, x float32) (r float32) {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var e, s int32
	var y float32
	var v1 float32
	var _ /* u at bp+0 */ struct {
		Fi [0]uint32
		Ff float32
	}
	_, _, _, _ = e, s, y, v1
	*(*struct {
		Fi [0]uint32
		Ff float32
	})(unsafe.Pointer(bp)) = struct {
		Fi [0]uint32
		Ff float32
	}{}
	*(*float32)(unsafe.Pointer(bp)) = x
	e = int32(*(*uint32)(unsafe.Pointer(bp)) >> int32(23) & uint32(0xff))
	s = int32(*(*uint32)(unsafe.Pointer(bp)) >> int32(31))
	if e >= Int32FromInt32(0x7f)+Int32FromInt32(23) {
		return x
	}
	if s != 0 {
		y = x - _toint5 + _toint5
	} else {
		y = x + _toint5 - _toint5
	}
	if y == Float32FromInt32(0) {
		if s != 0 {
			v1 = -Float32FromFloat32(0)
		} else {
			v1 = Float32FromFloat32(0)
		}
		return v1
	}
	return y
}

func X__builtin_lrintf(tls *TLS, x float32) (r long) {
	return Xlrintf(tls, x)
}

func Xlrintf(tls *TLS, x float32) (r long) {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return long(Xrintf(tls, x))
}

func X__builtin_lrint(tls *TLS, x float64) (r long) {
	return Xlrint(tls, x)
}

func Xlrint(tls *TLS, x float64) (r long) {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return long(Xrint(tls, x))
}

func X__builtin_trunc(tls *TLS, x float64) (r float64) {
	return Xtrunc(tls, x)
}

func X__builtin_fmin(tls *TLS, x float64, y float64) (r float64) {
	return Xfmin(tls, x, y)
}

func Xfmin(tls *TLS, x float64, y float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x=%v y=%v, (%v:)", tls, x, y, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var v1, v10, v3, v5, v7 uint64
	var v12, v9 float64
	var _ /* __u at bp+0 */ struct {
		F__i [0]uint64
		F__f float64
	}
	_, _, _, _, _, _, _ = v1, v10, v12, v3, v5, v7, v9
	*(*float64)(unsafe.Pointer(bp)) = x
	v1 = *(*uint64)(unsafe.Pointer(bp))
	goto _2
_2:
	if BoolInt32(v1&(-Uint64FromUint64(1)>>Int32FromInt32(1)) > Uint64FromUint64(0x7ff)<<Int32FromInt32(52)) != 0 {
		return y
	}
	*(*float64)(unsafe.Pointer(bp)) = y
	v3 = *(*uint64)(unsafe.Pointer(bp))
	goto _4
_4:
	if BoolInt32(v3&(-Uint64FromUint64(1)>>Int32FromInt32(1)) > Uint64FromUint64(0x7ff)<<Int32FromInt32(52)) != 0 {
		return x
	}
	/* handle signed zeros, see C99 Annex F.9.9.2 */
	*(*float64)(unsafe.Pointer(bp)) = x
	v5 = *(*uint64)(unsafe.Pointer(bp))
	goto _6
_6:
	*(*float64)(unsafe.Pointer(bp)) = y
	v7 = *(*uint64)(unsafe.Pointer(bp))
	goto _8
_8:
	if Int32FromUint64(v5>>Int32FromInt32(63)) != Int32FromUint64(v7>>Int32FromInt32(63)) {
		*(*float64)(unsafe.Pointer(bp)) = x
		v10 = *(*uint64)(unsafe.Pointer(bp))
		goto _11
	_11:
		if Int32FromUint64(v10>>Int32FromInt32(63)) != 0 {
			v9 = x
		} else {
			v9 = y
		}
		return v9
	}
	if x < y {
		v12 = x
	} else {
		v12 = y
	}
	return v12
}

func Xfminf(tls *TLS, x float32, y float32) (r float32) {
	if __ccgo_strace {
		trc("tls=%v x=%v y=%v, (%v:)", tls, x, y, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var v1, v10, v3, v5, v7 uint32
	var v12, v9 float32
	var _ /* __u at bp+0 */ struct {
		F__i [0]uint32
		F__f float32
	}
	_, _, _, _, _, _, _ = v1, v10, v12, v3, v5, v7, v9
	*(*float32)(unsafe.Pointer(bp)) = x
	v1 = *(*uint32)(unsafe.Pointer(bp))
	goto _2
_2:
	if BoolInt32(v1&uint32(0x7fffffff) > uint32(0x7f800000)) != 0 {
		return y
	}
	*(*float32)(unsafe.Pointer(bp)) = y
	v3 = *(*uint32)(unsafe.Pointer(bp))
	goto _4
_4:
	if BoolInt32(v3&uint32(0x7fffffff) > uint32(0x7f800000)) != 0 {
		return x
	}
	/* handle signed zeros, see C99 Annex F.9.9.2 */
	*(*float32)(unsafe.Pointer(bp)) = x
	v5 = *(*uint32)(unsafe.Pointer(bp))
	goto _6
_6:
	*(*float32)(unsafe.Pointer(bp)) = y
	v7 = *(*uint32)(unsafe.Pointer(bp))
	goto _8
_8:
	if Int32FromUint32(v5>>Int32FromInt32(31)) != Int32FromUint32(v7>>Int32FromInt32(31)) {
		*(*float32)(unsafe.Pointer(bp)) = x
		v10 = *(*uint32)(unsafe.Pointer(bp))
		goto _11
	_11:
		if Int32FromUint32(v10>>Int32FromInt32(31)) != 0 {
			v9 = x
		} else {
			v9 = y
		}
		return v9
	}
	if x < y {
		v12 = x
	} else {
		v12 = y
	}
	return v12
}

func Xfminl(tls *TLS, x float64, y float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x=%v y=%v, (%v:)", tls, x, y, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xfmin(tls, x, y)
}

func Xfmax(tls *TLS, x float64, y float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x=%v y=%v, (%v:)", tls, x, y, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var v1, v10, v3, v5, v7 uint64
	var v12, v9 float64
	var _ /* __u at bp+0 */ struct {
		F__i [0]uint64
		F__f float64
	}
	_, _, _, _, _, _, _ = v1, v10, v12, v3, v5, v7, v9
	*(*float64)(unsafe.Pointer(bp)) = x
	v1 = *(*uint64)(unsafe.Pointer(bp))
	goto _2
_2:
	if BoolInt32(v1&(-Uint64FromUint64(1)>>Int32FromInt32(1)) > Uint64FromUint64(0x7ff)<<Int32FromInt32(52)) != 0 {
		return y
	}
	*(*float64)(unsafe.Pointer(bp)) = y
	v3 = *(*uint64)(unsafe.Pointer(bp))
	goto _4
_4:
	if BoolInt32(v3&(-Uint64FromUint64(1)>>Int32FromInt32(1)) > Uint64FromUint64(0x7ff)<<Int32FromInt32(52)) != 0 {
		return x
	}
	/* handle signed zeros, see C99 Annex F.9.9.2 */
	*(*float64)(unsafe.Pointer(bp)) = x
	v5 = *(*uint64)(unsafe.Pointer(bp))
	goto _6
_6:
	*(*float64)(unsafe.Pointer(bp)) = y
	v7 = *(*uint64)(unsafe.Pointer(bp))
	goto _8
_8:
	if Int32FromUint64(v5>>Int32FromInt32(63)) != Int32FromUint64(v7>>Int32FromInt32(63)) {
		*(*float64)(unsafe.Pointer(bp)) = x
		v10 = *(*uint64)(unsafe.Pointer(bp))
		goto _11
	_11:
		if Int32FromUint64(v10>>Int32FromInt32(63)) != 0 {
			v9 = y
		} else {
			v9 = x
		}
		return v9
	}
	if x < y {
		v12 = y
	} else {
		v12 = x
	}
	return v12
}

func Xfmaxf(tls *TLS, x float32, y float32) (r float32) {
	if __ccgo_strace {
		trc("tls=%v x=%v y=%v, (%v:)", tls, x, y, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var v1, v10, v3, v5, v7 uint32
	var v12, v9 float32
	var _ /* __u at bp+0 */ struct {
		F__i [0]uint32
		F__f float32
	}
	_, _, _, _, _, _, _ = v1, v10, v12, v3, v5, v7, v9
	*(*float32)(unsafe.Pointer(bp)) = x
	v1 = *(*uint32)(unsafe.Pointer(bp))
	goto _2
_2:
	if BoolInt32(v1&uint32(0x7fffffff) > uint32(0x7f800000)) != 0 {
		return y
	}
	*(*float32)(unsafe.Pointer(bp)) = y
	v3 = *(*uint32)(unsafe.Pointer(bp))
	goto _4
_4:
	if BoolInt32(v3&uint32(0x7fffffff) > uint32(0x7f800000)) != 0 {
		return x
	}
	/* handle signed zeroes, see C99 Annex F.9.9.2 */
	*(*float32)(unsafe.Pointer(bp)) = x
	v5 = *(*uint32)(unsafe.Pointer(bp))
	goto _6
_6:
	*(*float32)(unsafe.Pointer(bp)) = y
	v7 = *(*uint32)(unsafe.Pointer(bp))
	goto _8
_8:
	if Int32FromUint32(v5>>Int32FromInt32(31)) != Int32FromUint32(v7>>Int32FromInt32(31)) {
		*(*float32)(unsafe.Pointer(bp)) = x
		v10 = *(*uint32)(unsafe.Pointer(bp))
		goto _11
	_11:
		if Int32FromUint32(v10>>Int32FromInt32(31)) != 0 {
			v9 = y
		} else {
			v9 = x
		}
		return v9
	}
	if x < y {
		v12 = y
	} else {
		v12 = x
	}
	return v12
}

func Xfmaxl(tls *TLS, x float64, y float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x=%v y=%v, (%v:)", tls, x, y, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xfmax(tls, x, y)
}

func X__builtin_fmax(tls *TLS, x float64, y float64) (r float64) {
	return Xfmax(tls, x, y)
}

func Xexpm1(tls *TLS, x3 float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x3=%v, (%v:)", tls, x3, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var c, e, hfx, hi, hxs, lo, r1, t, twopk, y3 Tdouble_t
	var hx Tuint32_t
	var k, sign int32
	var y float32
	var y1, y2, v3 float64
	var v1 uint64
	var _ /* __u at bp+0 */ struct {
		F__i [0]uint64
		F__f float64
	}
	var _ /* u at bp+8 */ struct {
		Fi [0]Tuint64_t
		Ff float64
	}
	_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _ = c, e, hfx, hi, hx, hxs, k, lo, r1, sign, t, twopk, y, y1, y2, y3, v1, v3
	*(*struct {
		Fi [0]Tuint64_t
		Ff float64
	})(unsafe.Pointer(bp + 8)) = struct {
		Fi [0]Tuint64_t
		Ff float64
	}{}
	*(*float64)(unsafe.Pointer(bp + 8)) = x3
	hx = uint32(*(*Tuint64_t)(unsafe.Pointer(bp + 8)) >> int32(32) & uint64(0x7fffffff))
	sign = Int32FromUint64(*(*Tuint64_t)(unsafe.Pointer(bp + 8)) >> int32(63))
	/* filter out huge and non-finite argument */
	if hx >= uint32(0x4043687A) { /* if |x|>=56*ln2 */
		*(*float64)(unsafe.Pointer(bp)) = x3
		v1 = *(*uint64)(unsafe.Pointer(bp))
		goto _2
	_2:
		if BoolInt32(v1&(-Uint64FromUint64(1)>>Int32FromInt32(1)) > Uint64FromUint64(0x7ff)<<Int32FromInt32(52)) != 0 {
			return x3
		}
		if sign != 0 {
			return float64(-Int32FromInt32(1))
		}
		if x3 > _o_threshold {
			x3 *= float64(8.98846567431158e+307)
			return x3
		}
	}
	/* argument reduction */
	if hx > uint32(0x3fd62e42) { /* if  |x| > 0.5 ln2 */
		if hx < uint32(0x3FF0A2B2) { /* and |x| < 1.5 ln2 */
			if !(sign != 0) {
				hi = x3 - _ln2_hi
				lo = _ln2_lo
				k = int32(1)
			} else {
				hi = x3 + _ln2_hi
				lo = -_ln2_lo
				k = -int32(1)
			}
		} else {
			if sign != 0 {
				v3 = -Float64FromFloat64(0.5)
			} else {
				v3 = float64(0.5)
			}
			k = int32(float64(_invln2*x3) + v3)
			t = float64(k)
			hi = x3 - float64(t*_ln2_hi) /* t*ln2_hi is exact here */
			lo = Tdouble_t(t * _ln2_lo)
		}
		x3 = hi - lo
		c = hi - x3 - lo
	} else {
		if hx < uint32(0x3c900000) { /* |x| < 2**-54, return x */
			if hx < uint32(0x00100000) {
				if uint64(4) == uint64(4) {
					y = float32(x3)
				} else {
					if uint64(4) == uint64(8) {
						y1 = float64(float32(x3))
					} else {
						y2 = float64(float32(x3))
					}
				}
			}
			return x3
		} else {
			k = 0
		}
	}
	/* x is now in primary range */
	hfx = Tdouble_t(float64(0.5) * x3)
	hxs = Tdouble_t(x3 * hfx)
	r1 = float64(1) + float64(hxs*(_Q1+float64(hxs*(_Q2+float64(hxs*(_Q3+float64(hxs*(_Q4+float64(hxs*_Q5)))))))))
	t = float64(3) - float64(r1*hfx)
	e = Tdouble_t(hxs * ((r1 - t) / (Float64FromFloat64(6) - float64(x3*t))))
	if k == 0 { /* c is 0 */
		return x3 - (float64(x3*e) - hxs)
	}
	e = float64(x3*(e-c)) - c
	e -= hxs
	/* exp(x) ~ 2^k (Xreduced - e + 1) */
	if k == -int32(1) {
		return float64(float64(0.5)*(x3-e)) - float64(0.5)
	}
	if k == int32(1) {
		if x3 < -Float64FromFloat64(0.25) {
			return float64(-Float64FromFloat64(2) * (e - (x3 + Float64FromFloat64(0.5))))
		}
		return float64(1) + float64(float64(2)*(x3-e))
	}
	*(*Tuint64_t)(unsafe.Pointer(bp + 8)) = Uint64FromInt32(Int32FromInt32(0x3ff)+k) << int32(52) /* 2^k */
	twopk = *(*float64)(unsafe.Pointer(bp + 8))
	if k < 0 || k > int32(56) { /* suffice to return exp(x)-1 */
		y3 = x3 - e + float64(1)
		if k == int32(1024) {
			y3 = Tdouble_t(Tdouble_t(y3*float64(2)) * float64(8.98846567431158e+307))
		} else {
			y3 = Tdouble_t(y3 * twopk)
		}
		return y3 - float64(1)
	}
	*(*Tuint64_t)(unsafe.Pointer(bp + 8)) = Uint64FromInt32(Int32FromInt32(0x3ff)-k) << int32(52) /* 2^-k */
	if k < int32(20) {
		y3 = Tdouble_t((x3 - e + (Float64FromInt32(1) - *(*float64)(unsafe.Pointer(bp + 8)))) * twopk)
	} else {
		y3 = Tdouble_t((x3 - (e + *(*float64)(unsafe.Pointer(bp + 8))) + Float64FromInt32(1)) * twopk)
	}
	return y3
}

var _ln2_hi1 = float32(0.69313812256)    /* 0x3f317180 */
var _ln2_lo1 = float32(9.0580006145e-06) /* 0x3717f7d1 */
var _invln21 = float32(1.4426950216)     /* 0x3fb8aa3b */
/*
 * Domain [-0.34568, 0.34568], range ~[-6.694e-10, 6.696e-10]:
 * |6 / x * (1 + 2 * (1 / (exp(x) - 1) - 1 / x)) - q(x)| < 2**-30.04
 * Scaled coefficients: Qn_here = 2**n * Qn_for_q (see s_expm1.c):
 */
var _Q11 = float32(-Float64FromFloat64(0.033333212137)) /* -0x888868.0p-28 */
var _Q21 = float32(0.0015807170421)                     /*  0xcf3010.0p-33 */

func Xexpm1f(tls *TLS, x3 float32) (r float32) {
	if __ccgo_strace {
		trc("tls=%v x3=%v, (%v:)", tls, x3, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var c, e, hfx, hi, hxs, lo, r1, t, twopk, y3 Tfloat_t
	var hx Tuint32_t
	var k, sign int32
	var y, v1 float32
	var y1, y2 float64
	var _ /* u at bp+0 */ struct {
		Fi [0]Tuint32_t
		Ff float32
	}
	_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _ = c, e, hfx, hi, hx, hxs, k, lo, r1, sign, t, twopk, y, y1, y2, y3, v1
	*(*struct {
		Fi [0]Tuint32_t
		Ff float32
	})(unsafe.Pointer(bp)) = struct {
		Fi [0]Tuint32_t
		Ff float32
	}{}
	*(*float32)(unsafe.Pointer(bp)) = x3
	hx = *(*Tuint32_t)(unsafe.Pointer(bp)) & uint32(0x7fffffff)
	sign = Int32FromUint32(*(*Tuint32_t)(unsafe.Pointer(bp)) >> int32(31))
	/* filter out huge and non-finite argument */
	if hx >= uint32(0x4195b844) { /* if |x|>=27*ln2 */
		if hx > uint32(0x7f800000) { /* NaN */
			return x3
		}
		if sign != 0 {
			return float32(-Int32FromInt32(1))
		}
		if hx > uint32(0x42b17217) { /* x > log(FLT_MAX) */
			x3 *= Float32FromFloat32(1.7014118346046923e+38)
			return x3
		}
	}
	/* argument reduction */
	if hx > uint32(0x3eb17218) { /* if  |x| > 0.5 ln2 */
		if hx < uint32(0x3F851592) { /* and |x| < 1.5 ln2 */
			if !(sign != 0) {
				hi = x3 - _ln2_hi1
				lo = _ln2_lo1
				k = int32(1)
			} else {
				hi = x3 + _ln2_hi1
				lo = -_ln2_lo1
				k = -int32(1)
			}
		} else {
			if sign != 0 {
				v1 = -Float32FromFloat32(0.5)
			} else {
				v1 = Float32FromFloat32(0.5)
			}
			k = int32(float32(_invln21*x3) + v1)
			t = float32(k)
			hi = x3 - float32(t*_ln2_hi1) /* t*ln2_hi is exact here */
			lo = Tfloat_t(t * _ln2_lo1)
		}
		x3 = hi - lo
		c = hi - x3 - lo
	} else {
		if hx < uint32(0x33000000) { /* when |x|<2**-25, return x */
			if hx < uint32(0x00800000) {
				if uint64(4) == uint64(4) {
					y = float32(x3 * x3)
				} else {
					if uint64(4) == uint64(8) {
						y1 = float64(x3 * x3)
					} else {
						y2 = float64(x3 * x3)
					}
				}
			}
			return x3
		} else {
			k = 0
		}
	}
	/* x is now in primary range */
	hfx = Tfloat_t(Float32FromFloat32(0.5) * x3)
	hxs = Tfloat_t(x3 * hfx)
	r1 = Float32FromFloat32(1) + float32(hxs*(_Q11+float32(hxs*_Q21)))
	t = Float32FromFloat32(3) - float32(r1*hfx)
	e = Tfloat_t(hxs * ((r1 - t) / (Float32FromFloat32(6) - float32(x3*t))))
	if k == 0 { /* c is 0 */
		return x3 - (float32(x3*e) - hxs)
	}
	e = float32(x3*(e-c)) - c
	e -= hxs
	/* exp(x) ~ 2^k (Xreduced - e + 1) */
	if k == -int32(1) {
		return float32(Float32FromFloat32(0.5)*(x3-e)) - Float32FromFloat32(0.5)
	}
	if k == int32(1) {
		if x3 < -Float32FromFloat32(0.25) {
			return float32(-Float32FromFloat32(2) * (e - (x3 + Float32FromFloat32(0.5))))
		}
		return Float32FromFloat32(1) + float32(Float32FromFloat32(2)*(x3-e))
	}
	*(*Tuint32_t)(unsafe.Pointer(bp)) = Uint32FromInt32((int32(0x7f) + k) << int32(23)) /* 2^k */
	twopk = *(*float32)(unsafe.Pointer(bp))
	if k < 0 || k > int32(56) { /* suffice to return exp(x)-1 */
		y3 = x3 - e + Float32FromFloat32(1)
		if k == int32(128) {
			y3 = Tfloat_t(Tfloat_t(y3*Float32FromFloat32(2)) * Float32FromFloat32(1.7014118346046923e+38))
		} else {
			y3 = Tfloat_t(y3 * twopk)
		}
		return y3 - Float32FromFloat32(1)
	}
	*(*Tuint32_t)(unsafe.Pointer(bp)) = Uint32FromInt32((int32(0x7f) - k) << int32(23)) /* 2^-k */
	if k < int32(23) {
		y3 = Tfloat_t((x3 - e + (Float32FromInt32(1) - *(*float32)(unsafe.Pointer(bp)))) * twopk)
	} else {
		y3 = Tfloat_t((x3 - (e + *(*float32)(unsafe.Pointer(bp))) + Float32FromInt32(1)) * twopk)
	}
	return y3
}

func Xexpm1l(tls *TLS, x float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xexpm1(tls, x)
}

type Tdouble_t = float64
type Tuint32_t = uint32
type Tuint64_t = uint64

var _o_threshold = float64(709.782712893384)  /* 0x40862E42, 0xFEFA39EF */
var _ln2_hi = float64(0.6931471803691238)     /* 0x3fe62e42, 0xfee00000 */
var _ln2_lo = float64(1.9082149292705877e-10) /* 0x3dea39ef, 0x35793c76 */
var _invln2 = float64(1.4426950408889634)     /* 0x3ff71547, 0x652b82fe */
/* Scaled Q's: Qn_here = 2**n * Qn_above, for R(2*z) where z = hxs = x*x/2: */
var _Q1 = -Float64FromFloat64(0.03333333333333313)    /* BFA11111 111110F4 */
var _Q2 = float64(0.0015873015872548146)              /* 3F5A01A0 19FE5585 */
var _Q3 = -Float64FromFloat64(7.93650757867488e-05)   /* BF14CE19 9EAADBB7 */
var _Q4 = float64(4.008217827329362e-06)              /* 3ED0CFCA 86E65239 */
var _Q5 = -Float64FromFloat64(2.0109921818362437e-07) /* BE8AFDB7 6E09C32D */

var _ln2_hi2 = float64(0.6931471803691238)     /* 3fe62e42 fee00000 */
var _ln2_lo2 = float64(1.9082149292705877e-10) /* 3dea39ef 35793c76 */
var _Lg12 = float64(0.6666666666666735)        /* 3FE55555 55555593 */
var _Lg22 = float64(0.3999999999940942)        /* 3FD99999 9997FA04 */
var _Lg32 = float64(0.2857142874366239)        /* 3FD24924 94229359 */
var _Lg42 = float64(0.22222198432149784)       /* 3FCC71C5 1D8E78AF */
var _Lg51 = float64(0.1818357216161805)        /* 3FC74664 96CB03DE */
var _Lg61 = float64(0.15313837699209373)       /* 3FC39A09 D078C69F */
var _Lg71 = float64(0.14798198605116586)       /* 3FC2F112 DF3E5244 */

func Xlog1p(tls *TLS, x3 float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x3=%v, (%v:)", tls, x3, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var R, c, dk, f, hfsq, s, t1, t2, w, z Tdouble_t
	var hu, hx Tuint32_t
	var k int32
	var y float32
	var y1, y2, v1 float64
	var _ /* u at bp+0 */ struct {
		Fi [0]Tuint64_t
		Ff float64
	}
	_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _ = R, c, dk, f, hfsq, hu, hx, k, s, t1, t2, w, y, y1, y2, z, v1
	*(*struct {
		Fi [0]Tuint64_t
		Ff float64
	})(unsafe.Pointer(bp)) = struct {
		Fi [0]Tuint64_t
		Ff float64
	}{}
	*(*float64)(unsafe.Pointer(bp)) = x3
	hx = uint32(*(*Tuint64_t)(unsafe.Pointer(bp)) >> int32(32))
	k = int32(1)
	if hx < uint32(0x3fda827a) || hx>>int32(31) != 0 { /* 1+x < sqrt(2)+ */
		if hx >= uint32(0xbff00000) { /* x <= -1.0 */
			if x3 == float64(-Int32FromInt32(1)) {
				return x3 / float64(0)
			} /* log1p(-1) = -inf */
			return (x3 - x3) / float64(0) /* log1p(x<-1) = NaN */
		}
		if hx<<int32(1) < Uint32FromInt32(Int32FromInt32(0x3ca00000)<<Int32FromInt32(1)) { /* |x| < 2**-53 */
			/* underflow if subnormal */
			if hx&uint32(0x7ff00000) == uint32(0) {
				if uint64(4) == uint64(4) {
					y = float32(x3)
				} else {
					if uint64(4) == uint64(8) {
						y1 = float64(float32(x3))
					} else {
						y2 = float64(float32(x3))
					}
				}
			}
			return x3
		}
		if hx <= uint32(0xbfd2bec4) { /* sqrt(2)/2- <= 1+x < sqrt(2)+ */
			k = 0
			c = Float64FromInt32(0)
			f = x3
		}
	} else {
		if hx >= uint32(0x7ff00000) {
			return x3
		}
	}
	if k != 0 {
		*(*float64)(unsafe.Pointer(bp)) = Float64FromInt32(1) + x3
		hu = uint32(*(*Tuint64_t)(unsafe.Pointer(bp)) >> int32(32))
		hu += Uint32FromInt32(Int32FromInt32(0x3ff00000) - Int32FromInt32(0x3fe6a09e))
		k = Int32FromUint32(hu>>Int32FromInt32(20)) - int32(0x3ff)
		/* correction term ~ log(1+x)-log(u), avoid underflow in c/u */
		if k < int32(54) {
			if k >= int32(2) {
				v1 = Float64FromInt32(1) - (*(*float64)(unsafe.Pointer(bp)) - x3)
			} else {
				v1 = x3 - (*(*float64)(unsafe.Pointer(bp)) - Float64FromInt32(1))
			}
			c = v1
			c /= *(*float64)(unsafe.Pointer(bp))
		} else {
			c = Float64FromInt32(0)
		}
		/* reduce u into [sqrt(2)/2, sqrt(2)] */
		hu = hu&uint32(0x000fffff) + uint32(0x3fe6a09e)
		*(*Tuint64_t)(unsafe.Pointer(bp)) = uint64(hu)<<int32(32) | *(*Tuint64_t)(unsafe.Pointer(bp))&uint64(0xffffffff)
		f = *(*float64)(unsafe.Pointer(bp)) - Float64FromInt32(1)
	}
	hfsq = Tdouble_t(float64(float64(0.5)*f) * f)
	s = f / (Float64FromFloat64(2) + f)
	z = Tdouble_t(s * s)
	w = Tdouble_t(z * z)
	t1 = Tdouble_t(w * (_Lg22 + float64(w*(_Lg42+float64(w*_Lg61)))))
	t2 = Tdouble_t(z * (_Lg12 + float64(w*(_Lg32+float64(w*(_Lg51+float64(w*_Lg71)))))))
	R = t2 + t1
	dk = float64(k)
	return Tdouble_t(s*(hfsq+R)) + (Tdouble_t(dk*_ln2_lo2) + c) - hfsq + f + Tdouble_t(dk*_ln2_hi2)
}

var _ln2_hi3 = float32(0.69313812256)    /* 0x3f317180 */
var _ln2_lo3 = float32(9.0580006145e-06) /* 0x3717f7d1 */
/* |(log(1+s)-log(1-s))/s - Lg(s)| < 2**-34.24 (~[-4.95e-11, 4.97e-11]). */
var _Lg13 = float32(0.6666666269302368)  /* 0.66666662693 */
var _Lg23 = float32(0.40000972151756287) /* 0.40000972152 */
var _Lg33 = float32(0.2849878668785095)  /* 0.28498786688 */
var _Lg43 = float32(0.24279078841209412) /* 0.24279078841 */

func Xlog1pf(tls *TLS, x3 float32) (r float32) {
	if __ccgo_strace {
		trc("tls=%v x3=%v, (%v:)", tls, x3, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var R, c, dk, f, hfsq, s, t1, t2, w, z Tfloat_t
	var iu, ix Tuint32_t
	var k int32
	var y, v1 float32
	var y1, y2 float64
	var _ /* u at bp+0 */ struct {
		Fi [0]Tuint32_t
		Ff float32
	}
	_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _ = R, c, dk, f, hfsq, iu, ix, k, s, t1, t2, w, y, y1, y2, z, v1
	*(*struct {
		Fi [0]Tuint32_t
		Ff float32
	})(unsafe.Pointer(bp)) = struct {
		Fi [0]Tuint32_t
		Ff float32
	}{}
	*(*float32)(unsafe.Pointer(bp)) = x3
	ix = *(*Tuint32_t)(unsafe.Pointer(bp))
	k = int32(1)
	if ix < uint32(0x3ed413d0) || ix>>int32(31) != 0 { /* 1+x < sqrt(2)+  */
		if ix >= uint32(0xbf800000) { /* x <= -1.0 */
			if x3 == float32(-Int32FromInt32(1)) {
				return x3 / Float32FromFloat32(0)
			} /* log1p(-1)=+inf */
			return (x3 - x3) / Float32FromFloat32(0) /* log1p(x<-1)=NaN */
		}
		if ix<<int32(1) < Uint32FromInt32(Int32FromInt32(0x33800000)<<Int32FromInt32(1)) { /* |x| < 2**-24 */
			/* underflow if subnormal */
			if ix&uint32(0x7f800000) == uint32(0) {
				if uint64(4) == uint64(4) {
					y = float32(x3 * x3)
				} else {
					if uint64(4) == uint64(8) {
						y1 = float64(x3 * x3)
					} else {
						y2 = float64(x3 * x3)
					}
				}
			}
			return x3
		}
		if ix <= uint32(0xbe95f619) { /* sqrt(2)/2- <= 1+x < sqrt(2)+ */
			k = 0
			c = Float32FromInt32(0)
			f = x3
		}
	} else {
		if ix >= uint32(0x7f800000) {
			return x3
		}
	}
	if k != 0 {
		*(*float32)(unsafe.Pointer(bp)) = Float32FromInt32(1) + x3
		iu = *(*Tuint32_t)(unsafe.Pointer(bp))
		iu += Uint32FromInt32(Int32FromInt32(0x3f800000) - Int32FromInt32(0x3f3504f3))
		k = Int32FromUint32(iu>>Int32FromInt32(23)) - int32(0x7f)
		/* correction term ~ log(1+x)-log(u), avoid underflow in c/u */
		if k < int32(25) {
			if k >= int32(2) {
				v1 = Float32FromInt32(1) - (*(*float32)(unsafe.Pointer(bp)) - x3)
			} else {
				v1 = x3 - (*(*float32)(unsafe.Pointer(bp)) - Float32FromInt32(1))
			}
			c = v1
			c /= *(*float32)(unsafe.Pointer(bp))
		} else {
			c = Float32FromInt32(0)
		}
		/* reduce u into [sqrt(2)/2, sqrt(2)] */
		iu = iu&uint32(0x007fffff) + uint32(0x3f3504f3)
		*(*Tuint32_t)(unsafe.Pointer(bp)) = iu
		f = *(*float32)(unsafe.Pointer(bp)) - Float32FromInt32(1)
	}
	s = f / (Float32FromFloat32(2) + f)
	z = Tfloat_t(s * s)
	w = Tfloat_t(z * z)
	t1 = Tfloat_t(w * (_Lg23 + float32(w*_Lg43)))
	t2 = Tfloat_t(z * (_Lg13 + float32(w*_Lg33)))
	R = t2 + t1
	hfsq = Tfloat_t(float32(Float32FromFloat32(0.5)*f) * f)
	dk = float32(k)
	return Tfloat_t(s*(hfsq+R)) + (Tfloat_t(dk*_ln2_lo3) + c) - hfsq + f + Tfloat_t(dk*_ln2_hi3)
}

func Xlog1pl(tls *TLS, x float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xlog1p(tls, x)
}

type Tfloat_t = float32

var _B1 = uint32(715094163) /* B1 = (1023-1023/3-0.03306235651)*2**20 */
var _B2 = uint32(696219795) /* B2 = (1023-1023/3-54/3-0.03306235651)*2**20 */

// C documentation
//
//	/* |1/cbrt(x) - p(x)| < 2**-23.5 (~[-7.93e-8, 7.929e-8]). */

var _P0 = float64(1.87595182427177)               /* 0x3ffe03e6, 0x0f61e692 */
var _P1 = -Float64FromFloat64(1.8849797954337717) /* 0xbffe28e0, 0x92f02420 */
var _P2 = float64(1.6214297201053545)             /* 0x3ff9f160, 0x4a49d6c2 */
var _P3 = -Float64FromFloat64(0.758397934778766)  /* 0xbfe844cb, 0xbee751d9 */
var _P4 = float64(0.14599619288661245)            /* 0x3fc2b000, 0xd4e4edd7 */

func Xcbrt(tls *TLS, x float64) (r1 float64) {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
		defer func() { trc("-> %v", r1) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var hx Tuint32_t
	var r, s, t, w Tdouble_t
	var p1 uintptr
	var _ /* u at bp+0 */ struct {
		Fi [0]Tuint64_t
		Ff float64
	}
	_, _, _, _, _, _ = hx, r, s, t, w, p1
	*(*struct {
		Fi [0]Tuint64_t
		Ff float64
	})(unsafe.Pointer(bp)) = struct {
		Fi [0]Tuint64_t
		Ff float64
	}{}
	*(*float64)(unsafe.Pointer(bp)) = x
	hx = uint32(*(*Tuint64_t)(unsafe.Pointer(bp)) >> int32(32) & uint64(0x7fffffff))
	if hx >= uint32(0x7ff00000) { /* cbrt(NaN,INF) is itself */
		return x + x
	}
	/*
	 * Rough cbrt to 5 bits:
	 *    cbrt(2**e*(1+m) ~= 2**(e/3)*(1+(e%3+m)/3)
	 * where e is integral and >= 0, m is real and in [0, 1), and "/" and
	 * "%" are integer division and modulus with rounding towards minus
	 * infinity.  The RHS is always >= the LHS and has a maximum relative
	 * error of about 1 in 16.  Adding a bias of -0.03306235651 to the
	 * (e%3+m)/3 term reduces the error to about 1 in 32. With the IEEE
	 * floating point representation, for finite positive normal values,
	 * ordinary integer divison of the value in bits magically gives
	 * almost exactly the RHS of the above provided we first subtract the
	 * exponent bias (1023 for doubles) and later add it back.  We do the
	 * subtraction virtually to keep e >= 0 so that ordinary integer
	 * division rounds towards minus infinity; this is also efficient.
	 */
	if hx < uint32(0x00100000) { /* zero or subnormal? */
		*(*float64)(unsafe.Pointer(bp)) = float64(x * float64(1.8014398509481984e+16))
		hx = uint32(*(*Tuint64_t)(unsafe.Pointer(bp)) >> int32(32) & uint64(0x7fffffff))
		if hx == uint32(0) {
			return x
		} /* cbrt(0) is itself */
		hx = hx/uint32(3) + _B2
	} else {
		hx = hx/uint32(3) + _B1
	}
	p1 = bp
	*(*Tuint64_t)(unsafe.Pointer(p1)) = Tuint64_t(*(*Tuint64_t)(unsafe.Pointer(p1)) & (Uint64FromUint64(1) << Int32FromInt32(63)))
	*(*Tuint64_t)(unsafe.Pointer(bp)) |= uint64(hx) << int32(32)
	t = *(*float64)(unsafe.Pointer(bp))
	/*
	 * New cbrt to 23 bits:
	 *    cbrt(x) = t*cbrt(x/t**3) ~= t*P(t**3/x)
	 * where P(r) is a polynomial of degree 4 that approximates 1/cbrt(r)
	 * to within 2**-23.5 when |r - 1| < 1/10.  The rough approximation
	 * has produced t such than |t/cbrt(x) - 1| ~< 1/32, and cubing this
	 * gives us bounds for r = t**3/x.
	 *
	 * Try to optimize for parallel evaluation as in __tanf.c.
	 */
	r = Tdouble_t(Tdouble_t(t*t) * (t / x))
	t = Tdouble_t(t * (_P0 + float64(r*(_P1+float64(r*_P2))) + float64(Tdouble_t(Tdouble_t(r*r)*r)*(_P3+float64(r*_P4)))))
	/*
	 * Round t away from zero to 23 bits (sloppily except for ensuring that
	 * the result is larger in magnitude than cbrt(x) but not much more than
	 * 2 23-bit ulps larger).  With rounding towards zero, the error bound
	 * would be ~5/6 instead of ~4/6.  With a maximum error of 2 23-bit ulps
	 * in the rounded t, the infinite-precision error in the Newton
	 * approximation barely affects third digit in the final error
	 * 0.667; the error in the rounded t can be up to about 3 23-bit ulps
	 * before the final error is larger than 0.667 ulps.
	 */
	*(*float64)(unsafe.Pointer(bp)) = t
	*(*Tuint64_t)(unsafe.Pointer(bp)) = uint64(*(*Tuint64_t)(unsafe.Pointer(bp))+Uint64FromUint32(0x80000000)) & uint64(0xffffffffc0000000)
	t = *(*float64)(unsafe.Pointer(bp))
	/* one step Newton iteration to 53 bits with error < 0.667 ulps */
	s = Tdouble_t(t * t)   /* t*t is exact */
	r = x / s              /* error <= 0.5 ulps; |r| < |t| */
	w = t + t              /* t+t is exact */
	r = (r - t) / (w + r)  /* r-t is exact; w+r ~= 3*t */
	t = t + Tdouble_t(t*r) /* error <= 0.5 + 0.5/3 + epsilon */
	return t
}

var _B11 = uint32(709958130) /* B1 = (127-127.0/3-0.03306235651)*2**23 */
var _B21 = uint32(642849266) /* B2 = (127-127.0/3-24/3-0.03306235651)*2**23 */

func Xcbrtf(tls *TLS, x float32) (r1 float32) {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
		defer func() { trc("-> %v", r1) }()
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var T, r Tdouble_t
	var hx Tuint32_t
	var _ /* u at bp+0 */ struct {
		Fi [0]Tuint32_t
		Ff float32
	}
	_, _, _ = T, hx, r
	*(*struct {
		Fi [0]Tuint32_t
		Ff float32
	})(unsafe.Pointer(bp)) = struct {
		Fi [0]Tuint32_t
		Ff float32
	}{}
	*(*float32)(unsafe.Pointer(bp)) = x
	hx = *(*Tuint32_t)(unsafe.Pointer(bp)) & uint32(0x7fffffff)
	if hx >= uint32(0x7f800000) { /* cbrt(NaN,INF) is itself */
		return x + x
	}
	/* rough cbrt to 5 bits */
	if hx < uint32(0x00800000) { /* zero or subnormal? */
		if hx == uint32(0) {
			return x
		} /* cbrt(+-0) is itself */
		*(*float32)(unsafe.Pointer(bp)) = float32(x * Float32FromFloat32(1.6777216e+07))
		hx = *(*Tuint32_t)(unsafe.Pointer(bp)) & uint32(0x7fffffff)
		hx = hx/uint32(3) + _B21
	} else {
		hx = hx/uint32(3) + _B11
	}
	*(*Tuint32_t)(unsafe.Pointer(bp)) &= uint32(0x80000000)
	*(*Tuint32_t)(unsafe.Pointer(bp)) |= hx
	/*
	 * First step Newton iteration (solving t*t-x/t == 0) to 16 bits.  In
	 * double precision so that its terms can be arranged for efficiency
	 * without causing overflow or underflow.
	 */
	T = float64(*(*float32)(unsafe.Pointer(bp)))
	r = Tdouble_t(Tdouble_t(T*T) * T)
	T = Tdouble_t(T*(float64(x)+float64(x)+r)) / (float64(x) + r + r)
	/*
	 * Second step Newton iteration to 47 bits.  In double precision for
	 * efficiency and accuracy.
	 */
	r = Tdouble_t(Tdouble_t(T*T) * T)
	T = Tdouble_t(T*(float64(x)+float64(x)+r)) / (float64(x) + r + r)
	/* rounding to 24 bits is perfect in round-to-nearest mode */
	return float32(T)
}

func Xcbrtl(tls *TLS, x float64) (r float64) {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	return Xcbrt(tls, x)
}
