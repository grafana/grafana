// Copyright 2020 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build !appengine
// +build gc
// +build !noasm

#include "textflag.h"

#define R_TMP0 R2
#define R_TMP1 R3
#define R_LEN R4
#define R_OFF R5
#define R_SRC R6
#define R_DST R7
#define R_DBASE R8
#define R_DLEN R9
#define R_DEND R10
#define R_SBASE R11
#define R_SLEN R12
#define R_SEND R13
#define R_TMP2 R14
#define R_TMP3 R15

// TEST_SRC will check if R_SRC is <= SRC_END
#define TEST_SRC() \
	CMP R_SEND, R_SRC \
	BGT errCorrupt

// MOVD R_SRC, R_TMP1
// SUB  R_SBASE, R_TMP1, R_TMP1
// CMP  R_SLEN, R_TMP1
// BGT  errCorrupt

// The asm code generally follows the pure Go code in decode_other.go, except
// where marked with a "!!!".

// func decode(dst, src []byte) int
//
// All local variables fit into registers. The non-zero stack size is only to
// spill registers and push args when issuing a CALL. The register allocation:
//	- R_TMP0	scratch
//	- R_TMP1	scratch
//	- R_LEN	length or x
//	- R_OFF	offset
//	- R_SRC	&src[s]
//	- R_DST	&dst[d]
//	+ R_DBASE	dst_base
//	+ R_DLEN	dst_len
//	+ R_DEND	dst_base + dst_len
//	+ R_SBASE	src_base
//	+ R_SLEN	src_len
//	+ R_SEND	src_base + src_len
//	- R_TMP2	used by doCopy
//	- R_TMP3	used by doCopy
//
// The registers R_DBASE-R_SEND (marked with a "+") are set at the start of the
// function, and after a CALL returns, and are not otherwise modified.
//
// The d variable is implicitly R_DST - R_DBASE,  and len(dst)-d is R_DEND - R_DST.
// The s variable is implicitly R_SRC - R_SBASE, and len(src)-s is R_SEND - R_SRC.
TEXT ·s2Decode(SB), NOSPLIT, $56-56
	// Initialize R_SRC, R_DST and R_DBASE-R_SEND.
	MOVD dst_base+0(FP), R_DBASE
	MOVD dst_len+8(FP), R_DLEN
	MOVD R_DBASE, R_DST
	MOVD R_DBASE, R_DEND
	ADD  R_DLEN, R_DEND, R_DEND
	MOVD src_base+24(FP), R_SBASE
	MOVD src_len+32(FP), R_SLEN
	MOVD R_SBASE, R_SRC
	MOVD R_SBASE, R_SEND
	ADD  R_SLEN, R_SEND, R_SEND
	MOVD $0, R_OFF

loop:
	// for s < len(src)
	CMP R_SEND, R_SRC
	BEQ end

	// R_LEN = uint32(src[s])
	//
	// switch src[s] & 0x03
	MOVBU (R_SRC), R_LEN
	MOVW  R_LEN, R_TMP1
	ANDW  $3, R_TMP1
	MOVW  $1, R1
	CMPW  R1, R_TMP1
	BGE   tagCopy

	// ----------------------------------------
	// The code below handles literal tags.

	// case tagLiteral:
	// x := uint32(src[s] >> 2)
	// switch
	MOVW $60, R1
	LSRW $2, R_LEN, R_LEN
	CMPW R_LEN, R1
	BLS  tagLit60Plus

	// case x < 60:
	// s++
	ADD $1, R_SRC, R_SRC

doLit:
	// This is the end of the inner "switch", when we have a literal tag.
	//
	// We assume that R_LEN == x and x fits in a uint32, where x is the variable
	// used in the pure Go decode_other.go code.

	// length = int(x) + 1
	//
	// Unlike the pure Go code, we don't need to check if length <= 0 because
	// R_LEN can hold 64 bits, so the increment cannot overflow.
	ADD $1, R_LEN, R_LEN

	// Prepare to check if copying length bytes will run past the end of dst or
	// src.
	//
	// R_TMP0 = len(dst) - d
	// R_TMP1 = len(src) - s
	MOVD R_DEND, R_TMP0
	SUB  R_DST, R_TMP0, R_TMP0
	MOVD R_SEND, R_TMP1
	SUB  R_SRC, R_TMP1, R_TMP1

	// !!! Try a faster technique for short (16 or fewer bytes) copies.
	//
	// if length > 16 || len(dst)-d < 16 || len(src)-s < 16 {
	//   goto callMemmove // Fall back on calling runtime·memmove.
	// }
	//
	// The C++ snappy code calls this TryFastAppend. It also checks len(src)-s
	// against 21 instead of 16, because it cannot assume that all of its input
	// is contiguous in memory and so it needs to leave enough source bytes to
	// read the next tag without refilling buffers, but Go's Decode assumes
	// contiguousness (the src argument is a []byte).
	CMP $16, R_LEN
	BGT callMemmove
	CMP $16, R_TMP0
	BLT callMemmove
	CMP $16, R_TMP1
	BLT callMemmove

	// !!! Implement the copy from src to dst as a 16-byte load and store.
	// (Decode's documentation says that dst and src must not overlap.)
	//
	// This always copies 16 bytes, instead of only length bytes, but that's
	// OK. If the input is a valid Snappy encoding then subsequent iterations
	// will fix up the overrun. Otherwise, Decode returns a nil []byte (and a
	// non-nil error), so the overrun will be ignored.
	//
	// Note that on arm64, it is legal and cheap to issue unaligned 8-byte or
	// 16-byte loads and stores. This technique probably wouldn't be as
	// effective on architectures that are fussier about alignment.
	LDP 0(R_SRC), (R_TMP2, R_TMP3)
	STP (R_TMP2, R_TMP3), 0(R_DST)

	// d += length
	// s += length
	ADD R_LEN, R_DST, R_DST
	ADD R_LEN, R_SRC, R_SRC
	B   loop

callMemmove:
	// if length > len(dst)-d || length > len(src)-s { etc }
	CMP R_TMP0, R_LEN
	BGT errCorrupt
	CMP R_TMP1, R_LEN
	BGT errCorrupt

	// copy(dst[d:], src[s:s+length])
	//
	// This means calling runtime·memmove(&dst[d], &src[s], length), so we push
	// R_DST, R_SRC and R_LEN as arguments. Coincidentally, we also need to spill those
	// three registers to the stack, to save local variables across the CALL.
	MOVD R_DST, 8(RSP)
	MOVD R_SRC, 16(RSP)
	MOVD R_LEN, 24(RSP)
	MOVD R_DST, 32(RSP)
	MOVD R_SRC, 40(RSP)
	MOVD R_LEN, 48(RSP)
	MOVD R_OFF, 56(RSP)
	CALL runtime·memmove(SB)

	// Restore local variables: unspill registers from the stack and
	// re-calculate R_DBASE-R_SEND.
	MOVD 32(RSP), R_DST
	MOVD 40(RSP), R_SRC
	MOVD 48(RSP), R_LEN
	MOVD 56(RSP), R_OFF
	MOVD dst_base+0(FP), R_DBASE
	MOVD dst_len+8(FP), R_DLEN
	MOVD R_DBASE, R_DEND
	ADD  R_DLEN, R_DEND, R_DEND
	MOVD src_base+24(FP), R_SBASE
	MOVD src_len+32(FP), R_SLEN
	MOVD R_SBASE, R_SEND
	ADD  R_SLEN, R_SEND, R_SEND

	// d += length
	// s += length
	ADD R_LEN, R_DST, R_DST
	ADD R_LEN, R_SRC, R_SRC
	B   loop

tagLit60Plus:
	// !!! This fragment does the
	//
	// s += x - 58; if uint(s) > uint(len(src)) { etc }
	//
	// checks. In the asm version, we code it once instead of once per switch case.
	ADD R_LEN, R_SRC, R_SRC
	SUB $58, R_SRC, R_SRC
	TEST_SRC()

	// case x == 60:
	MOVW $61, R1
	CMPW R1, R_LEN
	BEQ  tagLit61
	BGT  tagLit62Plus

	// x = uint32(src[s-1])
	MOVBU -1(R_SRC), R_LEN
	B     doLit

tagLit61:
	// case x == 61:
	// x = uint32(src[s-2]) | uint32(src[s-1])<<8
	MOVHU -2(R_SRC), R_LEN
	B     doLit

tagLit62Plus:
	CMPW $62, R_LEN
	BHI  tagLit63

	// case x == 62:
	// x = uint32(src[s-3]) | uint32(src[s-2])<<8 | uint32(src[s-1])<<16
	MOVHU -3(R_SRC), R_LEN
	MOVBU -1(R_SRC), R_TMP1
	ORR   R_TMP1<<16, R_LEN
	B     doLit

tagLit63:
	// case x == 63:
	// x = uint32(src[s-4]) | uint32(src[s-3])<<8 | uint32(src[s-2])<<16 | uint32(src[s-1])<<24
	MOVWU -4(R_SRC), R_LEN
	B     doLit

	// The code above handles literal tags.
	// ----------------------------------------
	// The code below handles copy tags.

tagCopy4:
	// case tagCopy4:
	// s += 5
	ADD $5, R_SRC, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	MOVD R_SRC, R_TMP1
	SUB  R_SBASE, R_TMP1, R_TMP1
	CMP  R_SLEN, R_TMP1
	BGT  errCorrupt

	// length = 1 + int(src[s-5])>>2
	MOVD $1, R1
	ADD  R_LEN>>2, R1, R_LEN

	// offset = int(uint32(src[s-4]) | uint32(src[s-3])<<8 | uint32(src[s-2])<<16 | uint32(src[s-1])<<24)
	MOVWU -4(R_SRC), R_OFF
	B     doCopy

tagCopy2:
	// case tagCopy2:
	// s += 3
	ADD $3, R_SRC, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	TEST_SRC()

	// length = 1 + int(src[s-3])>>2
	MOVD $1, R1
	ADD  R_LEN>>2, R1, R_LEN

	// offset = int(uint32(src[s-2]) | uint32(src[s-1])<<8)
	MOVHU -2(R_SRC), R_OFF
	B     doCopy

tagCopy:
	// We have a copy tag. We assume that:
	//	- R_TMP1 == src[s] & 0x03
	//	- R_LEN == src[s]
	CMP $2, R_TMP1
	BEQ tagCopy2
	BGT tagCopy4

	// case tagCopy1:
	// s += 2
	ADD $2, R_SRC, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	TEST_SRC()

	// offset = int(uint32(src[s-2])&0xe0<<3 | uint32(src[s-1]))
	// Calculate offset in R_TMP0 in case it is a repeat.
	MOVD  R_LEN, R_TMP0
	AND   $0xe0, R_TMP0
	MOVBU -1(R_SRC), R_TMP1
	ORR   R_TMP0<<3, R_TMP1, R_TMP0

	// length = 4 + int(src[s-2])>>2&0x7
	MOVD $7, R1
	AND  R_LEN>>2, R1, R_LEN
	ADD  $4, R_LEN, R_LEN

	// check if repeat code with offset 0.
	CMP $0, R_TMP0
	BEQ repeatCode

	// This is a regular copy, transfer our temporary value to R_OFF (offset)
	MOVD R_TMP0, R_OFF
	B    doCopy

	// This is a repeat code.
repeatCode:
	// If length < 9, reuse last offset, with the length already calculated.
	CMP $9, R_LEN
	BLT doCopyRepeat
	BEQ repeatLen1
	CMP $10, R_LEN
	BEQ repeatLen2

repeatLen3:
	// s +=3
	ADD $3, R_SRC, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	TEST_SRC()

	// length = uint32(src[s-3]) | (uint32(src[s-2])<<8) | (uint32(src[s-1])<<16) + 65540
	MOVBU -1(R_SRC), R_TMP0
	MOVHU -3(R_SRC), R_LEN
	ORR   R_TMP0<<16, R_LEN, R_LEN
	ADD   $65540, R_LEN, R_LEN
	B     doCopyRepeat

repeatLen2:
	// s +=2
	ADD $2, R_SRC, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	TEST_SRC()

	// length = uint32(src[s-2]) | (uint32(src[s-1])<<8) + 260
	MOVHU -2(R_SRC), R_LEN
	ADD   $260, R_LEN, R_LEN
	B     doCopyRepeat

repeatLen1:
	// s +=1
	ADD $1, R_SRC, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	TEST_SRC()

	// length = src[s-1] + 8
	MOVBU -1(R_SRC), R_LEN
	ADD   $8, R_LEN, R_LEN
	B     doCopyRepeat

doCopy:
	// This is the end of the outer "switch", when we have a copy tag.
	//
	// We assume that:
	//	- R_LEN == length && R_LEN > 0
	//	- R_OFF == offset

	// if d < offset { etc }
	MOVD R_DST, R_TMP1
	SUB  R_DBASE, R_TMP1, R_TMP1
	CMP  R_OFF, R_TMP1
	BLT  errCorrupt

	// Repeat values can skip the test above, since any offset > 0 will be in dst.
doCopyRepeat:

	// if offset <= 0 { etc }
	CMP $0, R_OFF
	BLE errCorrupt

	// if length > len(dst)-d { etc }
	MOVD R_DEND, R_TMP1
	SUB  R_DST, R_TMP1, R_TMP1
	CMP  R_TMP1, R_LEN
	BGT  errCorrupt

	// forwardCopy(dst[d:d+length], dst[d-offset:]); d += length
	//
	// Set:
	//	- R_TMP2 = len(dst)-d
	//	- R_TMP3 = &dst[d-offset]
	MOVD R_DEND, R_TMP2
	SUB  R_DST, R_TMP2, R_TMP2
	MOVD R_DST, R_TMP3
	SUB  R_OFF, R_TMP3, R_TMP3

	// !!! Try a faster technique for short (16 or fewer bytes) forward copies.
	//
	// First, try using two 8-byte load/stores, similar to the doLit technique
	// above. Even if dst[d:d+length] and dst[d-offset:] can overlap, this is
	// still OK if offset >= 8. Note that this has to be two 8-byte load/stores
	// and not one 16-byte load/store, and the first store has to be before the
	// second load, due to the overlap if offset is in the range [8, 16).
	//
	// if length > 16 || offset < 8 || len(dst)-d < 16 {
	//   goto slowForwardCopy
	// }
	// copy 16 bytes
	// d += length
	CMP  $16, R_LEN
	BGT  slowForwardCopy
	CMP  $8, R_OFF
	BLT  slowForwardCopy
	CMP  $16, R_TMP2
	BLT  slowForwardCopy
	MOVD 0(R_TMP3), R_TMP0
	MOVD R_TMP0, 0(R_DST)
	MOVD 8(R_TMP3), R_TMP1
	MOVD R_TMP1, 8(R_DST)
	ADD  R_LEN, R_DST, R_DST
	B    loop

slowForwardCopy:
	// !!! If the forward copy is longer than 16 bytes, or if offset < 8, we
	// can still try 8-byte load stores, provided we can overrun up to 10 extra
	// bytes. As above, the overrun will be fixed up by subsequent iterations
	// of the outermost loop.
	//
	// The C++ snappy code calls this technique IncrementalCopyFastPath. Its
	// commentary says:
	//
	// ----
	//
	// The main part of this loop is a simple copy of eight bytes at a time
	// until we've copied (at least) the requested amount of bytes.  However,
	// if d and d-offset are less than eight bytes apart (indicating a
	// repeating pattern of length < 8), we first need to expand the pattern in
	// order to get the correct results. For instance, if the buffer looks like
	// this, with the eight-byte <d-offset> and <d> patterns marked as
	// intervals:
	//
	//    abxxxxxxxxxxxx
	//    [------]           d-offset
	//      [------]         d
	//
	// a single eight-byte copy from <d-offset> to <d> will repeat the pattern
	// once, after which we can move <d> two bytes without moving <d-offset>:
	//
	//    ababxxxxxxxxxx
	//    [------]           d-offset
	//        [------]       d
	//
	// and repeat the exercise until the two no longer overlap.
	//
	// This allows us to do very well in the special case of one single byte
	// repeated many times, without taking a big hit for more general cases.
	//
	// The worst case of extra writing past the end of the match occurs when
	// offset == 1 and length == 1; the last copy will read from byte positions
	// [0..7] and write to [4..11], whereas it was only supposed to write to
	// position 1. Thus, ten excess bytes.
	//
	// ----
	//
	// That "10 byte overrun" worst case is confirmed by Go's
	// TestSlowForwardCopyOverrun, which also tests the fixUpSlowForwardCopy
	// and finishSlowForwardCopy algorithm.
	//
	// if length > len(dst)-d-10 {
	//   goto verySlowForwardCopy
	// }
	SUB $10, R_TMP2, R_TMP2
	CMP R_TMP2, R_LEN
	BGT verySlowForwardCopy

	// We want to keep the offset, so we use R_TMP2 from here.
	MOVD R_OFF, R_TMP2

makeOffsetAtLeast8:
	// !!! As above, expand the pattern so that offset >= 8 and we can use
	// 8-byte load/stores.
	//
	// for offset < 8 {
	//   copy 8 bytes from dst[d-offset:] to dst[d:]
	//   length -= offset
	//   d      += offset
	//   offset += offset
	//   // The two previous lines together means that d-offset, and therefore
	//   // R_TMP3, is unchanged.
	// }
	CMP  $8, R_TMP2
	BGE  fixUpSlowForwardCopy
	MOVD (R_TMP3), R_TMP1
	MOVD R_TMP1, (R_DST)
	SUB  R_TMP2, R_LEN, R_LEN
	ADD  R_TMP2, R_DST, R_DST
	ADD  R_TMP2, R_TMP2, R_TMP2
	B    makeOffsetAtLeast8

fixUpSlowForwardCopy:
	// !!! Add length (which might be negative now) to d (implied by R_DST being
	// &dst[d]) so that d ends up at the right place when we jump back to the
	// top of the loop. Before we do that, though, we save R_DST to R_TMP0 so that, if
	// length is positive, copying the remaining length bytes will write to the
	// right place.
	MOVD R_DST, R_TMP0
	ADD  R_LEN, R_DST, R_DST

finishSlowForwardCopy:
	// !!! Repeat 8-byte load/stores until length <= 0. Ending with a negative
	// length means that we overrun, but as above, that will be fixed up by
	// subsequent iterations of the outermost loop.
	MOVD $0, R1
	CMP  R1, R_LEN
	BLE  loop
	MOVD (R_TMP3), R_TMP1
	MOVD R_TMP1, (R_TMP0)
	ADD  $8, R_TMP3, R_TMP3
	ADD  $8, R_TMP0, R_TMP0
	SUB  $8, R_LEN, R_LEN
	B    finishSlowForwardCopy

verySlowForwardCopy:
	// verySlowForwardCopy is a simple implementation of forward copy. In C
	// parlance, this is a do/while loop instead of a while loop, since we know
	// that length > 0. In Go syntax:
	//
	// for {
	//   dst[d] = dst[d - offset]
	//   d++
	//   length--
	//   if length == 0 {
	//     break
	//   }
	// }
	MOVB (R_TMP3), R_TMP1
	MOVB R_TMP1, (R_DST)
	ADD  $1, R_TMP3, R_TMP3
	ADD  $1, R_DST, R_DST
	SUB  $1, R_LEN, R_LEN
	CBNZ R_LEN, verySlowForwardCopy
	B    loop

	// The code above handles copy tags.
	// ----------------------------------------

end:
	// This is the end of the "for s < len(src)".
	//
	// if d != len(dst) { etc }
	CMP R_DEND, R_DST
	BNE errCorrupt

	// return 0
	MOVD $0, ret+48(FP)
	RET

errCorrupt:
	// return decodeErrCodeCorrupt
	MOVD $1, R_TMP0
	MOVD R_TMP0, ret+48(FP)
	RET
