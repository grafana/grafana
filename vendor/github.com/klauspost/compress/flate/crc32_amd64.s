//+build !noasm
//+build !appengine
//+build !gccgo

// Copyright 2015, Klaus Post, see LICENSE for details.

// func crc32sse(a []byte) uint32
TEXT ·crc32sse(SB), 4, $0
	MOVQ a+0(FP), R10
	XORQ BX, BX

	// CRC32   dword (R10), EBX
	BYTE $0xF2; BYTE $0x41; BYTE $0x0f
	BYTE $0x38; BYTE $0xf1; BYTE $0x1a

	MOVL BX, ret+24(FP)
	RET

// func crc32sseAll(a []byte, dst []uint32)
TEXT ·crc32sseAll(SB), 4, $0
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
TEXT ·matchLenSSE4(SB), 4, $0
	MOVQ a_base+0(FP), SI
	MOVQ b_base+24(FP), DI
	MOVQ DI, DX
	MOVQ max+48(FP), CX

cmp8:
	// As long as we are 8 or more bytes before the end of max, we can load and
	// compare 8 bytes at a time. If those 8 bytes are equal, repeat.
	CMPQ CX, $8
	JLT  cmp1
	MOVQ (SI), AX
	MOVQ (DI), BX
	CMPQ AX, BX
	JNE  bsf
	ADDQ $8, SI
	ADDQ $8, DI
	SUBQ $8, CX
	JMP  cmp8

bsf:
	// If those 8 bytes were not equal, XOR the two 8 byte values, and return
	// the index of the first byte that differs. The BSF instruction finds the
	// least significant 1 bit, the amd64 architecture is little-endian, and
	// the shift by 3 converts a bit index to a byte index.
	XORQ AX, BX
	BSFQ BX, BX
	SHRQ $3, BX
	ADDQ BX, DI

	// Subtract off &b[0] to convert from &b[ret] to ret, and return.
	SUBQ DX, DI
	MOVQ DI, ret+56(FP)
	RET

cmp1:
	// In the slices' tail, compare 1 byte at a time.
	CMPQ CX, $0
	JEQ  matchLenEnd
	MOVB (SI), AX
	MOVB (DI), BX
	CMPB AX, BX
	JNE  matchLenEnd
	ADDQ $1, SI
	ADDQ $1, DI
	SUBQ $1, CX
	JMP  cmp1

matchLenEnd:
	// Subtract off &b[0] to convert from &b[ret] to ret, and return.
	SUBQ DX, DI
	MOVQ DI, ret+56(FP)
	RET

// func histogram(b []byte, h []int32)
TEXT ·histogram(SB), 4, $0
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
