// +build arm64,!gccgo,!appengine

#include "textflag.h"


// This implements union2by2 using golang's version of arm64 assembly
// The algorithm is very similar to the generic one,
// but makes better use of arm64 features so is notably faster.
// The basic algorithm structure is as follows:
// 1. If either set is empty, copy the other set into the buffer and return the length
// 2. Otherwise, load the first element of each set into a variable (s1 and s2).
// 3. a. Compare the values of s1 and s2.
 // b. add the smaller one to the buffer.
 // c. perform a bounds check before incrementing.
 // If one set is finished, copy the rest of the other set over.
 // d. update s1 and or s2 to the next value, continue loop.
 //
 // Past the fact of the algorithm, this code makes use of several arm64 features
 // Condition Codes:
 // arm64's CMP operation sets 4 bits that can be used for branching,
 // rather than just true or false.
 // As a consequence, a single comparison gives enough information to distinguish the three cases
 //
 // Post-increment pointers after load/store:
 // Instructions like `MOVHU.P 2(R0), R6`
 // increment the register by a specified amount, in this example 2.
 // Because uint16's are exactly 2 bytes and the length of the slices
 // is part of the slice header,
 // there is no need to separately track the index into the slice.
 // Instead, the code can calculate the final read value and compare against that,
 // using the post-increment reads to move the pointers along.
 //
 // TODO: CALL out to memmove once the list is exhausted.
 // Right now it moves the necessary shorts so that the remaining count
 // is a multiple of 4 and then copies 64 bits at a time.

TEXT ·union2by2(SB), NOSPLIT, $0-80
	// R0, R1, and R2 for the pointers to the three slices
	MOVD set1+0(FP), R0
	MOVD set2+24(FP), R1
	MOVD buffer+48(FP), R2

	//R3 and R4 will be the values at which we will have finished reading set1 and set2.
	// R3 should be R0 + 2 * set1_len+8(FP)
	MOVD set1_len+8(FP), R3
	MOVD set2_len+32(FP), R4

	ADD R3<<1, R0, R3
	ADD R4<<1, R1, R4


	//Rather than counting the number of elements added separately
	//Save the starting register of buffer.
	MOVD buffer+48(FP), R5

	// set1 is empty, just flush set2
	CMP R0, R3
	BEQ flush_right

	// set2 is empty, just flush set1
	CMP R1, R4
	BEQ flush_left

	// R6, R7 are the working space for s1 and s2
	MOVD ZR, R6
	MOVD ZR, R7

	MOVHU.P 2(R0), R6
	MOVHU.P 2(R1), R7
loop:

	CMP R6, R7
	BEQ pop_both // R6 == R7
	BLS pop_right // R6 > R7
//pop_left: // R6 < R7
	MOVHU.P R6, 2(R2)
	CMP R0, R3
	BEQ pop_then_flush_right
	MOVHU.P 2(R0), R6
	JMP loop
pop_both:
	MOVHU.P R6, 2(R2) //could also use R7, since they are equal
	CMP R0, R3
	BEQ flush_right
	CMP R1, R4
	BEQ flush_left
	MOVHU.P 2(R0), R6
	MOVHU.P 2(R1), R7
	JMP loop
pop_right:
	MOVHU.P R7, 2(R2)
	CMP R1, R4
	BEQ pop_then_flush_left
	MOVHU.P 2(R1), R7
	JMP loop

pop_then_flush_right:
	MOVHU.P R7, 2(R2)
flush_right:
	MOVD R1, R0
	MOVD R4, R3
	JMP flush_left
pop_then_flush_left:
	MOVHU.P R6, 2(R2)
flush_left:
	CMP R0, R3
	BEQ return
	//figure out how many bytes to slough off. Must be a multiple of two
	SUB R0, R3, R4
	ANDS $6, R4
	BEQ long_flush //handles the 0 mod 8 case
	SUBS $4, R4, R4 // since possible values are 2, 4, 6, this splits evenly
	BLT pop_single  // exactly the 2 case
	MOVW.P 4(R0), R6
	MOVW.P R6, 4(R2)
	BEQ long_flush // we're now aligned by 64 bits, as R4==4, otherwise 2 more
pop_single:
	MOVHU.P 2(R0), R6
	MOVHU.P R6, 2(R2)
long_flush:
	// at this point we know R3 - R0 is a multiple of 8.
	CMP R0, R3
	BEQ return
	MOVD.P 8(R0), R6
	MOVD.P R6, 8(R2)
	JMP long_flush
return:
	// number of shorts written is (R5 - R2) >> 1
	SUB R5, R2
	LSR $1, R2, R2
	MOVD R2, size+72(FP)
	RET
