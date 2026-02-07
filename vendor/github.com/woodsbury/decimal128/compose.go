package decimal128

import (
	"math/big"
	"strconv"
)

// Compose sets d to the value represented by the parts provided as arguments.
// The arguments consist of:
//   - a byte form value that should be set to 0 for finite values, 1 for
//     infinite values, or 2 for values which are NaN
//   - a bool value that should be set to true when the value is negative,
//     false otherwise
//   - a byte slice that should be set to the significand of the value as a big
//     endian integer
//   - an int32 exponent
//
// If the value represented by the parts in the arguments are outside the range
// of a Decimal an error is returned. Compose implements the composer interface
// used by the [database/sql] package to read and write decimal values.
func (d *Decimal) Compose(form byte, neg bool, sig []byte, exp int32) error {
	switch form {
	case 0: // finite
		i := 0
		l := len(sig)
		for ; i < l; i++ {
			if sig[i] != 0 {
				break
			}
		}

		if i == l {
			*d = zero(neg)
			return nil
		}

		sig = sig[i:]

		if len(sig) > 32 {
			if exp > maxUnbiasedExponent {
				return &composeRangeError{}
			}

			bigsig := new(big.Int)
			bigsig.SetBytes(sig)

			den := new(big.Int).SetUint64(10_000_000_000_000_000_000)
			rem := new(big.Int)

			for bigsig.BitLen() > 32*8 {
				bigsig.QuoRem(bigsig, den, rem)

				if rem.BitLen() != 0 {
					return &composeRangeError{}
				}

				exp += 19

				if exp > maxUnbiasedExponent {
					return &composeRangeError{}
				}
			}

			sig = bigsig.Bytes()
		}

		var sig128 uint128
		if l := len(sig); l > 16 {
			if exp > maxUnbiasedExponent {
				return &composeRangeError{}
			}

			var sig256 uint256
			sig256[0] = uint64(sig[0])

			for i := 1; i < l; i++ {
				sig256 = sig256.lsh(8)
				sig256[0] |= uint64(sig[i])
			}

			for sig256[3] > 0 {
				var rem uint64
				sig256, rem = sig256.div1e19()

				if rem != 0 {
					return &composeRangeError{}
				}

				exp += 19

				if exp > maxUnbiasedExponent {
					return &composeRangeError{}
				}
			}

			sig192 := uint192{sig256[0], sig256[1], sig256[2]}

			for sig192[2] > 0 {
				var rem uint64
				sig192, rem = sig192.div10000()

				if rem != 0 {
					return &composeRangeError{}
				}

				exp += 4

				if exp > maxUnbiasedExponent {
					return &composeRangeError{}
				}
			}

			sig128 = uint128{sig192[0], sig192[1]}
		} else {
			sig128[0] = uint64(sig[0])

			for i := 1; i < len(sig); i++ {
				sig128 = sig128.lsh(8)
				sig128[0] |= uint64(sig[i])
			}
		}

		for sig128[1] > 0x0002_7fff_ffff_ffff {
			var rem uint64
			sig128, rem = sig128.div10()

			if rem != 0 {
				return &composeRangeError{}
			}

			exp++

			if exp > maxUnbiasedExponent {
				return &composeRangeError{}
			}
		}

		if exp < minUnbiasedExponent-maxDigits {
			return &composeRangeError{}
		}

		for exp < minUnbiasedExponent {
			var rem uint64
			sig128, rem = sig128.div10()

			if rem != 0 {
				return &composeRangeError{}
			}

			exp++
		}

		for exp > maxUnbiasedExponent {
			sig128 = sig128.mul64(10)

			if sig128[1] > 0x0002_7fff_ffff_ffff {
				return &composeRangeError{}
			}

			exp--
		}

		*d = compose(neg, sig128, int16(exp+exponentBias))
		return nil
	case 1: // infinite
		*d = inf(neg)
		return nil
	case 2: // NaN
		*d = nan(payloadOpCompose, 0, 0)
		return nil
	}

	return &composeFormError{form}
}

// Decompose returns the state of d in parts. The returned values consist of:
//   - a byte form value set to 0 when the value is finite, 1 when the value is
//     infinite, or 2 when the value is NaN
//   - a bool value set to true if the value is negative, false otherwise
//   - a byte slice containing the significand of the value as a big endian
//     integer
//   - an int32 exponent
//
// If the provided buf has sufficient capacity, it may be returned as the
// significand with the correct value and length set. Decompose implements the
// decomposer interface used by the [database/sql] package to read and write
// decimal values.
func (d Decimal) Decompose(buf []byte) (byte, bool, []byte, int32) {
	if d.IsNaN() {
		return 2, d.Signbit(), nil, 0
	}

	if d.isInf() {
		return 1, d.Signbit(), nil, 0
	}

	sig128, exp := d.decompose()

	if sig128[0]|sig128[1] == 0 {
		return 0, d.Signbit(), nil, 0
	}

	var sig []byte
	if cap(buf) >= 16 {
		sig = buf[:16]
	} else {
		sig = make([]byte, 16)
	}

	sig[0] = byte(sig128[1] >> 56)
	sig[1] = byte(sig128[1] >> 48)
	sig[2] = byte(sig128[1] >> 40)
	sig[3] = byte(sig128[1] >> 32)
	sig[4] = byte(sig128[1] >> 24)
	sig[5] = byte(sig128[1] >> 16)
	sig[6] = byte(sig128[1] >> 8)
	sig[7] = byte(sig128[1])

	sig[8] = byte(sig128[0] >> 56)
	sig[9] = byte(sig128[0] >> 48)
	sig[10] = byte(sig128[0] >> 40)
	sig[11] = byte(sig128[0] >> 32)
	sig[12] = byte(sig128[0] >> 24)
	sig[13] = byte(sig128[0] >> 16)
	sig[14] = byte(sig128[0] >> 8)
	sig[15] = byte(sig128[0])

	i := 0
	for ; i < len(sig); i++ {
		if sig[i] != 0 {
			break
		}
	}

	sig = sig[i:]

	return 0, d.Signbit(), sig, int32(exp) - exponentBias
}

type composeFormError struct {
	form byte
}

func (err *composeFormError) Error() string {
	return "unknown form " + strconv.FormatUint(uint64(err.form), 10)
}

type composeRangeError struct{}

func (err *composeRangeError) Error() string {
	return "value out of range"
}
