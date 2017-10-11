//+build !noasm !appengine

// Copyright 2015, Klaus Post, see LICENSE for details.

// func crc32sse(a []byte) hash
TEXT ·crc32sse(SB), 7, $0
	MOVQ a+0(FP), R10
	XORQ BX, BX

	// CRC32   dword (R10), EBX
	BYTE $0xF2; BYTE $0x41; BYTE $0x0f
	BYTE $0x38; BYTE $0xf1; BYTE $0x1a

	MOVL BX, ret+24(FP)
	RET

// func crc32sseAll(a []byte, dst []hash)
TEXT ·crc32sseAll(SB), 7, $0
	MOVQ  a+0(FP), R8      // R8: src
	MOVQ  a_len+8(FP), R10 // input length
	MOVQ  dst+24(FP), R9   // R9: dst
	SUBQ  $4, R10
	JS    end
	JZ    one_crc
	MOVQ  R10, R13
	SHRQ  $2, R10          // len/4
	ANDQ  $3, R13          // len&3
	XORQ  BX, BX
	ADDQ  $1, R13
	TESTQ R10, R10
	JZ    rem_loop

crc_loop:
	MOVQ (R8), R11
	XORQ BX, BX
	XORQ DX, DX
	XORQ DI, DI
	MOVQ R11, R12
	SHRQ $8, R11
	MOVQ R12, AX
	MOVQ R11, CX
	SHRQ $16, R12
	SHRQ $16, R11
	MOVQ R12, SI

	// CRC32   EAX, EBX
	BYTE $0xF2; BYTE $0x0f
	BYTE $0x38; BYTE $0xf1; BYTE $0xd8

	// CRC32   ECX, EDX
	BYTE $0xF2; BYTE $0x0f
	BYTE $0x38; BYTE $0xf1; BYTE $0xd1

	// CRC32   ESI, EDI
	BYTE $0xF2; BYTE $0x0f
	BYTE $0x38; BYTE $0xf1; BYTE $0xfe
	MOVL BX, (R9)
	MOVL DX, 4(R9)
	MOVL DI, 8(R9)

	XORQ BX, BX
	MOVL R11, AX

	// CRC32   EAX, EBX
	BYTE $0xF2; BYTE $0x0f
	BYTE $0x38; BYTE $0xf1; BYTE $0xd8
	MOVL BX, 12(R9)

	ADDQ $16, R9
	ADDQ $4, R8
	XORQ BX, BX
	SUBQ $1, R10
	JNZ  crc_loop

rem_loop:
	MOVL (R8), AX

	// CRC32   EAX, EBX
	BYTE $0xF2; BYTE $0x0f
	BYTE $0x38; BYTE $0xf1; BYTE $0xd8

	MOVL BX, (R9)
	ADDQ $4, R9
	ADDQ $1, R8
	XORQ BX, BX
	SUBQ $1, R13
	JNZ  rem_loop

end:
	RET

one_crc:
	MOVQ $1, R13
	XORQ BX, BX
	JMP  rem_loop

// func matchLenSSE4(a, b []byte, max int) int
TEXT ·matchLenSSE4(SB), 7, $0
	MOVQ a+0(FP), R8     // R8: &a
	MOVQ b+24(FP), R9    // R9: &b
	MOVQ max+48(FP), R10 // R10: max
	XORQ R11, R11        // match length

	MOVQ R10, R12
	SHRQ $4, R10            // max/16
	ANDQ $15, R12           // max & 15
	CMPQ R10, $0
	JEQ  matchlen_verysmall

loopback_matchlen:
	MOVOU (R8), X0 // a[x]
	MOVOU (R9), X1 // b[x]

	// PCMPESTRI $0x18, X1, X0
	BYTE $0x66; BYTE $0x0f; BYTE $0x3a
	BYTE $0x61; BYTE $0xc1; BYTE $0x18

	JC match_ended

	ADDQ $16, R8
	ADDQ $16, R9
	ADDQ $16, R11

	SUBQ $1, R10
	JNZ  loopback_matchlen

matchlen_verysmall:
	CMPQ R12, $0
	JEQ  done_matchlen

loopback_matchlen_single:
	// Naiive, but small use
	MOVB (R8), R13
	MOVB (R9), R14
	CMPB R13, R14
	JNE  done_matchlen
	ADDQ $1, R8
	ADDQ $1, R9
	ADDQ $1, R11
	SUBQ $1, R12
	JNZ  loopback_matchlen_single
	MOVQ R11, ret+56(FP)
	RET

match_ended:
	ADDQ CX, R11

done_matchlen:
	MOVQ R11, ret+56(FP)
	RET

// func histogram(b []byte, h []int32)
TEXT ·histogram(SB), 7, $0
	MOVQ b+0(FP), SI     // SI: &b
	MOVQ b_len+8(FP), R9 // R9: len(b)
	MOVQ h+24(FP), DI    // DI: Histogram
	MOVQ R9, R8
	SHRQ $3, R8
	JZ   hist1
	XORQ R11, R11

loop_hist8:
	MOVQ (SI), R10

	MOVB R10, R11
	INCL (DI)(R11*4)
	SHRQ $8, R10

	MOVB R10, R11
	INCL (DI)(R11*4)
	SHRQ $8, R10

	MOVB R10, R11
	INCL (DI)(R11*4)
	SHRQ $8, R10

	MOVB R10, R11
	INCL (DI)(R11*4)
	SHRQ $8, R10

	MOVB R10, R11
	INCL (DI)(R11*4)
	SHRQ $8, R10

	MOVB R10, R11
	INCL (DI)(R11*4)
	SHRQ $8, R10

	MOVB R10, R11
	INCL (DI)(R11*4)
	SHRQ $8, R10

	INCL (DI)(R10*4)

	ADDQ $8, SI
	DECQ R8
	JNZ  loop_hist8

hist1:
	ANDQ $7, R9
	JZ   end_hist
	XORQ R10, R10

loop_hist1:
	MOVB (SI), R10
	INCL (DI)(R10*4)
	INCQ SI
	DECQ R9
	JNZ  loop_hist1

end_hist:
	RET
