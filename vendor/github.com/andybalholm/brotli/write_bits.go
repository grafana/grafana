package brotli

import "encoding/binary"

/* Copyright 2010 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Write bits into a byte array. */

/* This function writes bits into bytes in increasing addresses, and within
   a byte least-significant-bit first.

   The function can write up to 56 bits in one go with WriteBits
   Example: let's assume that 3 bits (Rs below) have been written already:

   BYTE-0     BYTE+1       BYTE+2

   0000 0RRR    0000 0000    0000 0000

   Now, we could write 5 or less bits in MSB by just sifting by 3
   and OR'ing to BYTE-0.

   For n bits, we take the last 5 bits, OR that with high bits in BYTE-0,
   and locate the rest in BYTE+1, BYTE+2, etc. */
func writeBits(n_bits uint, bits uint64, pos *uint, array []byte) {
	/* This branch of the code can write up to 56 bits at a time,
	   7 bits are lost by being perhaps already in *p and at least
	   1 bit is needed to initialize the bit-stream ahead (i.e. if 7
	   bits are in *p and we write 57 bits, then the next write will
	   access a byte that was never initialized). */
	p := array[*pos>>3:]
	v := uint64(p[0])
	v |= bits << (*pos & 7)
	binary.LittleEndian.PutUint64(p, v)
	*pos += n_bits
}

func writeSingleBit(bit bool, pos *uint, array []byte) {
	if bit {
		writeBits(1, 1, pos, array)
	} else {
		writeBits(1, 0, pos, array)
	}
}

func writeBitsPrepareStorage(pos uint, array []byte) {
	assert(pos&7 == 0)
	array[pos>>3] = 0
}
