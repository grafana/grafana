// Code generated for linux/amd64 by 'qbecc --abi0wrap .', DO NOT EDIT.

package libc

import "unsafe"

var _ unsafe.Pointer

//go:noescape
func Y_Exit(tls *TLS, ec int32)

//go:noescape
func Y_IO_feof_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y_IO_ferror_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y_IO_getc(tls *TLS, f1 uintptr) (r int32)

//go:noescape
func Y_IO_getc_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y_IO_putc(tls *TLS, c1 int32, f1 uintptr) (r int32)

//go:noescape
func Y_IO_putc_unlocked(tls *TLS, c int32, f uintptr) (r int32)

//go:noescape
func Y___errno_location(tls *TLS) (r uintptr)

//go:noescape
func Y__aio_close(tls *TLS, fd int32) (_2 int32)

//go:noescape
func Y__asctime_r(tls *TLS, tm uintptr, buf uintptr) (r uintptr)

//go:noescape
func Y__assert_fail(tls *TLS, expr uintptr, file uintptr, line int32, func1 uintptr)

//go:noescape
func Y__atomic_compare_exchangeInt16(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)

//go:noescape
func Y__atomic_compare_exchangeInt32(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)

//go:noescape
func Y__atomic_compare_exchangeInt64(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)

//go:noescape
func Y__atomic_compare_exchangeInt8(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)

//go:noescape
func Y__atomic_compare_exchangeUint16(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)

//go:noescape
func Y__atomic_compare_exchangeUint32(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)

//go:noescape
func Y__atomic_compare_exchangeUint64(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)

//go:noescape
func Y__atomic_compare_exchangeUint8(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)

//go:noescape
func Y__atomic_exchangeInt16(t *TLS, ptr, val, ret uintptr, _ int32)

//go:noescape
func Y__atomic_exchangeInt32(t *TLS, ptr, val, ret uintptr, _ int32)

//go:noescape
func Y__atomic_exchangeInt64(t *TLS, ptr, val, ret uintptr, _ int32)

//go:noescape
func Y__atomic_exchangeInt8(t *TLS, ptr, val, ret uintptr, _ int32)

//go:noescape
func Y__atomic_exchangeUint16(t *TLS, ptr, val, ret uintptr, _ int32)

//go:noescape
func Y__atomic_exchangeUint32(t *TLS, ptr, val, ret uintptr, _ int32)

//go:noescape
func Y__atomic_exchangeUint64(t *TLS, ptr, val, ret uintptr, _ int32)

//go:noescape
func Y__atomic_exchangeUint8(t *TLS, ptr, val, ret uintptr, _ int32)

//go:noescape
func Y__atomic_fetch_addInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__atomic_fetch_addInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__atomic_fetch_addInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__atomic_fetch_addInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__atomic_fetch_addUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__atomic_fetch_addUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__atomic_fetch_addUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__atomic_fetch_addUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__atomic_fetch_andInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__atomic_fetch_andInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__atomic_fetch_andInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__atomic_fetch_andInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__atomic_fetch_andUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__atomic_fetch_andUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__atomic_fetch_andUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__atomic_fetch_andUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__atomic_fetch_orInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__atomic_fetch_orInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__atomic_fetch_orInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__atomic_fetch_orInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__atomic_fetch_orUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__atomic_fetch_orUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__atomic_fetch_orUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__atomic_fetch_orUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__atomic_fetch_subInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__atomic_fetch_subInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__atomic_fetch_subInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__atomic_fetch_subInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__atomic_fetch_subUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__atomic_fetch_subUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__atomic_fetch_subUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__atomic_fetch_subUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__atomic_fetch_xorInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__atomic_fetch_xorInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__atomic_fetch_xorInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__atomic_fetch_xorInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__atomic_fetch_xorUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__atomic_fetch_xorUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__atomic_fetch_xorUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__atomic_fetch_xorUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__atomic_loadInt16(t *TLS, ptr, ret uintptr, memorder int32)

//go:noescape
func Y__atomic_loadInt32(t *TLS, ptr, ret uintptr, memorder int32)

//go:noescape
func Y__atomic_loadInt64(t *TLS, ptr, ret uintptr, memorder int32)

//go:noescape
func Y__atomic_loadInt8(t *TLS, ptr, ret uintptr, memorder int32)

//go:noescape
func Y__atomic_loadUint16(t *TLS, ptr, ret uintptr, memorder int32)

//go:noescape
func Y__atomic_loadUint32(t *TLS, ptr, ret uintptr, memorder int32)

//go:noescape
func Y__atomic_loadUint64(t *TLS, ptr, ret uintptr, memorder int32)

//go:noescape
func Y__atomic_loadUint8(t *TLS, ptr, ret uintptr, memorder int32)

//go:noescape
func Y__atomic_storeInt16(t *TLS, ptr, val uintptr, memorder int32)

//go:noescape
func Y__atomic_storeInt32(t *TLS, ptr, val uintptr, memorder int32)

//go:noescape
func Y__atomic_storeInt64(t *TLS, ptr, val uintptr, memorder int32)

//go:noescape
func Y__atomic_storeInt8(t *TLS, ptr, val uintptr, memorder int32)

//go:noescape
func Y__atomic_storeUint16(t *TLS, ptr, val uintptr, memorder int32)

//go:noescape
func Y__atomic_storeUint32(t *TLS, ptr, val uintptr, memorder int32)

//go:noescape
func Y__atomic_storeUint64(t *TLS, ptr, val uintptr, memorder int32)

//go:noescape
func Y__atomic_storeUint8(t *TLS, ptr, val uintptr, memorder int32)

//go:noescape
func Y__block_all_sigs(tls *TLS, set uintptr)

//go:noescape
func Y__block_app_sigs(tls *TLS, set uintptr)

//go:noescape
func Y__builtin___memcpy_chk(t *TLS, dest, src uintptr, n, os Tsize_t) (r uintptr)

//go:noescape
func Y__builtin___memmove_chk(t *TLS, dest, src uintptr, n, os Tsize_t) (_3 uintptr)

//go:noescape
func Y__builtin___memset_chk(t *TLS, s uintptr, c int32, n, os Tsize_t) (_4 uintptr)

//go:noescape
func Y__builtin___snprintf_chk(t *TLS, str uintptr, maxlen Tsize_t, flag int32, os Tsize_t, format, args uintptr) (r int32)

//go:noescape
func Y__builtin___sprintf_chk(t *TLS, s uintptr, flag int32, os Tsize_t, format, args uintptr) (r int32)

//go:noescape
func Y__builtin___strcat_chk(t *TLS, dest, src uintptr, os Tsize_t) (r uintptr)

//go:noescape
func Y__builtin___strcpy_chk(t *TLS, dest, src uintptr, os Tsize_t) (_3 uintptr)

//go:noescape
func Y__builtin___strncpy_chk(t *TLS, dest, src uintptr, n, os Tsize_t) (r uintptr)

//go:noescape
func Y__builtin___vsnprintf_chk(t *TLS, str uintptr, maxlen Tsize_t, flag int32, os Tsize_t, format, args uintptr) (r int32)

//go:noescape
func Y__builtin_abort(t *TLS)

//go:noescape
func Y__builtin_abs(t *TLS, j int32) (_2 int32)

//go:noescape
func Y__builtin_add_overflowInt64(t *TLS, a, b int64, res uintptr) (_3 int32)

//go:noescape
func Y__builtin_add_overflowUint32(t *TLS, a, b uint32, res uintptr) (_3 int32)

//go:noescape
func Y__builtin_add_overflowUint64(t *TLS, a, b uint64, res uintptr) (_3 int32)

//go:noescape
func Y__builtin_alloca(tls *TLS, size Tsize_t) (_2 uintptr)

//go:noescape
func Y__builtin_bswap16(t *TLS, x uint16) (_2 uint16)

//go:noescape
func Y__builtin_bswap32(t *TLS, x uint32) (_2 uint32)

//go:noescape
func Y__builtin_bswap64(t *TLS, x uint64) (_2 uint64)

//go:noescape
func Y__builtin_bzero(t *TLS, s uintptr, n Tsize_t)

//go:noescape
func Y__builtin_clz(t *TLS, n uint32) (_2 int32)

//go:noescape
func Y__builtin_clzl(t *TLS, n ulong) (_2 int32)

//go:noescape
func Y__builtin_clzll(t *TLS, n uint64) (_2 int32)

//go:noescape
func Y__builtin_copysign(t *TLS, x, y float64) (_2 float64)

//go:noescape
func Y__builtin_copysignf(t *TLS, x, y float32) (_2 float32)

//go:noescape
func Y__builtin_copysignl(t *TLS, x, y float64) (_2 float64)

//go:noescape
func Y__builtin_ctz(t *TLS, n uint32) (_2 int32)

//go:noescape
func Y__builtin_ctzl(tls *TLS, x ulong) (_2 int32)

//go:noescape
func Y__builtin_exit(t *TLS, status int32)

//go:noescape
func Y__builtin_expect(t *TLS, exp, c long) (_2 long)

//go:noescape
func Y__builtin_fabs(t *TLS, x float64) (_2 float64)

//go:noescape
func Y__builtin_fabsf(t *TLS, x float32) (_2 float32)

//go:noescape
func Y__builtin_fabsl(t *TLS, x float64) (_2 float64)

//go:noescape
func Y__builtin_ffs(tls *TLS, i int32) (r int32)

//go:noescape
func Y__builtin_fma(tls *TLS, x, y, z float64) (r float64)

//go:noescape
func Y__builtin_fmax(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Y__builtin_fmin(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Y__builtin_free(t *TLS, ptr uintptr)

//go:noescape
func Y__builtin_getentropy(t *TLS, buf uintptr, n Tsize_t) (_3 int32)

//go:noescape
func Y__builtin_huge_val(t *TLS) (_1 float64)

//go:noescape
func Y__builtin_huge_valf(t *TLS) (_1 float32)

//go:noescape
func Y__builtin_hypot(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Y__builtin_inf(t *TLS) (_1 float64)

//go:noescape
func Y__builtin_inff(tls *TLS) (_1 float32)

//go:noescape
func Y__builtin_infl(t *TLS) (_1 float64)

//go:noescape
func Y__builtin_isblank(tls *TLS, c int32) (r int32)

//go:noescape
func Y__builtin_isnan(t *TLS, x float64) (_2 int32)

//go:noescape
func Y__builtin_isnanf(t *TLS, x float32) (_2 int32)

//go:noescape
func Y__builtin_isnanl(t *TLS, x float64) (_2 int32)

//go:noescape
func Y__builtin_isprint(tls *TLS, c int32) (r int32)

//go:noescape
func Y__builtin_isunordered(t *TLS, a, b float64) (_2 int32)

//go:noescape
func Y__builtin_llabs(tls *TLS, a int64) (_2 int64)

//go:noescape
func Y__builtin_log2(t *TLS, x float64) (_2 float64)

//go:noescape
func Y__builtin_lrint(tls *TLS, x float64) (r long)

//go:noescape
func Y__builtin_lrintf(tls *TLS, x float32) (r long)

//go:noescape
func Y__builtin_lround(tls *TLS, x float64) (r long)

//go:noescape
func Y__builtin_malloc(t *TLS, size Tsize_t) (_2 uintptr)

//go:noescape
func Y__builtin_memcmp(t *TLS, s1, s2 uintptr, n Tsize_t) (_3 int32)

//go:noescape
func Y__builtin_memcpy(t *TLS, dest, src uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Y__builtin_memset(t *TLS, s uintptr, c int32, n Tsize_t) (_4 uintptr)

//go:noescape
func Y__builtin_mmap(t *TLS, addr uintptr, length Tsize_t, prot, flags, fd int32, offset Toff_t) (_5 uintptr)

//go:noescape
func Y__builtin_mul_overflowInt64(t *TLS, a, b int64, res uintptr) (_3 int32)

//go:noescape
func Y__builtin_mul_overflowUint128(t *TLS, a, b Uint128, res uintptr) (_3 int32)

//go:noescape
func Y__builtin_mul_overflowUint64(t *TLS, a, b uint64, res uintptr) (_3 int32)

//go:noescape
func Y__builtin_nan(t *TLS, s uintptr) (_2 float64)

//go:noescape
func Y__builtin_nanf(tls *TLS, s uintptr) (_2 float32)

//go:noescape
func Y__builtin_nanl(t *TLS, s uintptr) (_2 float64)

//go:noescape
func Y__builtin_object_size(t *TLS, p uintptr, typ int32) (_3 Tsize_t)

//go:noescape
func Y__builtin_popcount(t *TLS, x uint32) (_2 int32)

//go:noescape
func Y__builtin_popcountl(t *TLS, x ulong) (_2 int32)

//go:noescape
func Y__builtin_prefetch(t *TLS, addr, args uintptr)

//go:noescape
func Y__builtin_printf(tls *TLS, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Y__builtin_rintf(tls *TLS, x float32) (r float32)

//go:noescape
func Y__builtin_round(tls *TLS, x float64) (r float64)

//go:noescape
func Y__builtin_roundf(tls *TLS, x float32) (r float32)

//go:noescape
func Y__builtin_snprintf(t *TLS, str uintptr, size Tsize_t, format, args uintptr) (_4 int32)

//go:noescape
func Y__builtin_sprintf(t *TLS, str, format, args uintptr) (r int32)

//go:noescape
func Y__builtin_strchr(t *TLS, s uintptr, c int32) (_3 uintptr)

//go:noescape
func Y__builtin_strcmp(t *TLS, s1, s2 uintptr) (_2 int32)

//go:noescape
func Y__builtin_strcpy(t *TLS, dest, src uintptr) (_2 uintptr)

//go:noescape
func Y__builtin_strlen(t *TLS, s uintptr) (_2 Tsize_t)

//go:noescape
func Y__builtin_sub_overflowInt64(t *TLS, a, b int64, res uintptr) (_3 int32)

//go:noescape
func Y__builtin_trap(t *TLS)

//go:noescape
func Y__builtin_trunc(tls *TLS, x float64) (r float64)

//go:noescape
func Y__builtin_unreachable(t *TLS)

//go:noescape
func Y__builtin_vsnprintf(t *TLS, str uintptr, size Tsize_t, format, va uintptr) (_4 int32)

//go:noescape
func Y__c11_atomic_compare_exchange_strongInt16(t *TLS, ptr, expected uintptr, desired int16, success, failure int32) (_4 int32)

//go:noescape
func Y__c11_atomic_compare_exchange_strongInt32(t *TLS, ptr, expected uintptr, desired, success, failure int32) (_3 int32)

//go:noescape
func Y__c11_atomic_compare_exchange_strongInt64(t *TLS, ptr, expected uintptr, desired int64, success, failure int32) (_4 int32)

//go:noescape
func Y__c11_atomic_compare_exchange_strongInt8(t *TLS, ptr, expected uintptr, desired int8, success, failure int32) (_4 int32)

//go:noescape
func Y__c11_atomic_compare_exchange_strongUint16(t *TLS, ptr, expected uintptr, desired uint16, success, failure int32) (_4 int32)

//go:noescape
func Y__c11_atomic_compare_exchange_strongUint32(t *TLS, ptr, expected uintptr, desired uint32, success, failure int32) (_4 int32)

//go:noescape
func Y__c11_atomic_compare_exchange_strongUint64(t *TLS, ptr, expected uintptr, desired uint64, success, failure int32) (_4 int32)

//go:noescape
func Y__c11_atomic_compare_exchange_strongUint8(t *TLS, ptr, expected uintptr, desired uint8, success, failure int32) (_4 int32)

//go:noescape
func Y__c11_atomic_exchangeInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__c11_atomic_exchangeInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__c11_atomic_exchangeInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__c11_atomic_exchangeInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__c11_atomic_exchangeUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__c11_atomic_exchangeUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__c11_atomic_exchangeUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__c11_atomic_exchangeUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__c11_atomic_fetch_addInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__c11_atomic_fetch_addInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__c11_atomic_fetch_addInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__c11_atomic_fetch_addInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__c11_atomic_fetch_addUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__c11_atomic_fetch_addUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__c11_atomic_fetch_addUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__c11_atomic_fetch_addUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__c11_atomic_fetch_andInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__c11_atomic_fetch_andInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__c11_atomic_fetch_andInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__c11_atomic_fetch_andInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__c11_atomic_fetch_andUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__c11_atomic_fetch_andUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__c11_atomic_fetch_andUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__c11_atomic_fetch_andUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__c11_atomic_fetch_orInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__c11_atomic_fetch_orInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__c11_atomic_fetch_orInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__c11_atomic_fetch_orInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__c11_atomic_fetch_orUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__c11_atomic_fetch_orUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__c11_atomic_fetch_orUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__c11_atomic_fetch_orUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__c11_atomic_fetch_subInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__c11_atomic_fetch_subInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__c11_atomic_fetch_subInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__c11_atomic_fetch_subInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__c11_atomic_fetch_subUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__c11_atomic_fetch_subUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__c11_atomic_fetch_subUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__c11_atomic_fetch_subUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__c11_atomic_fetch_xorInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)

//go:noescape
func Y__c11_atomic_fetch_xorInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)

//go:noescape
func Y__c11_atomic_fetch_xorInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)

//go:noescape
func Y__c11_atomic_fetch_xorInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)

//go:noescape
func Y__c11_atomic_fetch_xorUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)

//go:noescape
func Y__c11_atomic_fetch_xorUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)

//go:noescape
func Y__c11_atomic_fetch_xorUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)

//go:noescape
func Y__c11_atomic_fetch_xorUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)

//go:noescape
func Y__c11_atomic_loadInt16(t *TLS, ptr uintptr, memorder int32) (r int16)

//go:noescape
func Y__c11_atomic_loadInt32(t *TLS, ptr uintptr, memorder int32) (r int32)

//go:noescape
func Y__c11_atomic_loadInt64(t *TLS, ptr uintptr, memorder int32) (r int64)

//go:noescape
func Y__c11_atomic_loadInt8(t *TLS, ptr uintptr, memorder int32) (r int8)

//go:noescape
func Y__c11_atomic_loadUint16(t *TLS, ptr uintptr, memorder int32) (r uint16)

//go:noescape
func Y__c11_atomic_loadUint32(t *TLS, ptr uintptr, memorder int32) (r uint32)

//go:noescape
func Y__c11_atomic_loadUint64(t *TLS, ptr uintptr, memorder int32) (r uint64)

//go:noescape
func Y__c11_atomic_loadUint8(t *TLS, ptr uintptr, memorder int32) (r uint8)

//go:noescape
func Y__c11_atomic_storeInt16(t *TLS, ptr uintptr, val int16, memorder int32)

//go:noescape
func Y__c11_atomic_storeInt32(t *TLS, ptr uintptr, val int32, memorder int32)

//go:noescape
func Y__c11_atomic_storeInt64(t *TLS, ptr uintptr, val int64, memorder int32)

//go:noescape
func Y__c11_atomic_storeInt8(t *TLS, ptr uintptr, val int8, memorder int32)

//go:noescape
func Y__c11_atomic_storeUint16(t *TLS, ptr uintptr, val uint16, memorder int32)

//go:noescape
func Y__c11_atomic_storeUint32(t *TLS, ptr uintptr, val uint32, memorder int32)

//go:noescape
func Y__c11_atomic_storeUint64(t *TLS, ptr uintptr, val uint64, memorder int32)

//go:noescape
func Y__c11_atomic_storeUint8(t *TLS, ptr uintptr, val uint8, memorder int32)

//go:noescape
func Y__ccgo_dmesg(t *TLS, fmt uintptr, va uintptr)

//go:noescape
func Y__ccgo_getMutexType(tls *TLS, m uintptr) (_2 int32)

//go:noescape
func Y__ccgo_in6addr_anyp(t *TLS) (_1 uintptr)

//go:noescape
func Y__ccgo_pthreadAttrGetDetachState(tls *TLS, a uintptr) (_2 int32)

//go:noescape
func Y__ccgo_pthreadMutexattrGettype(tls *TLS, a uintptr) (_2 int32)

//go:noescape
func Y__ccgo_sqlite3_log(t *TLS, iErrCode int32, zFormat uintptr, args uintptr)

//go:noescape
func Y__clock_gettime(tls *TLS, clk Tclockid_t, ts uintptr) (r1 int32)

//go:noescape
func Y__clock_nanosleep(tls *TLS, clk Tclockid_t, flags int32, req uintptr, rem uintptr) (r int32)

//go:noescape
func Y__cmsg_nxthdr(t *TLS, msgh, cmsg uintptr) (_2 uintptr)

//go:noescape
func Y__convert_scm_timestamps(tls *TLS, msg uintptr, csize Tsocklen_t)

//go:noescape
func Y__cos(tls *TLS, x float64, y float64) (r1 float64)

//go:noescape
func Y__cosdf(tls *TLS, x float64) (r1 float32)

//go:noescape
func Y__crypt_blowfish(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)

//go:noescape
func Y__crypt_des(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)

//go:noescape
func Y__crypt_md5(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)

//go:noescape
func Y__crypt_r(tls *TLS, key uintptr, salt uintptr, data uintptr) (r uintptr)

//go:noescape
func Y__crypt_sha256(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)

//go:noescape
func Y__crypt_sha512(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)

//go:noescape
func Y__ctype_b_loc(tls *TLS) (r uintptr)

//go:noescape
func Y__ctype_get_mb_cur_max(tls *TLS) (r Tsize_t)

//go:noescape
func Y__ctype_tolower_loc(tls *TLS) (r uintptr)

//go:noescape
func Y__ctype_toupper_loc(tls *TLS) (r uintptr)

//go:noescape
func Y__des_setkey(tls *TLS, key uintptr, ekey uintptr)

//go:noescape
func Y__dn_expand(tls *TLS, base uintptr, end uintptr, src uintptr, dest uintptr, space int32) (r int32)

//go:noescape
func Y__dns_parse(tls *TLS, r uintptr, rlen int32, __ccgo_fp_callback uintptr, ctx uintptr) (r1 int32)

//go:noescape
func __ccgo_abi0___dns_parse_2(_0 *TLS, _1 uintptr, _2 int32, _3 uintptr, _4 int32, _5 uintptr, _6 int32, __ccgo_fp uintptr) (_7 int32)

func __ccgo_abiInternal___dns_parse_2(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 int32, _3 uintptr, _4 int32, _5 uintptr, _6 int32) (_7 int32) {
		return __ccgo_abi0___dns_parse_2(_0, _1, _2, _3, _4, _5, _6, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Y__do_des(tls *TLS, l_in Tuint32_t, r_in Tuint32_t, l_out uintptr, r_out uintptr, count Tuint32_t, saltbits Tuint32_t, ekey uintptr)

//go:noescape
func Y__do_orphaned_stdio_locks(tls *TLS)

//go:noescape
func Y__dup3(tls *TLS, old int32, new1 int32, flags int32) (r1 int32)

//go:noescape
func Y__duplocale(tls *TLS, old Tlocale_t) (r Tlocale_t)

//go:noescape
func Y__env_rm_add(tls *TLS, old uintptr, new1 uintptr)

//go:noescape
func Y__errno_location(tls *TLS) (r uintptr)

//go:noescape
func Y__execvpe(tls *TLS, file uintptr, argv uintptr, envp uintptr) (r int32)

//go:noescape
func Y__expo2(tls *TLS, x float64, sign float64) (r float64)

//go:noescape
func Y__expo2f(tls *TLS, x float32, sign float32) (r float32)

//go:noescape
func Y__fbufsize(tls *TLS, f uintptr) (r Tsize_t)

//go:noescape
func Y__fclose_ca(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__fdopen(tls *TLS, fd int32, mode uintptr) (r uintptr)

//go:noescape
func Y__fesetround(tls *TLS, r int32) (r1 int32)

//go:noescape
func Y__fgetwc_unlocked(tls *TLS, f uintptr) (r Twint_t)

//go:noescape
func Y__flbf(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__floatscan(tls *TLS, f uintptr, prec int32, pok int32) (r float64)

//go:noescape
func Y__fmodeflags(tls *TLS, mode uintptr) (r int32)

//go:noescape
func Y__fopen_rb_ca(tls *TLS, filename uintptr, f uintptr, buf uintptr, len1 Tsize_t) (r uintptr)

//go:noescape
func Y__fpclassify(tls *TLS, x float64) (r int32)

//go:noescape
func Y__fpclassifyf(tls *TLS, x float32) (r int32)

//go:noescape
func Y__fpclassifyl(tls *TLS, x float64) (r int32)

//go:noescape
func Y__fpending(tls *TLS, f uintptr) (r Tsize_t)

//go:noescape
func Y__fpurge(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__fputwc_unlocked(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)

//go:noescape
func Y__freadable(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__freadahead(tls *TLS, f uintptr) (r Tsize_t)

//go:noescape
func Y__freading(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__freadptr(tls *TLS, f uintptr, sizep uintptr) (r uintptr)

//go:noescape
func Y__freadptrinc(tls *TLS, f uintptr, inc Tsize_t)

//go:noescape
func Y__freelocale(tls *TLS, l Tlocale_t)

//go:noescape
func Y__fseeko(tls *TLS, f uintptr, off Toff_t, whence int32) (r int32)

//go:noescape
func Y__fseeko_unlocked(tls *TLS, f uintptr, off Toff_t, whence int32) (r int32)

//go:noescape
func Y__fseterr(tls *TLS, f uintptr)

//go:noescape
func Y__fsetlocking(tls *TLS, f uintptr, type1 int32) (r int32)

//go:noescape
func Y__fstat(tls *TLS, fd int32, st uintptr) (r int32)

//go:noescape
func Y__fstatat(tls *TLS, fd int32, path uintptr, st uintptr, flag int32) (r int32)

//go:noescape
func Y__ftello(tls *TLS, f uintptr) (r Toff_t)

//go:noescape
func Y__ftello_unlocked(tls *TLS, f uintptr) (r Toff_t)

//go:noescape
func Y__funcs_on_quick_exit(tls *TLS)

//go:noescape
func Y__futimesat(tls *TLS, dirfd int32, pathname uintptr, times uintptr) (r int32)

//go:noescape
func Y__fwritable(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__fwritex(tls *TLS, s uintptr, l Tsize_t, f uintptr) (r Tsize_t)

//go:noescape
func Y__fwriting(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__fxstat(tls *TLS, ver int32, fd int32, buf uintptr) (r int32)

//go:noescape
func Y__fxstatat(tls *TLS, ver int32, fd int32, path uintptr, buf uintptr, flag int32) (r int32)

//go:noescape
func Y__get_handler_set(tls *TLS, set uintptr)

//go:noescape
func Y__get_locale(tls *TLS, cat int32, val uintptr) (r uintptr)

//go:noescape
func Y__get_resolv_conf(tls *TLS, conf uintptr, search uintptr, search_sz Tsize_t) (r int32)

//go:noescape
func Y__getauxval(tls *TLS, item uint64) (r uint64)

//go:noescape
func Y__getdelim(tls *TLS, s uintptr, n uintptr, delim int32, f uintptr) (r Tssize_t)

//go:noescape
func Y__getgr_a(tls *TLS, name uintptr, gid Tgid_t, gr uintptr, buf uintptr, size uintptr, mem uintptr, nmem uintptr, res uintptr) (r int32)

//go:noescape
func Y__getgrent_a(tls *TLS, f uintptr, gr uintptr, line uintptr, size uintptr, mem uintptr, nmem uintptr, res uintptr) (r int32)

//go:noescape
func Y__getopt_msg(tls *TLS, a uintptr, b uintptr, c uintptr, l Tsize_t)

//go:noescape
func Y__getpw_a(tls *TLS, name uintptr, uid Tuid_t, pw uintptr, buf uintptr, size uintptr, res uintptr) (r int32)

//go:noescape
func Y__getpwent_a(tls *TLS, f uintptr, pw uintptr, line uintptr, size uintptr, res uintptr) (r int32)

//go:noescape
func Y__gettextdomain(tls *TLS) (r uintptr)

//go:noescape
func Y__gmtime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr)

//go:noescape
func Y__h_errno_location(tls *TLS) (r uintptr)

//go:noescape
func Y__inet_aton(tls *TLS, s0 uintptr, dest uintptr) (r int32)

//go:noescape
func Y__init_ssp(tls *TLS, entropy uintptr)

//go:noescape
func Y__intscan(tls *TLS, f uintptr, base uint32, pok int32, lim uint64) (r uint64)

//go:noescape
func Y__isalnum_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__isalpha_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__isblank_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__iscntrl_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__isdigit_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__isfinite(tls *TLS, d float64) (_2 int32)

//go:noescape
func Y__isfinitef(tls *TLS, f float32) (_2 int32)

//go:noescape
func Y__isfinitel(tls *TLS, d float64) (_2 int32)

//go:noescape
func Y__isgraph_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__islower_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__isnan(t *TLS, x float64) (_2 int32)

//go:noescape
func Y__isnanf(t *TLS, arg float32) (_2 int32)

//go:noescape
func Y__isnanl(t *TLS, arg float64) (_2 int32)

//go:noescape
func Y__isoc99_fscanf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Y__isoc99_fwscanf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Y__isoc99_scanf(tls *TLS, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Y__isoc99_sscanf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Y__isoc99_swscanf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Y__isoc99_vfscanf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Y__isoc99_vfwscanf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Y__isoc99_vscanf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Y__isoc99_vsscanf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Y__isoc99_vswscanf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Y__isoc99_vwscanf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Y__isoc99_wscanf(tls *TLS, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Y__isprint_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__ispunct_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__isspace_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__isupper_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__iswalnum_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswalpha_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswblank_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswcntrl_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswctype_l(tls *TLS, c Twint_t, t Twctype_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswdigit_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswgraph_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswlower_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswprint_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswpunct_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswspace_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswupper_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__iswxdigit_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Y__isxdigit_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__lctrans(tls *TLS, msg uintptr, lm uintptr) (r uintptr)

//go:noescape
func Y__lctrans_cur(tls *TLS, msg uintptr) (r uintptr)

//go:noescape
func Y__lctrans_impl(tls *TLS, msg uintptr, lm uintptr) (r uintptr)

//go:noescape
func Y__ldexp_cexp(tls *TLS, z complex128, expt int32) (r complex128)

//go:noescape
func Y__ldexp_cexpf(tls *TLS, z complex64, expt int32) (r complex64)

//go:noescape
func Y__lgamma_r(tls *TLS, x float64, signgamp uintptr) (r1 float64)

//go:noescape
func Y__lgammaf_r(tls *TLS, x float32, signgamp uintptr) (r1 float32)

//go:noescape
func Y__lgammal_r(tls *TLS, x float64, sg uintptr) (r float64)

//go:noescape
func Y__libc_current_sigrtmax(tls *TLS) (r int32)

//go:noescape
func Y__libc_current_sigrtmin(tls *TLS) (r int32)

//go:noescape
func Y__libc_sigaction(tls *TLS, sig int32, sa uintptr, old uintptr) (r1 int32)

//go:noescape
func Y__loc_is_allocated(tls *TLS, loc Tlocale_t) (r int32)

//go:noescape
func Y__localtime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr)

//go:noescape
func Y__lockfile(tls *TLS, file uintptr) (_2 int32)

//go:noescape
func Y__lookup_ipliteral(tls *TLS, buf uintptr, name uintptr, family int32) (r int32)

//go:noescape
func Y__lookup_name(tls *TLS, buf uintptr, canon uintptr, name uintptr, family int32, flags int32) (r int32)

//go:noescape
func Y__lookup_serv(tls *TLS, buf uintptr, name uintptr, proto int32, socktype int32, flags int32) (r int32)

//go:noescape
func Y__lseek(tls *TLS, fd int32, offset Toff_t, whence int32) (r Toff_t)

//go:noescape
func Y__lsysinfo(tls *TLS, info uintptr) (r int32)

//go:noescape
func Y__lxstat(tls *TLS, ver int32, path uintptr, buf uintptr) (r int32)

//go:noescape
func Y__madvise(tls *TLS, addr uintptr, len1 Tsize_t, advice int32) (r int32)

//go:noescape
func Y__map_file(tls *TLS, pathname uintptr, size uintptr) (r uintptr)

//go:noescape
func Y__math_divzero(tls *TLS, sign Tuint32_t) (r float64)

//go:noescape
func Y__math_divzerof(tls *TLS, sign Tuint32_t) (r float32)

//go:noescape
func Y__math_invalid(tls *TLS, x float64) (r float64)

//go:noescape
func Y__math_invalidf(tls *TLS, x float32) (r float32)

//go:noescape
func Y__math_oflow(tls *TLS, sign Tuint32_t) (r float64)

//go:noescape
func Y__math_oflowf(tls *TLS, sign Tuint32_t) (r float32)

//go:noescape
func Y__math_uflow(tls *TLS, sign Tuint32_t) (r float64)

//go:noescape
func Y__math_uflowf(tls *TLS, sign Tuint32_t) (r float32)

//go:noescape
func Y__math_xflow(tls *TLS, sign Tuint32_t, y2 float64) (r float64)

//go:noescape
func Y__math_xflowf(tls *TLS, sign Tuint32_t, y2 float32) (r float32)

//go:noescape
func Y__memrchr(tls *TLS, m uintptr, c int32, n Tsize_t) (r uintptr)

//go:noescape
func Y__mkostemps(tls *TLS, template uintptr, len1 int32, flags int32) (r int32)

//go:noescape
func Y__mmap(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr)

//go:noescape
func Y__mo_lookup(tls *TLS, p uintptr, size Tsize_t, s uintptr) (r uintptr)

//go:noescape
func Y__month_to_secs(tls *TLS, month int32, is_leap int32) (r int32)

//go:noescape
func Y__mprotect(tls *TLS, addr uintptr, len1 Tsize_t, prot int32) (r int32)

//go:noescape
func Y__mremap(tls *TLS, old_addr uintptr, old_len Tsize_t, new_len Tsize_t, flags int32, va uintptr) (r uintptr)

//go:noescape
func Y__munmap(tls *TLS, start uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Y__newlocale(tls *TLS, mask int32, name uintptr, loc Tlocale_t) (r Tlocale_t)

//go:noescape
func Y__nl_langinfo(tls *TLS, item Tnl_item) (r uintptr)

//go:noescape
func Y__nl_langinfo_l(tls *TLS, item Tnl_item, loc Tlocale_t) (r uintptr)

//go:noescape
func Y__nscd_query(tls *TLS, req Tint32_t, key uintptr, buf uintptr, len1 Tsize_t, swap uintptr) (r uintptr)

//go:noescape
func Y__ofl_add(tls *TLS, f uintptr) (r uintptr)

//go:noescape
func Y__ofl_lock(tls *TLS) (r uintptr)

//go:noescape
func Y__ofl_unlock(tls *TLS)

//go:noescape
func Y__overflow(tls *TLS, f uintptr, _c int32) (r int32)

//go:noescape
func Y__pleval(tls *TLS, s uintptr, n uint64) (r uint64)

//go:noescape
func Y__posix_getopt(tls *TLS, argc int32, argv uintptr, optstring uintptr) (r int32)

//go:noescape
func Y__procfdname(tls *TLS, buf uintptr, fd uint32)

//go:noescape
func Y__ptsname_r(tls *TLS, fd int32, buf uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Y__putenv(tls *TLS, s uintptr, l Tsize_t, r uintptr) (r1 int32)

//go:noescape
func Y__qsort_r(tls *TLS, base uintptr, nel Tsize_t, width Tsize_t, __ccgo_fp_cmp Tcmpfun, arg uintptr)

//go:noescape
func __ccgo_abi0___qsort_r_3(_0 *TLS, _1 uintptr, _2 uintptr, _3 uintptr, __ccgo_fp uintptr) (_4 int32)

func __ccgo_abiInternal___qsort_r_3(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr, _3 uintptr) (_4 int32) {
		return __ccgo_abi0___qsort_r_3(_0, _1, _2, _3, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Y__rand48_step(tls *TLS, xi uintptr, lc uintptr) (r Tuint64_t)

//go:noescape
func Y__register_locked_file(tls *TLS, f uintptr, self Tpthread_t)

//go:noescape
func Y__rem_pio2(tls *TLS, x float64, y uintptr) (r1 int32)

//go:noescape
func Y__rem_pio2_large(tls *TLS, x uintptr, y uintptr, e0 int32, nx int32, prec int32) (r int32)

//go:noescape
func Y__rem_pio2f(tls *TLS, x float32, y uintptr) (r int32)

//go:noescape
func Y__res_mkquery(tls *TLS, op int32, dname uintptr, class int32, type1 int32, data uintptr, datalen int32, newrr uintptr, buf uintptr, buflen int32) (r int32)

//go:noescape
func Y__res_msend(tls *TLS, nqueries int32, queries uintptr, qlens uintptr, answers uintptr, alens uintptr, asize int32) (r int32)

//go:noescape
func Y__res_msend_rc(tls *TLS, nqueries int32, queries uintptr, qlens uintptr, answers uintptr, alens uintptr, asize int32, conf uintptr) (r1 int32)

//go:noescape
func Y__res_send(tls *TLS, _msg uintptr, _msglen int32, _answer uintptr, _anslen int32) (r1 int32)

//go:noescape
func Y__res_state(tls *TLS) (r uintptr)

//go:noescape
func Y__reset_tls(tls *TLS)

//go:noescape
func Y__restore(tls *TLS)

//go:noescape
func Y__restore_rt(tls *TLS)

//go:noescape
func Y__restore_sigs(tls *TLS, set uintptr)

//go:noescape
func Y__rtnetlink_enumerate(tls *TLS, link_af int32, addr_af int32, __ccgo_fp_cb uintptr, ctx uintptr) (r1 int32)

//go:noescape
func __ccgo_abi0___rtnetlink_enumerate_2(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal___rtnetlink_enumerate_2(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0___rtnetlink_enumerate_2(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Y__secs_to_tm(tls *TLS, t int64, tm uintptr) (r int32)

//go:noescape
func Y__secs_to_zone(tls *TLS, t int64, local int32, isdst uintptr, offset uintptr, oppoff uintptr, zonename uintptr)

//go:noescape
func Y__setxid(tls *TLS, nr int32, id int32, eid int32, sid int32) (r int32)

//go:noescape
func Y__shgetc(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__shlim(tls *TLS, f uintptr, lim Toff_t)

//go:noescape
func Y__shm_mapname(tls *TLS, name uintptr, buf uintptr) (r uintptr)

//go:noescape
func Y__sigaction(tls *TLS, sig int32, sa uintptr, old uintptr) (r1 int32)

//go:noescape
func Y__signbit(tls *TLS, x float64) (r int32)

//go:noescape
func Y__signbitf(tls *TLS, x float32) (r int32)

//go:noescape
func Y__signbitl(tls *TLS, x float64) (r int32)

//go:noescape
func Y__sigsetjmp_tail(tls *TLS, jb uintptr, ret int32) (r int32)

//go:noescape
func Y__sin(tls *TLS, x float64, y float64, iy int32) (r1 float64)

//go:noescape
func Y__sindf(tls *TLS, x float64) (r1 float32)

//go:noescape
func Y__stack_chk_fail(tls *TLS)

//go:noescape
func Y__stack_chk_fail_local(tls *TLS)

//go:noescape
func Y__stdio_close(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__stdio_exit(tls *TLS)

//go:noescape
func Y__stdio_exit_needed(tls *TLS)

//go:noescape
func Y__stdio_read(tls *TLS, f uintptr, buf uintptr, len1 Tsize_t) (r Tsize_t)

//go:noescape
func Y__stdio_seek(tls *TLS, f uintptr, off Toff_t, whence int32) (r Toff_t)

//go:noescape
func Y__stdio_write(tls *TLS, f uintptr, buf uintptr, len1 Tsize_t) (r Tsize_t)

//go:noescape
func Y__stdout_write(tls *TLS, f uintptr, buf uintptr, len1 Tsize_t) (r Tsize_t)

//go:noescape
func Y__stpcpy(tls *TLS, d uintptr, s uintptr) (r uintptr)

//go:noescape
func Y__stpncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Y__strcasecmp_l(tls *TLS, l uintptr, r uintptr, loc Tlocale_t) (r1 int32)

//go:noescape
func Y__strchrnul(tls *TLS, s uintptr, c int32) (r uintptr)

//go:noescape
func Y__strcoll_l(tls *TLS, l uintptr, r uintptr, loc Tlocale_t) (r1 int32)

//go:noescape
func Y__strerror_l(tls *TLS, e int32, loc Tlocale_t) (r uintptr)

//go:noescape
func Y__strftime_fmt_1(tls *TLS, s uintptr, l uintptr, f int32, tm uintptr, loc Tlocale_t, pad int32) (r uintptr)

//go:noescape
func Y__strftime_l(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr, loc Tlocale_t) (r Tsize_t)

//go:noescape
func Y__strncasecmp_l(tls *TLS, l uintptr, r uintptr, n Tsize_t, loc Tlocale_t) (r1 int32)

//go:noescape
func Y__strtod_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float64)

//go:noescape
func Y__strtof_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float32)

//go:noescape
func Y__strtoimax_internal(tls *TLS, s uintptr, p uintptr, base int32) (r Tintmax_t)

//go:noescape
func Y__strtol_internal(tls *TLS, s uintptr, p uintptr, base int32) (r int64)

//go:noescape
func Y__strtold_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float64)

//go:noescape
func Y__strtoll_internal(tls *TLS, s uintptr, p uintptr, base int32) (r int64)

//go:noescape
func Y__strtoul_internal(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)

//go:noescape
func Y__strtoull_internal(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)

//go:noescape
func Y__strtoumax_internal(tls *TLS, s uintptr, p uintptr, base int32) (r Tuintmax_t)

//go:noescape
func Y__strxfrm_l(tls *TLS, dest uintptr, src uintptr, n Tsize_t, loc Tlocale_t) (r Tsize_t)

//go:noescape
func Y__sync_synchronize(t *TLS)

//go:noescape
func Y__sync_val_compare_and_swapInt16(t *TLS, ptr uintptr, oldval, newval int16) (r int16)

//go:noescape
func Y__sync_val_compare_and_swapInt32(t *TLS, ptr uintptr, oldval, newval int32) (r int32)

//go:noescape
func Y__sync_val_compare_and_swapInt64(t *TLS, ptr uintptr, oldval, newval int64) (r int64)

//go:noescape
func Y__sync_val_compare_and_swapInt8(t *TLS, ptr uintptr, oldval, newval int8) (r int8)

//go:noescape
func Y__sync_val_compare_and_swapUint16(t *TLS, ptr uintptr, oldval, newval uint16) (r uint16)

//go:noescape
func Y__sync_val_compare_and_swapUint32(t *TLS, ptr uintptr, oldval, newval uint32) (r uint32)

//go:noescape
func Y__sync_val_compare_and_swapUint64(t *TLS, ptr uintptr, oldval, newval uint64) (r uint64)

//go:noescape
func Y__sync_val_compare_and_swapUint8(t *TLS, ptr uintptr, oldval, newval uint8) (r uint8)

//go:noescape
func Y__syscall0(tls *TLS, n long) (_2 long)

//go:noescape
func Y__syscall1(tls *TLS, n, a1 long) (_2 long)

//go:noescape
func Y__syscall2(tls *TLS, n, a1, a2 long) (_2 long)

//go:noescape
func Y__syscall3(tls *TLS, n, a1, a2, a3 long) (_2 long)

//go:noescape
func Y__syscall4(tls *TLS, n, a1, a2, a3, a4 long) (_2 long)

//go:noescape
func Y__syscall5(tls *TLS, n, a1, a2, a3, a4, a5 long) (_2 long)

//go:noescape
func Y__syscall6(tls *TLS, n, a1, a2, a3, a4, a5, a6 long) (_2 long)

//go:noescape
func Y__syscall_ret(tls *TLS, r uint64) (r1 int64)

//go:noescape
func Y__tan(tls *TLS, x float64, y float64, odd int32) (r1 float64)

//go:noescape
func Y__tandf(tls *TLS, x float64, odd int32) (r1 float32)

//go:noescape
func Y__tm_to_secs(tls *TLS, tm uintptr) (r int64)

//go:noescape
func Y__tm_to_tzname(tls *TLS, tm uintptr) (r uintptr)

//go:noescape
func Y__tolower_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__toread(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__toread_needs_stdio_exit(tls *TLS)

//go:noescape
func Y__toupper_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Y__towctrans_l(tls *TLS, c Twint_t, t Twctrans_t, l Tlocale_t) (r Twint_t)

//go:noescape
func Y__towlower_l(tls *TLS, c Twint_t, l Tlocale_t) (r Twint_t)

//go:noescape
func Y__towrite(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__towrite_needs_stdio_exit(tls *TLS)

//go:noescape
func Y__towupper_l(tls *TLS, c Twint_t, l Tlocale_t) (r Twint_t)

//go:noescape
func Y__tre_mem_alloc_impl(tls *TLS, mem Ttre_mem_t, provided int32, provided_block uintptr, zero int32, size Tsize_t) (r uintptr)

//go:noescape
func Y__tre_mem_destroy(tls *TLS, mem Ttre_mem_t)

//go:noescape
func Y__tre_mem_new_impl(tls *TLS, provided int32, provided_block uintptr) (r Ttre_mem_t)

//go:noescape
func Y__tsearch_balance(tls *TLS, p uintptr) (r int32)

//go:noescape
func Y__uflow(tls *TLS, f uintptr) (r int32)

//go:noescape
func Y__unlist_locked_file(tls *TLS, f uintptr)

//go:noescape
func Y__unlockfile(tls *TLS, file uintptr)

//go:noescape
func Y__uselocale(tls *TLS, new1 Tlocale_t) (r Tlocale_t)

//go:noescape
func Y__vm_wait(tls *TLS)

//go:noescape
func Y__wcscoll_l(tls *TLS, l uintptr, r uintptr, locale Tlocale_t) (r1 int32)

//go:noescape
func Y__wcsftime_l(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr, loc Tlocale_t) (r Tsize_t)

//go:noescape
func Y__wcsxfrm_l(tls *TLS, dest uintptr, src uintptr, n Tsize_t, loc Tlocale_t) (r Tsize_t)

//go:noescape
func Y__wctrans_l(tls *TLS, s uintptr, l Tlocale_t) (r Twctrans_t)

//go:noescape
func Y__wctype_l(tls *TLS, s uintptr, l Tlocale_t) (r Twctype_t)

//go:noescape
func Y__xmknod(tls *TLS, ver int32, path uintptr, mode Tmode_t, dev uintptr) (r int32)

//go:noescape
func Y__xmknodat(tls *TLS, ver int32, fd int32, path uintptr, mode Tmode_t, dev uintptr) (r int32)

//go:noescape
func Y__xpg_basename(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Y__xpg_strerror_r(tls *TLS, err int32, buf uintptr, buflen Tsize_t) (r int32)

//go:noescape
func Y__xstat(tls *TLS, ver int32, path uintptr, buf uintptr) (r int32)

//go:noescape
func Y__year_to_secs(tls *TLS, year int64, is_leap uintptr) (r int64)

//go:noescape
func Y_exit(tls *TLS, status int32)

//go:noescape
func Y_flushlbf(tls *TLS)

//go:noescape
func Y_longjmp(t *TLS, env uintptr, val int32)

//go:noescape
func Y_obstack_begin(t *TLS, obstack uintptr, size, alignment int32, chunkfun, freefun uintptr) (_4 int32)

//go:noescape
func Y_obstack_newchunk(t *TLS, obstack uintptr, length int32) (_3 int32)

//go:noescape
func Y_pthread_cleanup_pop(tls *TLS, _ uintptr, run int32)

//go:noescape
func Y_pthread_cleanup_push(tls *TLS, _, f, x uintptr)

//go:noescape
func Y_setjmp(t *TLS, env uintptr) (_2 int32)

//go:noescape
func Ya64l(tls *TLS, s uintptr) (r int64)

//go:noescape
func Yabort(tls *TLS)

//go:noescape
func Yabs(tls *TLS, a int32) (r int32)

//go:noescape
func Yaccept(tls *TLS, fd int32, addr uintptr, len1 uintptr) (r1 int32)

//go:noescape
func Yaccept4(tls *TLS, fd int32, addr uintptr, len1 uintptr, flg int32) (r1 int32)

//go:noescape
func Yaccess(tls *TLS, filename uintptr, amode int32) (r int32)

//go:noescape
func Yacct(tls *TLS, filename uintptr) (r int32)

//go:noescape
func Yacos(tls *TLS, x float64) (r float64)

//go:noescape
func Yacosf(tls *TLS, x float32) (r float32)

//go:noescape
func Yacosh(tls *TLS, x float64) (r float64)

//go:noescape
func Yacoshf(tls *TLS, x float32) (r float32)

//go:noescape
func Yacoshl(tls *TLS, x float64) (r float64)

//go:noescape
func Yacosl(tls *TLS, x float64) (r float64)

//go:noescape
func Yaddmntent(tls *TLS, f uintptr, mnt uintptr) (r int32)

//go:noescape
func Yadjtime(tls *TLS, in uintptr, out uintptr) (r int32)

//go:noescape
func Yadjtimex(tls *TLS, tx uintptr) (r int32)

//go:noescape
func Yalarm(tls *TLS, seconds uint32) (r uint32)

//go:noescape
func Yalloca(tls *TLS, size Tsize_t) (_2 uintptr)

//go:noescape
func Yalphasort(tls *TLS, a uintptr, b uintptr) (r int32)

//go:noescape
func Yarch_prctl(tls *TLS, code int32, addr uint64) (r int32)

//go:noescape
func Yasctime(tls *TLS, tm uintptr) (r uintptr)

//go:noescape
func Yasctime_r(tls *TLS, tm uintptr, buf uintptr) (r uintptr)

//go:noescape
func Yasin(tls *TLS, x float64) (r1 float64)

//go:noescape
func Yasinf(tls *TLS, x float32) (r float32)

//go:noescape
func Yasinh(tls *TLS, x3 float64) (r float64)

//go:noescape
func Yasinhf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Yasinhl(tls *TLS, x float64) (r float64)

//go:noescape
func Yasinl(tls *TLS, x float64) (r float64)

//go:noescape
func Yasprintf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Yat_quick_exit(tls *TLS, __ccgo_fp_func uintptr) (r1 int32)

//go:noescape
func __ccgo_abi0_at_quick_exit_0(_0 *TLS, __ccgo_fp uintptr)

func __ccgo_abiInternal_at_quick_exit_0(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS) {
		__ccgo_abi0_at_quick_exit_0(_0, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Yatan(tls *TLS, x3 float64) (r float64)

//go:noescape
func Yatan2(tls *TLS, y float64, x float64) (r float64)

//go:noescape
func Yatan2f(tls *TLS, y float32, x float32) (r float32)

//go:noescape
func Yatan2l(tls *TLS, y float64, x float64) (r float64)

//go:noescape
func Yatanf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Yatanh(tls *TLS, x3 float64) (r float64)

//go:noescape
func Yatanhf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Yatanhl(tls *TLS, x float64) (r float64)

//go:noescape
func Yatanl(tls *TLS, x float64) (r float64)

//go:noescape
func Yatexit(tls *TLS, func_ uintptr) (r int32)

//go:noescape
func Yatof(tls *TLS, s uintptr) (r float64)

//go:noescape
func Yatoi(tls *TLS, s uintptr) (r int32)

//go:noescape
func Yatol(tls *TLS, s uintptr) (r int64)

//go:noescape
func Yatoll(tls *TLS, s uintptr) (r int64)

//go:noescape
func Ybacktrace(t *TLS, buf uintptr, size int32) (_3 int32)

//go:noescape
func Ybacktrace_symbols_fd(t *TLS, buffer uintptr, size, fd int32)

//go:noescape
func Ybasename(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Ybcmp(tls *TLS, s1 uintptr, s2 uintptr, n Tsize_t) (r int32)

//go:noescape
func Ybcopy(tls *TLS, s1 uintptr, s2 uintptr, n Tsize_t)

//go:noescape
func Ybind(tls *TLS, fd int32, addr uintptr, len1 Tsocklen_t) (r1 int32)

//go:noescape
func Ybind_textdomain_codeset(tls *TLS, domainname uintptr, codeset uintptr) (r uintptr)

//go:noescape
func Ybindtextdomain(tls *TLS, domainname uintptr, dirname uintptr) (r uintptr)

//go:noescape
func Ybrk(tls *TLS, end uintptr) (r int32)

//go:noescape
func Ybsearch(tls *TLS, key uintptr, base uintptr, nel Tsize_t, width Tsize_t, __ccgo_fp_cmp uintptr) (r uintptr)

//go:noescape
func __ccgo_abi0_bsearch_4(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_bsearch_4(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0_bsearch_4(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Ybtowc(tls *TLS, c int32) (r Twint_t)

//go:noescape
func Ybzero(tls *TLS, s uintptr, n Tsize_t)

//go:noescape
func Yc16rtomb(tls *TLS, s uintptr, c16 Tchar16_t, ps uintptr) (r Tsize_t)

//go:noescape
func Yc32rtomb(tls *TLS, s uintptr, c32 Tchar32_t, ps uintptr) (r Tsize_t)

//go:noescape
func Ycabs(tls *TLS, z complex128) (r float64)

//go:noescape
func Ycabsf(tls *TLS, z complex64) (r float32)

//go:noescape
func Ycabsl(tls *TLS, z complex128) (r float64)

//go:noescape
func Ycacos(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycacosf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycacosh(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycacoshf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycacoshl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycacosl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycalloc(tls *TLS, m Tsize_t, n Tsize_t) (r uintptr)

//go:noescape
func Ycapget(tls *TLS, a uintptr, b uintptr) (r int32)

//go:noescape
func Ycapset(tls *TLS, a uintptr, b uintptr) (r int32)

//go:noescape
func Ycarg(tls *TLS, z complex128) (r float64)

//go:noescape
func Ycargf(tls *TLS, z complex64) (r float32)

//go:noescape
func Ycargl(tls *TLS, z complex128) (r float64)

//go:noescape
func Ycasin(tls *TLS, z complex128) (r1 complex128)

//go:noescape
func Ycasinf(tls *TLS, z complex64) (r1 complex64)

//go:noescape
func Ycasinh(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycasinhf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycasinhl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycasinl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycatan(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycatanf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycatanh(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycatanhf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycatanhl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycatanl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycatclose(tls *TLS, catd Tnl_catd) (r int32)

//go:noescape
func Ycatgets(tls *TLS, catd Tnl_catd, set_id int32, msg_id int32, s uintptr) (r uintptr)

//go:noescape
func Ycatopen(tls *TLS, name uintptr, oflag int32) (r Tnl_catd)

//go:noescape
func Ycbrt(tls *TLS, x float64) (r1 float64)

//go:noescape
func Ycbrtf(tls *TLS, x float32) (r1 float32)

//go:noescape
func Ycbrtl(tls *TLS, x float64) (r float64)

//go:noescape
func Yccos(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yccosf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Yccosh(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yccoshf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Yccoshl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yccosl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yceil(tls *TLS, x3 float64) (r float64)

//go:noescape
func Yceilf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Yceill(tls *TLS, x float64) (r float64)

//go:noescape
func Ycexp(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycexpf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycexpl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycfgetispeed(tls *TLS, tio uintptr) (r Tspeed_t)

//go:noescape
func Ycfgetospeed(tls *TLS, tio uintptr) (r Tspeed_t)

//go:noescape
func Ycfmakeraw(tls *TLS, t uintptr)

//go:noescape
func Ycfsetispeed(tls *TLS, tio uintptr, speed Tspeed_t) (r int32)

//go:noescape
func Ycfsetospeed(tls *TLS, tio uintptr, speed Tspeed_t) (r int32)

//go:noescape
func Ycfsetspeed(tls *TLS, tio uintptr, speed Tspeed_t) (r int32)

//go:noescape
func Ychdir(tls *TLS, path uintptr) (r int32)

//go:noescape
func Ychmod(tls *TLS, path uintptr, mode Tmode_t) (r int32)

//go:noescape
func Ychown(tls *TLS, path uintptr, uid Tuid_t, gid Tgid_t) (r int32)

//go:noescape
func Ychroot(tls *TLS, path uintptr) (r int32)

//go:noescape
func Ycimag(tls *TLS, z complex128) (r float64)

//go:noescape
func Ycimagf(tls *TLS, z complex64) (r float32)

//go:noescape
func Ycimagl(tls *TLS, z complex128) (r float64)

//go:noescape
func Yclearenv(tls *TLS) (r int32)

//go:noescape
func Yclearerr(tls *TLS, f uintptr)

//go:noescape
func Yclearerr_unlocked(tls *TLS, f uintptr)

//go:noescape
func Yclock(tls *TLS) (r Tclock_t)

//go:noescape
func Yclock_adjtime(tls *TLS, clock_id Tclockid_t, utx uintptr) (r1 int32)

//go:noescape
func Yclock_getcpuclockid(tls *TLS, pid Tpid_t, clk uintptr) (r int32)

//go:noescape
func Yclock_getres(tls *TLS, clk Tclockid_t, ts uintptr) (r int32)

//go:noescape
func Yclock_gettime(tls *TLS, clk Tclockid_t, ts uintptr) (r int32)

//go:noescape
func Yclock_nanosleep(tls *TLS, clk Tclockid_t, flags int32, req uintptr, rem uintptr) (r int32)

//go:noescape
func Yclock_settime(tls *TLS, clk Tclockid_t, ts uintptr) (r int32)

//go:noescape
func Yclog(tls *TLS, z complex128) (r1 complex128)

//go:noescape
func Yclogf(tls *TLS, z complex64) (r1 complex64)

//go:noescape
func Yclogl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yclose(tls *TLS, fd int32) (r1 int32)

//go:noescape
func Yclosedir(tls *TLS, dir uintptr) (r int32)

//go:noescape
func Ycloselog(tls *TLS)

//go:noescape
func Yconfstr(tls *TLS, name int32, buf uintptr, len1 Tsize_t) (r Tsize_t)

//go:noescape
func Yconj(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yconjf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Yconjl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yconnect(tls *TLS, fd int32, addr uintptr, len1 Tsocklen_t) (r1 int32)

//go:noescape
func Ycopy_file_range(tls *TLS, fd_in int32, off_in uintptr, fd_out int32, off_out uintptr, len1 Tsize_t, flags uint32) (r Tssize_t)

//go:noescape
func Ycopysign(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Ycopysignf(tls *TLS, x float32, y float32) (r float32)

//go:noescape
func Ycopysignl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Ycos(tls *TLS, x3 float64) (r float64)

//go:noescape
func Ycosf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Ycosh(tls *TLS, x3 float64) (r float64)

//go:noescape
func Ycoshf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Ycoshl(tls *TLS, x float64) (r float64)

//go:noescape
func Ycosl(tls *TLS, x float64) (r float64)

//go:noescape
func Ycpow(tls *TLS, z complex128, c complex128) (r complex128)

//go:noescape
func Ycpowf(tls *TLS, z complex64, c complex64) (r complex64)

//go:noescape
func Ycpowl(tls *TLS, z complex128, c complex128) (r complex128)

//go:noescape
func Ycproj(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycprojf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycprojl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycreal(tls *TLS, z complex128) (r float64)

//go:noescape
func Ycrealf(tls *TLS, z complex64) (r float32)

//go:noescape
func Ycreall(tls *TLS, z complex128) (r float64)

//go:noescape
func Ycreat(tls *TLS, filename uintptr, mode Tmode_t) (r int32)

//go:noescape
func Ycrypt(tls *TLS, key uintptr, salt uintptr) (r uintptr)

//go:noescape
func Ycrypt_r(tls *TLS, key uintptr, salt uintptr, data uintptr) (r uintptr)

//go:noescape
func Ycsin(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycsinf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycsinh(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycsinhf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycsinhl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycsinl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycsqrt(tls *TLS, z complex128) (r complex128)

//go:noescape
func Ycsqrtf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Ycsqrtl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yctan(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yctanf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Yctanh(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yctanhf(tls *TLS, z complex64) (r complex64)

//go:noescape
func Yctanhl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yctanl(tls *TLS, z complex128) (r complex128)

//go:noescape
func Yctermid(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Yctime(tls *TLS, t uintptr) (r uintptr)

//go:noescape
func Yctime_r(tls *TLS, t uintptr, buf uintptr) (r uintptr)

//go:noescape
func Ycuserid(tls *TLS, buf uintptr) (r uintptr)

//go:noescape
func Ydcgettext(tls *TLS, domainname uintptr, msgid uintptr, category int32) (r uintptr)

//go:noescape
func Ydcngettext(tls *TLS, domainname uintptr, msgid1 uintptr, msgid2 uintptr, n uint64, category int32) (r1 uintptr)

//go:noescape
func Ydelete_module(tls *TLS, a uintptr, b uint32) (r int32)

//go:noescape
func Ydgettext(tls *TLS, domainname uintptr, msgid uintptr) (r uintptr)

//go:noescape
func Ydifftime(tls *TLS, t1 Ttime_t, t0 Ttime_t) (r float64)

//go:noescape
func Ydirfd(tls *TLS, d uintptr) (r int32)

//go:noescape
func Ydirname(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Ydiv(tls *TLS, num int32, den int32) (r Tdiv_t)

//go:noescape
func Ydlclose(t *TLS, handle uintptr) (_2 int32)

//go:noescape
func Ydlerror(t *TLS) (_1 uintptr)

//go:noescape
func Ydlopen(t *TLS, filename uintptr, flags int32) (_3 uintptr)

//go:noescape
func Ydlsym(t *TLS, handle, symbol uintptr) (_2 uintptr)

//go:noescape
func Ydn_comp(tls *TLS, src uintptr, dst uintptr, space int32, dnptrs uintptr, lastdnptr uintptr) (r int32)

//go:noescape
func Ydn_expand(tls *TLS, base uintptr, end uintptr, src uintptr, dest uintptr, space int32) (r int32)

//go:noescape
func Ydn_skipname(tls *TLS, s uintptr, end uintptr) (r int32)

//go:noescape
func Ydngettext(tls *TLS, domainname uintptr, msgid1 uintptr, msgid2 uintptr, n uint64) (r uintptr)

//go:noescape
func Ydprintf(tls *TLS, fd int32, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Ydrand48(tls *TLS) (r float64)

//go:noescape
func Ydrem(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Ydremf(tls *TLS, x float32, y float32) (r float32)

//go:noescape
func Ydup(tls *TLS, fd int32) (r int32)

//go:noescape
func Ydup2(tls *TLS, old int32, new1 int32) (r1 int32)

//go:noescape
func Ydup3(tls *TLS, old int32, new1 int32, flags int32) (r int32)

//go:noescape
func Yduplocale(tls *TLS, old Tlocale_t) (r Tlocale_t)

//go:noescape
func Yeaccess(tls *TLS, filename uintptr, amode int32) (r int32)

//go:noescape
func Yecvt(tls *TLS, x float64, n int32, dp uintptr, sign uintptr) (r uintptr)

//go:noescape
func Yencrypt(tls *TLS, block uintptr, edflag int32)

//go:noescape
func Yendgrent(tls *TLS)

//go:noescape
func Yendhostent(tls *TLS)

//go:noescape
func Yendmntent(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yendnetent(tls *TLS)

//go:noescape
func Yendprotoent(tls *TLS)

//go:noescape
func Yendpwent(tls *TLS)

//go:noescape
func Yendservent(tls *TLS)

//go:noescape
func Yendspent(tls *TLS)

//go:noescape
func Yendusershell(tls *TLS)

//go:noescape
func Yendutent(tls *TLS)

//go:noescape
func Yendutxent(tls *TLS)

//go:noescape
func Yepoll_create(tls *TLS, size int32) (r int32)

//go:noescape
func Yepoll_create1(tls *TLS, flags int32) (r1 int32)

//go:noescape
func Yepoll_ctl(tls *TLS, fd int32, op int32, fd2 int32, ev uintptr) (r int32)

//go:noescape
func Yepoll_pwait(tls *TLS, fd int32, ev uintptr, cnt int32, to int32, sigs uintptr) (r1 int32)

//go:noescape
func Yepoll_wait(tls *TLS, fd int32, ev uintptr, cnt int32, to int32) (r int32)

//go:noescape
func Yerand48(tls *TLS, s uintptr) (r float64)

//go:noescape
func Yerf(tls *TLS, x float64) (r1 float64)

//go:noescape
func Yerfc(tls *TLS, x float64) (r1 float64)

//go:noescape
func Yerfcf(tls *TLS, x float32) (r1 float32)

//go:noescape
func Yerfcl(tls *TLS, x float64) (r float64)

//go:noescape
func Yerff(tls *TLS, x float32) (r1 float32)

//go:noescape
func Yerfl(tls *TLS, x float64) (r float64)

//go:noescape
func Yerr(tls *TLS, status int32, fmt uintptr, va uintptr)

//go:noescape
func Yerrx(tls *TLS, status int32, fmt uintptr, va uintptr)

//go:noescape
func Yether_aton(tls *TLS, x uintptr) (r uintptr)

//go:noescape
func Yether_aton_r(tls *TLS, x uintptr, p_a uintptr) (r uintptr)

//go:noescape
func Yether_hostton(tls *TLS, hostname uintptr, e uintptr) (r int32)

//go:noescape
func Yether_line(tls *TLS, l uintptr, e uintptr, hostname uintptr) (r int32)

//go:noescape
func Yether_ntoa(tls *TLS, p_a uintptr) (r uintptr)

//go:noescape
func Yether_ntoa_r(tls *TLS, p_a uintptr, x uintptr) (r uintptr)

//go:noescape
func Yether_ntohost(tls *TLS, hostname uintptr, e uintptr) (r int32)

//go:noescape
func Yeuidaccess(tls *TLS, filename uintptr, amode int32) (r int32)

//go:noescape
func Yeventfd(tls *TLS, count uint32, flags int32) (r1 int32)

//go:noescape
func Yeventfd_read(tls *TLS, fd int32, value uintptr) (r int32)

//go:noescape
func Yeventfd_write(tls *TLS, fd int32, _value Teventfd_t) (r int32)

//go:noescape
func Yexecl(tls *TLS, path uintptr, argv0 uintptr, va uintptr) (r int32)

//go:noescape
func Yexecle(tls *TLS, path uintptr, argv0 uintptr, va uintptr) (r int32)

//go:noescape
func Yexeclp(tls *TLS, file uintptr, argv0 uintptr, va uintptr) (r int32)

//go:noescape
func Yexecv(tls *TLS, path uintptr, argv uintptr) (r int32)

//go:noescape
func Yexecve(tls *TLS, path uintptr, argv uintptr, envp uintptr) (r int32)

//go:noescape
func Yexecvp(tls *TLS, file uintptr, argv uintptr) (r int32)

//go:noescape
func Yexecvpe(tls *TLS, file uintptr, argv uintptr, envp uintptr) (r int32)

//go:noescape
func Yexit(tls *TLS, code int32)

//go:noescape
func Yexp(tls *TLS, x1 float64) (r1 float64)

//go:noescape
func Yexp10(tls *TLS, x float64) (r float64)

//go:noescape
func Yexp10f(tls *TLS, x float32) (r float32)

//go:noescape
func Yexp10l(tls *TLS, x float64) (r float64)

//go:noescape
func Yexp2(tls *TLS, x1 float64) (r1 float64)

//go:noescape
func Yexp2f(tls *TLS, x2 float32) (r1 float32)

//go:noescape
func Yexp2l(tls *TLS, x float64) (r float64)

//go:noescape
func Yexpf(tls *TLS, x2 float32) (r1 float32)

//go:noescape
func Yexpl(tls *TLS, x float64) (r float64)

//go:noescape
func Yexplicit_bzero(tls *TLS, d uintptr, n Tsize_t)

//go:noescape
func Yexpm1(tls *TLS, x3 float64) (r float64)

//go:noescape
func Yexpm1f(tls *TLS, x3 float32) (r float32)

//go:noescape
func Yexpm1l(tls *TLS, x float64) (r float64)

//go:noescape
func Yfabs(tls *TLS, x float64) (r float64)

//go:noescape
func Yfabsf(tls *TLS, x float32) (r float32)

//go:noescape
func Yfabsl(tls *TLS, x float64) (r float64)

//go:noescape
func Yfaccessat(tls *TLS, fd int32, filename uintptr, amode int32, flag int32) (r int32)

//go:noescape
func Yfallocate(tls *TLS, fd int32, mode int32, base Toff_t, len1 Toff_t) (r int32)

//go:noescape
func Yfanotify_init(tls *TLS, flags uint32, event_f_flags uint32) (r int32)

//go:noescape
func Yfanotify_mark(tls *TLS, fanotify_fd int32, flags uint32, mask uint64, dfd int32, pathname uintptr) (r int32)

//go:noescape
func Yfchdir(tls *TLS, fd int32) (r int32)

//go:noescape
func Yfchmod(tls *TLS, fd int32, mode Tmode_t) (r int32)

//go:noescape
func Yfchmodat(tls *TLS, fd int32, path uintptr, mode Tmode_t, flag int32) (r int32)

//go:noescape
func Yfchown(tls *TLS, fd int32, uid Tuid_t, gid Tgid_t) (r int32)

//go:noescape
func Yfchownat(tls *TLS, fd int32, path uintptr, uid Tuid_t, gid Tgid_t, flag int32) (r int32)

//go:noescape
func Yfclose(tls *TLS, f uintptr) (r1 int32)

//go:noescape
func Yfcntl(tls *TLS, fd int32, cmd int32, va uintptr) (r int32)

//go:noescape
func Yfcntl64(tls *TLS, fd int32, cmd int32, va uintptr) (r int32)

//go:noescape
func Yfcvt(tls *TLS, x float64, n int32, dp uintptr, sign uintptr) (r uintptr)

//go:noescape
func Yfdatasync(tls *TLS, fd int32) (r int32)

//go:noescape
func Yfdim(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yfdimf(tls *TLS, x float32, y float32) (r float32)

//go:noescape
func Yfdiml(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yfdopen(tls *TLS, fd int32, mode uintptr) (r uintptr)

//go:noescape
func Yfdopendir(tls *TLS, fd int32) (r uintptr)

//go:noescape
func Yfeclearexcept(tls *TLS, mask int32) (r int32)

//go:noescape
func Yfegetenv(tls *TLS, envp uintptr) (r int32)

//go:noescape
func Yfegetround(tls *TLS) (r int32)

//go:noescape
func Yfeof(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yfeof_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yferaiseexcept(tls *TLS, mask int32) (r int32)

//go:noescape
func Yferror(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yferror_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yfesetenv(tls *TLS, envp uintptr) (r int32)

//go:noescape
func Yfetestexcept(tls *TLS, mask int32) (r int32)

//go:noescape
func Yfexecve(tls *TLS, fd int32, argv uintptr, envp uintptr) (r1 int32)

//go:noescape
func Yfflush(tls *TLS, f uintptr) (r1 int32)

//go:noescape
func Yfflush_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yffs(tls *TLS, i int32) (r int32)

//go:noescape
func Yffsl(tls *TLS, i int64) (r int32)

//go:noescape
func Yffsll(tls *TLS, i int64) (r int32)

//go:noescape
func Yfgetc(tls *TLS, f1 uintptr) (r int32)

//go:noescape
func Yfgetc_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yfgetgrent(tls *TLS, f uintptr) (r uintptr)

//go:noescape
func Yfgetln(tls *TLS, f uintptr, plen uintptr) (r uintptr)

//go:noescape
func Yfgetpos(tls *TLS, f uintptr, pos uintptr) (r int32)

//go:noescape
func Yfgetpwent(tls *TLS, f uintptr) (r uintptr)

//go:noescape
func Yfgets(tls *TLS, s uintptr, n int32, f uintptr) (r uintptr)

//go:noescape
func Yfgets_unlocked(tls *TLS, s uintptr, n int32, f uintptr) (r uintptr)

//go:noescape
func Yfgetwc(tls *TLS, f uintptr) (r Twint_t)

//go:noescape
func Yfgetwc_unlocked(tls *TLS, f uintptr) (r Twint_t)

//go:noescape
func Yfgetws(tls *TLS, s uintptr, n int32, f uintptr) (r uintptr)

//go:noescape
func Yfgetws_unlocked(tls *TLS, s uintptr, n int32, f uintptr) (r uintptr)

//go:noescape
func Yfgetxattr(tls *TLS, filedes int32, name uintptr, value uintptr, size Tsize_t) (r Tssize_t)

//go:noescape
func Yfileno(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yfileno_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yfinite(tls *TLS, x float64) (r int32)

//go:noescape
func Yfinitef(tls *TLS, x float32) (r int32)

//go:noescape
func Yflistxattr(tls *TLS, filedes int32, list uintptr, size Tsize_t) (r Tssize_t)

//go:noescape
func Yflock(tls *TLS, fd int32, op int32) (r int32)

//go:noescape
func Yflockfile(tls *TLS, f uintptr)

//go:noescape
func Yfloor(tls *TLS, x3 float64) (r float64)

//go:noescape
func Yfloorf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Yfloorl(tls *TLS, x float64) (r float64)

//go:noescape
func Yfma(tls *TLS, x1 float64, y float64, z float64) (r1 float64)

//go:noescape
func Yfmal(tls *TLS, x float64, y float64, z float64) (r float64)

//go:noescape
func Yfmax(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yfmaxf(tls *TLS, x float32, y float32) (r float32)

//go:noescape
func Yfmaxl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yfmemopen(tls *TLS, buf uintptr, size Tsize_t, mode uintptr) (r uintptr)

//go:noescape
func Yfmin(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yfminf(tls *TLS, x float32, y float32) (r float32)

//go:noescape
func Yfminl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yfmod(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yfmodf(tls *TLS, x float32, y float32) (r float32)

//go:noescape
func Yfmodl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yfmtmsg(tls *TLS, classification int64, label uintptr, severity int32, text uintptr, action uintptr, tag uintptr) (r int32)

//go:noescape
func Yfnmatch(tls *TLS, pat uintptr, str uintptr, flags int32) (r int32)

//go:noescape
func Yfopen(tls *TLS, filename uintptr, mode uintptr) (r uintptr)

//go:noescape
func Yfopen64(tls *TLS, filename uintptr, mode uintptr) (r uintptr)

//go:noescape
func Yfopencookie(tls *TLS, cookie uintptr, mode uintptr, iofuncs Tcookie_io_functions_t) (r uintptr)

//go:noescape
func Yfork(t *TLS) (_1 int32)

//go:noescape
func Yfpathconf(tls *TLS, fd int32, name int32) (r int64)

//go:noescape
func Yfprintf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Yfpurge(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yfputc(tls *TLS, c1 int32, f1 uintptr) (r int32)

//go:noescape
func Yfputc_unlocked(tls *TLS, c int32, f uintptr) (r int32)

//go:noescape
func Yfputs(tls *TLS, s uintptr, f uintptr) (r int32)

//go:noescape
func Yfputs_unlocked(tls *TLS, s uintptr, f uintptr) (r int32)

//go:noescape
func Yfputwc(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)

//go:noescape
func Yfputwc_unlocked(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)

//go:noescape
func Yfputws(tls *TLS, _ws uintptr, f uintptr) (r int32)

//go:noescape
func Yfputws_unlocked(tls *TLS, _ws uintptr, f uintptr) (r int32)

//go:noescape
func Yfread(tls *TLS, destv uintptr, size Tsize_t, nmemb Tsize_t, f uintptr) (r Tsize_t)

//go:noescape
func Yfread_unlocked(tls *TLS, destv uintptr, size Tsize_t, nmemb Tsize_t, f uintptr) (r Tsize_t)

//go:noescape
func Yfree(tls *TLS, p uintptr)

//go:noescape
func Yfreeaddrinfo(tls *TLS, p uintptr)

//go:noescape
func Yfreeifaddrs(tls *TLS, ifp uintptr)

//go:noescape
func Yfreelocale(tls *TLS, l Tlocale_t)

//go:noescape
func Yfremovexattr(tls *TLS, fd int32, name uintptr) (r int32)

//go:noescape
func Yfreopen(tls *TLS, filename uintptr, mode uintptr, f uintptr) (r uintptr)

//go:noescape
func Yfrexp(tls *TLS, x float64, e uintptr) (r float64)

//go:noescape
func Yfrexpf(tls *TLS, x float32, e uintptr) (r float32)

//go:noescape
func Yfrexpl(tls *TLS, x float64, e uintptr) (r float64)

//go:noescape
func Yfscanf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Yfseek(tls *TLS, f uintptr, off int64, whence int32) (r int32)

//go:noescape
func Yfseeko(tls *TLS, f uintptr, off Toff_t, whence int32) (r int32)

//go:noescape
func Yfsetpos(tls *TLS, f uintptr, pos uintptr) (r int32)

//go:noescape
func Yfsetxattr(tls *TLS, filedes int32, name uintptr, value uintptr, size Tsize_t, flags int32) (r int32)

//go:noescape
func Yfstat(tls *TLS, fd int32, st uintptr) (r int32)

//go:noescape
func Yfstat64(tls *TLS, fd int32, st uintptr) (r int32)

//go:noescape
func Yfstatat(tls *TLS, fd int32, path uintptr, st uintptr, flag int32) (r int32)

//go:noescape
func Yfstatfs(tls *TLS, fd int32, buf uintptr) (r int32)

//go:noescape
func Yfstatvfs(tls *TLS, fd int32, buf uintptr) (r int32)

//go:noescape
func Yfsync(tls *TLS, fd int32) (r int32)

//go:noescape
func Yftell(tls *TLS, f uintptr) (r int64)

//go:noescape
func Yftello(tls *TLS, f uintptr) (r Toff_t)

//go:noescape
func Yftime(tls *TLS, tp uintptr) (r int32)

//go:noescape
func Yftok(tls *TLS, path uintptr, id int32) (r Tkey_t)

//go:noescape
func Yftruncate(tls *TLS, fd int32, length Toff_t) (r int32)

//go:noescape
func Yftruncate64(tls *TLS, fd int32, length Toff_t) (r int32)

//go:noescape
func Yftrylockfile(tls *TLS, f uintptr) (r int32)

//go:noescape
func Yfts64_close(t *TLS, ftsp uintptr) (_2 int32)

//go:noescape
func Yfts64_open(t *TLS, path_argv uintptr, options int32, compar uintptr) (_4 uintptr)

//go:noescape
func Yfts64_read(t *TLS, ftsp uintptr) (_2 uintptr)

//go:noescape
func Yfts_close(t *TLS, ftsp uintptr) (_2 int32)

//go:noescape
func Yfts_open(t *TLS, path_argv uintptr, options int32, compar uintptr) (_4 uintptr)

//go:noescape
func Yfts_read(t *TLS, ftsp uintptr) (_2 uintptr)

//go:noescape
func Yftw(tls *TLS, path uintptr, __ccgo_fp_fn uintptr, fd_limit int32) (r int32)

//go:noescape
func __ccgo_abi0_ftw_1(_0 *TLS, _1 uintptr, _2 uintptr, _3 int32, __ccgo_fp uintptr) (_4 int32)

func __ccgo_abiInternal_ftw_1(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr, _3 int32) (_4 int32) {
		return __ccgo_abi0_ftw_1(_0, _1, _2, _3, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Yfunlockfile(tls *TLS, f uintptr)

//go:noescape
func Yfutimens(tls *TLS, fd int32, times uintptr) (r int32)

//go:noescape
func Yfutimes(tls *TLS, fd int32, tv uintptr) (r int32)

//go:noescape
func Yfutimesat(tls *TLS, dirfd int32, pathname uintptr, times uintptr) (r int32)

//go:noescape
func Yfwide(tls *TLS, f uintptr, mode int32) (r int32)

//go:noescape
func Yfwprintf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Yfwrite(tls *TLS, src uintptr, size Tsize_t, nmemb Tsize_t, f uintptr) (r Tsize_t)

//go:noescape
func Yfwrite_unlocked(tls *TLS, src uintptr, size Tsize_t, nmemb Tsize_t, f uintptr) (r Tsize_t)

//go:noescape
func Yfwscanf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Ygai_strerror(tls *TLS, ecode int32) (r uintptr)

//go:noescape
func Ygcvt(tls *TLS, x float64, n int32, b uintptr) (r uintptr)

//go:noescape
func Yget_avphys_pages(tls *TLS) (r int64)

//go:noescape
func Yget_current_dir_name(tls *TLS) (r uintptr)

//go:noescape
func Yget_nprocs(tls *TLS) (r int32)

//go:noescape
func Yget_nprocs_conf(tls *TLS) (r int32)

//go:noescape
func Yget_phys_pages(tls *TLS) (r int64)

//go:noescape
func Ygetaddrinfo(tls *TLS, host uintptr, serv uintptr, hint uintptr, res uintptr) (r1 int32)

//go:noescape
func Ygetauxval(tls *TLS, item uint64) (r uint64)

//go:noescape
func Ygetc(tls *TLS, f1 uintptr) (r int32)

//go:noescape
func Ygetc_unlocked(tls *TLS, f uintptr) (r int32)

//go:noescape
func Ygetchar(tls *TLS) (r int32)

//go:noescape
func Ygetchar_unlocked(tls *TLS) (r int32)

//go:noescape
func Ygetcwd(tls *TLS, buf uintptr, size Tsize_t) (r uintptr)

//go:noescape
func Ygetdate(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Ygetdelim(tls *TLS, s uintptr, n uintptr, delim int32, f uintptr) (r Tssize_t)

//go:noescape
func Ygetdents(tls *TLS, fd int32, buf uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Ygetdomainname(tls *TLS, name uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Ygetdtablesize(tls *TLS) (r int32)

//go:noescape
func Ygetegid(tls *TLS) (r Tgid_t)

//go:noescape
func Ygetentropy(tls *TLS, buffer uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Ygetenv(tls *TLS, name uintptr) (r uintptr)

//go:noescape
func Ygeteuid(tls *TLS) (r Tuid_t)

//go:noescape
func Ygetgid(tls *TLS) (r Tgid_t)

//go:noescape
func Ygetgrent(tls *TLS) (r uintptr)

//go:noescape
func Ygetgrgid(tls *TLS, gid Tgid_t) (r uintptr)

//go:noescape
func Ygetgrgid_r(tls *TLS, gid Tgid_t, gr uintptr, buf uintptr, size Tsize_t, res uintptr) (r int32)

//go:noescape
func Ygetgrnam(tls *TLS, name uintptr) (r uintptr)

//go:noescape
func Ygetgrnam_r(tls *TLS, name uintptr, gr uintptr, buf uintptr, size Tsize_t, res uintptr) (r int32)

//go:noescape
func Ygetgrouplist(tls *TLS, user uintptr, gid Tgid_t, groups uintptr, ngroups uintptr) (r int32)

//go:noescape
func Ygetgroups(tls *TLS, count int32, list uintptr) (r int32)

//go:noescape
func Ygethostbyaddr(tls *TLS, a uintptr, l Tsocklen_t, af int32) (r uintptr)

//go:noescape
func Ygethostbyaddr_r(tls *TLS, a uintptr, l Tsocklen_t, af int32, h uintptr, buf uintptr, buflen Tsize_t, res uintptr, err uintptr) (r int32)

//go:noescape
func Ygethostbyname(tls *TLS, name uintptr) (r uintptr)

//go:noescape
func Ygethostbyname2(tls *TLS, name uintptr, af int32) (r uintptr)

//go:noescape
func Ygethostbyname2_r(tls *TLS, name uintptr, af int32, h uintptr, buf uintptr, buflen Tsize_t, res uintptr, err uintptr) (r int32)

//go:noescape
func Ygethostbyname_r(tls *TLS, name uintptr, h uintptr, buf uintptr, buflen Tsize_t, res uintptr, err uintptr) (r int32)

//go:noescape
func Ygethostent(tls *TLS) (r uintptr)

//go:noescape
func Ygethostid(tls *TLS) (r int64)

//go:noescape
func Ygethostname(tls *TLS, name uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Ygetifaddrs(tls *TLS, ifap uintptr) (r1 int32)

//go:noescape
func Ygetitimer(tls *TLS, which int32, old uintptr) (r1 int32)

//go:noescape
func Ygetline(tls *TLS, s uintptr, n uintptr, f uintptr) (r Tssize_t)

//go:noescape
func Ygetloadavg(tls *TLS, a uintptr, n int32) (r int32)

//go:noescape
func Ygetlogin(tls *TLS) (r uintptr)

//go:noescape
func Ygetlogin_r(tls *TLS, name uintptr, size Tsize_t) (r int32)

//go:noescape
func Ygetmntent(tls *TLS, f uintptr) (r uintptr)

//go:noescape
func Ygetmntent_r(tls *TLS, f uintptr, mnt uintptr, linebuf uintptr, buflen int32) (r uintptr)

//go:noescape
func Ygetnameinfo(tls *TLS, sa uintptr, sl Tsocklen_t, node uintptr, nodelen Tsocklen_t, serv uintptr, servlen Tsocklen_t, flags int32) (r int32)

//go:noescape
func Ygetnetbyaddr(tls *TLS, net Tuint32_t, type1 int32) (r uintptr)

//go:noescape
func Ygetnetbyname(tls *TLS, name uintptr) (r uintptr)

//go:noescape
func Ygetnetent(tls *TLS) (r uintptr)

//go:noescape
func Ygetopt(tls *TLS, argc int32, argv uintptr, optstring uintptr) (r int32)

//go:noescape
func Ygetopt_long(tls *TLS, argc int32, argv uintptr, optstring uintptr, longopts uintptr, idx uintptr) (r int32)

//go:noescape
func Ygetopt_long_only(tls *TLS, argc int32, argv uintptr, optstring uintptr, longopts uintptr, idx uintptr) (r int32)

//go:noescape
func Ygetpagesize(tls *TLS) (r int32)

//go:noescape
func Ygetpass(tls *TLS, prompt uintptr) (r uintptr)

//go:noescape
func Ygetpeername(tls *TLS, fd int32, addr uintptr, len1 uintptr) (r1 int32)

//go:noescape
func Ygetpgid(tls *TLS, pid Tpid_t) (r Tpid_t)

//go:noescape
func Ygetpgrp(tls *TLS) (r Tpid_t)

//go:noescape
func Ygetpid(tls *TLS) (r Tpid_t)

//go:noescape
func Ygetppid(tls *TLS) (r Tpid_t)

//go:noescape
func Ygetpriority(tls *TLS, which int32, who Tid_t) (r int32)

//go:noescape
func Ygetprotobyname(tls *TLS, name uintptr) (r uintptr)

//go:noescape
func Ygetprotobynumber(tls *TLS, num int32) (r uintptr)

//go:noescape
func Ygetprotoent(tls *TLS) (r uintptr)

//go:noescape
func Ygetpwent(tls *TLS) (r uintptr)

//go:noescape
func Ygetpwnam(tls *TLS, name uintptr) (r uintptr)

//go:noescape
func Ygetpwnam_r(tls *TLS, name uintptr, pw uintptr, buf uintptr, size Tsize_t, res uintptr) (r int32)

//go:noescape
func Ygetpwuid(tls *TLS, uid Tuid_t) (r uintptr)

//go:noescape
func Ygetpwuid_r(tls *TLS, uid Tuid_t, pw uintptr, buf uintptr, size Tsize_t, res uintptr) (r int32)

//go:noescape
func Ygetrandom(tls *TLS, buf uintptr, buflen Tsize_t, flags uint32) (r Tssize_t)

//go:noescape
func Ygetresgid(tls *TLS, rgid uintptr, egid uintptr, sgid uintptr) (r int32)

//go:noescape
func Ygetresuid(tls *TLS, ruid uintptr, euid uintptr, suid uintptr) (r int32)

//go:noescape
func Ygetrlimit(tls *TLS, resource int32, rlim uintptr) (r int32)

//go:noescape
func Ygetrlimit64(tls *TLS, resource int32, rlim uintptr) (r int32)

//go:noescape
func Ygetrusage(tls *TLS, who int32, ru uintptr) (r1 int32)

//go:noescape
func Ygets(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Ygetservbyname(tls *TLS, name uintptr, prots uintptr) (r uintptr)

//go:noescape
func Ygetservbyname_r(tls *TLS, name uintptr, prots uintptr, se uintptr, buf uintptr, buflen Tsize_t, res uintptr) (r int32)

//go:noescape
func Ygetservent(tls *TLS) (r uintptr)

//go:noescape
func Ygetsid(tls *TLS, pid Tpid_t) (r Tpid_t)

//go:noescape
func Ygetsockname(tls *TLS, fd int32, addr uintptr, len1 uintptr) (r1 int32)

//go:noescape
func Ygetsockopt(tls *TLS, fd int32, level int32, optname int32, optval uintptr, optlen uintptr) (r2 int32)

//go:noescape
func Ygetspent(tls *TLS) (r uintptr)

//go:noescape
func Ygetsubopt(tls *TLS, opt uintptr, keys uintptr, val uintptr) (r int32)

//go:noescape
func Ygettext(tls *TLS, msgid uintptr) (r uintptr)

//go:noescape
func Ygettimeofday(tls *TLS, tv uintptr, tz uintptr) (r int32)

//go:noescape
func Ygetuid(tls *TLS) (r Tuid_t)

//go:noescape
func Ygetusershell(tls *TLS) (r uintptr)

//go:noescape
func Ygetutent(tls *TLS) (r uintptr)

//go:noescape
func Ygetutid(tls *TLS, ut uintptr) (r uintptr)

//go:noescape
func Ygetutline(tls *TLS, ut uintptr) (r uintptr)

//go:noescape
func Ygetutxent(tls *TLS) (r uintptr)

//go:noescape
func Ygetutxid(tls *TLS, ut uintptr) (r uintptr)

//go:noescape
func Ygetutxline(tls *TLS, ut uintptr) (r uintptr)

//go:noescape
func Ygetw(tls *TLS, f uintptr) (r int32)

//go:noescape
func Ygetwc(tls *TLS, f uintptr) (r Twint_t)

//go:noescape
func Ygetwc_unlocked(tls *TLS, f uintptr) (r Twint_t)

//go:noescape
func Ygetwchar(tls *TLS) (r Twint_t)

//go:noescape
func Ygetwchar_unlocked(tls *TLS) (r Twint_t)

//go:noescape
func Ygetxattr(tls *TLS, path uintptr, name uintptr, value uintptr, size Tsize_t) (r Tssize_t)

//go:noescape
func Yglob(tls *TLS, pat uintptr, flags int32, __ccgo_fp_errfunc uintptr, g_ uintptr) (r int32)

//go:noescape
func __ccgo_abi0_glob_2(_0 *TLS, _1 uintptr, _2 int32, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_glob_2(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 int32) (_3 int32) {
		return __ccgo_abi0_glob_2(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Yglobfree(tls *TLS, g_ uintptr)

//go:noescape
func Ygmtime(tls *TLS, t uintptr) (r uintptr)

//go:noescape
func Ygmtime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr)

//go:noescape
func Ygrantpt(tls *TLS, fd int32) (r int32)

//go:noescape
func Yhasmntopt(tls *TLS, mnt uintptr, opt uintptr) (r uintptr)

//go:noescape
func Yhcreate(tls *TLS, nel Tsize_t) (r int32)

//go:noescape
func Yhdestroy(tls *TLS)

//go:noescape
func Yherror(tls *TLS, msg uintptr)

//go:noescape
func Yhsearch(tls *TLS, item TENTRY, action TACTION) (r uintptr)

//go:noescape
func Yhstrerror(tls *TLS, ecode int32) (r uintptr)

//go:noescape
func Yhtonl(tls *TLS, n Tuint32_t) (r Tuint32_t)

//go:noescape
func Yhtons(tls *TLS, n Tuint16_t) (r Tuint16_t)

//go:noescape
func Yhypot(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yhypotf(tls *TLS, x float32, y float32) (r float32)

//go:noescape
func Yhypotl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yiconv(tls *TLS, cd Ticonv_t, in uintptr, inb uintptr, out uintptr, outb uintptr) (r Tsize_t)

//go:noescape
func Yiconv_close(tls *TLS, cd Ticonv_t) (r int32)

//go:noescape
func Yiconv_open(tls *TLS, to uintptr, from uintptr) (r Ticonv_t)

//go:noescape
func Yif_freenameindex(tls *TLS, idx uintptr)

//go:noescape
func Yif_indextoname(tls *TLS, index uint32, name uintptr) (r1 uintptr)

//go:noescape
func Yif_nameindex(tls *TLS) (r uintptr)

//go:noescape
func Yif_nametoindex(tls *TLS, name uintptr) (r1 uint32)

//go:noescape
func Yilogb(tls *TLS, x3 float64) (r int32)

//go:noescape
func Yilogbf(tls *TLS, x3 float32) (r int32)

//go:noescape
func Yilogbl(tls *TLS, x float64) (r int32)

//go:noescape
func Yimaxabs(tls *TLS, a Tintmax_t) (r Tintmax_t)

//go:noescape
func Yimaxdiv(tls *TLS, num Tintmax_t, den Tintmax_t) (r Timaxdiv_t)

//go:noescape
func Yindex(tls *TLS, s uintptr, c int32) (r uintptr)

//go:noescape
func Yinet_addr(tls *TLS, p uintptr) (r Tin_addr_t)

//go:noescape
func Yinet_aton(tls *TLS, s0 uintptr, dest uintptr) (r int32)

//go:noescape
func Yinet_lnaof(tls *TLS, in Tin_addr) (r Tin_addr_t)

//go:noescape
func Yinet_makeaddr(tls *TLS, n Tin_addr_t, h Tin_addr_t) (r Tin_addr)

//go:noescape
func Yinet_netof(tls *TLS, in Tin_addr) (r Tin_addr_t)

//go:noescape
func Yinet_network(tls *TLS, p uintptr) (r Tin_addr_t)

//go:noescape
func Yinet_ntoa(tls *TLS, _in Tin_addr) (r uintptr)

//go:noescape
func Yinet_ntop(tls *TLS, af int32, a0 uintptr, s uintptr, l Tsocklen_t) (r uintptr)

//go:noescape
func Yinet_pton(tls *TLS, af int32, s uintptr, a0 uintptr) (r int32)

//go:noescape
func Yinit_module(tls *TLS, a uintptr, b uint64, c uintptr) (r int32)

//go:noescape
func Yinitstate(tls *TLS, seed uint32, state uintptr, size Tsize_t) (r uintptr)

//go:noescape
func Yinitstate_r(t *TLS, seed uint32, statebuf uintptr, statelen Tsize_t, buf uintptr) (_5 int32)

//go:noescape
func Yinotify_add_watch(tls *TLS, fd int32, pathname uintptr, mask Tuint32_t) (r int32)

//go:noescape
func Yinotify_init(tls *TLS) (r int32)

//go:noescape
func Yinotify_init1(tls *TLS, flags int32) (r1 int32)

//go:noescape
func Yinotify_rm_watch(tls *TLS, fd int32, wd int32) (r int32)

//go:noescape
func Yinsque(tls *TLS, element uintptr, pred uintptr)

//go:noescape
func Yioctl(tls *TLS, fd int32, req int32, va uintptr) (r1 int32)

//go:noescape
func Yioperm(tls *TLS, from uint64, num uint64, turn_on int32) (r int32)

//go:noescape
func Yiopl(tls *TLS, level int32) (r int32)

//go:noescape
func Yisalnum(tls *TLS, c int32) (r int32)

//go:noescape
func Yisalnum_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yisalpha(tls *TLS, c int32) (r int32)

//go:noescape
func Yisalpha_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yisascii(tls *TLS, c int32) (r int32)

//go:noescape
func Yisastream(tls *TLS, fd int32) (r int32)

//go:noescape
func Yisatty(tls *TLS, fd int32) (r1 int32)

//go:noescape
func Yisblank(tls *TLS, c int32) (r int32)

//go:noescape
func Yisblank_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yiscntrl(tls *TLS, c int32) (r int32)

//go:noescape
func Yiscntrl_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yisdigit(tls *TLS, c int32) (r int32)

//go:noescape
func Yisdigit_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yisgraph(tls *TLS, c int32) (r int32)

//go:noescape
func Yisgraph_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yislower(tls *TLS, c int32) (r int32)

//go:noescape
func Yislower_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yisnan(t *TLS, x float64) (_2 int32)

//go:noescape
func Yisnanf(t *TLS, arg float32) (_2 int32)

//go:noescape
func Yisnanl(t *TLS, arg float64) (_2 int32)

//go:noescape
func Yisprint(tls *TLS, c int32) (r int32)

//go:noescape
func Yisprint_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yispunct(tls *TLS, c int32) (r int32)

//go:noescape
func Yispunct_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yissetugid(tls *TLS) (r int32)

//go:noescape
func Yisspace(tls *TLS, c int32) (r int32)

//go:noescape
func Yisspace_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yisupper(tls *TLS, c int32) (r int32)

//go:noescape
func Yisupper_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yiswalnum(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswalnum_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswalpha(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswalpha_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswblank(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswblank_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswcntrl(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswcntrl_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswctype(tls *TLS, wc Twint_t, type1 Twctype_t) (r int32)

//go:noescape
func Yiswctype_l(tls *TLS, c Twint_t, t Twctype_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswdigit(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswdigit_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswgraph(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswgraph_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswlower(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswlower_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswprint(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswprint_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswpunct(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswpunct_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswspace(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswspace_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswupper(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswupper_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yiswxdigit(tls *TLS, wc Twint_t) (r int32)

//go:noescape
func Yiswxdigit_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)

//go:noescape
func Yisxdigit(tls *TLS, c int32) (r int32)

//go:noescape
func Yisxdigit_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Yj0(tls *TLS, x float64) (r1 float64)

//go:noescape
func Yj0f(tls *TLS, x float32) (r1 float32)

//go:noescape
func Yj1(tls *TLS, x float64) (r1 float64)

//go:noescape
func Yj1f(tls *TLS, x float32) (r1 float32)

//go:noescape
func Yjn(tls *TLS, n int32, x float64) (r float64)

//go:noescape
func Yjnf(tls *TLS, n int32, x float32) (r float32)

//go:noescape
func Yjrand48(tls *TLS, s uintptr) (r int64)

//go:noescape
func Ykill(tls *TLS, pid Tpid_t, sig int32) (r int32)

//go:noescape
func Ykillpg(tls *TLS, pgid Tpid_t, sig int32) (r int32)

//go:noescape
func Yklogctl(tls *TLS, type1 int32, buf uintptr, len1 int32) (r int32)

//go:noescape
func Yl64a(tls *TLS, x0 int64) (r uintptr)

//go:noescape
func Ylabs(tls *TLS, a int64) (r int64)

//go:noescape
func Ylchmod(tls *TLS, path uintptr, mode Tmode_t) (r int32)

//go:noescape
func Ylchown(tls *TLS, path uintptr, uid Tuid_t, gid Tgid_t) (r int32)

//go:noescape
func Ylckpwdf(tls *TLS) (r int32)

//go:noescape
func Ylcong48(tls *TLS, p uintptr)

//go:noescape
func Yldexp(tls *TLS, x float64, n int32) (r float64)

//go:noescape
func Yldexpf(tls *TLS, x float32, n int32) (r float32)

//go:noescape
func Yldexpl(tls *TLS, x float64, n int32) (r float64)

//go:noescape
func Yldiv(tls *TLS, num int64, den int64) (r Tldiv_t)

//go:noescape
func Ylfind(tls *TLS, key uintptr, base uintptr, nelp uintptr, width Tsize_t, __ccgo_fp_compar uintptr) (r uintptr)

//go:noescape
func __ccgo_abi0_lfind_4(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_lfind_4(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0_lfind_4(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Ylgamma(tls *TLS, x float64) (r float64)

//go:noescape
func Ylgamma_r(tls *TLS, x float64, signgamp uintptr) (r float64)

//go:noescape
func Ylgammaf(tls *TLS, x float32) (r float32)

//go:noescape
func Ylgammaf_r(tls *TLS, x float32, signgamp uintptr) (r float32)

//go:noescape
func Ylgammal(tls *TLS, x float64) (r float64)

//go:noescape
func Ylgammal_r(tls *TLS, x float64, sg uintptr) (r float64)

//go:noescape
func Ylgetxattr(tls *TLS, path uintptr, name uintptr, value uintptr, size Tsize_t) (r Tssize_t)

//go:noescape
func Ylink(tls *TLS, existing uintptr, new1 uintptr) (r int32)

//go:noescape
func Ylinkat(tls *TLS, fd1 int32, existing uintptr, fd2 int32, new1 uintptr, flag int32) (r int32)

//go:noescape
func Ylisten(tls *TLS, fd int32, backlog int32) (r1 int32)

//go:noescape
func Ylistxattr(tls *TLS, path uintptr, list uintptr, size Tsize_t) (r Tssize_t)

//go:noescape
func Yllabs(tls *TLS, a int64) (r int64)

//go:noescape
func Ylldiv(tls *TLS, num int64, den int64) (r Tlldiv_t)

//go:noescape
func Yllistxattr(tls *TLS, path uintptr, list uintptr, size Tsize_t) (r Tssize_t)

//go:noescape
func Yllrint(tls *TLS, x float64) (r int64)

//go:noescape
func Yllrintf(tls *TLS, x float32) (r int64)

//go:noescape
func Yllrintl(tls *TLS, x float64) (r int64)

//go:noescape
func Yllround(tls *TLS, x float64) (r int64)

//go:noescape
func Yllroundf(tls *TLS, x float32) (r int64)

//go:noescape
func Yllroundl(tls *TLS, x float64) (r int64)

//go:noescape
func Ylocaleconv(tls *TLS) (r uintptr)

//go:noescape
func Ylocaltime(tls *TLS, t uintptr) (r uintptr)

//go:noescape
func Ylocaltime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr)

//go:noescape
func Ylockf(tls *TLS, fd int32, op int32, size Toff_t) (r int32)

//go:noescape
func Ylog(tls *TLS, x1 float64) (r1 float64)

//go:noescape
func Ylog10(tls *TLS, x float64) (r float64)

//go:noescape
func Ylog10f(tls *TLS, x float32) (r float32)

//go:noescape
func Ylog10l(tls *TLS, x float64) (r float64)

//go:noescape
func Ylog1p(tls *TLS, x3 float64) (r float64)

//go:noescape
func Ylog1pf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Ylog1pl(tls *TLS, x float64) (r float64)

//go:noescape
func Ylog2(tls *TLS, x1 float64) (r1 float64)

//go:noescape
func Ylog2f(tls *TLS, x1 float32) (r1 float32)

//go:noescape
func Ylog2l(tls *TLS, x float64) (r float64)

//go:noescape
func Ylogb(tls *TLS, x float64) (r float64)

//go:noescape
func Ylogbf(tls *TLS, x float32) (r float32)

//go:noescape
func Ylogbl(tls *TLS, x float64) (r float64)

//go:noescape
func Ylogf(tls *TLS, x1 float32) (r1 float32)

//go:noescape
func Ylogin_tty(tls *TLS, fd int32) (r int32)

//go:noescape
func Ylogl(tls *TLS, x float64) (r float64)

//go:noescape
func Ylongjmp(t *TLS, env uintptr, val int32)

//go:noescape
func Ylrand48(tls *TLS) (r int64)

//go:noescape
func Ylremovexattr(tls *TLS, path uintptr, name uintptr) (r int32)

//go:noescape
func Ylrint(tls *TLS, x float64) (r int64)

//go:noescape
func Ylrintf(tls *TLS, x float32) (r int64)

//go:noescape
func Ylrintl(tls *TLS, x float64) (r int64)

//go:noescape
func Ylround(tls *TLS, x float64) (r int64)

//go:noescape
func Ylroundf(tls *TLS, x float32) (r int64)

//go:noescape
func Ylroundl(tls *TLS, x float64) (r int64)

//go:noescape
func Ylsearch(tls *TLS, key uintptr, base uintptr, nelp uintptr, width Tsize_t, __ccgo_fp_compar uintptr) (r uintptr)

//go:noescape
func __ccgo_abi0_lsearch_4(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_lsearch_4(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0_lsearch_4(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Ylseek(tls *TLS, fd int32, offset Toff_t, whence int32) (r Toff_t)

//go:noescape
func Ylseek64(tls *TLS, fd int32, offset Toff_t, whence int32) (r Toff_t)

//go:noescape
func Ylsetxattr(tls *TLS, path uintptr, name uintptr, value uintptr, size Tsize_t, flags int32) (r int32)

//go:noescape
func Ylstat(tls *TLS, path uintptr, buf uintptr) (r int32)

//go:noescape
func Ylstat64(tls *TLS, path uintptr, buf uintptr) (r int32)

//go:noescape
func Ylutimes(tls *TLS, filename uintptr, tv uintptr) (r int32)

//go:noescape
func Ymadvise(tls *TLS, addr uintptr, len1 Tsize_t, advice int32) (r int32)

//go:noescape
func Ymalloc(tls *TLS, n Tsize_t) (r uintptr)

//go:noescape
func Ymalloc_usable_size(tls *TLS, p uintptr) (r Tsize_t)

//go:noescape
func Ymblen(tls *TLS, s uintptr, n Tsize_t) (r int32)

//go:noescape
func Ymbrlen(tls *TLS, s uintptr, n Tsize_t, st uintptr) (r Tsize_t)

//go:noescape
func Ymbrtoc16(tls *TLS, pc16 uintptr, s uintptr, n Tsize_t, ps uintptr) (r Tsize_t)

//go:noescape
func Ymbrtoc32(tls *TLS, pc32 uintptr, s uintptr, n Tsize_t, ps uintptr) (r Tsize_t)

//go:noescape
func Ymbrtowc(tls *TLS, wc uintptr, src uintptr, n Tsize_t, st uintptr) (r Tsize_t)

//go:noescape
func Ymbsinit(tls *TLS, st uintptr) (r int32)

//go:noescape
func Ymbsnrtowcs(tls *TLS, wcs uintptr, src uintptr, n Tsize_t, wn Tsize_t, st uintptr) (r Tsize_t)

//go:noescape
func Ymbsrtowcs(tls *TLS, ws uintptr, src uintptr, wn Tsize_t, st uintptr) (r Tsize_t)

//go:noescape
func Ymbstowcs(tls *TLS, ws uintptr, _s uintptr, wn Tsize_t) (r Tsize_t)

//go:noescape
func Ymbtowc(tls *TLS, wc uintptr, src uintptr, n Tsize_t) (r int32)

//go:noescape
func Ymemccpy(tls *TLS, dest uintptr, src uintptr, c int32, n Tsize_t) (r uintptr)

//go:noescape
func Ymemchr(tls *TLS, src uintptr, c int32, n Tsize_t) (r uintptr)

//go:noescape
func Ymemcmp(tls *TLS, vl uintptr, vr uintptr, n Tsize_t) (r1 int32)

//go:noescape
func Ymemcpy(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ymemfd_create(tls *TLS, name uintptr, flags uint32) (r int32)

//go:noescape
func Ymemmem(tls *TLS, h0 uintptr, k Tsize_t, n0 uintptr, l Tsize_t) (r uintptr)

//go:noescape
func Ymemmove(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ymempcpy(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ymemrchr(tls *TLS, m uintptr, c int32, n Tsize_t) (r uintptr)

//go:noescape
func Ymemset(tls *TLS, dest uintptr, c int32, n Tsize_t) (r uintptr)

//go:noescape
func Ymincore(tls *TLS, addr uintptr, len1 Tsize_t, vec uintptr) (r int32)

//go:noescape
func Ymkdir(tls *TLS, path uintptr, mode Tmode_t) (r int32)

//go:noescape
func Ymkdirat(tls *TLS, fd int32, path uintptr, mode Tmode_t) (r int32)

//go:noescape
func Ymkdtemp(tls *TLS, template uintptr) (r uintptr)

//go:noescape
func Ymkfifo(tls *TLS, path uintptr, mode Tmode_t) (r int32)

//go:noescape
func Ymkfifoat(tls *TLS, fd int32, path uintptr, mode Tmode_t) (r int32)

//go:noescape
func Ymknod(tls *TLS, path uintptr, mode Tmode_t, dev Tdev_t) (r int32)

//go:noescape
func Ymknodat(tls *TLS, fd int32, path uintptr, mode Tmode_t, dev Tdev_t) (r int32)

//go:noescape
func Ymkostemp(tls *TLS, template uintptr, flags int32) (r int32)

//go:noescape
func Ymkostemps(tls *TLS, template uintptr, len1 int32, flags int32) (r int32)

//go:noescape
func Ymkstemp(tls *TLS, template uintptr) (r int32)

//go:noescape
func Ymkstemp64(tls *TLS, template uintptr) (r int32)

//go:noescape
func Ymkstemps(tls *TLS, template uintptr, len1 int32) (r int32)

//go:noescape
func Ymkstemps64(tls *TLS, template uintptr, len1 int32) (r int32)

//go:noescape
func Ymktemp(tls *TLS, template uintptr) (r uintptr)

//go:noescape
func Ymktime(tls *TLS, tm uintptr) (r Ttime_t)

//go:noescape
func Ymlock(tls *TLS, addr uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Ymlock2(tls *TLS, addr uintptr, len1 Tsize_t, flags uint32) (r int32)

//go:noescape
func Ymlockall(tls *TLS, flags int32) (r int32)

//go:noescape
func Ymmap(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr)

//go:noescape
func Ymmap64(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr)

//go:noescape
func Ymodf(tls *TLS, x float64, iptr uintptr) (r float64)

//go:noescape
func Ymodff(tls *TLS, x float32, iptr uintptr) (r float32)

//go:noescape
func Ymodfl(tls *TLS, x float64, iptr uintptr) (r1 float64)

//go:noescape
func Ymount(tls *TLS, special uintptr, dir uintptr, fstype uintptr, flags uint64, data uintptr) (r int32)

//go:noescape
func Ymprotect(tls *TLS, addr uintptr, len1 Tsize_t, prot int32) (r int32)

//go:noescape
func Ymrand48(tls *TLS) (r int64)

//go:noescape
func Ymremap(tls *TLS, old_addr uintptr, old_len Tsize_t, new_len Tsize_t, flags int32, va uintptr) (r uintptr)

//go:noescape
func Ymsgctl(tls *TLS, q int32, cmd int32, buf uintptr) (r1 int32)

//go:noescape
func Ymsgget(tls *TLS, k Tkey_t, flag int32) (r int32)

//go:noescape
func Ymsgrcv(tls *TLS, q int32, m uintptr, len1 Tsize_t, type1 int64, flag int32) (r Tssize_t)

//go:noescape
func Ymsgsnd(tls *TLS, q int32, m uintptr, len1 Tsize_t, flag int32) (r int32)

//go:noescape
func Ymsync(tls *TLS, start uintptr, len1 Tsize_t, flags int32) (r int32)

//go:noescape
func Ymunlock(tls *TLS, addr uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Ymunlockall(tls *TLS) (r int32)

//go:noescape
func Ymunmap(tls *TLS, start uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Yname_to_handle_at(tls *TLS, dirfd int32, pathname uintptr, handle uintptr, mount_id uintptr, flags int32) (r int32)

//go:noescape
func Ynan(tls *TLS, s uintptr) (r float64)

//go:noescape
func Ynanf(tls *TLS, s uintptr) (r float32)

//go:noescape
func Ynanl(tls *TLS, s uintptr) (r float64)

//go:noescape
func Ynanosleep(tls *TLS, req uintptr, rem uintptr) (r int32)

//go:noescape
func Ynewlocale(tls *TLS, mask int32, name uintptr, loc Tlocale_t) (r Tlocale_t)

//go:noescape
func Ynextafter(tls *TLS, x3 float64, y3 float64) (r float64)

//go:noescape
func Ynextafterf(tls *TLS, x3 float32, y3 float32) (r float32)

//go:noescape
func Ynextafterl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Ynexttoward(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Ynexttowardf(tls *TLS, x3 float32, y3 float64) (r float32)

//go:noescape
func Ynexttowardl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Ynftw(tls *TLS, path uintptr, __ccgo_fp_fn uintptr, fd_limit int32, flags int32) (r1 int32)

//go:noescape
func __ccgo_abi0_nftw_1(_0 *TLS, _1 uintptr, _2 uintptr, _3 int32, _4 uintptr, __ccgo_fp uintptr) (_5 int32)

func __ccgo_abiInternal_nftw_1(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr, _3 int32, _4 uintptr) (_5 int32) {
		return __ccgo_abi0_nftw_1(_0, _1, _2, _3, _4, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Yngettext(tls *TLS, msgid1 uintptr, msgid2 uintptr, n uint64) (r uintptr)

//go:noescape
func Ynice(tls *TLS, inc int32) (r int32)

//go:noescape
func Ynl_langinfo(tls *TLS, item Tnl_item) (r uintptr)

//go:noescape
func Ynl_langinfo_l(tls *TLS, item Tnl_item, loc Tlocale_t) (r uintptr)

//go:noescape
func Ynrand48(tls *TLS, s uintptr) (r int64)

//go:noescape
func Yns_get16(tls *TLS, cp uintptr) (r uint32)

//go:noescape
func Yns_get32(tls *TLS, cp uintptr) (r uint64)

//go:noescape
func Yns_initparse(tls *TLS, msg uintptr, msglen int32, handle uintptr) (r1 int32)

//go:noescape
func Yns_name_uncompress(tls *TLS, msg uintptr, eom uintptr, src uintptr, dst uintptr, dstsiz Tsize_t) (r1 int32)

//go:noescape
func Yns_parserr(tls *TLS, handle uintptr, section Tns_sect, rrnum int32, rr uintptr) (r1 int32)

//go:noescape
func Yns_put16(tls *TLS, s uint32, cp uintptr)

//go:noescape
func Yns_put32(tls *TLS, l uint64, cp uintptr)

//go:noescape
func Yns_skiprr(tls *TLS, ptr uintptr, eom uintptr, section Tns_sect, count int32) (r1 int32)

//go:noescape
func Yntohl(tls *TLS, n Tuint32_t) (r Tuint32_t)

//go:noescape
func Yntohs(tls *TLS, n Tuint16_t) (r Tuint16_t)

//go:noescape
func Yobstack_free(t *TLS, obstack, obj uintptr)

//go:noescape
func Yobstack_vprintf(t *TLS, obstack, template, va uintptr) (_2 int32)

//go:noescape
func Yopen(tls *TLS, filename uintptr, flags int32, va uintptr) (r int32)

//go:noescape
func Yopen64(tls *TLS, filename uintptr, flags int32, va uintptr) (r int32)

//go:noescape
func Yopen_by_handle_at(tls *TLS, mount_fd int32, handle uintptr, flags int32) (r int32)

//go:noescape
func Yopen_memstream(tls *TLS, bufp uintptr, sizep uintptr) (r uintptr)

//go:noescape
func Yopen_wmemstream(tls *TLS, bufp uintptr, sizep uintptr) (r uintptr)

//go:noescape
func Yopenat(tls *TLS, fd int32, filename uintptr, flags int32, va uintptr) (r int32)

//go:noescape
func Yopendir(tls *TLS, name uintptr) (r uintptr)

//go:noescape
func Yopenlog(tls *TLS, ident uintptr, opt int32, facility int32)

//go:noescape
func Yopenpty(tls *TLS, pm uintptr, ps uintptr, name uintptr, tio uintptr, ws uintptr) (r int32)

//go:noescape
func Ypathconf(tls *TLS, path uintptr, name int32) (r int64)

//go:noescape
func Ypause(tls *TLS) (r int32)

//go:noescape
func Ypclose(tls *TLS, f uintptr) (r1 int32)

//go:noescape
func Yperror(tls *TLS, msg uintptr)

//go:noescape
func Ypersonality(tls *TLS, persona uint64) (r int32)

//go:noescape
func Ypipe(tls *TLS, fd uintptr) (r int32)

//go:noescape
func Ypipe2(tls *TLS, fd uintptr, flag int32) (r int32)

//go:noescape
func Ypivot_root(tls *TLS, new1 uintptr, old uintptr) (r int32)

//go:noescape
func Ypoll(tls *TLS, fds uintptr, n Tnfds_t, timeout int32) (r int32)

//go:noescape
func Ypopen(t *TLS, command, type1 uintptr) (_2 uintptr)

//go:noescape
func Yposix_close(tls *TLS, fd int32, flags int32) (r int32)

//go:noescape
func Yposix_fadvise(tls *TLS, fd int32, base Toff_t, len1 Toff_t, advice int32) (r int32)

//go:noescape
func Yposix_fallocate(tls *TLS, fd int32, base Toff_t, len1 Toff_t) (r int32)

//go:noescape
func Yposix_madvise(tls *TLS, addr uintptr, len1 Tsize_t, advice int32) (r int32)

//go:noescape
func Yposix_openpt(tls *TLS, flags int32) (r1 int32)

//go:noescape
func Yposix_spawn_file_actions_addchdir_np(tls *TLS, fa uintptr, path uintptr) (r int32)

//go:noescape
func Yposix_spawn_file_actions_addclose(tls *TLS, fa uintptr, fd int32) (r int32)

//go:noescape
func Yposix_spawn_file_actions_adddup2(tls *TLS, fa uintptr, srcfd int32, fd int32) (r int32)

//go:noescape
func Yposix_spawn_file_actions_addfchdir_np(tls *TLS, fa uintptr, fd int32) (r int32)

//go:noescape
func Yposix_spawn_file_actions_addopen(tls *TLS, fa uintptr, fd int32, path uintptr, flags int32, mode Tmode_t) (r int32)

//go:noescape
func Yposix_spawn_file_actions_destroy(tls *TLS, fa uintptr) (r int32)

//go:noescape
func Yposix_spawn_file_actions_init(tls *TLS, fa uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_destroy(tls *TLS, attr uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_getflags(tls *TLS, attr uintptr, flags uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_getpgroup(tls *TLS, attr uintptr, pgrp uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_getschedparam(tls *TLS, attr uintptr, schedparam uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_getschedpolicy(tls *TLS, attr uintptr, policy uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_getsigdefault(tls *TLS, attr uintptr, def uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_getsigmask(tls *TLS, attr uintptr, mask uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_init(tls *TLS, attr uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_setflags(tls *TLS, attr uintptr, flags int16) (r int32)

//go:noescape
func Yposix_spawnattr_setpgroup(tls *TLS, attr uintptr, pgrp Tpid_t) (r int32)

//go:noescape
func Yposix_spawnattr_setschedparam(tls *TLS, attr uintptr, schedparam uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_setschedpolicy(tls *TLS, attr uintptr, policy int32) (r int32)

//go:noescape
func Yposix_spawnattr_setsigdefault(tls *TLS, attr uintptr, def uintptr) (r int32)

//go:noescape
func Yposix_spawnattr_setsigmask(tls *TLS, attr uintptr, mask uintptr) (r int32)

//go:noescape
func Ypow(tls *TLS, x1 float64, y1 float64) (r float64)

//go:noescape
func Ypow10(tls *TLS, x float64) (r float64)

//go:noescape
func Ypow10f(tls *TLS, x float32) (r float32)

//go:noescape
func Ypow10l(tls *TLS, x float64) (r float64)

//go:noescape
func Ypowf(tls *TLS, x1 float32, y1 float32) (r float32)

//go:noescape
func Ypowl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yppoll(tls *TLS, fds uintptr, n Tnfds_t, to uintptr, mask uintptr) (r int32)

//go:noescape
func Yprctl(tls *TLS, op int32, va uintptr) (r int32)

//go:noescape
func Ypread(tls *TLS, fd int32, buf uintptr, size Tsize_t, ofs Toff_t) (r Tssize_t)

//go:noescape
func Ypreadv(tls *TLS, fd int32, iov uintptr, count int32, ofs Toff_t) (r Tssize_t)

//go:noescape
func Ypreadv2(tls *TLS, fd int32, iov uintptr, count int32, ofs Toff_t, flags int32) (r Tssize_t)

//go:noescape
func Yprintf(tls *TLS, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Yprlimit(tls *TLS, pid Tpid_t, resource int32, new_limit uintptr, old_limit uintptr) (r1 int32)

//go:noescape
func Yprocess_vm_readv(tls *TLS, pid Tpid_t, lvec uintptr, liovcnt uint64, rvec uintptr, riovcnt uint64, flags uint64) (r Tssize_t)

//go:noescape
func Yprocess_vm_writev(tls *TLS, pid Tpid_t, lvec uintptr, liovcnt uint64, rvec uintptr, riovcnt uint64, flags uint64) (r Tssize_t)

//go:noescape
func Ypselect(tls *TLS, n int32, rfds uintptr, wfds uintptr, efds uintptr, ts uintptr, mask uintptr) (r int32)

//go:noescape
func Ypsiginfo(tls *TLS, si uintptr, msg uintptr)

//go:noescape
func Ypsignal(tls *TLS, sig int32, msg uintptr)

//go:noescape
func Ypthread_atfork(tls *TLS, prepare, parent, child uintptr) (_2 int32)

//go:noescape
func Ypthread_attr_destroy(tls *TLS, a uintptr) (_2 int32)

//go:noescape
func Ypthread_attr_getdetachstate(tls *TLS, a uintptr, state uintptr) (_3 int32)

//go:noescape
func Ypthread_attr_init(tls *TLS, a uintptr) (_2 int32)

//go:noescape
func Ypthread_attr_setdetachstate(tls *TLS, a uintptr, state int32) (r int32)

//go:noescape
func Ypthread_attr_setscope(tls *TLS, a uintptr, scope int32) (_3 int32)

//go:noescape
func Ypthread_attr_setstacksize(tls *TLS, a uintptr, stacksite Tsize_t) (_3 int32)

//go:noescape
func Ypthread_cleanup_pop(tls *TLS, run int32)

//go:noescape
func Ypthread_cleanup_push(tls *TLS, f, x uintptr)

//go:noescape
func Ypthread_cond_broadcast(tls *TLS, c uintptr) (_2 int32)

//go:noescape
func Ypthread_cond_destroy(tls *TLS, c uintptr) (_2 int32)

//go:noescape
func Ypthread_cond_init(tls *TLS, c, a uintptr) (_2 int32)

//go:noescape
func Ypthread_cond_signal(tls *TLS, c uintptr) (_2 int32)

//go:noescape
func Ypthread_cond_timedwait(tls *TLS, c, m, ts uintptr) (r int32)

//go:noescape
func Ypthread_cond_wait(tls *TLS, c, m uintptr) (_2 int32)

//go:noescape
func Ypthread_create(tls *TLS, res, attrp, entry, arg uintptr) (_2 int32)

//go:noescape
func Ypthread_detach(tls *TLS, t uintptr) (_2 int32)

//go:noescape
func Ypthread_equal(tls *TLS, t, u uintptr) (_2 int32)

//go:noescape
func Ypthread_exit(tls *TLS, result uintptr)

//go:noescape
func Ypthread_getspecific(tls *TLS, k Tpthread_key_t) (_2 uintptr)

//go:noescape
func Ypthread_join(tls *TLS, t Tpthread_t, res uintptr) (r int32)

//go:noescape
func Ypthread_key_create(tls *TLS, k uintptr, dtor uintptr) (_3 int32)

//go:noescape
func Ypthread_key_delete(tls *TLS, k Tpthread_key_t) (_2 int32)

//go:noescape
func Ypthread_mutex_destroy(tls *TLS, m uintptr) (_2 int32)

//go:noescape
func Ypthread_mutex_init(tls *TLS, m, a uintptr) (_2 int32)

//go:noescape
func Ypthread_mutex_lock(tls *TLS, m uintptr) (_2 int32)

//go:noescape
func Ypthread_mutex_trylock(tls *TLS, m uintptr) (_2 int32)

//go:noescape
func Ypthread_mutex_unlock(tls *TLS, m uintptr) (_2 int32)

//go:noescape
func Ypthread_mutexattr_destroy(tls *TLS, a uintptr) (_2 int32)

//go:noescape
func Ypthread_mutexattr_init(tls *TLS, a uintptr) (_2 int32)

//go:noescape
func Ypthread_mutexattr_settype(tls *TLS, a uintptr, typ int32) (_3 int32)

//go:noescape
func Ypthread_self(tls *TLS) (_1 uintptr)

//go:noescape
func Ypthread_setcancelstate(tls *TLS, new int32, old uintptr) (_3 int32)

//go:noescape
func Ypthread_setspecific(tls *TLS, k Tpthread_key_t, x uintptr) (_3 int32)

//go:noescape
func Ypthread_sigmask(tls *TLS, now int32, set, old uintptr) (_3 int32)

//go:noescape
func Yptrace(tls *TLS, req int32, va uintptr) (r int64)

//go:noescape
func Yptsname(tls *TLS, fd int32) (r uintptr)

//go:noescape
func Yptsname_r(tls *TLS, fd int32, buf uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Yputc(tls *TLS, c1 int32, f1 uintptr) (r int32)

//go:noescape
func Yputc_unlocked(tls *TLS, c int32, f uintptr) (r int32)

//go:noescape
func Yputchar(tls *TLS, c1 int32) (r int32)

//go:noescape
func Yputchar_unlocked(tls *TLS, c int32) (r int32)

//go:noescape
func Yputenv(tls *TLS, s uintptr) (r int32)

//go:noescape
func Yputgrent(tls *TLS, gr uintptr, f uintptr) (r1 int32)

//go:noescape
func Yputpwent(tls *TLS, pw uintptr, f uintptr) (r int32)

//go:noescape
func Yputs(tls *TLS, s uintptr) (r1 int32)

//go:noescape
func Yputspent(tls *TLS, sp uintptr, f uintptr) (r int32)

//go:noescape
func Ypututline(tls *TLS, ut uintptr) (r uintptr)

//go:noescape
func Ypututxline(tls *TLS, ut uintptr) (r uintptr)

//go:noescape
func Yputw(tls *TLS, _x int32, f uintptr) (r int32)

//go:noescape
func Yputwc(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)

//go:noescape
func Yputwc_unlocked(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)

//go:noescape
func Yputwchar(tls *TLS, c Twchar_t) (r Twint_t)

//go:noescape
func Yputwchar_unlocked(tls *TLS, c Twchar_t) (r Twint_t)

//go:noescape
func Ypwrite(tls *TLS, fd int32, buf uintptr, size Tsize_t, ofs Toff_t) (r Tssize_t)

//go:noescape
func Ypwritev(tls *TLS, fd int32, iov uintptr, count int32, ofs Toff_t) (r Tssize_t)

//go:noescape
func Ypwritev2(tls *TLS, fd int32, iov uintptr, count int32, ofs Toff_t, flags int32) (r Tssize_t)

//go:noescape
func Yqsort(tls *TLS, base uintptr, nel Tsize_t, width Tsize_t, __ccgo_fp_cmp Tcmpfun)

//go:noescape
func __ccgo_abi0_qsort_3(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_qsort_3(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0_qsort_3(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Yqsort_r(tls *TLS, base uintptr, nel Tsize_t, width Tsize_t, __ccgo_fp_cmp Tcmpfun, arg uintptr)

//go:noescape
func __ccgo_abi0_qsort_r_3(_0 *TLS, _1 uintptr, _2 uintptr, _3 uintptr, __ccgo_fp uintptr) (_4 int32)

func __ccgo_abiInternal_qsort_r_3(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr, _3 uintptr) (_4 int32) {
		return __ccgo_abi0_qsort_r_3(_0, _1, _2, _3, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Yquick_exit(tls *TLS, code int32)

//go:noescape
func Yquotactl(tls *TLS, cmd int32, special uintptr, id int32, addr uintptr) (r int32)

//go:noescape
func Yraise(tls *TLS, sig int32) (r int32)

//go:noescape
func Yrand(tls *TLS) (r int32)

//go:noescape
func Yrand_r(tls *TLS, seed uintptr) (r int32)

//go:noescape
func Yrandom(tls *TLS) (r int64)

//go:noescape
func Yrandom_r(t *TLS, buf, result uintptr) (_2 int32)

//go:noescape
func Yread(tls *TLS, fd int32, buf uintptr, count Tsize_t) (r Tssize_t)

//go:noescape
func Yreadahead(tls *TLS, fd int32, pos Toff_t, len1 Tsize_t) (r Tssize_t)

//go:noescape
func Yreaddir(tls *TLS, dir uintptr) (r uintptr)

//go:noescape
func Yreaddir64(tls *TLS, dir uintptr) (r uintptr)

//go:noescape
func Yreaddir_r(tls *TLS, dir uintptr, buf uintptr, result uintptr) (r int32)

//go:noescape
func Yreadlink(tls *TLS, path uintptr, buf uintptr, bufsize Tsize_t) (r1 Tssize_t)

//go:noescape
func Yreadlinkat(tls *TLS, fd int32, path uintptr, buf uintptr, bufsize Tsize_t) (r1 Tssize_t)

//go:noescape
func Yreadv(tls *TLS, fd int32, iov uintptr, count int32) (r Tssize_t)

//go:noescape
func Yrealloc(tls *TLS, p uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Yreallocarray(tls *TLS, ptr uintptr, m Tsize_t, n Tsize_t) (r uintptr)

//go:noescape
func Yrealpath(tls *TLS, filename uintptr, resolved uintptr) (r uintptr)

//go:noescape
func Yreboot(tls *TLS, type1 int32) (r int32)

//go:noescape
func Yrecv(tls *TLS, fd int32, buf uintptr, len1 Tsize_t, flags int32) (r Tssize_t)

//go:noescape
func Yrecvfrom(tls *TLS, fd int32, buf uintptr, len1 Tsize_t, flags int32, addr uintptr, alen uintptr) (r1 Tssize_t)

//go:noescape
func Yrecvmmsg(tls *TLS, fd int32, msgvec uintptr, vlen uint32, flags uint32, timeout uintptr) (r int32)

//go:noescape
func Yrecvmsg(tls *TLS, fd int32, msg uintptr, flags int32) (r2 Tssize_t)

//go:noescape
func Yregcomp(tls *TLS, preg uintptr, regex uintptr, cflags int32) (r int32)

//go:noescape
func Yregerror(tls *TLS, e int32, preg uintptr, buf uintptr, size Tsize_t) (r Tsize_t)

//go:noescape
func Yregexec(tls *TLS, preg uintptr, string1 uintptr, nmatch Tsize_t, pmatch uintptr, eflags int32) (r int32)

//go:noescape
func Yregfree(tls *TLS, preg uintptr)

//go:noescape
func Yremainder(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yremainderf(tls *TLS, x float32, y float32) (r float32)

//go:noescape
func Yremainderl(tls *TLS, x float64, y float64) (r float64)

//go:noescape
func Yremap_file_pages(tls *TLS, addr uintptr, size Tsize_t, prot int32, pgoff Tsize_t, flags int32) (r int32)

//go:noescape
func Yremove(tls *TLS, path uintptr) (r1 int32)

//go:noescape
func Yremovexattr(tls *TLS, path uintptr, name uintptr) (r int32)

//go:noescape
func Yremque(tls *TLS, element uintptr)

//go:noescape
func Yremquo(tls *TLS, x float64, y float64, quo uintptr) (r float64)

//go:noescape
func Yremquof(tls *TLS, x float32, y float32, quo uintptr) (r float32)

//go:noescape
func Yremquol(tls *TLS, x float64, y float64, quo uintptr) (r float64)

//go:noescape
func Yrename(tls *TLS, old uintptr, new1 uintptr) (r int32)

//go:noescape
func Yrenameat(tls *TLS, oldfd int32, old uintptr, newfd int32, new1 uintptr) (r int32)

//go:noescape
func Yrenameat2(t *TLS, olddirfd int32, oldpath uintptr, newdirfd int32, newpath uintptr, flags int32) (_6 int32)

//go:noescape
func Yres_init(tls *TLS) (r int32)

//go:noescape
func Yres_mkquery(tls *TLS, op int32, dname uintptr, class int32, type1 int32, data uintptr, datalen int32, newrr uintptr, buf uintptr, buflen int32) (r int32)

//go:noescape
func Yres_send(tls *TLS, _msg uintptr, _msglen int32, _answer uintptr, _anslen int32) (r int32)

//go:noescape
func Yrewind(tls *TLS, f uintptr)

//go:noescape
func Yrewinddir(tls *TLS, dir uintptr)

//go:noescape
func Yrindex(tls *TLS, s uintptr, c int32) (r uintptr)

//go:noescape
func Yrint(tls *TLS, x float64) (r float64)

//go:noescape
func Yrintf(tls *TLS, x float32) (r float32)

//go:noescape
func Yrintl(tls *TLS, x float64) (r float64)

//go:noescape
func Yrmdir(tls *TLS, path uintptr) (r int32)

//go:noescape
func Yround(tls *TLS, x3 float64) (r float64)

//go:noescape
func Yroundf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Yroundl(tls *TLS, x float64) (r float64)

//go:noescape
func Ysbrk(tls *TLS, inc Tintptr_t) (r uintptr)

//go:noescape
func Yscalb(tls *TLS, x float64, fn float64) (r float64)

//go:noescape
func Yscalbf(tls *TLS, x float32, fn float32) (r float32)

//go:noescape
func Yscalbln(tls *TLS, x float64, n int64) (r float64)

//go:noescape
func Yscalblnf(tls *TLS, x float32, n int64) (r float32)

//go:noescape
func Yscalblnl(tls *TLS, x float64, n int64) (r float64)

//go:noescape
func Yscalbn(tls *TLS, x float64, n int32) (r float64)

//go:noescape
func Yscalbnf(tls *TLS, x float32, n int32) (r float32)

//go:noescape
func Yscalbnl(tls *TLS, x float64, n int32) (r float64)

//go:noescape
func Yscandir(tls *TLS, path uintptr, res uintptr, __ccgo_fp_sel uintptr, __ccgo_fp_cmp uintptr) (r int32)

//go:noescape
func __ccgo_abi0_scandir_2(_0 *TLS, _1 uintptr, __ccgo_fp uintptr) (_2 int32)

func __ccgo_abiInternal_scandir_2(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr) (_2 int32) {
		return __ccgo_abi0_scandir_2(_0, _1, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func __ccgo_abi0_scandir_3(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_scandir_3(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0_scandir_3(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Yscanf(tls *TLS, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Ysched_yield(tls *TLS) (_1 int32)

//go:noescape
func Ysecure_getenv(tls *TLS, name uintptr) (r uintptr)

//go:noescape
func Yseed48(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Yseekdir(tls *TLS, dir uintptr, off int64)

//go:noescape
func Yselect(tls *TLS, n int32, rfds uintptr, wfds uintptr, efds uintptr, tv uintptr) (r int32)

//go:noescape
func Ysemctl(tls *TLS, id int32, num int32, cmd int32, va uintptr) (r1 int32)

//go:noescape
func Ysemget(tls *TLS, key Tkey_t, n int32, fl int32) (r int32)

//go:noescape
func Ysemop(tls *TLS, id int32, buf uintptr, n Tsize_t) (r int32)

//go:noescape
func Ysemtimedop(tls *TLS, id int32, buf uintptr, n Tsize_t, ts uintptr) (r int32)

//go:noescape
func Ysend(tls *TLS, fd int32, buf uintptr, len1 Tsize_t, flags int32) (r Tssize_t)

//go:noescape
func Ysendfile(tls *TLS, out_fd int32, in_fd int32, ofs uintptr, count Tsize_t) (r Tssize_t)

//go:noescape
func Ysendmmsg(tls *TLS, fd int32, msgvec uintptr, vlen uint32, flags uint32) (r1 int32)

//go:noescape
func Ysendmsg(tls *TLS, fd int32, msg uintptr, flags int32) (r1 Tssize_t)

//go:noescape
func Ysendto(tls *TLS, fd int32, buf uintptr, len1 Tsize_t, flags int32, addr uintptr, alen Tsocklen_t) (r1 Tssize_t)

//go:noescape
func Ysetbuf(tls *TLS, f uintptr, buf uintptr)

//go:noescape
func Ysetbuffer(tls *TLS, f uintptr, buf uintptr, size Tsize_t)

//go:noescape
func Ysetdomainname(tls *TLS, name uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Ysetenv(tls *TLS, var1 uintptr, value uintptr, overwrite int32) (r int32)

//go:noescape
func Ysetfsgid(tls *TLS, gid Tgid_t) (r int32)

//go:noescape
func Ysetfsuid(tls *TLS, uid Tuid_t) (r int32)

//go:noescape
func Ysetgid(tls *TLS, gid Tgid_t) (r int32)

//go:noescape
func Ysetgrent(tls *TLS)

//go:noescape
func Ysethostent(tls *TLS, x int32)

//go:noescape
func Ysethostname(tls *TLS, name uintptr, len1 Tsize_t) (r int32)

//go:noescape
func Ysetitimer(tls *TLS, which int32, new1 uintptr, old uintptr) (r1 int32)

//go:noescape
func Ysetjmp(t *TLS, env uintptr) (_2 int32)

//go:noescape
func Ysetkey(tls *TLS, key uintptr)

//go:noescape
func Ysetlinebuf(tls *TLS, f uintptr)

//go:noescape
func Ysetlocale(tls *TLS, cat int32, name uintptr) (r uintptr)

//go:noescape
func Ysetlogmask(tls *TLS, maskpri int32) (r int32)

//go:noescape
func Ysetmntent(tls *TLS, name uintptr, mode uintptr) (r uintptr)

//go:noescape
func Ysetnetent(tls *TLS, x int32)

//go:noescape
func Ysetns(tls *TLS, fd int32, nstype int32) (r int32)

//go:noescape
func Ysetpgid(tls *TLS, pid Tpid_t, pgid Tpid_t) (r int32)

//go:noescape
func Ysetpgrp(tls *TLS) (r Tpid_t)

//go:noescape
func Ysetpriority(tls *TLS, which int32, who Tid_t, prio int32) (r int32)

//go:noescape
func Ysetprotoent(tls *TLS, stayopen int32)

//go:noescape
func Ysetpwent(tls *TLS)

//go:noescape
func Ysetrlimit(tls *TLS, resource int32, rlim uintptr) (r int32)

//go:noescape
func Ysetrlimit64(tls *TLS, resource int32, rlim uintptr) (r int32)

//go:noescape
func Ysetservent(tls *TLS, stayopen int32)

//go:noescape
func Ysetsid(tls *TLS) (r Tpid_t)

//go:noescape
func Ysetsockopt(tls *TLS, fd int32, level int32, optname int32, optval uintptr, optlen Tsocklen_t) (r2 int32)

//go:noescape
func Ysetspent(tls *TLS)

//go:noescape
func Ysetstate(tls *TLS, state uintptr) (r uintptr)

//go:noescape
func Ysettimeofday(tls *TLS, tv uintptr, tz uintptr) (r int32)

//go:noescape
func Ysetuid(tls *TLS, uid Tuid_t) (r int32)

//go:noescape
func Ysetusershell(tls *TLS)

//go:noescape
func Ysetutent(tls *TLS)

//go:noescape
func Ysetutxent(tls *TLS)

//go:noescape
func Ysetvbuf(tls *TLS, f uintptr, buf uintptr, type1 int32, size Tsize_t) (r int32)

//go:noescape
func Ysetxattr(tls *TLS, path uintptr, name uintptr, value uintptr, size Tsize_t, flags int32) (r int32)

//go:noescape
func Yshm_open(tls *TLS, name uintptr, flag int32, mode Tmode_t) (r int32)

//go:noescape
func Yshm_unlink(tls *TLS, name uintptr) (r int32)

//go:noescape
func Yshmat(tls *TLS, id int32, addr uintptr, flag int32) (r uintptr)

//go:noescape
func Yshmctl(tls *TLS, id int32, cmd int32, buf uintptr) (r1 int32)

//go:noescape
func Yshmdt(tls *TLS, addr uintptr) (r int32)

//go:noescape
func Yshmget(tls *TLS, key Tkey_t, size Tsize_t, flag int32) (r int32)

//go:noescape
func Yshutdown(tls *TLS, fd int32, how int32) (r1 int32)

//go:noescape
func Ysigaction(tls *TLS, sig int32, sa uintptr, old uintptr) (r int32)

//go:noescape
func Ysigaddset(tls *TLS, set uintptr, sig int32) (r int32)

//go:noescape
func Ysigaltstack(tls *TLS, ss uintptr, old uintptr) (r int32)

//go:noescape
func Ysigandset(tls *TLS, dest uintptr, left uintptr, right uintptr) (r1 int32)

//go:noescape
func Ysigdelset(tls *TLS, set uintptr, sig int32) (r int32)

//go:noescape
func Ysigemptyset(tls *TLS, set uintptr) (r int32)

//go:noescape
func Ysigfillset(tls *TLS, set uintptr) (r int32)

//go:noescape
func Ysigisemptyset(tls *TLS, set uintptr) (r int32)

//go:noescape
func Ysigismember(tls *TLS, set uintptr, sig int32) (r int32)

//go:noescape
func Ysignal(tls *TLS, signum int32, handler uintptr) (r uintptr)

//go:noescape
func Ysignalfd(tls *TLS, fd int32, sigs uintptr, flags int32) (r int32)

//go:noescape
func Ysignificand(tls *TLS, x float64) (r float64)

//go:noescape
func Ysignificandf(tls *TLS, x float32) (r float32)

//go:noescape
func Ysigorset(tls *TLS, dest uintptr, left uintptr, right uintptr) (r1 int32)

//go:noescape
func Ysigpending(tls *TLS, set uintptr) (r int32)

//go:noescape
func Ysigprocmask(tls *TLS, how int32, set uintptr, old uintptr) (r1 int32)

//go:noescape
func Ysigqueue(tls *TLS, pid Tpid_t, sig int32, value Tsigval) (r1 int32)

//go:noescape
func Ysigsuspend(tls *TLS, mask uintptr) (r int32)

//go:noescape
func Ysigtimedwait(tls *TLS, mask uintptr, si uintptr, timeout uintptr) (r int32)

//go:noescape
func Ysigwait(tls *TLS, mask uintptr, sig uintptr) (r int32)

//go:noescape
func Ysigwaitinfo(tls *TLS, mask uintptr, si uintptr) (r int32)

//go:noescape
func Ysin(tls *TLS, x3 float64) (r float64)

//go:noescape
func Ysincos(tls *TLS, x3 float64, sin uintptr, cos uintptr)

//go:noescape
func Ysincosf(tls *TLS, x3 float32, sin uintptr, cos uintptr)

//go:noescape
func Ysincosl(tls *TLS, x float64, sin uintptr, cos uintptr)

//go:noescape
func Ysinf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Ysinh(tls *TLS, x float64) (r float64)

//go:noescape
func Ysinhf(tls *TLS, x float32) (r float32)

//go:noescape
func Ysinhl(tls *TLS, x float64) (r float64)

//go:noescape
func Ysinl(tls *TLS, x float64) (r float64)

//go:noescape
func Ysleep(tls *TLS, seconds uint32) (r uint32)

//go:noescape
func Ysnprintf(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Ysockatmark(tls *TLS, s int32) (r int32)

//go:noescape
func Ysocket(tls *TLS, domain int32, type1 int32, protocol int32) (r1 int32)

//go:noescape
func Ysocketpair(tls *TLS, domain int32, type1 int32, protocol int32, fd uintptr) (r2 int32)

//go:noescape
func Ysplice(tls *TLS, fd_in int32, off_in uintptr, fd_out int32, off_out uintptr, len1 Tsize_t, flags uint32) (r Tssize_t)

//go:noescape
func Ysprintf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Ysqrt(tls *TLS, x1 float64) (r1 float64)

//go:noescape
func Ysqrtf(tls *TLS, x1 float32) (r1 float32)

//go:noescape
func Ysqrtl(tls *TLS, x float64) (r float64)

//go:noescape
func Ysrand(tls *TLS, s uint32)

//go:noescape
func Ysrand48(tls *TLS, seed int64)

//go:noescape
func Ysrandom(tls *TLS, seed uint32)

//go:noescape
func Ysscanf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Ystat(tls *TLS, path uintptr, buf uintptr) (r int32)

//go:noescape
func Ystat64(tls *TLS, path uintptr, buf uintptr) (r int32)

//go:noescape
func Ystatvfs(tls *TLS, path uintptr, buf uintptr) (r int32)

//go:noescape
func Ystatx(tls *TLS, dirfd int32, path uintptr, flags int32, mask uint32, stx uintptr) (r int32)

//go:noescape
func Ystime(tls *TLS, t uintptr) (r int32)

//go:noescape
func Ystpcpy(tls *TLS, d uintptr, s uintptr) (r uintptr)

//go:noescape
func Ystpncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ystrcasecmp(tls *TLS, _l uintptr, _r uintptr) (r1 int32)

//go:noescape
func Ystrcasecmp_l(tls *TLS, l uintptr, r uintptr, loc Tlocale_t) (r1 int32)

//go:noescape
func Ystrcasestr(tls *TLS, h uintptr, n uintptr) (r uintptr)

//go:noescape
func Ystrcat(tls *TLS, dest uintptr, src uintptr) (r uintptr)

//go:noescape
func Ystrchr(tls *TLS, s uintptr, c int32) (r1 uintptr)

//go:noescape
func Ystrchrnul(tls *TLS, s uintptr, c int32) (r uintptr)

//go:noescape
func Ystrcmp(tls *TLS, l uintptr, r uintptr) (r1 int32)

//go:noescape
func Ystrcoll(tls *TLS, l uintptr, r uintptr) (r1 int32)

//go:noescape
func Ystrcoll_l(tls *TLS, l uintptr, r uintptr, loc Tlocale_t) (r1 int32)

//go:noescape
func Ystrcpy(tls *TLS, dest uintptr, src uintptr) (r uintptr)

//go:noescape
func Ystrcspn(tls *TLS, s uintptr, c uintptr) (r Tsize_t)

//go:noescape
func Ystrdup(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Ystrerror(tls *TLS, e int32) (r uintptr)

//go:noescape
func Ystrerror_l(tls *TLS, e int32, loc Tlocale_t) (r uintptr)

//go:noescape
func Ystrerror_r(tls *TLS, err int32, buf uintptr, buflen Tsize_t) (r int32)

//go:noescape
func Ystrfmon(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, va uintptr) (r Tssize_t)

//go:noescape
func Ystrfmon_l(tls *TLS, s uintptr, n Tsize_t, loc Tlocale_t, fmt uintptr, va uintptr) (r Tssize_t)

//go:noescape
func Ystrftime(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr) (r Tsize_t)

//go:noescape
func Ystrftime_l(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr, loc Tlocale_t) (r Tsize_t)

//go:noescape
func Ystrlcat(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r Tsize_t)

//go:noescape
func Ystrlcpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r Tsize_t)

//go:noescape
func Ystrlen(tls *TLS, s uintptr) (r Tsize_t)

//go:noescape
func Ystrncasecmp(tls *TLS, _l uintptr, _r uintptr, n Tsize_t) (r1 int32)

//go:noescape
func Ystrncasecmp_l(tls *TLS, l uintptr, r uintptr, n Tsize_t, loc Tlocale_t) (r1 int32)

//go:noescape
func Ystrncat(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ystrncmp(tls *TLS, _l uintptr, _r uintptr, n Tsize_t) (r1 int32)

//go:noescape
func Ystrncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ystrndup(tls *TLS, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ystrnlen(tls *TLS, s uintptr, n Tsize_t) (r Tsize_t)

//go:noescape
func Ystrpbrk(tls *TLS, s uintptr, b uintptr) (r uintptr)

//go:noescape
func Ystrptime(tls *TLS, s uintptr, f uintptr, tm uintptr) (r uintptr)

//go:noescape
func Ystrrchr(tls *TLS, s uintptr, c int32) (r uintptr)

//go:noescape
func Ystrsep(tls *TLS, str uintptr, sep uintptr) (r uintptr)

//go:noescape
func Ystrsignal(tls *TLS, signum int32) (r uintptr)

//go:noescape
func Ystrspn(tls *TLS, s uintptr, c uintptr) (r Tsize_t)

//go:noescape
func Ystrstr(tls *TLS, h uintptr, n uintptr) (r uintptr)

//go:noescape
func Ystrtod(tls *TLS, s uintptr, p uintptr) (r float64)

//go:noescape
func Ystrtod_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float64)

//go:noescape
func Ystrtof(tls *TLS, s uintptr, p uintptr) (r float32)

//go:noescape
func Ystrtof_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float32)

//go:noescape
func Ystrtoimax(tls *TLS, s uintptr, p uintptr, base int32) (r Tintmax_t)

//go:noescape
func Ystrtok(tls *TLS, s uintptr, sep uintptr) (r uintptr)

//go:noescape
func Ystrtok_r(tls *TLS, s uintptr, sep uintptr, p uintptr) (r uintptr)

//go:noescape
func Ystrtol(tls *TLS, s uintptr, p uintptr, base int32) (r int64)

//go:noescape
func Ystrtold(tls *TLS, s uintptr, p uintptr) (r float64)

//go:noescape
func Ystrtold_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float64)

//go:noescape
func Ystrtoll(tls *TLS, s uintptr, p uintptr, base int32) (r int64)

//go:noescape
func Ystrtoul(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)

//go:noescape
func Ystrtoull(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)

//go:noescape
func Ystrtoumax(tls *TLS, s uintptr, p uintptr, base int32) (r Tuintmax_t)

//go:noescape
func Ystrverscmp(tls *TLS, l0 uintptr, r0 uintptr) (r1 int32)

//go:noescape
func Ystrxfrm(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r Tsize_t)

//go:noescape
func Ystrxfrm_l(tls *TLS, dest uintptr, src uintptr, n Tsize_t, loc Tlocale_t) (r Tsize_t)

//go:noescape
func Yswab(tls *TLS, _src uintptr, _dest uintptr, n Tssize_t)

//go:noescape
func Yswapoff(tls *TLS, path uintptr) (r int32)

//go:noescape
func Yswapon(tls *TLS, path uintptr, flags int32) (r int32)

//go:noescape
func Yswprintf(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Yswscanf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Ysymlink(tls *TLS, existing uintptr, new1 uintptr) (r int32)

//go:noescape
func Ysymlinkat(tls *TLS, existing uintptr, fd int32, new1 uintptr) (r int32)

//go:noescape
func Ysync(tls *TLS)

//go:noescape
func Ysync_file_range(tls *TLS, fd int32, pos Toff_t, len1 Toff_t, flags uint32) (r int32)

//go:noescape
func Ysyncfs(tls *TLS, fd int32) (r int32)

//go:noescape
func Ysyscall(tls *TLS, n int64, va uintptr) (r int64)

//go:noescape
func Ysysconf(tls *TLS, name int32) (r int64)

//go:noescape
func Ysysctlbyname(t *TLS, name, oldp, oldlenp, newp uintptr, newlen Tsize_t) (_3 int32)

//go:noescape
func Ysysinfo(tls *TLS, info uintptr) (r int32)

//go:noescape
func Ysyslog(tls *TLS, priority int32, message uintptr, va uintptr)

//go:noescape
func Ysystem(t *TLS, command uintptr) (_2 int32)

//go:noescape
func Ytan(tls *TLS, x3 float64) (r float64)

//go:noescape
func Ytanf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Ytanh(tls *TLS, x3 float64) (r float64)

//go:noescape
func Ytanhf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Ytanhl(tls *TLS, x float64) (r float64)

//go:noescape
func Ytanl(tls *TLS, x float64) (r float64)

//go:noescape
func Ytcdrain(tls *TLS, fd int32) (r int32)

//go:noescape
func Ytcflow(tls *TLS, fd int32, action int32) (r int32)

//go:noescape
func Ytcflush(tls *TLS, fd int32, queue int32) (r int32)

//go:noescape
func Ytcgetattr(tls *TLS, fd int32, tio uintptr) (r int32)

//go:noescape
func Ytcgetpgrp(tls *TLS, fd int32) (r Tpid_t)

//go:noescape
func Ytcgetsid(tls *TLS, fd int32) (r Tpid_t)

//go:noescape
func Ytcgetwinsize(tls *TLS, fd int32, wsz uintptr) (r int32)

//go:noescape
func Ytcsendbreak(tls *TLS, fd int32, dur int32) (r int32)

//go:noescape
func Ytcsetattr(tls *TLS, fd int32, act int32, tio uintptr) (r int32)

//go:noescape
func Ytcsetpgrp(tls *TLS, fd int32, pgrp Tpid_t) (r int32)

//go:noescape
func Ytcsetwinsize(tls *TLS, fd int32, wsz uintptr) (r int32)

//go:noescape
func Ytdelete(tls *TLS, key uintptr, rootp uintptr, __ccgo_fp_cmp uintptr) (r uintptr)

//go:noescape
func __ccgo_abi0_tdelete_2(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_tdelete_2(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0_tdelete_2(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Ytdestroy(tls *TLS, root uintptr, __ccgo_fp_freekey uintptr)

//go:noescape
func __ccgo_abi0_tdestroy_1(_0 *TLS, _1 uintptr, __ccgo_fp uintptr)

func __ccgo_abiInternal_tdestroy_1(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr) {
		__ccgo_abi0_tdestroy_1(_0, _1, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Ytee(tls *TLS, src int32, dest int32, len1 Tsize_t, flags uint32) (r Tssize_t)

//go:noescape
func Ytelldir(tls *TLS, dir uintptr) (r int64)

//go:noescape
func Ytempnam(tls *TLS, dir uintptr, pfx uintptr) (r1 uintptr)

//go:noescape
func Ytextdomain(tls *TLS, domainname uintptr) (r uintptr)

//go:noescape
func Ytfind(tls *TLS, key uintptr, rootp uintptr, __ccgo_fp_cmp uintptr) (r uintptr)

//go:noescape
func __ccgo_abi0_tfind_2(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_tfind_2(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0_tfind_2(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Ytgamma(tls *TLS, x3 float64) (r1 float64)

//go:noescape
func Ytgammaf(tls *TLS, x float32) (r float32)

//go:noescape
func Ytgammal(tls *TLS, x float64) (r float64)

//go:noescape
func Ytime(tls *TLS, t uintptr) (r Ttime_t)

//go:noescape
func Ytimegm(tls *TLS, tm uintptr) (r Ttime_t)

//go:noescape
func Ytimer_delete(tls *TLS, t Ttimer_t) (r int32)

//go:noescape
func Ytimer_getoverrun(tls *TLS, t Ttimer_t) (r int32)

//go:noescape
func Ytimer_gettime(tls *TLS, t Ttimer_t, val uintptr) (r int32)

//go:noescape
func Ytimer_settime(tls *TLS, t Ttimer_t, flags int32, val uintptr, old uintptr) (r int32)

//go:noescape
func Ytimerfd_create(tls *TLS, clockid int32, flags int32) (r int32)

//go:noescape
func Ytimerfd_gettime(tls *TLS, fd int32, cur uintptr) (r int32)

//go:noescape
func Ytimerfd_settime(tls *TLS, fd int32, flags int32, new1 uintptr, old uintptr) (r int32)

//go:noescape
func Ytimes(tls *TLS, tms uintptr) (r Tclock_t)

//go:noescape
func Ytimespec_get(tls *TLS, ts uintptr, base int32) (r int32)

//go:noescape
func Ytmpfile(tls *TLS) (r uintptr)

//go:noescape
func Ytmpnam(tls *TLS, buf uintptr) (r1 uintptr)

//go:noescape
func Ytoascii(tls *TLS, c int32) (r int32)

//go:noescape
func Ytolower(tls *TLS, c int32) (r int32)

//go:noescape
func Ytolower_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Ytoupper(tls *TLS, c int32) (r int32)

//go:noescape
func Ytoupper_l(tls *TLS, c int32, l Tlocale_t) (r int32)

//go:noescape
func Ytowctrans(tls *TLS, wc Twint_t, trans Twctrans_t) (r Twint_t)

//go:noescape
func Ytowctrans_l(tls *TLS, c Twint_t, t Twctrans_t, l Tlocale_t) (r Twint_t)

//go:noescape
func Ytowlower(tls *TLS, wc Twint_t) (r Twint_t)

//go:noescape
func Ytowlower_l(tls *TLS, c Twint_t, l Tlocale_t) (r Twint_t)

//go:noescape
func Ytowupper(tls *TLS, wc Twint_t) (r Twint_t)

//go:noescape
func Ytowupper_l(tls *TLS, c Twint_t, l Tlocale_t) (r Twint_t)

//go:noescape
func Ytrunc(tls *TLS, x3 float64) (r float64)

//go:noescape
func Ytruncate(tls *TLS, path uintptr, length Toff_t) (r int32)

//go:noescape
func Ytruncf(tls *TLS, x3 float32) (r float32)

//go:noescape
func Ytruncl(tls *TLS, x float64) (r float64)

//go:noescape
func Ytsearch(tls *TLS, key uintptr, rootp uintptr, __ccgo_fp_cmp uintptr) (r1 uintptr)

//go:noescape
func __ccgo_abi0_tsearch_2(_0 *TLS, _1 uintptr, _2 uintptr, __ccgo_fp uintptr) (_3 int32)

func __ccgo_abiInternal_tsearch_2(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 uintptr) (_3 int32) {
		return __ccgo_abi0_tsearch_2(_0, _1, _2, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Yttyname(tls *TLS, fd int32) (r uintptr)

//go:noescape
func Yttyname_r(tls *TLS, fd int32, name uintptr, size Tsize_t) (r int32)

//go:noescape
func Ytwalk(tls *TLS, root uintptr, __ccgo_fp_action uintptr)

//go:noescape
func __ccgo_abi0_twalk_1(_0 *TLS, _1 uintptr, _2 int32, _3 int32, __ccgo_fp uintptr)

func __ccgo_abiInternal_twalk_1(tls *TLS, dest, abi0CodePtr uintptr) {
	f := func(_0 *TLS, _1 uintptr, _2 int32, _3 int32) {
		__ccgo_abi0_twalk_1(_0, _1, _2, _3, abi0CodePtr)
	}
	*(*[2]uintptr)(unsafe.Pointer(dest)) = *(*[2]uintptr)(unsafe.Pointer(*(*uintptr)(unsafe.Pointer(&f))))
}

//go:noescape
func Ytzset(tls *TLS)

//go:noescape
func Yualarm(tls *TLS, value uint32, interval uint32) (r uint32)

//go:noescape
func Yulckpwdf(tls *TLS) (r int32)

//go:noescape
func Yulimit(tls *TLS, cmd int32, va uintptr) (r int64)

//go:noescape
func Yumask(tls *TLS, mode Tmode_t) (r Tmode_t)

//go:noescape
func Yumount(tls *TLS, special uintptr) (r int32)

//go:noescape
func Yumount2(tls *TLS, special uintptr, flags int32) (r int32)

//go:noescape
func Yuname(tls *TLS, uts uintptr) (r int32)

//go:noescape
func Yungetc(tls *TLS, c int32, f uintptr) (r int32)

//go:noescape
func Yungetwc(tls *TLS, c Twint_t, f uintptr) (r Twint_t)

//go:noescape
func Yunlink(tls *TLS, path uintptr) (r int32)

//go:noescape
func Yunlinkat(tls *TLS, fd int32, path uintptr, flag int32) (r int32)

//go:noescape
func Yunlockpt(tls *TLS, fd int32) (r int32)

//go:noescape
func Yunsetenv(tls *TLS, name uintptr) (r int32)

//go:noescape
func Yunshare(tls *TLS, flags int32) (r int32)

//go:noescape
func Yupdwtmp(tls *TLS, f uintptr, u uintptr)

//go:noescape
func Yupdwtmpx(tls *TLS, f uintptr, u uintptr)

//go:noescape
func Yuselocale(tls *TLS, new1 Tlocale_t) (r Tlocale_t)

//go:noescape
func Yusleep(tls *TLS, useconds uint32) (r int32)

//go:noescape
func Yutime(tls *TLS, path uintptr, times uintptr) (r int32)

//go:noescape
func Yutimensat(tls *TLS, fd int32, path uintptr, times uintptr, flags int32) (r1 int32)

//go:noescape
func Yutimes(tls *TLS, path uintptr, times uintptr) (r int32)

//go:noescape
func Yuuid_copy(t *TLS, dst, src uintptr)

//go:noescape
func Yuuid_generate_random(t *TLS, out uintptr)

//go:noescape
func Yuuid_parse(t *TLS, in uintptr, uu uintptr) (_3 int32)

//go:noescape
func Yuuid_unparse(t *TLS, uu, out uintptr)

//go:noescape
func Yvasprintf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvdprintf(tls *TLS, fd int32, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yverr(tls *TLS, status int32, fmt uintptr, ap Tva_list)

//go:noescape
func Yverrx(tls *TLS, status int32, fmt uintptr, ap Tva_list)

//go:noescape
func Yversionsort(tls *TLS, a uintptr, b uintptr) (r int32)

//go:noescape
func Yvfork(tls *TLS) (r Tpid_t)

//go:noescape
func Yvfprintf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvfscanf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvfwprintf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvfwscanf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvhangup(tls *TLS) (r int32)

//go:noescape
func Yvmsplice(tls *TLS, fd int32, iov uintptr, cnt Tsize_t, flags uint32) (r Tssize_t)

//go:noescape
func Yvprintf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvscanf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvsnprintf(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvsprintf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvsscanf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvswprintf(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, ap Tva_list) (r1 int32)

//go:noescape
func Yvswscanf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvwarn(tls *TLS, fmt uintptr, ap Tva_list)

//go:noescape
func Yvwarnx(tls *TLS, fmt uintptr, ap Tva_list)

//go:noescape
func Yvwprintf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Yvwscanf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)

//go:noescape
func Ywait(tls *TLS, status uintptr) (r Tpid_t)

//go:noescape
func Ywait3(tls *TLS, status uintptr, options int32, usage uintptr) (r Tpid_t)

//go:noescape
func Ywait4(tls *TLS, pid Tpid_t, status uintptr, options int32, ru uintptr) (r1 Tpid_t)

//go:noescape
func Ywaitid(tls *TLS, type1 Tidtype_t, id Tid_t, info uintptr, options int32) (r int32)

//go:noescape
func Ywaitpid(tls *TLS, pid Tpid_t, status uintptr, options int32) (r Tpid_t)

//go:noescape
func Ywarn(tls *TLS, fmt uintptr, va uintptr)

//go:noescape
func Ywarnx(tls *TLS, fmt uintptr, va uintptr)

//go:noescape
func Ywcpcpy(tls *TLS, d uintptr, s uintptr) (r uintptr)

//go:noescape
func Ywcpncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ywcrtomb(tls *TLS, s uintptr, wc Twchar_t, st uintptr) (r Tsize_t)

//go:noescape
func Ywcscasecmp(tls *TLS, l uintptr, r uintptr) (r1 int32)

//go:noescape
func Ywcscasecmp_l(tls *TLS, l uintptr, r uintptr, locale Tlocale_t) (r1 int32)

//go:noescape
func Ywcscat(tls *TLS, dest uintptr, src uintptr) (r uintptr)

//go:noescape
func Ywcschr(tls *TLS, s uintptr, c Twchar_t) (r uintptr)

//go:noescape
func Ywcscmp(tls *TLS, l uintptr, r uintptr) (r1 int32)

//go:noescape
func Ywcscoll(tls *TLS, l uintptr, r uintptr) (r1 int32)

//go:noescape
func Ywcscoll_l(tls *TLS, l uintptr, r uintptr, locale Tlocale_t) (r1 int32)

//go:noescape
func Ywcscpy(tls *TLS, d uintptr, s uintptr) (r uintptr)

//go:noescape
func Ywcscspn(tls *TLS, s uintptr, c uintptr) (r Tsize_t)

//go:noescape
func Ywcsdup(tls *TLS, s uintptr) (r uintptr)

//go:noescape
func Ywcsftime(tls *TLS, wcs uintptr, n Tsize_t, f uintptr, tm uintptr) (r Tsize_t)

//go:noescape
func Ywcsftime_l(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr, loc Tlocale_t) (r Tsize_t)

//go:noescape
func Ywcslen(tls *TLS, s uintptr) (r Tsize_t)

//go:noescape
func Ywcsncasecmp(tls *TLS, l uintptr, r uintptr, n Tsize_t) (r1 int32)

//go:noescape
func Ywcsncasecmp_l(tls *TLS, l uintptr, r uintptr, n Tsize_t, locale Tlocale_t) (r1 int32)

//go:noescape
func Ywcsncat(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ywcsncmp(tls *TLS, l uintptr, r uintptr, n Tsize_t) (r1 int32)

//go:noescape
func Ywcsncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ywcsnlen(tls *TLS, s uintptr, n Tsize_t) (r Tsize_t)

//go:noescape
func Ywcsnrtombs(tls *TLS, dst uintptr, wcs uintptr, wn Tsize_t, n Tsize_t, st uintptr) (r Tsize_t)

//go:noescape
func Ywcspbrk(tls *TLS, s uintptr, b uintptr) (r uintptr)

//go:noescape
func Ywcsrchr(tls *TLS, s uintptr, c Twchar_t) (r uintptr)

//go:noescape
func Ywcsrtombs(tls *TLS, s uintptr, ws uintptr, n Tsize_t, st uintptr) (r Tsize_t)

//go:noescape
func Ywcsspn(tls *TLS, s uintptr, c uintptr) (r Tsize_t)

//go:noescape
func Ywcsstr(tls *TLS, h uintptr, n uintptr) (r uintptr)

//go:noescape
func Ywcstod(tls *TLS, s uintptr, p uintptr) (r float64)

//go:noescape
func Ywcstof(tls *TLS, s uintptr, p uintptr) (r float32)

//go:noescape
func Ywcstoimax(tls *TLS, s uintptr, p uintptr, base int32) (r Tintmax_t)

//go:noescape
func Ywcstok(tls *TLS, s uintptr, sep uintptr, p uintptr) (r uintptr)

//go:noescape
func Ywcstol(tls *TLS, s uintptr, p uintptr, base int32) (r int64)

//go:noescape
func Ywcstold(tls *TLS, s uintptr, p uintptr) (r float64)

//go:noescape
func Ywcstoll(tls *TLS, s uintptr, p uintptr, base int32) (r int64)

//go:noescape
func Ywcstombs(tls *TLS, s uintptr, ws uintptr, n Tsize_t) (r Tsize_t)

//go:noescape
func Ywcstoul(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)

//go:noescape
func Ywcstoull(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)

//go:noescape
func Ywcstoumax(tls *TLS, s uintptr, p uintptr, base int32) (r Tuintmax_t)

//go:noescape
func Ywcswcs(tls *TLS, haystack uintptr, needle uintptr) (r uintptr)

//go:noescape
func Ywcswidth(tls *TLS, wcs uintptr, n Tsize_t) (r int32)

//go:noescape
func Ywcsxfrm(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r Tsize_t)

//go:noescape
func Ywcsxfrm_l(tls *TLS, dest uintptr, src uintptr, n Tsize_t, loc Tlocale_t) (r Tsize_t)

//go:noescape
func Ywctob(tls *TLS, c Twint_t) (r int32)

//go:noescape
func Ywctomb(tls *TLS, s uintptr, wc Twchar_t) (r int32)

//go:noescape
func Ywctrans(tls *TLS, class uintptr) (r Twctrans_t)

//go:noescape
func Ywctrans_l(tls *TLS, s uintptr, l Tlocale_t) (r Twctrans_t)

//go:noescape
func Ywctype(tls *TLS, s uintptr) (r Twctype_t)

//go:noescape
func Ywctype_l(tls *TLS, s uintptr, l Tlocale_t) (r Twctype_t)

//go:noescape
func Ywcwidth(tls *TLS, wc Twchar_t) (r int32)

//go:noescape
func Ywmemchr(tls *TLS, s uintptr, c Twchar_t, n Tsize_t) (r uintptr)

//go:noescape
func Ywmemcmp(tls *TLS, l uintptr, r uintptr, n Tsize_t) (r1 int32)

//go:noescape
func Ywmemcpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ywmemmove(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)

//go:noescape
func Ywmemset(tls *TLS, d uintptr, c Twchar_t, n Tsize_t) (r uintptr)

//go:noescape
func Ywprintf(tls *TLS, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Ywrite(tls *TLS, fd int32, buf uintptr, count Tsize_t) (r Tssize_t)

//go:noescape
func Ywritev(tls *TLS, fd int32, iov uintptr, count int32) (r Tssize_t)

//go:noescape
func Ywscanf(tls *TLS, fmt uintptr, va uintptr) (r int32)

//go:noescape
func Yy0(tls *TLS, x float64) (r float64)

//go:noescape
func Yy0f(tls *TLS, x float32) (r float32)

//go:noescape
func Yy1(tls *TLS, x float64) (r float64)

//go:noescape
func Yy1f(tls *TLS, x float32) (r float32)

//go:noescape
func Yyn(tls *TLS, n int32, x float64) (r float64)

//go:noescape
func Yynf(tls *TLS, n int32, x float32) (r float32)
