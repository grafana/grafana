// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023 The Ebitengine Authors

//go:build darwin || freebsd || linux

#include "textflag.h"
#include "go_asm.h"
#include "funcdata.h"
#include "abi_arm64.h"

TEXT callbackasm1(SB), NOSPLIT|NOFRAME, $0
	NO_LOCAL_POINTERS

	// On entry, the trampoline in zcallback_darwin_arm64.s left
	// the callback index in R12 (which is volatile in the C ABI).

	// Save callback register arguments R0-R7 and F0-F7.
	// We do this at the top of the frame so they're contiguous with stack arguments.
	SUB   $(16*8), RSP, R14
	FSTPD (F0, F1), (0*8)(R14)
	FSTPD (F2, F3), (2*8)(R14)
	FSTPD (F4, F5), (4*8)(R14)
	FSTPD (F6, F7), (6*8)(R14)
	STP   (R0, R1), (8*8)(R14)
	STP   (R2, R3), (10*8)(R14)
	STP   (R4, R5), (12*8)(R14)
	STP   (R6, R7), (14*8)(R14)

	// Adjust SP by frame size.
	SUB $(26*8), RSP

	// It is important to save R27 because the go assembler
	// uses it for move instructions for a variable.
	// This line:
	// MOVD ·callbackWrap_call(SB), R0
	// Creates the instructions:
	// ADRP 14335(PC), R27
	// MOVD 388(27), R0
	// R27 is a callee saved register so we are responsible
	// for ensuring its value doesn't change. So save it and
	// restore it at the end of this function.
	// R30 is the link register. crosscall2 doesn't save it
	// so it's saved here.
	STP (R27, R30), 0(RSP)

	// Create a struct callbackArgs on our stack.
	MOVD $(callbackArgs__size)(RSP), R13
	MOVD R12, callbackArgs_index(R13)    // callback index
	MOVD R14, callbackArgs_args(R13)     // address of args vector
	MOVD ZR, callbackArgs_result(R13)    // result

	// Move parameters into registers
	// Get the ABIInternal function pointer
	// without <ABIInternal> by using a closure.
	MOVD ·callbackWrap_call(SB), R0
	MOVD (R0), R0                   // fn unsafe.Pointer
	MOVD R13, R1                    // frame (&callbackArgs{...})
	MOVD $0, R3                     // ctxt uintptr

	BL crosscall2(SB)

	// Get callback result.
	MOVD $(callbackArgs__size)(RSP), R13
	MOVD callbackArgs_result(R13), R0

	// Restore LR and R27
	LDP 0(RSP), (R27, R30)
	ADD $(26*8), RSP

	RET
