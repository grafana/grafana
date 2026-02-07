// Copyright 2016 The Go Authors. All rights reserved.
// Copyright (c) 2019 Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build !appengine
// +build gc
// +build !noasm

#include "textflag.h"

#define R_TMP0 AX
#define R_TMP1 BX
#define R_LEN CX
#define R_OFF DX
#define R_SRC SI
#define R_DST DI
#define R_DBASE R8
#define R_DLEN R9
#define R_DEND R10
#define R_SBASE R11
#define R_SLEN R12
#define R_SEND R13
#define R_TMP2 R14
#define R_TMP3 R15

// The asm code generally follows the pure Go code in decode_other.go, except
// where marked with a "!!!".

// func decode(dst, src []byte) int
//
// All local variables fit into registers. The non-zero stack size is only to
// spill registers and push args when issuing a CALL. The register allocation:
//	- R_TMP0	scratch
//	- R_TMP1	scratch
//	- R_LEN	    length or x (shared)
//	- R_OFF	    offset
//	- R_SRC	    &src[s]
//	- R_DST	    &dst[d]
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
TEXT ·s2Decode(SB), NOSPLIT, $48-56
	// Initialize R_SRC, R_DST and R_DBASE-R_SEND.
	MOVQ dst_base+0(FP), R_DBASE
	MOVQ dst_len+8(FP), R_DLEN
	MOVQ R_DBASE, R_DST
	MOVQ R_DBASE, R_DEND
	ADDQ R_DLEN, R_DEND
	MOVQ src_base+24(FP), R_SBASE
	MOVQ src_len+32(FP), R_SLEN
	MOVQ R_SBASE, R_SRC
	MOVQ R_SBASE, R_SEND
	ADDQ R_SLEN, R_SEND
	XORQ R_OFF, R_OFF

loop:
	// for s < len(src)
	CMPQ R_SRC, R_SEND
	JEQ  end

	// R_LEN = uint32(src[s])
	//
	// switch src[s] & 0x03
	MOVBLZX (R_SRC), R_LEN
	MOVL    R_LEN, R_TMP1
	ANDL    $3, R_TMP1
	CMPL    R_TMP1, $1
	JAE     tagCopy

	// ----------------------------------------
	// The code below handles literal tags.

	// case tagLiteral:
	// x := uint32(src[s] >> 2)
	// switch
	SHRL $2, R_LEN
	CMPL R_LEN, $60
	JAE  tagLit60Plus

	// case x < 60:
	// s++
	INCQ R_SRC

doLit:
	// This is the end of the inner "switch", when we have a literal tag.
	//
	// We assume that R_LEN == x and x fits in a uint32, where x is the variable
	// used in the pure Go decode_other.go code.

	// length = int(x) + 1
	//
	// Unlike the pure Go code, we don't need to check if length <= 0 because
	// R_LEN can hold 64 bits, so the increment cannot overflow.
	INCQ R_LEN

	// Prepare to check if copying length bytes will run past the end of dst or
	// src.
	//
	// R_TMP0 = len(dst) - d
	// R_TMP1 = len(src) - s
	MOVQ R_DEND, R_TMP0
	SUBQ R_DST, R_TMP0
	MOVQ R_SEND, R_TMP1
	SUBQ R_SRC, R_TMP1

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
	CMPQ R_LEN, $16
	JGT  callMemmove
	CMPQ R_TMP0, $16
	JLT  callMemmove
	CMPQ R_TMP1, $16
	JLT  callMemmove

	// !!! Implement the copy from src to dst as a 16-byte load and store.
	// (Decode's documentation says that dst and src must not overlap.)
	//
	// This always copies 16 bytes, instead of only length bytes, but that's
	// OK. If the input is a valid Snappy encoding then subsequent iterations
	// will fix up the overrun. Otherwise, Decode returns a nil []byte (and a
	// non-nil error), so the overrun will be ignored.
	//
	// Note that on amd64, it is legal and cheap to issue unaligned 8-byte or
	// 16-byte loads and stores. This technique probably wouldn't be as
	// effective on architectures that are fussier about alignment.
	MOVOU 0(R_SRC), X0
	MOVOU X0, 0(R_DST)

	// d += length
	// s += length
	ADDQ R_LEN, R_DST
	ADDQ R_LEN, R_SRC
	JMP  loop

callMemmove:
	// if length > len(dst)-d || length > len(src)-s { etc }
	CMPQ R_LEN, R_TMP0
	JGT  errCorrupt
	CMPQ R_LEN, R_TMP1
	JGT  errCorrupt

	// copy(dst[d:], src[s:s+length])
	//
	// This means calling runtime·memmove(&dst[d], &src[s], length), so we push
	// R_DST, R_SRC and R_LEN as arguments. Coincidentally, we also need to spill those
	// three registers to the stack, to save local variables across the CALL.
	MOVQ R_DST, 0(SP)
	MOVQ R_SRC, 8(SP)
	MOVQ R_LEN, 16(SP)
	MOVQ R_DST, 24(SP)
	MOVQ R_SRC, 32(SP)
	MOVQ R_LEN, 40(SP)
	MOVQ R_OFF, 48(SP)
	CALL runtime·memmove(SB)

	// Restore local variables: unspill registers from the stack and
	// re-calculate R_DBASE-R_SEND.
	MOVQ 24(SP), R_DST
	MOVQ 32(SP), R_SRC
	MOVQ 40(SP), R_LEN
	MOVQ 48(SP), R_OFF
	MOVQ dst_base+0(FP), R_DBASE
	MOVQ dst_len+8(FP), R_DLEN
	MOVQ R_DBASE, R_DEND
	ADDQ R_DLEN, R_DEND
	MOVQ src_base+24(FP), R_SBASE
	MOVQ src_len+32(FP), R_SLEN
	MOVQ R_SBASE, R_SEND
	ADDQ R_SLEN, R_SEND

	// d += length
	// s += length
	ADDQ R_LEN, R_DST
	ADDQ R_LEN, R_SRC
	JMP  loop

tagLit60Plus:
	// !!! This fragment does the
	//
	// s += x - 58; if uint(s) > uint(len(src)) { etc }
	//
	// checks. In the asm version, we code it once instead of once per switch case.
	ADDQ R_LEN, R_SRC
	SUBQ $58, R_SRC
	CMPQ R_SRC, R_SEND
	JA   errCorrupt

	// case x == 60:
	CMPL R_LEN, $61
	JEQ  tagLit61
	JA   tagLit62Plus

	// x = uint32(src[s-1])
	MOVBLZX -1(R_SRC), R_LEN
	JMP     doLit

tagLit61:
	// case x == 61:
	// x = uint32(src[s-2]) | uint32(src[s-1])<<8
	MOVWLZX -2(R_SRC), R_LEN
	JMP     doLit

tagLit62Plus:
	CMPL R_LEN, $62
	JA   tagLit63

	// case x == 62:
	// x = uint32(src[s-3]) | uint32(src[s-2])<<8 | uint32(src[s-1])<<16
	// We read one byte, safe to read one back, since we are just reading tag.
	// x = binary.LittleEndian.Uint32(src[s-1:]) >> 8
	MOVL -4(R_SRC), R_LEN
	SHRL $8, R_LEN
	JMP  doLit

tagLit63:
	// case x == 63:
	// x = uint32(src[s-4]) | uint32(src[s-3])<<8 | uint32(src[s-2])<<16 | uint32(src[s-1])<<24
	MOVL -4(R_SRC), R_LEN
	JMP  doLit

// The code above handles literal tags.
// ----------------------------------------
// The code below handles copy tags.

tagCopy4:
	// case tagCopy4:
	// s += 5
	ADDQ $5, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	CMPQ R_SRC, R_SEND
	JA   errCorrupt

	// length = 1 + int(src[s-5])>>2
	SHRQ $2, R_LEN
	INCQ R_LEN

	// offset = int(uint32(src[s-4]) | uint32(src[s-3])<<8 | uint32(src[s-2])<<16 | uint32(src[s-1])<<24)
	MOVLQZX -4(R_SRC), R_OFF
	JMP     doCopy

tagCopy2:
	// case tagCopy2:
	// s += 3
	ADDQ $3, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	CMPQ R_SRC, R_SEND
	JA   errCorrupt

	// length = 1 + int(src[s-3])>>2
	SHRQ $2, R_LEN
	INCQ R_LEN

	// offset = int(uint32(src[s-2]) | uint32(src[s-1])<<8)
	MOVWQZX -2(R_SRC), R_OFF
	JMP     doCopy

tagCopy:
	// We have a copy tag. We assume that:
	//	- R_TMP1 == src[s] & 0x03
	//	- R_LEN == src[s]
	CMPQ R_TMP1, $2
	JEQ  tagCopy2
	JA   tagCopy4

	// case tagCopy1:
	// s += 2
	ADDQ $2, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	CMPQ R_SRC, R_SEND
	JA   errCorrupt

	// offset = int(uint32(src[s-2])&0xe0<<3 | uint32(src[s-1]))
	// length = 4 + int(src[s-2])>>2&0x7
	MOVBQZX -1(R_SRC), R_TMP1
	MOVQ    R_LEN, R_TMP0
	SHRQ    $2, R_LEN
	ANDQ    $0xe0, R_TMP0
	ANDQ    $7, R_LEN
	SHLQ    $3, R_TMP0
	ADDQ    $4, R_LEN
	ORQ     R_TMP1, R_TMP0

	// check if repeat code, ZF set by ORQ.
	JZ repeatCode

	// This is a regular copy, transfer our temporary value to R_OFF (length)
	MOVQ R_TMP0, R_OFF
	JMP  doCopy

// This is a repeat code.
repeatCode:
	// If length < 9, reuse last offset, with the length already calculated.
	CMPQ R_LEN, $9
	JL   doCopyRepeat

	// Read additional bytes for length.
	JE repeatLen1

	// Rare, so the extra branch shouldn't hurt too much.
	CMPQ R_LEN, $10
	JE   repeatLen2
	JMP  repeatLen3

// Read repeat lengths.
repeatLen1:
	// s ++
	ADDQ $1, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	CMPQ R_SRC, R_SEND
	JA   errCorrupt

	// length = src[s-1] + 8
	MOVBQZX -1(R_SRC), R_LEN
	ADDL    $8, R_LEN
	JMP     doCopyRepeat

repeatLen2:
	// s +=2
	ADDQ $2, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	CMPQ R_SRC, R_SEND
	JA   errCorrupt

	// length = uint32(src[s-2]) | (uint32(src[s-1])<<8) + (1 << 8)
	MOVWQZX -2(R_SRC), R_LEN
	ADDL    $260, R_LEN
	JMP     doCopyRepeat

repeatLen3:
	// s +=3
	ADDQ $3, R_SRC

	// if uint(s) > uint(len(src)) { etc }
	CMPQ R_SRC, R_SEND
	JA   errCorrupt

	// length = uint32(src[s-3]) | (uint32(src[s-2])<<8) | (uint32(src[s-1])<<16) + (1 << 16)
	// Read one byte further back (just part of the tag, shifted out)
	MOVL -4(R_SRC), R_LEN
	SHRL $8, R_LEN
	ADDL $65540, R_LEN
	JMP  doCopyRepeat

doCopy:
	// This is the end of the outer "switch", when we have a copy tag.
	//
	// We assume that:
	//	- R_LEN == length && R_LEN > 0
	//	- R_OFF == offset

	// if d < offset { etc }
	MOVQ R_DST, R_TMP1
	SUBQ R_DBASE, R_TMP1
	CMPQ R_TMP1, R_OFF
	JLT  errCorrupt

	// Repeat values can skip the test above, since any offset > 0 will be in dst.
doCopyRepeat:
	// if offset <= 0 { etc }
	CMPQ R_OFF, $0
	JLE  errCorrupt

	// if length > len(dst)-d { etc }
	MOVQ R_DEND, R_TMP1
	SUBQ R_DST, R_TMP1
	CMPQ R_LEN, R_TMP1
	JGT  errCorrupt

	// forwardCopy(dst[d:d+length], dst[d-offset:]); d += length
	//
	// Set:
	//	- R_TMP2 = len(dst)-d
	//	- R_TMP3 = &dst[d-offset]
	MOVQ R_DEND, R_TMP2
	SUBQ R_DST, R_TMP2
	MOVQ R_DST, R_TMP3
	SUBQ R_OFF, R_TMP3

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
	CMPQ R_LEN, $16
	JGT  slowForwardCopy
	CMPQ R_OFF, $8
	JLT  slowForwardCopy
	CMPQ R_TMP2, $16
	JLT  slowForwardCopy
	MOVQ 0(R_TMP3), R_TMP0
	MOVQ R_TMP0, 0(R_DST)
	MOVQ 8(R_TMP3), R_TMP1
	MOVQ R_TMP1, 8(R_DST)
	ADDQ R_LEN, R_DST
	JMP  loop

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
	SUBQ $10, R_TMP2
	CMPQ R_LEN, R_TMP2
	JGT  verySlowForwardCopy

	// We want to keep the offset, so we use R_TMP2 from here.
	MOVQ R_OFF, R_TMP2

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
	CMPQ R_TMP2, $8
	JGE  fixUpSlowForwardCopy
	MOVQ (R_TMP3), R_TMP1
	MOVQ R_TMP1, (R_DST)
	SUBQ R_TMP2, R_LEN
	ADDQ R_TMP2, R_DST
	ADDQ R_TMP2, R_TMP2
	JMP  makeOffsetAtLeast8

fixUpSlowForwardCopy:
	// !!! Add length (which might be negative now) to d (implied by R_DST being
	// &dst[d]) so that d ends up at the right place when we jump back to the
	// top of the loop. Before we do that, though, we save R_DST to R_TMP0 so that, if
	// length is positive, copying the remaining length bytes will write to the
	// right place.
	MOVQ R_DST, R_TMP0
	ADDQ R_LEN, R_DST

finishSlowForwardCopy:
	// !!! Repeat 8-byte load/stores until length <= 0. Ending with a negative
	// length means that we overrun, but as above, that will be fixed up by
	// subsequent iterations of the outermost loop.
	CMPQ R_LEN, $0
	JLE  loop
	MOVQ (R_TMP3), R_TMP1
	MOVQ R_TMP1, (R_TMP0)
	ADDQ $8, R_TMP3
	ADDQ $8, R_TMP0
	SUBQ $8, R_LEN
	JMP  finishSlowForwardCopy

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
	INCQ R_TMP3
	INCQ R_DST
	DECQ R_LEN
	JNZ  verySlowForwardCopy
	JMP  loop

// The code above handles copy tags.
// ----------------------------------------

end:
	// This is the end of the "for s < len(src)".
	//
	// if d != len(dst) { etc }
	CMPQ R_DST, R_DEND
	JNE  errCorrupt

	// return 0
	MOVQ $0, ret+48(FP)
	RET

errCorrupt:
	// return decodeErrCodeCorrupt
	MOVQ $1, ret+48(FP)
	RET
