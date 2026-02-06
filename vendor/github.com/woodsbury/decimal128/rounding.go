package decimal128

import "fmt"

// Ceil returns the least integer value greater than or equal to d.
//
// Ceil is equivalent to:
//
//	d.Ceil(0)
func Ceil(d Decimal) Decimal {
	return d.Ceil(0)
}

// Floor returns the greatest integer value less than or equal to d.
//
// Floor is equivalent to:
//
//	d.Floor(0)
func Floor(d Decimal) Decimal {
	return d.Floor(0)
}

// Round returns the nearest integer, rounding half away from zero.
//
// Round is equivalent to:
//
//	d.Round(0, decimal128.ToNearestAway)
func Round(d Decimal) Decimal {
	return d.Round(0, ToNearestAway)
}

// Trunc returns the integer value of d.
//
// Trunc is equivalent to:
//
//	d.Round(0, decimal128.ToZero)
func Trunc(d Decimal) Decimal {
	return d.Round(0, ToZero)
}

// Ceil returns the least Decimal value greater than or equal to d that has no
// digits after the specified number of decimal places.
//
// The value of dp affects how many digits after the decimal point the Decimal
// would have if it were printed in decimal notation (for example, by the '%f'
// verb in Format). It can be zero to return an integer, and can also be
// negative to round off digits before the decimal point.
//
// NaN and infinity values are left untouched.
func (d Decimal) Ceil(dp int) Decimal {
	if d.isSpecial() {
		return d
	}

	sig, exp := d.decompose()

	if sig[0]|sig[1] == 0 {
		return zero(d.Signbit())
	}

	dp = dp*-1 + exponentBias
	iexp := int(exp)

	if iexp >= dp {
		return d
	}

	if iexp < dp-maxDigits {
		if d.Signbit() {
			return zero(d.Signbit())
		}

		return compose(false, uint128{1, 0}, int16(dp))
	}

	var trunc int8

	for iexp < dp {
		var rem uint64
		sig, rem = sig.div10()

		if rem != 0 {
			trunc = 1
		}

		if sig[0]|sig[1] == 0 {
			iexp = dp
			break
		}

		iexp++
	}

	neg := d.Signbit()
	exp = int16(iexp)

	if !neg {
		for trunc != 0 {
			sig = sig.add64(1)
			trunc = 0

			if sig[1] > 0x0002_7fff_ffff_ffff {
				var rem uint64
				sig, rem = sig.div10()

				if rem != 0 {
					trunc = 1
				}

				exp++
			}
		}
	}

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Floor returns the greatest Decimal value less than or equal to d that has no
// digits after the specified number of decimal places.
//
// The value of dp affects how many digits after the decimal point the Decimal
// would have if it were printed in decimal notation (for example, by the '%f'
// verb in Format). It can be zero to return an integer, and can also be
// negative to round off digits before the decimal point.
//
// NaN and infinity values are left untouched.
func (d Decimal) Floor(dp int) Decimal {
	if d.isSpecial() {
		return d
	}

	sig, exp := d.decompose()

	if sig[0]|sig[1] == 0 {
		return zero(d.Signbit())
	}

	dp = dp*-1 + exponentBias
	iexp := int(exp)

	if iexp >= dp {
		return d
	}

	if iexp < dp-maxDigits {
		if !d.Signbit() {
			return zero(d.Signbit())
		}

		return compose(true, uint128{1, 0}, int16(dp))
	}

	var trunc int8

	for iexp < dp {
		var rem uint64
		sig, rem = sig.div10()

		if rem != 0 {
			trunc = 1
		}

		if sig[0]|sig[1] == 0 {
			iexp = dp
			break
		}

		iexp++
	}

	neg := d.Signbit()
	exp = int16(iexp)

	if neg {
		for trunc != 0 {
			sig = sig.add64(1)
			trunc = 0

			if sig[1] > 0x0002_7fff_ffff_ffff {
				var rem uint64
				sig, rem = sig.div10()

				if rem != 0 {
					trunc = 1
				}

				exp++
			}
		}
	}

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Round rounds (or quantises) a Decimal value to the specified number of
// decimal places using the rounding mode provided.
//
// The value of dp affects how many digits after the decimal point the Decimal
// would have if it were printed in decimal notation (for example, by the '%f'
// verb in Format). It can be zero to round off all digits after the decimal
// point and return an integer, and can also be negative to round off digits
// before the decimal point.
//
// NaN and infinity values are left untouched.
func (d Decimal) Round(dp int, mode RoundingMode) Decimal {
	if d.isSpecial() {
		return d
	}

	sig, exp := d.decompose()

	if sig[0]|sig[1] == 0 {
		return zero(d.Signbit())
	}

	dp = dp*-1 + exponentBias
	iexp := int(exp)

	if iexp >= dp {
		return d
	}

	if iexp < dp-maxDigits {
		return zero(d.Signbit())
	}

	var trunc int8
	var digit uint64

	for iexp < dp {
		if digit != 0 {
			trunc = 1
		}

		sig, digit = sig.div10()

		if sig[0]|sig[1]|digit == 0 {
			return zero(d.Signbit())
		}

		iexp++
	}

	neg := d.Signbit()
	sig, exp = mode.round(false, neg, sig, int16(iexp), trunc, digit)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// RoundingMode determines how a Decimal value is rounded when the result of an
// operation is greater than the format can hold.
type RoundingMode uint8

const (
	ToNearestEven RoundingMode = iota // == IEEE 754 roundTiesToEven
	ToNearestAway                     // == IEEE 754 roundTiesToAway
	ToZero                            // == IEEE 754 roundTowardZero
	AwayFromZero                      // no IEEE 754 equivalent
	ToNegativeInf                     // == IEEE 754 roundTowardNegative
	ToPositiveInf                     // == IEEE 754 roundTowardPositive
)

// String returns a string representation of the rounding mode.
func (rm RoundingMode) String() string {
	switch rm {
	case ToNearestEven:
		return "ToNearestEven"
	case ToNearestAway:
		return "ToNearestAway"
	case ToZero:
		return "ToZero"
	case AwayFromZero:
		return "AwayFromZero"
	case ToNegativeInf:
		return "ToNegativeInf"
	case ToPositiveInf:
		return "ToPositiveInf"
	default:
		return fmt.Sprintf("RoundingMode(%d)", uint8(rm))
	}
}

func (rm RoundingMode) reduce256(neg bool, sig256 uint256, exp int16, trunc int8) (uint128, int16) {
	for sig256[3] > 0 {
		var rem uint64
		sig256, rem = sig256.div1e19()
		exp += 19

		if rem != 0 {
			trunc = 1
		}
	}

	sig192 := uint192{sig256[0], sig256[1], sig256[2]}

	if sig192[2] > 10000 {
		var rem uint64
		sig192, rem = sig192.div1e8()
		exp += 8

		if rem != 0 {
			trunc = 1
		}
	}

	for sig192[2] > 0 {
		var rem uint64
		sig192, rem = sig192.div10000()
		exp += 4

		if rem != 0 {
			trunc = 1
		}
	}

	sig := uint128{sig192[0], sig192[1]}

	var digit uint64

	if sig[1] > 0x09c4_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div10000()
		exp += 4

		if rem != 0 {
			digit = rem / 1000

			if rem%1000 != 0 {
				trunc = 1
			}
		}
	} else if sig[1] > 0x00fa_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div1000()
		exp += 3

		if rem != 0 {
			digit = rem / 100

			if rem%100 != 0 {
				trunc = 1
			}
		}
	} else if sig[1] > 0x0019_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div100()
		exp += 2

		if rem != 0 {
			digit = rem / 10

			if rem%10 != 0 {
				trunc = 1
			}
		}
	}

	for sig[1] > 0x0002_7fff_ffff_ffff {
		if digit != 0 {
			trunc = 1
		}

		sig, digit = sig.div10()
		exp++
	}

	for exp < minBiasedExponent {
		if digit != 0 {
			trunc = 1
		}

		sig, digit = sig.div10()

		if sig[0]|sig[1]|digit == 0 {
			trunc = 0
			digit = 0
			exp = 0
			break
		}

		exp++
	}

	for exp > maxBiasedExponent && sig[1] < 0x0002_7fff_ffff_ffff {
		tmp := sig.mul64(10)

		if tmp[1] <= 0x0002_7fff_ffff_ffff {
			sig = tmp
			exp--
		} else {
			break
		}
	}

	return rm.round(true, neg, sig, exp, trunc, digit)
}

func (rm RoundingMode) reduce192(neg bool, sig192 uint192, exp int16, trunc int8) (uint128, int16) {
	if sig192[2] > 10000 {
		var rem uint64
		sig192, rem = sig192.div1e8()
		exp += 8

		if rem != 0 {
			trunc = 1
		}
	}

	for sig192[2] > 0 {
		var rem uint64
		sig192, rem = sig192.div10000()
		exp += 4

		if rem != 0 {
			trunc = 1
		}
	}

	sig := uint128{sig192[0], sig192[1]}

	var digit uint64

	if sig[1] > 0x09c4_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div10000()
		exp += 4

		if rem != 0 {
			digit = rem / 1000

			if rem%1000 != 0 {
				trunc = 1
			}
		}
	} else if sig[1] > 0x00fa_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div1000()
		exp += 3

		if rem != 0 {
			digit = rem / 100

			if rem%100 != 0 {
				trunc = 1
			}
		}
	} else if sig[1] > 0x0019_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div100()
		exp += 2

		if rem != 0 {
			digit = rem / 10

			if rem%10 != 0 {
				trunc = 1
			}
		}
	}

	for sig[1] > 0x0002_7fff_ffff_ffff {
		if digit != 0 {
			trunc = 1
		}

		sig, digit = sig.div10()
		exp++
	}

	for exp < minBiasedExponent {
		if digit != 0 {
			trunc = 1
		}

		sig, digit = sig.div10()

		if sig[0]|sig[1]|digit == 0 {
			trunc = 0
			digit = 0
			exp = 0
			break
		}

		exp++
	}

	for exp > maxBiasedExponent && sig[1] < 0x0002_7fff_ffff_ffff {
		tmp := sig.mul64(10)

		if tmp[1] <= 0x0002_7fff_ffff_ffff {
			sig = tmp
			exp--
		} else {
			break
		}
	}

	return rm.round(true, neg, sig, exp, trunc, digit)
}

func (rm RoundingMode) reduce128(neg bool, sig uint128, exp int16, trunc int8) (uint128, int16) {
	var digit uint64

	if sig[1] > 0x09c4_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div10000()
		exp += 4

		if rem != 0 {
			digit = rem / 1000

			if rem%1000 != 0 {
				trunc = 1
			}
		}
	} else if sig[1] > 0x00fa_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div1000()
		exp += 3

		if rem != 0 {
			digit = rem / 100

			if rem%100 != 0 {
				trunc = 1
			}
		}
	} else if sig[1] > 0x0019_0000_0000_0000 {
		var rem uint64
		sig, rem = sig.div100()
		exp += 2

		if rem != 0 {
			digit = rem / 10

			if rem%10 != 0 {
				trunc = 1
			}
		}
	}

	for sig[1] > 0x0002_7fff_ffff_ffff {
		if digit != 0 {
			trunc = 1
		}

		sig, digit = sig.div10()
		exp++
	}

	for exp < minBiasedExponent {
		if digit != 0 {
			trunc = 1
		}

		sig, digit = sig.div10()

		if sig[0]|sig[1]|digit == 0 {
			trunc = 0
			digit = 0
			exp = 0
			break
		}

		exp++
	}

	for exp > maxBiasedExponent && sig[1] < 0x0002_7fff_ffff_ffff {
		tmp := sig.mul64(10)

		if tmp[1] <= 0x0002_7fff_ffff_ffff {
			sig = tmp
			exp--
		} else {
			break
		}
	}

	return rm.round(true, neg, sig, exp, trunc, digit)
}

func (rm RoundingMode) reduce64(neg bool, sig64 uint64, exp int16) (uint128, int16) {
	var trunc int8
	var digit uint64

	for exp < minBiasedExponent {
		if digit != 0 {
			trunc = 1
		}

		digit = sig64 % 10
		sig64 = sig64 / 10

		if sig64|digit == 0 {
			trunc = 0
			digit = 0
			exp = 0
			break
		}

		exp++
	}

	sig := uint128{sig64, 0}

	for exp > maxBiasedExponent && sig[1] < 0x0002_7fff_ffff_ffff {
		tmp := sig.mul64(10)

		if tmp[1] <= 0x0002_7fff_ffff_ffff {
			sig = tmp
			exp--
		} else {
			break
		}
	}

	return rm.round(true, neg, sig, exp, trunc, digit)
}

func (rm RoundingMode) round(shift, neg bool, sig uint128, exp int16, trunc int8, digit uint64) (uint128, int16) {
	for {
		var adjust int
		switch rm {
		case ToNearestEven:
			if trunc == 1 {
				if digit >= 5 {
					adjust = 1
				}
			} else if trunc == -1 {
				if digit > 5 {
					adjust = 1
				}
			} else {
				if digit > 5 {
					adjust = 1
				} else if digit == 5 {
					if sig[0]%2 != 0 {
						adjust = 1
					}
				}
			}
		case ToNearestAway:
			if digit >= 5 {
				adjust = 1
			}
		case ToZero:
			if trunc == -1 && digit == 0 {
				adjust = -1
			}
		case AwayFromZero:
			if trunc == 1 || digit != 0 {
				adjust = 1
			}
		case ToPositiveInf:
			if neg {
				if trunc == -1 && digit == 0 {
					adjust = -1
				}
			} else if trunc == 1 || digit != 0 {
				adjust = 1
			}
		case ToNegativeInf:
			if neg {
				if trunc == 1 || digit != 0 {
					adjust = 1
				}
			} else if trunc == -1 && digit == 0 {
				adjust = -1
			}
		}

		if adjust != 0 {
			var tsig uint128
			if adjust == 1 {
				if shift {
					if sig[0]|sig[1] != 0 {
						if exp >= minBiasedExponent+19 && sig[1] == 0 {
							sig = sig.mul64(10_000_000_000_000_000_000)
							exp -= 19
						}

						for exp > minBiasedExponent && sig[1] < 0x0002_7fff_ffff_ffff/10 {
							sig = sig.mul64(10)
							exp--
						}
					} else {
						exp = minBiasedExponent
					}

					shift = false
				}

				tsig = sig.add64(1)
			} else {
				if shift {
					if sig[0]|sig[1] != 0 {
						if exp >= minBiasedExponent+19 && sig[1] == 0 {
							sig = sig.mul64(10_000_000_000_000_000_000)
							exp -= 19
						}

						for exp > minBiasedExponent && sig[1] <= 0x0002_7fff_ffff_ffff/10 {
							sig = sig.mul64(10)
							exp--
						}
					} else {
						exp = minBiasedExponent
					}

					shift = false
				}

				tsig = sig.sub64(1)
			}

			if tsig[1] > 0x0002_7fff_ffff_ffff {
				if digit != 0 {
					trunc = 1
				}

				sig, digit = sig.div10()
				exp++
				continue
			}

			sig = tsig
		}

		return sig, exp
	}
}

// DefaultRoundingMode is the rounding mode used by any methods where an
// alternate rounding mode isn't provided.
var DefaultRoundingMode RoundingMode = ToNearestEven
