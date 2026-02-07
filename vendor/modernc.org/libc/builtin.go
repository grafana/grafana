// Copyright 2024 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build linux && (amd64 || arm64 || loong64 || ppc64le || s390x || riscv64 || 386 || arm)

package libc // import "modernc.org/libc"

import (
	"fmt"
	"math"
	mbits "math/bits"
	"os"
	"unsafe"

	"modernc.org/mathutil"
)

func X__builtin_inff(tls *TLS) float32 {
	return float32(math.Inf(1))
}

func X__builtin_nanf(tls *TLS, s uintptr) float32 {
	return float32(math.NaN())
}

func X__builtin_printf(tls *TLS, fmt uintptr, va uintptr) (r int32) {
	return Xprintf(tls, fmt, va)
}

func X__builtin_round(tls *TLS, x float64) (r float64) {
	return Xround(tls, x)
}

func X__builtin_lround(tls *TLS, x float64) (r long) {
	return Xlround(tls, x)
}

func X__builtin_roundf(tls *TLS, x float32) (r float32) {
	return Xroundf(tls, x)
}

func X__builtin_expect(t *TLS, exp, c long) long {
	return exp
}

func X__builtin_bzero(t *TLS, s uintptr, n Tsize_t) {
	Xbzero(t, s, n)
}

func X__builtin_abort(t *TLS) {
	Xabort(t)
}

func X__builtin_abs(t *TLS, j int32) int32 {
	return Xabs(t, j)
}

func X__builtin_ctz(t *TLS, n uint32) int32 {
	return int32(mbits.TrailingZeros32(n))
}

func X__builtin_clz(t *TLS, n uint32) int32 {
	return int32(mbits.LeadingZeros32(n))
}

func X__builtin_clzll(t *TLS, n uint64) int32 {
	return int32(mbits.LeadingZeros64(n))
}
func X__builtin_constant_p_impl() { panic(todo("internal error: should never be called")) }

func X__builtin_copysign(t *TLS, x, y float64) float64 {
	return Xcopysign(t, x, y)
}

func X__builtin_copysignf(t *TLS, x, y float32) float32 {
	return Xcopysignf(t, x, y)
}

func X__builtin_copysignl(t *TLS, x, y float64) float64 {
	return Xcopysign(t, x, y)
}

func X__builtin_exit(t *TLS, status int32) {
	Xexit(t, status)
}

func X__builtin_fabs(t *TLS, x float64) float64 {
	return Xfabs(t, x)
}

func X__builtin_fabsf(t *TLS, x float32) float32 {
	return Xfabsf(t, x)
}

func X__builtin_fabsl(t *TLS, x float64) float64 {
	return Xfabsl(t, x)
}

func X__builtin_free(t *TLS, ptr uintptr) {
	Xfree(t, ptr)
}

func X__builtin_getentropy(t *TLS, buf uintptr, n Tsize_t) int32 {
	return Xgetentropy(t, buf, n)
}

func X__builtin_huge_val(t *TLS) float64 {
	return math.Inf(1)
}

func X__builtin_huge_valf(t *TLS) float32 {
	return float32(math.Inf(1))
}

func X__builtin_inf(t *TLS) float64 {
	return math.Inf(1)
}

func X__builtin_infl(t *TLS) float64 {
	return math.Inf(1)
}

func X__builtin_malloc(t *TLS, size Tsize_t) uintptr {
	return Xmalloc(t, size)
}

func X__builtin_memcmp(t *TLS, s1, s2 uintptr, n Tsize_t) int32 {
	return Xmemcmp(t, s1, s2, n)
}

func X__builtin_nan(t *TLS, s uintptr) float64 {
	return math.NaN()
}

func X__builtin_nanl(t *TLS, s uintptr) float64 {
	return math.NaN()
}

func X__builtin_prefetch(t *TLS, addr, args uintptr) {
}

func X__builtin_strchr(t *TLS, s uintptr, c int32) uintptr {
	return Xstrchr(t, s, c)
}

func X__builtin_strcmp(t *TLS, s1, s2 uintptr) int32 {
	return Xstrcmp(t, s1, s2)
}

func X__builtin_strcpy(t *TLS, dest, src uintptr) uintptr {
	return Xstrcpy(t, dest, src)
}

func X__builtin_strlen(t *TLS, s uintptr) Tsize_t {
	return Xstrlen(t, s)
}

func X__builtin_trap(t *TLS) {
	Xabort(t)
}

func X__builtin_popcount(t *TLS, x uint32) int32 {
	return int32(mbits.OnesCount32(x))
}

// char * __builtin___strcpy_chk (char *dest, const char *src, size_t os);
func X__builtin___strcpy_chk(t *TLS, dest, src uintptr, os Tsize_t) uintptr {
	return Xstrcpy(t, dest, src)
}

func X__builtin_mmap(t *TLS, addr uintptr, length Tsize_t, prot, flags, fd int32, offset Toff_t) uintptr {
	return Xmmap(t, addr, length, prot, flags, fd, offset)
}

// uint16_t __builtin_bswap16 (uint32_t x)
func X__builtin_bswap16(t *TLS, x uint16) uint16 {
	return x<<8 |
		x>>8
}

// uint32_t __builtin_bswap32 (uint32_t x)
func X__builtin_bswap32(t *TLS, x uint32) uint32 {
	return x<<24 |
		x&0xff00<<8 |
		x&0xff0000>>8 |
		x>>24
}

// uint64_t __builtin_bswap64 (uint64_t x)
func X__builtin_bswap64(t *TLS, x uint64) uint64 {
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
	r, ovf := mathutil.AddOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_add_overflow (type1 a, type2 b, type3 *res)
func X__builtin_add_overflowUint32(t *TLS, a, b uint32, res uintptr) int32 {
	r := a + b
	*(*uint32)(unsafe.Pointer(res)) = r
	return Bool32(r < a)
}

// bool __builtin_add_overflow (type1 a, type2 b, type3 *res)
func X__builtin_add_overflowUint64(t *TLS, a, b uint64, res uintptr) int32 {
	r := a + b
	*(*uint64)(unsafe.Pointer(res)) = r
	return Bool32(r < a)
}

// bool __builtin_sub_overflow (type1 a, type2 b, type3 *res)
func X__builtin_sub_overflowInt64(t *TLS, a, b int64, res uintptr) int32 {
	r, ovf := mathutil.SubOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowInt64(t *TLS, a, b int64, res uintptr) int32 {
	r, ovf := mathutil.MulOverflowInt64(a, b)
	*(*int64)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowUint64(t *TLS, a, b uint64, res uintptr) int32 {
	hi, lo := mbits.Mul64(a, b)
	*(*uint64)(unsafe.Pointer(res)) = lo
	return Bool32(hi != 0)
}

// bool __builtin_mul_overflow (type1 a, type2 b, type3 *res)
func X__builtin_mul_overflowUint128(t *TLS, a, b Uint128, res uintptr) int32 {
	r, ovf := a.mulOvf(b)
	*(*Uint128)(unsafe.Pointer(res)) = r
	return Bool32(ovf)
}

func X__builtin_unreachable(t *TLS) {
	fmt.Fprintf(os.Stderr, "unrechable\n")
	os.Stderr.Sync()
	Xexit(t, 1)
}

func X__builtin_snprintf(t *TLS, str uintptr, size Tsize_t, format, args uintptr) int32 {
	return Xsnprintf(t, str, size, format, args)
}

func X__builtin_sprintf(t *TLS, str, format, args uintptr) (r int32) {
	return Xsprintf(t, str, format, args)
}

func X__builtin_memcpy(t *TLS, dest, src uintptr, n Tsize_t) (r uintptr) {
	return Xmemcpy(t, dest, src, n)
}

// void * __builtin___memcpy_chk (void *dest, const void *src, size_t n, size_t os);
func X__builtin___memcpy_chk(t *TLS, dest, src uintptr, n, os Tsize_t) (r uintptr) {
	if os != ^Tsize_t(0) && n < os {
		Xabort(t)
	}

	return Xmemcpy(t, dest, src, n)
}

func X__builtin_memset(t *TLS, s uintptr, c int32, n Tsize_t) uintptr {
	return Xmemset(t, s, c, n)
}

// void * __builtin___memset_chk (void *s, int c, size_t n, size_t os);
func X__builtin___memset_chk(t *TLS, s uintptr, c int32, n, os Tsize_t) uintptr {
	if os < n {
		Xabort(t)
	}

	return Xmemset(t, s, c, n)
}

// size_t __builtin_object_size (const void * ptr, int type)
func X__builtin_object_size(t *TLS, p uintptr, typ int32) Tsize_t {
	switch typ {
	case 0, 1:
		return ^Tsize_t(0)
	default:
		return 0
	}
}

// int __builtin___sprintf_chk (char *s, int flag, size_t os, const char *fmt, ...);
func X__builtin___sprintf_chk(t *TLS, s uintptr, flag int32, os Tsize_t, format, args uintptr) (r int32) {
	return Xsprintf(t, s, format, args)
}

func X__builtin_vsnprintf(t *TLS, str uintptr, size Tsize_t, format, va uintptr) int32 {
	return Xvsnprintf(t, str, size, format, va)
}

// int __builtin___snprintf_chk(char * str, size_t maxlen, int flag, size_t os, const char * format, ...);
func X__builtin___snprintf_chk(t *TLS, str uintptr, maxlen Tsize_t, flag int32, os Tsize_t, format, args uintptr) (r int32) {
	if os != ^Tsize_t(0) && maxlen > os {
		Xabort(t)
	}

	return Xsnprintf(t, str, maxlen, format, args)
}

// int __builtin___vsnprintf_chk (char *s, size_t maxlen, int flag, size_t os, const char *fmt, va_list ap);
func X__builtin___vsnprintf_chk(t *TLS, str uintptr, maxlen Tsize_t, flag int32, os Tsize_t, format, args uintptr) (r int32) {
	if os != ^Tsize_t(0) && maxlen > os {
		Xabort(t)
	}

	return Xsnprintf(t, str, maxlen, format, args)
}

func Xisnan(t *TLS, x float64) int32 {
	return X__builtin_isnan(t, x)
}

func X__isnan(t *TLS, x float64) int32 {
	return X__builtin_isnan(t, x)
}

func X__builtin_isnan(t *TLS, x float64) int32 {
	return Bool32(math.IsNaN(x))
}

func Xisnanf(t *TLS, arg float32) int32 {
	return X__builtin_isnanf(t, arg)
}

func X__isnanf(t *TLS, arg float32) int32 {
	return X__builtin_isnanf(t, arg)
}

func X__builtin_isnanf(t *TLS, x float32) int32 {
	return Bool32(math.IsNaN(float64(x)))
}

func Xisnanl(t *TLS, arg float64) int32 {
	return X__builtin_isnanl(t, arg)
}

func X__isnanl(t *TLS, arg float64) int32 {
	return X__builtin_isnanl(t, arg)
}

func X__builtin_isnanl(t *TLS, x float64) int32 {
	return Bool32(math.IsNaN(x))
}

func X__builtin_llabs(tls *TLS, a int64) int64 {
	return Xllabs(tls, a)
}

func X__builtin_log2(t *TLS, x float64) float64 {
	return Xlog2(t, x)
}

func X__builtin___strncpy_chk(t *TLS, dest, src uintptr, n, os Tsize_t) (r uintptr) {
	if n != ^Tsize_t(0) && os < n {
		Xabort(t)
	}

	return Xstrncpy(t, dest, src, n)
}

func X__builtin___strcat_chk(t *TLS, dest, src uintptr, os Tsize_t) (r uintptr) {
	return Xstrcat(t, dest, src)
}

func X__builtin___memmove_chk(t *TLS, dest, src uintptr, n, os Tsize_t) uintptr {
	if os != ^Tsize_t(0) && os < n {
		Xabort(t)
	}

	return Xmemmove(t, dest, src, n)
}

func X__builtin_isunordered(t *TLS, a, b float64) int32 {
	return Bool32(math.IsNaN(a) || math.IsNaN(b))
}

func X__builtin_ffs(tls *TLS, i int32) (r int32) {
	return Xffs(tls, i)
}

func X__builtin_rintf(tls *TLS, x float32) (r float32) {
	return Xrintf(tls, x)
}

func X__builtin_lrintf(tls *TLS, x float32) (r long) {
	return Xlrintf(tls, x)
}

func X__builtin_lrint(tls *TLS, x float64) (r long) {
	return Xlrint(tls, x)
}

// double __builtin_fma(double x, double y, double z);
func X__builtin_fma(tls *TLS, x, y, z float64) (r float64) {
	return math.FMA(x, y, z)
}

func X__builtin_alloca(tls *TLS, size Tsize_t) uintptr {
	return Xalloca(tls, size)
}

func X__builtin_isprint(tls *TLS, c int32) (r int32) {
	return Xisprint(tls, c)
}

func X__builtin_isblank(tls *TLS, c int32) (r int32) {
	return Xisblank(tls, c)
}

func X__builtin_trunc(tls *TLS, x float64) (r float64) {
	return Xtrunc(tls, x)
}

func X__builtin_hypot(tls *TLS, x float64, y float64) (r float64) {
	return Xhypot(tls, x, y)
}

func X__builtin_fmax(tls *TLS, x float64, y float64) (r float64) {
	return Xfmax(tls, x, y)
}

func X__builtin_fmin(tls *TLS, x float64, y float64) (r float64) {
	return Xfmin(tls, x, y)
}
