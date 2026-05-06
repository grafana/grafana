#include "textflag.h"

// void *memcpy(void *dst, const void *src, size_t n)
// DI = dst, SI = src, DX = size
TEXT clib·_memcpy(SB), $16-0
	PUSHQ R8
	PUSHQ CX
	XORQ  CX, CX // clear register

MEMCPY_QUAD_LOOP:
	ADDQ $8, CX
	CMPQ CX, DX
	JA   MEMCPY_QUAD_DONE
	MOVQ -8(SI)(CX*1), R8
	MOVQ R8, -8(DI)(CX*1)
	JMP  MEMCPY_QUAD_LOOP

MEMCPY_QUAD_DONE:
	SUBQ $4, CX
	CMPQ CX, DX
	JA   MEMCPY_LONG_DONE
	MOVL -4(SI)(CX*1), R8
	MOVL R8, -4(DI)(CX*1)
	ADDQ $4, CX

MEMCPY_LONG_DONE:
	SUBQ $2, CX
	CMPQ CX, DX
	JA   MEMCPY_WORD_DONE
	MOVW -2(SI)(CX*1), R8
	MOVW R8, -2(DI)(CX*1)
	ADDQ $2, CX

MEMCPY_WORD_DONE:
	SUBQ $1, CX
	CMPQ CX, DX
	JA   MEMCPY_BYTE_DONE
	MOVB -1(SI)(CX*1), R8
	MOVB R8, -1(DI)(CX*1)

MEMCPY_BYTE_DONE:
	MOVQ DI, AX // set return value
	POPQ CX
	POPQ R8
	RET

// func _ClibMemcpy(dst, src unsafe.Pointer, n uint) unsafe.Pointer
TEXT ·_ClibMemcpy(SB), NOSPLIT|NOFRAME, $16-24
	MOVQ arg1+0(FP), DI
	MOVQ arg2+8(FP), SI
	MOVQ arg3+16(FP), DX
	CALL clib·_memcpy(SB)
	MOVQ AX, ret+24(FP)
	RET

// void *memset(void *str, int c, size_t n)
// DI = str, SI = c, DX = size
TEXT clib·_memset(SB), $16-0
	PUSHQ CX
    LONG $0x0101f669; WORD $0x0101 // imul esi, 0x1010101
    MOVQ SI, CX
    ROLQ $32, CX
    ORQ CX, SI
	XORQ CX, CX // clear register

MEMSET_QUAD_LOOP:
	ADDQ $8, CX
	CMPQ CX, DX
	JA   MEMSET_QUAD_DONE
	MOVQ SI, -8(DI)(CX*1)
	JMP  MEMSET_QUAD_LOOP

MEMSET_QUAD_DONE:
	SUBQ $4, CX
	CMPQ CX, DX
	JA   MEMSET_LONG_DONE
	MOVL SI, -4(DI)(CX*1)
	ADDQ $4, CX

MEMSET_LONG_DONE:
	SUBQ $2, CX
	CMPQ CX, DX
	JA   MEMSET_WORD_DONE
	MOVW SI, -2(DI)(CX*1)
	ADDQ $2, CX

MEMSET_WORD_DONE:
	SUBQ $1, CX
	CMPQ CX, DX
	JA   MEMSET_BYTE_DONE
	MOVB SI, -1(DI)(CX*1)

MEMSET_BYTE_DONE:
	MOVQ DI, AX // set return value
	POPQ CX
	RET

// func _ClibMemset(dst unsafe.Pointer, c int, n uint) unsafe.Pointer
TEXT ·_ClibMemset(SB), NOSPLIT|NOFRAME, $16-24
	MOVQ arg1+0(FP), DI
	MOVQ arg2+8(FP), SI
	MOVQ arg3+16(FP), DX
	CALL clib·_memset(SB)
	MOVQ AX, ret+24(FP)
	RET
