#include "textflag.h"

// static inline void a_or_64(volatile uint64_t *p, uint64_t v)
TEXT ·a_or_64(SB),NOSPLIT,$0
	MOVL	p+0(FP), BX
	MOVL	v+4(FP), AX
	LOCK
	ORL	AX, 0(BX)
	MOVL	v+8(FP), AX
	LOCK
	ORL	AX, 4(BX)
	RET

// static inline void a_and_64(volatile uint64_t *p, uint64_t v)
TEXT ·a_and_64(SB),NOSPLIT,$0
	MOVL	p+0(FP), BX
	MOVL	v+4(FP), AX
	LOCK
	ANDL	AX, 0(BX)
	MOVL	v+8(FP), AX
	LOCK
	ANDL	AX, 4(BX)
	RET

// static inline int a_cas(volatile int *p, int t, int s)
TEXT ·a_cas(SB),NOSPLIT,$0
	MOVL	p+0(FP), BX
	MOVL	t+4(FP), AX
	MOVL	s+8(FP), CX
	LOCK
	CMPXCHGL	CX, 0(BX)
	MOVL	AX, ret+12(FP)
	RET

// static inline void a_barrier()
TEXT ·a_barrier(SB),NOSPLIT,$0
	MFENCE
	RET

// #define a_crash a_crash
// static inline void a_crash()
// {
// 	__asm__ __volatile__( "hlt" : : : "memory" );
// }
TEXT ·a_crash(SB),NOSPLIT,$0
	HLT

// static inline void *a_cas_p(volatile void *p, void *t, void *s)
TEXT ·a_cas_p(SB),NOSPLIT,$0
	MOVL	p+0(FP), BX
	MOVL	t+4(FP), AX
	MOVL	s+8(FP), CX
	LOCK
	CMPXCHGL	CX, 0(BX)
	MOVL	AX, ret+12(FP)
	RET

// static inline void a_or(volatile int *p, int v)
TEXT ·a_or(SB),NOSPLIT,$0
	MOVL	p+0(FP), BX
	MOVL	v+4(FP), AX
	LOCK
	ORL	AX, 0(BX)
	RET

// static inline int a_fetch_add(volatile int *p, int v)
TEXT ·a_fetch_add(SB),NOSPLIT,$0
	MOVL	p+0(FP), BX
	MOVL	v+4(FP), AX
	LOCK
	XADDL	AX, 0(BX)
	RET

// static inline void a_spin()
TEXT ·a_spin(SB),NOSPLIT,$0
	PAUSE
	RET
