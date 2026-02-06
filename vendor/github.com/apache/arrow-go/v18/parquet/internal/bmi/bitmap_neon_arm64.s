//+build !noasm !appengine

// (C2GOASM doesn't work correctly for Arm64)
// func _levels_to_bitmap_neon(levels unsafe.Pointer, numLevels int, rhs int16) (res uint64)
TEXT ·_levels_to_bitmap_neon(SB), $0-32

    MOVD levels+0(FP), R0
    MOVD numLevels+8(FP), R1
    MOVD rhs+16(FP), R2

    // The Go ABI saves the frame pointer register one word below the 
    // caller's frame. Make room so we don't overwrite it. Needs to stay 
    // 16-byte aligned 
    SUB $16, RSP
    WORD $0xa9bf7bfd // stp    x29, x30, [sp, #-16]!
    WORD $0x7100043f // cmp    w1, #1
    WORD $0x910003fd // mov    x29, sp
    BLT LBB1_3

    WORD $0x71000c3f // cmp    w1, #3
    WORD $0x2a0103e9 // mov    w9, w1
    BHI LBB1_4
    WORD $0xaa1f03ea // mov    x10, xzr
    WORD $0xaa1f03e8 // mov    x8, xzr
    JMP LBB1_7
LBB1_3:
    WORD $0xaa1f03e8 // mov    x8, xzr
    JMP LBB1_8
LBB1_4:
    VMOVQ $0x0000000000000000, $0x0000000000000001, V1 // adrp	x11, .LCPI1_0; ldr q1, [x11, :lo12:.LCPI1_0]
    WORD $0x5280004b // mov    w11, #2
    WORD $0x0e040c43 // dup    v3.2s, w2
    WORD $0x4e080d62 // dup    v2.2d, x11
    WORD $0x5280002b // mov    w11, #1
    WORD $0x927e752a // and    x10, x9, #0xfffffffc
    WORD $0x0f305464 // shl    v4.2s, v3.2s, #16
    WORD $0x4e080d63 // dup    v3.2d, x11
    WORD $0x5280008b // mov    w11, #4
    WORD $0x91001008 // add    x8, x0, #4
    WORD $0x6f00e400 // movi    v0.2d, #0000000000000000
    WORD $0x0f300484 // sshr    v4.2s, v4.2s, #16
    WORD $0x4e080d65 // dup    v5.2d, x11
    WORD $0xaa0a03eb // mov    x11, x10
    WORD $0x6f00e406 // movi    v6.2d, #0000000000000000
LBB1_5:
    WORD $0x78dfc10c // ldursh    w12, [x8, #-4]
    WORD $0x79c0010d // ldrsh    w13, [x8]
    WORD $0x78dfe10e // ldursh    w14, [x8, #-2]
    WORD $0x4ee28431 // add    v17.2d, v1.2d, v2.2d
    WORD $0x1e270187 // fmov    s7, w12
    WORD $0x79c0050c // ldrsh    w12, [x8, #2]
    WORD $0x1e2701b0 // fmov    s16, w13
    WORD $0x4e0c1dc7 // mov    v7.s[1], w14
    WORD $0x0ea434e7 // cmgt    v7.2s, v7.2s, v4.2s
    WORD $0x4e0c1d90 // mov    v16.s[1], w12
    WORD $0x0ea43610 // cmgt    v16.2s, v16.2s, v4.2s
    WORD $0x2f20a4e7 // ushll    v7.2d, v7.2s, #0
    WORD $0x2f20a610 // ushll    v16.2d, v16.2s, #0
    WORD $0x4e231ce7 // and    v7.16b, v7.16b, v3.16b
    WORD $0x4e231e10 // and    v16.16b, v16.16b, v3.16b
    WORD $0x6ee144e7 // ushl    v7.2d, v7.2d, v1.2d
    WORD $0x6ef14610 // ushl    v16.2d, v16.2d, v17.2d
    WORD $0xf100116b // subs    x11, x11, #4
    WORD $0x4ee58421 // add    v1.2d, v1.2d, v5.2d
    WORD $0x4ea01ce0 // orr    v0.16b, v7.16b, v0.16b
    WORD $0x4ea61e06 // orr    v6.16b, v16.16b, v6.16b
    WORD $0x91002108 // add    x8, x8, #8
    BNE LBB1_5
    WORD $0x4ea01cc0 // orr    v0.16b, v6.16b, v0.16b
    WORD $0x4e180401 // dup    v1.2d, v0.d[1]
    WORD $0x4ea11c00 // orr    v0.16b, v0.16b, v1.16b
    WORD $0xeb09015f // cmp    x10, x9
    WORD $0x9e660008 // fmov    x8, d0
    BEQ LBB1_8
LBB1_7:
    WORD $0x78ea780b // ldrsh    w11, [x0, x10, lsl #1]
    WORD $0x6b22a17f // cmp    w11, w2, sxth
    WORD $0x1a9fd7eb // cset    w11, gt
    WORD $0x9aca216b // lsl    x11, x11, x10
    WORD $0x9100054a // add    x10, x10, #1
    WORD $0xeb0a013f // cmp    x9, x10
    WORD $0xaa080168 // orr    x8, x11, x8
    BNE LBB1_7
LBB1_8:
    WORD $0xa8c17bfd // ldp    x29, x30, [sp], #16
    // Put the stack pointer back where it was 
    ADD $16, RSP
    MOVD R8, res+24(FP)
    RET

