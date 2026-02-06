#include "textflag.h"

#define LOAD_ARGS()                                            \
	MOVD    dst_base+0(FP), R0;                                  \
	MOVD    R0, R3;                                              \
	MOVD    src_base+24(FP), R1;                                 \
	MOVD    R1, R4;                                              \
	MOVD    src_len+32(FP), R2;                                  \
	BIC     $31, R2, R2;                                         \
	ADD     R1, R2, R2

#define LOAD_ARG_LUT()                                         \
	MOVD    lut+48(FP), R5;                                      \
	VLD2R   (R5), [V0.B16, V1.B16]

#define LOAD_CONST_LUT()                                       \
	MOVD    $·mask_lut(SB), R6;                                  \
	MOVD    $·bpos_lut(SB), R7;                                  \
	MOVD    $·shft_lut(SB), R8;                                  \
	VLD1    (R6), [V2.B16];                                      \
	VLD1    (R7), [V3.B16];                                      \
	VLD1    (R8), [V4.B16];                                      \
	VMOVI   $43, V5.B8;                                          \
	VMOVI   $47, V6.B8;                                          \
	VMOVI   $15, V7.B8;                                          \
	VMOVI   $16, V8.B8;                                          \

#define LOAD_INPUT()                                           \
	VLD4    (R4), [V10.B8, V11.B8, V12.B8, V13.B8]

#define COMPARE_INPUT(v)                                       \
	VCMEQ   V10.B8, v.B8, V14.B8;                                \
	VCMEQ   V11.B8, v.B8, V15.B8;                                \
	VCMEQ   V12.B8, v.B8, V16.B8;                                \
	VCMEQ   V13.B8, v.B8, V17.B8

#define UPDATE_INPUT(v)                                        \
	VBIT    V14.B8, v.B8, V10.B8;                                \
	VBIT    V15.B8, v.B8, V11.B8;                                \
	VBIT    V16.B8, v.B8, V12.B8;                                \
	VBIT    V17.B8, v.B8, V13.B8

#define DECODE_INPUT(goto_err)                                 \
	/* Create hi/lo nibles */                                    \
	VUSHR   $4, V10.B8, V18.B8;                                  \
	VUSHR   $4, V11.B8, V19.B8;                                  \
	VUSHR   $4, V12.B8, V20.B8;                                  \
	VUSHR   $4, V13.B8, V21.B8;                                  \
	VAND    V7.B8, V10.B8, V22.B8;                               \
	VAND    V7.B8, V11.B8, V23.B8;                               \
	VAND    V7.B8, V12.B8, V24.B8;                               \
	VAND    V7.B8, V13.B8, V25.B8;                               \
	/* Detect invalid input characters */                        \
	VTBL    V22.B8, [V2.B8], V22.B8;                             \
	VTBL    V23.B8, [V2.B8], V23.B8;                             \
	VTBL    V24.B8, [V2.B8], V24.B8;                             \
	VTBL    V25.B8, [V2.B8], V25.B8;                             \
	VTBL    V18.B8, [V3.B8], V26.B8;                             \
	VTBL    V19.B8, [V3.B8], V27.B8;                             \
	VTBL    V20.B8, [V3.B8], V28.B8;                             \
	VTBL    V21.B8, [V3.B8], V29.B8;                             \
	VAND    V22.B8, V26.B8, V26.B8;                              \
	VAND    V23.B8, V27.B8, V27.B8;                              \
	VAND    V24.B8, V28.B8, V28.B8;                              \
	VAND    V25.B8, V29.B8, V29.B8;                              \
	WORD    $0x0e209b5a /* VCMEQ   $0, V26.B8, V26.B8 */;        \
	WORD    $0x0e209b7b /* VCMEQ   $0, V27.B8, V27.B8 */;        \
	WORD    $0x0e209b9c /* VCMEQ   $0, V28.B8, V28.B8 */;        \
	WORD    $0x0e209bbd /* VCMEQ   $0, V29.B8, V29.B8 */;        \
	VORR    V26.B8, V27.B8, V26.B8;                              \
	VORR    V28.B8, V29.B8, V28.B8;                              \
	VORR    V26.B8, V28.B8, V26.B8;                              \
	VMOV    V26.D[0], R5;                                        \
	VMOV    V26.D[1], R6;                                        \
	ORR     R6, R5;                                              \
	CBNZ    R5, goto_err;                                        \
	/* Shift hi nibles */                                        \
	VTBL    V18.B8, [V4.B8], V18.B8;                             \
	VTBL    V19.B8, [V4.B8], V19.B8;                             \
	VTBL    V20.B8, [V4.B8], V20.B8;                             \
	VTBL    V21.B8, [V4.B8], V21.B8;                             \
	VBIT    V14.B8, V8.B8, V18.B8;                               \
	VBIT    V15.B8, V8.B8, V19.B8;                               \
	VBIT    V16.B8, V8.B8, V20.B8;                               \
	VBIT    V17.B8, V8.B8, V21.B8;                               \
	/* Combine results */                                        \
	VADD    V18.B8, V10.B8, V10.B8;                              \
	VADD    V19.B8, V11.B8, V11.B8;                              \
	VADD    V20.B8, V12.B8, V12.B8;                              \
	VADD    V21.B8, V13.B8, V13.B8;                              \
	VUSHR   $4, V11.B8, V14.B8;                                  \
	VUSHR   $2, V12.B8, V15.B8;                                  \
	VSHL    $2, V10.B8, V10.B8;                                  \
	VSHL    $4, V11.B8, V11.B8;                                  \
	VSHL    $6, V12.B8, V12.B8;                                  \
	VORR    V10.B8, V14.B8, V16.B8;                              \
	VORR    V11.B8, V15.B8, V17.B8;                              \
	VORR    V12.B8, V13.B8, V18.B8

#define ADVANCE_LOOP(goto_loop)                                \
	VST3.P  [V16.B8, V17.B8, V18.B8], 24(R3);                    \
	ADD     $32, R4;                                             \
	CMP     R4, R2;                                              \
	BGT     goto_loop

#define RETURN()                                               \
	SUB     R0, R3;                                              \
	SUB     R1, R4;                                              \
	MOVD    R3, ret+56(FP);                                      \
	MOVD    R4, ret1+64(FP);                                     \
	RET


// func decodeARM64(dst []byte, src []byte, lut *int8) (int, int)
TEXT ·decodeARM64(SB),NOSPLIT,$0-72
	LOAD_ARGS()
	LOAD_ARG_LUT()
	LOAD_CONST_LUT()

loop:
	LOAD_INPUT()

	// Compare and normalize the 63rd and 64th characters
	COMPARE_INPUT(V0)
	UPDATE_INPUT(V5)
	COMPARE_INPUT(V1)
	UPDATE_INPUT(V6)

	DECODE_INPUT(done) // Detect invalid input characters
	ADVANCE_LOOP(loop) // Store results and continue

done:
	RETURN()


// func decodeStdARM64(dst []byte, src []byte, lut *int8) (int, int)
TEXT ·decodeStdARM64(SB),NOSPLIT,$0-72
	LOAD_ARGS()
	LOAD_CONST_LUT()

loop:
	LOAD_INPUT()
	COMPARE_INPUT(V6)  // Compare to '+'
	DECODE_INPUT(done) // Detect invalid input characters
	ADVANCE_LOOP(loop) // Store results and continue

done:
	RETURN()


DATA  ·mask_lut+0x00(SB)/1, $0xa8
DATA  ·mask_lut+0x01(SB)/1, $0xf8
DATA  ·mask_lut+0x02(SB)/1, $0xf8
DATA  ·mask_lut+0x03(SB)/1, $0xf8
DATA  ·mask_lut+0x04(SB)/1, $0xf8
DATA  ·mask_lut+0x05(SB)/1, $0xf8
DATA  ·mask_lut+0x06(SB)/1, $0xf8
DATA  ·mask_lut+0x07(SB)/1, $0xf8
DATA  ·mask_lut+0x08(SB)/1, $0xf8
DATA  ·mask_lut+0x09(SB)/1, $0xf8
DATA  ·mask_lut+0x0a(SB)/1, $0xf0
DATA  ·mask_lut+0x0b(SB)/1, $0x54
DATA  ·mask_lut+0x0c(SB)/1, $0x50
DATA  ·mask_lut+0x0d(SB)/1, $0x50
DATA  ·mask_lut+0x0e(SB)/1, $0x50
DATA  ·mask_lut+0x0f(SB)/1, $0x54
GLOBL ·mask_lut(SB), NOPTR|RODATA, $16

DATA  ·bpos_lut+0x00(SB)/1, $0x01
DATA  ·bpos_lut+0x01(SB)/1, $0x02
DATA  ·bpos_lut+0x02(SB)/1, $0x04
DATA  ·bpos_lut+0x03(SB)/1, $0x08
DATA  ·bpos_lut+0x04(SB)/1, $0x10
DATA  ·bpos_lut+0x05(SB)/1, $0x20
DATA  ·bpos_lut+0x06(SB)/1, $0x40
DATA  ·bpos_lut+0x07(SB)/1, $0x80
DATA  ·bpos_lut+0x08(SB)/1, $0x00
DATA  ·bpos_lut+0x09(SB)/1, $0x00
DATA  ·bpos_lut+0x0a(SB)/1, $0x00
DATA  ·bpos_lut+0x0b(SB)/1, $0x00
DATA  ·bpos_lut+0x0c(SB)/1, $0x00
DATA  ·bpos_lut+0x0d(SB)/1, $0x00
DATA  ·bpos_lut+0x0e(SB)/1, $0x00
DATA  ·bpos_lut+0x0f(SB)/1, $0x00
GLOBL ·bpos_lut(SB), NOPTR|RODATA, $16

DATA  ·shft_lut+0x00(SB)/1, $0x00
DATA  ·shft_lut+0x01(SB)/1, $0x00
DATA  ·shft_lut+0x02(SB)/1, $0x13
DATA  ·shft_lut+0x03(SB)/1, $0x04
DATA  ·shft_lut+0x04(SB)/1, $0xbf
DATA  ·shft_lut+0x05(SB)/1, $0xbf
DATA  ·shft_lut+0x06(SB)/1, $0xb9
DATA  ·shft_lut+0x07(SB)/1, $0xb9
DATA  ·shft_lut+0x08(SB)/1, $0x00
DATA  ·shft_lut+0x09(SB)/1, $0x00
DATA  ·shft_lut+0x0a(SB)/1, $0x00
DATA  ·shft_lut+0x0b(SB)/1, $0x00
DATA  ·shft_lut+0x0c(SB)/1, $0x00
DATA  ·shft_lut+0x0d(SB)/1, $0x00
DATA  ·shft_lut+0x0e(SB)/1, $0x00
DATA  ·shft_lut+0x0f(SB)/1, $0x00
GLOBL ·shft_lut(SB), NOPTR|RODATA, $16
