#include "textflag.h"

#define Rdst  R0
#define Rsrc  R1
#define Rlen  R2
#define Rwr   R3
#define Rrem  R4
#define Rtmp  R5

#define Vlut V0
#define Vfld0 V6
#define Vfld1 V7
#define Vfld2 V8
#define Vfld3 V9
#define Vsrc0 V10
#define Vsrc1 V11
#define Vsrc2 V12
#define Vr0a V13
#define Vr1a V14
#define Vr2a V15
#define Vr3a V16
#define Vr0b V17
#define Vr1b V18
#define Vr2b V19
#define Vr3b V20

// func encodeARM64(dst []byte, src []byte, lut *int8) (int, int)
TEXT ·encodeARM64(SB),NOSPLIT,$0-72
	// Load dst/src info
	MOVD    dst_base+0(FP), Rdst
	MOVD    src_base+24(FP), Rsrc
	MOVD    src_len+32(FP), Rlen
	MOVD    lut+48(FP), Rtmp
	VLD1    (Rtmp), [Vlut.B16]

	MOVD    Rlen, Rrem
	MOVD    Rdst, Rwr

	VMOVI   $51, V1.B16
	VMOVI   $26, V2.B16
	VMOVI   $63, V3.B16
	VMOVI   $13, V4.B16

loop:
	VLD3.P  48(Rsrc), [Vsrc0.B16, Vsrc1.B16, Vsrc2.B16]

	// Split 3 source blocks into 4 lookup inputs
	VUSHR   $2, Vsrc0.B16, Vfld0.B16
	VUSHR   $4, Vsrc1.B16, Vfld1.B16
	VUSHR   $6, Vsrc2.B16, Vfld2.B16
	VSHL    $4, Vsrc0.B16, Vsrc0.B16
	VSHL    $2, Vsrc1.B16, Vsrc1.B16
	VORR    Vsrc0.B16, Vfld1.B16, Vfld1.B16
	VORR    Vsrc1.B16, Vfld2.B16, Vfld2.B16
	VAND    V3.B16, Vfld1.B16, Vfld1.B16
	VAND    V3.B16, Vfld2.B16, Vfld2.B16
	VAND    V3.B16, Vsrc2.B16, Vfld3.B16

	WORD    $0x6e212ccd // VUQSUB  V1.B16, Vfld0.B16, Vr0a.B16
	WORD    $0x4e263451 // VCMGT   V2.B16, Vfld0.B16, Vr0b.B16
	VAND    V4.B16, Vr0b.B16, Vr0b.B16
	VORR    Vr0b.B16, Vr0a.B16, Vr0a.B16
	WORD    $0x6e212cee // VUQSUB  V1.B16, Vfld1.B16, Vr1a.B16
	WORD    $0x4e273452 // VCMGT   V2.B16, Vfld1.B16, Vr1b.B16
	VAND    V4.B16, Vr1b.B16, Vr1b.B16
	VORR    Vr1b.B16, Vr1a.B16, Vr1a.B16
	WORD    $0x6e212d0f // VUQSUB  V1.B16, Vfld2.B16, Vr2a.B16
	WORD    $0x4e283453 // VCMGT   V2.B16, Vfld2.B16, Vr2b.B16
	VAND    V4.B16, Vr2b.B16, Vr2b.B16
	VORR    Vr2b.B16, Vr2a.B16, Vr2a.B16
	WORD    $0x6e212d30 // VUQSUB  V1.B16, Vfld3.B16, Vr3a.B16
	WORD    $0x4e293454 // VCMGT   V2.B16, Vfld3.B16, Vr3b.B16
	VAND    V4.B16, Vr3b.B16, Vr3b.B16
	VORR    Vr3b.B16, Vr3a.B16, Vr3a.B16

	// Add result of lookup table to each field
	VTBL    Vr0a.B16, [Vlut.B16], Vr0a.B16
	VADD    Vr0a.B16, Vfld0.B16, Vfld0.B16
	VTBL    Vr1a.B16, [Vlut.B16], Vr1a.B16
	VADD    Vr1a.B16, Vfld1.B16, Vfld1.B16
	VTBL    Vr2a.B16, [Vlut.B16], Vr2a.B16
	VADD    Vr2a.B16, Vfld2.B16, Vfld2.B16
	VTBL    Vr3a.B16, [Vlut.B16], Vr3a.B16
	VADD    Vr3a.B16, Vfld3.B16, Vfld3.B16

	VST4.P  [Vfld0.B16, Vfld1.B16, Vfld2.B16, Vfld3.B16], 64(Rwr)
	SUB     $48, Rrem
	CMP     $48, Rrem
	BGE     loop

done:
	SUB     Rdst, Rwr
	SUB     Rrem, Rlen
	MOVD    Rwr, ret+56(FP)
	MOVD    Rlen, ret1+64(FP)
	RET

