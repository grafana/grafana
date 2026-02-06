package decimal

import (
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"math/big"
	"strings"
)

// Decimal represents decimal type in the Microsoft Open Specifications: http://msdn.microsoft.com/en-us/library/ee780893.aspx
type Decimal struct {
	integer  [4]uint32 // Little-endian
	positive bool
	prec     uint8
	scale    uint8
}

var (
	scaletblflt64 [39]float64
	int10         big.Int
	int1e5        big.Int
)

func init() {
	var acc float64 = 1
	for i := 0; i <= 38; i++ {
		scaletblflt64[i] = acc
		acc *= 10
	}

	int10.SetInt64(10)
	int1e5.SetInt64(1e5)
}

const autoScale = 100

// SetInteger sets the ind'th element in the integer array
func (d *Decimal) SetInteger(integer uint32, ind uint8) {
	d.integer[ind] = integer
}

// SetPositive sets the positive member
func (d *Decimal) SetPositive(positive bool) {
	d.positive = positive
}

// SetPrec sets the prec member
func (d *Decimal) SetPrec(prec uint8) {
	d.prec = prec
}

// SetScale sets the scale member
func (d *Decimal) SetScale(scale uint8) {
	d.scale = scale
}

// IsPositive returns true if the Decimal is positive
func (d *Decimal) IsPositive() bool {
	return d.positive
}

// ToFloat64 converts decimal to a float64
func (d Decimal) ToFloat64() float64 {
	val := float64(0)
	for i := 3; i >= 0; i-- {
		val *= 0x100000000
		val += float64(d.integer[i])
	}
	if !d.positive {
		val = -val
	}
	if d.scale != 0 {
		val /= scaletblflt64[d.scale]
	}
	return val
}

// BigInt converts decimal to a bigint
func (d Decimal) BigInt() big.Int {
	bytes := make([]byte, 16)
	binary.BigEndian.PutUint32(bytes[0:4], d.integer[3])
	binary.BigEndian.PutUint32(bytes[4:8], d.integer[2])
	binary.BigEndian.PutUint32(bytes[8:12], d.integer[1])
	binary.BigEndian.PutUint32(bytes[12:16], d.integer[0])
	var x big.Int
	x.SetBytes(bytes)
	if !d.positive {
		x.Neg(&x)
	}
	return x
}

// Bytes converts decimal to a scaled byte slice
func (d Decimal) Bytes() []byte {
	x := d.BigInt()
	return ScaleBytes(x.String(), d.scale)
}

// UnscaledBytes converts decimal to a unscaled byte slice
func (d Decimal) UnscaledBytes() []byte {
	x := d.BigInt()
	return x.Bytes()
}

// String converts decimal to a string
func (d Decimal) String() string {
	return string(d.Bytes())
}

// Float64ToDecimal converts float64 to decimal
func Float64ToDecimal(f float64) (Decimal, error) {
	return Float64ToDecimalScale(f, autoScale)
}

// Float64ToDecimalScale converts float64 to decimal; user can specify the scale
func Float64ToDecimalScale(f float64, scale uint8) (Decimal, error) {
	var dec Decimal
	if math.IsNaN(f) {
		return dec, errors.New("NaN")
	}
	if math.IsInf(f, 0) {
		return dec, errors.New("Infinity can't be converted to decimal")
	}
	dec.positive = f >= 0
	if !dec.positive {
		f = math.Abs(f)
	}
	if f > 3.402823669209385e+38 {
		return dec, errors.New("Float value is out of range")
	}
	dec.prec = 20
	var integer float64
	for dec.scale = 0; dec.scale <= scale; dec.scale++ {
		integer = f * scaletblflt64[dec.scale]
		_, frac := math.Modf(integer)
		if frac == 0 && scale == autoScale {
			break
		}
	}
	for i := 0; i < 4; i++ {
		mod := math.Mod(integer, 0x100000000)
		integer -= mod
		integer /= 0x100000000
		dec.integer[i] = uint32(mod)
		if mod-math.Trunc(mod) >= 0.5 {
			dec.integer[i] = uint32(mod) + 1
		}
	}
	return dec, nil
}

// Int64ToDecimalScale converts float64 to decimal; user can specify the scale
func Int64ToDecimalScale(v int64, scale uint8) Decimal {
	positive := v >= 0
	if !positive {
		if v == math.MinInt64 {
			// Special case - can't negate
			return Decimal{
				integer:  [4]uint32{0, 0x80000000, 0, 0},
				positive: false,
				prec:     20,
				scale:    0,
			}
		}
		v = -v
	}
	return Decimal{
		integer:  [4]uint32{uint32(v), uint32(v >> 32), 0, 0},
		positive: positive,
		prec:     20,
		scale:    scale,
	}
}

// StringToDecimalScale converts string to decimal
func StringToDecimalScale(v string, outScale uint8) (Decimal, error) {
	var r big.Int
	var unscaled string
	var inScale int

	point := strings.LastIndexByte(v, '.')
	if point == -1 {
		inScale = 0
		unscaled = v
	} else {
		inScale = len(v) - point - 1
		unscaled = v[:point] + v[point+1:]
	}
	if inScale > math.MaxUint8 {
		return Decimal{}, fmt.Errorf("can't parse %q as a decimal number: scale too large", v)
	}

	_, ok := r.SetString(unscaled, 10)
	if !ok {
		return Decimal{}, fmt.Errorf("can't parse %q as a decimal number", v)
	}

	if inScale > int(outScale) {
		return Decimal{}, fmt.Errorf("can't parse %q as a decimal number: scale %d is larger than the scale %d of the target column", v, inScale, outScale)
	}
	for inScale < int(outScale) {
		if int(outScale)-inScale >= 5 {
			r.Mul(&r, &int1e5)
			inScale += 5
		} else {
			r.Mul(&r, &int10)
			inScale++
		}
	}

	bytes := r.Bytes()
	if len(bytes) > 16 {
		return Decimal{}, fmt.Errorf("can't parse %q as a decimal number: precision too large", v)
	}
	var out [4]uint32
	for i, b := range bytes {
		pos := len(bytes) - i - 1
		out[pos/4] += uint32(b) << uint(pos%4*8)
	}
	return Decimal{
		integer:  out,
		positive: r.Sign() >= 0,
		prec:     20,
		scale:    uint8(inScale),
	}, nil
}

// ScaleBytes converts a stringified decimal to a scaled byte slice
func ScaleBytes(s string, scale uint8) []byte {
	z := make([]byte, 0, len(s)+1)
	if s[0] == '-' || s[0] == '+' {
		z = append(z, byte(s[0]))
		s = s[1:]
	}
	pos := len(s) - int(scale)
	if pos <= 0 {
		z = append(z, byte('0'))
	} else if pos > 0 {
		z = append(z, []byte(s[:pos])...)
	}
	if scale > 0 {
		z = append(z, byte('.'))
		for pos < 0 {
			z = append(z, byte('0'))
			pos++
		}
		z = append(z, []byte(s[pos:])...)
	}
	return z
}
