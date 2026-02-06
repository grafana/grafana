// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package rand

import (
	"encoding/binary"
	"io"
	"math/bits"
)

// PCGSource is an implementation of a 64-bit permuted congruential
// generator as defined in
//
//	PCG: A Family of Simple Fast Space-Efficient Statistically Good
//	Algorithms for Random Number Generation
//	Melissa E. O’Neill, Harvey Mudd College
//	http://www.pcg-random.org/pdf/toms-oneill-pcg-family-v1.02.pdf
//
// The generator here is the congruential generator PCG XSL RR 128/64 (LCG)
// as found in the software available at http://www.pcg-random.org/.
// It has period 2^128 with 128 bits of state, producing 64-bit values.
// Is state is represented by two uint64 words.
type PCGSource struct {
	low  uint64
	high uint64
}

const (
	maxUint32 = (1 << 32) - 1

	multiplier = 47026247687942121848144207491837523525
	mulHigh    = multiplier >> 64
	mulLow     = multiplier & maxUint64

	increment = 117397592171526113268558934119004209487
	incHigh   = increment >> 64
	incLow    = increment & maxUint64

	// TODO: Use these?
	initializer = 245720598905631564143578724636268694099
	initHigh    = initializer >> 64
	initLow     = initializer & maxUint64
)

// Seed uses the provided seed value to initialize the generator to a deterministic state.
func (pcg *PCGSource) Seed(seed uint64) {
	pcg.low = seed
	pcg.high = seed // TODO: What is right?
}

// Uint64 returns a pseudo-random 64-bit unsigned integer as a uint64.
func (pcg *PCGSource) Uint64() uint64 {
	pcg.multiply()
	pcg.add()
	// XOR high and low 64 bits together and rotate right by high 6 bits of state.
	return bits.RotateLeft64(pcg.high^pcg.low, -int(pcg.high>>58))
}

func (pcg *PCGSource) add() {
	var carry uint64
	pcg.low, carry = bits.Add64(pcg.low, incLow, 0)
	pcg.high, _ = bits.Add64(pcg.high, incHigh, carry)
}

func (pcg *PCGSource) multiply() {
	hi, lo := bits.Mul64(pcg.low, mulLow)
	hi += pcg.high * mulLow
	hi += pcg.low * mulHigh
	pcg.low = lo
	pcg.high = hi
}

// MarshalBinary returns the binary representation of the current state of the generator.
func (pcg *PCGSource) MarshalBinary() ([]byte, error) {
	var buf [16]byte
	binary.BigEndian.PutUint64(buf[:8], pcg.high)
	binary.BigEndian.PutUint64(buf[8:], pcg.low)
	return buf[:], nil
}

// UnmarshalBinary sets the state of the generator to the state represented in data.
func (pcg *PCGSource) UnmarshalBinary(data []byte) error {
	if len(data) < 16 {
		return io.ErrUnexpectedEOF
	}
	pcg.low = binary.BigEndian.Uint64(data[8:])
	pcg.high = binary.BigEndian.Uint64(data[:8])
	return nil
}
