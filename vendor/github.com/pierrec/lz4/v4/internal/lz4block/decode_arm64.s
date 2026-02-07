// +build gc
// +build !noasm

// This implementation assumes that strict alignment checking is turned off.
// The Go compiler makes the same assumption.

#include "go_asm.h"
#include "textflag.h"

// Register allocation.
#define dst		R0
#define dstorig		R1
#define src		R2
#define dstend		R3
#define dstend16	R4	// dstend - 16
#define srcend		R5
#define srcend16	R6	// srcend - 16
#define match		R7	// Match address.
#define dict		R8
#define dictlen		R9
#define dictend		R10
#define token		R11
#define len		R12	// Literal and match lengths.
#define lenRem		R13
#define offset		R14	// Match offset.
#define tmp1		R15
#define tmp2		R16
#define tmp3		R17
#define tmp4		R19

// func decodeBlock(dst, src, dict []byte) int
TEXT ·decodeBlock(SB), NOFRAME+NOSPLIT, $0-80
	LDP  dst_base+0(FP), (dst, dstend)
	ADD  dst, dstend
	MOVD dst, dstorig

	LDP src_base+24(FP), (src, srcend)
	CBZ srcend, shortSrc
	ADD src, srcend

	// dstend16 = max(dstend-16, 0) and similarly for srcend16.
	SUBS $16, dstend, dstend16
	CSEL LO, ZR, dstend16, dstend16
	SUBS $16, srcend, srcend16
	CSEL LO, ZR, srcend16, srcend16

	LDP dict_base+48(FP), (dict, dictlen)
	ADD dict, dictlen, dictend

loop:
	// Read token. Extract literal length.
	MOVBU.P 1(src), token
	LSR     $4, token, len
	CMP     $15, len
	BNE     readLitlenDone

readLitlenLoop:
	CMP     src, srcend
	BEQ     shortSrc
	MOVBU.P 1(src), tmp1
	ADDS    tmp1, len
	BVS     shortDst
	CMP     $255, tmp1
	BEQ     readLitlenLoop

readLitlenDone:
	CBZ len, copyLiteralDone

	// Bounds check dst+len and src+len.
	ADDS dst, len, tmp1
	BCS  shortSrc
	ADDS src, len, tmp2
	BCS  shortSrc
	CMP  dstend, tmp1
	BHI  shortDst
	CMP  srcend, tmp2
	BHI  shortSrc

	// Copy literal.
	SUBS $16, len
	BLO  copyLiteralShort

copyLiteralLoop:
	LDP.P 16(src), (tmp1, tmp2)
	STP.P (tmp1, tmp2), 16(dst)
	SUBS  $16, len
	BPL   copyLiteralLoop

	// Copy (final part of) literal of length 0-15.
	// If we have >=16 bytes left in src and dst, just copy 16 bytes.
copyLiteralShort:
	CMP  dstend16, dst
	CCMP LO, src, srcend16, $0b0010 // 0010 = preserve carry (LO).
	BHS  copyLiteralShortEnd

	AND $15, len

	LDP (src), (tmp1, tmp2)
	ADD len, src
	STP (tmp1, tmp2), (dst)
	ADD len, dst

	B copyLiteralDone

	// Safe but slow copy near the end of src, dst.
copyLiteralShortEnd:
	TBZ     $3, len, 3(PC)
	MOVD.P  8(src), tmp1
	MOVD.P  tmp1, 8(dst)
	TBZ     $2, len, 3(PC)
	MOVW.P  4(src), tmp2
	MOVW.P  tmp2, 4(dst)
	TBZ     $1, len, 3(PC)
	MOVH.P  2(src), tmp3
	MOVH.P  tmp3, 2(dst)
	TBZ     $0, len, 3(PC)
	MOVBU.P 1(src), tmp4
	MOVB.P  tmp4, 1(dst)

copyLiteralDone:
	// Initial part of match length.
	AND $15, token, len

	CMP src, srcend
	BEQ end

	// Read offset.
	ADDS  $2, src
	BCS   shortSrc
	CMP   srcend, src
	BHI   shortSrc
	MOVHU -2(src), offset
	CBZ   offset, corrupt

	// Read rest of match length.
	CMP $15, len
	BNE readMatchlenDone

readMatchlenLoop:
	CMP     src, srcend
	BEQ     shortSrc
	MOVBU.P 1(src), tmp1
	ADDS    tmp1, len
	BVS     shortDst
	CMP     $255, tmp1
	BEQ     readMatchlenLoop

readMatchlenDone:
	ADD $const_minMatch, len

	// Bounds check dst+len.
	ADDS dst, len, tmp2
	BCS  shortDst
	CMP  dstend, tmp2
	BHI  shortDst

	SUB offset, dst, match
	CMP dstorig, match
	BHS copyMatchTry8

	// match < dstorig means the match starts in the dictionary,
	// at len(dict) - offset + (dst - dstorig).
	SUB  dstorig, dst, tmp1
	SUB  offset, dictlen, tmp2
	ADDS tmp2, tmp1
	BMI  shortDict
	ADD  dict, tmp1, match

copyDict:
	MOVBU.P 1(match), tmp3
	MOVB.P  tmp3, 1(dst)
	SUBS    $1, len
	CCMP    NE, dictend, match, $0b0100 // 0100 sets the Z (EQ) flag.
	BNE     copyDict

	CBZ len, copyMatchDone

	// If the match extends beyond the dictionary, the rest is at dstorig.
	// Recompute the offset for the next check.
	MOVD dstorig, match
	SUB  dstorig, dst, offset

copyMatchTry8:
	// Copy doublewords if both len and offset are at least eight.
	// A 16-at-a-time loop doesn't provide a further speedup.
	CMP  $8, len
	CCMP HS, offset, $8, $0
	BLO  copyMatchTry4

	AND    $7, len, lenRem
	SUB    $8, len
copyMatchLoop8:
	MOVD.P 8(match), tmp1
	MOVD.P tmp1, 8(dst)
	SUBS   $8, len
	BPL    copyMatchLoop8

	MOVD (match)(len), tmp2 // match+len == match+lenRem-8.
	ADD  lenRem, dst
	MOVD $0, len
	MOVD tmp2, -8(dst)
	B    copyMatchDone

copyMatchTry4:
	// Copy words if both len and offset are at least four.
	CMP  $4, len
	CCMP HS, offset, $4, $0
	BLO  copyMatchLoop1

	MOVWU.P 4(match), tmp2
	MOVWU.P tmp2, 4(dst)
	SUBS    $4, len
	BEQ     copyMatchDone

copyMatchLoop1:
	// Byte-at-a-time copy for small offsets <= 3.
	MOVBU.P 1(match), tmp2
	MOVB.P  tmp2, 1(dst)
	SUBS    $1, len
	BNE     copyMatchLoop1

copyMatchDone:
	CMP src, srcend
	BNE loop

end:
	CBNZ len, corrupt
	SUB  dstorig, dst, tmp1
	MOVD tmp1, ret+72(FP)
	RET

	// The error cases have distinct labels so we can put different
	// return codes here when debugging, or if the error returns need to
	// be changed.
shortDict:
shortDst:
shortSrc:
corrupt:
	MOVD $-1, tmp1
	MOVD tmp1, ret+72(FP)
	RET
