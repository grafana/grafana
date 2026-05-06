package pgtype

import (
	"bytes"
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/internal/pgio"
)

// PostgreSQL internal numeric storage uses 16-bit "digits" with base of 10,000
const nbase = 10_000

const (
	pgNumericNaN     = 0x00000000c0000000
	pgNumericNaNSign = 0xc000

	pgNumericPosInf     = 0x00000000d0000000
	pgNumericPosInfSign = 0xd000

	pgNumericNegInf     = 0x00000000f0000000
	pgNumericNegInfSign = 0xf000
)

var (
	big1    *big.Int = big.NewInt(1)
	big10   *big.Int = big.NewInt(10)
	big100  *big.Int = big.NewInt(100)
	big1000 *big.Int = big.NewInt(1000)
)

var (
	bigNBase   *big.Int = big.NewInt(nbase)
	bigNBaseX2 *big.Int = big.NewInt(nbase * nbase)
	bigNBaseX3 *big.Int = big.NewInt(nbase * nbase * nbase)
	bigNBaseX4 *big.Int = big.NewInt(nbase * nbase * nbase * nbase)
)

type NumericScanner interface {
	ScanNumeric(v Numeric) error
}

type NumericValuer interface {
	NumericValue() (Numeric, error)
}

type Numeric struct {
	Int              *big.Int
	Exp              int32
	NaN              bool
	InfinityModifier InfinityModifier
	Valid            bool
}

// ScanNumeric implements the [NumericScanner] interface.
func (n *Numeric) ScanNumeric(v Numeric) error {
	*n = v
	return nil
}

// NumericValue implements the [NumericValuer] interface.
func (n Numeric) NumericValue() (Numeric, error) {
	return n, nil
}

// Float64Value implements the [Float64Valuer] interface.
func (n Numeric) Float64Value() (Float8, error) {
	if !n.Valid {
		return Float8{}, nil
	} else if n.NaN {
		return Float8{Float64: math.NaN(), Valid: true}, nil
	} else if n.InfinityModifier == Infinity {
		return Float8{Float64: math.Inf(1), Valid: true}, nil
	} else if n.InfinityModifier == NegativeInfinity {
		return Float8{Float64: math.Inf(-1), Valid: true}, nil
	}

	buf := make([]byte, 0, 32)

	if n.Int == nil {
		buf = append(buf, '0')
	} else {
		buf = append(buf, n.Int.String()...)
	}
	buf = append(buf, 'e')
	buf = append(buf, strconv.FormatInt(int64(n.Exp), 10)...)

	f, err := strconv.ParseFloat(string(buf), 64)
	if err != nil {
		return Float8{}, err
	}

	return Float8{Float64: f, Valid: true}, nil
}

// ScanInt64 implements the [Int64Scanner] interface.
func (n *Numeric) ScanInt64(v Int8) error {
	if !v.Valid {
		*n = Numeric{}
		return nil
	}

	*n = Numeric{Int: big.NewInt(v.Int64), Valid: true}
	return nil
}

// Int64Value implements the [Int64Valuer] interface.
func (n Numeric) Int64Value() (Int8, error) {
	if !n.Valid {
		return Int8{}, nil
	}

	bi, err := n.toBigInt()
	if err != nil {
		return Int8{}, err
	}

	if !bi.IsInt64() {
		return Int8{}, fmt.Errorf("cannot convert %v to int64", n)
	}

	return Int8{Int64: bi.Int64(), Valid: true}, nil
}

func (n *Numeric) ScanScientific(src string) error {
	if !strings.ContainsAny("eE", src) {
		return scanPlanTextAnyToNumericScanner{}.Scan([]byte(src), n)
	}

	if bigF, ok := new(big.Float).SetString(string(src)); ok {
		smallF, _ := bigF.Float64()
		src = strconv.FormatFloat(smallF, 'f', -1, 64)
	}

	num, exp, err := parseNumericString(src)
	if err != nil {
		return err
	}

	*n = Numeric{Int: num, Exp: exp, Valid: true}

	return nil
}

func (n *Numeric) toBigInt() (*big.Int, error) {
	if n.Exp == 0 {
		return n.Int, nil
	}

	num := &big.Int{}
	num.Set(n.Int)
	if n.Exp > 0 {
		mul := &big.Int{}
		mul.Exp(big10, big.NewInt(int64(n.Exp)), nil)
		num.Mul(num, mul)
		return num, nil
	}

	div := &big.Int{}
	div.Exp(big10, big.NewInt(int64(-n.Exp)), nil)
	remainder := &big.Int{}
	num.DivMod(num, div, remainder)
	if remainder.Sign() != 0 {
		return nil, fmt.Errorf("cannot convert %v to integer", n)
	}
	return num, nil
}

func parseNumericString(str string) (n *big.Int, exp int32, err error) {
	idx := strings.IndexByte(str, '.')

	if idx == -1 {
		for len(str) > 1 && str[len(str)-1] == '0' && str[len(str)-2] != '-' {
			str = str[:len(str)-1]
			exp++
		}
	} else {
		exp = int32(-(len(str) - idx - 1))
		str = str[:idx] + str[idx+1:]
	}

	accum := &big.Int{}
	if _, ok := accum.SetString(str, 10); !ok {
		return nil, 0, fmt.Errorf("%s is not a number", str)
	}

	return accum, exp, nil
}

func nbaseDigitsToInt64(src []byte) (accum int64, bytesRead, digitsRead int) {
	digits := min(len(src)/2, 4)

	rp := 0

	for i := range digits {
		if i > 0 {
			accum *= nbase
		}
		accum += int64(binary.BigEndian.Uint16(src[rp:]))
		rp += 2
	}

	return accum, rp, digits
}

// Scan implements the [database/sql.Scanner] interface.
func (n *Numeric) Scan(src any) error {
	if src == nil {
		*n = Numeric{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToNumericScanner{}.Scan([]byte(src), n)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (n Numeric) Value() (driver.Value, error) {
	if !n.Valid {
		return nil, nil
	}

	buf, err := NumericCodec{}.PlanEncode(nil, 0, TextFormatCode, n).Encode(n, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (n Numeric) MarshalJSON() ([]byte, error) {
	if !n.Valid {
		return []byte("null"), nil
	}

	if n.NaN {
		return []byte(`"NaN"`), nil
	}

	return n.numberTextBytes(), nil
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (n *Numeric) UnmarshalJSON(src []byte) error {
	if bytes.Equal(src, []byte(`null`)) {
		*n = Numeric{}
		return nil
	}
	if bytes.Equal(src, []byte(`"NaN"`)) {
		*n = Numeric{NaN: true, Valid: true}
		return nil
	}
	return scanPlanTextAnyToNumericScanner{}.Scan(src, n)
}

// numberString returns a string of the number. undefined if NaN, infinite, or NULL
func (n Numeric) numberTextBytes() []byte {
	intStr := n.Int.String()

	buf := &bytes.Buffer{}

	if len(intStr) > 0 && intStr[:1] == "-" {
		intStr = intStr[1:]
		buf.WriteByte('-')
	}

	exp := int(n.Exp)
	if exp > 0 {
		buf.WriteString(intStr)
		for range exp {
			buf.WriteByte('0')
		}
	} else if exp < 0 {
		if len(intStr) <= -exp {
			buf.WriteString("0.")
			leadingZeros := -exp - len(intStr)
			for range leadingZeros {
				buf.WriteByte('0')
			}
			buf.WriteString(intStr)
		} else if len(intStr) > -exp {
			dpPos := len(intStr) + exp
			buf.WriteString(intStr[:dpPos])
			buf.WriteByte('.')
			buf.WriteString(intStr[dpPos:])
		}
	} else {
		buf.WriteString(intStr)
	}

	return buf.Bytes()
}

type NumericCodec struct{}

func (NumericCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (NumericCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (NumericCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		switch value.(type) {
		case NumericValuer:
			return encodePlanNumericCodecBinaryNumericValuer{}
		case Float64Valuer:
			return encodePlanNumericCodecBinaryFloat64Valuer{}
		case Int64Valuer:
			return encodePlanNumericCodecBinaryInt64Valuer{}
		}
	case TextFormatCode:
		switch value.(type) {
		case NumericValuer:
			return encodePlanNumericCodecTextNumericValuer{}
		case Float64Valuer:
			return encodePlanNumericCodecTextFloat64Valuer{}
		case Int64Valuer:
			return encodePlanNumericCodecTextInt64Valuer{}
		}
	}

	return nil
}

type encodePlanNumericCodecBinaryNumericValuer struct{}

func (encodePlanNumericCodecBinaryNumericValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(NumericValuer).NumericValue()
	if err != nil {
		return nil, err
	}

	return encodeNumericBinary(n, buf)
}

type encodePlanNumericCodecBinaryFloat64Valuer struct{}

func (encodePlanNumericCodecBinaryFloat64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Float64Valuer).Float64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	if math.IsNaN(n.Float64) {
		return encodeNumericBinary(Numeric{NaN: true, Valid: true}, buf)
	} else if math.IsInf(n.Float64, 1) {
		return encodeNumericBinary(Numeric{InfinityModifier: Infinity, Valid: true}, buf)
	} else if math.IsInf(n.Float64, -1) {
		return encodeNumericBinary(Numeric{InfinityModifier: NegativeInfinity, Valid: true}, buf)
	}
	num, exp, err := parseNumericString(strconv.FormatFloat(n.Float64, 'f', -1, 64))
	if err != nil {
		return nil, err
	}

	return encodeNumericBinary(Numeric{Int: num, Exp: exp, Valid: true}, buf)
}

type encodePlanNumericCodecBinaryInt64Valuer struct{}

func (encodePlanNumericCodecBinaryInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	return encodeNumericBinary(Numeric{Int: big.NewInt(n.Int64), Valid: true}, buf)
}

func encodeNumericBinary(n Numeric, buf []byte) (newBuf []byte, err error) {
	if !n.Valid {
		return nil, nil
	}

	if n.NaN {
		buf = pgio.AppendUint64(buf, pgNumericNaN)
		return buf, nil
	} else if n.InfinityModifier == Infinity {
		buf = pgio.AppendUint64(buf, pgNumericPosInf)
		return buf, nil
	} else if n.InfinityModifier == NegativeInfinity {
		buf = pgio.AppendUint64(buf, pgNumericNegInf)
		return buf, nil
	}

	var sign int16
	if n.Int.Sign() < 0 {
		sign = 16384
	}

	absInt := &big.Int{}
	wholePart := &big.Int{}
	fracPart := &big.Int{}
	remainder := &big.Int{}
	absInt.Abs(n.Int)

	// Normalize absInt and exp to where exp is always a multiple of 4. This makes
	// converting to 16-bit base 10,000 digits easier.
	var exp int32
	switch n.Exp % 4 {
	case 1, -3:
		exp = n.Exp - 1
		absInt.Mul(absInt, big10)
	case 2, -2:
		exp = n.Exp - 2
		absInt.Mul(absInt, big100)
	case 3, -1:
		exp = n.Exp - 3
		absInt.Mul(absInt, big1000)
	default:
		exp = n.Exp
	}

	if exp < 0 {
		divisor := &big.Int{}
		divisor.Exp(big10, big.NewInt(int64(-exp)), nil)
		wholePart.DivMod(absInt, divisor, fracPart)
		fracPart.Add(fracPart, divisor)
	} else {
		wholePart = absInt
	}

	var wholeDigits, fracDigits []int16

	for wholePart.Sign() != 0 {
		wholePart.DivMod(wholePart, bigNBase, remainder)
		wholeDigits = append(wholeDigits, int16(remainder.Int64()))
	}

	if fracPart.Sign() != 0 {
		for fracPart.Cmp(big1) != 0 {
			fracPart.DivMod(fracPart, bigNBase, remainder)
			fracDigits = append(fracDigits, int16(remainder.Int64()))
		}
	}

	buf = pgio.AppendInt16(buf, int16(len(wholeDigits)+len(fracDigits)))

	var weight int16
	if len(wholeDigits) > 0 {
		weight = int16(len(wholeDigits) - 1)
		if exp > 0 {
			weight += int16(exp / 4)
		}
	} else {
		weight = int16(exp/4) - 1 + int16(len(fracDigits))
	}
	buf = pgio.AppendInt16(buf, weight)

	buf = pgio.AppendInt16(buf, sign)

	var dscale int16
	if n.Exp < 0 {
		dscale = int16(-n.Exp)
	}
	buf = pgio.AppendInt16(buf, dscale)

	for i := len(wholeDigits) - 1; i >= 0; i-- {
		buf = pgio.AppendInt16(buf, wholeDigits[i])
	}

	for i := len(fracDigits) - 1; i >= 0; i-- {
		buf = pgio.AppendInt16(buf, fracDigits[i])
	}

	return buf, nil
}

type encodePlanNumericCodecTextNumericValuer struct{}

func (encodePlanNumericCodecTextNumericValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(NumericValuer).NumericValue()
	if err != nil {
		return nil, err
	}

	return encodeNumericText(n, buf)
}

type encodePlanNumericCodecTextFloat64Valuer struct{}

func (encodePlanNumericCodecTextFloat64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Float64Valuer).Float64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	if math.IsNaN(n.Float64) {
		buf = append(buf, "NaN"...)
	} else if math.IsInf(n.Float64, 1) {
		buf = append(buf, "Infinity"...)
	} else if math.IsInf(n.Float64, -1) {
		buf = append(buf, "-Infinity"...)
	} else {
		buf = append(buf, strconv.FormatFloat(n.Float64, 'f', -1, 64)...)
	}
	return buf, nil
}

type encodePlanNumericCodecTextInt64Valuer struct{}

func (encodePlanNumericCodecTextInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	buf = append(buf, strconv.FormatInt(n.Int64, 10)...)
	return buf, nil
}

func encodeNumericText(n Numeric, buf []byte) (newBuf []byte, err error) {
	if !n.Valid {
		return nil, nil
	}

	if n.NaN {
		buf = append(buf, "NaN"...)
		return buf, nil
	} else if n.InfinityModifier == Infinity {
		buf = append(buf, "Infinity"...)
		return buf, nil
	} else if n.InfinityModifier == NegativeInfinity {
		buf = append(buf, "-Infinity"...)
		return buf, nil
	}

	buf = append(buf, n.numberTextBytes()...)

	return buf, nil
}

func (NumericCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case NumericScanner:
			return scanPlanBinaryNumericToNumericScanner{}
		case Float64Scanner:
			return scanPlanBinaryNumericToFloat64Scanner{}
		case Int64Scanner:
			return scanPlanBinaryNumericToInt64Scanner{}
		case TextScanner:
			return scanPlanBinaryNumericToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case NumericScanner:
			return scanPlanTextAnyToNumericScanner{}
		case Float64Scanner:
			return scanPlanTextAnyToFloat64Scanner{}
		case Int64Scanner:
			return scanPlanTextAnyToInt64Scanner{}
		}
	}

	return nil
}

type scanPlanBinaryNumericToNumericScanner struct{}

func (scanPlanBinaryNumericToNumericScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(NumericScanner)

	if src == nil {
		return scanner.ScanNumeric(Numeric{})
	}

	if len(src) < 8 {
		return fmt.Errorf("numeric incomplete %v", src)
	}

	rp := 0
	ndigits := binary.BigEndian.Uint16(src[rp:])
	rp += 2
	weight := int16(binary.BigEndian.Uint16(src[rp:]))
	rp += 2
	sign := binary.BigEndian.Uint16(src[rp:])
	rp += 2
	dscale := int16(binary.BigEndian.Uint16(src[rp:]))
	rp += 2

	if sign == pgNumericNaNSign {
		return scanner.ScanNumeric(Numeric{NaN: true, Valid: true})
	} else if sign == pgNumericPosInfSign {
		return scanner.ScanNumeric(Numeric{InfinityModifier: Infinity, Valid: true})
	} else if sign == pgNumericNegInfSign {
		return scanner.ScanNumeric(Numeric{InfinityModifier: NegativeInfinity, Valid: true})
	}

	if ndigits == 0 {
		return scanner.ScanNumeric(Numeric{Int: big.NewInt(0), Valid: true})
	}

	if len(src[rp:]) < int(ndigits)*2 {
		return fmt.Errorf("numeric incomplete %v", src)
	}

	accum := &big.Int{}

	for i := 0; i < int(ndigits+3)/4; i++ {
		int64accum, bytesRead, digitsRead := nbaseDigitsToInt64(src[rp:])
		rp += bytesRead

		if i > 0 {
			var mul *big.Int
			switch digitsRead {
			case 1:
				mul = bigNBase
			case 2:
				mul = bigNBaseX2
			case 3:
				mul = bigNBaseX3
			case 4:
				mul = bigNBaseX4
			default:
				return fmt.Errorf("invalid digitsRead: %d (this can't happen)", digitsRead)
			}
			accum.Mul(accum, mul)
		}

		accum.Add(accum, big.NewInt(int64accum))
	}

	exp := (int32(weight) - int32(ndigits) + 1) * 4

	if dscale > 0 {
		fracNBaseDigits := int(ndigits) - int(weight) - 1
		fracDecimalDigits := fracNBaseDigits * 4
		dscaleInt := int(dscale)

		if dscaleInt > fracDecimalDigits {
			multCount := dscaleInt - fracDecimalDigits
			for range multCount {
				accum.Mul(accum, big10)
				exp--
			}
		} else if dscaleInt < fracDecimalDigits {
			divCount := fracDecimalDigits - dscaleInt
			for range divCount {
				accum.Div(accum, big10)
				exp++
			}
		}
	}

	reduced := &big.Int{}
	remainder := &big.Int{}
	if exp >= 0 {
		for {
			reduced.DivMod(accum, big10, remainder)
			if remainder.Sign() != 0 {
				break
			}
			accum.Set(reduced)
			exp++
		}
	}

	if sign != 0 {
		accum.Neg(accum)
	}

	return scanner.ScanNumeric(Numeric{Int: accum, Exp: exp, Valid: true})
}

type scanPlanBinaryNumericToFloat64Scanner struct{}

func (scanPlanBinaryNumericToFloat64Scanner) Scan(src []byte, dst any) error {
	scanner := (dst).(Float64Scanner)

	if src == nil {
		return scanner.ScanFloat64(Float8{})
	}

	var n Numeric

	err := scanPlanBinaryNumericToNumericScanner{}.Scan(src, &n)
	if err != nil {
		return err
	}

	f8, err := n.Float64Value()
	if err != nil {
		return err
	}

	return scanner.ScanFloat64(f8)
}

type scanPlanBinaryNumericToInt64Scanner struct{}

func (scanPlanBinaryNumericToInt64Scanner) Scan(src []byte, dst any) error {
	scanner := (dst).(Int64Scanner)

	if src == nil {
		return scanner.ScanInt64(Int8{})
	}

	var n Numeric

	err := scanPlanBinaryNumericToNumericScanner{}.Scan(src, &n)
	if err != nil {
		return err
	}

	bigInt, err := n.toBigInt()
	if err != nil {
		return err
	}

	if !bigInt.IsInt64() {
		return fmt.Errorf("%v is out of range for int64", bigInt)
	}

	return scanner.ScanInt64(Int8{Int64: bigInt.Int64(), Valid: true})
}

type scanPlanBinaryNumericToTextScanner struct{}

func (scanPlanBinaryNumericToTextScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TextScanner)

	if src == nil {
		return scanner.ScanText(Text{})
	}

	var n Numeric

	err := scanPlanBinaryNumericToNumericScanner{}.Scan(src, &n)
	if err != nil {
		return err
	}

	sbuf, err := encodeNumericText(n, nil)
	if err != nil {
		return err
	}

	return scanner.ScanText(Text{String: string(sbuf), Valid: true})
}

type scanPlanTextAnyToNumericScanner struct{}

func (scanPlanTextAnyToNumericScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(NumericScanner)

	if src == nil {
		return scanner.ScanNumeric(Numeric{})
	}

	if string(src) == "NaN" {
		return scanner.ScanNumeric(Numeric{NaN: true, Valid: true})
	} else if string(src) == "Infinity" {
		return scanner.ScanNumeric(Numeric{InfinityModifier: Infinity, Valid: true})
	} else if string(src) == "-Infinity" {
		return scanner.ScanNumeric(Numeric{InfinityModifier: NegativeInfinity, Valid: true})
	}

	num, exp, err := parseNumericString(string(src))
	if err != nil {
		return err
	}

	return scanner.ScanNumeric(Numeric{Int: num, Exp: exp, Valid: true})
}

func (c NumericCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	if format == TextFormatCode {
		return string(src), nil
	}

	var n Numeric
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}

	buf, err := m.Encode(oid, TextFormatCode, n, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), nil
}

func (c NumericCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var n Numeric
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}
	return n, nil
}
