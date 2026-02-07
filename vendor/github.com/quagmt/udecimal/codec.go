package udecimal

import (
	"bytes"
	"database/sql"
	"database/sql/driver"
	"encoding"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math/big"
	"math/bits"
	"net/url"
	"unsafe"
)

const (
	// maxDigitU64 is the maximum digits of a number
	// that can be safely stored in a uint64.
	maxDigitU64 = 19

	// maxDecimalStringU128 is the maximum length of a decimal string
	// that can be safely stored in a u128. (including decimal point, sign and quotes)
	// 43 bytes = max(u128) + 2 (for quotes) + 1 (for sign) + 1 (for dot)
	maxDecimalStringU128 = 43
)

var (
	_ fmt.Stringer               = (*Decimal)(nil)
	_ sql.Scanner                = (*Decimal)(nil)
	_ driver.Valuer              = (*Decimal)(nil)
	_ encoding.TextMarshaler     = (*Decimal)(nil)
	_ encoding.TextUnmarshaler   = (*Decimal)(nil)
	_ encoding.BinaryMarshaler   = (*Decimal)(nil)
	_ encoding.BinaryUnmarshaler = (*Decimal)(nil)
	_ json.Marshaler             = (*Decimal)(nil)
	_ json.Unmarshaler           = (*Decimal)(nil)
)

// String returns the string representation of the decimal.
// Trailing zeros will be removed.
func (d Decimal) String() string {
	if d.IsZero() {
		return "0"
	}

	if !d.coef.overflow() {
		return d.stringU128(true, false)
	}

	return d.stringBigInt(true)
}

// StringFixed returns the string representation of the decimal with fixed prec.
// Trailing zeros will not be removed.
// If the decimal is integer, the fractional part will be padded with zeros.
// If prec is smaller then d.prec, the number will stay the same as the original.
//
// Example:
//
//	1.23.StringFixed(4) -> 1.2300
//	-1.23.StringFixed(4) -> -1.2300
//	5.StringFixed(2) -> 5.00
//	5.123.StringFixed(2) -> 5.123
func (d Decimal) StringFixed(prec uint8) string {
	d1 := d.rescale(prec)

	if prec < d1.prec {
		return d1.String()
	}

	if !d1.coef.overflow() {
		return d1.stringU128(false, false)
	}

	return d1.stringBigInt(false)
}

func (d Decimal) stringBigInt(trimTrailingZeros bool) string {
	str := d.coef.bigInt.String()
	dExpInt := int(d.prec)
	if dExpInt > len(str) {
		// pad with zeros
		l := len(str)
		for i := 0; i < dExpInt-l; i++ {
			str = "0" + str
		}
	}

	var intPart, fractionalPart string
	intPart = str[:len(str)-dExpInt]
	fractionalPart = str[len(str)-dExpInt:]

	if trimTrailingZeros {
		i := len(fractionalPart) - 1
		for ; i >= 0; i-- {
			if fractionalPart[i] != '0' {
				break
			}
		}
		fractionalPart = fractionalPart[:i+1]
	}

	number := intPart
	if number == "" {
		number = "0"
	}

	if len(fractionalPart) > 0 {
		number += "." + fractionalPart
	}

	if d.neg {
		return "-" + number
	}

	return number
}

func (d Decimal) stringU128(trimTrailingZeros bool, withQuote bool) string {
	// Some important notes:
	// 1. If the size of buffer is already known at compile time, the compiler can allocate it on the stack (if it's small enough)
	// and it will only be moved to the heap when string() is called.
	// 2. When calling string(), the actual number of bytes used will be calculated. So we can safely use a large buffer
	// without worrying it will affect the memory usage. It will be optimized anyway.
	// 3. The actual bytes allocated is somehow weird, for example:
	//   - make([]byte,5) --> allocate 5 bytes
	//   - make([]byte,6) --> allocate 8 bytes
	//   - make([]byte,17) --> allocate 24 bytes
	//   - make([]byte,33) --> allocate 48 bytes
	// So, trying to optimize the total bytes allocated by pre-defining the capacity is not worth it
	// cuz the compiler optimizes it differently. My assumption is 16-byte alignment optimization in the compiler.
	// However, I haven't found where this behavior is documented, just discovered it by testing.

	buf := make([]byte, 0, maxDecimalStringU128)
	buf = d.appendBuffer(buf, trimTrailingZeros, withQuote)
	return string(buf)
}

var (
	// lookup table for 00 -> 99
	table = [200]byte{
		0x30, 0x30, 0x30, 0x31, 0x30, 0x32, 0x30, 0x33, 0x30, 0x34, 0x30, 0x35,
		0x30, 0x36, 0x30, 0x37, 0x30, 0x38, 0x30, 0x39, 0x31, 0x30, 0x31, 0x31,
		0x31, 0x32, 0x31, 0x33, 0x31, 0x34, 0x31, 0x35, 0x31, 0x36, 0x31, 0x37,
		0x31, 0x38, 0x31, 0x39, 0x32, 0x30, 0x32, 0x31, 0x32, 0x32, 0x32, 0x33,
		0x32, 0x34, 0x32, 0x35, 0x32, 0x36, 0x32, 0x37, 0x32, 0x38, 0x32, 0x39,
		0x33, 0x30, 0x33, 0x31, 0x33, 0x32, 0x33, 0x33, 0x33, 0x34, 0x33, 0x35,
		0x33, 0x36, 0x33, 0x37, 0x33, 0x38, 0x33, 0x39, 0x34, 0x30, 0x34, 0x31,
		0x34, 0x32, 0x34, 0x33, 0x34, 0x34, 0x34, 0x35, 0x34, 0x36, 0x34, 0x37,
		0x34, 0x38, 0x34, 0x39, 0x35, 0x30, 0x35, 0x31, 0x35, 0x32, 0x35, 0x33,
		0x35, 0x34, 0x35, 0x35, 0x35, 0x36, 0x35, 0x37, 0x35, 0x38, 0x35, 0x39,
		0x36, 0x30, 0x36, 0x31, 0x36, 0x32, 0x36, 0x33, 0x36, 0x34, 0x36, 0x35,
		0x36, 0x36, 0x36, 0x37, 0x36, 0x38, 0x36, 0x39, 0x37, 0x30, 0x37, 0x31,
		0x37, 0x32, 0x37, 0x33, 0x37, 0x34, 0x37, 0x35, 0x37, 0x36, 0x37, 0x37,
		0x37, 0x38, 0x37, 0x39, 0x38, 0x30, 0x38, 0x31, 0x38, 0x32, 0x38, 0x33,
		0x38, 0x34, 0x38, 0x35, 0x38, 0x36, 0x38, 0x37, 0x38, 0x38, 0x38, 0x39,
		0x39, 0x30, 0x39, 0x31, 0x39, 0x32, 0x39, 0x33, 0x39, 0x34, 0x39, 0x35,
		0x39, 0x36, 0x39, 0x37, 0x39, 0x38, 0x39, 0x39,
	}
)

func (d Decimal) appendBuffer(inBuf []byte, trimTrailingZeros bool, withQuote bool) []byte {
	var (
		buf [maxDecimalStringU128]byte
		quo u128
		rem uint64
	)

	if d.prec == 0 {
		quo = d.coef.u128
	} else {
		quo, rem = d.coef.u128.QuoRem64(pow10[d.prec].lo) // max prec is 19, so we can safely use QuoRem64
	}

	prec := d.prec
	strLen := len(buf)
	n := len(buf) - 1

	if withQuote {
		// add quotes at the end
		buf[n] = '"'
		n--
		strLen--
	}

	if rem == 0 {
		// rem == 0, however, we still need to fill the fractional part with zeros
		// this applied to StringFixed() where trimTrailingZeros is false
		if !trimTrailingZeros && prec > 0 {
			for i := n; i > strLen-1-int(prec); i-- {
				buf[i] = '0'
			}

			buf[strLen-int(prec)-1] = '.'
			n = strLen - int(prec) - 2
		}
	} else {
		// rem != 0, fill the fractional part
		if trimTrailingZeros {
			// remove trailing zeros, e.g. 1.2300 -> 1.23
			// both prec and rem will be adjusted
			zeros := getTrailingZeros64(rem)
			rem /= pow10[zeros].lo
			prec -= zeros
		}

		// fill fractional part
		for rem >= 100 {
			r := rem % 100 * 2
			rem /= 100
			buf[n] = table[r+1]
			buf[n-1] = table[r]
			n -= 2
		}

		if rem >= 10 {
			r := rem * 2
			buf[n] = table[r+1]
			buf[n-1] = table[r]
			n -= 2
		} else {
			buf[n] = byte(rem) + '0'
			n--
		}

		// fill remaining zeros
		for i := n; i > strLen-1-int(prec); i-- {
			buf[i] = '0'
		}

		buf[strLen-int(prec)-1] = '.'
		n = strLen - int(prec) - 2
	}

	if quo.IsZero() {
		// quo is zero, we need to print at least one zero
		buf[n] = '0'
		n--
	} else {
		for quo.Cmp64(100) >= 0 {
			q, r := quoRem64(quo, 100)
			r = r * 2
			quo = q

			buf[n] = table[r+1]
			buf[n-1] = table[r]
			n -= 2
		}

		if quo.Cmp64(10) >= 0 {
			buf[n] = table[quo.lo*2+1]
			buf[n-1] = table[quo.lo*2]
			n -= 2
		} else {
			buf[n] = byte(quo.lo) + '0'
			n--
		}
	}

	if d.neg {
		buf[n] = '-'
		n--
	}

	if withQuote {
		// add quotes at the beginning
		buf[n] = '"'
		n--
	}

	result := buf[n+1:]

	return append(inBuf, result...)
}

func quoRem64(u u128, v uint64) (q u128, r uint64) {
	if u.hi == 0 {
		return u128{lo: u.lo / v}, u.lo % v
	}

	return u.QuoRem64(v)
}

func unsafeStringToBytes(s string) []byte {
	return unsafe.Slice(unsafe.StringData(s), len(s))
}

// MarshalJSON implements the [json.Marshaler] interface.
func (d Decimal) MarshalJSON() ([]byte, error) {
	if !d.coef.overflow() {
		return unsafeStringToBytes(d.stringU128(true, true)), nil
	}

	return []byte(`"` + d.stringBigInt(true) + `"`), nil
}

// nullValue represents the JSON null value.
var nullValue = []byte("null")

// UnmarshalJSON implements the [json.Unmarshaler] interface.
func (d *Decimal) UnmarshalJSON(data []byte) error {
	// Remove quotes if they exist.
	if len(data) >= 2 && data[0] == '"' && data[len(data)-1] == '"' {
		data = data[1 : len(data)-1]
	}

	// null value.
	if bytes.Equal(data, nullValue) {
		return nil
	}

	return d.UnmarshalText(data)
}

// MarshalText implements the [encoding.TextMarshaler] interface.
func (d Decimal) MarshalText() ([]byte, error) {
	return d.AppendText(nil)
}

// AppendText implements the [encoding.TextAppender] interface.
// The result will not be quoted like MarshalJSON.
func (d Decimal) AppendText(b []byte) ([]byte, error) {
	if !d.coef.overflow() {
		return d.appendBuffer(b, true, false), nil
	}

	// this is not worth optimizing since stringBigInt is a very rare case
	return append(b, d.stringBigInt(true)...), nil
}

// UnmarshalText implements the [encoding.TextUnmarshaler] interface.
func (d *Decimal) UnmarshalText(data []byte) error {
	var err error
	*d, err = parseBytes(data)
	if err != nil {
		return fmt.Errorf("error unmarshaling to Decimal: %w", err)
	}

	return err
}

// MarshalBinary implements [encoding.BinaryMarshaler] interface with custom binary format.
//
//	Binary format: [overflow + neg] [prec] [total bytes] [coef]
//
//	 example 1: -1.2345
//	 1st byte: 0b0001_0000 (overflow = true, neg = false)
//	 2nd byte: 0b0000_0100 (prec = 4)
//	 3rd byte: 0b0000_1101 (total bytes = 11)
//	 4th-11th bytes: 0x0000_0000_0000_3039 (coef = 12345, only stores the coef.lo part)
//
//	 example 2: 1234567890123456789.1234567890123456789
//	 1st byte: 0b0000_0000 (overflow = false, neg = false)
//	 2nd byte: 0b0001_0011 (prec = 19)
//	 3rd byte: 0b0001_0011 (total bytes = 19)
//	 4th-11th bytes: 0x0949_b0f6_f002_3313 (coef.hi)
//	 12th-19th bytes: 0xd3b5_05f9_b5f1_8115 (coef.lo)
func (d Decimal) MarshalBinary() ([]byte, error) {
	return d.AppendBinary(nil)
}

// AppendBinary implements [encoding.BinaryAppender] interface.
func (d Decimal) AppendBinary(b []byte) ([]byte, error) {
	if !d.coef.overflow() {
		return d.appendBinaryU128(b)
	}

	return d.appendBinaryBigInt(b)
}

func (d Decimal) appendBinaryU128(input []byte) ([]byte, error) {
	coef := d.coef.u128

	var (
		buf []byte
		neg uint8
	)

	if d.neg {
		neg = 1
	}

	if coef.hi == 0 {
		buf = make([]byte, 11)
		buf[2] = 11
		copyUint64ToBytes(buf[3:], coef.lo)
	} else {
		buf = make([]byte, 19)
		buf[2] = 19
		copyUint64ToBytes(buf[3:], coef.hi)
		copyUint64ToBytes(buf[11:], coef.lo)
	}

	buf[0] = neg
	buf[1] = d.prec

	return append(input, buf...), nil
}

func (d Decimal) appendBinaryBigInt(input []byte) ([]byte, error) {
	var neg int
	if d.neg {
		neg = 1
	}

	if d.coef.bigInt == nil {
		return nil, ErrInvalidBinaryData
	}

	words := d.coef.bigInt.Bits()
	totalBytes := 3 + len(words)*(bits.UintSize/8)
	buf := make([]byte, totalBytes)

	// overflow + neg with overflow = true (always 1)
	buf[0] = byte(1<<4 | neg)
	buf[1] = byte(d.prec)
	buf[2] = byte(totalBytes)
	d.coef.bigInt.FillBytes(buf[3:])

	return append(input, buf...), nil
}

func copyUint64ToBytes(b []byte, n uint64) {
	// use big endian to make it consistent with big.Int.FillBytes, which also uses big endian
	binary.BigEndian.PutUint64(b, n)
}

func (d *Decimal) UnmarshalBinary(data []byte) error {
	if len(data) < 3 {
		return ErrInvalidBinaryData
	}

	overflow := data[0] >> 4 & 1
	if overflow == 0 {
		return d.unmarshalBinaryU128(data)
	}

	return d.unmarshalBinaryBigInt(data)
}

func (d *Decimal) unmarshalBinaryU128(data []byte) error {
	d.neg = data[0]&1 == 1
	d.prec = data[1]

	totalBytes := data[2]
	if int(totalBytes) != len(data) {
		return ErrInvalidBinaryData
	}

	coef := u128{}
	switch totalBytes {
	case 11:
		coef.lo = binary.BigEndian.Uint64(data[3:])
	case 19:
		coef.hi = binary.BigEndian.Uint64(data[3:])
		coef.lo = binary.BigEndian.Uint64(data[11:])
	default:
		return ErrInvalidBinaryData
	}

	d.coef.u128 = coef
	return nil
}

func (d *Decimal) unmarshalBinaryBigInt(data []byte) error {
	d.neg = data[0]&1 == 1
	d.prec = data[1]

	totalBytes := data[2]
	if int(totalBytes) != len(data) {
		return ErrInvalidBinaryData
	}

	d.coef.bigInt = new(big.Int).SetBytes(data[3:totalBytes])
	return nil
}

// Scan implements [sql.Scanner] interface.
//
// [sql.Scanner]: https://pkg.go.dev/database/sql#Scanner
func (d *Decimal) Scan(src any) error {
	var err error
	switch v := src.(type) {
	case []byte:
		*d, err = parseBytes(v)
	case string:
		*d, err = Parse(v)
	case uint64:
		*d, err = NewFromUint64(v, 0)
	case int64:
		*d, err = NewFromInt64(v, 0)
	case int:
		*d, err = NewFromInt64(int64(v), 0)
	case int32:
		*d, err = NewFromInt64(int64(v), 0)
	case float64:
		*d, err = NewFromFloat64(v)
	case nil:
		err = fmt.Errorf("can't scan nil to Decimal")
	default:
		err = fmt.Errorf("can't scan %T to Decimal: %T is not supported", src, src)
	}

	return err
}

// Value implements [driver.Valuer] interface.
//
// [driver.Valuer]: https://pkg.go.dev/database/sql/driver#Valuer
func (d Decimal) Value() (driver.Value, error) {
	return d.String(), nil
}

// EncodeValues implements the [query.Encoder] interface by the go-querystring package.
//
// [query.Encoder]: https://pkg.go.dev/github.com/google/go-querystring/query#Encoder
func (d Decimal) EncodeValues(key string, v *url.Values) error {
	v.Set(key, d.String())
	return nil
}

// NullDecimal is a nullable Decimal.
type NullDecimal struct {
	Decimal Decimal
	Valid   bool
}

// Scan implements [sql.Scanner] interface.
//
// [sql.Scanner]: https://pkg.go.dev/database/sql#Scanner
func (d *NullDecimal) Scan(src any) error {
	if src == nil {
		d.Decimal, d.Valid = Decimal{}, false
		return nil
	}

	var err error
	switch v := src.(type) {
	case []byte:
		d.Decimal, err = parseBytes(v)
	case string:
		d.Decimal, err = Parse(v)
	case uint64:
		d.Decimal, err = NewFromUint64(v, 0)
	case int64:
		d.Decimal, err = NewFromInt64(v, 0)
	case int:
		d.Decimal, err = NewFromInt64(int64(v), 0)
	case int32:
		d.Decimal, err = NewFromInt64(int64(v), 0)
	case float64:
		d.Decimal, err = NewFromFloat64(v)
	default:
		err = fmt.Errorf("can't scan %T to Decimal: %T is not supported", src, src)
	}

	d.Valid = err == nil
	return err
}

// Value implements the [driver.Valuer] interface.
//
// [driver.Valuer]: https://pkg.go.dev/database/sql/driver#Valuer
func (d NullDecimal) Value() (driver.Value, error) {
	if !d.Valid {
		return nil, nil
	}

	return d.Decimal.String(), nil
}
