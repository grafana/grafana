//go:build !purego
// +build !purego

#include "textflag.h"

// func Lookup(keyset []byte, key []byte) int
TEXT ·Lookup(SB), NOSPLIT, $0-56
	MOVD keyset+0(FP), R0
	MOVD keyset_len+8(FP), R1
	MOVD key+24(FP), R2
	MOVD key_len+32(FP), R3
	MOVD key_cap+40(FP), R4

	// None of the keys in the set are greater than 16 bytes, so if the input
	// key is we can jump straight to not found.
	CMP $16, R3
	BHI notfound

	// We'll be moving the keyset pointer (R0) forward as we compare keys, so
	// make a copy of the starting point (R6). Also add the byte length (R1) to
	// obtain a pointer to the end of the keyset (R5).
	MOVD R0, R6
	ADD  R0, R1, R5

	// Prepare a 64-bit mask of all ones.
	MOVD $-1, R7

	// Prepare a vector of all zeroes.
	VMOV ZR, V1.B16

	// Check that it's safe to load 16 bytes of input. If cap(input)<16, jump
	// to a check that determines whether a tail load is necessary (to avoid a
	// page fault).
	CMP $16, R4
	BLO safeload

load:
	// Load the input key (V0) and pad with zero bytes (V1). To blend the two
	// vectors, we load a mask for the particular key length and then use TBL
	// to select bytes from either V0 or V1.
	VLD1 (R2), [V0.B16]
	MOVD $blend_masks<>(SB), R10
	ADD  R3<<4, R10, R10
	VLD1 (R10), [V2.B16]
	VTBL V2.B16, [V0.B16, V1.B16], V3.B16

loop:
	// Loop through each 16 byte key in the keyset.
	CMP R0, R5
	BEQ notfound

	// Load and compare the next key.
	VLD1.P 16(R0), [V4.B16]
	VCMEQ  V3.B16, V4.B16, V5.B16
	VMOV   V5.D[0], R8
	VMOV   V5.D[1], R9
	AND    R8, R9, R9

	// If the masks match, we found the key.
	CMP R9, R7
	BEQ found
	JMP loop

found:
	// If the key was found, take the position in the keyset and convert it
	// to an index. The keyset pointer (R0) will be 1 key past the match, so
	// subtract the starting pointer (R6), divide by 16 to convert from byte
	// length to an index, and then subtract one.
	SUB  R6, R0, R0
	ADD  R0>>4, ZR, R0
	SUB  $1, R0, R0
	MOVD R0, ret+48(FP)
	RET

notfound:
	// Return the number of keys in the keyset, which is the byte length (R1)
	// divided by 16.
	ADD  R1>>4, ZR, R1
	MOVD R1, ret+48(FP)
	RET

safeload:
	// Check if the input crosses a page boundary. If not, jump back.
	AND $4095, R2, R12
	CMP $4080, R12
	BLS load

	// If it does cross a page boundary, we must assume that loading 16 bytes
	// will cause a fault. Instead, we load the 16 bytes up to and including the
	// key and then shuffle the key forward in the register. We can shuffle and
	// pad with zeroes at the same time to avoid having to also blend (as load
	// does).
	MOVD $16, R12
	SUB  R3, R12, R12
	SUB  R12, R2, R2
	VLD1 (R2), [V0.B16]
	MOVD $shuffle_masks<>(SB), R10
	ADD  R12, R10, R10
	VLD1 (R10), [V2.B16]
	VTBL V2.B16, [V0.B16, V1.B16], V3.B16
	JMP  loop

DATA blend_masks<>+0(SB)/8, $0x1010101010101010
DATA blend_masks<>+8(SB)/8, $0x1010101010101010
DATA blend_masks<>+16(SB)/8, $0x1010101010101000
DATA blend_masks<>+24(SB)/8, $0x1010101010101010
DATA blend_masks<>+32(SB)/8, $0x1010101010100100
DATA blend_masks<>+40(SB)/8, $0x1010101010101010
DATA blend_masks<>+48(SB)/8, $0x1010101010020100
DATA blend_masks<>+56(SB)/8, $0x1010101010101010
DATA blend_masks<>+64(SB)/8, $0x1010101003020100
DATA blend_masks<>+72(SB)/8, $0x1010101010101010
DATA blend_masks<>+80(SB)/8, $0x1010100403020100
DATA blend_masks<>+88(SB)/8, $0x1010101010101010
DATA blend_masks<>+96(SB)/8, $0x1010050403020100
DATA blend_masks<>+104(SB)/8, $0x1010101010101010
DATA blend_masks<>+112(SB)/8, $0x1006050403020100
DATA blend_masks<>+120(SB)/8, $0x1010101010101010
DATA blend_masks<>+128(SB)/8, $0x0706050403020100
DATA blend_masks<>+136(SB)/8, $0x1010101010101010
DATA blend_masks<>+144(SB)/8, $0x0706050403020100
DATA blend_masks<>+152(SB)/8, $0x1010101010101008
DATA blend_masks<>+160(SB)/8, $0x0706050403020100
DATA blend_masks<>+168(SB)/8, $0x1010101010100908
DATA blend_masks<>+176(SB)/8, $0x0706050403020100
DATA blend_masks<>+184(SB)/8, $0x10101010100A0908
DATA blend_masks<>+192(SB)/8, $0x0706050403020100
DATA blend_masks<>+200(SB)/8, $0x101010100B0A0908
DATA blend_masks<>+208(SB)/8, $0x0706050403020100
DATA blend_masks<>+216(SB)/8, $0x1010100C0B0A0908
DATA blend_masks<>+224(SB)/8, $0x0706050403020100
DATA blend_masks<>+232(SB)/8, $0x10100D0C0B0A0908
DATA blend_masks<>+240(SB)/8, $0x0706050403020100
DATA blend_masks<>+248(SB)/8, $0x100E0D0C0B0A0908
DATA blend_masks<>+256(SB)/8, $0x0706050403020100
DATA blend_masks<>+264(SB)/8, $0x0F0E0D0C0B0A0908
GLOBL blend_masks<>(SB), RODATA|NOPTR, $272

DATA shuffle_masks<>+0(SB)/8, $0x0706050403020100
DATA shuffle_masks<>+8(SB)/8, $0x0F0E0D0C0B0A0908
DATA shuffle_masks<>+16(SB)/8, $0x1010101010101010
DATA shuffle_masks<>+24(SB)/8, $0x1010101010101010
GLOBL shuffle_masks<>(SB), RODATA|NOPTR, $32
