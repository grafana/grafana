// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build darwin || freebsd || linux

#include "textflag.h"
#include "abi_amd64.h"
#include "go_asm.h"
#include "funcdata.h"

#define STACK_SIZE 80
#define PTR_ADDRESS (STACK_SIZE - 8)

// syscall15X calls a function in libc on behalf of the syscall package.
// syscall15X takes a pointer to a struct like:
// struct {
//	fn    uintptr
//	a1    uintptr
//	a2    uintptr
//	a3    uintptr
//	a4    uintptr
//	a5    uintptr
//	a6    uintptr
//	a7    uintptr
//	a8    uintptr
//	a9    uintptr
//	a10    uintptr
//	a11    uintptr
//	a12    uintptr
//	a13    uintptr
//	a14    uintptr
//	a15    uintptr
//	r1    uintptr
//	r2    uintptr
//	err   uintptr
// }
// syscall15X must be called on the g0 stack with the
// C calling convention (use libcCall).
GLOBL ·syscall15XABI0(SB), NOPTR|RODATA, $8
DATA ·syscall15XABI0(SB)/8, $syscall15X(SB)
TEXT syscall15X(SB), NOSPLIT|NOFRAME, $0
	PUSHQ BP
	MOVQ  SP, BP
	SUBQ  $STACK_SIZE, SP
	MOVQ  DI, PTR_ADDRESS(BP) // save the pointer
	MOVQ  DI, R11

	MOVQ syscall15Args_f1(R11), X0 // f1
	MOVQ syscall15Args_f2(R11), X1 // f2
	MOVQ syscall15Args_f3(R11), X2 // f3
	MOVQ syscall15Args_f4(R11), X3 // f4
	MOVQ syscall15Args_f5(R11), X4 // f5
	MOVQ syscall15Args_f6(R11), X5 // f6
	MOVQ syscall15Args_f7(R11), X6 // f7
	MOVQ syscall15Args_f8(R11), X7 // f8

	MOVQ syscall15Args_a1(R11), DI // a1
	MOVQ syscall15Args_a2(R11), SI // a2
	MOVQ syscall15Args_a3(R11), DX // a3
	MOVQ syscall15Args_a4(R11), CX // a4
	MOVQ syscall15Args_a5(R11), R8 // a5
	MOVQ syscall15Args_a6(R11), R9 // a6

	// push the remaining paramters onto the stack
	MOVQ syscall15Args_a7(R11), R12
	MOVQ R12, 0(SP)                  // push a7
	MOVQ syscall15Args_a8(R11), R12
	MOVQ R12, 8(SP)                  // push a8
	MOVQ syscall15Args_a9(R11), R12
	MOVQ R12, 16(SP)                 // push a9
	MOVQ syscall15Args_a10(R11), R12
	MOVQ R12, 24(SP)                 // push a10
	MOVQ syscall15Args_a11(R11), R12
	MOVQ R12, 32(SP)                 // push a11
	MOVQ syscall15Args_a12(R11), R12
	MOVQ R12, 40(SP)                 // push a12
	MOVQ syscall15Args_a13(R11), R12
	MOVQ R12, 48(SP)                 // push a13
	MOVQ syscall15Args_a14(R11), R12
	MOVQ R12, 56(SP)                 // push a14
	MOVQ syscall15Args_a15(R11), R12
	MOVQ R12, 64(SP)                 // push a15
	XORL AX, AX                      // vararg: say "no float args"

	MOVQ syscall15Args_fn(R11), R10 // fn
	CALL R10

	MOVQ PTR_ADDRESS(BP), DI      // get the pointer back
	MOVQ AX, syscall15Args_a1(DI) // r1
	MOVQ DX, syscall15Args_a2(DI) // r3
	MOVQ X0, syscall15Args_f1(DI) // f1
	MOVQ X1, syscall15Args_f2(DI) // f2

	XORL AX, AX          // no error (it's ignored anyway)
	ADDQ $STACK_SIZE, SP
	MOVQ BP, SP
	POPQ BP
	RET

TEXT callbackasm1(SB), NOSPLIT|NOFRAME, $0
	MOVQ 0(SP), AX  // save the return address to calculate the cb index
	MOVQ 8(SP), R10 // get the return SP so that we can align register args with stack args
	ADDQ $8, SP     // remove return address from stack, we are not returning to callbackasm, but to its caller.

	// make space for first six int and 8 float arguments below the frame
	ADJSP $14*8, SP
	MOVSD X0, (1*8)(SP)
	MOVSD X1, (2*8)(SP)
	MOVSD X2, (3*8)(SP)
	MOVSD X3, (4*8)(SP)
	MOVSD X4, (5*8)(SP)
	MOVSD X5, (6*8)(SP)
	MOVSD X6, (7*8)(SP)
	MOVSD X7, (8*8)(SP)
	MOVQ  DI, (9*8)(SP)
	MOVQ  SI, (10*8)(SP)
	MOVQ  DX, (11*8)(SP)
	MOVQ  CX, (12*8)(SP)
	MOVQ  R8, (13*8)(SP)
	MOVQ  R9, (14*8)(SP)
	LEAQ  8(SP), R8      // R8 = address of args vector

	PUSHQ R10 // push the stack pointer below registers

	// Switch from the host ABI to the Go ABI.
	PUSH_REGS_HOST_TO_ABI0()

	// determine index into runtime·cbs table
	MOVQ $callbackasm(SB), DX
	SUBQ DX, AX
	MOVQ $0, DX
	MOVQ $5, CX               // divide by 5 because each call instruction in ·callbacks is 5 bytes long
	DIVL CX
	SUBQ $1, AX               // subtract 1 because return PC is to the next slot

	// Create a struct callbackArgs on our stack to be passed as
	// the "frame" to cgocallback and on to callbackWrap.
	// $24 to make enough room for the arguments to runtime.cgocallback
	SUBQ $(24+callbackArgs__size), SP
	MOVQ AX, (24+callbackArgs_index)(SP)  // callback index
	MOVQ R8, (24+callbackArgs_args)(SP)   // address of args vector
	MOVQ $0, (24+callbackArgs_result)(SP) // result
	LEAQ 24(SP), AX                       // take the address of callbackArgs

	// Call cgocallback, which will call callbackWrap(frame).
	MOVQ ·callbackWrap_call(SB), DI // Get the ABIInternal function pointer
	MOVQ (DI), DI                   // without <ABIInternal> by using a closure.
	MOVQ AX, SI                     // frame (address of callbackArgs)
	MOVQ $0, CX                     // context

	CALL crosscall2(SB) // runtime.cgocallback(fn, frame, ctxt uintptr)

	// Get callback result.
	MOVQ (24+callbackArgs_result)(SP), AX
	ADDQ $(24+callbackArgs__size), SP     // remove callbackArgs struct

	POP_REGS_HOST_TO_ABI0()

	POPQ  R10        // get the SP back
	ADJSP $-14*8, SP // remove arguments

	MOVQ R10, 0(SP)

	RET
