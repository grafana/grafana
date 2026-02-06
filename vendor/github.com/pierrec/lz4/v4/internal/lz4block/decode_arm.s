// +build gc
// +build !noasm

#include "go_asm.h"
#include "textflag.h"

// Register allocation.
#define dst	R0
#define dstorig	R1
#define src	R2
#define dstend	R3
#define srcend	R4
#define match	R5	// Match address.
#define dictend	R6
#define token	R7
#define len	R8	// Literal and match lengths.
#define offset	R7	// Match offset; overlaps with token.
#define tmp1	R9
#define tmp2	R11
#define tmp3	R12

// func decodeBlock(dst, src, dict []byte) int
TEXT ·decodeBlock(SB), NOFRAME+NOSPLIT, $-4-40
	MOVW dst_base  +0(FP), dst
	MOVW dst_len   +4(FP), dstend
	MOVW src_base +12(FP), src
	MOVW src_len  +16(FP), srcend

	CMP $0, srcend
	BEQ shortSrc

	ADD dst, dstend
	ADD src, srcend

	MOVW dst, dstorig

loop:
	// Read token. Extract literal length.
	MOVBU.P 1(src), token
	MOVW    token >> 4, len
	CMP     $15, len
	BNE     readLitlenDone

readLitlenLoop:
	CMP     src, srcend
	BEQ     shortSrc
	MOVBU.P 1(src), tmp1
	ADD.S   tmp1, len
	BVS     shortDst
	CMP     $255, tmp1
	BEQ     readLitlenLoop

readLitlenDone:
	CMP $0, len
	BEQ copyLiteralDone

	// Bounds check dst+len and src+len.
	ADD.S    dst, len, tmp1
	ADD.CC.S src, len, tmp2
	BCS      shortSrc
	CMP      dstend, tmp1
	//BHI    shortDst // Uncomment for distinct error codes.
	CMP.LS   srcend, tmp2
	BHI      shortSrc

	// Copy literal.
	CMP $4, len
	BLO copyLiteralFinish

	// Copy 0-3 bytes until src is aligned.
	TST        $1, src
	MOVBU.NE.P 1(src), tmp1
	MOVB.NE.P  tmp1, 1(dst)
	SUB.NE     $1, len

	TST        $2, src
	MOVHU.NE.P 2(src), tmp2
	MOVB.NE.P  tmp2, 1(dst)
	MOVW.NE    tmp2 >> 8, tmp1
	MOVB.NE.P  tmp1, 1(dst)
	SUB.NE     $2, len

	B copyLiteralLoopCond

copyLiteralLoop:
	// Aligned load, unaligned write.
	MOVW.P 4(src), tmp1
	MOVW   tmp1 >>  8, tmp2
	MOVB   tmp2, 1(dst)
	MOVW   tmp1 >> 16, tmp3
	MOVB   tmp3, 2(dst)
	MOVW   tmp1 >> 24, tmp2
	MOVB   tmp2, 3(dst)
	MOVB.P tmp1, 4(dst)
copyLiteralLoopCond:
	// Loop until len-4 < 0.
	SUB.S  $4, len
	BPL    copyLiteralLoop

copyLiteralFinish:
	// Copy remaining 0-3 bytes.
	// At this point, len may be < 0, but len&3 is still accurate.
	TST       $1, len
	MOVB.NE.P 1(src), tmp3
	MOVB.NE.P tmp3, 1(dst)
	TST       $2, len
	MOVB.NE.P 2(src), tmp1
	MOVB.NE.P tmp1, 2(dst)
	MOVB.NE   -1(src), tmp2
	MOVB.NE   tmp2, -1(dst)

copyLiteralDone:
	// Initial part of match length.
	// This frees up the token register for reuse as offset.
	AND $15, token, len

	CMP src, srcend
	BEQ end

	// Read offset.
	ADD.S $2, src
	BCS   shortSrc
	CMP   srcend, src
	BHI   shortSrc
	MOVBU -2(src), offset
	MOVBU -1(src), tmp1
	ORR.S tmp1 << 8, offset
	BEQ   corrupt

	// Read rest of match length.
	CMP $15, len
	BNE readMatchlenDone

readMatchlenLoop:
	CMP     src, srcend
	BEQ     shortSrc
	MOVBU.P 1(src), tmp1
	ADD.S   tmp1, len
	BVS     shortDst
	CMP     $255, tmp1
	BEQ     readMatchlenLoop

readMatchlenDone:
	// Bounds check dst+len+minMatch.
	ADD.S    dst, len, tmp1
	ADD.CC.S $const_minMatch, tmp1
	BCS      shortDst
	CMP      dstend, tmp1
	BHI      shortDst

	RSB dst, offset, match
	CMP dstorig, match
	BGE copyMatch4

	// match < dstorig means the match starts in the dictionary,
	// at len(dict) - offset + (dst - dstorig).
	MOVW dict_base+24(FP), match
	MOVW dict_len +28(FP), dictend

	ADD $const_minMatch, len

	RSB   dst, dstorig, tmp1
	RSB   dictend, offset, tmp2
	ADD.S tmp2, tmp1
	BMI   shortDict
	ADD   match, dictend
	ADD   tmp1, match

copyDict:
	MOVBU.P 1(match), tmp1
	MOVB.P  tmp1, 1(dst)
	SUB.S   $1, len
	CMP.NE  match, dictend
	BNE     copyDict

	// If the match extends beyond the dictionary, the rest is at dstorig.
	CMP  $0, len
	BEQ  copyMatchDone
	MOVW dstorig, match
	B    copyMatch

	// Copy a regular match.
	// Since len+minMatch is at least four, we can do a 4× unrolled
	// byte copy loop. Using MOVW instead of four byte loads is faster,
	// but to remain portable we'd have to align match first, which is
	// too expensive. By alternating loads and stores, we also handle
	// the case offset < 4.
copyMatch4:
	SUB.S   $4, len
	MOVBU.P 4(match), tmp1
	MOVB.P  tmp1, 4(dst)
	MOVBU   -3(match), tmp2
	MOVB    tmp2, -3(dst)
	MOVBU   -2(match), tmp3
	MOVB    tmp3, -2(dst)
	MOVBU   -1(match), tmp1
	MOVB    tmp1, -1(dst)
	BPL     copyMatch4

	// Restore len, which is now negative.
	ADD.S $4, len
	BEQ   copyMatchDone

copyMatch:
	// Finish with a byte-at-a-time copy.
	SUB.S   $1, len
	MOVBU.P 1(match), tmp2
	MOVB.P  tmp2, 1(dst)
	BNE     copyMatch

copyMatchDone:
	CMP src, srcend
	BNE loop

end:
	CMP  $0, len
	BNE  corrupt
	SUB  dstorig, dst, tmp1
	MOVW tmp1, ret+36(FP)
	RET

	// The error cases have distinct labels so we can put different
	// return codes here when debugging, or if the error returns need to
	// be changed.
shortDict:
shortDst:
shortSrc:
corrupt:
	MOVW $-1, tmp1
	MOVW tmp1, ret+36(FP)
	RET
