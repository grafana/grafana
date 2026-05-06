package brotli

/* Copyright 2010 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Write bits into a byte array. */

type bitWriter struct {
	dst []byte

	// Data waiting to be written is the low nbits of bits.
	bits  uint64
	nbits uint
}

func (w *bitWriter) writeBits(nb uint, b uint64) {
	w.bits |= b << w.nbits
	w.nbits += nb
	if w.nbits >= 32 {
		bits := w.bits
		w.bits >>= 32
		w.nbits -= 32
		w.dst = append(w.dst,
			byte(bits),
			byte(bits>>8),
			byte(bits>>16),
			byte(bits>>24),
		)
	}
}

func (w *bitWriter) writeSingleBit(bit bool) {
	if bit {
		w.writeBits(1, 1)
	} else {
		w.writeBits(1, 0)
	}
}

func (w *bitWriter) jumpToByteBoundary() {
	dst := w.dst
	for w.nbits != 0 {
		dst = append(dst, byte(w.bits))
		w.bits >>= 8
		if w.nbits > 8 { // Avoid underflow
			w.nbits -= 8
		} else {
			w.nbits = 0
		}
	}
	w.bits = 0
	w.dst = dst
}
