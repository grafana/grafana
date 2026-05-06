// Code generated for linux/amd64 by 'qbecc --abi0wrap .', DO NOT EDIT.

#include "funcdata.h"
#include "textflag.h"

// func Y_Exit(tls *TLS, ec int32)
TEXT ·Y_Exit(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ec+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X_Exit(SB)
	RET

// func Y_IO_feof_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Y_IO_feof_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X_IO_feof_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y_IO_ferror_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Y_IO_ferror_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X_IO_ferror_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y_IO_getc(tls *TLS, f1 uintptr) (r int32)
TEXT ·Y_IO_getc(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X_IO_getc(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y_IO_getc_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Y_IO_getc_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X_IO_getc_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y_IO_putc(tls *TLS, c1 int32, f1 uintptr) (r int32)
TEXT ·Y_IO_putc(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c1+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X_IO_putc(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y_IO_putc_unlocked(tls *TLS, c int32, f uintptr) (r int32)
TEXT ·Y_IO_putc_unlocked(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X_IO_putc_unlocked(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y___errno_location(tls *TLS) (r uintptr)
TEXT ·Y___errno_location(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X___errno_location(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__aio_close(tls *TLS, fd int32) (_2 int32)
TEXT ·Y__aio_close(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__aio_close(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__asctime_r(tls *TLS, tm uintptr, buf uintptr) (r uintptr)
TEXT ·Y__asctime_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tm+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__asctime_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__assert_fail(tls *TLS, expr uintptr, file uintptr, line int32, func1 uintptr)
TEXT ·Y__assert_fail(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ expr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ file+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL line+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ func1+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__assert_fail(SB)
	RET

// func Y__atomic_compare_exchangeInt16(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)
TEXT ·Y__atomic_compare_exchangeInt16(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL weak+32(FP), AX
	MOVL AX, 32(SP)
	MOVL success+36(FP), AX
	MOVL AX, 36(SP)
	MOVL failure+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__atomic_compare_exchangeInt16(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__atomic_compare_exchangeInt32(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)
TEXT ·Y__atomic_compare_exchangeInt32(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL weak+32(FP), AX
	MOVL AX, 32(SP)
	MOVL success+36(FP), AX
	MOVL AX, 36(SP)
	MOVL failure+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__atomic_compare_exchangeInt32(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__atomic_compare_exchangeInt64(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)
TEXT ·Y__atomic_compare_exchangeInt64(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL weak+32(FP), AX
	MOVL AX, 32(SP)
	MOVL success+36(FP), AX
	MOVL AX, 36(SP)
	MOVL failure+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__atomic_compare_exchangeInt64(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__atomic_compare_exchangeInt8(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)
TEXT ·Y__atomic_compare_exchangeInt8(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL weak+32(FP), AX
	MOVL AX, 32(SP)
	MOVL success+36(FP), AX
	MOVL AX, 36(SP)
	MOVL failure+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__atomic_compare_exchangeInt8(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__atomic_compare_exchangeUint16(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)
TEXT ·Y__atomic_compare_exchangeUint16(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL weak+32(FP), AX
	MOVL AX, 32(SP)
	MOVL success+36(FP), AX
	MOVL AX, 36(SP)
	MOVL failure+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__atomic_compare_exchangeUint16(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__atomic_compare_exchangeUint32(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)
TEXT ·Y__atomic_compare_exchangeUint32(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL weak+32(FP), AX
	MOVL AX, 32(SP)
	MOVL success+36(FP), AX
	MOVL AX, 36(SP)
	MOVL failure+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__atomic_compare_exchangeUint32(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__atomic_compare_exchangeUint64(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)
TEXT ·Y__atomic_compare_exchangeUint64(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL weak+32(FP), AX
	MOVL AX, 32(SP)
	MOVL success+36(FP), AX
	MOVL AX, 36(SP)
	MOVL failure+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__atomic_compare_exchangeUint64(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__atomic_compare_exchangeUint8(t *TLS, ptr, expected, desired uintptr, weak, success, failure int32) (_3 int32)
TEXT ·Y__atomic_compare_exchangeUint8(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL weak+32(FP), AX
	MOVL AX, 32(SP)
	MOVL success+36(FP), AX
	MOVL AX, 36(SP)
	MOVL failure+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__atomic_compare_exchangeUint8(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__atomic_exchangeInt16(t *TLS, ptr, val, ret uintptr, _ int32)
TEXT ·Y__atomic_exchangeInt16(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ret+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__atomic_exchangeInt16(SB)
	RET

// func Y__atomic_exchangeInt32(t *TLS, ptr, val, ret uintptr, _ int32)
TEXT ·Y__atomic_exchangeInt32(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ret+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__atomic_exchangeInt32(SB)
	RET

// func Y__atomic_exchangeInt64(t *TLS, ptr, val, ret uintptr, _ int32)
TEXT ·Y__atomic_exchangeInt64(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ret+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__atomic_exchangeInt64(SB)
	RET

// func Y__atomic_exchangeInt8(t *TLS, ptr, val, ret uintptr, _ int32)
TEXT ·Y__atomic_exchangeInt8(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ret+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__atomic_exchangeInt8(SB)
	RET

// func Y__atomic_exchangeUint16(t *TLS, ptr, val, ret uintptr, _ int32)
TEXT ·Y__atomic_exchangeUint16(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ret+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__atomic_exchangeUint16(SB)
	RET

// func Y__atomic_exchangeUint32(t *TLS, ptr, val, ret uintptr, _ int32)
TEXT ·Y__atomic_exchangeUint32(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ret+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__atomic_exchangeUint32(SB)
	RET

// func Y__atomic_exchangeUint64(t *TLS, ptr, val, ret uintptr, _ int32)
TEXT ·Y__atomic_exchangeUint64(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ret+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__atomic_exchangeUint64(SB)
	RET

// func Y__atomic_exchangeUint8(t *TLS, ptr, val, ret uintptr, _ int32)
TEXT ·Y__atomic_exchangeUint8(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ret+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__atomic_exchangeUint8(SB)
	RET

// func Y__atomic_fetch_addInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__atomic_fetch_addInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_addInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_addInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__atomic_fetch_addInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_addInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_addInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__atomic_fetch_addInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_addInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_addInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__atomic_fetch_addInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_addInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_addUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__atomic_fetch_addUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_addUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_addUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__atomic_fetch_addUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_addUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_addUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__atomic_fetch_addUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_addUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_addUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__atomic_fetch_addUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_addUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_andInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__atomic_fetch_andInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_andInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_andInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__atomic_fetch_andInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_andInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_andInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__atomic_fetch_andInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_andInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_andInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__atomic_fetch_andInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_andInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_andUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__atomic_fetch_andUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_andUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_andUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__atomic_fetch_andUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_andUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_andUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__atomic_fetch_andUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_andUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_andUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__atomic_fetch_andUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_andUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_orInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__atomic_fetch_orInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_orInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_orInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__atomic_fetch_orInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_orInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_orInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__atomic_fetch_orInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_orInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_orInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__atomic_fetch_orInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_orInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_orUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__atomic_fetch_orUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_orUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_orUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__atomic_fetch_orUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_orUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_orUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__atomic_fetch_orUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_orUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_orUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__atomic_fetch_orUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_orUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_subInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__atomic_fetch_subInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_subInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_subInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__atomic_fetch_subInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_subInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_subInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__atomic_fetch_subInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_subInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_subInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__atomic_fetch_subInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_subInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_subUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__atomic_fetch_subUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_subUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_subUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__atomic_fetch_subUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_subUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_subUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__atomic_fetch_subUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_subUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_subUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__atomic_fetch_subUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_subUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_xorInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__atomic_fetch_xorInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_xorInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_xorInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__atomic_fetch_xorInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_xorInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_xorInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__atomic_fetch_xorInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_xorInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_xorInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__atomic_fetch_xorInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_xorInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_fetch_xorUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__atomic_fetch_xorUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_xorUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__atomic_fetch_xorUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__atomic_fetch_xorUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_xorUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__atomic_fetch_xorUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__atomic_fetch_xorUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_fetch_xorUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__atomic_fetch_xorUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__atomic_fetch_xorUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__atomic_fetch_xorUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__atomic_loadInt16(t *TLS, ptr, ret uintptr, memorder int32)
TEXT ·Y__atomic_loadInt16(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ret+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_loadInt16(SB)
	RET

// func Y__atomic_loadInt32(t *TLS, ptr, ret uintptr, memorder int32)
TEXT ·Y__atomic_loadInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ret+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_loadInt32(SB)
	RET

// func Y__atomic_loadInt64(t *TLS, ptr, ret uintptr, memorder int32)
TEXT ·Y__atomic_loadInt64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ret+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_loadInt64(SB)
	RET

// func Y__atomic_loadInt8(t *TLS, ptr, ret uintptr, memorder int32)
TEXT ·Y__atomic_loadInt8(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ret+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_loadInt8(SB)
	RET

// func Y__atomic_loadUint16(t *TLS, ptr, ret uintptr, memorder int32)
TEXT ·Y__atomic_loadUint16(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ret+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_loadUint16(SB)
	RET

// func Y__atomic_loadUint32(t *TLS, ptr, ret uintptr, memorder int32)
TEXT ·Y__atomic_loadUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ret+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_loadUint32(SB)
	RET

// func Y__atomic_loadUint64(t *TLS, ptr, ret uintptr, memorder int32)
TEXT ·Y__atomic_loadUint64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ret+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_loadUint64(SB)
	RET

// func Y__atomic_loadUint8(t *TLS, ptr, ret uintptr, memorder int32)
TEXT ·Y__atomic_loadUint8(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ret+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_loadUint8(SB)
	RET

// func Y__atomic_storeInt16(t *TLS, ptr, val uintptr, memorder int32)
TEXT ·Y__atomic_storeInt16(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_storeInt16(SB)
	RET

// func Y__atomic_storeInt32(t *TLS, ptr, val uintptr, memorder int32)
TEXT ·Y__atomic_storeInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_storeInt32(SB)
	RET

// func Y__atomic_storeInt64(t *TLS, ptr, val uintptr, memorder int32)
TEXT ·Y__atomic_storeInt64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_storeInt64(SB)
	RET

// func Y__atomic_storeInt8(t *TLS, ptr, val uintptr, memorder int32)
TEXT ·Y__atomic_storeInt8(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_storeInt8(SB)
	RET

// func Y__atomic_storeUint16(t *TLS, ptr, val uintptr, memorder int32)
TEXT ·Y__atomic_storeUint16(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_storeUint16(SB)
	RET

// func Y__atomic_storeUint32(t *TLS, ptr, val uintptr, memorder int32)
TEXT ·Y__atomic_storeUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_storeUint32(SB)
	RET

// func Y__atomic_storeUint64(t *TLS, ptr, val uintptr, memorder int32)
TEXT ·Y__atomic_storeUint64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_storeUint64(SB)
	RET

// func Y__atomic_storeUint8(t *TLS, ptr, val uintptr, memorder int32)
TEXT ·Y__atomic_storeUint8(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__atomic_storeUint8(SB)
	RET

// func Y__block_all_sigs(tls *TLS, set uintptr)
TEXT ·Y__block_all_sigs(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__block_all_sigs(SB)
	RET

// func Y__block_app_sigs(tls *TLS, set uintptr)
TEXT ·Y__block_app_sigs(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__block_app_sigs(SB)
	RET

// func Y__builtin___memcpy_chk(t *TLS, dest, src uintptr, n, os Tsize_t) (r uintptr)
TEXT ·Y__builtin___memcpy_chk(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ os+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__builtin___memcpy_chk(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Y__builtin___memmove_chk(t *TLS, dest, src uintptr, n, os Tsize_t) (_3 uintptr)
TEXT ·Y__builtin___memmove_chk(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ os+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__builtin___memmove_chk(SB)
	MOVQ 40(SP), AX
	MOVQ AX, _3+40(FP)
	RET

// func Y__builtin___memset_chk(t *TLS, s uintptr, c int32, n, os Tsize_t) (_4 uintptr)
TEXT ·Y__builtin___memset_chk(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ os+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__builtin___memset_chk(SB)
	MOVQ 40(SP), AX
	MOVQ AX, _4+40(FP)
	RET

// func Y__builtin___snprintf_chk(t *TLS, str uintptr, maxlen Tsize_t, flag int32, os Tsize_t, format, args uintptr) (r int32)
TEXT ·Y__builtin___snprintf_chk(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ str+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ maxlen+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flag+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ os+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ format+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ args+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·X__builtin___snprintf_chk(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Y__builtin___sprintf_chk(t *TLS, s uintptr, flag int32, os Tsize_t, format, args uintptr) (r int32)
TEXT ·Y__builtin___sprintf_chk(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flag+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ os+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ format+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ args+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__builtin___sprintf_chk(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Y__builtin___strcat_chk(t *TLS, dest, src uintptr, os Tsize_t) (r uintptr)
TEXT ·Y__builtin___strcat_chk(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ os+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin___strcat_chk(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__builtin___strcpy_chk(t *TLS, dest, src uintptr, os Tsize_t) (_3 uintptr)
TEXT ·Y__builtin___strcpy_chk(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ os+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin___strcpy_chk(SB)
	MOVQ 32(SP), AX
	MOVQ AX, _3+32(FP)
	RET

// func Y__builtin___strncpy_chk(t *TLS, dest, src uintptr, n, os Tsize_t) (r uintptr)
TEXT ·Y__builtin___strncpy_chk(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ os+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__builtin___strncpy_chk(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Y__builtin___vsnprintf_chk(t *TLS, str uintptr, maxlen Tsize_t, flag int32, os Tsize_t, format, args uintptr) (r int32)
TEXT ·Y__builtin___vsnprintf_chk(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ str+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ maxlen+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flag+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ os+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ format+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ args+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·X__builtin___vsnprintf_chk(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Y__builtin_abort(t *TLS)
TEXT ·Y__builtin_abort(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__builtin_abort(SB)
	RET

// func Y__builtin_abs(t *TLS, j int32) (_2 int32)
TEXT ·Y__builtin_abs(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL j+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_abs(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_add_overflowInt64(t *TLS, a, b int64, res uintptr) (_3 int32)
TEXT ·Y__builtin_add_overflowInt64(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ res+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_add_overflowInt64(SB)
	MOVL 32(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Y__builtin_add_overflowUint32(t *TLS, a, b uint32, res uintptr) (_3 int32)
TEXT ·Y__builtin_add_overflowUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL a+8(FP), AX
	MOVL AX, 8(SP)
	MOVL b+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ res+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_add_overflowUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Y__builtin_add_overflowUint64(t *TLS, a, b uint64, res uintptr) (_3 int32)
TEXT ·Y__builtin_add_overflowUint64(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ res+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_add_overflowUint64(SB)
	MOVL 32(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Y__builtin_alloca(tls *TLS, size Tsize_t) (_2 uintptr)
TEXT ·Y__builtin_alloca(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ size+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_alloca(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_bswap16(t *TLS, x uint16) (_2 uint16)
TEXT ·Y__builtin_bswap16(SB),$24-18
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVW x+8(FP), AX
	MOVW AX, 8(SP)
	CALL ·X__builtin_bswap16(SB)
	MOVW 16(SP), AX
	MOVW AX, _2+16(FP)
	RET

// func Y__builtin_bswap32(t *TLS, x uint32) (_2 uint32)
TEXT ·Y__builtin_bswap32(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_bswap32(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_bswap64(t *TLS, x uint64) (_2 uint64)
TEXT ·Y__builtin_bswap64(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_bswap64(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_bzero(t *TLS, s uintptr, n Tsize_t)
TEXT ·Y__builtin_bzero(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_bzero(SB)
	RET

// func Y__builtin_clz(t *TLS, n uint32) (_2 int32)
TEXT ·Y__builtin_clz(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_clz(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_clzl(t *TLS, n ulong) (_2 int32)
TEXT ·Y__builtin_clzl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_clzl(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_clzll(t *TLS, n uint64) (_2 int32)
TEXT ·Y__builtin_clzll(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_clzll(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_copysign(t *TLS, x, y float64) (_2 float64)
TEXT ·Y__builtin_copysign(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_copysign(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _2+24(FP)
	RET

// func Y__builtin_copysignf(t *TLS, x, y float32) (_2 float32)
TEXT ·Y__builtin_copysignf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·X__builtin_copysignf(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_copysignl(t *TLS, x, y float64) (_2 float64)
TEXT ·Y__builtin_copysignl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_copysignl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _2+24(FP)
	RET

// func Y__builtin_ctz(t *TLS, n uint32) (_2 int32)
TEXT ·Y__builtin_ctz(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_ctz(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_ctzl(tls *TLS, x ulong) (_2 int32)
TEXT ·Y__builtin_ctzl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_ctzl(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_exit(t *TLS, status int32)
TEXT ·Y__builtin_exit(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL status+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_exit(SB)
	RET

// func Y__builtin_expect(t *TLS, exp, c long) (_2 long)
TEXT ·Y__builtin_expect(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ exp+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ c+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_expect(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _2+24(FP)
	RET

// func Y__builtin_fabs(t *TLS, x float64) (_2 float64)
TEXT ·Y__builtin_fabs(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_fabs(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_fabsf(t *TLS, x float32) (_2 float32)
TEXT ·Y__builtin_fabsf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_fabsf(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_fabsl(t *TLS, x float64) (_2 float64)
TEXT ·Y__builtin_fabsl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_fabsl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_ffs(tls *TLS, i int32) (r int32)
TEXT ·Y__builtin_ffs(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL i+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_ffs(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__builtin_fma(tls *TLS, x, y, z float64) (r float64)
TEXT ·Y__builtin_fma(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ z+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_fma(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__builtin_fmax(tls *TLS, x float64, y float64) (r float64)
TEXT ·Y__builtin_fmax(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_fmax(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__builtin_fmin(tls *TLS, x float64, y float64) (r float64)
TEXT ·Y__builtin_fmin(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_fmin(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__builtin_free(t *TLS, ptr uintptr)
TEXT ·Y__builtin_free(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_free(SB)
	RET

// func Y__builtin_getentropy(t *TLS, buf uintptr, n Tsize_t) (_3 int32)
TEXT ·Y__builtin_getentropy(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_getentropy(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Y__builtin_huge_val(t *TLS) (_1 float64)
TEXT ·Y__builtin_huge_val(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__builtin_huge_val(SB)
	MOVQ 8(SP), AX
	MOVQ AX, _1+8(FP)
	RET

// func Y__builtin_huge_valf(t *TLS) (_1 float32)
TEXT ·Y__builtin_huge_valf(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__builtin_huge_valf(SB)
	MOVL 8(SP), AX
	MOVL AX, _1+8(FP)
	RET

// func Y__builtin_hypot(tls *TLS, x float64, y float64) (r float64)
TEXT ·Y__builtin_hypot(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_hypot(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__builtin_inf(t *TLS) (_1 float64)
TEXT ·Y__builtin_inf(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__builtin_inf(SB)
	MOVQ 8(SP), AX
	MOVQ AX, _1+8(FP)
	RET

// func Y__builtin_inff(tls *TLS) (_1 float32)
TEXT ·Y__builtin_inff(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__builtin_inff(SB)
	MOVL 8(SP), AX
	MOVL AX, _1+8(FP)
	RET

// func Y__builtin_infl(t *TLS) (_1 float64)
TEXT ·Y__builtin_infl(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__builtin_infl(SB)
	MOVQ 8(SP), AX
	MOVQ AX, _1+8(FP)
	RET

// func Y__builtin_isblank(tls *TLS, c int32) (r int32)
TEXT ·Y__builtin_isblank(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_isblank(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__builtin_isnan(t *TLS, x float64) (_2 int32)
TEXT ·Y__builtin_isnan(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_isnan(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_isnanf(t *TLS, x float32) (_2 int32)
TEXT ·Y__builtin_isnanf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_isnanf(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_isnanl(t *TLS, x float64) (_2 int32)
TEXT ·Y__builtin_isnanl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_isnanl(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_isprint(tls *TLS, c int32) (r int32)
TEXT ·Y__builtin_isprint(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_isprint(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__builtin_isunordered(t *TLS, a, b float64) (_2 int32)
TEXT ·Y__builtin_isunordered(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_isunordered(SB)
	MOVL 24(SP), AX
	MOVL AX, _2+24(FP)
	RET

// func Y__builtin_llabs(tls *TLS, a int64) (_2 int64)
TEXT ·Y__builtin_llabs(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_llabs(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_log2(t *TLS, x float64) (_2 float64)
TEXT ·Y__builtin_log2(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_log2(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_lrint(tls *TLS, x float64) (r long)
TEXT ·Y__builtin_lrint(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_lrint(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__builtin_lrintf(tls *TLS, x float32) (r long)
TEXT ·Y__builtin_lrintf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_lrintf(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__builtin_lround(tls *TLS, x float64) (r long)
TEXT ·Y__builtin_lround(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_lround(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__builtin_malloc(t *TLS, size Tsize_t) (_2 uintptr)
TEXT ·Y__builtin_malloc(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ size+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_malloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_memcmp(t *TLS, s1, s2 uintptr, n Tsize_t) (_3 int32)
TEXT ·Y__builtin_memcmp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_memcmp(SB)
	MOVL 32(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Y__builtin_memcpy(t *TLS, dest, src uintptr, n Tsize_t) (r uintptr)
TEXT ·Y__builtin_memcpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_memcpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__builtin_memset(t *TLS, s uintptr, c int32, n Tsize_t) (_4 uintptr)
TEXT ·Y__builtin_memset(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_memset(SB)
	MOVQ 32(SP), AX
	MOVQ AX, _4+32(FP)
	RET

// func Y__builtin_mmap(t *TLS, addr uintptr, length Tsize_t, prot, flags, fd int32, offset Toff_t) (_5 uintptr)
TEXT ·Y__builtin_mmap(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ length+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL prot+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flags+28(FP), AX
	MOVL AX, 28(SP)
	MOVL fd+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ offset+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__builtin_mmap(SB)
	MOVQ 48(SP), AX
	MOVQ AX, _5+48(FP)
	RET

// func Y__builtin_mul_overflowInt64(t *TLS, a, b int64, res uintptr) (_3 int32)
TEXT ·Y__builtin_mul_overflowInt64(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ res+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_mul_overflowInt64(SB)
	MOVL 32(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Y__builtin_mul_overflowUint128(t *TLS, a, b Uint128, res uintptr) (_3 int32)
TEXT ·Y__builtin_mul_overflowUint128(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a_Lo+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a_Hi+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ b_Lo+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ b_Hi+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ res+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__builtin_mul_overflowUint128(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Y__builtin_mul_overflowUint64(t *TLS, a, b uint64, res uintptr) (_3 int32)
TEXT ·Y__builtin_mul_overflowUint64(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ res+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_mul_overflowUint64(SB)
	MOVL 32(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Y__builtin_nan(t *TLS, s uintptr) (_2 float64)
TEXT ·Y__builtin_nan(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_nan(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_nanf(tls *TLS, s uintptr) (_2 float32)
TEXT ·Y__builtin_nanf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_nanf(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_nanl(t *TLS, s uintptr) (_2 float64)
TEXT ·Y__builtin_nanl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_nanl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_object_size(t *TLS, p uintptr, typ int32) (_3 Tsize_t)
TEXT ·Y__builtin_object_size(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL typ+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__builtin_object_size(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _3+24(FP)
	RET

// func Y__builtin_popcount(t *TLS, x uint32) (_2 int32)
TEXT ·Y__builtin_popcount(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_popcount(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_popcountl(t *TLS, x ulong) (_2 int32)
TEXT ·Y__builtin_popcountl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_popcountl(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__builtin_prefetch(t *TLS, addr, args uintptr)
TEXT ·Y__builtin_prefetch(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ args+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_prefetch(SB)
	RET

// func Y__builtin_printf(tls *TLS, fmt uintptr, va uintptr) (r int32)
TEXT ·Y__builtin_printf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_printf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__builtin_rintf(tls *TLS, x float32) (r float32)
TEXT ·Y__builtin_rintf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_rintf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__builtin_round(tls *TLS, x float64) (r float64)
TEXT ·Y__builtin_round(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_round(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__builtin_roundf(tls *TLS, x float32) (r float32)
TEXT ·Y__builtin_roundf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__builtin_roundf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__builtin_snprintf(t *TLS, str uintptr, size Tsize_t, format, args uintptr) (_4 int32)
TEXT ·Y__builtin_snprintf(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ str+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ format+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ args+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__builtin_snprintf(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__builtin_sprintf(t *TLS, str, format, args uintptr) (r int32)
TEXT ·Y__builtin_sprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ str+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ format+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ args+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_sprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__builtin_strchr(t *TLS, s uintptr, c int32) (_3 uintptr)
TEXT ·Y__builtin_strchr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__builtin_strchr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _3+24(FP)
	RET

// func Y__builtin_strcmp(t *TLS, s1, s2 uintptr) (_2 int32)
TEXT ·Y__builtin_strcmp(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s2+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_strcmp(SB)
	MOVL 24(SP), AX
	MOVL AX, _2+24(FP)
	RET

// func Y__builtin_strcpy(t *TLS, dest, src uintptr) (_2 uintptr)
TEXT ·Y__builtin_strcpy(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__builtin_strcpy(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _2+24(FP)
	RET

// func Y__builtin_strlen(t *TLS, s uintptr) (_2 Tsize_t)
TEXT ·Y__builtin_strlen(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_strlen(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__builtin_sub_overflowInt64(t *TLS, a, b int64, res uintptr) (_3 int32)
TEXT ·Y__builtin_sub_overflowInt64(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ res+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__builtin_sub_overflowInt64(SB)
	MOVL 32(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Y__builtin_trap(t *TLS)
TEXT ·Y__builtin_trap(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__builtin_trap(SB)
	RET

// func Y__builtin_trunc(tls *TLS, x float64) (r float64)
TEXT ·Y__builtin_trunc(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__builtin_trunc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__builtin_unreachable(t *TLS)
TEXT ·Y__builtin_unreachable(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__builtin_unreachable(SB)
	RET

// func Y__builtin_vsnprintf(t *TLS, str uintptr, size Tsize_t, format, va uintptr) (_4 int32)
TEXT ·Y__builtin_vsnprintf(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ str+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ format+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ va+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__builtin_vsnprintf(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__c11_atomic_compare_exchange_strongInt16(t *TLS, ptr, expected uintptr, desired int16, success, failure int32) (_4 int32)
TEXT ·Y__c11_atomic_compare_exchange_strongInt16(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVW desired+24(FP), AX
	MOVW AX, 24(SP)
	MOVL success+28(FP), AX
	MOVL AX, 28(SP)
	MOVL failure+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__c11_atomic_compare_exchange_strongInt16(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__c11_atomic_compare_exchange_strongInt32(t *TLS, ptr, expected uintptr, desired, success, failure int32) (_3 int32)
TEXT ·Y__c11_atomic_compare_exchange_strongInt32(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL desired+24(FP), AX
	MOVL AX, 24(SP)
	MOVL success+28(FP), AX
	MOVL AX, 28(SP)
	MOVL failure+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__c11_atomic_compare_exchange_strongInt32(SB)
	MOVL 40(SP), AX
	MOVL AX, _3+40(FP)
	RET

// func Y__c11_atomic_compare_exchange_strongInt64(t *TLS, ptr, expected uintptr, desired int64, success, failure int32) (_4 int32)
TEXT ·Y__c11_atomic_compare_exchange_strongInt64(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL success+32(FP), AX
	MOVL AX, 32(SP)
	MOVL failure+36(FP), AX
	MOVL AX, 36(SP)
	CALL ·X__c11_atomic_compare_exchange_strongInt64(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__c11_atomic_compare_exchange_strongInt8(t *TLS, ptr, expected uintptr, desired int8, success, failure int32) (_4 int32)
TEXT ·Y__c11_atomic_compare_exchange_strongInt8(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVB desired+24(FP), AX
	MOVB AX, 24(SP)
	MOVL success+28(FP), AX
	MOVL AX, 28(SP)
	MOVL failure+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__c11_atomic_compare_exchange_strongInt8(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__c11_atomic_compare_exchange_strongUint16(t *TLS, ptr, expected uintptr, desired uint16, success, failure int32) (_4 int32)
TEXT ·Y__c11_atomic_compare_exchange_strongUint16(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVW desired+24(FP), AX
	MOVW AX, 24(SP)
	MOVL success+28(FP), AX
	MOVL AX, 28(SP)
	MOVL failure+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__c11_atomic_compare_exchange_strongUint16(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__c11_atomic_compare_exchange_strongUint32(t *TLS, ptr, expected uintptr, desired uint32, success, failure int32) (_4 int32)
TEXT ·Y__c11_atomic_compare_exchange_strongUint32(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL desired+24(FP), AX
	MOVL AX, 24(SP)
	MOVL success+28(FP), AX
	MOVL AX, 28(SP)
	MOVL failure+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__c11_atomic_compare_exchange_strongUint32(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__c11_atomic_compare_exchange_strongUint64(t *TLS, ptr, expected uintptr, desired uint64, success, failure int32) (_4 int32)
TEXT ·Y__c11_atomic_compare_exchange_strongUint64(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ desired+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL success+32(FP), AX
	MOVL AX, 32(SP)
	MOVL failure+36(FP), AX
	MOVL AX, 36(SP)
	CALL ·X__c11_atomic_compare_exchange_strongUint64(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__c11_atomic_compare_exchange_strongUint8(t *TLS, ptr, expected uintptr, desired uint8, success, failure int32) (_4 int32)
TEXT ·Y__c11_atomic_compare_exchange_strongUint8(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ expected+16(FP), AX
	MOVQ AX, 16(SP)
	MOVB desired+24(FP), AX
	MOVB AX, 24(SP)
	MOVL success+28(FP), AX
	MOVL AX, 28(SP)
	MOVL failure+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__c11_atomic_compare_exchange_strongUint8(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__c11_atomic_exchangeInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__c11_atomic_exchangeInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_exchangeInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_exchangeInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__c11_atomic_exchangeInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_exchangeInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_exchangeInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__c11_atomic_exchangeInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_exchangeInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_exchangeInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__c11_atomic_exchangeInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_exchangeInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_exchangeUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__c11_atomic_exchangeUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_exchangeUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_exchangeUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__c11_atomic_exchangeUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_exchangeUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_exchangeUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__c11_atomic_exchangeUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_exchangeUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_exchangeUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__c11_atomic_exchangeUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_exchangeUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_addInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__c11_atomic_fetch_addInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_addInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_addInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__c11_atomic_fetch_addInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_addInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_addInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__c11_atomic_fetch_addInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_addInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_addInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__c11_atomic_fetch_addInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_addInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_addUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__c11_atomic_fetch_addUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_addUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_addUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__c11_atomic_fetch_addUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_addUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_addUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__c11_atomic_fetch_addUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_addUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_addUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__c11_atomic_fetch_addUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_addUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_andInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__c11_atomic_fetch_andInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_andInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_andInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__c11_atomic_fetch_andInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_andInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_andInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__c11_atomic_fetch_andInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_andInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_andInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__c11_atomic_fetch_andInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_andInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_andUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__c11_atomic_fetch_andUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_andUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_andUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__c11_atomic_fetch_andUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_andUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_andUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__c11_atomic_fetch_andUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_andUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_andUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__c11_atomic_fetch_andUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_andUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_orInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__c11_atomic_fetch_orInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_orInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_orInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__c11_atomic_fetch_orInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_orInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_orInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__c11_atomic_fetch_orInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_orInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_orInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__c11_atomic_fetch_orInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_orInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_orUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__c11_atomic_fetch_orUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_orUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_orUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__c11_atomic_fetch_orUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_orUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_orUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__c11_atomic_fetch_orUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_orUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_orUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__c11_atomic_fetch_orUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_orUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_subInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__c11_atomic_fetch_subInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_subInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_subInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__c11_atomic_fetch_subInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_subInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_subInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__c11_atomic_fetch_subInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_subInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_subInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__c11_atomic_fetch_subInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_subInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_subUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__c11_atomic_fetch_subUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_subUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_subUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__c11_atomic_fetch_subUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_subUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_subUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__c11_atomic_fetch_subUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_subUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_subUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__c11_atomic_fetch_subUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_subUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_xorInt16(t *TLS, ptr uintptr, val int16, _ int32) (r int16)
TEXT ·Y__c11_atomic_fetch_xorInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_xorInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_xorInt32(t *TLS, ptr uintptr, val int32, _ int32) (r int32)
TEXT ·Y__c11_atomic_fetch_xorInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_xorInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_xorInt64(t *TLS, ptr uintptr, val int64, _ int32) (r int64)
TEXT ·Y__c11_atomic_fetch_xorInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_xorInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_xorInt8(t *TLS, ptr uintptr, val int8, _ int32) (r int8)
TEXT ·Y__c11_atomic_fetch_xorInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_xorInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_xorUint16(t *TLS, ptr uintptr, val uint16, _ int32) (r uint16)
TEXT ·Y__c11_atomic_fetch_xorUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_xorUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_xorUint32(t *TLS, ptr uintptr, val uint32, _ int32) (r uint32)
TEXT ·Y__c11_atomic_fetch_xorUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_xorUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_fetch_xorUint64(t *TLS, ptr uintptr, val uint64, _ int32) (r uint64)
TEXT ·Y__c11_atomic_fetch_xorUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_fetch_xorUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__c11_atomic_fetch_xorUint8(t *TLS, ptr uintptr, val uint8, _ int32) (r uint8)
TEXT ·Y__c11_atomic_fetch_xorUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL _+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_fetch_xorUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_loadInt16(t *TLS, ptr uintptr, memorder int32) (r int16)
TEXT ·Y__c11_atomic_loadInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL memorder+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__c11_atomic_loadInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_loadInt32(t *TLS, ptr uintptr, memorder int32) (r int32)
TEXT ·Y__c11_atomic_loadInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL memorder+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__c11_atomic_loadInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_loadInt64(t *TLS, ptr uintptr, memorder int32) (r int64)
TEXT ·Y__c11_atomic_loadInt64(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL memorder+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__c11_atomic_loadInt64(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__c11_atomic_loadInt8(t *TLS, ptr uintptr, memorder int32) (r int8)
TEXT ·Y__c11_atomic_loadInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL memorder+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__c11_atomic_loadInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_loadUint16(t *TLS, ptr uintptr, memorder int32) (r uint16)
TEXT ·Y__c11_atomic_loadUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL memorder+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__c11_atomic_loadUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__c11_atomic_loadUint32(t *TLS, ptr uintptr, memorder int32) (r uint32)
TEXT ·Y__c11_atomic_loadUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL memorder+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__c11_atomic_loadUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__c11_atomic_loadUint64(t *TLS, ptr uintptr, memorder int32) (r uint64)
TEXT ·Y__c11_atomic_loadUint64(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL memorder+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__c11_atomic_loadUint64(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__c11_atomic_loadUint8(t *TLS, ptr uintptr, memorder int32) (r uint8)
TEXT ·Y__c11_atomic_loadUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL memorder+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__c11_atomic_loadUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__c11_atomic_storeInt16(t *TLS, ptr uintptr, val int16, memorder int32)
TEXT ·Y__c11_atomic_storeInt16(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL memorder+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_storeInt16(SB)
	RET

// func Y__c11_atomic_storeInt32(t *TLS, ptr uintptr, val int32, memorder int32)
TEXT ·Y__c11_atomic_storeInt32(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL memorder+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_storeInt32(SB)
	RET

// func Y__c11_atomic_storeInt64(t *TLS, ptr uintptr, val int64, memorder int32)
TEXT ·Y__c11_atomic_storeInt64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_storeInt64(SB)
	RET

// func Y__c11_atomic_storeInt8(t *TLS, ptr uintptr, val int8, memorder int32)
TEXT ·Y__c11_atomic_storeInt8(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL memorder+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_storeInt8(SB)
	RET

// func Y__c11_atomic_storeUint16(t *TLS, ptr uintptr, val uint16, memorder int32)
TEXT ·Y__c11_atomic_storeUint16(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW val+16(FP), AX
	MOVW AX, 16(SP)
	MOVL memorder+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_storeUint16(SB)
	RET

// func Y__c11_atomic_storeUint32(t *TLS, ptr uintptr, val uint32, memorder int32)
TEXT ·Y__c11_atomic_storeUint32(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	MOVL memorder+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_storeUint32(SB)
	RET

// func Y__c11_atomic_storeUint64(t *TLS, ptr uintptr, val uint64, memorder int32)
TEXT ·Y__c11_atomic_storeUint64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL memorder+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__c11_atomic_storeUint64(SB)
	RET

// func Y__c11_atomic_storeUint8(t *TLS, ptr uintptr, val uint8, memorder int32)
TEXT ·Y__c11_atomic_storeUint8(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB val+16(FP), AX
	MOVB AX, 16(SP)
	MOVL memorder+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__c11_atomic_storeUint8(SB)
	RET

// func Y__ccgo_dmesg(t *TLS, fmt uintptr, va uintptr)
TEXT ·Y__ccgo_dmesg(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__ccgo_dmesg(SB)
	RET

// func Y__ccgo_getMutexType(tls *TLS, m uintptr) (_2 int32)
TEXT ·Y__ccgo_getMutexType(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__ccgo_getMutexType(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__ccgo_in6addr_anyp(t *TLS) (_1 uintptr)
TEXT ·Y__ccgo_in6addr_anyp(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__ccgo_in6addr_anyp(SB)
	MOVQ 8(SP), AX
	MOVQ AX, _1+8(FP)
	RET

// func Y__ccgo_pthreadAttrGetDetachState(tls *TLS, a uintptr) (_2 int32)
TEXT ·Y__ccgo_pthreadAttrGetDetachState(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__ccgo_pthreadAttrGetDetachState(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__ccgo_pthreadMutexattrGettype(tls *TLS, a uintptr) (_2 int32)
TEXT ·Y__ccgo_pthreadMutexattrGettype(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__ccgo_pthreadMutexattrGettype(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__ccgo_sqlite3_log(t *TLS, iErrCode int32, zFormat uintptr, args uintptr)
TEXT ·Y__ccgo_sqlite3_log(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL iErrCode+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ zFormat+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ args+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__ccgo_sqlite3_log(SB)
	RET

// func Y__clock_gettime(tls *TLS, clk Tclockid_t, ts uintptr) (r1 int32)
TEXT ·Y__clock_gettime(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL clk+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ ts+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__clock_gettime(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Y__clock_nanosleep(tls *TLS, clk Tclockid_t, flags int32, req uintptr, rem uintptr) (r int32)
TEXT ·Y__clock_nanosleep(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL clk+8(FP), AX
	MOVL AX, 8(SP)
	MOVL flags+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ req+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ rem+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__clock_nanosleep(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__cmsg_nxthdr(t *TLS, msgh, cmsg uintptr) (_2 uintptr)
TEXT ·Y__cmsg_nxthdr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msgh+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ cmsg+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__cmsg_nxthdr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _2+24(FP)
	RET

// func Y__convert_scm_timestamps(tls *TLS, msg uintptr, csize Tsocklen_t)
TEXT ·Y__convert_scm_timestamps(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL csize+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__convert_scm_timestamps(SB)
	RET

// func Y__cos(tls *TLS, x float64, y float64) (r1 float64)
TEXT ·Y__cos(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__cos(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r1+24(FP)
	RET

// func Y__cosdf(tls *TLS, x float64) (r1 float32)
TEXT ·Y__cosdf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__cosdf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Y__crypt_blowfish(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)
TEXT ·Y__crypt_blowfish(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ setting+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ output+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__crypt_blowfish(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__crypt_des(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)
TEXT ·Y__crypt_des(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ setting+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ output+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__crypt_des(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__crypt_md5(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)
TEXT ·Y__crypt_md5(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ setting+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ output+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__crypt_md5(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__crypt_r(tls *TLS, key uintptr, salt uintptr, data uintptr) (r uintptr)
TEXT ·Y__crypt_r(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ salt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ data+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__crypt_r(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__crypt_sha256(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)
TEXT ·Y__crypt_sha256(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ setting+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ output+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__crypt_sha256(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__crypt_sha512(tls *TLS, key uintptr, setting uintptr, output uintptr) (r uintptr)
TEXT ·Y__crypt_sha512(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ setting+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ output+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__crypt_sha512(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__ctype_b_loc(tls *TLS) (r uintptr)
TEXT ·Y__ctype_b_loc(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__ctype_b_loc(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__ctype_get_mb_cur_max(tls *TLS) (r Tsize_t)
TEXT ·Y__ctype_get_mb_cur_max(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__ctype_get_mb_cur_max(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__ctype_tolower_loc(tls *TLS) (r uintptr)
TEXT ·Y__ctype_tolower_loc(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__ctype_tolower_loc(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__ctype_toupper_loc(tls *TLS) (r uintptr)
TEXT ·Y__ctype_toupper_loc(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__ctype_toupper_loc(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__des_setkey(tls *TLS, key uintptr, ekey uintptr)
TEXT ·Y__des_setkey(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ekey+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__des_setkey(SB)
	RET

// func Y__dn_expand(tls *TLS, base uintptr, end uintptr, src uintptr, dest uintptr, space int32) (r int32)
TEXT ·Y__dn_expand(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ base+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ end+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ src+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ dest+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL space+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·X__dn_expand(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Y__dns_parse(tls *TLS, r uintptr, rlen int32, __ccgo_fp_callback uintptr, ctx uintptr) (r1 int32)
TEXT ·Y__dns_parse(SB),$56-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_callback+24(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal___dns_parse_2(SB)	// Create the closure for calling __ccgo_fp_callback
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ r+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL rlen+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 24(SP)
	MOVQ ctx+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__dns_parse(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0___dns_parse_2(SB),$72-68
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL _2+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ _3+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _4+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ _5+40(FP), AX
	MOVQ AX, 40(SP)
	MOVL _6+48(FP), AX
	MOVL AX, 48(SP)
	MOVQ __ccgo_fp+56(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 56(SP), AX
	MOVL AX, _7+64(FP)
	RET

// func Y__do_des(tls *TLS, l_in Tuint32_t, r_in Tuint32_t, l_out uintptr, r_out uintptr, count Tuint32_t, saltbits Tuint32_t, ekey uintptr)
TEXT ·Y__do_des(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL l_in+8(FP), AX
	MOVL AX, 8(SP)
	MOVL r_in+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ l_out+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ r_out+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL count+32(FP), AX
	MOVL AX, 32(SP)
	MOVL saltbits+36(FP), AX
	MOVL AX, 36(SP)
	MOVQ ekey+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__do_des(SB)
	RET

// func Y__do_orphaned_stdio_locks(tls *TLS)
TEXT ·Y__do_orphaned_stdio_locks(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__do_orphaned_stdio_locks(SB)
	RET

// func Y__dup3(tls *TLS, old int32, new1 int32, flags int32) (r1 int32)
TEXT ·Y__dup3(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL old+8(FP), AX
	MOVL AX, 8(SP)
	MOVL new1+12(FP), AX
	MOVL AX, 12(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__dup3(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Y__duplocale(tls *TLS, old Tlocale_t) (r Tlocale_t)
TEXT ·Y__duplocale(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ old+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__duplocale(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__env_rm_add(tls *TLS, old uintptr, new1 uintptr)
TEXT ·Y__env_rm_add(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ old+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ new1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__env_rm_add(SB)
	RET

// func Y__errno_location(tls *TLS) (r uintptr)
TEXT ·Y__errno_location(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__errno_location(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__execvpe(tls *TLS, file uintptr, argv uintptr, envp uintptr) (r int32)
TEXT ·Y__execvpe(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ file+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ envp+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__execvpe(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__expo2(tls *TLS, x float64, sign float64) (r float64)
TEXT ·Y__expo2(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sign+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__expo2(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__expo2f(tls *TLS, x float32, sign float32) (r float32)
TEXT ·Y__expo2f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL sign+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·X__expo2f(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fbufsize(tls *TLS, f uintptr) (r Tsize_t)
TEXT ·Y__fbufsize(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fbufsize(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__fclose_ca(tls *TLS, f uintptr) (r int32)
TEXT ·Y__fclose_ca(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fclose_ca(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fdopen(tls *TLS, fd int32, mode uintptr) (r uintptr)
TEXT ·Y__fdopen(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ mode+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__fdopen(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__fesetround(tls *TLS, r int32) (r1 int32)
TEXT ·Y__fesetround(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL r+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__fesetround(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Y__fgetwc_unlocked(tls *TLS, f uintptr) (r Twint_t)
TEXT ·Y__fgetwc_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fgetwc_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__flbf(tls *TLS, f uintptr) (r int32)
TEXT ·Y__flbf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__flbf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__floatscan(tls *TLS, f uintptr, prec int32, pok int32) (r float64)
TEXT ·Y__floatscan(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL prec+16(FP), AX
	MOVL AX, 16(SP)
	MOVL pok+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__floatscan(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__fmodeflags(tls *TLS, mode uintptr) (r int32)
TEXT ·Y__fmodeflags(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ mode+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fmodeflags(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fopen_rb_ca(tls *TLS, filename uintptr, f uintptr, buf uintptr, len1 Tsize_t) (r uintptr)
TEXT ·Y__fopen_rb_ca(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ len1+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__fopen_rb_ca(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Y__fpclassify(tls *TLS, x float64) (r int32)
TEXT ·Y__fpclassify(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fpclassify(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fpclassifyf(tls *TLS, x float32) (r int32)
TEXT ·Y__fpclassifyf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__fpclassifyf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fpclassifyl(tls *TLS, x float64) (r int32)
TEXT ·Y__fpclassifyl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fpclassifyl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fpending(tls *TLS, f uintptr) (r Tsize_t)
TEXT ·Y__fpending(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fpending(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__fpurge(tls *TLS, f uintptr) (r int32)
TEXT ·Y__fpurge(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fpurge(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fputwc_unlocked(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)
TEXT ·Y__fputwc_unlocked(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__fputwc_unlocked(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__freadable(tls *TLS, f uintptr) (r int32)
TEXT ·Y__freadable(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__freadable(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__freadahead(tls *TLS, f uintptr) (r Tsize_t)
TEXT ·Y__freadahead(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__freadahead(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__freading(tls *TLS, f uintptr) (r int32)
TEXT ·Y__freading(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__freading(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__freadptr(tls *TLS, f uintptr, sizep uintptr) (r uintptr)
TEXT ·Y__freadptr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sizep+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__freadptr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__freadptrinc(tls *TLS, f uintptr, inc Tsize_t)
TEXT ·Y__freadptrinc(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ inc+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__freadptrinc(SB)
	RET

// func Y__freelocale(tls *TLS, l Tlocale_t)
TEXT ·Y__freelocale(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__freelocale(SB)
	RET

// func Y__fseeko(tls *TLS, f uintptr, off Toff_t, whence int32) (r int32)
TEXT ·Y__fseeko(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ off+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL whence+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__fseeko(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__fseeko_unlocked(tls *TLS, f uintptr, off Toff_t, whence int32) (r int32)
TEXT ·Y__fseeko_unlocked(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ off+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL whence+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__fseeko_unlocked(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__fseterr(tls *TLS, f uintptr)
TEXT ·Y__fseterr(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fseterr(SB)
	RET

// func Y__fsetlocking(tls *TLS, f uintptr, type1 int32) (r int32)
TEXT ·Y__fsetlocking(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL type1+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__fsetlocking(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__fstat(tls *TLS, fd int32, st uintptr) (r int32)
TEXT ·Y__fstat(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ st+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__fstat(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__fstatat(tls *TLS, fd int32, path uintptr, st uintptr, flag int32) (r int32)
TEXT ·Y__fstatat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ st+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flag+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__fstatat(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Y__ftello(tls *TLS, f uintptr) (r Toff_t)
TEXT ·Y__ftello(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__ftello(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__ftello_unlocked(tls *TLS, f uintptr) (r Toff_t)
TEXT ·Y__ftello_unlocked(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__ftello_unlocked(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__funcs_on_quick_exit(tls *TLS)
TEXT ·Y__funcs_on_quick_exit(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__funcs_on_quick_exit(SB)
	RET

// func Y__futimesat(tls *TLS, dirfd int32, pathname uintptr, times uintptr) (r int32)
TEXT ·Y__futimesat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL dirfd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ pathname+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ times+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__futimesat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__fwritable(tls *TLS, f uintptr) (r int32)
TEXT ·Y__fwritable(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fwritable(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fwritex(tls *TLS, s uintptr, l Tsize_t, f uintptr) (r Tsize_t)
TEXT ·Y__fwritex(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__fwritex(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__fwriting(tls *TLS, f uintptr) (r int32)
TEXT ·Y__fwriting(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__fwriting(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__fxstat(tls *TLS, ver int32, fd int32, buf uintptr) (r int32)
TEXT ·Y__fxstat(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ver+8(FP), AX
	MOVL AX, 8(SP)
	MOVL fd+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__fxstat(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__fxstatat(tls *TLS, ver int32, fd int32, path uintptr, buf uintptr, flag int32) (r int32)
TEXT ·Y__fxstatat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ver+8(FP), AX
	MOVL AX, 8(SP)
	MOVL fd+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flag+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__fxstatat(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Y__get_handler_set(tls *TLS, set uintptr)
TEXT ·Y__get_handler_set(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__get_handler_set(SB)
	RET

// func Y__get_locale(tls *TLS, cat int32, val uintptr) (r uintptr)
TEXT ·Y__get_locale(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL cat+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__get_locale(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__get_resolv_conf(tls *TLS, conf uintptr, search uintptr, search_sz Tsize_t) (r int32)
TEXT ·Y__get_resolv_conf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ conf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ search+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ search_sz+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__get_resolv_conf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__getauxval(tls *TLS, item uint64) (r uint64)
TEXT ·Y__getauxval(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ item+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__getauxval(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__getdelim(tls *TLS, s uintptr, n uintptr, delim int32, f uintptr) (r Tssize_t)
TEXT ·Y__getdelim(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL delim+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ f+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__getdelim(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Y__getgr_a(tls *TLS, name uintptr, gid Tgid_t, gr uintptr, buf uintptr, size uintptr, mem uintptr, nmem uintptr, res uintptr) (r int32)
TEXT ·Y__getgr_a(SB),$80-76
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL gid+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ gr+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ buf+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ size+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ mem+48(FP), AX
	MOVQ AX, 48(SP)
	MOVQ nmem+56(FP), AX
	MOVQ AX, 56(SP)
	MOVQ res+64(FP), AX
	MOVQ AX, 64(SP)
	CALL ·X__getgr_a(SB)
	MOVL 72(SP), AX
	MOVL AX, r+72(FP)
	RET

// func Y__getgrent_a(tls *TLS, f uintptr, gr uintptr, line uintptr, size uintptr, mem uintptr, nmem uintptr, res uintptr) (r int32)
TEXT ·Y__getgrent_a(SB),$72-68
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ gr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ line+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ mem+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ nmem+48(FP), AX
	MOVQ AX, 48(SP)
	MOVQ res+56(FP), AX
	MOVQ AX, 56(SP)
	CALL ·X__getgrent_a(SB)
	MOVL 64(SP), AX
	MOVL AX, r+64(FP)
	RET

// func Y__getopt_msg(tls *TLS, a uintptr, b uintptr, c uintptr, l Tsize_t)
TEXT ·Y__getopt_msg(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ c+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ l+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__getopt_msg(SB)
	RET

// func Y__getpw_a(tls *TLS, name uintptr, uid Tuid_t, pw uintptr, buf uintptr, size uintptr, res uintptr) (r int32)
TEXT ·Y__getpw_a(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL uid+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ pw+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ buf+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ size+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ res+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·X__getpw_a(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Y__getpwent_a(tls *TLS, f uintptr, pw uintptr, line uintptr, size uintptr, res uintptr) (r int32)
TEXT ·Y__getpwent_a(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ pw+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ line+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ res+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__getpwent_a(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Y__gettextdomain(tls *TLS) (r uintptr)
TEXT ·Y__gettextdomain(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__gettextdomain(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__gmtime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr)
TEXT ·Y__gmtime_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ tm+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__gmtime_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__h_errno_location(tls *TLS) (r uintptr)
TEXT ·Y__h_errno_location(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__h_errno_location(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__inet_aton(tls *TLS, s0 uintptr, dest uintptr) (r int32)
TEXT ·Y__inet_aton(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s0+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ dest+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__inet_aton(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__init_ssp(tls *TLS, entropy uintptr)
TEXT ·Y__init_ssp(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ entropy+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__init_ssp(SB)
	RET

// func Y__intscan(tls *TLS, f uintptr, base uint32, pok int32, lim uint64) (r uint64)
TEXT ·Y__intscan(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL base+16(FP), AX
	MOVL AX, 16(SP)
	MOVL pok+20(FP), AX
	MOVL AX, 20(SP)
	MOVQ lim+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__intscan(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__isalnum_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isalnum_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isalnum_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isalpha_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isalpha_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isalpha_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isblank_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isblank_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isblank_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iscntrl_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__iscntrl_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iscntrl_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isdigit_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isdigit_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isdigit_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isfinite(tls *TLS, d float64) (_2 int32)
TEXT ·Y__isfinite(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__isfinite(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__isfinitef(tls *TLS, f float32) (_2 int32)
TEXT ·Y__isfinitef(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL f+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__isfinitef(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__isfinitel(tls *TLS, d float64) (_2 int32)
TEXT ·Y__isfinitel(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__isfinitel(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__isgraph_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isgraph_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isgraph_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__islower_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__islower_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__islower_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isnan(t *TLS, x float64) (_2 int32)
TEXT ·Y__isnan(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__isnan(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__isnanf(t *TLS, arg float32) (_2 int32)
TEXT ·Y__isnanf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL arg+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__isnanf(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__isnanl(t *TLS, arg float64) (_2 int32)
TEXT ·Y__isnanl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ arg+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__isnanl(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__isoc99_fscanf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Y__isoc99_fscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__isoc99_fscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__isoc99_fwscanf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Y__isoc99_fwscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__isoc99_fwscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__isoc99_scanf(tls *TLS, fmt uintptr, va uintptr) (r int32)
TEXT ·Y__isoc99_scanf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isoc99_scanf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isoc99_sscanf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Y__isoc99_sscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__isoc99_sscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__isoc99_swscanf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Y__isoc99_swscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__isoc99_swscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__isoc99_vfscanf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Y__isoc99_vfscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__isoc99_vfscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__isoc99_vfwscanf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Y__isoc99_vfwscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__isoc99_vfwscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__isoc99_vscanf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Y__isoc99_vscanf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isoc99_vscanf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isoc99_vsscanf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Y__isoc99_vsscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__isoc99_vsscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__isoc99_vswscanf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Y__isoc99_vswscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__isoc99_vswscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__isoc99_vwscanf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Y__isoc99_vwscanf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isoc99_vwscanf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isoc99_wscanf(tls *TLS, fmt uintptr, va uintptr) (r int32)
TEXT ·Y__isoc99_wscanf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isoc99_wscanf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isprint_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isprint_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isprint_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__ispunct_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__ispunct_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__ispunct_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isspace_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isspace_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isspace_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isupper_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isupper_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isupper_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswalnum_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswalnum_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswalnum_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswalpha_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswalpha_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswalpha_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswblank_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswblank_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswblank_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswcntrl_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswcntrl_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswcntrl_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswctype_l(tls *TLS, c Twint_t, t Twctype_t, l Tlocale_t) (r int32)
TEXT ·Y__iswctype_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ t+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__iswctype_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__iswdigit_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswdigit_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswdigit_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswgraph_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswgraph_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswgraph_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswlower_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswlower_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswlower_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswprint_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswprint_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswprint_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswpunct_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswpunct_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswpunct_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswspace_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswspace_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswspace_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswupper_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswupper_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswupper_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__iswxdigit_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Y__iswxdigit_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__iswxdigit_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__isxdigit_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__isxdigit_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__isxdigit_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__lctrans(tls *TLS, msg uintptr, lm uintptr) (r uintptr)
TEXT ·Y__lctrans(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ lm+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__lctrans(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__lctrans_cur(tls *TLS, msg uintptr) (r uintptr)
TEXT ·Y__lctrans_cur(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msg+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__lctrans_cur(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__lctrans_impl(tls *TLS, msg uintptr, lm uintptr) (r uintptr)
TEXT ·Y__lctrans_impl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ lm+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__lctrans_impl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__ldexp_cexp(tls *TLS, z complex128, expt int32) (r complex128)
TEXT ·Y__ldexp_cexp(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL expt+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__ldexp_cexp(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r_real+32(FP)
	MOVQ 40(SP), AX
	MOVQ AX, r_imag+40(FP)
	RET

// func Y__ldexp_cexpf(tls *TLS, z complex64, expt int32) (r complex64)
TEXT ·Y__ldexp_cexpf(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	MOVL expt+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__ldexp_cexpf(SB)
	MOVL 24(SP), AX
	MOVL AX, r_real+24(FP)
	MOVL 28(SP), AX
	MOVL AX, r_imag+28(FP)
	RET

// func Y__lgamma_r(tls *TLS, x float64, signgamp uintptr) (r1 float64)
TEXT ·Y__lgamma_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ signgamp+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__lgamma_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r1+24(FP)
	RET

// func Y__lgammaf_r(tls *TLS, x float32, signgamp uintptr) (r1 float32)
TEXT ·Y__lgammaf_r(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ signgamp+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__lgammaf_r(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Y__lgammal_r(tls *TLS, x float64, sg uintptr) (r float64)
TEXT ·Y__lgammal_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sg+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__lgammal_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__libc_current_sigrtmax(tls *TLS) (r int32)
TEXT ·Y__libc_current_sigrtmax(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__libc_current_sigrtmax(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Y__libc_current_sigrtmin(tls *TLS) (r int32)
TEXT ·Y__libc_current_sigrtmin(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__libc_current_sigrtmin(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Y__libc_sigaction(tls *TLS, sig int32, sa uintptr, old uintptr) (r1 int32)
TEXT ·Y__libc_sigaction(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sig+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ sa+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ old+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__libc_sigaction(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Y__loc_is_allocated(tls *TLS, loc Tlocale_t) (r int32)
TEXT ·Y__loc_is_allocated(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ loc+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__loc_is_allocated(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__localtime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr)
TEXT ·Y__localtime_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ tm+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__localtime_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__lockfile(tls *TLS, file uintptr) (_2 int32)
TEXT ·Y__lockfile(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ file+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__lockfile(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Y__lookup_ipliteral(tls *TLS, buf uintptr, name uintptr, family int32) (r int32)
TEXT ·Y__lookup_ipliteral(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL family+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__lookup_ipliteral(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__lookup_name(tls *TLS, buf uintptr, canon uintptr, name uintptr, family int32, flags int32) (r int32)
TEXT ·Y__lookup_name(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ canon+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ name+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL family+32(FP), AX
	MOVL AX, 32(SP)
	MOVL flags+36(FP), AX
	MOVL AX, 36(SP)
	CALL ·X__lookup_name(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Y__lookup_serv(tls *TLS, buf uintptr, name uintptr, proto int32, socktype int32, flags int32) (r int32)
TEXT ·Y__lookup_serv(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL proto+24(FP), AX
	MOVL AX, 24(SP)
	MOVL socktype+28(FP), AX
	MOVL AX, 28(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__lookup_serv(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Y__lseek(tls *TLS, fd int32, offset Toff_t, whence int32) (r Toff_t)
TEXT ·Y__lseek(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ offset+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL whence+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__lseek(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__lsysinfo(tls *TLS, info uintptr) (r int32)
TEXT ·Y__lsysinfo(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ info+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__lsysinfo(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__lxstat(tls *TLS, ver int32, path uintptr, buf uintptr) (r int32)
TEXT ·Y__lxstat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ver+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__lxstat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__madvise(tls *TLS, addr uintptr, len1 Tsize_t, advice int32) (r int32)
TEXT ·Y__madvise(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL advice+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__madvise(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__map_file(tls *TLS, pathname uintptr, size uintptr) (r uintptr)
TEXT ·Y__map_file(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ pathname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__map_file(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__math_divzero(tls *TLS, sign Tuint32_t) (r float64)
TEXT ·Y__math_divzero(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sign+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__math_divzero(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__math_divzerof(tls *TLS, sign Tuint32_t) (r float32)
TEXT ·Y__math_divzerof(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sign+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__math_divzerof(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__math_invalid(tls *TLS, x float64) (r float64)
TEXT ·Y__math_invalid(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__math_invalid(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__math_invalidf(tls *TLS, x float32) (r float32)
TEXT ·Y__math_invalidf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__math_invalidf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__math_oflow(tls *TLS, sign Tuint32_t) (r float64)
TEXT ·Y__math_oflow(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sign+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__math_oflow(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__math_oflowf(tls *TLS, sign Tuint32_t) (r float32)
TEXT ·Y__math_oflowf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sign+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__math_oflowf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__math_uflow(tls *TLS, sign Tuint32_t) (r float64)
TEXT ·Y__math_uflow(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sign+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__math_uflow(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__math_uflowf(tls *TLS, sign Tuint32_t) (r float32)
TEXT ·Y__math_uflowf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sign+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__math_uflowf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__math_xflow(tls *TLS, sign Tuint32_t, y2 float64) (r float64)
TEXT ·Y__math_xflow(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sign+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ y2+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__math_xflow(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__math_xflowf(tls *TLS, sign Tuint32_t, y2 float32) (r float32)
TEXT ·Y__math_xflowf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sign+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y2+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·X__math_xflowf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__memrchr(tls *TLS, m uintptr, c int32, n Tsize_t) (r uintptr)
TEXT ·Y__memrchr(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__memrchr(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__mkostemps(tls *TLS, template uintptr, len1 int32, flags int32) (r int32)
TEXT ·Y__mkostemps(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL len1+16(FP), AX
	MOVL AX, 16(SP)
	MOVL flags+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__mkostemps(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__mmap(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr)
TEXT ·Y__mmap(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ start+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL prot+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flags+28(FP), AX
	MOVL AX, 28(SP)
	MOVL fd+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ off+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__mmap(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Y__mo_lookup(tls *TLS, p uintptr, size Tsize_t, s uintptr) (r uintptr)
TEXT ·Y__mo_lookup(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ s+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__mo_lookup(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__month_to_secs(tls *TLS, month int32, is_leap int32) (r int32)
TEXT ·Y__month_to_secs(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL month+8(FP), AX
	MOVL AX, 8(SP)
	MOVL is_leap+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·X__month_to_secs(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__mprotect(tls *TLS, addr uintptr, len1 Tsize_t, prot int32) (r int32)
TEXT ·Y__mprotect(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL prot+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__mprotect(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__mremap(tls *TLS, old_addr uintptr, old_len Tsize_t, new_len Tsize_t, flags int32, va uintptr) (r uintptr)
TEXT ·Y__mremap(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ old_addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ old_len+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ new_len+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ va+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__mremap(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Y__munmap(tls *TLS, start uintptr, len1 Tsize_t) (r int32)
TEXT ·Y__munmap(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ start+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__munmap(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__newlocale(tls *TLS, mask int32, name uintptr, loc Tlocale_t) (r Tlocale_t)
TEXT ·Y__newlocale(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL mask+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ loc+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__newlocale(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__nl_langinfo(tls *TLS, item Tnl_item) (r uintptr)
TEXT ·Y__nl_langinfo(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL item+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__nl_langinfo(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__nl_langinfo_l(tls *TLS, item Tnl_item, loc Tlocale_t) (r uintptr)
TEXT ·Y__nl_langinfo_l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL item+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ loc+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__nl_langinfo_l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__nscd_query(tls *TLS, req Tint32_t, key uintptr, buf uintptr, len1 Tsize_t, swap uintptr) (r uintptr)
TEXT ·Y__nscd_query(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL req+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ key+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ len1+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ swap+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__nscd_query(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Y__ofl_add(tls *TLS, f uintptr) (r uintptr)
TEXT ·Y__ofl_add(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__ofl_add(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__ofl_lock(tls *TLS) (r uintptr)
TEXT ·Y__ofl_lock(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__ofl_lock(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__ofl_unlock(tls *TLS)
TEXT ·Y__ofl_unlock(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__ofl_unlock(SB)
	RET

// func Y__overflow(tls *TLS, f uintptr, _c int32) (r int32)
TEXT ·Y__overflow(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL _c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__overflow(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__pleval(tls *TLS, s uintptr, n uint64) (r uint64)
TEXT ·Y__pleval(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__pleval(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__posix_getopt(tls *TLS, argc int32, argv uintptr, optstring uintptr) (r int32)
TEXT ·Y__posix_getopt(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL argc+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ optstring+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__posix_getopt(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__procfdname(tls *TLS, buf uintptr, fd uint32)
TEXT ·Y__procfdname(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL fd+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__procfdname(SB)
	RET

// func Y__ptsname_r(tls *TLS, fd int32, buf uintptr, len1 Tsize_t) (r int32)
TEXT ·Y__ptsname_r(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__ptsname_r(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__putenv(tls *TLS, s uintptr, l Tsize_t, r uintptr) (r1 int32)
TEXT ·Y__putenv(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ r+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__putenv(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Y__qsort_r(tls *TLS, base uintptr, nel Tsize_t, width Tsize_t, __ccgo_fp_cmp Tcmpfun, arg uintptr)
TEXT ·Y__qsort_r(SB),$56-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cmp+32(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal___qsort_r_3(SB)	// Create the closure for calling __ccgo_fp_cmp
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ base+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ nel+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ width+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 32(SP)
	MOVQ arg+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__qsort_r(SB)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0___qsort_r_3(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ _3+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ __ccgo_fp+32(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 32(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y__rand48_step(tls *TLS, xi uintptr, lc uintptr) (r Tuint64_t)
TEXT ·Y__rand48_step(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ xi+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ lc+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__rand48_step(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__register_locked_file(tls *TLS, f uintptr, self Tpthread_t)
TEXT ·Y__register_locked_file(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ self+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__register_locked_file(SB)
	RET

// func Y__rem_pio2(tls *TLS, x float64, y uintptr) (r1 int32)
TEXT ·Y__rem_pio2(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__rem_pio2(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Y__rem_pio2_large(tls *TLS, x uintptr, y uintptr, e0 int32, nx int32, prec int32) (r int32)
TEXT ·Y__rem_pio2_large(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL e0+24(FP), AX
	MOVL AX, 24(SP)
	MOVL nx+28(FP), AX
	MOVL AX, 28(SP)
	MOVL prec+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__rem_pio2_large(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Y__rem_pio2f(tls *TLS, x float32, y uintptr) (r int32)
TEXT ·Y__rem_pio2f(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__rem_pio2f(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__res_mkquery(tls *TLS, op int32, dname uintptr, class int32, type1 int32, data uintptr, datalen int32, newrr uintptr, buf uintptr, buflen int32) (r int32)
TEXT ·Y__res_mkquery(SB),$80-76
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL op+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ dname+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL class+24(FP), AX
	MOVL AX, 24(SP)
	MOVL type1+28(FP), AX
	MOVL AX, 28(SP)
	MOVQ data+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL datalen+40(FP), AX
	MOVL AX, 40(SP)
	MOVQ newrr+48(FP), AX
	MOVQ AX, 48(SP)
	MOVQ buf+56(FP), AX
	MOVQ AX, 56(SP)
	MOVL buflen+64(FP), AX
	MOVL AX, 64(SP)
	CALL ·X__res_mkquery(SB)
	MOVL 72(SP), AX
	MOVL AX, r+72(FP)
	RET

// func Y__res_msend(tls *TLS, nqueries int32, queries uintptr, qlens uintptr, answers uintptr, alens uintptr, asize int32) (r int32)
TEXT ·Y__res_msend(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL nqueries+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ queries+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ qlens+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ answers+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ alens+40(FP), AX
	MOVQ AX, 40(SP)
	MOVL asize+48(FP), AX
	MOVL AX, 48(SP)
	CALL ·X__res_msend(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Y__res_msend_rc(tls *TLS, nqueries int32, queries uintptr, qlens uintptr, answers uintptr, alens uintptr, asize int32, conf uintptr) (r1 int32)
TEXT ·Y__res_msend_rc(SB),$72-68
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL nqueries+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ queries+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ qlens+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ answers+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ alens+40(FP), AX
	MOVQ AX, 40(SP)
	MOVL asize+48(FP), AX
	MOVL AX, 48(SP)
	MOVQ conf+56(FP), AX
	MOVQ AX, 56(SP)
	CALL ·X__res_msend_rc(SB)
	MOVL 64(SP), AX
	MOVL AX, r1+64(FP)
	RET

// func Y__res_send(tls *TLS, _msg uintptr, _msglen int32, _answer uintptr, _anslen int32) (r1 int32)
TEXT ·Y__res_send(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _msg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL _msglen+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ _answer+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _anslen+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·X__res_send(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Y__res_state(tls *TLS) (r uintptr)
TEXT ·Y__res_state(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__res_state(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Y__reset_tls(tls *TLS)
TEXT ·Y__reset_tls(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__reset_tls(SB)
	RET

// func Y__restore(tls *TLS)
TEXT ·Y__restore(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__restore(SB)
	RET

// func Y__restore_rt(tls *TLS)
TEXT ·Y__restore_rt(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__restore_rt(SB)
	RET

// func Y__restore_sigs(tls *TLS, set uintptr)
TEXT ·Y__restore_sigs(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__restore_sigs(SB)
	RET

// func Y__rtnetlink_enumerate(tls *TLS, link_af int32, addr_af int32, __ccgo_fp_cb uintptr, ctx uintptr) (r1 int32)
TEXT ·Y__rtnetlink_enumerate(SB),$48-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cb+16(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal___rtnetlink_enumerate_2(SB)	// Create the closure for calling __ccgo_fp_cb
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL link_af+8(FP), AX
	MOVL AX, 8(SP)
	MOVL addr_af+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 24(SP)
	MOVQ ctx+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__rtnetlink_enumerate(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0___rtnetlink_enumerate_2(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Y__secs_to_tm(tls *TLS, t int64, tm uintptr) (r int32)
TEXT ·Y__secs_to_tm(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ tm+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__secs_to_tm(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__secs_to_zone(tls *TLS, t int64, local int32, isdst uintptr, offset uintptr, oppoff uintptr, zonename uintptr)
TEXT ·Y__secs_to_zone(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL local+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ isdst+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ offset+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ oppoff+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ zonename+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·X__secs_to_zone(SB)
	RET

// func Y__setxid(tls *TLS, nr int32, id int32, eid int32, sid int32) (r int32)
TEXT ·Y__setxid(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL nr+8(FP), AX
	MOVL AX, 8(SP)
	MOVL id+12(FP), AX
	MOVL AX, 12(SP)
	MOVL eid+16(FP), AX
	MOVL AX, 16(SP)
	MOVL sid+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__setxid(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__shgetc(tls *TLS, f uintptr) (r int32)
TEXT ·Y__shgetc(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__shgetc(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__shlim(tls *TLS, f uintptr, lim Toff_t)
TEXT ·Y__shlim(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ lim+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__shlim(SB)
	RET

// func Y__shm_mapname(tls *TLS, name uintptr, buf uintptr) (r uintptr)
TEXT ·Y__shm_mapname(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__shm_mapname(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__sigaction(tls *TLS, sig int32, sa uintptr, old uintptr) (r1 int32)
TEXT ·Y__sigaction(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sig+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ sa+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ old+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__sigaction(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Y__signbit(tls *TLS, x float64) (r int32)
TEXT ·Y__signbit(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__signbit(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__signbitf(tls *TLS, x float32) (r int32)
TEXT ·Y__signbitf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X__signbitf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__signbitl(tls *TLS, x float64) (r int32)
TEXT ·Y__signbitl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__signbitl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__sigsetjmp_tail(tls *TLS, jb uintptr, ret int32) (r int32)
TEXT ·Y__sigsetjmp_tail(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ jb+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL ret+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__sigsetjmp_tail(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__sin(tls *TLS, x float64, y float64, iy int32) (r1 float64)
TEXT ·Y__sin(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL iy+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__sin(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r1+32(FP)
	RET

// func Y__sindf(tls *TLS, x float64) (r1 float32)
TEXT ·Y__sindf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__sindf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Y__stack_chk_fail(tls *TLS)
TEXT ·Y__stack_chk_fail(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__stack_chk_fail(SB)
	RET

// func Y__stack_chk_fail_local(tls *TLS)
TEXT ·Y__stack_chk_fail_local(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__stack_chk_fail_local(SB)
	RET

// func Y__stdio_close(tls *TLS, f uintptr) (r int32)
TEXT ·Y__stdio_close(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__stdio_close(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__stdio_exit(tls *TLS)
TEXT ·Y__stdio_exit(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__stdio_exit(SB)
	RET

// func Y__stdio_exit_needed(tls *TLS)
TEXT ·Y__stdio_exit_needed(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__stdio_exit_needed(SB)
	RET

// func Y__stdio_read(tls *TLS, f uintptr, buf uintptr, len1 Tsize_t) (r Tsize_t)
TEXT ·Y__stdio_read(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__stdio_read(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__stdio_seek(tls *TLS, f uintptr, off Toff_t, whence int32) (r Toff_t)
TEXT ·Y__stdio_seek(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ off+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL whence+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__stdio_seek(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__stdio_write(tls *TLS, f uintptr, buf uintptr, len1 Tsize_t) (r Tsize_t)
TEXT ·Y__stdio_write(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__stdio_write(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__stdout_write(tls *TLS, f uintptr, buf uintptr, len1 Tsize_t) (r Tsize_t)
TEXT ·Y__stdout_write(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__stdout_write(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__stpcpy(tls *TLS, d uintptr, s uintptr) (r uintptr)
TEXT ·Y__stpcpy(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__stpcpy(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__stpncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Y__stpncpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__stpncpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strcasecmp_l(tls *TLS, l uintptr, r uintptr, loc Tlocale_t) (r1 int32)
TEXT ·Y__strcasecmp_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ loc+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__strcasecmp_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Y__strchrnul(tls *TLS, s uintptr, c int32) (r uintptr)
TEXT ·Y__strchrnul(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__strchrnul(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__strcoll_l(tls *TLS, l uintptr, r uintptr, loc Tlocale_t) (r1 int32)
TEXT ·Y__strcoll_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ loc+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__strcoll_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Y__strerror_l(tls *TLS, e int32, loc Tlocale_t) (r uintptr)
TEXT ·Y__strerror_l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL e+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ loc+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__strerror_l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__strftime_fmt_1(tls *TLS, s uintptr, l uintptr, f int32, tm uintptr, loc Tlocale_t, pad int32) (r uintptr)
TEXT ·Y__strftime_fmt_1(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL f+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ tm+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ loc+40(FP), AX
	MOVQ AX, 40(SP)
	MOVL pad+48(FP), AX
	MOVL AX, 48(SP)
	CALL ·X__strftime_fmt_1(SB)
	MOVQ 56(SP), AX
	MOVQ AX, r+56(FP)
	RET

// func Y__strftime_l(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr, loc Tlocale_t) (r Tsize_t)
TEXT ·Y__strftime_l(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ tm+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ loc+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__strftime_l(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Y__strncasecmp_l(tls *TLS, l uintptr, r uintptr, n Tsize_t, loc Tlocale_t) (r1 int32)
TEXT ·Y__strncasecmp_l(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ loc+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__strncasecmp_l(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Y__strtod_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float64)
TEXT ·Y__strtod_l(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__strtod_l(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strtof_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float32)
TEXT ·Y__strtof_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__strtof_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__strtoimax_internal(tls *TLS, s uintptr, p uintptr, base int32) (r Tintmax_t)
TEXT ·Y__strtoimax_internal(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__strtoimax_internal(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strtol_internal(tls *TLS, s uintptr, p uintptr, base int32) (r int64)
TEXT ·Y__strtol_internal(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__strtol_internal(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strtold_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float64)
TEXT ·Y__strtold_l(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__strtold_l(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strtoll_internal(tls *TLS, s uintptr, p uintptr, base int32) (r int64)
TEXT ·Y__strtoll_internal(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__strtoll_internal(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strtoul_internal(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)
TEXT ·Y__strtoul_internal(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__strtoul_internal(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strtoull_internal(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)
TEXT ·Y__strtoull_internal(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__strtoull_internal(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strtoumax_internal(tls *TLS, s uintptr, p uintptr, base int32) (r Tuintmax_t)
TEXT ·Y__strtoumax_internal(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__strtoumax_internal(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__strxfrm_l(tls *TLS, dest uintptr, src uintptr, n Tsize_t, loc Tlocale_t) (r Tsize_t)
TEXT ·Y__strxfrm_l(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ loc+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__strxfrm_l(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Y__sync_synchronize(t *TLS)
TEXT ·Y__sync_synchronize(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__sync_synchronize(SB)
	RET

// func Y__sync_val_compare_and_swapInt16(t *TLS, ptr uintptr, oldval, newval int16) (r int16)
TEXT ·Y__sync_val_compare_and_swapInt16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW oldval+16(FP), AX
	MOVW AX, 16(SP)
	MOVW newval+18(FP), AX
	MOVW AX, 18(SP)
	CALL ·X__sync_val_compare_and_swapInt16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__sync_val_compare_and_swapInt32(t *TLS, ptr uintptr, oldval, newval int32) (r int32)
TEXT ·Y__sync_val_compare_and_swapInt32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL oldval+16(FP), AX
	MOVL AX, 16(SP)
	MOVL newval+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__sync_val_compare_and_swapInt32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__sync_val_compare_and_swapInt64(t *TLS, ptr uintptr, oldval, newval int64) (r int64)
TEXT ·Y__sync_val_compare_and_swapInt64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ oldval+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ newval+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__sync_val_compare_and_swapInt64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__sync_val_compare_and_swapInt8(t *TLS, ptr uintptr, oldval, newval int8) (r int8)
TEXT ·Y__sync_val_compare_and_swapInt8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB oldval+16(FP), AX
	MOVB AX, 16(SP)
	MOVB newval+17(FP), AX
	MOVB AX, 17(SP)
	CALL ·X__sync_val_compare_and_swapInt8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__sync_val_compare_and_swapUint16(t *TLS, ptr uintptr, oldval, newval uint16) (r uint16)
TEXT ·Y__sync_val_compare_and_swapUint16(SB),$32-26
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW oldval+16(FP), AX
	MOVW AX, 16(SP)
	MOVW newval+18(FP), AX
	MOVW AX, 18(SP)
	CALL ·X__sync_val_compare_and_swapUint16(SB)
	MOVW 24(SP), AX
	MOVW AX, r+24(FP)
	RET

// func Y__sync_val_compare_and_swapUint32(t *TLS, ptr uintptr, oldval, newval uint32) (r uint32)
TEXT ·Y__sync_val_compare_and_swapUint32(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL oldval+16(FP), AX
	MOVL AX, 16(SP)
	MOVL newval+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·X__sync_val_compare_and_swapUint32(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__sync_val_compare_and_swapUint64(t *TLS, ptr uintptr, oldval, newval uint64) (r uint64)
TEXT ·Y__sync_val_compare_and_swapUint64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ oldval+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ newval+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__sync_val_compare_and_swapUint64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Y__sync_val_compare_and_swapUint8(t *TLS, ptr uintptr, oldval, newval uint8) (r uint8)
TEXT ·Y__sync_val_compare_and_swapUint8(SB),$32-25
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVB oldval+16(FP), AX
	MOVB AX, 16(SP)
	MOVB newval+17(FP), AX
	MOVB AX, 17(SP)
	CALL ·X__sync_val_compare_and_swapUint8(SB)
	MOVB 24(SP), AX
	MOVB AX, r+24(FP)
	RET

// func Y__syscall0(tls *TLS, n long) (_2 long)
TEXT ·Y__syscall0(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__syscall0(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Y__syscall1(tls *TLS, n, a1 long) (_2 long)
TEXT ·Y__syscall1(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__syscall1(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _2+24(FP)
	RET

// func Y__syscall2(tls *TLS, n, a1, a2 long) (_2 long)
TEXT ·Y__syscall2(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ a2+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__syscall2(SB)
	MOVQ 32(SP), AX
	MOVQ AX, _2+32(FP)
	RET

// func Y__syscall3(tls *TLS, n, a1, a2, a3 long) (_2 long)
TEXT ·Y__syscall3(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ a2+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ a3+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__syscall3(SB)
	MOVQ 40(SP), AX
	MOVQ AX, _2+40(FP)
	RET

// func Y__syscall4(tls *TLS, n, a1, a2, a3, a4 long) (_2 long)
TEXT ·Y__syscall4(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ a2+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ a3+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ a4+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__syscall4(SB)
	MOVQ 48(SP), AX
	MOVQ AX, _2+48(FP)
	RET

// func Y__syscall5(tls *TLS, n, a1, a2, a3, a4, a5 long) (_2 long)
TEXT ·Y__syscall5(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ a2+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ a3+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ a4+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ a5+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·X__syscall5(SB)
	MOVQ 56(SP), AX
	MOVQ AX, _2+56(FP)
	RET

// func Y__syscall6(tls *TLS, n, a1, a2, a3, a4, a5, a6 long) (_2 long)
TEXT ·Y__syscall6(SB),$72-72
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ a2+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ a3+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ a4+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ a5+48(FP), AX
	MOVQ AX, 48(SP)
	MOVQ a6+56(FP), AX
	MOVQ AX, 56(SP)
	CALL ·X__syscall6(SB)
	MOVQ 64(SP), AX
	MOVQ AX, _2+64(FP)
	RET

// func Y__syscall_ret(tls *TLS, r uint64) (r1 int64)
TEXT ·Y__syscall_ret(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ r+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__syscall_ret(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Y__tan(tls *TLS, x float64, y float64, odd int32) (r1 float64)
TEXT ·Y__tan(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL odd+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·X__tan(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r1+32(FP)
	RET

// func Y__tandf(tls *TLS, x float64, odd int32) (r1 float32)
TEXT ·Y__tandf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL odd+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X__tandf(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Y__tm_to_secs(tls *TLS, tm uintptr) (r int64)
TEXT ·Y__tm_to_secs(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tm+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__tm_to_secs(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__tm_to_tzname(tls *TLS, tm uintptr) (r uintptr)
TEXT ·Y__tm_to_tzname(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tm+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__tm_to_tzname(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__tolower_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__tolower_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__tolower_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__toread(tls *TLS, f uintptr) (r int32)
TEXT ·Y__toread(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__toread(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__toread_needs_stdio_exit(tls *TLS)
TEXT ·Y__toread_needs_stdio_exit(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__toread_needs_stdio_exit(SB)
	RET

// func Y__toupper_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Y__toupper_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__toupper_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__towctrans_l(tls *TLS, c Twint_t, t Twctrans_t, l Tlocale_t) (r Twint_t)
TEXT ·Y__towctrans_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ t+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__towctrans_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__towlower_l(tls *TLS, c Twint_t, l Tlocale_t) (r Twint_t)
TEXT ·Y__towlower_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__towlower_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__towrite(tls *TLS, f uintptr) (r int32)
TEXT ·Y__towrite(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__towrite(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__towrite_needs_stdio_exit(tls *TLS)
TEXT ·Y__towrite_needs_stdio_exit(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__towrite_needs_stdio_exit(SB)
	RET

// func Y__towupper_l(tls *TLS, c Twint_t, l Tlocale_t) (r Twint_t)
TEXT ·Y__towupper_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__towupper_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Y__tre_mem_alloc_impl(tls *TLS, mem Ttre_mem_t, provided int32, provided_block uintptr, zero int32, size Tsize_t) (r uintptr)
TEXT ·Y__tre_mem_alloc_impl(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ mem+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL provided+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ provided_block+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL zero+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ size+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__tre_mem_alloc_impl(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Y__tre_mem_destroy(tls *TLS, mem Ttre_mem_t)
TEXT ·Y__tre_mem_destroy(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ mem+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__tre_mem_destroy(SB)
	RET

// func Y__tre_mem_new_impl(tls *TLS, provided int32, provided_block uintptr) (r Ttre_mem_t)
TEXT ·Y__tre_mem_new_impl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL provided+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ provided_block+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__tre_mem_new_impl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__tsearch_balance(tls *TLS, p uintptr) (r int32)
TEXT ·Y__tsearch_balance(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__tsearch_balance(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__uflow(tls *TLS, f uintptr) (r int32)
TEXT ·Y__uflow(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__uflow(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Y__unlist_locked_file(tls *TLS, f uintptr)
TEXT ·Y__unlist_locked_file(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__unlist_locked_file(SB)
	RET

// func Y__unlockfile(tls *TLS, file uintptr)
TEXT ·Y__unlockfile(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ file+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__unlockfile(SB)
	RET

// func Y__uselocale(tls *TLS, new1 Tlocale_t) (r Tlocale_t)
TEXT ·Y__uselocale(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ new1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__uselocale(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__vm_wait(tls *TLS)
TEXT ·Y__vm_wait(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X__vm_wait(SB)
	RET

// func Y__wcscoll_l(tls *TLS, l uintptr, r uintptr, locale Tlocale_t) (r1 int32)
TEXT ·Y__wcscoll_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ locale+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__wcscoll_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Y__wcsftime_l(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr, loc Tlocale_t) (r Tsize_t)
TEXT ·Y__wcsftime_l(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ tm+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ loc+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·X__wcsftime_l(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Y__wcsxfrm_l(tls *TLS, dest uintptr, src uintptr, n Tsize_t, loc Tlocale_t) (r Tsize_t)
TEXT ·Y__wcsxfrm_l(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ loc+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__wcsxfrm_l(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Y__wctrans_l(tls *TLS, s uintptr, l Tlocale_t) (r Twctrans_t)
TEXT ·Y__wctrans_l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__wctrans_l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__wctype_l(tls *TLS, s uintptr, l Tlocale_t) (r Twctype_t)
TEXT ·Y__wctype_l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__wctype_l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y__xmknod(tls *TLS, ver int32, path uintptr, mode Tmode_t, dev uintptr) (r int32)
TEXT ·Y__xmknod(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ver+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL mode+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ dev+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__xmknod(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Y__xmknodat(tls *TLS, ver int32, fd int32, path uintptr, mode Tmode_t, dev uintptr) (r int32)
TEXT ·Y__xmknodat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ver+8(FP), AX
	MOVL AX, 8(SP)
	MOVL fd+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL mode+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ dev+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X__xmknodat(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Y__xpg_basename(tls *TLS, s uintptr) (r uintptr)
TEXT ·Y__xpg_basename(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X__xpg_basename(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Y__xpg_strerror_r(tls *TLS, err int32, buf uintptr, buflen Tsize_t) (r int32)
TEXT ·Y__xpg_strerror_r(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL err+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buflen+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__xpg_strerror_r(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__xstat(tls *TLS, ver int32, path uintptr, buf uintptr) (r int32)
TEXT ·Y__xstat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ver+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X__xstat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Y__year_to_secs(tls *TLS, year int64, is_leap uintptr) (r int64)
TEXT ·Y__year_to_secs(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ year+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ is_leap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·X__year_to_secs(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Y_exit(tls *TLS, status int32)
TEXT ·Y_exit(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL status+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·X_exit(SB)
	RET

// func Y_flushlbf(tls *TLS)
TEXT ·Y_flushlbf(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·X_flushlbf(SB)
	RET

// func Y_longjmp(t *TLS, env uintptr, val int32)
TEXT ·Y_longjmp(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ env+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X_longjmp(SB)
	RET

// func Y_obstack_begin(t *TLS, obstack uintptr, size, alignment int32, chunkfun, freefun uintptr) (_4 int32)
TEXT ·Y_obstack_begin(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ obstack+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL size+16(FP), AX
	MOVL AX, 16(SP)
	MOVL alignment+20(FP), AX
	MOVL AX, 20(SP)
	MOVQ chunkfun+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ freefun+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·X_obstack_begin(SB)
	MOVL 40(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Y_obstack_newchunk(t *TLS, obstack uintptr, length int32) (_3 int32)
TEXT ·Y_obstack_newchunk(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ obstack+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL length+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X_obstack_newchunk(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Y_pthread_cleanup_pop(tls *TLS, _ uintptr, run int32)
TEXT ·Y_pthread_cleanup_pop(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL run+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·X_pthread_cleanup_pop(SB)
	RET

// func Y_pthread_cleanup_push(tls *TLS, _, f, x uintptr)
TEXT ·Y_pthread_cleanup_push(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ x+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·X_pthread_cleanup_push(SB)
	RET

// func Y_setjmp(t *TLS, env uintptr) (_2 int32)
TEXT ·Y_setjmp(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ env+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·X_setjmp(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ya64l(tls *TLS, s uintptr) (r int64)
TEXT ·Ya64l(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xa64l(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yabort(tls *TLS)
TEXT ·Yabort(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xabort(SB)
	RET

// func Yabs(tls *TLS, a int32) (r int32)
TEXT ·Yabs(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL a+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xabs(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yaccept(tls *TLS, fd int32, addr uintptr, len1 uintptr) (r1 int32)
TEXT ·Yaccept(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ addr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xaccept(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Yaccept4(tls *TLS, fd int32, addr uintptr, len1 uintptr, flg int32) (r1 int32)
TEXT ·Yaccept4(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ addr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flg+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xaccept4(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Yaccess(tls *TLS, filename uintptr, amode int32) (r int32)
TEXT ·Yaccess(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL amode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xaccess(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yacct(tls *TLS, filename uintptr) (r int32)
TEXT ·Yacct(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xacct(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yacos(tls *TLS, x float64) (r float64)
TEXT ·Yacos(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xacos(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yacosf(tls *TLS, x float32) (r float32)
TEXT ·Yacosf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xacosf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yacosh(tls *TLS, x float64) (r float64)
TEXT ·Yacosh(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xacosh(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yacoshf(tls *TLS, x float32) (r float32)
TEXT ·Yacoshf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xacoshf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yacoshl(tls *TLS, x float64) (r float64)
TEXT ·Yacoshl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xacoshl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yacosl(tls *TLS, x float64) (r float64)
TEXT ·Yacosl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xacosl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yaddmntent(tls *TLS, f uintptr, mnt uintptr) (r int32)
TEXT ·Yaddmntent(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mnt+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xaddmntent(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yadjtime(tls *TLS, in uintptr, out uintptr) (r int32)
TEXT ·Yadjtime(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ in+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ out+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xadjtime(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yadjtimex(tls *TLS, tx uintptr) (r int32)
TEXT ·Yadjtimex(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tx+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xadjtimex(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yalarm(tls *TLS, seconds uint32) (r uint32)
TEXT ·Yalarm(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL seconds+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xalarm(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yalloca(tls *TLS, size Tsize_t) (_2 uintptr)
TEXT ·Yalloca(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ size+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xalloca(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Yalphasort(tls *TLS, a uintptr, b uintptr) (r int32)
TEXT ·Yalphasort(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xalphasort(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yarch_prctl(tls *TLS, code int32, addr uint64) (r int32)
TEXT ·Yarch_prctl(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL code+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ addr+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xarch_prctl(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yasctime(tls *TLS, tm uintptr) (r uintptr)
TEXT ·Yasctime(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tm+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xasctime(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yasctime_r(tls *TLS, tm uintptr, buf uintptr) (r uintptr)
TEXT ·Yasctime_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tm+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xasctime_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yasin(tls *TLS, x float64) (r1 float64)
TEXT ·Yasin(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xasin(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Yasinf(tls *TLS, x float32) (r float32)
TEXT ·Yasinf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xasinf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yasinh(tls *TLS, x3 float64) (r float64)
TEXT ·Yasinh(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xasinh(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yasinhf(tls *TLS, x3 float32) (r float32)
TEXT ·Yasinhf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xasinhf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yasinhl(tls *TLS, x float64) (r float64)
TEXT ·Yasinhl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xasinhl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yasinl(tls *TLS, x float64) (r float64)
TEXT ·Yasinl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xasinl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yasprintf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Yasprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xasprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yat_quick_exit(tls *TLS, __ccgo_fp_func uintptr) (r1 int32)
TEXT ·Yat_quick_exit(SB),$32-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_func+8(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_at_quick_exit_0(SB)	// Create the closure for calling __ccgo_fp_func
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	CALL ·Xat_quick_exit(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_at_quick_exit_0(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ __ccgo_fp+8(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	RET

// func Yatan(tls *TLS, x3 float64) (r float64)
TEXT ·Yatan(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatan(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yatan2(tls *TLS, y float64, x float64) (r float64)
TEXT ·Yatan2(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ y+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ x+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xatan2(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yatan2f(tls *TLS, y float32, x float32) (r float32)
TEXT ·Yatan2f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL y+8(FP), AX
	MOVL AX, 8(SP)
	MOVL x+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xatan2f(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yatan2l(tls *TLS, y float64, x float64) (r float64)
TEXT ·Yatan2l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ y+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ x+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xatan2l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yatanf(tls *TLS, x3 float32) (r float32)
TEXT ·Yatanf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xatanf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yatanh(tls *TLS, x3 float64) (r float64)
TEXT ·Yatanh(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatanh(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yatanhf(tls *TLS, x3 float32) (r float32)
TEXT ·Yatanhf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xatanhf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yatanhl(tls *TLS, x float64) (r float64)
TEXT ·Yatanhl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatanhl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yatanl(tls *TLS, x float64) (r float64)
TEXT ·Yatanl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatanl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yatexit(tls *TLS, func_ uintptr) (r int32)
TEXT ·Yatexit(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ func_+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatexit(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yatof(tls *TLS, s uintptr) (r float64)
TEXT ·Yatof(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatof(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yatoi(tls *TLS, s uintptr) (r int32)
TEXT ·Yatoi(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatoi(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yatol(tls *TLS, s uintptr) (r int64)
TEXT ·Yatol(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatol(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yatoll(tls *TLS, s uintptr) (r int64)
TEXT ·Yatoll(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xatoll(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ybacktrace(t *TLS, buf uintptr, size int32) (_3 int32)
TEXT ·Ybacktrace(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL size+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xbacktrace(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Ybacktrace_symbols_fd(t *TLS, buffer uintptr, size, fd int32)
TEXT ·Ybacktrace_symbols_fd(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buffer+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL size+16(FP), AX
	MOVL AX, 16(SP)
	MOVL fd+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xbacktrace_symbols_fd(SB)
	RET

// func Ybasename(tls *TLS, s uintptr) (r uintptr)
TEXT ·Ybasename(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xbasename(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ybcmp(tls *TLS, s1 uintptr, s2 uintptr, n Tsize_t) (r int32)
TEXT ·Ybcmp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xbcmp(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ybcopy(tls *TLS, s1 uintptr, s2 uintptr, n Tsize_t)
TEXT ·Ybcopy(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xbcopy(SB)
	RET

// func Ybind(tls *TLS, fd int32, addr uintptr, len1 Tsocklen_t) (r1 int32)
TEXT ·Ybind(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ addr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL len1+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xbind(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ybind_textdomain_codeset(tls *TLS, domainname uintptr, codeset uintptr) (r uintptr)
TEXT ·Ybind_textdomain_codeset(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ domainname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ codeset+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xbind_textdomain_codeset(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ybindtextdomain(tls *TLS, domainname uintptr, dirname uintptr) (r uintptr)
TEXT ·Ybindtextdomain(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ domainname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ dirname+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xbindtextdomain(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ybrk(tls *TLS, end uintptr) (r int32)
TEXT ·Ybrk(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ end+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xbrk(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ybsearch(tls *TLS, key uintptr, base uintptr, nel Tsize_t, width Tsize_t, __ccgo_fp_cmp uintptr) (r uintptr)
TEXT ·Ybsearch(SB),$64-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cmp+40(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_bsearch_4(SB)	// Create the closure for calling __ccgo_fp_cmp
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ base+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ nel+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ width+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 40(SP)
	CALL ·Xbsearch(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_bsearch_4(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Ybtowc(tls *TLS, c int32) (r Twint_t)
TEXT ·Ybtowc(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xbtowc(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ybzero(tls *TLS, s uintptr, n Tsize_t)
TEXT ·Ybzero(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xbzero(SB)
	RET

// func Yc16rtomb(tls *TLS, s uintptr, c16 Tchar16_t, ps uintptr) (r Tsize_t)
TEXT ·Yc16rtomb(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW c16+16(FP), AX
	MOVW AX, 16(SP)
	MOVQ ps+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xc16rtomb(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yc32rtomb(tls *TLS, s uintptr, c32 Tchar32_t, ps uintptr) (r Tsize_t)
TEXT ·Yc32rtomb(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c32+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ ps+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xc32rtomb(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ycabs(tls *TLS, z complex128) (r float64)
TEXT ·Ycabs(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcabs(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycabsf(tls *TLS, z complex64) (r float32)
TEXT ·Ycabsf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcabsf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycabsl(tls *TLS, z complex128) (r float64)
TEXT ·Ycabsl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcabsl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycacos(tls *TLS, z complex128) (r complex128)
TEXT ·Ycacos(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcacos(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycacosf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycacosf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcacosf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycacosh(tls *TLS, z complex128) (r complex128)
TEXT ·Ycacosh(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcacosh(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycacoshf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycacoshf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcacoshf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycacoshl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycacoshl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcacoshl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycacosl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycacosl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcacosl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycalloc(tls *TLS, m Tsize_t, n Tsize_t) (r uintptr)
TEXT ·Ycalloc(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcalloc(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycapget(tls *TLS, a uintptr, b uintptr) (r int32)
TEXT ·Ycapget(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcapget(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ycapset(tls *TLS, a uintptr, b uintptr) (r int32)
TEXT ·Ycapset(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcapset(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ycarg(tls *TLS, z complex128) (r float64)
TEXT ·Ycarg(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcarg(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycargf(tls *TLS, z complex64) (r float32)
TEXT ·Ycargf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcargf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycargl(tls *TLS, z complex128) (r float64)
TEXT ·Ycargl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcargl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycasin(tls *TLS, z complex128) (r1 complex128)
TEXT ·Ycasin(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcasin(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r1_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r1_imag+32(FP)
	RET

// func Ycasinf(tls *TLS, z complex64) (r1 complex64)
TEXT ·Ycasinf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcasinf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r1_imag+20(FP)
	RET

// func Ycasinh(tls *TLS, z complex128) (r complex128)
TEXT ·Ycasinh(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcasinh(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycasinhf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycasinhf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcasinhf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycasinhl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycasinhl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcasinhl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycasinl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycasinl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcasinl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycatan(tls *TLS, z complex128) (r complex128)
TEXT ·Ycatan(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcatan(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycatanf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycatanf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcatanf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycatanh(tls *TLS, z complex128) (r complex128)
TEXT ·Ycatanh(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcatanh(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycatanhf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycatanhf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcatanhf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycatanhl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycatanhl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcatanhl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycatanl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycatanl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcatanl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycatclose(tls *TLS, catd Tnl_catd) (r int32)
TEXT ·Ycatclose(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ catd+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcatclose(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycatgets(tls *TLS, catd Tnl_catd, set_id int32, msg_id int32, s uintptr) (r uintptr)
TEXT ·Ycatgets(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ catd+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL set_id+16(FP), AX
	MOVL AX, 16(SP)
	MOVL msg_id+20(FP), AX
	MOVL AX, 20(SP)
	MOVQ s+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xcatgets(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ycatopen(tls *TLS, name uintptr, oflag int32) (r Tnl_catd)
TEXT ·Ycatopen(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL oflag+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xcatopen(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycbrt(tls *TLS, x float64) (r1 float64)
TEXT ·Ycbrt(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcbrt(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Ycbrtf(tls *TLS, x float32) (r1 float32)
TEXT ·Ycbrtf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xcbrtf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Ycbrtl(tls *TLS, x float64) (r float64)
TEXT ·Ycbrtl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcbrtl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yccos(tls *TLS, z complex128) (r complex128)
TEXT ·Yccos(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xccos(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yccosf(tls *TLS, z complex64) (r complex64)
TEXT ·Yccosf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xccosf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Yccosh(tls *TLS, z complex128) (r complex128)
TEXT ·Yccosh(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xccosh(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yccoshf(tls *TLS, z complex64) (r complex64)
TEXT ·Yccoshf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xccoshf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Yccoshl(tls *TLS, z complex128) (r complex128)
TEXT ·Yccoshl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xccoshl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yccosl(tls *TLS, z complex128) (r complex128)
TEXT ·Yccosl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xccosl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yceil(tls *TLS, x3 float64) (r float64)
TEXT ·Yceil(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xceil(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yceilf(tls *TLS, x3 float32) (r float32)
TEXT ·Yceilf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xceilf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yceill(tls *TLS, x float64) (r float64)
TEXT ·Yceill(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xceill(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ycexp(tls *TLS, z complex128) (r complex128)
TEXT ·Ycexp(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcexp(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycexpf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycexpf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcexpf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycexpl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycexpl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcexpl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycfgetispeed(tls *TLS, tio uintptr) (r Tspeed_t)
TEXT ·Ycfgetispeed(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tio+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcfgetispeed(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycfgetospeed(tls *TLS, tio uintptr) (r Tspeed_t)
TEXT ·Ycfgetospeed(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tio+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcfgetospeed(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycfmakeraw(tls *TLS, t uintptr)
TEXT ·Ycfmakeraw(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcfmakeraw(SB)
	RET

// func Ycfsetispeed(tls *TLS, tio uintptr, speed Tspeed_t) (r int32)
TEXT ·Ycfsetispeed(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tio+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL speed+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xcfsetispeed(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ycfsetospeed(tls *TLS, tio uintptr, speed Tspeed_t) (r int32)
TEXT ·Ycfsetospeed(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tio+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL speed+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xcfsetospeed(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ycfsetspeed(tls *TLS, tio uintptr, speed Tspeed_t) (r int32)
TEXT ·Ycfsetspeed(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tio+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL speed+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xcfsetspeed(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ychdir(tls *TLS, path uintptr) (r int32)
TEXT ·Ychdir(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xchdir(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ychmod(tls *TLS, path uintptr, mode Tmode_t) (r int32)
TEXT ·Ychmod(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL mode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xchmod(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ychown(tls *TLS, path uintptr, uid Tuid_t, gid Tgid_t) (r int32)
TEXT ·Ychown(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL uid+16(FP), AX
	MOVL AX, 16(SP)
	MOVL gid+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xchown(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ychroot(tls *TLS, path uintptr) (r int32)
TEXT ·Ychroot(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xchroot(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycimag(tls *TLS, z complex128) (r float64)
TEXT ·Ycimag(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcimag(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycimagf(tls *TLS, z complex64) (r float32)
TEXT ·Ycimagf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcimagf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycimagl(tls *TLS, z complex128) (r float64)
TEXT ·Ycimagl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcimagl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yclearenv(tls *TLS) (r int32)
TEXT ·Yclearenv(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xclearenv(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yclearerr(tls *TLS, f uintptr)
TEXT ·Yclearerr(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xclearerr(SB)
	RET

// func Yclearerr_unlocked(tls *TLS, f uintptr)
TEXT ·Yclearerr_unlocked(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xclearerr_unlocked(SB)
	RET

// func Yclock(tls *TLS) (r Tclock_t)
TEXT ·Yclock(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xclock(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Yclock_adjtime(tls *TLS, clock_id Tclockid_t, utx uintptr) (r1 int32)
TEXT ·Yclock_adjtime(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL clock_id+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ utx+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xclock_adjtime(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Yclock_getcpuclockid(tls *TLS, pid Tpid_t, clk uintptr) (r int32)
TEXT ·Yclock_getcpuclockid(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ clk+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xclock_getcpuclockid(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yclock_getres(tls *TLS, clk Tclockid_t, ts uintptr) (r int32)
TEXT ·Yclock_getres(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL clk+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ ts+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xclock_getres(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yclock_gettime(tls *TLS, clk Tclockid_t, ts uintptr) (r int32)
TEXT ·Yclock_gettime(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL clk+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ ts+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xclock_gettime(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yclock_nanosleep(tls *TLS, clk Tclockid_t, flags int32, req uintptr, rem uintptr) (r int32)
TEXT ·Yclock_nanosleep(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL clk+8(FP), AX
	MOVL AX, 8(SP)
	MOVL flags+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ req+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ rem+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xclock_nanosleep(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yclock_settime(tls *TLS, clk Tclockid_t, ts uintptr) (r int32)
TEXT ·Yclock_settime(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL clk+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ ts+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xclock_settime(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yclog(tls *TLS, z complex128) (r1 complex128)
TEXT ·Yclog(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xclog(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r1_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r1_imag+32(FP)
	RET

// func Yclogf(tls *TLS, z complex64) (r1 complex64)
TEXT ·Yclogf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xclogf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r1_imag+20(FP)
	RET

// func Yclogl(tls *TLS, z complex128) (r complex128)
TEXT ·Yclogl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xclogl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yclose(tls *TLS, fd int32) (r1 int32)
TEXT ·Yclose(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xclose(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yclosedir(tls *TLS, dir uintptr) (r int32)
TEXT ·Yclosedir(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dir+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xclosedir(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycloselog(tls *TLS)
TEXT ·Ycloselog(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xcloselog(SB)
	RET

// func Yconfstr(tls *TLS, name int32, buf uintptr, len1 Tsize_t) (r Tsize_t)
TEXT ·Yconfstr(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL name+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xconfstr(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yconj(tls *TLS, z complex128) (r complex128)
TEXT ·Yconj(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xconj(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yconjf(tls *TLS, z complex64) (r complex64)
TEXT ·Yconjf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xconjf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Yconjl(tls *TLS, z complex128) (r complex128)
TEXT ·Yconjl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xconjl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yconnect(tls *TLS, fd int32, addr uintptr, len1 Tsocklen_t) (r1 int32)
TEXT ·Yconnect(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ addr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL len1+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xconnect(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ycopy_file_range(tls *TLS, fd_in int32, off_in uintptr, fd_out int32, off_out uintptr, len1 Tsize_t, flags uint32) (r Tssize_t)
TEXT ·Ycopy_file_range(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd_in+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ off_in+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL fd_out+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ off_out+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ len1+40(FP), AX
	MOVQ AX, 40(SP)
	MOVL flags+48(FP), AX
	MOVL AX, 48(SP)
	CALL ·Xcopy_file_range(SB)
	MOVQ 56(SP), AX
	MOVQ AX, r+56(FP)
	RET

// func Ycopysign(tls *TLS, x float64, y float64) (r float64)
TEXT ·Ycopysign(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcopysign(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycopysignf(tls *TLS, x float32, y float32) (r float32)
TEXT ·Ycopysignf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcopysignf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycopysignl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Ycopysignl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcopysignl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycos(tls *TLS, x3 float64) (r float64)
TEXT ·Ycos(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcos(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ycosf(tls *TLS, x3 float32) (r float32)
TEXT ·Ycosf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xcosf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycosh(tls *TLS, x3 float64) (r float64)
TEXT ·Ycosh(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcosh(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ycoshf(tls *TLS, x3 float32) (r float32)
TEXT ·Ycoshf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xcoshf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycoshl(tls *TLS, x float64) (r float64)
TEXT ·Ycoshl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcoshl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ycosl(tls *TLS, x float64) (r float64)
TEXT ·Ycosl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcosl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ycpow(tls *TLS, z complex128, c complex128) (r complex128)
TEXT ·Ycpow(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ c_real+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ c_imag+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xcpow(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r_real+40(FP)
	MOVQ 48(SP), AX
	MOVQ AX, r_imag+48(FP)
	RET

// func Ycpowf(tls *TLS, z complex64, c complex64) (r complex64)
TEXT ·Ycpowf(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	MOVL c_real+16(FP), AX
	MOVL AX, 16(SP)
	MOVL c_imag+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xcpowf(SB)
	MOVL 24(SP), AX
	MOVL AX, r_real+24(FP)
	MOVL 28(SP), AX
	MOVL AX, r_imag+28(FP)
	RET

// func Ycpowl(tls *TLS, z complex128, c complex128) (r complex128)
TEXT ·Ycpowl(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ c_real+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ c_imag+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xcpowl(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r_real+40(FP)
	MOVQ 48(SP), AX
	MOVQ AX, r_imag+48(FP)
	RET

// func Ycproj(tls *TLS, z complex128) (r complex128)
TEXT ·Ycproj(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcproj(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycprojf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycprojf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcprojf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycprojl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycprojl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcprojl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycreal(tls *TLS, z complex128) (r float64)
TEXT ·Ycreal(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcreal(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycrealf(tls *TLS, z complex64) (r float32)
TEXT ·Ycrealf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcrealf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ycreall(tls *TLS, z complex128) (r float64)
TEXT ·Ycreall(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcreall(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycreat(tls *TLS, filename uintptr, mode Tmode_t) (r int32)
TEXT ·Ycreat(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL mode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xcreat(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ycrypt(tls *TLS, key uintptr, salt uintptr) (r uintptr)
TEXT ·Ycrypt(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ salt+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcrypt(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycrypt_r(tls *TLS, key uintptr, salt uintptr, data uintptr) (r uintptr)
TEXT ·Ycrypt_r(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ salt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ data+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xcrypt_r(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ycsin(tls *TLS, z complex128) (r complex128)
TEXT ·Ycsin(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcsin(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycsinf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycsinf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcsinf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycsinh(tls *TLS, z complex128) (r complex128)
TEXT ·Ycsinh(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcsinh(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycsinhf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycsinhf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcsinhf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycsinhl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycsinhl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcsinhl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycsinl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycsinl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcsinl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycsqrt(tls *TLS, z complex128) (r complex128)
TEXT ·Ycsqrt(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcsqrt(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Ycsqrtf(tls *TLS, z complex64) (r complex64)
TEXT ·Ycsqrtf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xcsqrtf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Ycsqrtl(tls *TLS, z complex128) (r complex128)
TEXT ·Ycsqrtl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xcsqrtl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yctan(tls *TLS, z complex128) (r complex128)
TEXT ·Yctan(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xctan(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yctanf(tls *TLS, z complex64) (r complex64)
TEXT ·Yctanf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xctanf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Yctanh(tls *TLS, z complex128) (r complex128)
TEXT ·Yctanh(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xctanh(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yctanhf(tls *TLS, z complex64) (r complex64)
TEXT ·Yctanhf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL z_real+8(FP), AX
	MOVL AX, 8(SP)
	MOVL z_imag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xctanhf(SB)
	MOVL 16(SP), AX
	MOVL AX, r_real+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_imag+20(FP)
	RET

// func Yctanhl(tls *TLS, z complex128) (r complex128)
TEXT ·Yctanhl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xctanhl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yctanl(tls *TLS, z complex128) (r complex128)
TEXT ·Yctanl(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ z_real+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ z_imag+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xctanl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_real+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_imag+32(FP)
	RET

// func Yctermid(tls *TLS, s uintptr) (r uintptr)
TEXT ·Yctermid(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xctermid(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yctime(tls *TLS, t uintptr) (r uintptr)
TEXT ·Yctime(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xctime(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yctime_r(tls *TLS, t uintptr, buf uintptr) (r uintptr)
TEXT ·Yctime_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xctime_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ycuserid(tls *TLS, buf uintptr) (r uintptr)
TEXT ·Ycuserid(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xcuserid(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ydcgettext(tls *TLS, domainname uintptr, msgid uintptr, category int32) (r uintptr)
TEXT ·Ydcgettext(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ domainname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ msgid+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL category+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xdcgettext(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ydcngettext(tls *TLS, domainname uintptr, msgid1 uintptr, msgid2 uintptr, n uint64, category int32) (r1 uintptr)
TEXT ·Ydcngettext(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ domainname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ msgid1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ msgid2+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ n+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL category+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xdcngettext(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r1+48(FP)
	RET

// func Ydelete_module(tls *TLS, a uintptr, b uint32) (r int32)
TEXT ·Ydelete_module(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL b+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xdelete_module(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ydgettext(tls *TLS, domainname uintptr, msgid uintptr) (r uintptr)
TEXT ·Ydgettext(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ domainname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ msgid+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xdgettext(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ydifftime(tls *TLS, t1 Ttime_t, t0 Ttime_t) (r float64)
TEXT ·Ydifftime(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ t0+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xdifftime(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ydirfd(tls *TLS, d uintptr) (r int32)
TEXT ·Ydirfd(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xdirfd(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ydirname(tls *TLS, s uintptr) (r uintptr)
TEXT ·Ydirname(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xdirname(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ydiv(tls *TLS, num int32, den int32) (r Tdiv_t)
TEXT ·Ydiv(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL num+8(FP), AX
	MOVL AX, 8(SP)
	MOVL den+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xdiv(SB)
	MOVL 16(SP), AX
	MOVL AX, r_Fquot+16(FP)
	MOVL 20(SP), AX
	MOVL AX, r_Frem+20(FP)
	RET

// func Ydlclose(t *TLS, handle uintptr) (_2 int32)
TEXT ·Ydlclose(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ handle+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xdlclose(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ydlerror(t *TLS) (_1 uintptr)
TEXT ·Ydlerror(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xdlerror(SB)
	MOVQ 8(SP), AX
	MOVQ AX, _1+8(FP)
	RET

// func Ydlopen(t *TLS, filename uintptr, flags int32) (_3 uintptr)
TEXT ·Ydlopen(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xdlopen(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _3+24(FP)
	RET

// func Ydlsym(t *TLS, handle, symbol uintptr) (_2 uintptr)
TEXT ·Ydlsym(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ handle+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ symbol+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xdlsym(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _2+24(FP)
	RET

// func Ydn_comp(tls *TLS, src uintptr, dst uintptr, space int32, dnptrs uintptr, lastdnptr uintptr) (r int32)
TEXT ·Ydn_comp(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ src+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ dst+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL space+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ dnptrs+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ lastdnptr+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xdn_comp(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ydn_expand(tls *TLS, base uintptr, end uintptr, src uintptr, dest uintptr, space int32) (r int32)
TEXT ·Ydn_expand(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ base+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ end+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ src+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ dest+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL space+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xdn_expand(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ydn_skipname(tls *TLS, s uintptr, end uintptr) (r int32)
TEXT ·Ydn_skipname(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ end+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xdn_skipname(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ydngettext(tls *TLS, domainname uintptr, msgid1 uintptr, msgid2 uintptr, n uint64) (r uintptr)
TEXT ·Ydngettext(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ domainname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ msgid1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ msgid2+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ n+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xdngettext(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ydprintf(tls *TLS, fd int32, fmt uintptr, va uintptr) (r int32)
TEXT ·Ydprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xdprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ydrand48(tls *TLS) (r float64)
TEXT ·Ydrand48(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xdrand48(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ydrem(tls *TLS, x float64, y float64) (r float64)
TEXT ·Ydrem(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xdrem(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ydremf(tls *TLS, x float32, y float32) (r float32)
TEXT ·Ydremf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xdremf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ydup(tls *TLS, fd int32) (r int32)
TEXT ·Ydup(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xdup(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ydup2(tls *TLS, old int32, new1 int32) (r1 int32)
TEXT ·Ydup2(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL old+8(FP), AX
	MOVL AX, 8(SP)
	MOVL new1+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xdup2(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Ydup3(tls *TLS, old int32, new1 int32, flags int32) (r int32)
TEXT ·Ydup3(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL old+8(FP), AX
	MOVL AX, 8(SP)
	MOVL new1+12(FP), AX
	MOVL AX, 12(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xdup3(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yduplocale(tls *TLS, old Tlocale_t) (r Tlocale_t)
TEXT ·Yduplocale(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ old+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xduplocale(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yeaccess(tls *TLS, filename uintptr, amode int32) (r int32)
TEXT ·Yeaccess(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL amode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xeaccess(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yecvt(tls *TLS, x float64, n int32, dp uintptr, sign uintptr) (r uintptr)
TEXT ·Yecvt(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ dp+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ sign+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xecvt(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yencrypt(tls *TLS, block uintptr, edflag int32)
TEXT ·Yencrypt(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ block+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL edflag+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xencrypt(SB)
	RET

// func Yendgrent(tls *TLS)
TEXT ·Yendgrent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendgrent(SB)
	RET

// func Yendhostent(tls *TLS)
TEXT ·Yendhostent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendhostent(SB)
	RET

// func Yendmntent(tls *TLS, f uintptr) (r int32)
TEXT ·Yendmntent(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xendmntent(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yendnetent(tls *TLS)
TEXT ·Yendnetent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendnetent(SB)
	RET

// func Yendprotoent(tls *TLS)
TEXT ·Yendprotoent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendprotoent(SB)
	RET

// func Yendpwent(tls *TLS)
TEXT ·Yendpwent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendpwent(SB)
	RET

// func Yendservent(tls *TLS)
TEXT ·Yendservent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendservent(SB)
	RET

// func Yendspent(tls *TLS)
TEXT ·Yendspent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendspent(SB)
	RET

// func Yendusershell(tls *TLS)
TEXT ·Yendusershell(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendusershell(SB)
	RET

// func Yendutent(tls *TLS)
TEXT ·Yendutent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendutent(SB)
	RET

// func Yendutxent(tls *TLS)
TEXT ·Yendutxent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xendutxent(SB)
	RET

// func Yepoll_create(tls *TLS, size int32) (r int32)
TEXT ·Yepoll_create(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL size+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xepoll_create(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yepoll_create1(tls *TLS, flags int32) (r1 int32)
TEXT ·Yepoll_create1(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL flags+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xepoll_create1(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yepoll_ctl(tls *TLS, fd int32, op int32, fd2 int32, ev uintptr) (r int32)
TEXT ·Yepoll_ctl(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL op+12(FP), AX
	MOVL AX, 12(SP)
	MOVL fd2+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ ev+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xepoll_ctl(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yepoll_pwait(tls *TLS, fd int32, ev uintptr, cnt int32, to int32, sigs uintptr) (r1 int32)
TEXT ·Yepoll_pwait(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ ev+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL cnt+24(FP), AX
	MOVL AX, 24(SP)
	MOVL to+28(FP), AX
	MOVL AX, 28(SP)
	MOVQ sigs+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xepoll_pwait(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Yepoll_wait(tls *TLS, fd int32, ev uintptr, cnt int32, to int32) (r int32)
TEXT ·Yepoll_wait(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ ev+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL cnt+24(FP), AX
	MOVL AX, 24(SP)
	MOVL to+28(FP), AX
	MOVL AX, 28(SP)
	CALL ·Xepoll_wait(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yerand48(tls *TLS, s uintptr) (r float64)
TEXT ·Yerand48(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xerand48(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yerf(tls *TLS, x float64) (r1 float64)
TEXT ·Yerf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xerf(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Yerfc(tls *TLS, x float64) (r1 float64)
TEXT ·Yerfc(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xerfc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Yerfcf(tls *TLS, x float32) (r1 float32)
TEXT ·Yerfcf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xerfcf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yerfcl(tls *TLS, x float64) (r float64)
TEXT ·Yerfcl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xerfcl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yerff(tls *TLS, x float32) (r1 float32)
TEXT ·Yerff(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xerff(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yerfl(tls *TLS, x float64) (r float64)
TEXT ·Yerfl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xerfl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yerr(tls *TLS, status int32, fmt uintptr, va uintptr)
TEXT ·Yerr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL status+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xerr(SB)
	RET

// func Yerrx(tls *TLS, status int32, fmt uintptr, va uintptr)
TEXT ·Yerrx(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL status+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xerrx(SB)
	RET

// func Yether_aton(tls *TLS, x uintptr) (r uintptr)
TEXT ·Yether_aton(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xether_aton(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yether_aton_r(tls *TLS, x uintptr, p_a uintptr) (r uintptr)
TEXT ·Yether_aton_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p_a+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xether_aton_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yether_hostton(tls *TLS, hostname uintptr, e uintptr) (r int32)
TEXT ·Yether_hostton(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ hostname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ e+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xether_hostton(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yether_line(tls *TLS, l uintptr, e uintptr, hostname uintptr) (r int32)
TEXT ·Yether_line(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ e+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ hostname+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xether_line(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yether_ntoa(tls *TLS, p_a uintptr) (r uintptr)
TEXT ·Yether_ntoa(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p_a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xether_ntoa(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yether_ntoa_r(tls *TLS, p_a uintptr, x uintptr) (r uintptr)
TEXT ·Yether_ntoa_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p_a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ x+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xether_ntoa_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yether_ntohost(tls *TLS, hostname uintptr, e uintptr) (r int32)
TEXT ·Yether_ntohost(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ hostname+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ e+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xether_ntohost(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yeuidaccess(tls *TLS, filename uintptr, amode int32) (r int32)
TEXT ·Yeuidaccess(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL amode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xeuidaccess(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yeventfd(tls *TLS, count uint32, flags int32) (r1 int32)
TEXT ·Yeventfd(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL count+8(FP), AX
	MOVL AX, 8(SP)
	MOVL flags+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xeventfd(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yeventfd_read(tls *TLS, fd int32, value uintptr) (r int32)
TEXT ·Yeventfd_read(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ value+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xeventfd_read(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yeventfd_write(tls *TLS, fd int32, _value Teventfd_t) (r int32)
TEXT ·Yeventfd_write(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ _value+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xeventfd_write(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yexecl(tls *TLS, path uintptr, argv0 uintptr, va uintptr) (r int32)
TEXT ·Yexecl(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ argv0+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xexecl(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yexecle(tls *TLS, path uintptr, argv0 uintptr, va uintptr) (r int32)
TEXT ·Yexecle(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ argv0+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xexecle(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yexeclp(tls *TLS, file uintptr, argv0 uintptr, va uintptr) (r int32)
TEXT ·Yexeclp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ file+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ argv0+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xexeclp(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yexecv(tls *TLS, path uintptr, argv uintptr) (r int32)
TEXT ·Yexecv(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xexecv(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yexecve(tls *TLS, path uintptr, argv uintptr, envp uintptr) (r int32)
TEXT ·Yexecve(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ envp+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xexecve(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yexecvp(tls *TLS, file uintptr, argv uintptr) (r int32)
TEXT ·Yexecvp(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ file+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xexecvp(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yexecvpe(tls *TLS, file uintptr, argv uintptr, envp uintptr) (r int32)
TEXT ·Yexecvpe(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ file+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ envp+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xexecvpe(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yexit(tls *TLS, code int32)
TEXT ·Yexit(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL code+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xexit(SB)
	RET

// func Yexp(tls *TLS, x1 float64) (r1 float64)
TEXT ·Yexp(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xexp(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Yexp10(tls *TLS, x float64) (r float64)
TEXT ·Yexp10(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xexp10(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yexp10f(tls *TLS, x float32) (r float32)
TEXT ·Yexp10f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xexp10f(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yexp10l(tls *TLS, x float64) (r float64)
TEXT ·Yexp10l(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xexp10l(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yexp2(tls *TLS, x1 float64) (r1 float64)
TEXT ·Yexp2(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xexp2(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Yexp2f(tls *TLS, x2 float32) (r1 float32)
TEXT ·Yexp2f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x2+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xexp2f(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yexp2l(tls *TLS, x float64) (r float64)
TEXT ·Yexp2l(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xexp2l(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yexpf(tls *TLS, x2 float32) (r1 float32)
TEXT ·Yexpf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x2+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xexpf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yexpl(tls *TLS, x float64) (r float64)
TEXT ·Yexpl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xexpl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yexplicit_bzero(tls *TLS, d uintptr, n Tsize_t)
TEXT ·Yexplicit_bzero(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xexplicit_bzero(SB)
	RET

// func Yexpm1(tls *TLS, x3 float64) (r float64)
TEXT ·Yexpm1(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xexpm1(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yexpm1f(tls *TLS, x3 float32) (r float32)
TEXT ·Yexpm1f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xexpm1f(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yexpm1l(tls *TLS, x float64) (r float64)
TEXT ·Yexpm1l(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xexpm1l(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfabs(tls *TLS, x float64) (r float64)
TEXT ·Yfabs(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfabs(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfabsf(tls *TLS, x float32) (r float32)
TEXT ·Yfabsf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfabsf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfabsl(tls *TLS, x float64) (r float64)
TEXT ·Yfabsl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfabsl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfaccessat(tls *TLS, fd int32, filename uintptr, amode int32, flag int32) (r int32)
TEXT ·Yfaccessat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ filename+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL amode+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flag+28(FP), AX
	MOVL AX, 28(SP)
	CALL ·Xfaccessat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfallocate(tls *TLS, fd int32, mode int32, base Toff_t, len1 Toff_t) (r int32)
TEXT ·Yfallocate(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL mode+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ base+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfallocate(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfanotify_init(tls *TLS, flags uint32, event_f_flags uint32) (r int32)
TEXT ·Yfanotify_init(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL flags+8(FP), AX
	MOVL AX, 8(SP)
	MOVL event_f_flags+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xfanotify_init(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfanotify_mark(tls *TLS, fanotify_fd int32, flags uint32, mask uint64, dfd int32, pathname uintptr) (r int32)
TEXT ·Yfanotify_mark(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fanotify_fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL flags+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ mask+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL dfd+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ pathname+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xfanotify_mark(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yfchdir(tls *TLS, fd int32) (r int32)
TEXT ·Yfchdir(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfchdir(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfchmod(tls *TLS, fd int32, mode Tmode_t) (r int32)
TEXT ·Yfchmod(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL mode+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xfchmod(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfchmodat(tls *TLS, fd int32, path uintptr, mode Tmode_t, flag int32) (r int32)
TEXT ·Yfchmodat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL mode+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flag+28(FP), AX
	MOVL AX, 28(SP)
	CALL ·Xfchmodat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfchown(tls *TLS, fd int32, uid Tuid_t, gid Tgid_t) (r int32)
TEXT ·Yfchown(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL uid+12(FP), AX
	MOVL AX, 12(SP)
	MOVL gid+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xfchown(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfchownat(tls *TLS, fd int32, path uintptr, uid Tuid_t, gid Tgid_t, flag int32) (r int32)
TEXT ·Yfchownat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL uid+24(FP), AX
	MOVL AX, 24(SP)
	MOVL gid+28(FP), AX
	MOVL AX, 28(SP)
	MOVL flag+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xfchownat(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yfclose(tls *TLS, f uintptr) (r1 int32)
TEXT ·Yfclose(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfclose(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yfcntl(tls *TLS, fd int32, cmd int32, va uintptr) (r int32)
TEXT ·Yfcntl(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL cmd+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfcntl(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfcntl64(tls *TLS, fd int32, cmd int32, va uintptr) (r int32)
TEXT ·Yfcntl64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL cmd+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfcntl64(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfcvt(tls *TLS, x float64, n int32, dp uintptr, sign uintptr) (r uintptr)
TEXT ·Yfcvt(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ dp+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ sign+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xfcvt(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yfdatasync(tls *TLS, fd int32) (r int32)
TEXT ·Yfdatasync(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfdatasync(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfdim(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yfdim(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfdim(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfdimf(tls *TLS, x float32, y float32) (r float32)
TEXT ·Yfdimf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xfdimf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfdiml(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yfdiml(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfdiml(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfdopen(tls *TLS, fd int32, mode uintptr) (r uintptr)
TEXT ·Yfdopen(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ mode+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfdopen(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfdopendir(tls *TLS, fd int32) (r uintptr)
TEXT ·Yfdopendir(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfdopendir(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfeclearexcept(tls *TLS, mask int32) (r int32)
TEXT ·Yfeclearexcept(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL mask+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfeclearexcept(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfegetenv(tls *TLS, envp uintptr) (r int32)
TEXT ·Yfegetenv(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ envp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfegetenv(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfegetround(tls *TLS) (r int32)
TEXT ·Yfegetround(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xfegetround(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yfeof(tls *TLS, f uintptr) (r int32)
TEXT ·Yfeof(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfeof(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfeof_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Yfeof_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfeof_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yferaiseexcept(tls *TLS, mask int32) (r int32)
TEXT ·Yferaiseexcept(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL mask+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xferaiseexcept(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yferror(tls *TLS, f uintptr) (r int32)
TEXT ·Yferror(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xferror(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yferror_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Yferror_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xferror_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfesetenv(tls *TLS, envp uintptr) (r int32)
TEXT ·Yfesetenv(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ envp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfesetenv(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfetestexcept(tls *TLS, mask int32) (r int32)
TEXT ·Yfetestexcept(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL mask+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfetestexcept(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfexecve(tls *TLS, fd int32, argv uintptr, envp uintptr) (r1 int32)
TEXT ·Yfexecve(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ envp+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfexecve(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Yfflush(tls *TLS, f uintptr) (r1 int32)
TEXT ·Yfflush(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfflush(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yfflush_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Yfflush_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfflush_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yffs(tls *TLS, i int32) (r int32)
TEXT ·Yffs(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL i+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xffs(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yffsl(tls *TLS, i int64) (r int32)
TEXT ·Yffsl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ i+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xffsl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yffsll(tls *TLS, i int64) (r int32)
TEXT ·Yffsll(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ i+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xffsll(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfgetc(tls *TLS, f1 uintptr) (r int32)
TEXT ·Yfgetc(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfgetc(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfgetc_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Yfgetc_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfgetc_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfgetgrent(tls *TLS, f uintptr) (r uintptr)
TEXT ·Yfgetgrent(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfgetgrent(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfgetln(tls *TLS, f uintptr, plen uintptr) (r uintptr)
TEXT ·Yfgetln(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ plen+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfgetln(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfgetpos(tls *TLS, f uintptr, pos uintptr) (r int32)
TEXT ·Yfgetpos(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ pos+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfgetpos(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfgetpwent(tls *TLS, f uintptr) (r uintptr)
TEXT ·Yfgetpwent(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfgetpwent(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfgets(tls *TLS, s uintptr, n int32, f uintptr) (r uintptr)
TEXT ·Yfgets(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfgets(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yfgets_unlocked(tls *TLS, s uintptr, n int32, f uintptr) (r uintptr)
TEXT ·Yfgets_unlocked(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfgets_unlocked(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yfgetwc(tls *TLS, f uintptr) (r Twint_t)
TEXT ·Yfgetwc(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfgetwc(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfgetwc_unlocked(tls *TLS, f uintptr) (r Twint_t)
TEXT ·Yfgetwc_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfgetwc_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfgetws(tls *TLS, s uintptr, n int32, f uintptr) (r uintptr)
TEXT ·Yfgetws(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfgetws(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yfgetws_unlocked(tls *TLS, s uintptr, n int32, f uintptr) (r uintptr)
TEXT ·Yfgetws_unlocked(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfgetws_unlocked(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yfgetxattr(tls *TLS, filedes int32, name uintptr, value uintptr, size Tsize_t) (r Tssize_t)
TEXT ·Yfgetxattr(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL filedes+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ value+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xfgetxattr(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yfileno(tls *TLS, f uintptr) (r int32)
TEXT ·Yfileno(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfileno(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfileno_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Yfileno_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfileno_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfinite(tls *TLS, x float64) (r int32)
TEXT ·Yfinite(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfinite(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfinitef(tls *TLS, x float32) (r int32)
TEXT ·Yfinitef(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfinitef(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yflistxattr(tls *TLS, filedes int32, list uintptr, size Tsize_t) (r Tssize_t)
TEXT ·Yflistxattr(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL filedes+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ list+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ size+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xflistxattr(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yflock(tls *TLS, fd int32, op int32) (r int32)
TEXT ·Yflock(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL op+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xflock(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yflockfile(tls *TLS, f uintptr)
TEXT ·Yflockfile(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xflockfile(SB)
	RET

// func Yfloor(tls *TLS, x3 float64) (r float64)
TEXT ·Yfloor(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfloor(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfloorf(tls *TLS, x3 float32) (r float32)
TEXT ·Yfloorf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfloorf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfloorl(tls *TLS, x float64) (r float64)
TEXT ·Yfloorl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfloorl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfma(tls *TLS, x1 float64, y float64, z float64) (r1 float64)
TEXT ·Yfma(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ z+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfma(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r1+32(FP)
	RET

// func Yfmal(tls *TLS, x float64, y float64, z float64) (r float64)
TEXT ·Yfmal(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ z+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfmal(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yfmax(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yfmax(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfmax(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfmaxf(tls *TLS, x float32, y float32) (r float32)
TEXT ·Yfmaxf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xfmaxf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfmaxl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yfmaxl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfmaxl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfmemopen(tls *TLS, buf uintptr, size Tsize_t, mode uintptr) (r uintptr)
TEXT ·Yfmemopen(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ mode+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfmemopen(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yfmin(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yfmin(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfmin(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfminf(tls *TLS, x float32, y float32) (r float32)
TEXT ·Yfminf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xfminf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfminl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yfminl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfminl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfmod(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yfmod(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfmod(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfmodf(tls *TLS, x float32, y float32) (r float32)
TEXT ·Yfmodf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xfmodf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfmodl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yfmodl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfmodl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfmtmsg(tls *TLS, classification int64, label uintptr, severity int32, text uintptr, action uintptr, tag uintptr) (r int32)
TEXT ·Yfmtmsg(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ classification+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ label+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL severity+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ text+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ action+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ tag+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·Xfmtmsg(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Yfnmatch(tls *TLS, pat uintptr, str uintptr, flags int32) (r int32)
TEXT ·Yfnmatch(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ pat+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ str+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xfnmatch(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfopen(tls *TLS, filename uintptr, mode uintptr) (r uintptr)
TEXT ·Yfopen(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mode+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfopen(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfopen64(tls *TLS, filename uintptr, mode uintptr) (r uintptr)
TEXT ·Yfopen64(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mode+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfopen64(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfopencookie(tls *TLS, cookie uintptr, mode uintptr, iofuncs Tcookie_io_functions_t) (r uintptr)
TEXT ·Yfopencookie(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ cookie+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mode+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ iofuncs_Fread+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ iofuncs_Fwrite+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ iofuncs_Fseek+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ iofuncs_Fclose1+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·Xfopencookie(SB)
	MOVQ 56(SP), AX
	MOVQ AX, r+56(FP)
	RET

// func Yfork(t *TLS) (_1 int32)
TEXT ·Yfork(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xfork(SB)
	MOVL 8(SP), AX
	MOVL AX, _1+8(FP)
	RET

// func Yfpathconf(tls *TLS, fd int32, name int32) (r int64)
TEXT ·Yfpathconf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL name+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xfpathconf(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yfprintf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Yfprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfpurge(tls *TLS, f uintptr) (r int32)
TEXT ·Yfpurge(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfpurge(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfputc(tls *TLS, c1 int32, f1 uintptr) (r int32)
TEXT ·Yfputc(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c1+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfputc(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfputc_unlocked(tls *TLS, c int32, f uintptr) (r int32)
TEXT ·Yfputc_unlocked(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfputc_unlocked(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfputs(tls *TLS, s uintptr, f uintptr) (r int32)
TEXT ·Yfputs(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfputs(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfputs_unlocked(tls *TLS, s uintptr, f uintptr) (r int32)
TEXT ·Yfputs_unlocked(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfputs_unlocked(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfputwc(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)
TEXT ·Yfputwc(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfputwc(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfputwc_unlocked(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)
TEXT ·Yfputwc_unlocked(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfputwc_unlocked(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfputws(tls *TLS, _ws uintptr, f uintptr) (r int32)
TEXT ·Yfputws(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _ws+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfputws(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfputws_unlocked(tls *TLS, _ws uintptr, f uintptr) (r int32)
TEXT ·Yfputws_unlocked(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _ws+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfputws_unlocked(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfread(tls *TLS, destv uintptr, size Tsize_t, nmemb Tsize_t, f uintptr) (r Tsize_t)
TEXT ·Yfread(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ destv+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ nmemb+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ f+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xfread(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yfread_unlocked(tls *TLS, destv uintptr, size Tsize_t, nmemb Tsize_t, f uintptr) (r Tsize_t)
TEXT ·Yfread_unlocked(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ destv+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ nmemb+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ f+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xfread_unlocked(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yfree(tls *TLS, p uintptr)
TEXT ·Yfree(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfree(SB)
	RET

// func Yfreeaddrinfo(tls *TLS, p uintptr)
TEXT ·Yfreeaddrinfo(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfreeaddrinfo(SB)
	RET

// func Yfreeifaddrs(tls *TLS, ifp uintptr)
TEXT ·Yfreeifaddrs(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ifp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfreeifaddrs(SB)
	RET

// func Yfreelocale(tls *TLS, l Tlocale_t)
TEXT ·Yfreelocale(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfreelocale(SB)
	RET

// func Yfremovexattr(tls *TLS, fd int32, name uintptr) (r int32)
TEXT ·Yfremovexattr(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfremovexattr(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfreopen(tls *TLS, filename uintptr, mode uintptr, f uintptr) (r uintptr)
TEXT ·Yfreopen(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mode+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfreopen(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yfrexp(tls *TLS, x float64, e uintptr) (r float64)
TEXT ·Yfrexp(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ e+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfrexp(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfrexpf(tls *TLS, x float32, e uintptr) (r float32)
TEXT ·Yfrexpf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ e+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfrexpf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfrexpl(tls *TLS, x float64, e uintptr) (r float64)
TEXT ·Yfrexpl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ e+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfrexpl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yfscanf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Yfscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfseek(tls *TLS, f uintptr, off int64, whence int32) (r int32)
TEXT ·Yfseek(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ off+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL whence+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xfseek(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfseeko(tls *TLS, f uintptr, off Toff_t, whence int32) (r int32)
TEXT ·Yfseeko(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ off+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL whence+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xfseeko(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfsetpos(tls *TLS, f uintptr, pos uintptr) (r int32)
TEXT ·Yfsetpos(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ pos+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfsetpos(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfsetxattr(tls *TLS, filedes int32, name uintptr, value uintptr, size Tsize_t, flags int32) (r int32)
TEXT ·Yfsetxattr(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL filedes+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ value+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xfsetxattr(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Yfstat(tls *TLS, fd int32, st uintptr) (r int32)
TEXT ·Yfstat(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ st+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfstat(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfstat64(tls *TLS, fd int32, st uintptr) (r int32)
TEXT ·Yfstat64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ st+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfstat64(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfstatat(tls *TLS, fd int32, path uintptr, st uintptr, flag int32) (r int32)
TEXT ·Yfstatat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ st+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flag+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xfstatat(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yfstatfs(tls *TLS, fd int32, buf uintptr) (r int32)
TEXT ·Yfstatfs(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfstatfs(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfstatvfs(tls *TLS, fd int32, buf uintptr) (r int32)
TEXT ·Yfstatvfs(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfstatvfs(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfsync(tls *TLS, fd int32) (r int32)
TEXT ·Yfsync(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xfsync(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yftell(tls *TLS, f uintptr) (r int64)
TEXT ·Yftell(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xftell(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yftello(tls *TLS, f uintptr) (r Toff_t)
TEXT ·Yftello(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xftello(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yftime(tls *TLS, tp uintptr) (r int32)
TEXT ·Yftime(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xftime(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yftok(tls *TLS, path uintptr, id int32) (r Tkey_t)
TEXT ·Yftok(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL id+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xftok(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yftruncate(tls *TLS, fd int32, length Toff_t) (r int32)
TEXT ·Yftruncate(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ length+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xftruncate(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yftruncate64(tls *TLS, fd int32, length Toff_t) (r int32)
TEXT ·Yftruncate64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ length+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xftruncate64(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yftrylockfile(tls *TLS, f uintptr) (r int32)
TEXT ·Yftrylockfile(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xftrylockfile(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yfts64_close(t *TLS, ftsp uintptr) (_2 int32)
TEXT ·Yfts64_close(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ftsp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfts64_close(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Yfts64_open(t *TLS, path_argv uintptr, options int32, compar uintptr) (_4 uintptr)
TEXT ·Yfts64_open(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path_argv+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL options+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ compar+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfts64_open(SB)
	MOVQ 32(SP), AX
	MOVQ AX, _4+32(FP)
	RET

// func Yfts64_read(t *TLS, ftsp uintptr) (_2 uintptr)
TEXT ·Yfts64_read(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ftsp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfts64_read(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Yfts_close(t *TLS, ftsp uintptr) (_2 int32)
TEXT ·Yfts_close(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ftsp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfts_close(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Yfts_open(t *TLS, path_argv uintptr, options int32, compar uintptr) (_4 uintptr)
TEXT ·Yfts_open(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path_argv+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL options+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ compar+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfts_open(SB)
	MOVQ 32(SP), AX
	MOVQ AX, _4+32(FP)
	RET

// func Yfts_read(t *TLS, ftsp uintptr) (_2 uintptr)
TEXT ·Yfts_read(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ftsp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfts_read(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Yftw(tls *TLS, path uintptr, __ccgo_fp_fn uintptr, fd_limit int32) (r int32)
TEXT ·Yftw(SB),$48-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_fn+16(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_ftw_1(SB)	// Create the closure for calling __ccgo_fp_fn
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 16(SP)
	MOVL fd_limit+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xftw(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_ftw_1(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _3+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ __ccgo_fp+32(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 32(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Yfunlockfile(tls *TLS, f uintptr)
TEXT ·Yfunlockfile(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xfunlockfile(SB)
	RET

// func Yfutimens(tls *TLS, fd int32, times uintptr) (r int32)
TEXT ·Yfutimens(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ times+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfutimens(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfutimes(tls *TLS, fd int32, tv uintptr) (r int32)
TEXT ·Yfutimes(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ tv+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xfutimes(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfutimesat(tls *TLS, dirfd int32, pathname uintptr, times uintptr) (r int32)
TEXT ·Yfutimesat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL dirfd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ pathname+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ times+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfutimesat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfwide(tls *TLS, f uintptr, mode int32) (r int32)
TEXT ·Yfwide(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL mode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xfwide(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yfwprintf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Yfwprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfwprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yfwrite(tls *TLS, src uintptr, size Tsize_t, nmemb Tsize_t, f uintptr) (r Tsize_t)
TEXT ·Yfwrite(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ src+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ nmemb+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ f+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xfwrite(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yfwrite_unlocked(tls *TLS, src uintptr, size Tsize_t, nmemb Tsize_t, f uintptr) (r Tsize_t)
TEXT ·Yfwrite_unlocked(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ src+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ nmemb+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ f+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xfwrite_unlocked(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yfwscanf(tls *TLS, f uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Yfwscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xfwscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ygai_strerror(tls *TLS, ecode int32) (r uintptr)
TEXT ·Ygai_strerror(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ecode+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xgai_strerror(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygcvt(tls *TLS, x float64, n int32, b uintptr) (r uintptr)
TEXT ·Ygcvt(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ b+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgcvt(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yget_avphys_pages(tls *TLS) (r int64)
TEXT ·Yget_avphys_pages(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xget_avphys_pages(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Yget_current_dir_name(tls *TLS) (r uintptr)
TEXT ·Yget_current_dir_name(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xget_current_dir_name(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Yget_nprocs(tls *TLS) (r int32)
TEXT ·Yget_nprocs(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xget_nprocs(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yget_nprocs_conf(tls *TLS) (r int32)
TEXT ·Yget_nprocs_conf(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xget_nprocs_conf(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yget_phys_pages(tls *TLS) (r int64)
TEXT ·Yget_phys_pages(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xget_phys_pages(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetaddrinfo(tls *TLS, host uintptr, serv uintptr, hint uintptr, res uintptr) (r1 int32)
TEXT ·Ygetaddrinfo(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ host+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ serv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ hint+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ res+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xgetaddrinfo(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Ygetauxval(tls *TLS, item uint64) (r uint64)
TEXT ·Ygetauxval(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ item+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetauxval(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetc(tls *TLS, f1 uintptr) (r int32)
TEXT ·Ygetc(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetc(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ygetc_unlocked(tls *TLS, f uintptr) (r int32)
TEXT ·Ygetc_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetc_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ygetchar(tls *TLS) (r int32)
TEXT ·Ygetchar(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetchar(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetchar_unlocked(tls *TLS) (r int32)
TEXT ·Ygetchar_unlocked(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetchar_unlocked(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetcwd(tls *TLS, buf uintptr, size Tsize_t) (r uintptr)
TEXT ·Ygetcwd(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetcwd(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ygetdate(tls *TLS, s uintptr) (r uintptr)
TEXT ·Ygetdate(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetdate(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetdelim(tls *TLS, s uintptr, n uintptr, delim int32, f uintptr) (r Tssize_t)
TEXT ·Ygetdelim(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL delim+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ f+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xgetdelim(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ygetdents(tls *TLS, fd int32, buf uintptr, len1 Tsize_t) (r int32)
TEXT ·Ygetdents(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgetdents(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ygetdomainname(tls *TLS, name uintptr, len1 Tsize_t) (r int32)
TEXT ·Ygetdomainname(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetdomainname(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygetdtablesize(tls *TLS) (r int32)
TEXT ·Ygetdtablesize(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetdtablesize(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetegid(tls *TLS) (r Tgid_t)
TEXT ·Ygetegid(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetegid(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetentropy(tls *TLS, buffer uintptr, len1 Tsize_t) (r int32)
TEXT ·Ygetentropy(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buffer+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetentropy(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygetenv(tls *TLS, name uintptr) (r uintptr)
TEXT ·Ygetenv(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetenv(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygeteuid(tls *TLS) (r Tuid_t)
TEXT ·Ygeteuid(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgeteuid(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetgid(tls *TLS) (r Tgid_t)
TEXT ·Ygetgid(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetgid(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetgrent(tls *TLS) (r uintptr)
TEXT ·Ygetgrent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetgrent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetgrgid(tls *TLS, gid Tgid_t) (r uintptr)
TEXT ·Ygetgrgid(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL gid+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xgetgrgid(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetgrgid_r(tls *TLS, gid Tgid_t, gr uintptr, buf uintptr, size Tsize_t, res uintptr) (r int32)
TEXT ·Ygetgrgid_r(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL gid+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ gr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ res+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xgetgrgid_r(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ygetgrnam(tls *TLS, name uintptr) (r uintptr)
TEXT ·Ygetgrnam(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetgrnam(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetgrnam_r(tls *TLS, name uintptr, gr uintptr, buf uintptr, size Tsize_t, res uintptr) (r int32)
TEXT ·Ygetgrnam_r(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ gr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ res+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xgetgrnam_r(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ygetgrouplist(tls *TLS, user uintptr, gid Tgid_t, groups uintptr, ngroups uintptr) (r int32)
TEXT ·Ygetgrouplist(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ user+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL gid+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ groups+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ ngroups+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xgetgrouplist(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ygetgroups(tls *TLS, count int32, list uintptr) (r int32)
TEXT ·Ygetgroups(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL count+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ list+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetgroups(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygethostbyaddr(tls *TLS, a uintptr, l Tsocklen_t, af int32) (r uintptr)
TEXT ·Ygethostbyaddr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL l+16(FP), AX
	MOVL AX, 16(SP)
	MOVL af+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xgethostbyaddr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ygethostbyaddr_r(tls *TLS, a uintptr, l Tsocklen_t, af int32, h uintptr, buf uintptr, buflen Tsize_t, res uintptr, err uintptr) (r int32)
TEXT ·Ygethostbyaddr_r(SB),$72-68
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL l+16(FP), AX
	MOVL AX, 16(SP)
	MOVL af+20(FP), AX
	MOVL AX, 20(SP)
	MOVQ h+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ buf+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ buflen+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ res+48(FP), AX
	MOVQ AX, 48(SP)
	MOVQ err+56(FP), AX
	MOVQ AX, 56(SP)
	CALL ·Xgethostbyaddr_r(SB)
	MOVL 64(SP), AX
	MOVL AX, r+64(FP)
	RET

// func Ygethostbyname(tls *TLS, name uintptr) (r uintptr)
TEXT ·Ygethostbyname(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgethostbyname(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygethostbyname2(tls *TLS, name uintptr, af int32) (r uintptr)
TEXT ·Ygethostbyname2(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL af+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xgethostbyname2(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ygethostbyname2_r(tls *TLS, name uintptr, af int32, h uintptr, buf uintptr, buflen Tsize_t, res uintptr, err uintptr) (r int32)
TEXT ·Ygethostbyname2_r(SB),$72-68
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL af+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ h+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ buf+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ buflen+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ res+48(FP), AX
	MOVQ AX, 48(SP)
	MOVQ err+56(FP), AX
	MOVQ AX, 56(SP)
	CALL ·Xgethostbyname2_r(SB)
	MOVL 64(SP), AX
	MOVL AX, r+64(FP)
	RET

// func Ygethostbyname_r(tls *TLS, name uintptr, h uintptr, buf uintptr, buflen Tsize_t, res uintptr, err uintptr) (r int32)
TEXT ·Ygethostbyname_r(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ h+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ buflen+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ res+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ err+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·Xgethostbyname_r(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Ygethostent(tls *TLS) (r uintptr)
TEXT ·Ygethostent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgethostent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygethostid(tls *TLS) (r int64)
TEXT ·Ygethostid(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgethostid(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygethostname(tls *TLS, name uintptr, len1 Tsize_t) (r int32)
TEXT ·Ygethostname(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgethostname(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygetifaddrs(tls *TLS, ifap uintptr) (r1 int32)
TEXT ·Ygetifaddrs(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ifap+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetifaddrs(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Ygetitimer(tls *TLS, which int32, old uintptr) (r1 int32)
TEXT ·Ygetitimer(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL which+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ old+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetitimer(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ygetline(tls *TLS, s uintptr, n uintptr, f uintptr) (r Tssize_t)
TEXT ·Ygetline(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgetline(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ygetloadavg(tls *TLS, a uintptr, n int32) (r int32)
TEXT ·Ygetloadavg(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xgetloadavg(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygetlogin(tls *TLS) (r uintptr)
TEXT ·Ygetlogin(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetlogin(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetlogin_r(tls *TLS, name uintptr, size Tsize_t) (r int32)
TEXT ·Ygetlogin_r(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetlogin_r(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygetmntent(tls *TLS, f uintptr) (r uintptr)
TEXT ·Ygetmntent(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetmntent(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetmntent_r(tls *TLS, f uintptr, mnt uintptr, linebuf uintptr, buflen int32) (r uintptr)
TEXT ·Ygetmntent_r(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mnt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ linebuf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL buflen+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xgetmntent_r(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ygetnameinfo(tls *TLS, sa uintptr, sl Tsocklen_t, node uintptr, nodelen Tsocklen_t, serv uintptr, servlen Tsocklen_t, flags int32) (r int32)
TEXT ·Ygetnameinfo(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ sa+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL sl+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ node+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL nodelen+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ serv+40(FP), AX
	MOVQ AX, 40(SP)
	MOVL servlen+48(FP), AX
	MOVL AX, 48(SP)
	MOVL flags+52(FP), AX
	MOVL AX, 52(SP)
	CALL ·Xgetnameinfo(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Ygetnetbyaddr(tls *TLS, net Tuint32_t, type1 int32) (r uintptr)
TEXT ·Ygetnetbyaddr(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL net+8(FP), AX
	MOVL AX, 8(SP)
	MOVL type1+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xgetnetbyaddr(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetnetbyname(tls *TLS, name uintptr) (r uintptr)
TEXT ·Ygetnetbyname(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetnetbyname(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetnetent(tls *TLS) (r uintptr)
TEXT ·Ygetnetent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetnetent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetopt(tls *TLS, argc int32, argv uintptr, optstring uintptr) (r int32)
TEXT ·Ygetopt(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL argc+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ optstring+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgetopt(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ygetopt_long(tls *TLS, argc int32, argv uintptr, optstring uintptr, longopts uintptr, idx uintptr) (r int32)
TEXT ·Ygetopt_long(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL argc+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ optstring+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ longopts+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ idx+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xgetopt_long(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ygetopt_long_only(tls *TLS, argc int32, argv uintptr, optstring uintptr, longopts uintptr, idx uintptr) (r int32)
TEXT ·Ygetopt_long_only(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL argc+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ argv+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ optstring+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ longopts+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ idx+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xgetopt_long_only(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ygetpagesize(tls *TLS) (r int32)
TEXT ·Ygetpagesize(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetpagesize(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetpass(tls *TLS, prompt uintptr) (r uintptr)
TEXT ·Ygetpass(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ prompt+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetpass(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetpeername(tls *TLS, fd int32, addr uintptr, len1 uintptr) (r1 int32)
TEXT ·Ygetpeername(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ addr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgetpeername(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ygetpgid(tls *TLS, pid Tpid_t) (r Tpid_t)
TEXT ·Ygetpgid(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xgetpgid(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ygetpgrp(tls *TLS) (r Tpid_t)
TEXT ·Ygetpgrp(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetpgrp(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetpid(tls *TLS) (r Tpid_t)
TEXT ·Ygetpid(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetpid(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetppid(tls *TLS) (r Tpid_t)
TEXT ·Ygetppid(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetppid(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetpriority(tls *TLS, which int32, who Tid_t) (r int32)
TEXT ·Ygetpriority(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL which+8(FP), AX
	MOVL AX, 8(SP)
	MOVL who+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xgetpriority(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ygetprotobyname(tls *TLS, name uintptr) (r uintptr)
TEXT ·Ygetprotobyname(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetprotobyname(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetprotobynumber(tls *TLS, num int32) (r uintptr)
TEXT ·Ygetprotobynumber(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL num+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xgetprotobynumber(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetprotoent(tls *TLS) (r uintptr)
TEXT ·Ygetprotoent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetprotoent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetpwent(tls *TLS) (r uintptr)
TEXT ·Ygetpwent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetpwent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetpwnam(tls *TLS, name uintptr) (r uintptr)
TEXT ·Ygetpwnam(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetpwnam(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetpwnam_r(tls *TLS, name uintptr, pw uintptr, buf uintptr, size Tsize_t, res uintptr) (r int32)
TEXT ·Ygetpwnam_r(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ pw+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ res+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xgetpwnam_r(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ygetpwuid(tls *TLS, uid Tuid_t) (r uintptr)
TEXT ·Ygetpwuid(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL uid+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xgetpwuid(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetpwuid_r(tls *TLS, uid Tuid_t, pw uintptr, buf uintptr, size Tsize_t, res uintptr) (r int32)
TEXT ·Ygetpwuid_r(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL uid+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ pw+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ res+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xgetpwuid_r(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ygetrandom(tls *TLS, buf uintptr, buflen Tsize_t, flags uint32) (r Tssize_t)
TEXT ·Ygetrandom(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buflen+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xgetrandom(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ygetresgid(tls *TLS, rgid uintptr, egid uintptr, sgid uintptr) (r int32)
TEXT ·Ygetresgid(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ rgid+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ egid+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ sgid+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgetresgid(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ygetresuid(tls *TLS, ruid uintptr, euid uintptr, suid uintptr) (r int32)
TEXT ·Ygetresuid(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ruid+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ euid+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ suid+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgetresuid(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ygetrlimit(tls *TLS, resource int32, rlim uintptr) (r int32)
TEXT ·Ygetrlimit(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL resource+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ rlim+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetrlimit(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygetrlimit64(tls *TLS, resource int32, rlim uintptr) (r int32)
TEXT ·Ygetrlimit64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL resource+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ rlim+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetrlimit64(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygetrusage(tls *TLS, who int32, ru uintptr) (r1 int32)
TEXT ·Ygetrusage(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL who+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ ru+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetrusage(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ygets(tls *TLS, s uintptr) (r uintptr)
TEXT ·Ygets(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgets(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetservbyname(tls *TLS, name uintptr, prots uintptr) (r uintptr)
TEXT ·Ygetservbyname(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ prots+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgetservbyname(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ygetservbyname_r(tls *TLS, name uintptr, prots uintptr, se uintptr, buf uintptr, buflen Tsize_t, res uintptr) (r int32)
TEXT ·Ygetservbyname_r(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ prots+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ se+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ buf+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ buflen+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ res+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·Xgetservbyname_r(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Ygetservent(tls *TLS) (r uintptr)
TEXT ·Ygetservent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetservent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetsid(tls *TLS, pid Tpid_t) (r Tpid_t)
TEXT ·Ygetsid(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xgetsid(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ygetsockname(tls *TLS, fd int32, addr uintptr, len1 uintptr) (r1 int32)
TEXT ·Ygetsockname(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ addr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgetsockname(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ygetsockopt(tls *TLS, fd int32, level int32, optname int32, optval uintptr, optlen uintptr) (r2 int32)
TEXT ·Ygetsockopt(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL level+12(FP), AX
	MOVL AX, 12(SP)
	MOVL optname+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ optval+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ optlen+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xgetsockopt(SB)
	MOVL 40(SP), AX
	MOVL AX, r2+40(FP)
	RET

// func Ygetspent(tls *TLS) (r uintptr)
TEXT ·Ygetspent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetspent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetsubopt(tls *TLS, opt uintptr, keys uintptr, val uintptr) (r int32)
TEXT ·Ygetsubopt(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ opt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ keys+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ val+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xgetsubopt(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ygettext(tls *TLS, msgid uintptr) (r uintptr)
TEXT ·Ygettext(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msgid+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgettext(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygettimeofday(tls *TLS, tv uintptr, tz uintptr) (r int32)
TEXT ·Ygettimeofday(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tv+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ tz+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgettimeofday(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ygetuid(tls *TLS) (r Tuid_t)
TEXT ·Ygetuid(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetuid(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetusershell(tls *TLS) (r uintptr)
TEXT ·Ygetusershell(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetusershell(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetutent(tls *TLS) (r uintptr)
TEXT ·Ygetutent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetutent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetutid(tls *TLS, ut uintptr) (r uintptr)
TEXT ·Ygetutid(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ut+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetutid(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetutline(tls *TLS, ut uintptr) (r uintptr)
TEXT ·Ygetutline(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ut+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetutline(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetutxent(tls *TLS) (r uintptr)
TEXT ·Ygetutxent(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetutxent(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ygetutxid(tls *TLS, ut uintptr) (r uintptr)
TEXT ·Ygetutxid(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ut+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetutxid(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetutxline(tls *TLS, ut uintptr) (r uintptr)
TEXT ·Ygetutxline(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ut+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetutxline(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygetw(tls *TLS, f uintptr) (r int32)
TEXT ·Ygetw(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetw(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ygetwc(tls *TLS, f uintptr) (r Twint_t)
TEXT ·Ygetwc(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetwc(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ygetwc_unlocked(tls *TLS, f uintptr) (r Twint_t)
TEXT ·Ygetwc_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgetwc_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ygetwchar(tls *TLS) (r Twint_t)
TEXT ·Ygetwchar(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetwchar(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetwchar_unlocked(tls *TLS) (r Twint_t)
TEXT ·Ygetwchar_unlocked(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xgetwchar_unlocked(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ygetxattr(tls *TLS, path uintptr, name uintptr, value uintptr, size Tsize_t) (r Tssize_t)
TEXT ·Ygetxattr(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ value+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xgetxattr(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yglob(tls *TLS, pat uintptr, flags int32, __ccgo_fp_errfunc uintptr, g_ uintptr) (r int32)
TEXT ·Yglob(SB),$56-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_errfunc+24(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_glob_2(SB)	// Create the closure for calling __ccgo_fp_errfunc
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ pat+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 24(SP)
	MOVQ g_+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xglob(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_glob_2(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL _2+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Yglobfree(tls *TLS, g_ uintptr)
TEXT ·Yglobfree(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ g_+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xglobfree(SB)
	RET

// func Ygmtime(tls *TLS, t uintptr) (r uintptr)
TEXT ·Ygmtime(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xgmtime(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ygmtime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr)
TEXT ·Ygmtime_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ tm+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xgmtime_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ygrantpt(tls *TLS, fd int32) (r int32)
TEXT ·Ygrantpt(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xgrantpt(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yhasmntopt(tls *TLS, mnt uintptr, opt uintptr) (r uintptr)
TEXT ·Yhasmntopt(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ mnt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ opt+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xhasmntopt(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yhcreate(tls *TLS, nel Tsize_t) (r int32)
TEXT ·Yhcreate(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ nel+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xhcreate(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yhdestroy(tls *TLS)
TEXT ·Yhdestroy(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xhdestroy(SB)
	RET

// func Yherror(tls *TLS, msg uintptr)
TEXT ·Yherror(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msg+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xherror(SB)
	RET

// func Yhsearch(tls *TLS, item TENTRY, action TACTION) (r uintptr)
TEXT ·Yhsearch(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ item_Fkey+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ item_Fdata+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL action+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xhsearch(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yhstrerror(tls *TLS, ecode int32) (r uintptr)
TEXT ·Yhstrerror(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL ecode+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xhstrerror(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yhtonl(tls *TLS, n Tuint32_t) (r Tuint32_t)
TEXT ·Yhtonl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xhtonl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yhtons(tls *TLS, n Tuint16_t) (r Tuint16_t)
TEXT ·Yhtons(SB),$24-18
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVW n+8(FP), AX
	MOVW AX, 8(SP)
	CALL ·Xhtons(SB)
	MOVW 16(SP), AX
	MOVW AX, r+16(FP)
	RET

// func Yhypot(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yhypot(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xhypot(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yhypotf(tls *TLS, x float32, y float32) (r float32)
TEXT ·Yhypotf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xhypotf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yhypotl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yhypotl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xhypotl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yiconv(tls *TLS, cd Ticonv_t, in uintptr, inb uintptr, out uintptr, outb uintptr) (r Tsize_t)
TEXT ·Yiconv(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ cd+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ in+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ inb+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ out+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ outb+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xiconv(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Yiconv_close(tls *TLS, cd Ticonv_t) (r int32)
TEXT ·Yiconv_close(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ cd+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xiconv_close(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiconv_open(tls *TLS, to uintptr, from uintptr) (r Ticonv_t)
TEXT ·Yiconv_open(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ to+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ from+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiconv_open(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yif_freenameindex(tls *TLS, idx uintptr)
TEXT ·Yif_freenameindex(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ idx+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xif_freenameindex(SB)
	RET

// func Yif_indextoname(tls *TLS, index uint32, name uintptr) (r1 uintptr)
TEXT ·Yif_indextoname(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL index+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xif_indextoname(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r1+24(FP)
	RET

// func Yif_nameindex(tls *TLS) (r uintptr)
TEXT ·Yif_nameindex(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xif_nameindex(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Yif_nametoindex(tls *TLS, name uintptr) (r1 uint32)
TEXT ·Yif_nametoindex(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xif_nametoindex(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yilogb(tls *TLS, x3 float64) (r int32)
TEXT ·Yilogb(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xilogb(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yilogbf(tls *TLS, x3 float32) (r int32)
TEXT ·Yilogbf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xilogbf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yilogbl(tls *TLS, x float64) (r int32)
TEXT ·Yilogbl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xilogbl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yimaxabs(tls *TLS, a Tintmax_t) (r Tintmax_t)
TEXT ·Yimaxabs(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Ximaxabs(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yimaxdiv(tls *TLS, num Tintmax_t, den Tintmax_t) (r Timaxdiv_t)
TEXT ·Yimaxdiv(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ num+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ den+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Ximaxdiv(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_Fquot+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_Frem+32(FP)
	RET

// func Yindex(tls *TLS, s uintptr, c int32) (r uintptr)
TEXT ·Yindex(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xindex(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yinet_addr(tls *TLS, p uintptr) (r Tin_addr_t)
TEXT ·Yinet_addr(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xinet_addr(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yinet_aton(tls *TLS, s0 uintptr, dest uintptr) (r int32)
TEXT ·Yinet_aton(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s0+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ dest+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xinet_aton(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yinet_lnaof(tls *TLS, in Tin_addr) (r Tin_addr_t)
TEXT ·Yinet_lnaof(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL in_Fs_addr+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xinet_lnaof(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yinet_makeaddr(tls *TLS, n Tin_addr_t, h Tin_addr_t) (r Tin_addr)
TEXT ·Yinet_makeaddr(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	MOVL h+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xinet_makeaddr(SB)
	MOVL 16(SP), AX
	MOVL AX, r_Fs_addr+16(FP)
	RET

// func Yinet_netof(tls *TLS, in Tin_addr) (r Tin_addr_t)
TEXT ·Yinet_netof(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL in_Fs_addr+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xinet_netof(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yinet_network(tls *TLS, p uintptr) (r Tin_addr_t)
TEXT ·Yinet_network(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xinet_network(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yinet_ntoa(tls *TLS, _in Tin_addr) (r uintptr)
TEXT ·Yinet_ntoa(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL _in_Fs_addr+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xinet_ntoa(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yinet_ntop(tls *TLS, af int32, a0 uintptr, s uintptr, l Tsocklen_t) (r uintptr)
TEXT ·Yinet_ntop(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL af+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ a0+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ s+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL l+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xinet_ntop(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yinet_pton(tls *TLS, af int32, s uintptr, a0 uintptr) (r int32)
TEXT ·Yinet_pton(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL af+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ a0+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xinet_pton(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yinit_module(tls *TLS, a uintptr, b uint64, c uintptr) (r int32)
TEXT ·Yinit_module(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ c+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xinit_module(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yinitstate(tls *TLS, seed uint32, state uintptr, size Tsize_t) (r uintptr)
TEXT ·Yinitstate(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL seed+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ state+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ size+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xinitstate(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yinitstate_r(t *TLS, seed uint32, statebuf uintptr, statelen Tsize_t, buf uintptr) (_5 int32)
TEXT ·Yinitstate_r(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL seed+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ statebuf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ statelen+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ buf+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xinitstate_r(SB)
	MOVL 40(SP), AX
	MOVL AX, _5+40(FP)
	RET

// func Yinotify_add_watch(tls *TLS, fd int32, pathname uintptr, mask Tuint32_t) (r int32)
TEXT ·Yinotify_add_watch(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ pathname+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL mask+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xinotify_add_watch(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yinotify_init(tls *TLS) (r int32)
TEXT ·Yinotify_init(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xinotify_init(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yinotify_init1(tls *TLS, flags int32) (r1 int32)
TEXT ·Yinotify_init1(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL flags+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xinotify_init1(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yinotify_rm_watch(tls *TLS, fd int32, wd int32) (r int32)
TEXT ·Yinotify_rm_watch(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL wd+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xinotify_rm_watch(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yinsque(tls *TLS, element uintptr, pred uintptr)
TEXT ·Yinsque(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ element+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ pred+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xinsque(SB)
	RET

// func Yioctl(tls *TLS, fd int32, req int32, va uintptr) (r1 int32)
TEXT ·Yioctl(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL req+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xioctl(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Yioperm(tls *TLS, from uint64, num uint64, turn_on int32) (r int32)
TEXT ·Yioperm(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ from+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ num+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL turn_on+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xioperm(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yiopl(tls *TLS, level int32) (r int32)
TEXT ·Yiopl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL level+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiopl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisalnum(tls *TLS, c int32) (r int32)
TEXT ·Yisalnum(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisalnum(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisalnum_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisalnum_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisalnum_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yisalpha(tls *TLS, c int32) (r int32)
TEXT ·Yisalpha(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisalpha(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisalpha_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisalpha_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisalpha_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yisascii(tls *TLS, c int32) (r int32)
TEXT ·Yisascii(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisascii(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisastream(tls *TLS, fd int32) (r int32)
TEXT ·Yisastream(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisastream(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisatty(tls *TLS, fd int32) (r1 int32)
TEXT ·Yisatty(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisatty(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yisblank(tls *TLS, c int32) (r int32)
TEXT ·Yisblank(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisblank(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisblank_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisblank_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisblank_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiscntrl(tls *TLS, c int32) (r int32)
TEXT ·Yiscntrl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiscntrl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiscntrl_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yiscntrl_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiscntrl_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yisdigit(tls *TLS, c int32) (r int32)
TEXT ·Yisdigit(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisdigit(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisdigit_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisdigit_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisdigit_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yisgraph(tls *TLS, c int32) (r int32)
TEXT ·Yisgraph(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisgraph(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisgraph_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisgraph_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisgraph_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yislower(tls *TLS, c int32) (r int32)
TEXT ·Yislower(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xislower(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yislower_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yislower_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xislower_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yisnan(t *TLS, x float64) (_2 int32)
TEXT ·Yisnan(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xisnan(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Yisnanf(t *TLS, arg float32) (_2 int32)
TEXT ·Yisnanf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL arg+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisnanf(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Yisnanl(t *TLS, arg float64) (_2 int32)
TEXT ·Yisnanl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ arg+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xisnanl(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Yisprint(tls *TLS, c int32) (r int32)
TEXT ·Yisprint(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisprint(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisprint_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisprint_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisprint_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yispunct(tls *TLS, c int32) (r int32)
TEXT ·Yispunct(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xispunct(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yispunct_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yispunct_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xispunct_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yissetugid(tls *TLS) (r int32)
TEXT ·Yissetugid(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xissetugid(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yisspace(tls *TLS, c int32) (r int32)
TEXT ·Yisspace(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisspace(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisspace_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisspace_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisspace_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yisupper(tls *TLS, c int32) (r int32)
TEXT ·Yisupper(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisupper(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisupper_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisupper_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisupper_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswalnum(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswalnum(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswalnum(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswalnum_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswalnum_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswalnum_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswalpha(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswalpha(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswalpha(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswalpha_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswalpha_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswalpha_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswblank(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswblank(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswblank(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswblank_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswblank_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswblank_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswcntrl(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswcntrl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswcntrl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswcntrl_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswcntrl_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswcntrl_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswctype(tls *TLS, wc Twint_t, type1 Twctype_t) (r int32)
TEXT ·Yiswctype(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ type1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswctype(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswctype_l(tls *TLS, c Twint_t, t Twctype_t, l Tlocale_t) (r int32)
TEXT ·Yiswctype_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ t+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xiswctype_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yiswdigit(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswdigit(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswdigit(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswdigit_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswdigit_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswdigit_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswgraph(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswgraph(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswgraph(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswgraph_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswgraph_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswgraph_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswlower(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswlower(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswlower(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswlower_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswlower_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswlower_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswprint(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswprint(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswprint(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswprint_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswprint_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswprint_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswpunct(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswpunct(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswpunct(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswpunct_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswpunct_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswpunct_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswspace(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswspace(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswspace(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswspace_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswspace_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswspace_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswupper(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswupper(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswupper(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswupper_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswupper_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswupper_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yiswxdigit(tls *TLS, wc Twint_t) (r int32)
TEXT ·Yiswxdigit(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xiswxdigit(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yiswxdigit_l(tls *TLS, c Twint_t, l Tlocale_t) (r int32)
TEXT ·Yiswxdigit_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xiswxdigit_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yisxdigit(tls *TLS, c int32) (r int32)
TEXT ·Yisxdigit(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xisxdigit(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yisxdigit_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Yisxdigit_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xisxdigit_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yj0(tls *TLS, x float64) (r1 float64)
TEXT ·Yj0(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xj0(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Yj0f(tls *TLS, x float32) (r1 float32)
TEXT ·Yj0f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xj0f(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yj1(tls *TLS, x float64) (r1 float64)
TEXT ·Yj1(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xj1(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Yj1f(tls *TLS, x float32) (r1 float32)
TEXT ·Yj1f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xj1f(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yjn(tls *TLS, n int32, x float64) (r float64)
TEXT ·Yjn(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ x+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xjn(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yjnf(tls *TLS, n int32, x float32) (r float32)
TEXT ·Yjnf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	MOVL x+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xjnf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yjrand48(tls *TLS, s uintptr) (r int64)
TEXT ·Yjrand48(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xjrand48(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ykill(tls *TLS, pid Tpid_t, sig int32) (r int32)
TEXT ·Ykill(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVL sig+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xkill(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ykillpg(tls *TLS, pgid Tpid_t, sig int32) (r int32)
TEXT ·Ykillpg(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pgid+8(FP), AX
	MOVL AX, 8(SP)
	MOVL sig+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xkillpg(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yklogctl(tls *TLS, type1 int32, buf uintptr, len1 int32) (r int32)
TEXT ·Yklogctl(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL type1+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL len1+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xklogctl(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yl64a(tls *TLS, x0 int64) (r uintptr)
TEXT ·Yl64a(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x0+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xl64a(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylabs(tls *TLS, a int64) (r int64)
TEXT ·Ylabs(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlabs(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylchmod(tls *TLS, path uintptr, mode Tmode_t) (r int32)
TEXT ·Ylchmod(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL mode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xlchmod(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ylchown(tls *TLS, path uintptr, uid Tuid_t, gid Tgid_t) (r int32)
TEXT ·Ylchown(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL uid+16(FP), AX
	MOVL AX, 16(SP)
	MOVL gid+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xlchown(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ylckpwdf(tls *TLS) (r int32)
TEXT ·Ylckpwdf(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xlckpwdf(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ylcong48(tls *TLS, p uintptr)
TEXT ·Ylcong48(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlcong48(SB)
	RET

// func Yldexp(tls *TLS, x float64, n int32) (r float64)
TEXT ·Yldexp(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xldexp(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yldexpf(tls *TLS, x float32, n int32) (r float32)
TEXT ·Yldexpf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL n+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xldexpf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yldexpl(tls *TLS, x float64, n int32) (r float64)
TEXT ·Yldexpl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xldexpl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yldiv(tls *TLS, num int64, den int64) (r Tldiv_t)
TEXT ·Yldiv(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ num+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ den+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xldiv(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_Fquot+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_Frem+32(FP)
	RET

// func Ylfind(tls *TLS, key uintptr, base uintptr, nelp uintptr, width Tsize_t, __ccgo_fp_compar uintptr) (r uintptr)
TEXT ·Ylfind(SB),$64-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_compar+40(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_lfind_4(SB)	// Create the closure for calling __ccgo_fp_compar
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ base+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ nelp+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ width+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 40(SP)
	CALL ·Xlfind(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_lfind_4(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Ylgamma(tls *TLS, x float64) (r float64)
TEXT ·Ylgamma(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlgamma(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylgamma_r(tls *TLS, x float64, signgamp uintptr) (r float64)
TEXT ·Ylgamma_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ signgamp+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlgamma_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ylgammaf(tls *TLS, x float32) (r float32)
TEXT ·Ylgammaf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlgammaf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ylgammaf_r(tls *TLS, x float32, signgamp uintptr) (r float32)
TEXT ·Ylgammaf_r(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ signgamp+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlgammaf_r(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ylgammal(tls *TLS, x float64) (r float64)
TEXT ·Ylgammal(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlgammal(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylgammal_r(tls *TLS, x float64, sg uintptr) (r float64)
TEXT ·Ylgammal_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sg+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlgammal_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ylgetxattr(tls *TLS, path uintptr, name uintptr, value uintptr, size Tsize_t) (r Tssize_t)
TEXT ·Ylgetxattr(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ value+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xlgetxattr(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ylink(tls *TLS, existing uintptr, new1 uintptr) (r int32)
TEXT ·Ylink(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ existing+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ new1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlink(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ylinkat(tls *TLS, fd1 int32, existing uintptr, fd2 int32, new1 uintptr, flag int32) (r int32)
TEXT ·Ylinkat(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd1+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ existing+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL fd2+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ new1+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flag+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xlinkat(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ylisten(tls *TLS, fd int32, backlog int32) (r1 int32)
TEXT ·Ylisten(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL backlog+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xlisten(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Ylistxattr(tls *TLS, path uintptr, list uintptr, size Tsize_t) (r Tssize_t)
TEXT ·Ylistxattr(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ list+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ size+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xlistxattr(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yllabs(tls *TLS, a int64) (r int64)
TEXT ·Yllabs(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xllabs(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylldiv(tls *TLS, num int64, den int64) (r Tlldiv_t)
TEXT ·Ylldiv(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ num+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ den+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlldiv(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r_Fquot+24(FP)
	MOVQ 32(SP), AX
	MOVQ AX, r_Frem+32(FP)
	RET

// func Yllistxattr(tls *TLS, path uintptr, list uintptr, size Tsize_t) (r Tssize_t)
TEXT ·Yllistxattr(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ list+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ size+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xllistxattr(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yllrint(tls *TLS, x float64) (r int64)
TEXT ·Yllrint(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xllrint(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yllrintf(tls *TLS, x float32) (r int64)
TEXT ·Yllrintf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xllrintf(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yllrintl(tls *TLS, x float64) (r int64)
TEXT ·Yllrintl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xllrintl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yllround(tls *TLS, x float64) (r int64)
TEXT ·Yllround(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xllround(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yllroundf(tls *TLS, x float32) (r int64)
TEXT ·Yllroundf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xllroundf(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yllroundl(tls *TLS, x float64) (r int64)
TEXT ·Yllroundl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xllroundl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylocaleconv(tls *TLS) (r uintptr)
TEXT ·Ylocaleconv(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xlocaleconv(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ylocaltime(tls *TLS, t uintptr) (r uintptr)
TEXT ·Ylocaltime(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlocaltime(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylocaltime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr)
TEXT ·Ylocaltime_r(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ tm+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlocaltime_r(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ylockf(tls *TLS, fd int32, op int32, size Toff_t) (r int32)
TEXT ·Ylockf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL op+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlockf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ylog(tls *TLS, x1 float64) (r1 float64)
TEXT ·Ylog(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlog(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Ylog10(tls *TLS, x float64) (r float64)
TEXT ·Ylog10(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlog10(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylog10f(tls *TLS, x float32) (r float32)
TEXT ·Ylog10f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlog10f(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ylog10l(tls *TLS, x float64) (r float64)
TEXT ·Ylog10l(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlog10l(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylog1p(tls *TLS, x3 float64) (r float64)
TEXT ·Ylog1p(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlog1p(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylog1pf(tls *TLS, x3 float32) (r float32)
TEXT ·Ylog1pf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlog1pf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ylog1pl(tls *TLS, x float64) (r float64)
TEXT ·Ylog1pl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlog1pl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylog2(tls *TLS, x1 float64) (r1 float64)
TEXT ·Ylog2(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlog2(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Ylog2f(tls *TLS, x1 float32) (r1 float32)
TEXT ·Ylog2f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x1+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlog2f(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Ylog2l(tls *TLS, x float64) (r float64)
TEXT ·Ylog2l(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlog2l(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylogb(tls *TLS, x float64) (r float64)
TEXT ·Ylogb(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlogb(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylogbf(tls *TLS, x float32) (r float32)
TEXT ·Ylogbf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlogbf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ylogbl(tls *TLS, x float64) (r float64)
TEXT ·Ylogbl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlogbl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylogf(tls *TLS, x1 float32) (r1 float32)
TEXT ·Ylogf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x1+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlogf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Ylogin_tty(tls *TLS, fd int32) (r int32)
TEXT ·Ylogin_tty(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlogin_tty(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ylogl(tls *TLS, x float64) (r float64)
TEXT ·Ylogl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlogl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylongjmp(t *TLS, env uintptr, val int32)
TEXT ·Ylongjmp(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ env+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL val+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xlongjmp(SB)
	RET

// func Ylrand48(tls *TLS) (r int64)
TEXT ·Ylrand48(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xlrand48(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ylremovexattr(tls *TLS, path uintptr, name uintptr) (r int32)
TEXT ·Ylremovexattr(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlremovexattr(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ylrint(tls *TLS, x float64) (r int64)
TEXT ·Ylrint(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlrint(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylrintf(tls *TLS, x float32) (r int64)
TEXT ·Ylrintf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlrintf(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylrintl(tls *TLS, x float64) (r int64)
TEXT ·Ylrintl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlrintl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylround(tls *TLS, x float64) (r int64)
TEXT ·Ylround(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlround(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylroundf(tls *TLS, x float32) (r int64)
TEXT ·Ylroundf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xlroundf(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylroundl(tls *TLS, x float64) (r int64)
TEXT ·Ylroundl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xlroundl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ylsearch(tls *TLS, key uintptr, base uintptr, nelp uintptr, width Tsize_t, __ccgo_fp_compar uintptr) (r uintptr)
TEXT ·Ylsearch(SB),$64-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_compar+40(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_lsearch_4(SB)	// Create the closure for calling __ccgo_fp_compar
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ base+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ nelp+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ width+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 40(SP)
	CALL ·Xlsearch(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_lsearch_4(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Ylseek(tls *TLS, fd int32, offset Toff_t, whence int32) (r Toff_t)
TEXT ·Ylseek(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ offset+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL whence+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xlseek(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ylseek64(tls *TLS, fd int32, offset Toff_t, whence int32) (r Toff_t)
TEXT ·Ylseek64(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ offset+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL whence+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xlseek64(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ylsetxattr(tls *TLS, path uintptr, name uintptr, value uintptr, size Tsize_t, flags int32) (r int32)
TEXT ·Ylsetxattr(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ value+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xlsetxattr(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ylstat(tls *TLS, path uintptr, buf uintptr) (r int32)
TEXT ·Ylstat(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlstat(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ylstat64(tls *TLS, path uintptr, buf uintptr) (r int32)
TEXT ·Ylstat64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlstat64(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ylutimes(tls *TLS, filename uintptr, tv uintptr) (r int32)
TEXT ·Ylutimes(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ tv+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xlutimes(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymadvise(tls *TLS, addr uintptr, len1 Tsize_t, advice int32) (r int32)
TEXT ·Ymadvise(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL advice+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xmadvise(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymalloc(tls *TLS, n Tsize_t) (r uintptr)
TEXT ·Ymalloc(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xmalloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ymalloc_usable_size(tls *TLS, p uintptr) (r Tsize_t)
TEXT ·Ymalloc_usable_size(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xmalloc_usable_size(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ymblen(tls *TLS, s uintptr, n Tsize_t) (r int32)
TEXT ·Ymblen(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xmblen(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymbrlen(tls *TLS, s uintptr, n Tsize_t, st uintptr) (r Tsize_t)
TEXT ·Ymbrlen(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ st+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmbrlen(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ymbrtoc16(tls *TLS, pc16 uintptr, s uintptr, n Tsize_t, ps uintptr) (r Tsize_t)
TEXT ·Ymbrtoc16(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ pc16+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ ps+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xmbrtoc16(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ymbrtoc32(tls *TLS, pc32 uintptr, s uintptr, n Tsize_t, ps uintptr) (r Tsize_t)
TEXT ·Ymbrtoc32(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ pc32+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ ps+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xmbrtoc32(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ymbrtowc(tls *TLS, wc uintptr, src uintptr, n Tsize_t, st uintptr) (r Tsize_t)
TEXT ·Ymbrtowc(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ wc+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ st+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xmbrtowc(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ymbsinit(tls *TLS, st uintptr) (r int32)
TEXT ·Ymbsinit(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ st+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xmbsinit(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ymbsnrtowcs(tls *TLS, wcs uintptr, src uintptr, n Tsize_t, wn Tsize_t, st uintptr) (r Tsize_t)
TEXT ·Ymbsnrtowcs(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ wcs+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ wn+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ st+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xmbsnrtowcs(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ymbsrtowcs(tls *TLS, ws uintptr, src uintptr, wn Tsize_t, st uintptr) (r Tsize_t)
TEXT ·Ymbsrtowcs(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ws+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ wn+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ st+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xmbsrtowcs(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ymbstowcs(tls *TLS, ws uintptr, _s uintptr, wn Tsize_t) (r Tsize_t)
TEXT ·Ymbstowcs(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ws+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ wn+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmbstowcs(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ymbtowc(tls *TLS, wc uintptr, src uintptr, n Tsize_t) (r int32)
TEXT ·Ymbtowc(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ wc+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmbtowc(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymemccpy(tls *TLS, dest uintptr, src uintptr, c int32, n Tsize_t) (r uintptr)
TEXT ·Ymemccpy(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL c+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ n+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xmemccpy(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ymemchr(tls *TLS, src uintptr, c int32, n Tsize_t) (r uintptr)
TEXT ·Ymemchr(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ src+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmemchr(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ymemcmp(tls *TLS, vl uintptr, vr uintptr, n Tsize_t) (r1 int32)
TEXT ·Ymemcmp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ vl+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ vr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmemcmp(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ymemcpy(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r uintptr)
TEXT ·Ymemcpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmemcpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ymemfd_create(tls *TLS, name uintptr, flags uint32) (r int32)
TEXT ·Ymemfd_create(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xmemfd_create(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymemmem(tls *TLS, h0 uintptr, k Tsize_t, n0 uintptr, l Tsize_t) (r uintptr)
TEXT ·Ymemmem(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ h0+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ k+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n0+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ l+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xmemmem(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ymemmove(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r uintptr)
TEXT ·Ymemmove(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmemmove(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ymempcpy(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r uintptr)
TEXT ·Ymempcpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmempcpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ymemrchr(tls *TLS, m uintptr, c int32, n Tsize_t) (r uintptr)
TEXT ·Ymemrchr(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmemrchr(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ymemset(tls *TLS, dest uintptr, c int32, n Tsize_t) (r uintptr)
TEXT ·Ymemset(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmemset(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ymincore(tls *TLS, addr uintptr, len1 Tsize_t, vec uintptr) (r int32)
TEXT ·Ymincore(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ vec+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmincore(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymkdir(tls *TLS, path uintptr, mode Tmode_t) (r int32)
TEXT ·Ymkdir(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL mode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xmkdir(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymkdirat(tls *TLS, fd int32, path uintptr, mode Tmode_t) (r int32)
TEXT ·Ymkdirat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL mode+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xmkdirat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymkdtemp(tls *TLS, template uintptr) (r uintptr)
TEXT ·Ymkdtemp(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xmkdtemp(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ymkfifo(tls *TLS, path uintptr, mode Tmode_t) (r int32)
TEXT ·Ymkfifo(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL mode+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xmkfifo(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymkfifoat(tls *TLS, fd int32, path uintptr, mode Tmode_t) (r int32)
TEXT ·Ymkfifoat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL mode+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xmkfifoat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymknod(tls *TLS, path uintptr, mode Tmode_t, dev Tdev_t) (r int32)
TEXT ·Ymknod(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL mode+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ dev+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xmknod(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymknodat(tls *TLS, fd int32, path uintptr, mode Tmode_t, dev Tdev_t) (r int32)
TEXT ·Ymknodat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL mode+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ dev+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xmknodat(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ymkostemp(tls *TLS, template uintptr, flags int32) (r int32)
TEXT ·Ymkostemp(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xmkostemp(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymkostemps(tls *TLS, template uintptr, len1 int32, flags int32) (r int32)
TEXT ·Ymkostemps(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL len1+16(FP), AX
	MOVL AX, 16(SP)
	MOVL flags+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xmkostemps(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymkstemp(tls *TLS, template uintptr) (r int32)
TEXT ·Ymkstemp(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xmkstemp(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ymkstemp64(tls *TLS, template uintptr) (r int32)
TEXT ·Ymkstemp64(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xmkstemp64(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ymkstemps(tls *TLS, template uintptr, len1 int32) (r int32)
TEXT ·Ymkstemps(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL len1+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xmkstemps(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymkstemps64(tls *TLS, template uintptr, len1 int32) (r int32)
TEXT ·Ymkstemps64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL len1+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xmkstemps64(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymktemp(tls *TLS, template uintptr) (r uintptr)
TEXT ·Ymktemp(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ template+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xmktemp(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ymktime(tls *TLS, tm uintptr) (r Ttime_t)
TEXT ·Ymktime(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tm+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xmktime(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ymlock(tls *TLS, addr uintptr, len1 Tsize_t) (r int32)
TEXT ·Ymlock(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xmlock(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymlock2(tls *TLS, addr uintptr, len1 Tsize_t, flags uint32) (r int32)
TEXT ·Ymlock2(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xmlock2(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymlockall(tls *TLS, flags int32) (r int32)
TEXT ·Ymlockall(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL flags+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xmlockall(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ymmap(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr)
TEXT ·Ymmap(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ start+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL prot+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flags+28(FP), AX
	MOVL AX, 28(SP)
	MOVL fd+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ off+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xmmap(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ymmap64(tls *TLS, start uintptr, len1 Tsize_t, prot int32, flags int32, fd int32, off Toff_t) (r uintptr)
TEXT ·Ymmap64(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ start+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL prot+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flags+28(FP), AX
	MOVL AX, 28(SP)
	MOVL fd+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ off+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xmmap64(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ymodf(tls *TLS, x float64, iptr uintptr) (r float64)
TEXT ·Ymodf(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ iptr+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xmodf(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ymodff(tls *TLS, x float32, iptr uintptr) (r float32)
TEXT ·Ymodff(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ iptr+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xmodff(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymodfl(tls *TLS, x float64, iptr uintptr) (r1 float64)
TEXT ·Ymodfl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ iptr+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xmodfl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r1+24(FP)
	RET

// func Ymount(tls *TLS, special uintptr, dir uintptr, fstype uintptr, flags uint64, data uintptr) (r int32)
TEXT ·Ymount(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ special+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ dir+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ fstype+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ flags+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ data+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xmount(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ymprotect(tls *TLS, addr uintptr, len1 Tsize_t, prot int32) (r int32)
TEXT ·Ymprotect(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL prot+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xmprotect(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymrand48(tls *TLS) (r int64)
TEXT ·Ymrand48(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xmrand48(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ymremap(tls *TLS, old_addr uintptr, old_len Tsize_t, new_len Tsize_t, flags int32, va uintptr) (r uintptr)
TEXT ·Ymremap(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ old_addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ old_len+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ new_len+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ va+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xmremap(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ymsgctl(tls *TLS, q int32, cmd int32, buf uintptr) (r1 int32)
TEXT ·Ymsgctl(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL q+8(FP), AX
	MOVL AX, 8(SP)
	MOVL cmd+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xmsgctl(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ymsgget(tls *TLS, k Tkey_t, flag int32) (r int32)
TEXT ·Ymsgget(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL k+8(FP), AX
	MOVL AX, 8(SP)
	MOVL flag+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xmsgget(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ymsgrcv(tls *TLS, q int32, m uintptr, len1 Tsize_t, type1 int64, flag int32) (r Tssize_t)
TEXT ·Ymsgrcv(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL q+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ m+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ type1+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flag+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xmsgrcv(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ymsgsnd(tls *TLS, q int32, m uintptr, len1 Tsize_t, flag int32) (r int32)
TEXT ·Ymsgsnd(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL q+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ m+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flag+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xmsgsnd(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ymsync(tls *TLS, start uintptr, len1 Tsize_t, flags int32) (r int32)
TEXT ·Ymsync(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ start+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xmsync(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ymunlock(tls *TLS, addr uintptr, len1 Tsize_t) (r int32)
TEXT ·Ymunlock(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xmunlock(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ymunlockall(tls *TLS) (r int32)
TEXT ·Ymunlockall(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xmunlockall(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ymunmap(tls *TLS, start uintptr, len1 Tsize_t) (r int32)
TEXT ·Ymunmap(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ start+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xmunmap(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yname_to_handle_at(tls *TLS, dirfd int32, pathname uintptr, handle uintptr, mount_id uintptr, flags int32) (r int32)
TEXT ·Yname_to_handle_at(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL dirfd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ pathname+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ handle+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ mount_id+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xname_to_handle_at(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ynan(tls *TLS, s uintptr) (r float64)
TEXT ·Ynan(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xnan(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ynanf(tls *TLS, s uintptr) (r float32)
TEXT ·Ynanf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xnanf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ynanl(tls *TLS, s uintptr) (r float64)
TEXT ·Ynanl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xnanl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ynanosleep(tls *TLS, req uintptr, rem uintptr) (r int32)
TEXT ·Ynanosleep(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ req+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ rem+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xnanosleep(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ynewlocale(tls *TLS, mask int32, name uintptr, loc Tlocale_t) (r Tlocale_t)
TEXT ·Ynewlocale(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL mask+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ loc+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xnewlocale(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ynextafter(tls *TLS, x3 float64, y3 float64) (r float64)
TEXT ·Ynextafter(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y3+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xnextafter(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ynextafterf(tls *TLS, x3 float32, y3 float32) (r float32)
TEXT ·Ynextafterf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y3+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xnextafterf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ynextafterl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Ynextafterl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xnextafterl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ynexttoward(tls *TLS, x float64, y float64) (r float64)
TEXT ·Ynexttoward(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xnexttoward(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ynexttowardf(tls *TLS, x3 float32, y3 float64) (r float32)
TEXT ·Ynexttowardf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ y3+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xnexttowardf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ynexttowardl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Ynexttowardl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xnexttowardl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ynftw(tls *TLS, path uintptr, __ccgo_fp_fn uintptr, fd_limit int32, flags int32) (r1 int32)
TEXT ·Ynftw(SB),$48-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_fn+16(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_nftw_1(SB)	// Create the closure for calling __ccgo_fp_fn
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 16(SP)
	MOVL fd_limit+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flags+28(FP), AX
	MOVL AX, 28(SP)
	CALL ·Xnftw(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_nftw_1(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL _3+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ _4+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ __ccgo_fp+40(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 40(SP), AX
	MOVL AX, _5+48(FP)
	RET

// func Yngettext(tls *TLS, msgid1 uintptr, msgid2 uintptr, n uint64) (r uintptr)
TEXT ·Yngettext(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msgid1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ msgid2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xngettext(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ynice(tls *TLS, inc int32) (r int32)
TEXT ·Ynice(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL inc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xnice(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ynl_langinfo(tls *TLS, item Tnl_item) (r uintptr)
TEXT ·Ynl_langinfo(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL item+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xnl_langinfo(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ynl_langinfo_l(tls *TLS, item Tnl_item, loc Tlocale_t) (r uintptr)
TEXT ·Ynl_langinfo_l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL item+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ loc+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xnl_langinfo_l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ynrand48(tls *TLS, s uintptr) (r int64)
TEXT ·Ynrand48(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xnrand48(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yns_get16(tls *TLS, cp uintptr) (r uint32)
TEXT ·Yns_get16(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ cp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xns_get16(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yns_get32(tls *TLS, cp uintptr) (r uint64)
TEXT ·Yns_get32(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ cp+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xns_get32(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yns_initparse(tls *TLS, msg uintptr, msglen int32, handle uintptr) (r1 int32)
TEXT ·Yns_initparse(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL msglen+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ handle+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xns_initparse(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Yns_name_uncompress(tls *TLS, msg uintptr, eom uintptr, src uintptr, dst uintptr, dstsiz Tsize_t) (r1 int32)
TEXT ·Yns_name_uncompress(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ eom+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ src+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ dst+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ dstsiz+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xns_name_uncompress(SB)
	MOVL 48(SP), AX
	MOVL AX, r1+48(FP)
	RET

// func Yns_parserr(tls *TLS, handle uintptr, section Tns_sect, rrnum int32, rr uintptr) (r1 int32)
TEXT ·Yns_parserr(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ handle+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL section+16(FP), AX
	MOVL AX, 16(SP)
	MOVL rrnum+20(FP), AX
	MOVL AX, 20(SP)
	MOVQ rr+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xns_parserr(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Yns_put16(tls *TLS, s uint32, cp uintptr)
TEXT ·Yns_put16(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL s+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ cp+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xns_put16(SB)
	RET

// func Yns_put32(tls *TLS, l uint64, cp uintptr)
TEXT ·Yns_put32(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ cp+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xns_put32(SB)
	RET

// func Yns_skiprr(tls *TLS, ptr uintptr, eom uintptr, section Tns_sect, count int32) (r1 int32)
TEXT ·Yns_skiprr(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ eom+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL section+24(FP), AX
	MOVL AX, 24(SP)
	MOVL count+28(FP), AX
	MOVL AX, 28(SP)
	CALL ·Xns_skiprr(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Yntohl(tls *TLS, n Tuint32_t) (r Tuint32_t)
TEXT ·Yntohl(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xntohl(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yntohs(tls *TLS, n Tuint16_t) (r Tuint16_t)
TEXT ·Yntohs(SB),$24-18
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVW n+8(FP), AX
	MOVW AX, 8(SP)
	CALL ·Xntohs(SB)
	MOVW 16(SP), AX
	MOVW AX, r+16(FP)
	RET

// func Yobstack_free(t *TLS, obstack, obj uintptr)
TEXT ·Yobstack_free(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ obstack+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ obj+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xobstack_free(SB)
	RET

// func Yobstack_vprintf(t *TLS, obstack, template, va uintptr) (_2 int32)
TEXT ·Yobstack_vprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ obstack+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ template+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xobstack_vprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, _2+32(FP)
	RET

// func Yopen(tls *TLS, filename uintptr, flags int32, va uintptr) (r int32)
TEXT ·Yopen(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xopen(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yopen64(tls *TLS, filename uintptr, flags int32, va uintptr) (r int32)
TEXT ·Yopen64(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xopen64(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yopen_by_handle_at(tls *TLS, mount_fd int32, handle uintptr, flags int32) (r int32)
TEXT ·Yopen_by_handle_at(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL mount_fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ handle+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xopen_by_handle_at(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yopen_memstream(tls *TLS, bufp uintptr, sizep uintptr) (r uintptr)
TEXT ·Yopen_memstream(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ bufp+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sizep+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xopen_memstream(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yopen_wmemstream(tls *TLS, bufp uintptr, sizep uintptr) (r uintptr)
TEXT ·Yopen_wmemstream(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ bufp+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sizep+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xopen_wmemstream(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yopenat(tls *TLS, fd int32, filename uintptr, flags int32, va uintptr) (r int32)
TEXT ·Yopenat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ filename+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ va+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xopenat(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yopendir(tls *TLS, name uintptr) (r uintptr)
TEXT ·Yopendir(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xopendir(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yopenlog(tls *TLS, ident uintptr, opt int32, facility int32)
TEXT ·Yopenlog(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ident+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL opt+16(FP), AX
	MOVL AX, 16(SP)
	MOVL facility+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xopenlog(SB)
	RET

// func Yopenpty(tls *TLS, pm uintptr, ps uintptr, name uintptr, tio uintptr, ws uintptr) (r int32)
TEXT ·Yopenpty(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ pm+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ps+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ name+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ tio+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ ws+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xopenpty(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ypathconf(tls *TLS, path uintptr, name int32) (r int64)
TEXT ·Ypathconf(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL name+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xpathconf(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ypause(tls *TLS) (r int32)
TEXT ·Ypause(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xpause(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ypclose(tls *TLS, f uintptr) (r1 int32)
TEXT ·Ypclose(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpclose(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yperror(tls *TLS, msg uintptr)
TEXT ·Yperror(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ msg+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xperror(SB)
	RET

// func Ypersonality(tls *TLS, persona uint64) (r int32)
TEXT ·Ypersonality(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ persona+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpersonality(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ypipe(tls *TLS, fd uintptr) (r int32)
TEXT ·Ypipe(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fd+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpipe(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ypipe2(tls *TLS, fd uintptr, flag int32) (r int32)
TEXT ·Ypipe2(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fd+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flag+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xpipe2(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ypivot_root(tls *TLS, new1 uintptr, old uintptr) (r int32)
TEXT ·Ypivot_root(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ new1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ old+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpivot_root(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ypoll(tls *TLS, fds uintptr, n Tnfds_t, timeout int32) (r int32)
TEXT ·Ypoll(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fds+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL timeout+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xpoll(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ypopen(t *TLS, command, type1 uintptr) (_2 uintptr)
TEXT ·Ypopen(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ command+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ type1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpopen(SB)
	MOVQ 24(SP), AX
	MOVQ AX, _2+24(FP)
	RET

// func Yposix_close(tls *TLS, fd int32, flags int32) (r int32)
TEXT ·Yposix_close(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL flags+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xposix_close(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yposix_fadvise(tls *TLS, fd int32, base Toff_t, len1 Toff_t, advice int32) (r int32)
TEXT ·Yposix_fadvise(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ base+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL advice+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xposix_fadvise(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yposix_fallocate(tls *TLS, fd int32, base Toff_t, len1 Toff_t) (r int32)
TEXT ·Yposix_fallocate(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ base+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xposix_fallocate(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yposix_madvise(tls *TLS, addr uintptr, len1 Tsize_t, advice int32) (r int32)
TEXT ·Yposix_madvise(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL advice+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xposix_madvise(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yposix_openpt(tls *TLS, flags int32) (r1 int32)
TEXT ·Yposix_openpt(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL flags+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xposix_openpt(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yposix_spawn_file_actions_addchdir_np(tls *TLS, fa uintptr, path uintptr) (r int32)
TEXT ·Yposix_spawn_file_actions_addchdir_np(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fa+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawn_file_actions_addchdir_np(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawn_file_actions_addclose(tls *TLS, fa uintptr, fd int32) (r int32)
TEXT ·Yposix_spawn_file_actions_addclose(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fa+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL fd+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xposix_spawn_file_actions_addclose(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawn_file_actions_adddup2(tls *TLS, fa uintptr, srcfd int32, fd int32) (r int32)
TEXT ·Yposix_spawn_file_actions_adddup2(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fa+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL srcfd+16(FP), AX
	MOVL AX, 16(SP)
	MOVL fd+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xposix_spawn_file_actions_adddup2(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawn_file_actions_addfchdir_np(tls *TLS, fa uintptr, fd int32) (r int32)
TEXT ·Yposix_spawn_file_actions_addfchdir_np(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fa+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL fd+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xposix_spawn_file_actions_addfchdir_np(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawn_file_actions_addopen(tls *TLS, fa uintptr, fd int32, path uintptr, flags int32, mode Tmode_t) (r int32)
TEXT ·Yposix_spawn_file_actions_addopen(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fa+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL fd+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ path+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	MOVL mode+36(FP), AX
	MOVL AX, 36(SP)
	CALL ·Xposix_spawn_file_actions_addopen(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yposix_spawn_file_actions_destroy(tls *TLS, fa uintptr) (r int32)
TEXT ·Yposix_spawn_file_actions_destroy(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fa+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xposix_spawn_file_actions_destroy(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yposix_spawn_file_actions_init(tls *TLS, fa uintptr) (r int32)
TEXT ·Yposix_spawn_file_actions_init(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fa+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xposix_spawn_file_actions_init(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yposix_spawnattr_destroy(tls *TLS, attr uintptr) (r int32)
TEXT ·Yposix_spawnattr_destroy(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xposix_spawnattr_destroy(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yposix_spawnattr_getflags(tls *TLS, attr uintptr, flags uintptr) (r int32)
TEXT ·Yposix_spawnattr_getflags(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ flags+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_getflags(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_getpgroup(tls *TLS, attr uintptr, pgrp uintptr) (r int32)
TEXT ·Yposix_spawnattr_getpgroup(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ pgrp+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_getpgroup(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_getschedparam(tls *TLS, attr uintptr, schedparam uintptr) (r int32)
TEXT ·Yposix_spawnattr_getschedparam(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ schedparam+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_getschedparam(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_getschedpolicy(tls *TLS, attr uintptr, policy uintptr) (r int32)
TEXT ·Yposix_spawnattr_getschedpolicy(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ policy+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_getschedpolicy(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_getsigdefault(tls *TLS, attr uintptr, def uintptr) (r int32)
TEXT ·Yposix_spawnattr_getsigdefault(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ def+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_getsigdefault(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_getsigmask(tls *TLS, attr uintptr, mask uintptr) (r int32)
TEXT ·Yposix_spawnattr_getsigmask(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mask+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_getsigmask(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_init(tls *TLS, attr uintptr) (r int32)
TEXT ·Yposix_spawnattr_init(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xposix_spawnattr_init(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yposix_spawnattr_setflags(tls *TLS, attr uintptr, flags int16) (r int32)
TEXT ·Yposix_spawnattr_setflags(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVW flags+16(FP), AX
	MOVW AX, 16(SP)
	CALL ·Xposix_spawnattr_setflags(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_setpgroup(tls *TLS, attr uintptr, pgrp Tpid_t) (r int32)
TEXT ·Yposix_spawnattr_setpgroup(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL pgrp+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xposix_spawnattr_setpgroup(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_setschedparam(tls *TLS, attr uintptr, schedparam uintptr) (r int32)
TEXT ·Yposix_spawnattr_setschedparam(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ schedparam+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_setschedparam(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_setschedpolicy(tls *TLS, attr uintptr, policy int32) (r int32)
TEXT ·Yposix_spawnattr_setschedpolicy(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL policy+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xposix_spawnattr_setschedpolicy(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_setsigdefault(tls *TLS, attr uintptr, def uintptr) (r int32)
TEXT ·Yposix_spawnattr_setsigdefault(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ def+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_setsigdefault(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yposix_spawnattr_setsigmask(tls *TLS, attr uintptr, mask uintptr) (r int32)
TEXT ·Yposix_spawnattr_setsigmask(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ attr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mask+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xposix_spawnattr_setsigmask(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ypow(tls *TLS, x1 float64, y1 float64) (r float64)
TEXT ·Ypow(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpow(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ypow10(tls *TLS, x float64) (r float64)
TEXT ·Ypow10(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpow10(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ypow10f(tls *TLS, x float32) (r float32)
TEXT ·Ypow10f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xpow10f(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ypow10l(tls *TLS, x float64) (r float64)
TEXT ·Ypow10l(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpow10l(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ypowf(tls *TLS, x1 float32, y1 float32) (r float32)
TEXT ·Ypowf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x1+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y1+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xpowf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ypowl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Ypowl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpowl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yppoll(tls *TLS, fds uintptr, n Tnfds_t, to uintptr, mask uintptr) (r int32)
TEXT ·Yppoll(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fds+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ to+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ mask+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xppoll(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yprctl(tls *TLS, op int32, va uintptr) (r int32)
TEXT ·Yprctl(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL op+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xprctl(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ypread(tls *TLS, fd int32, buf uintptr, size Tsize_t, ofs Toff_t) (r Tssize_t)
TEXT ·Ypread(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ size+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ ofs+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xpread(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ypreadv(tls *TLS, fd int32, iov uintptr, count int32, ofs Toff_t) (r Tssize_t)
TEXT ·Ypreadv(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ iov+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL count+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ ofs+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xpreadv(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ypreadv2(tls *TLS, fd int32, iov uintptr, count int32, ofs Toff_t, flags int32) (r Tssize_t)
TEXT ·Ypreadv2(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ iov+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL count+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ ofs+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xpreadv2(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Yprintf(tls *TLS, fmt uintptr, va uintptr) (r int32)
TEXT ·Yprintf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xprintf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yprlimit(tls *TLS, pid Tpid_t, resource int32, new_limit uintptr, old_limit uintptr) (r1 int32)
TEXT ·Yprlimit(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVL resource+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ new_limit+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ old_limit+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xprlimit(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Yprocess_vm_readv(tls *TLS, pid Tpid_t, lvec uintptr, liovcnt uint64, rvec uintptr, riovcnt uint64, flags uint64) (r Tssize_t)
TEXT ·Yprocess_vm_readv(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ lvec+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ liovcnt+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ rvec+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ riovcnt+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ flags+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·Xprocess_vm_readv(SB)
	MOVQ 56(SP), AX
	MOVQ AX, r+56(FP)
	RET

// func Yprocess_vm_writev(tls *TLS, pid Tpid_t, lvec uintptr, liovcnt uint64, rvec uintptr, riovcnt uint64, flags uint64) (r Tssize_t)
TEXT ·Yprocess_vm_writev(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ lvec+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ liovcnt+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ rvec+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ riovcnt+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ flags+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·Xprocess_vm_writev(SB)
	MOVQ 56(SP), AX
	MOVQ AX, r+56(FP)
	RET

// func Ypselect(tls *TLS, n int32, rfds uintptr, wfds uintptr, efds uintptr, ts uintptr, mask uintptr) (r int32)
TEXT ·Ypselect(SB),$64-60
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ rfds+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ wfds+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ efds+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ ts+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ mask+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·Xpselect(SB)
	MOVL 56(SP), AX
	MOVL AX, r+56(FP)
	RET

// func Ypsiginfo(tls *TLS, si uintptr, msg uintptr)
TEXT ·Ypsiginfo(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ si+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ msg+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpsiginfo(SB)
	RET

// func Ypsignal(tls *TLS, sig int32, msg uintptr)
TEXT ·Ypsignal(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sig+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ msg+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpsignal(SB)
	RET

// func Ypthread_atfork(tls *TLS, prepare, parent, child uintptr) (_2 int32)
TEXT ·Ypthread_atfork(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ prepare+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ parent+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ child+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xpthread_atfork(SB)
	MOVL 32(SP), AX
	MOVL AX, _2+32(FP)
	RET

// func Ypthread_attr_destroy(tls *TLS, a uintptr) (_2 int32)
TEXT ·Ypthread_attr_destroy(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_attr_destroy(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_attr_getdetachstate(tls *TLS, a uintptr, state uintptr) (_3 int32)
TEXT ·Ypthread_attr_getdetachstate(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ state+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_attr_getdetachstate(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Ypthread_attr_init(tls *TLS, a uintptr) (_2 int32)
TEXT ·Ypthread_attr_init(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_attr_init(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_attr_setdetachstate(tls *TLS, a uintptr, state int32) (r int32)
TEXT ·Ypthread_attr_setdetachstate(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL state+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xpthread_attr_setdetachstate(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ypthread_attr_setscope(tls *TLS, a uintptr, scope int32) (_3 int32)
TEXT ·Ypthread_attr_setscope(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL scope+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xpthread_attr_setscope(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Ypthread_attr_setstacksize(tls *TLS, a uintptr, stacksite Tsize_t) (_3 int32)
TEXT ·Ypthread_attr_setstacksize(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ stacksite+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_attr_setstacksize(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Ypthread_cleanup_pop(tls *TLS, run int32)
TEXT ·Ypthread_cleanup_pop(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL run+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xpthread_cleanup_pop(SB)
	RET

// func Ypthread_cleanup_push(tls *TLS, f, x uintptr)
TEXT ·Ypthread_cleanup_push(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ x+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_cleanup_push(SB)
	RET

// func Ypthread_cond_broadcast(tls *TLS, c uintptr) (_2 int32)
TEXT ·Ypthread_cond_broadcast(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ c+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_cond_broadcast(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_cond_destroy(tls *TLS, c uintptr) (_2 int32)
TEXT ·Ypthread_cond_destroy(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ c+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_cond_destroy(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_cond_init(tls *TLS, c, a uintptr) (_2 int32)
TEXT ·Ypthread_cond_init(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ c+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_cond_init(SB)
	MOVL 24(SP), AX
	MOVL AX, _2+24(FP)
	RET

// func Ypthread_cond_signal(tls *TLS, c uintptr) (_2 int32)
TEXT ·Ypthread_cond_signal(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ c+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_cond_signal(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_cond_timedwait(tls *TLS, c, m, ts uintptr) (r int32)
TEXT ·Ypthread_cond_timedwait(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ c+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ m+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ts+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xpthread_cond_timedwait(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ypthread_cond_wait(tls *TLS, c, m uintptr) (_2 int32)
TEXT ·Ypthread_cond_wait(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ c+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ m+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_cond_wait(SB)
	MOVL 24(SP), AX
	MOVL AX, _2+24(FP)
	RET

// func Ypthread_create(tls *TLS, res, attrp, entry, arg uintptr) (_2 int32)
TEXT ·Ypthread_create(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ res+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ attrp+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ entry+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ arg+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xpthread_create(SB)
	MOVL 40(SP), AX
	MOVL AX, _2+40(FP)
	RET

// func Ypthread_detach(tls *TLS, t uintptr) (_2 int32)
TEXT ·Ypthread_detach(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_detach(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_equal(tls *TLS, t, u uintptr) (_2 int32)
TEXT ·Ypthread_equal(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ u+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_equal(SB)
	MOVL 24(SP), AX
	MOVL AX, _2+24(FP)
	RET

// func Ypthread_exit(tls *TLS, result uintptr)
TEXT ·Ypthread_exit(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ result+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_exit(SB)
	RET

// func Ypthread_getspecific(tls *TLS, k Tpthread_key_t) (_2 uintptr)
TEXT ·Ypthread_getspecific(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL k+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xpthread_getspecific(SB)
	MOVQ 16(SP), AX
	MOVQ AX, _2+16(FP)
	RET

// func Ypthread_join(tls *TLS, t Tpthread_t, res uintptr) (r int32)
TEXT ·Ypthread_join(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ res+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_join(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ypthread_key_create(tls *TLS, k uintptr, dtor uintptr) (_3 int32)
TEXT ·Ypthread_key_create(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ k+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ dtor+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_key_create(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Ypthread_key_delete(tls *TLS, k Tpthread_key_t) (_2 int32)
TEXT ·Ypthread_key_delete(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL k+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xpthread_key_delete(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_mutex_destroy(tls *TLS, m uintptr) (_2 int32)
TEXT ·Ypthread_mutex_destroy(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_mutex_destroy(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_mutex_init(tls *TLS, m, a uintptr) (_2 int32)
TEXT ·Ypthread_mutex_init(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ a+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_mutex_init(SB)
	MOVL 24(SP), AX
	MOVL AX, _2+24(FP)
	RET

// func Ypthread_mutex_lock(tls *TLS, m uintptr) (_2 int32)
TEXT ·Ypthread_mutex_lock(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_mutex_lock(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_mutex_trylock(tls *TLS, m uintptr) (_2 int32)
TEXT ·Ypthread_mutex_trylock(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_mutex_trylock(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_mutex_unlock(tls *TLS, m uintptr) (_2 int32)
TEXT ·Ypthread_mutex_unlock(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ m+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_mutex_unlock(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_mutexattr_destroy(tls *TLS, a uintptr) (_2 int32)
TEXT ·Ypthread_mutexattr_destroy(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_mutexattr_destroy(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_mutexattr_init(tls *TLS, a uintptr) (_2 int32)
TEXT ·Ypthread_mutexattr_init(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpthread_mutexattr_init(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ypthread_mutexattr_settype(tls *TLS, a uintptr, typ int32) (_3 int32)
TEXT ·Ypthread_mutexattr_settype(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL typ+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xpthread_mutexattr_settype(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Ypthread_self(tls *TLS) (_1 uintptr)
TEXT ·Ypthread_self(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xpthread_self(SB)
	MOVQ 8(SP), AX
	MOVQ AX, _1+8(FP)
	RET

// func Ypthread_setcancelstate(tls *TLS, new int32, old uintptr) (_3 int32)
TEXT ·Ypthread_setcancelstate(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL new+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ old+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_setcancelstate(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Ypthread_setspecific(tls *TLS, k Tpthread_key_t, x uintptr) (_3 int32)
TEXT ·Ypthread_setspecific(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL k+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ x+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xpthread_setspecific(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Ypthread_sigmask(tls *TLS, now int32, set, old uintptr) (_3 int32)
TEXT ·Ypthread_sigmask(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL now+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ set+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ old+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xpthread_sigmask(SB)
	MOVL 32(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Yptrace(tls *TLS, req int32, va uintptr) (r int64)
TEXT ·Yptrace(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL req+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xptrace(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yptsname(tls *TLS, fd int32) (r uintptr)
TEXT ·Yptsname(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xptsname(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yptsname_r(tls *TLS, fd int32, buf uintptr, len1 Tsize_t) (r int32)
TEXT ·Yptsname_r(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xptsname_r(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yputc(tls *TLS, c1 int32, f1 uintptr) (r int32)
TEXT ·Yputc(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c1+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xputc(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yputc_unlocked(tls *TLS, c int32, f uintptr) (r int32)
TEXT ·Yputc_unlocked(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xputc_unlocked(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yputchar(tls *TLS, c1 int32) (r int32)
TEXT ·Yputchar(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c1+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xputchar(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yputchar_unlocked(tls *TLS, c int32) (r int32)
TEXT ·Yputchar_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xputchar_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yputenv(tls *TLS, s uintptr) (r int32)
TEXT ·Yputenv(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xputenv(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yputgrent(tls *TLS, gr uintptr, f uintptr) (r1 int32)
TEXT ·Yputgrent(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ gr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xputgrent(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Yputpwent(tls *TLS, pw uintptr, f uintptr) (r int32)
TEXT ·Yputpwent(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ pw+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xputpwent(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yputs(tls *TLS, s uintptr) (r1 int32)
TEXT ·Yputs(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xputs(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yputspent(tls *TLS, sp uintptr, f uintptr) (r int32)
TEXT ·Yputspent(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ sp+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xputspent(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ypututline(tls *TLS, ut uintptr) (r uintptr)
TEXT ·Ypututline(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ut+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpututline(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ypututxline(tls *TLS, ut uintptr) (r uintptr)
TEXT ·Ypututxline(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ut+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xpututxline(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yputw(tls *TLS, _x int32, f uintptr) (r int32)
TEXT ·Yputw(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL _x+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xputw(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yputwc(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)
TEXT ·Yputwc(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xputwc(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yputwc_unlocked(tls *TLS, c Twchar_t, f uintptr) (r Twint_t)
TEXT ·Yputwc_unlocked(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xputwc_unlocked(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yputwchar(tls *TLS, c Twchar_t) (r Twint_t)
TEXT ·Yputwchar(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xputwchar(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yputwchar_unlocked(tls *TLS, c Twchar_t) (r Twint_t)
TEXT ·Yputwchar_unlocked(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xputwchar_unlocked(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ypwrite(tls *TLS, fd int32, buf uintptr, size Tsize_t, ofs Toff_t) (r Tssize_t)
TEXT ·Ypwrite(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ size+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ ofs+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xpwrite(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ypwritev(tls *TLS, fd int32, iov uintptr, count int32, ofs Toff_t) (r Tssize_t)
TEXT ·Ypwritev(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ iov+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL count+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ ofs+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xpwritev(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ypwritev2(tls *TLS, fd int32, iov uintptr, count int32, ofs Toff_t, flags int32) (r Tssize_t)
TEXT ·Ypwritev2(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ iov+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL count+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ ofs+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xpwritev2(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Yqsort(tls *TLS, base uintptr, nel Tsize_t, width Tsize_t, __ccgo_fp_cmp Tcmpfun)
TEXT ·Yqsort(SB),$48-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cmp+32(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_qsort_3(SB)	// Create the closure for calling __ccgo_fp_cmp
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ base+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ nel+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ width+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 32(SP)
	CALL ·Xqsort(SB)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_qsort_3(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Yqsort_r(tls *TLS, base uintptr, nel Tsize_t, width Tsize_t, __ccgo_fp_cmp Tcmpfun, arg uintptr)
TEXT ·Yqsort_r(SB),$56-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cmp+32(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_qsort_r_3(SB)	// Create the closure for calling __ccgo_fp_cmp
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ base+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ nel+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ width+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 32(SP)
	MOVQ arg+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xqsort_r(SB)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_qsort_r_3(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ _3+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ __ccgo_fp+32(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 32(SP), AX
	MOVL AX, _4+40(FP)
	RET

// func Yquick_exit(tls *TLS, code int32)
TEXT ·Yquick_exit(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL code+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xquick_exit(SB)
	RET

// func Yquotactl(tls *TLS, cmd int32, special uintptr, id int32, addr uintptr) (r int32)
TEXT ·Yquotactl(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL cmd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ special+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL id+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ addr+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xquotactl(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yraise(tls *TLS, sig int32) (r int32)
TEXT ·Yraise(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sig+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xraise(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yrand(tls *TLS) (r int32)
TEXT ·Yrand(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xrand(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yrand_r(tls *TLS, seed uintptr) (r int32)
TEXT ·Yrand_r(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ seed+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xrand_r(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yrandom(tls *TLS) (r int64)
TEXT ·Yrandom(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xrandom(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Yrandom_r(t *TLS, buf, result uintptr) (_2 int32)
TEXT ·Yrandom_r(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ result+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xrandom_r(SB)
	MOVL 24(SP), AX
	MOVL AX, _2+24(FP)
	RET

// func Yread(tls *TLS, fd int32, buf uintptr, count Tsize_t) (r Tssize_t)
TEXT ·Yread(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ count+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xread(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yreadahead(tls *TLS, fd int32, pos Toff_t, len1 Tsize_t) (r Tssize_t)
TEXT ·Yreadahead(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ pos+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xreadahead(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yreaddir(tls *TLS, dir uintptr) (r uintptr)
TEXT ·Yreaddir(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dir+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xreaddir(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yreaddir64(tls *TLS, dir uintptr) (r uintptr)
TEXT ·Yreaddir64(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dir+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xreaddir64(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yreaddir_r(tls *TLS, dir uintptr, buf uintptr, result uintptr) (r int32)
TEXT ·Yreaddir_r(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dir+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ result+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xreaddir_r(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yreadlink(tls *TLS, path uintptr, buf uintptr, bufsize Tsize_t) (r1 Tssize_t)
TEXT ·Yreadlink(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ bufsize+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xreadlink(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r1+32(FP)
	RET

// func Yreadlinkat(tls *TLS, fd int32, path uintptr, buf uintptr, bufsize Tsize_t) (r1 Tssize_t)
TEXT ·Yreadlinkat(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ bufsize+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xreadlinkat(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r1+40(FP)
	RET

// func Yreadv(tls *TLS, fd int32, iov uintptr, count int32) (r Tssize_t)
TEXT ·Yreadv(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ iov+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL count+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xreadv(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yrealloc(tls *TLS, p uintptr, n Tsize_t) (r uintptr)
TEXT ·Yrealloc(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ p+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xrealloc(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yreallocarray(tls *TLS, ptr uintptr, m Tsize_t, n Tsize_t) (r uintptr)
TEXT ·Yreallocarray(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ptr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ m+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xreallocarray(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yrealpath(tls *TLS, filename uintptr, resolved uintptr) (r uintptr)
TEXT ·Yrealpath(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ filename+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ resolved+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xrealpath(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yreboot(tls *TLS, type1 int32) (r int32)
TEXT ·Yreboot(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL type1+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xreboot(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yrecv(tls *TLS, fd int32, buf uintptr, len1 Tsize_t, flags int32) (r Tssize_t)
TEXT ·Yrecv(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xrecv(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yrecvfrom(tls *TLS, fd int32, buf uintptr, len1 Tsize_t, flags int32, addr uintptr, alen uintptr) (r1 Tssize_t)
TEXT ·Yrecvfrom(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ addr+40(FP), AX
	MOVQ AX, 40(SP)
	MOVQ alen+48(FP), AX
	MOVQ AX, 48(SP)
	CALL ·Xrecvfrom(SB)
	MOVQ 56(SP), AX
	MOVQ AX, r1+56(FP)
	RET

// func Yrecvmmsg(tls *TLS, fd int32, msgvec uintptr, vlen uint32, flags uint32, timeout uintptr) (r int32)
TEXT ·Yrecvmmsg(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ msgvec+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL vlen+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flags+28(FP), AX
	MOVL AX, 28(SP)
	MOVQ timeout+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xrecvmmsg(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yrecvmsg(tls *TLS, fd int32, msg uintptr, flags int32) (r2 Tssize_t)
TEXT ·Yrecvmsg(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ msg+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xrecvmsg(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r2+32(FP)
	RET

// func Yregcomp(tls *TLS, preg uintptr, regex uintptr, cflags int32) (r int32)
TEXT ·Yregcomp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ preg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ regex+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL cflags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xregcomp(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yregerror(tls *TLS, e int32, preg uintptr, buf uintptr, size Tsize_t) (r Tsize_t)
TEXT ·Yregerror(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL e+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ preg+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buf+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xregerror(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yregexec(tls *TLS, preg uintptr, string1 uintptr, nmatch Tsize_t, pmatch uintptr, eflags int32) (r int32)
TEXT ·Yregexec(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ preg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ string1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ nmatch+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ pmatch+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL eflags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xregexec(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Yregfree(tls *TLS, preg uintptr)
TEXT ·Yregfree(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ preg+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xregfree(SB)
	RET

// func Yremainder(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yremainder(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xremainder(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yremainderf(tls *TLS, x float32, y float32) (r float32)
TEXT ·Yremainderf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xremainderf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yremainderl(tls *TLS, x float64, y float64) (r float64)
TEXT ·Yremainderl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xremainderl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yremap_file_pages(tls *TLS, addr uintptr, size Tsize_t, prot int32, pgoff Tsize_t, flags int32) (r int32)
TEXT ·Yremap_file_pages(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL prot+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ pgoff+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xremap_file_pages(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Yremove(tls *TLS, path uintptr) (r1 int32)
TEXT ·Yremove(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xremove(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Yremovexattr(tls *TLS, path uintptr, name uintptr) (r int32)
TEXT ·Yremovexattr(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xremovexattr(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yremque(tls *TLS, element uintptr)
TEXT ·Yremque(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ element+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xremque(SB)
	RET

// func Yremquo(tls *TLS, x float64, y float64, quo uintptr) (r float64)
TEXT ·Yremquo(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ quo+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xremquo(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yremquof(tls *TLS, x float32, y float32, quo uintptr) (r float32)
TEXT ·Yremquof(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL y+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ quo+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xremquof(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yremquol(tls *TLS, x float64, y float64, quo uintptr) (r float64)
TEXT ·Yremquol(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ y+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ quo+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xremquol(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yrename(tls *TLS, old uintptr, new1 uintptr) (r int32)
TEXT ·Yrename(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ old+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ new1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xrename(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yrenameat(tls *TLS, oldfd int32, old uintptr, newfd int32, new1 uintptr) (r int32)
TEXT ·Yrenameat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL oldfd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ old+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL newfd+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ new1+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xrenameat(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yrenameat2(t *TLS, olddirfd int32, oldpath uintptr, newdirfd int32, newpath uintptr, flags int32) (_6 int32)
TEXT ·Yrenameat2(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL olddirfd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ oldpath+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL newdirfd+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ newpath+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xrenameat2(SB)
	MOVL 48(SP), AX
	MOVL AX, _6+48(FP)
	RET

// func Yres_init(tls *TLS) (r int32)
TEXT ·Yres_init(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xres_init(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yres_mkquery(tls *TLS, op int32, dname uintptr, class int32, type1 int32, data uintptr, datalen int32, newrr uintptr, buf uintptr, buflen int32) (r int32)
TEXT ·Yres_mkquery(SB),$80-76
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL op+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ dname+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL class+24(FP), AX
	MOVL AX, 24(SP)
	MOVL type1+28(FP), AX
	MOVL AX, 28(SP)
	MOVQ data+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL datalen+40(FP), AX
	MOVL AX, 40(SP)
	MOVQ newrr+48(FP), AX
	MOVQ AX, 48(SP)
	MOVQ buf+56(FP), AX
	MOVQ AX, 56(SP)
	MOVL buflen+64(FP), AX
	MOVL AX, 64(SP)
	CALL ·Xres_mkquery(SB)
	MOVL 72(SP), AX
	MOVL AX, r+72(FP)
	RET

// func Yres_send(tls *TLS, _msg uintptr, _msglen int32, _answer uintptr, _anslen int32) (r int32)
TEXT ·Yres_send(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _msg+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL _msglen+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ _answer+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL _anslen+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xres_send(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yrewind(tls *TLS, f uintptr)
TEXT ·Yrewind(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xrewind(SB)
	RET

// func Yrewinddir(tls *TLS, dir uintptr)
TEXT ·Yrewinddir(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dir+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xrewinddir(SB)
	RET

// func Yrindex(tls *TLS, s uintptr, c int32) (r uintptr)
TEXT ·Yrindex(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xrindex(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yrint(tls *TLS, x float64) (r float64)
TEXT ·Yrint(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xrint(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yrintf(tls *TLS, x float32) (r float32)
TEXT ·Yrintf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xrintf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yrintl(tls *TLS, x float64) (r float64)
TEXT ·Yrintl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xrintl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yrmdir(tls *TLS, path uintptr) (r int32)
TEXT ·Yrmdir(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xrmdir(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yround(tls *TLS, x3 float64) (r float64)
TEXT ·Yround(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xround(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yroundf(tls *TLS, x3 float32) (r float32)
TEXT ·Yroundf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xroundf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yroundl(tls *TLS, x float64) (r float64)
TEXT ·Yroundl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xroundl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysbrk(tls *TLS, inc Tintptr_t) (r uintptr)
TEXT ·Ysbrk(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ inc+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsbrk(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yscalb(tls *TLS, x float64, fn float64) (r float64)
TEXT ·Yscalb(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fn+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xscalb(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yscalbf(tls *TLS, x float32, fn float32) (r float32)
TEXT ·Yscalbf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL fn+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xscalbf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yscalbln(tls *TLS, x float64, n int64) (r float64)
TEXT ·Yscalbln(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xscalbln(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yscalblnf(tls *TLS, x float32, n int64) (r float32)
TEXT ·Yscalblnf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xscalblnf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yscalblnl(tls *TLS, x float64, n int64) (r float64)
TEXT ·Yscalblnl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xscalblnl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yscalbn(tls *TLS, x float64, n int32) (r float64)
TEXT ·Yscalbn(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xscalbn(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yscalbnf(tls *TLS, x float32, n int32) (r float32)
TEXT ·Yscalbnf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	MOVL n+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xscalbnf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yscalbnl(tls *TLS, x float64, n int32) (r float64)
TEXT ·Yscalbnl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL n+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xscalbnl(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yscandir(tls *TLS, path uintptr, res uintptr, __ccgo_fp_sel uintptr, __ccgo_fp_cmp uintptr) (r int32)
TEXT ·Yscandir(SB),$56-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $32, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_sel+24(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_scandir_2(SB)	// Create the closure for calling __ccgo_fp_sel
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $16, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cmp+32(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_scandir_3(SB)	// Create the closure for calling __ccgo_fp_cmp
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ res+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 24(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $16, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 32(SP)
	CALL ·Xscandir(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_scandir_2(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp+16(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 16(SP), AX
	MOVL AX, _2+24(FP)
	RET

TEXT ·__ccgo_abi0_scandir_3(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Yscanf(tls *TLS, fmt uintptr, va uintptr) (r int32)
TEXT ·Yscanf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xscanf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysched_yield(tls *TLS) (_1 int32)
TEXT ·Ysched_yield(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsched_yield(SB)
	MOVL 8(SP), AX
	MOVL AX, _1+8(FP)
	RET

// func Ysecure_getenv(tls *TLS, name uintptr) (r uintptr)
TEXT ·Ysecure_getenv(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsecure_getenv(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yseed48(tls *TLS, s uintptr) (r uintptr)
TEXT ·Yseed48(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xseed48(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yseekdir(tls *TLS, dir uintptr, off int64)
TEXT ·Yseekdir(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dir+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ off+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xseekdir(SB)
	RET

// func Yselect(tls *TLS, n int32, rfds uintptr, wfds uintptr, efds uintptr, tv uintptr) (r int32)
TEXT ·Yselect(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ rfds+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ wfds+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ efds+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ tv+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xselect(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Ysemctl(tls *TLS, id int32, num int32, cmd int32, va uintptr) (r1 int32)
TEXT ·Ysemctl(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL id+8(FP), AX
	MOVL AX, 8(SP)
	MOVL num+12(FP), AX
	MOVL AX, 12(SP)
	MOVL cmd+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsemctl(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ysemget(tls *TLS, key Tkey_t, n int32, fl int32) (r int32)
TEXT ·Ysemget(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL key+8(FP), AX
	MOVL AX, 8(SP)
	MOVL n+12(FP), AX
	MOVL AX, 12(SP)
	MOVL fl+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xsemget(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysemop(tls *TLS, id int32, buf uintptr, n Tsize_t) (r int32)
TEXT ·Ysemop(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL id+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsemop(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ysemtimedop(tls *TLS, id int32, buf uintptr, n Tsize_t, ts uintptr) (r int32)
TEXT ·Ysemtimedop(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL id+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ ts+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xsemtimedop(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ysend(tls *TLS, fd int32, buf uintptr, len1 Tsize_t, flags int32) (r Tssize_t)
TEXT ·Ysend(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xsend(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ysendfile(tls *TLS, out_fd int32, in_fd int32, ofs uintptr, count Tsize_t) (r Tssize_t)
TEXT ·Ysendfile(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL out_fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL in_fd+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ ofs+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ count+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsendfile(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ysendmmsg(tls *TLS, fd int32, msgvec uintptr, vlen uint32, flags uint32) (r1 int32)
TEXT ·Ysendmmsg(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ msgvec+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL vlen+24(FP), AX
	MOVL AX, 24(SP)
	MOVL flags+28(FP), AX
	MOVL AX, 28(SP)
	CALL ·Xsendmmsg(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ysendmsg(tls *TLS, fd int32, msg uintptr, flags int32) (r1 Tssize_t)
TEXT ·Ysendmsg(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ msg+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xsendmsg(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r1+32(FP)
	RET

// func Ysendto(tls *TLS, fd int32, buf uintptr, len1 Tsize_t, flags int32, addr uintptr, alen Tsocklen_t) (r1 Tssize_t)
TEXT ·Ysendto(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	MOVQ addr+40(FP), AX
	MOVQ AX, 40(SP)
	MOVL alen+48(FP), AX
	MOVL AX, 48(SP)
	CALL ·Xsendto(SB)
	MOVQ 56(SP), AX
	MOVQ AX, r1+56(FP)
	RET

// func Ysetbuf(tls *TLS, f uintptr, buf uintptr)
TEXT ·Ysetbuf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsetbuf(SB)
	RET

// func Ysetbuffer(tls *TLS, f uintptr, buf uintptr, size Tsize_t)
TEXT ·Ysetbuffer(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ size+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsetbuffer(SB)
	RET

// func Ysetdomainname(tls *TLS, name uintptr, len1 Tsize_t) (r int32)
TEXT ·Ysetdomainname(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsetdomainname(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysetenv(tls *TLS, var1 uintptr, value uintptr, overwrite int32) (r int32)
TEXT ·Ysetenv(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ var1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ value+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL overwrite+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xsetenv(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ysetfsgid(tls *TLS, gid Tgid_t) (r int32)
TEXT ·Ysetfsgid(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL gid+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsetfsgid(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysetfsuid(tls *TLS, uid Tuid_t) (r int32)
TEXT ·Ysetfsuid(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL uid+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsetfsuid(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysetgid(tls *TLS, gid Tgid_t) (r int32)
TEXT ·Ysetgid(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL gid+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsetgid(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysetgrent(tls *TLS)
TEXT ·Ysetgrent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsetgrent(SB)
	RET

// func Ysethostent(tls *TLS, x int32)
TEXT ·Ysethostent(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsethostent(SB)
	RET

// func Ysethostname(tls *TLS, name uintptr, len1 Tsize_t) (r int32)
TEXT ·Ysethostname(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsethostname(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysetitimer(tls *TLS, which int32, new1 uintptr, old uintptr) (r1 int32)
TEXT ·Ysetitimer(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL which+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ new1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ old+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsetitimer(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ysetjmp(t *TLS, env uintptr) (_2 int32)
TEXT ·Ysetjmp(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ env+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsetjmp(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ysetkey(tls *TLS, key uintptr)
TEXT ·Ysetkey(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsetkey(SB)
	RET

// func Ysetlinebuf(tls *TLS, f uintptr)
TEXT ·Ysetlinebuf(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsetlinebuf(SB)
	RET

// func Ysetlocale(tls *TLS, cat int32, name uintptr) (r uintptr)
TEXT ·Ysetlocale(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL cat+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsetlocale(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ysetlogmask(tls *TLS, maskpri int32) (r int32)
TEXT ·Ysetlogmask(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL maskpri+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsetlogmask(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysetmntent(tls *TLS, name uintptr, mode uintptr) (r uintptr)
TEXT ·Ysetmntent(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ mode+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsetmntent(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ysetnetent(tls *TLS, x int32)
TEXT ·Ysetnetent(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsetnetent(SB)
	RET

// func Ysetns(tls *TLS, fd int32, nstype int32) (r int32)
TEXT ·Ysetns(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL nstype+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xsetns(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysetpgid(tls *TLS, pid Tpid_t, pgid Tpid_t) (r int32)
TEXT ·Ysetpgid(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVL pgid+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xsetpgid(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysetpgrp(tls *TLS) (r Tpid_t)
TEXT ·Ysetpgrp(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsetpgrp(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ysetpriority(tls *TLS, which int32, who Tid_t, prio int32) (r int32)
TEXT ·Ysetpriority(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL which+8(FP), AX
	MOVL AX, 8(SP)
	MOVL who+12(FP), AX
	MOVL AX, 12(SP)
	MOVL prio+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xsetpriority(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysetprotoent(tls *TLS, stayopen int32)
TEXT ·Ysetprotoent(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL stayopen+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsetprotoent(SB)
	RET

// func Ysetpwent(tls *TLS)
TEXT ·Ysetpwent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsetpwent(SB)
	RET

// func Ysetrlimit(tls *TLS, resource int32, rlim uintptr) (r int32)
TEXT ·Ysetrlimit(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL resource+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ rlim+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsetrlimit(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysetrlimit64(tls *TLS, resource int32, rlim uintptr) (r int32)
TEXT ·Ysetrlimit64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL resource+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ rlim+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsetrlimit64(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysetservent(tls *TLS, stayopen int32)
TEXT ·Ysetservent(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL stayopen+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsetservent(SB)
	RET

// func Ysetsid(tls *TLS) (r Tpid_t)
TEXT ·Ysetsid(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsetsid(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Ysetsockopt(tls *TLS, fd int32, level int32, optname int32, optval uintptr, optlen Tsocklen_t) (r2 int32)
TEXT ·Ysetsockopt(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL level+12(FP), AX
	MOVL AX, 12(SP)
	MOVL optname+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ optval+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL optlen+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xsetsockopt(SB)
	MOVL 40(SP), AX
	MOVL AX, r2+40(FP)
	RET

// func Ysetspent(tls *TLS)
TEXT ·Ysetspent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsetspent(SB)
	RET

// func Ysetstate(tls *TLS, state uintptr) (r uintptr)
TEXT ·Ysetstate(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ state+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsetstate(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysettimeofday(tls *TLS, tv uintptr, tz uintptr) (r int32)
TEXT ·Ysettimeofday(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tv+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ tz+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsettimeofday(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysetuid(tls *TLS, uid Tuid_t) (r int32)
TEXT ·Ysetuid(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL uid+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsetuid(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysetusershell(tls *TLS)
TEXT ·Ysetusershell(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsetusershell(SB)
	RET

// func Ysetutent(tls *TLS)
TEXT ·Ysetutent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsetutent(SB)
	RET

// func Ysetutxent(tls *TLS)
TEXT ·Ysetutxent(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsetutxent(SB)
	RET

// func Ysetvbuf(tls *TLS, f uintptr, buf uintptr, type1 int32, size Tsize_t) (r int32)
TEXT ·Ysetvbuf(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL type1+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xsetvbuf(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ysetxattr(tls *TLS, path uintptr, name uintptr, value uintptr, size Tsize_t, flags int32) (r int32)
TEXT ·Ysetxattr(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ value+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ size+32(FP), AX
	MOVQ AX, 32(SP)
	MOVL flags+40(FP), AX
	MOVL AX, 40(SP)
	CALL ·Xsetxattr(SB)
	MOVL 48(SP), AX
	MOVL AX, r+48(FP)
	RET

// func Yshm_open(tls *TLS, name uintptr, flag int32, mode Tmode_t) (r int32)
TEXT ·Yshm_open(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flag+16(FP), AX
	MOVL AX, 16(SP)
	MOVL mode+20(FP), AX
	MOVL AX, 20(SP)
	CALL ·Xshm_open(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yshm_unlink(tls *TLS, name uintptr) (r int32)
TEXT ·Yshm_unlink(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xshm_unlink(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yshmat(tls *TLS, id int32, addr uintptr, flag int32) (r uintptr)
TEXT ·Yshmat(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL id+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ addr+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flag+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xshmat(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Yshmctl(tls *TLS, id int32, cmd int32, buf uintptr) (r1 int32)
TEXT ·Yshmctl(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL id+8(FP), AX
	MOVL AX, 8(SP)
	MOVL cmd+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xshmctl(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Yshmdt(tls *TLS, addr uintptr) (r int32)
TEXT ·Yshmdt(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ addr+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xshmdt(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yshmget(tls *TLS, key Tkey_t, size Tsize_t, flag int32) (r int32)
TEXT ·Yshmget(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL key+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ size+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flag+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xshmget(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yshutdown(tls *TLS, fd int32, how int32) (r1 int32)
TEXT ·Yshutdown(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL how+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xshutdown(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Ysigaction(tls *TLS, sig int32, sa uintptr, old uintptr) (r int32)
TEXT ·Ysigaction(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL sig+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ sa+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ old+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsigaction(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ysigaddset(tls *TLS, set uintptr, sig int32) (r int32)
TEXT ·Ysigaddset(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL sig+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xsigaddset(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysigaltstack(tls *TLS, ss uintptr, old uintptr) (r int32)
TEXT ·Ysigaltstack(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ss+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ old+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsigaltstack(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysigandset(tls *TLS, dest uintptr, left uintptr, right uintptr) (r1 int32)
TEXT ·Ysigandset(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ left+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ right+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsigandset(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ysigdelset(tls *TLS, set uintptr, sig int32) (r int32)
TEXT ·Ysigdelset(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL sig+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xsigdelset(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysigemptyset(tls *TLS, set uintptr) (r int32)
TEXT ·Ysigemptyset(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsigemptyset(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysigfillset(tls *TLS, set uintptr) (r int32)
TEXT ·Ysigfillset(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsigfillset(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysigisemptyset(tls *TLS, set uintptr) (r int32)
TEXT ·Ysigisemptyset(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsigisemptyset(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysigismember(tls *TLS, set uintptr, sig int32) (r int32)
TEXT ·Ysigismember(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL sig+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xsigismember(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysignal(tls *TLS, signum int32, handler uintptr) (r uintptr)
TEXT ·Ysignal(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL signum+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ handler+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsignal(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ysignalfd(tls *TLS, fd int32, sigs uintptr, flags int32) (r int32)
TEXT ·Ysignalfd(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ sigs+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xsignalfd(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ysignificand(tls *TLS, x float64) (r float64)
TEXT ·Ysignificand(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsignificand(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysignificandf(tls *TLS, x float32) (r float32)
TEXT ·Ysignificandf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsignificandf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysigorset(tls *TLS, dest uintptr, left uintptr, right uintptr) (r1 int32)
TEXT ·Ysigorset(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ left+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ right+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsigorset(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ysigpending(tls *TLS, set uintptr) (r int32)
TEXT ·Ysigpending(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ set+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsigpending(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysigprocmask(tls *TLS, how int32, set uintptr, old uintptr) (r1 int32)
TEXT ·Ysigprocmask(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL how+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ set+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ old+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsigprocmask(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ysigqueue(tls *TLS, pid Tpid_t, sig int32, value Tsigval) (r1 int32)
TEXT ·Ysigqueue(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVL sig+12(FP), AX
	MOVL AX, 12(SP)
	MOVL value_Fsival_int+16(FP), AX
	MOVL AX, 16(SP)
	MOVB value_F__ccgo_pad2_0+20(FP), AX
	MOVB AX, 20(SP)
	MOVB value_F__ccgo_pad2_1+21(FP), AX
	MOVB AX, 21(SP)
	MOVB value_F__ccgo_pad2_2+22(FP), AX
	MOVB AX, 22(SP)
	MOVB value_F__ccgo_pad2_3+23(FP), AX
	MOVB AX, 23(SP)
	CALL ·Xsigqueue(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ysigsuspend(tls *TLS, mask uintptr) (r int32)
TEXT ·Ysigsuspend(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ mask+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsigsuspend(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysigtimedwait(tls *TLS, mask uintptr, si uintptr, timeout uintptr) (r int32)
TEXT ·Ysigtimedwait(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ mask+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ si+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ timeout+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsigtimedwait(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ysigwait(tls *TLS, mask uintptr, sig uintptr) (r int32)
TEXT ·Ysigwait(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ mask+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sig+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsigwait(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysigwaitinfo(tls *TLS, mask uintptr, si uintptr) (r int32)
TEXT ·Ysigwaitinfo(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ mask+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ si+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsigwaitinfo(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysin(tls *TLS, x3 float64) (r float64)
TEXT ·Ysin(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsin(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysincos(tls *TLS, x3 float64, sin uintptr, cos uintptr)
TEXT ·Ysincos(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sin+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ cos+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsincos(SB)
	RET

// func Ysincosf(tls *TLS, x3 float32, sin uintptr, cos uintptr)
TEXT ·Ysincosf(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ sin+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ cos+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsincosf(SB)
	RET

// func Ysincosl(tls *TLS, x float64, sin uintptr, cos uintptr)
TEXT ·Ysincosl(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sin+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ cos+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsincosl(SB)
	RET

// func Ysinf(tls *TLS, x3 float32) (r float32)
TEXT ·Ysinf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsinf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysinh(tls *TLS, x float64) (r float64)
TEXT ·Ysinh(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsinh(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysinhf(tls *TLS, x float32) (r float32)
TEXT ·Ysinhf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsinhf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysinhl(tls *TLS, x float64) (r float64)
TEXT ·Ysinhl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsinhl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysinl(tls *TLS, x float64) (r float64)
TEXT ·Ysinl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsinl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysleep(tls *TLS, seconds uint32) (r uint32)
TEXT ·Ysleep(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL seconds+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsleep(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysnprintf(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, va uintptr) (r int32)
TEXT ·Ysnprintf(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ fmt+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ va+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xsnprintf(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ysockatmark(tls *TLS, s int32) (r int32)
TEXT ·Ysockatmark(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL s+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsockatmark(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysocket(tls *TLS, domain int32, type1 int32, protocol int32) (r1 int32)
TEXT ·Ysocket(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL domain+8(FP), AX
	MOVL AX, 8(SP)
	MOVL type1+12(FP), AX
	MOVL AX, 12(SP)
	MOVL protocol+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xsocket(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ysocketpair(tls *TLS, domain int32, type1 int32, protocol int32, fd uintptr) (r2 int32)
TEXT ·Ysocketpair(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL domain+8(FP), AX
	MOVL AX, 8(SP)
	MOVL type1+12(FP), AX
	MOVL AX, 12(SP)
	MOVL protocol+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ fd+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsocketpair(SB)
	MOVL 32(SP), AX
	MOVL AX, r2+32(FP)
	RET

// func Ysplice(tls *TLS, fd_in int32, off_in uintptr, fd_out int32, off_out uintptr, len1 Tsize_t, flags uint32) (r Tssize_t)
TEXT ·Ysplice(SB),$64-64
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd_in+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ off_in+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL fd_out+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ off_out+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ len1+40(FP), AX
	MOVQ AX, 40(SP)
	MOVL flags+48(FP), AX
	MOVL AX, 48(SP)
	CALL ·Xsplice(SB)
	MOVQ 56(SP), AX
	MOVQ AX, r+56(FP)
	RET

// func Ysprintf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Ysprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ysqrt(tls *TLS, x1 float64) (r1 float64)
TEXT ·Ysqrt(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsqrt(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Ysqrtf(tls *TLS, x1 float32) (r1 float32)
TEXT ·Ysqrtf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x1+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsqrtf(SB)
	MOVL 16(SP), AX
	MOVL AX, r1+16(FP)
	RET

// func Ysqrtl(tls *TLS, x float64) (r float64)
TEXT ·Ysqrtl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsqrtl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysrand(tls *TLS, s uint32)
TEXT ·Ysrand(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL s+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsrand(SB)
	RET

// func Ysrand48(tls *TLS, seed int64)
TEXT ·Ysrand48(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ seed+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsrand48(SB)
	RET

// func Ysrandom(tls *TLS, seed uint32)
TEXT ·Ysrandom(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL seed+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsrandom(SB)
	RET

// func Ysscanf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Ysscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ystat(tls *TLS, path uintptr, buf uintptr) (r int32)
TEXT ·Ystat(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstat(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ystat64(tls *TLS, path uintptr, buf uintptr) (r int32)
TEXT ·Ystat64(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstat64(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ystatvfs(tls *TLS, path uintptr, buf uintptr) (r int32)
TEXT ·Ystatvfs(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstatvfs(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ystatx(tls *TLS, dirfd int32, path uintptr, flags int32, mask uint32, stx uintptr) (r int32)
TEXT ·Ystatx(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL dirfd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	MOVL mask+28(FP), AX
	MOVL AX, 28(SP)
	MOVQ stx+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xstatx(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ystime(tls *TLS, t uintptr) (r int32)
TEXT ·Ystime(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xstime(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ystpcpy(tls *TLS, d uintptr, s uintptr) (r uintptr)
TEXT ·Ystpcpy(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstpcpy(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystpncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ystpncpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstpncpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrcasecmp(tls *TLS, _l uintptr, _r uintptr) (r1 int32)
TEXT ·Ystrcasecmp(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _r+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrcasecmp(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ystrcasecmp_l(tls *TLS, l uintptr, r uintptr, loc Tlocale_t) (r1 int32)
TEXT ·Ystrcasecmp_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ loc+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrcasecmp_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ystrcasestr(tls *TLS, h uintptr, n uintptr) (r uintptr)
TEXT ·Ystrcasestr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ h+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrcasestr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrcat(tls *TLS, dest uintptr, src uintptr) (r uintptr)
TEXT ·Ystrcat(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrcat(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrchr(tls *TLS, s uintptr, c int32) (r1 uintptr)
TEXT ·Ystrchr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xstrchr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r1+24(FP)
	RET

// func Ystrchrnul(tls *TLS, s uintptr, c int32) (r uintptr)
TEXT ·Ystrchrnul(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xstrchrnul(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrcmp(tls *TLS, l uintptr, r uintptr) (r1 int32)
TEXT ·Ystrcmp(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrcmp(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ystrcoll(tls *TLS, l uintptr, r uintptr) (r1 int32)
TEXT ·Ystrcoll(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrcoll(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ystrcoll_l(tls *TLS, l uintptr, r uintptr, loc Tlocale_t) (r1 int32)
TEXT ·Ystrcoll_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ loc+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrcoll_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ystrcpy(tls *TLS, dest uintptr, src uintptr) (r uintptr)
TEXT ·Ystrcpy(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrcpy(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrcspn(tls *TLS, s uintptr, c uintptr) (r Tsize_t)
TEXT ·Ystrcspn(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ c+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrcspn(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrdup(tls *TLS, s uintptr) (r uintptr)
TEXT ·Ystrdup(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xstrdup(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ystrerror(tls *TLS, e int32) (r uintptr)
TEXT ·Ystrerror(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL e+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xstrerror(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ystrerror_l(tls *TLS, e int32, loc Tlocale_t) (r uintptr)
TEXT ·Ystrerror_l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL e+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ loc+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrerror_l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrerror_r(tls *TLS, err int32, buf uintptr, buflen Tsize_t) (r int32)
TEXT ·Ystrerror_r(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL err+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ buflen+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrerror_r(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ystrfmon(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, va uintptr) (r Tssize_t)
TEXT ·Ystrfmon(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ fmt+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ va+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xstrfmon(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ystrfmon_l(tls *TLS, s uintptr, n Tsize_t, loc Tlocale_t, fmt uintptr, va uintptr) (r Tssize_t)
TEXT ·Ystrfmon_l(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ loc+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ fmt+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ va+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xstrfmon_l(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ystrftime(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr) (r Tsize_t)
TEXT ·Ystrftime(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ tm+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xstrftime(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ystrftime_l(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr, loc Tlocale_t) (r Tsize_t)
TEXT ·Ystrftime_l(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ tm+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ loc+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xstrftime_l(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ystrlcat(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r Tsize_t)
TEXT ·Ystrlcat(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrlcat(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrlcpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r Tsize_t)
TEXT ·Ystrlcpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrlcpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrlen(tls *TLS, s uintptr) (r Tsize_t)
TEXT ·Ystrlen(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xstrlen(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ystrncasecmp(tls *TLS, _l uintptr, _r uintptr, n Tsize_t) (r1 int32)
TEXT ·Ystrncasecmp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrncasecmp(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ystrncasecmp_l(tls *TLS, l uintptr, r uintptr, n Tsize_t, loc Tlocale_t) (r1 int32)
TEXT ·Ystrncasecmp_l(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ loc+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xstrncasecmp_l(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Ystrncat(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ystrncat(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrncat(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrncmp(tls *TLS, _l uintptr, _r uintptr, n Tsize_t) (r1 int32)
TEXT ·Ystrncmp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrncmp(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ystrncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ystrncpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrncpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrndup(tls *TLS, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ystrndup(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrndup(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrnlen(tls *TLS, s uintptr, n Tsize_t) (r Tsize_t)
TEXT ·Ystrnlen(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrnlen(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrpbrk(tls *TLS, s uintptr, b uintptr) (r uintptr)
TEXT ·Ystrpbrk(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrpbrk(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrptime(tls *TLS, s uintptr, f uintptr, tm uintptr) (r uintptr)
TEXT ·Ystrptime(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ tm+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrptime(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrrchr(tls *TLS, s uintptr, c int32) (r uintptr)
TEXT ·Ystrrchr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xstrrchr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrsep(tls *TLS, str uintptr, sep uintptr) (r uintptr)
TEXT ·Ystrsep(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ str+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sep+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrsep(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrsignal(tls *TLS, signum int32) (r uintptr)
TEXT ·Ystrsignal(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL signum+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xstrsignal(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ystrspn(tls *TLS, s uintptr, c uintptr) (r Tsize_t)
TEXT ·Ystrspn(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ c+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrspn(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrstr(tls *TLS, h uintptr, n uintptr) (r uintptr)
TEXT ·Ystrstr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ h+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrstr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrtod(tls *TLS, s uintptr, p uintptr) (r float64)
TEXT ·Ystrtod(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrtod(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrtod_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float64)
TEXT ·Ystrtod_l(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrtod_l(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrtof(tls *TLS, s uintptr, p uintptr) (r float32)
TEXT ·Ystrtof(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrtof(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ystrtof_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float32)
TEXT ·Ystrtof_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrtof_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ystrtoimax(tls *TLS, s uintptr, p uintptr, base int32) (r Tintmax_t)
TEXT ·Ystrtoimax(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xstrtoimax(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrtok(tls *TLS, s uintptr, sep uintptr) (r uintptr)
TEXT ·Ystrtok(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sep+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrtok(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrtok_r(tls *TLS, s uintptr, sep uintptr, p uintptr) (r uintptr)
TEXT ·Ystrtok_r(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sep+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ p+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrtok_r(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrtol(tls *TLS, s uintptr, p uintptr, base int32) (r int64)
TEXT ·Ystrtol(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xstrtol(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrtold(tls *TLS, s uintptr, p uintptr) (r float64)
TEXT ·Ystrtold(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrtold(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ystrtold_l(tls *TLS, s uintptr, p uintptr, l Tlocale_t) (r float64)
TEXT ·Ystrtold_l(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrtold_l(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrtoll(tls *TLS, s uintptr, p uintptr, base int32) (r int64)
TEXT ·Ystrtoll(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xstrtoll(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrtoul(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)
TEXT ·Ystrtoul(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xstrtoul(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrtoull(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)
TEXT ·Ystrtoull(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xstrtoull(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrtoumax(tls *TLS, s uintptr, p uintptr, base int32) (r Tuintmax_t)
TEXT ·Ystrtoumax(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xstrtoumax(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrverscmp(tls *TLS, l0 uintptr, r0 uintptr) (r1 int32)
TEXT ·Ystrverscmp(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l0+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r0+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xstrverscmp(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ystrxfrm(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r Tsize_t)
TEXT ·Ystrxfrm(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xstrxfrm(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ystrxfrm_l(tls *TLS, dest uintptr, src uintptr, n Tsize_t, loc Tlocale_t) (r Tsize_t)
TEXT ·Ystrxfrm_l(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ loc+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xstrxfrm_l(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yswab(tls *TLS, _src uintptr, _dest uintptr, n Tssize_t)
TEXT ·Yswab(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _src+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _dest+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xswab(SB)
	RET

// func Yswapoff(tls *TLS, path uintptr) (r int32)
TEXT ·Yswapoff(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xswapoff(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yswapon(tls *TLS, path uintptr, flags int32) (r int32)
TEXT ·Yswapon(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xswapon(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yswprintf(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, va uintptr) (r int32)
TEXT ·Yswprintf(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ fmt+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ va+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xswprintf(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yswscanf(tls *TLS, s uintptr, fmt uintptr, va uintptr) (r int32)
TEXT ·Yswscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xswscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ysymlink(tls *TLS, existing uintptr, new1 uintptr) (r int32)
TEXT ·Ysymlink(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ existing+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ new1+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsymlink(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ysymlinkat(tls *TLS, existing uintptr, fd int32, new1 uintptr) (r int32)
TEXT ·Ysymlinkat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ existing+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL fd+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ new1+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsymlinkat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ysync(tls *TLS)
TEXT ·Ysync(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xsync(SB)
	RET

// func Ysync_file_range(tls *TLS, fd int32, pos Toff_t, len1 Toff_t, flags uint32) (r int32)
TEXT ·Ysync_file_range(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ pos+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ len1+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xsync_file_range(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ysyncfs(tls *TLS, fd int32) (r int32)
TEXT ·Ysyncfs(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsyncfs(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysyscall(tls *TLS, n int64, va uintptr) (r int64)
TEXT ·Ysyscall(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ n+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xsyscall(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ysysconf(tls *TLS, name int32) (r int64)
TEXT ·Ysysconf(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL name+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xsysconf(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ysysctlbyname(t *TLS, name, oldp, oldlenp, newp uintptr, newlen Tsize_t) (_3 int32)
TEXT ·Ysysctlbyname(SB),$56-52
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ oldp+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ oldlenp+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ newp+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ newlen+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xsysctlbyname(SB)
	MOVL 48(SP), AX
	MOVL AX, _3+48(FP)
	RET

// func Ysysinfo(tls *TLS, info uintptr) (r int32)
TEXT ·Ysysinfo(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ info+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsysinfo(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ysyslog(tls *TLS, priority int32, message uintptr, va uintptr)
TEXT ·Ysyslog(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL priority+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ message+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ va+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xsyslog(SB)
	RET

// func Ysystem(t *TLS, command uintptr) (_2 int32)
TEXT ·Ysystem(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ command+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xsystem(SB)
	MOVL 16(SP), AX
	MOVL AX, _2+16(FP)
	RET

// func Ytan(tls *TLS, x3 float64) (r float64)
TEXT ·Ytan(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtan(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytanf(tls *TLS, x3 float32) (r float32)
TEXT ·Ytanf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtanf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytanh(tls *TLS, x3 float64) (r float64)
TEXT ·Ytanh(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtanh(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytanhf(tls *TLS, x3 float32) (r float32)
TEXT ·Ytanhf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtanhf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytanhl(tls *TLS, x float64) (r float64)
TEXT ·Ytanhl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtanhl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytanl(tls *TLS, x float64) (r float64)
TEXT ·Ytanl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtanl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytcdrain(tls *TLS, fd int32) (r int32)
TEXT ·Ytcdrain(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtcdrain(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytcflow(tls *TLS, fd int32, action int32) (r int32)
TEXT ·Ytcflow(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL action+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xtcflow(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytcflush(tls *TLS, fd int32, queue int32) (r int32)
TEXT ·Ytcflush(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL queue+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xtcflush(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytcgetattr(tls *TLS, fd int32, tio uintptr) (r int32)
TEXT ·Ytcgetattr(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ tio+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtcgetattr(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytcgetpgrp(tls *TLS, fd int32) (r Tpid_t)
TEXT ·Ytcgetpgrp(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtcgetpgrp(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytcgetsid(tls *TLS, fd int32) (r Tpid_t)
TEXT ·Ytcgetsid(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtcgetsid(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytcgetwinsize(tls *TLS, fd int32, wsz uintptr) (r int32)
TEXT ·Ytcgetwinsize(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ wsz+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtcgetwinsize(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytcsendbreak(tls *TLS, fd int32, dur int32) (r int32)
TEXT ·Ytcsendbreak(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL dur+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xtcsendbreak(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytcsetattr(tls *TLS, fd int32, act int32, tio uintptr) (r int32)
TEXT ·Ytcsetattr(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL act+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ tio+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtcsetattr(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytcsetpgrp(tls *TLS, fd int32, pgrp Tpid_t) (r int32)
TEXT ·Ytcsetpgrp(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL pgrp+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xtcsetpgrp(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytcsetwinsize(tls *TLS, fd int32, wsz uintptr) (r int32)
TEXT ·Ytcsetwinsize(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ wsz+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtcsetwinsize(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytdelete(tls *TLS, key uintptr, rootp uintptr, __ccgo_fp_cmp uintptr) (r uintptr)
TEXT ·Ytdelete(SB),$48-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cmp+24(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_tdelete_2(SB)	// Create the closure for calling __ccgo_fp_cmp
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ rootp+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 24(SP)
	CALL ·Xtdelete(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_tdelete_2(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Ytdestroy(tls *TLS, root uintptr, __ccgo_fp_freekey uintptr)
TEXT ·Ytdestroy(SB),$32-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_freekey+16(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_tdestroy_1(SB)	// Create the closure for calling __ccgo_fp_freekey
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ root+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 16(SP)
	CALL ·Xtdestroy(SB)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_tdestroy_1(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp+16(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	RET

// func Ytee(tls *TLS, src int32, dest int32, len1 Tsize_t, flags uint32) (r Tssize_t)
TEXT ·Ytee(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL src+8(FP), AX
	MOVL AX, 8(SP)
	MOVL dest+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ len1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flags+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xtee(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ytelldir(tls *TLS, dir uintptr) (r int64)
TEXT ·Ytelldir(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dir+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtelldir(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytempnam(tls *TLS, dir uintptr, pfx uintptr) (r1 uintptr)
TEXT ·Ytempnam(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dir+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ pfx+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtempnam(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r1+24(FP)
	RET

// func Ytextdomain(tls *TLS, domainname uintptr) (r uintptr)
TEXT ·Ytextdomain(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ domainname+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtextdomain(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytfind(tls *TLS, key uintptr, rootp uintptr, __ccgo_fp_cmp uintptr) (r uintptr)
TEXT ·Ytfind(SB),$48-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cmp+24(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_tfind_2(SB)	// Create the closure for calling __ccgo_fp_cmp
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ rootp+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 24(SP)
	CALL ·Xtfind(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_tfind_2(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Ytgamma(tls *TLS, x3 float64) (r1 float64)
TEXT ·Ytgamma(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtgamma(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Ytgammaf(tls *TLS, x float32) (r float32)
TEXT ·Ytgammaf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtgammaf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytgammal(tls *TLS, x float64) (r float64)
TEXT ·Ytgammal(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtgammal(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytime(tls *TLS, t uintptr) (r Ttime_t)
TEXT ·Ytime(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtime(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytimegm(tls *TLS, tm uintptr) (r Ttime_t)
TEXT ·Ytimegm(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tm+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtimegm(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytimer_delete(tls *TLS, t Ttimer_t) (r int32)
TEXT ·Ytimer_delete(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtimer_delete(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytimer_getoverrun(tls *TLS, t Ttimer_t) (r int32)
TEXT ·Ytimer_getoverrun(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtimer_getoverrun(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytimer_gettime(tls *TLS, t Ttimer_t, val uintptr) (r int32)
TEXT ·Ytimer_gettime(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ val+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtimer_gettime(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytimer_settime(tls *TLS, t Ttimer_t, flags int32, val uintptr, old uintptr) (r int32)
TEXT ·Ytimer_settime(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ t+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ val+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ old+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xtimer_settime(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Ytimerfd_create(tls *TLS, clockid int32, flags int32) (r int32)
TEXT ·Ytimerfd_create(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL clockid+8(FP), AX
	MOVL AX, 8(SP)
	MOVL flags+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xtimerfd_create(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytimerfd_gettime(tls *TLS, fd int32, cur uintptr) (r int32)
TEXT ·Ytimerfd_gettime(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ cur+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtimerfd_gettime(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytimerfd_settime(tls *TLS, fd int32, flags int32, new1 uintptr, old uintptr) (r int32)
TEXT ·Ytimerfd_settime(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVL flags+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ new1+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ old+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xtimerfd_settime(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ytimes(tls *TLS, tms uintptr) (r Tclock_t)
TEXT ·Ytimes(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ tms+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtimes(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytimespec_get(tls *TLS, ts uintptr, base int32) (r int32)
TEXT ·Ytimespec_get(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ ts+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL base+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xtimespec_get(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytmpfile(tls *TLS) (r uintptr)
TEXT ·Ytmpfile(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xtmpfile(SB)
	MOVQ 8(SP), AX
	MOVQ AX, r+8(FP)
	RET

// func Ytmpnam(tls *TLS, buf uintptr) (r1 uintptr)
TEXT ·Ytmpnam(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ buf+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtmpnam(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r1+16(FP)
	RET

// func Ytoascii(tls *TLS, c int32) (r int32)
TEXT ·Ytoascii(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtoascii(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytolower(tls *TLS, c int32) (r int32)
TEXT ·Ytolower(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtolower(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytolower_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Ytolower_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtolower_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytoupper(tls *TLS, c int32) (r int32)
TEXT ·Ytoupper(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtoupper(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytoupper_l(tls *TLS, c int32, l Tlocale_t) (r int32)
TEXT ·Ytoupper_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtoupper_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytowctrans(tls *TLS, wc Twint_t, trans Twctrans_t) (r Twint_t)
TEXT ·Ytowctrans(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ trans+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtowctrans(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytowctrans_l(tls *TLS, c Twint_t, t Twctrans_t, l Tlocale_t) (r Twint_t)
TEXT ·Ytowctrans_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ t+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ l+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xtowctrans_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ytowlower(tls *TLS, wc Twint_t) (r Twint_t)
TEXT ·Ytowlower(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtowlower(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytowlower_l(tls *TLS, c Twint_t, l Tlocale_t) (r Twint_t)
TEXT ·Ytowlower_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtowlower_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytowupper(tls *TLS, wc Twint_t) (r Twint_t)
TEXT ·Ytowupper(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtowupper(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytowupper_l(tls *TLS, c Twint_t, l Tlocale_t) (r Twint_t)
TEXT ·Ytowupper_l(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtowupper_l(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytrunc(tls *TLS, x3 float64) (r float64)
TEXT ·Ytrunc(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x3+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtrunc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytruncate(tls *TLS, path uintptr, length Toff_t) (r int32)
TEXT ·Ytruncate(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ length+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xtruncate(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ytruncf(tls *TLS, x3 float32) (r float32)
TEXT ·Ytruncf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x3+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xtruncf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ytruncl(tls *TLS, x float64) (r float64)
TEXT ·Ytruncl(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xtruncl(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ytsearch(tls *TLS, key uintptr, rootp uintptr, __ccgo_fp_cmp uintptr) (r1 uintptr)
TEXT ·Ytsearch(SB),$48-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_cmp+24(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_tsearch_2(SB)	// Create the closure for calling __ccgo_fp_cmp
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ key+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ rootp+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 24(SP)
	CALL ·Xtsearch(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r1+32(FP)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_tsearch_2(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ _2+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	MOVL 24(SP), AX
	MOVL AX, _3+32(FP)
	RET

// func Yttyname(tls *TLS, fd int32) (r uintptr)
TEXT ·Yttyname(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xttyname(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yttyname_r(tls *TLS, fd int32, name uintptr, size Tsize_t) (r int32)
TEXT ·Yttyname_r(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ name+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ size+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xttyname_r(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ytwalk(tls *TLS, root uintptr, __ccgo_fp_action uintptr)
TEXT ·Ytwalk(SB),$32-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX	// alloc all ABI trampolines
	MOVQ AX, 0(SP)
	MOVQ $16, 8(SP)	// 16*(number of func ptrs in signature)
	CALL modernc·org∕libc·TLSAlloc(SB)
	MOVQ 16(SP), AX
	MOVQ AX, -8(BP) // Trampolines[0]
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ -8(BP), AX
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 8(SP)
	MOVQ __ccgo_fp_action+16(FP), AX	// ABI0 code ptr
	MOVQ AX, 16(SP)
	CALL ·__ccgo_abiInternal_twalk_1(SB)	// Create the closure for calling __ccgo_fp_action
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ root+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ -8(BP), AX // Trampolines[0]
	ADDQ $0, AX	// 16*(0-based ordinal number of the func ptr in signature)
	MOVQ AX, 16(SP)
	CALL ·Xtwalk(SB)
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ $0, 8(SP)
	CALL modernc·org∕libc·TLSFree(SB)
	RET

TEXT ·__ccgo_abi0_twalk_1(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ _0+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ _1+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL _2+16(FP), AX
	MOVL AX, 16(SP)
	MOVL _3+20(FP), AX
	MOVL AX, 20(SP)
	MOVQ __ccgo_fp+24(FP), AX
	CALL *AX	// Call the ABI0 code ptr
	RET

// func Ytzset(tls *TLS)
TEXT ·Ytzset(SB),$8-8
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xtzset(SB)
	RET

// func Yualarm(tls *TLS, value uint32, interval uint32) (r uint32)
TEXT ·Yualarm(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL value+8(FP), AX
	MOVL AX, 8(SP)
	MOVL interval+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xualarm(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yulckpwdf(tls *TLS) (r int32)
TEXT ·Yulckpwdf(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xulckpwdf(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yulimit(tls *TLS, cmd int32, va uintptr) (r int64)
TEXT ·Yulimit(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL cmd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xulimit(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yumask(tls *TLS, mode Tmode_t) (r Tmode_t)
TEXT ·Yumask(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL mode+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xumask(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yumount(tls *TLS, special uintptr) (r int32)
TEXT ·Yumount(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ special+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xumount(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yumount2(tls *TLS, special uintptr, flags int32) (r int32)
TEXT ·Yumount2(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ special+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL flags+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xumount2(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yuname(tls *TLS, uts uintptr) (r int32)
TEXT ·Yuname(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ uts+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xuname(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yungetc(tls *TLS, c int32, f uintptr) (r int32)
TEXT ·Yungetc(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xungetc(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yungetwc(tls *TLS, c Twint_t, f uintptr) (r Twint_t)
TEXT ·Yungetwc(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ f+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xungetwc(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yunlink(tls *TLS, path uintptr) (r int32)
TEXT ·Yunlink(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xunlink(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yunlinkat(tls *TLS, fd int32, path uintptr, flag int32) (r int32)
TEXT ·Yunlinkat(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL flag+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xunlinkat(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yunlockpt(tls *TLS, fd int32) (r int32)
TEXT ·Yunlockpt(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xunlockpt(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yunsetenv(tls *TLS, name uintptr) (r int32)
TEXT ·Yunsetenv(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ name+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xunsetenv(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yunshare(tls *TLS, flags int32) (r int32)
TEXT ·Yunshare(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL flags+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xunshare(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yupdwtmp(tls *TLS, f uintptr, u uintptr)
TEXT ·Yupdwtmp(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ u+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xupdwtmp(SB)
	RET

// func Yupdwtmpx(tls *TLS, f uintptr, u uintptr)
TEXT ·Yupdwtmpx(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ u+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xupdwtmpx(SB)
	RET

// func Yuselocale(tls *TLS, new1 Tlocale_t) (r Tlocale_t)
TEXT ·Yuselocale(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ new1+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xuselocale(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yusleep(tls *TLS, useconds uint32) (r int32)
TEXT ·Yusleep(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL useconds+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xusleep(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yutime(tls *TLS, path uintptr, times uintptr) (r int32)
TEXT ·Yutime(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ times+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xutime(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yutimensat(tls *TLS, fd int32, path uintptr, times uintptr, flags int32) (r1 int32)
TEXT ·Yutimensat(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ path+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ times+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xutimensat(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Yutimes(tls *TLS, path uintptr, times uintptr) (r int32)
TEXT ·Yutimes(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ path+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ times+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xutimes(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yuuid_copy(t *TLS, dst, src uintptr)
TEXT ·Yuuid_copy(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dst+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xuuid_copy(SB)
	RET

// func Yuuid_generate_random(t *TLS, out uintptr)
TEXT ·Yuuid_generate_random(SB),$16-16
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ out+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xuuid_generate_random(SB)
	RET

// func Yuuid_parse(t *TLS, in uintptr, uu uintptr) (_3 int32)
TEXT ·Yuuid_parse(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ in+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ uu+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xuuid_parse(SB)
	MOVL 24(SP), AX
	MOVL AX, _3+24(FP)
	RET

// func Yuuid_unparse(t *TLS, uu, out uintptr)
TEXT ·Yuuid_unparse(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ t+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ uu+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ out+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xuuid_unparse(SB)
	RET

// func Yvasprintf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvasprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvasprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yvdprintf(tls *TLS, fd int32, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvdprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvdprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yverr(tls *TLS, status int32, fmt uintptr, ap Tva_list)
TEXT ·Yverr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL status+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xverr(SB)
	RET

// func Yverrx(tls *TLS, status int32, fmt uintptr, ap Tva_list)
TEXT ·Yverrx(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL status+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xverrx(SB)
	RET

// func Yversionsort(tls *TLS, a uintptr, b uintptr) (r int32)
TEXT ·Yversionsort(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ a+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xversionsort(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yvfork(tls *TLS) (r Tpid_t)
TEXT ·Yvfork(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xvfork(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yvfprintf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvfprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvfprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yvfscanf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvfscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvfscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yvfwprintf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvfwprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvfwprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yvfwscanf(tls *TLS, f uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvfwscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ f+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvfwscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yvhangup(tls *TLS) (r int32)
TEXT ·Yvhangup(SB),$16-12
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	CALL ·Xvhangup(SB)
	MOVL 8(SP), AX
	MOVL AX, r+8(FP)
	RET

// func Yvmsplice(tls *TLS, fd int32, iov uintptr, cnt Tsize_t, flags uint32) (r Tssize_t)
TEXT ·Yvmsplice(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ iov+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ cnt+24(FP), AX
	MOVQ AX, 24(SP)
	MOVL flags+32(FP), AX
	MOVL AX, 32(SP)
	CALL ·Xvmsplice(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Yvprintf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvprintf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xvprintf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yvscanf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvscanf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xvscanf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yvsnprintf(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvsnprintf(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ fmt+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ ap+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xvsnprintf(SB)
	MOVL 40(SP), AX
	MOVL AX, r+40(FP)
	RET

// func Yvsprintf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvsprintf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvsprintf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yvsscanf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvsscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvsscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yvswprintf(tls *TLS, s uintptr, n Tsize_t, fmt uintptr, ap Tva_list) (r1 int32)
TEXT ·Yvswprintf(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ fmt+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ ap+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xvswprintf(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Yvswscanf(tls *TLS, s uintptr, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvswscanf(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ fmt+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ ap+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xvswscanf(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Yvwarn(tls *TLS, fmt uintptr, ap Tva_list)
TEXT ·Yvwarn(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xvwarn(SB)
	RET

// func Yvwarnx(tls *TLS, fmt uintptr, ap Tva_list)
TEXT ·Yvwarnx(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xvwarnx(SB)
	RET

// func Yvwprintf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvwprintf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xvwprintf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yvwscanf(tls *TLS, fmt uintptr, ap Tva_list) (r int32)
TEXT ·Yvwscanf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ap+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xvwscanf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ywait(tls *TLS, status uintptr) (r Tpid_t)
TEXT ·Ywait(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ status+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xwait(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ywait3(tls *TLS, status uintptr, options int32, usage uintptr) (r Tpid_t)
TEXT ·Ywait3(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ status+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL options+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ usage+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwait3(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ywait4(tls *TLS, pid Tpid_t, status uintptr, options int32, ru uintptr) (r1 Tpid_t)
TEXT ·Ywait4(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ status+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL options+24(FP), AX
	MOVL AX, 24(SP)
	MOVQ ru+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xwait4(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Ywaitid(tls *TLS, type1 Tidtype_t, id Tid_t, info uintptr, options int32) (r int32)
TEXT ·Ywaitid(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL type1+8(FP), AX
	MOVL AX, 8(SP)
	MOVL id+12(FP), AX
	MOVL AX, 12(SP)
	MOVQ info+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL options+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwaitid(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ywaitpid(tls *TLS, pid Tpid_t, status uintptr, options int32) (r Tpid_t)
TEXT ·Ywaitpid(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL pid+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ status+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL options+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwaitpid(SB)
	MOVL 32(SP), AX
	MOVL AX, r+32(FP)
	RET

// func Ywarn(tls *TLS, fmt uintptr, va uintptr)
TEXT ·Ywarn(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwarn(SB)
	RET

// func Ywarnx(tls *TLS, fmt uintptr, va uintptr)
TEXT ·Ywarnx(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwarnx(SB)
	RET

// func Ywcpcpy(tls *TLS, d uintptr, s uintptr) (r uintptr)
TEXT ·Ywcpcpy(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcpcpy(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcpncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ywcpncpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcpncpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcrtomb(tls *TLS, s uintptr, wc Twchar_t, st uintptr) (r Tsize_t)
TEXT ·Ywcrtomb(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL wc+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ st+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcrtomb(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcscasecmp(tls *TLS, l uintptr, r uintptr) (r1 int32)
TEXT ·Ywcscasecmp(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcscasecmp(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ywcscasecmp_l(tls *TLS, l uintptr, r uintptr, locale Tlocale_t) (r1 int32)
TEXT ·Ywcscasecmp_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ locale+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcscasecmp_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ywcscat(tls *TLS, dest uintptr, src uintptr) (r uintptr)
TEXT ·Ywcscat(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcscat(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcschr(tls *TLS, s uintptr, c Twchar_t) (r uintptr)
TEXT ·Ywcschr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xwcschr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcscmp(tls *TLS, l uintptr, r uintptr) (r1 int32)
TEXT ·Ywcscmp(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcscmp(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ywcscoll(tls *TLS, l uintptr, r uintptr) (r1 int32)
TEXT ·Ywcscoll(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcscoll(SB)
	MOVL 24(SP), AX
	MOVL AX, r1+24(FP)
	RET

// func Ywcscoll_l(tls *TLS, l uintptr, r uintptr, locale Tlocale_t) (r1 int32)
TEXT ·Ywcscoll_l(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ locale+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcscoll_l(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ywcscpy(tls *TLS, d uintptr, s uintptr) (r uintptr)
TEXT ·Ywcscpy(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcscpy(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcscspn(tls *TLS, s uintptr, c uintptr) (r Tsize_t)
TEXT ·Ywcscspn(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ c+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcscspn(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcsdup(tls *TLS, s uintptr) (r uintptr)
TEXT ·Ywcsdup(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xwcsdup(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ywcsftime(tls *TLS, wcs uintptr, n Tsize_t, f uintptr, tm uintptr) (r Tsize_t)
TEXT ·Ywcsftime(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ wcs+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ tm+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xwcsftime(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ywcsftime_l(tls *TLS, s uintptr, n Tsize_t, f uintptr, tm uintptr, loc Tlocale_t) (r Tsize_t)
TEXT ·Ywcsftime_l(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ f+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ tm+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ loc+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xwcsftime_l(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ywcslen(tls *TLS, s uintptr) (r Tsize_t)
TEXT ·Ywcslen(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xwcslen(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ywcsncasecmp(tls *TLS, l uintptr, r uintptr, n Tsize_t) (r1 int32)
TEXT ·Ywcsncasecmp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcsncasecmp(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ywcsncasecmp_l(tls *TLS, l uintptr, r uintptr, n Tsize_t, locale Tlocale_t) (r1 int32)
TEXT ·Ywcsncasecmp_l(SB),$48-44
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ locale+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xwcsncasecmp_l(SB)
	MOVL 40(SP), AX
	MOVL AX, r1+40(FP)
	RET

// func Ywcsncat(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ywcsncat(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcsncat(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcsncmp(tls *TLS, l uintptr, r uintptr, n Tsize_t) (r1 int32)
TEXT ·Ywcsncmp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcsncmp(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ywcsncpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ywcsncpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcsncpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcsnlen(tls *TLS, s uintptr, n Tsize_t) (r Tsize_t)
TEXT ·Ywcsnlen(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcsnlen(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcsnrtombs(tls *TLS, dst uintptr, wcs uintptr, wn Tsize_t, n Tsize_t, st uintptr) (r Tsize_t)
TEXT ·Ywcsnrtombs(SB),$56-56
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dst+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ wcs+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ wn+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ n+32(FP), AX
	MOVQ AX, 32(SP)
	MOVQ st+40(FP), AX
	MOVQ AX, 40(SP)
	CALL ·Xwcsnrtombs(SB)
	MOVQ 48(SP), AX
	MOVQ AX, r+48(FP)
	RET

// func Ywcspbrk(tls *TLS, s uintptr, b uintptr) (r uintptr)
TEXT ·Ywcspbrk(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ b+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcspbrk(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcsrchr(tls *TLS, s uintptr, c Twchar_t) (r uintptr)
TEXT ·Ywcsrchr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xwcsrchr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcsrtombs(tls *TLS, s uintptr, ws uintptr, n Tsize_t, st uintptr) (r Tsize_t)
TEXT ·Ywcsrtombs(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ws+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ st+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xwcsrtombs(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ywcsspn(tls *TLS, s uintptr, c uintptr) (r Tsize_t)
TEXT ·Ywcsspn(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ c+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcsspn(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcsstr(tls *TLS, h uintptr, n uintptr) (r uintptr)
TEXT ·Ywcsstr(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ h+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcsstr(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcstod(tls *TLS, s uintptr, p uintptr) (r float64)
TEXT ·Ywcstod(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcstod(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcstof(tls *TLS, s uintptr, p uintptr) (r float32)
TEXT ·Ywcstof(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcstof(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ywcstoimax(tls *TLS, s uintptr, p uintptr, base int32) (r Tintmax_t)
TEXT ·Ywcstoimax(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwcstoimax(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcstok(tls *TLS, s uintptr, sep uintptr, p uintptr) (r uintptr)
TEXT ·Ywcstok(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ sep+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ p+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcstok(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcstol(tls *TLS, s uintptr, p uintptr, base int32) (r int64)
TEXT ·Ywcstol(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwcstol(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcstold(tls *TLS, s uintptr, p uintptr) (r float64)
TEXT ·Ywcstold(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcstold(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcstoll(tls *TLS, s uintptr, p uintptr, base int32) (r int64)
TEXT ·Ywcstoll(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwcstoll(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcstombs(tls *TLS, s uintptr, ws uintptr, n Tsize_t) (r Tsize_t)
TEXT ·Ywcstombs(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ ws+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcstombs(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcstoul(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)
TEXT ·Ywcstoul(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwcstoul(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcstoull(tls *TLS, s uintptr, p uintptr, base int32) (r uint64)
TEXT ·Ywcstoull(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwcstoull(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcstoumax(tls *TLS, s uintptr, p uintptr, base int32) (r Tuintmax_t)
TEXT ·Ywcstoumax(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ p+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL base+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwcstoumax(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcswcs(tls *TLS, haystack uintptr, needle uintptr) (r uintptr)
TEXT ·Ywcswcs(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ haystack+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ needle+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcswcs(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcswidth(tls *TLS, wcs uintptr, n Tsize_t) (r int32)
TEXT ·Ywcswidth(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ wcs+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ n+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwcswidth(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ywcsxfrm(tls *TLS, dest uintptr, src uintptr, n Tsize_t) (r Tsize_t)
TEXT ·Ywcsxfrm(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwcsxfrm(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywcsxfrm_l(tls *TLS, dest uintptr, src uintptr, n Tsize_t, loc Tlocale_t) (r Tsize_t)
TEXT ·Ywcsxfrm_l(SB),$48-48
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ dest+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ src+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	MOVQ loc+32(FP), AX
	MOVQ AX, 32(SP)
	CALL ·Xwcsxfrm_l(SB)
	MOVQ 40(SP), AX
	MOVQ AX, r+40(FP)
	RET

// func Ywctob(tls *TLS, c Twint_t) (r int32)
TEXT ·Ywctob(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL c+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xwctob(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ywctomb(tls *TLS, s uintptr, wc Twchar_t) (r int32)
TEXT ·Ywctomb(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL wc+16(FP), AX
	MOVL AX, 16(SP)
	CALL ·Xwctomb(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ywctrans(tls *TLS, class uintptr) (r Twctrans_t)
TEXT ·Ywctrans(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ class+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xwctrans(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ywctrans_l(tls *TLS, s uintptr, l Tlocale_t) (r Twctrans_t)
TEXT ·Ywctrans_l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwctrans_l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywctype(tls *TLS, s uintptr) (r Twctype_t)
TEXT ·Ywctype(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xwctype(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Ywctype_l(tls *TLS, s uintptr, l Tlocale_t) (r Twctype_t)
TEXT ·Ywctype_l(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ l+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwctype_l(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Ywcwidth(tls *TLS, wc Twchar_t) (r int32)
TEXT ·Ywcwidth(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL wc+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xwcwidth(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Ywmemchr(tls *TLS, s uintptr, c Twchar_t, n Tsize_t) (r uintptr)
TEXT ·Ywmemchr(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ s+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwmemchr(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywmemcmp(tls *TLS, l uintptr, r uintptr, n Tsize_t) (r1 int32)
TEXT ·Ywmemcmp(SB),$40-36
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ l+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ r+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwmemcmp(SB)
	MOVL 32(SP), AX
	MOVL AX, r1+32(FP)
	RET

// func Ywmemcpy(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ywmemcpy(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwmemcpy(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywmemmove(tls *TLS, d uintptr, s uintptr, n Tsize_t) (r uintptr)
TEXT ·Ywmemmove(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ s+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwmemmove(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywmemset(tls *TLS, d uintptr, c Twchar_t, n Tsize_t) (r uintptr)
TEXT ·Ywmemset(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ d+8(FP), AX
	MOVQ AX, 8(SP)
	MOVL c+16(FP), AX
	MOVL AX, 16(SP)
	MOVQ n+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwmemset(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywprintf(tls *TLS, fmt uintptr, va uintptr) (r int32)
TEXT ·Ywprintf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwprintf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Ywrite(tls *TLS, fd int32, buf uintptr, count Tsize_t) (r Tssize_t)
TEXT ·Ywrite(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ buf+16(FP), AX
	MOVQ AX, 16(SP)
	MOVQ count+24(FP), AX
	MOVQ AX, 24(SP)
	CALL ·Xwrite(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywritev(tls *TLS, fd int32, iov uintptr, count int32) (r Tssize_t)
TEXT ·Ywritev(SB),$40-40
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL fd+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ iov+16(FP), AX
	MOVQ AX, 16(SP)
	MOVL count+24(FP), AX
	MOVL AX, 24(SP)
	CALL ·Xwritev(SB)
	MOVQ 32(SP), AX
	MOVQ AX, r+32(FP)
	RET

// func Ywscanf(tls *TLS, fmt uintptr, va uintptr) (r int32)
TEXT ·Ywscanf(SB),$32-28
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ fmt+8(FP), AX
	MOVQ AX, 8(SP)
	MOVQ va+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xwscanf(SB)
	MOVL 24(SP), AX
	MOVL AX, r+24(FP)
	RET

// func Yy0(tls *TLS, x float64) (r float64)
TEXT ·Yy0(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xy0(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yy0f(tls *TLS, x float32) (r float32)
TEXT ·Yy0f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xy0f(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yy1(tls *TLS, x float64) (r float64)
TEXT ·Yy1(SB),$24-24
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVQ x+8(FP), AX
	MOVQ AX, 8(SP)
	CALL ·Xy1(SB)
	MOVQ 16(SP), AX
	MOVQ AX, r+16(FP)
	RET

// func Yy1f(tls *TLS, x float32) (r float32)
TEXT ·Yy1f(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL x+8(FP), AX
	MOVL AX, 8(SP)
	CALL ·Xy1f(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET

// func Yyn(tls *TLS, n int32, x float64) (r float64)
TEXT ·Yyn(SB),$32-32
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	MOVQ x+16(FP), AX
	MOVQ AX, 16(SP)
	CALL ·Xyn(SB)
	MOVQ 24(SP), AX
	MOVQ AX, r+24(FP)
	RET

// func Yynf(tls *TLS, n int32, x float32) (r float32)
TEXT ·Yynf(SB),$24-20
	GO_ARGS
	NO_LOCAL_POINTERS
	MOVQ tls+0(FP), AX
	MOVQ AX, 0(SP)
	MOVL n+8(FP), AX
	MOVL AX, 8(SP)
	MOVL x+12(FP), AX
	MOVL AX, 12(SP)
	CALL ·Xynf(SB)
	MOVL 16(SP), AX
	MOVL AX, r+16(FP)
	RET
