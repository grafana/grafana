// +build !noasm

#include "go_asm.h"
#include "textflag.h"

// Register allocation.
#define p	R0
#define n	R1
#define h	R2
#define v1	R2	// Alias for h.
#define v2	R3
#define v3	R4
#define v4	R5
#define x1	R6
#define x2	R7
#define x3	R8
#define x4	R9

// We need the primes in registers. The 16-byte loop only uses prime{1,2}.
#define prime1r	R11
#define prime2r	R12
#define prime3r	R3	// The rest can alias v{2-4}.
#define prime4r	R4
#define prime5r	R5

// Update round macros. These read from and increment p.

#define round16aligned			\
	MOVM.IA.W (p), [x1, x2, x3, x4]	\
					\
	MULA x1, prime2r, v1, v1	\
	MULA x2, prime2r, v2, v2	\
	MULA x3, prime2r, v3, v3	\
	MULA x4, prime2r, v4, v4	\
					\
	MOVW v1 @> 19, v1		\
	MOVW v2 @> 19, v2		\
	MOVW v3 @> 19, v3		\
	MOVW v4 @> 19, v4		\
					\
	MUL prime1r, v1			\
	MUL prime1r, v2			\
	MUL prime1r, v3			\
	MUL prime1r, v4			\

#define round16unaligned 		\
	MOVBU.P  16(p), x1		\
	MOVBU   -15(p), x2		\
	ORR     x2 <<  8, x1		\
	MOVBU   -14(p), x3		\
	MOVBU   -13(p), x4		\
	ORR     x4 <<  8, x3		\
	ORR     x3 << 16, x1		\
					\
	MULA x1, prime2r, v1, v1	\
	MOVW v1 @> 19, v1		\
	MUL prime1r, v1			\
					\
	MOVBU -12(p), x1		\
	MOVBU -11(p), x2		\
	ORR   x2 <<  8, x1		\
	MOVBU -10(p), x3		\
	MOVBU  -9(p), x4		\
	ORR   x4 <<  8, x3		\
	ORR   x3 << 16, x1		\
					\
	MULA x1, prime2r, v2, v2	\
	MOVW v2 @> 19, v2		\
	MUL prime1r, v2			\
					\
	MOVBU -8(p), x1			\
	MOVBU -7(p), x2			\
	ORR   x2 <<  8, x1		\
	MOVBU -6(p), x3			\
	MOVBU -5(p), x4			\
	ORR   x4 <<  8, x3		\
	ORR   x3 << 16, x1		\
					\
	MULA x1, prime2r, v3, v3	\
	MOVW v3 @> 19, v3		\
	MUL prime1r, v3			\
					\
	MOVBU -4(p), x1			\
	MOVBU -3(p), x2			\
	ORR   x2 <<  8, x1		\
	MOVBU -2(p), x3			\
	MOVBU -1(p), x4			\
	ORR   x4 <<  8, x3		\
	ORR   x3 << 16, x1		\
					\
	MULA x1, prime2r, v4, v4	\
	MOVW v4 @> 19, v4		\
	MUL prime1r, v4			\


// func ChecksumZero([]byte) uint32
TEXT ·ChecksumZero(SB), NOFRAME|NOSPLIT, $-4-16
	MOVW input_base+0(FP), p
	MOVW input_len+4(FP),  n

	MOVW $const_prime1, prime1r
	MOVW $const_prime2, prime2r

	// Set up h for n < 16. It's tempting to say {ADD prime5, n, h}
	// here, but that's a pseudo-op that generates a load through R11.
	MOVW $const_prime5, prime5r
	ADD  prime5r, n, h
	CMP  $0, n
	BEQ  end

	// We let n go negative so we can do comparisons with SUB.S
	// instead of separate CMP.
	SUB.S $16, n
	BMI   loop16done

	ADD  prime1r, prime2r, v1
	MOVW prime2r, v2
	MOVW $0, v3
	RSB  $0, prime1r, v4

	TST $3, p
	BNE loop16unaligned

loop16aligned:
	SUB.S $16, n
	round16aligned
	BPL loop16aligned
	B   loop16finish

loop16unaligned:
	SUB.S $16, n
	round16unaligned
	BPL loop16unaligned

loop16finish:
	MOVW v1 @> 31, h
	ADD  v2 @> 25, h
	ADD  v3 @> 20, h
	ADD  v4 @> 14, h

	// h += len(input) with v2 as temporary.
	MOVW input_len+4(FP), v2
	ADD  v2, h

loop16done:
	ADD $16, n	// Restore number of bytes left.

	SUB.S $4, n
	MOVW  $const_prime3, prime3r
	BMI   loop4done
	MOVW  $const_prime4, prime4r

	TST $3, p
	BNE loop4unaligned

loop4aligned:
	SUB.S $4, n

	MOVW.P 4(p), x1
	MULA   prime3r, x1, h, h
	MOVW   h @> 15, h
	MUL    prime4r, h

	BPL loop4aligned
	B   loop4done

loop4unaligned:
	SUB.S $4, n

	MOVBU.P  4(p), x1
	MOVBU   -3(p), x2
	ORR     x2 <<  8, x1
	MOVBU   -2(p), x3
	ORR     x3 << 16, x1
	MOVBU   -1(p), x4
	ORR     x4 << 24, x1

	MULA prime3r, x1, h, h
	MOVW h @> 15, h
	MUL  prime4r, h

	BPL loop4unaligned

loop4done:
	ADD.S $4, n	// Restore number of bytes left.
	BEQ   end

	MOVW $const_prime5, prime5r

loop1:
	SUB.S $1, n

	MOVBU.P 1(p), x1
	MULA    prime5r, x1, h, h
	MOVW    h @> 21, h
	MUL     prime1r, h

	BNE loop1

end:
	MOVW $const_prime3, prime3r
	EOR  h >> 15, h
	MUL  prime2r, h
	EOR  h >> 13, h
	MUL  prime3r, h
	EOR  h >> 16, h

	MOVW h, ret+12(FP)
	RET


// func update(v *[4]uint64, buf *[16]byte, p []byte)
TEXT ·update(SB), NOFRAME|NOSPLIT, $-4-20
	MOVW    v+0(FP), p
	MOVM.IA (p), [v1, v2, v3, v4]

	MOVW $const_prime1, prime1r
	MOVW $const_prime2, prime2r

	// Process buf, if not nil.
	MOVW buf+4(FP), p
	CMP  $0, p
	BEQ  noBuffered

	round16aligned

noBuffered:
	MOVW input_base +8(FP), p
	MOVW input_len +12(FP), n

	SUB.S $16, n
	BMI   end

	TST $3, p
	BNE loop16unaligned

loop16aligned:
	SUB.S $16, n
	round16aligned
	BPL loop16aligned
	B   end

loop16unaligned:
	SUB.S $16, n
	round16unaligned
	BPL loop16unaligned

end:
	MOVW    v+0(FP), p
	MOVM.IA [v1, v2, v3, v4], (p)
	RET
