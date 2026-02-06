package query

import (
	"context"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	gojson "encoding/json"
	"errors"
	"fmt"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"hash"
	"math"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/mithrandie/csvq/lib/json"
	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/go-text"
	txjson "github.com/mithrandie/go-text/json"
	"github.com/mithrandie/ternary"
)

type BuiltInFunction func(parser.Function, []value.Primary, *option.Flags) (value.Primary, error)

var Functions = map[string]BuiltInFunction{
	"COALESCE":               Coalesce,
	"IF":                     If,
	"IFNULL":                 Ifnull,
	"NULLIF":                 Nullif,
	"CEIL":                   Ceil,
	"FLOOR":                  Floor,
	"ROUND":                  Round,
	"ABS":                    Abs,
	"ACOS":                   Acos,
	"ACOSH":                  Acosh,
	"ASIN":                   Asin,
	"ASINH":                  Asinh,
	"ATAN":                   Atan,
	"ATAN2":                  Atan2,
	"ATANH":                  Atanh,
	"CBRT":                   Cbrt,
	"COS":                    Cos,
	"COSH":                   Cosh,
	"EXP":                    Exp,
	"EXP2":                   Exp2,
	"EXPM1":                  Expm1,
	"IS_INF":                 IsInf,
	"IS_NAN":                 IsNaN,
	"LOG":                    MathLog,
	"LOG10":                  Log10,
	"LOG1P":                  Log1p,
	"LOG2":                   Log2,
	"LOGB":                   Logb,
	"POW":                    Pow,
	"SIN":                    Sin,
	"SINH":                   Sinh,
	"SQRT":                   Sqrt,
	"TAN":                    Tan,
	"TANH":                   Tanh,
	"BIN_TO_DEC":             BinToDec,
	"OCT_TO_DEC":             OctToDec,
	"HEX_TO_DEC":             HexToDec,
	"ENOTATION_TO_DEC":       EnotationToDec,
	"BIN":                    Bin,
	"OCT":                    Oct,
	"HEX":                    Hex,
	"ENOTATION":              Enotation,
	"NUMBER_FORMAT":          NumberFormat,
	"RAND":                   Rand,
	"TRIM":                   Trim,
	"LTRIM":                  Ltrim,
	"RTRIM":                  Rtrim,
	"UPPER":                  Upper,
	"LOWER":                  Lower,
	"BASE64_ENCODE":          Base64Encode,
	"BASE64_DECODE":          Base64Decode,
	"HEX_ENCODE":             HexEncode,
	"HEX_DECODE":             HexDecode,
	"LEN":                    Len,
	"BYTE_LEN":               ByteLen,
	"WIDTH":                  Width,
	"LPAD":                   Lpad,
	"RPAD":                   Rpad,
	"SUBSTRING":              Substring,
	"SUBSTR":                 Substr,
	"INSTR":                  Instr,
	"LIST_ELEM":              ListElem,
	"REPLACE":                ReplaceFn,
	"REGEXP_MATCH":           RegExpMatch,
	"REGEXP_FIND":            RegExpFind,
	"REGEXP_FIND_SUBMATCHES": RegExpFindSubMatches,
	"REGEXP_FIND_ALL":        RegExpFindAll,
	"REGEXP_REPLACE":         RegExpReplace,
	"TITLE_CASE":             TitleCase,
	"FORMAT":                 Format,
	"JSON_VALUE":             JsonValue,
	"MD5":                    Md5,
	"SHA1":                   Sha1,
	"SHA256":                 Sha256,
	"SHA512":                 Sha512,
	"MD5_HMAC":               Md5Hmac,
	"SHA1_HMAC":              Sha1Hmac,
	"SHA256_HMAC":            Sha256Hmac,
	"SHA512_HMAC":            Sha512Hmac,
	"DATETIME_FORMAT":        DatetimeFormat,
	"YEAR":                   Year,
	"MONTH":                  Month,
	"DAY":                    Day,
	"HOUR":                   Hour,
	"MINUTE":                 Minute,
	"SECOND":                 Second,
	"MILLISECOND":            Millisecond,
	"MICROSECOND":            Microsecond,
	"NANOSECOND":             Nanosecond,
	"WEEKDAY":                Weekday,
	"UNIX_TIME":              UnixTime,
	"UNIX_NANO_TIME":         UnixNanoTime,
	"DAY_OF_YEAR":            DayOfYear,
	"WEEK_OF_YEAR":           WeekOfYear,
	"ADD_YEAR":               AddYear,
	"ADD_MONTH":              AddMonth,
	"ADD_DAY":                AddDay,
	"ADD_HOUR":               AddHour,
	"ADD_MINUTE":             AddMinute,
	"ADD_SECOND":             AddSecond,
	"ADD_MILLI":              AddMilli,
	"ADD_MICRO":              AddMicro,
	"ADD_NANO":               AddNano,
	"TRUNC_MONTH":            TruncMonth,
	"TRUNC_DAY":              TruncDay,
	"TRUNC_TIME":             TruncTime,
	"TRUNC_HOUR":             TruncTime,
	"TRUNC_MINUTE":           TruncMinute,
	"TRUNC_SECOND":           TruncSecond,
	"TRUNC_MILLI":            TruncMilli,
	"TRUNC_MICRO":            TruncMicro,
	"TRUNC_NANO":             TruncNano,
	"DATE_DIFF":              DateDiff,
	"TIME_DIFF":              TimeDiff,
	"TIME_NANO_DIFF":         TimeNanoDiff,
	"UTC":                    UTC,
	"MILLI_TO_DATETIME":      MilliToDatetime,
	"NANO_TO_DATETIME":       NanoToDatetime,
	"STRING":                 String,
	"INTEGER":                Integer,
	"FLOAT":                  Float,
	"BOOLEAN":                Boolean,
	"TERNARY":                Ternary,
	"DATETIME":               Datetime,
}

type Direction string

const (
	RightDirection Direction = "R"
	LeftDirection            = "L"
)

type PaddingType string

const (
	PaddingRuneCount PaddingType = "LEN"
	PaddingByteCount PaddingType = "BYTE"
	PaddingWidth     PaddingType = "WIDTH"
)

func Coalesce(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) < 1 {
		return nil, NewFunctionArgumentLengthErrorWithCustomArgs(fn, fn.Name, "at least 1 argument")
	}

	for _, arg := range args {
		if !value.IsNull(arg) {
			return arg, nil
		}
	}
	return value.NewNull(), nil
}

func If(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 3 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{3})
	}

	if args[0].Ternary() == ternary.TRUE {
		return args[1], nil
	}
	return args[2], nil
}

func Ifnull(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	if value.IsNull(args[0]) {
		return args[1], nil
	}
	return args[0], nil
}

func Nullif(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	if len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	if value.Equal(args[0], args[1], flags.DatetimeFormat, flags.GetTimeLocation()) == ternary.TRUE {
		return value.NewNull(), nil
	}
	return args[0], nil
}

func roundParams(args []value.Primary) (number float64, place float64, isnull bool, argsErr bool) {
	if len(args) < 1 || 2 < len(args) {
		argsErr = true
		return
	}

	f := value.ToFloat(args[0])
	if value.IsNull(f) {
		isnull = true
		return
	}
	number = f.(*value.Float).Raw()
	value.Discard(f)

	if len(args) == 2 {
		i := value.ToInteger(args[1])
		if value.IsNull(i) {
			isnull = true
			return
		}
		place = float64(i.(*value.Integer).Raw())
		value.Discard(i)
	}
	return
}

func Ceil(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	number, place, isnull, argsErr := roundParams(args)
	if argsErr {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1, 2})
	}
	if isnull {
		return value.NewNull(), nil
	}

	pow := math.Pow(10, place)
	r := math.Ceil(pow*number) / pow
	return value.NewFloat(r), nil
}

func Floor(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	number, place, isnull, argsErr := roundParams(args)
	if argsErr {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1, 2})
	}
	if isnull {
		return value.NewNull(), nil
	}

	pow := math.Pow(10, place)
	r := math.Floor(pow*number) / pow
	return value.NewFloat(r), nil
}

func round(f float64, place float64) float64 {
	pow := math.Pow(10, place)
	var r float64
	if f < 0 {
		r = math.Ceil(pow*f-0.5) / pow
	} else {
		r = math.Floor(pow*f+0.5) / pow
	}
	return r
}

func Round(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	number, place, isnull, argsErr := roundParams(args)
	if argsErr {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1, 2})
	}
	if isnull {
		return value.NewNull(), nil
	}

	return value.NewFloat(round(number, place)), nil
}

func execMath1Arg(fn parser.Function, args []value.Primary, mathf func(float64) float64) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	f := value.ToFloat(args[0])
	if value.IsNull(f) {
		return value.NewNull(), nil
	}
	result := mathf(f.(*value.Float).Raw())
	value.Discard(f)

	return value.NewFloat(result), nil
}

func execMath2Args(fn parser.Function, args []value.Primary, mathf func(float64, float64) float64) (value.Primary, error) {
	if len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	f1 := value.ToFloat(args[0])
	if value.IsNull(f1) {
		return value.NewNull(), nil
	}

	f2 := value.ToFloat(args[1])
	if value.IsNull(f2) {
		value.Discard(f1)
		return value.NewNull(), nil
	}
	result := mathf(f1.(*value.Float).Raw(), f2.(*value.Float).Raw())
	value.Discard(f1)
	value.Discard(f2)

	return value.NewFloat(result), nil
}

func Abs(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Abs)
}

func Acos(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Acos)
}

func Acosh(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Acosh)
}

func Asin(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Asin)
}

func Asinh(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Asinh)
}

func Atan(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Atan)
}

func Atan2(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath2Args(fn, args, math.Atan2)
}

func Atanh(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Atanh)
}

func Cbrt(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Cbrt)
}

func Cos(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Cos)
}

func Cosh(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Cosh)
}

func Exp(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Exp)
}

func Exp2(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Exp2)
}

func Expm1(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Expm1)
}

func IsInf(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) < 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1, 2})
	}

	f1 := value.ToFloat(args[0])
	if value.IsNull(f1) {
		return value.NewTernary(ternary.FALSE), nil
	}

	sign := 0
	if len(args) == 2 {
		f2 := value.ToIntegerStrictly(args[1])
		if !value.IsNull(f2) {
			sign = int(f2.(*value.Integer).Raw())
		}
	}

	return value.NewTernary(ternary.ConvertFromBool(math.IsInf(f1.(*value.Float).Raw(), sign))), nil
}

func IsNaN(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	f := value.ToFloat(args[0])
	if value.IsNull(f) {
		return value.NewTernary(ternary.FALSE), nil
	}

	return value.NewTernary(ternary.ConvertFromBool(math.IsNaN(f.(*value.Float).Raw()))), nil
}

func MathLog(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Log)
}

func Log10(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Log10)
}

func Log1p(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Log1p)
}

func Log2(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Log2)
}

func Logb(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Logb)
}

func Pow(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath2Args(fn, args, math.Pow)
}

func Sin(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Sin)
}

func Sinh(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Sinh)
}

func Sqrt(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Sqrt)
}

func Tan(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Tan)
}

func Tanh(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execMath1Arg(fn, args, math.Tanh)
}

func execParseInt(fn parser.Function, args []value.Primary, base int) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	p := value.ToString(args[0])
	if value.IsNull(p) {
		return value.NewNull(), nil
	}
	s := p.(*value.String).Raw()
	value.Discard(p)

	if base == 16 {
		s = ltrim(s, "0x")
	}

	i, err := strconv.ParseInt(s, base, 64)
	if err != nil {
		return value.NewNull(), nil
	}

	return value.NewInteger(i), nil
}

func execFormatInt(fn parser.Function, args []value.Primary, base int) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	p := value.ToInteger(args[0])
	if value.IsNull(p) {
		return value.NewNull(), nil
	}
	s := strconv.FormatInt(p.(*value.Integer).Raw(), base)
	value.Discard(p)

	return value.NewString(s), nil
}

func BinToDec(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execParseInt(fn, args, 2)
}

func OctToDec(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execParseInt(fn, args, 8)
}

func HexToDec(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execParseInt(fn, args, 16)
}

func EnotationToDec(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	p := value.ToString(args[0])
	if value.IsNull(p) {
		return value.NewNull(), nil
	}

	f, err := strconv.ParseFloat(p.(*value.String).Raw(), 64)
	value.Discard(p)
	if err != nil {
		return value.NewNull(), nil
	}

	return value.NewFloat(f), nil
}

func Bin(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execFormatInt(fn, args, 2)
}

func Oct(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execFormatInt(fn, args, 8)
}

func Hex(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execFormatInt(fn, args, 16)
}

func Enotation(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	p := value.ToFloat(args[0])
	if value.IsNull(p) {
		return value.NewNull(), nil
	}
	s := strconv.FormatFloat(p.(*value.Float).Raw(), 'e', -1, 64)
	value.Discard(p)

	return value.NewString(s), nil
}

func NumberFormat(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) < 1 || 5 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1, 2, 3, 4, 5})
	}

	p := value.ToFloat(args[0])
	if value.IsNull(p) {
		return value.NewNull(), nil
	}

	precision := -1
	decimalPoint := "."
	thousandsSeparator := ","
	decimalSeparator := ""

	if 1 < len(args) {
		i := value.ToInteger(args[1])
		if !value.IsNull(i) {
			precision = int(i.(*value.Integer).Raw())
			value.Discard(i)
		}
	}
	if 2 < len(args) {
		i := value.ToString(args[2])
		if !value.IsNull(i) {
			decimalPoint = i.(*value.String).Raw()
			value.Discard(i)
		}
	}
	if 3 < len(args) {
		i := value.ToString(args[3])
		if !value.IsNull(i) {
			thousandsSeparator = i.(*value.String).Raw()
			value.Discard(i)
		}
	}
	if 4 < len(args) {
		i := value.ToString(args[4])
		if !value.IsNull(i) {
			decimalSeparator = i.(*value.String).Raw()
			value.Discard(i)
		}
	}

	s := option.FormatNumber(p.(*value.Float).Raw(), precision, decimalPoint, thousandsSeparator, decimalSeparator)
	value.Discard(p)

	return value.NewString(s), nil
}

func Rand(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if 0 < len(args) && len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{0, 2})
	}

	r := option.GetRand()

	if len(args) == 0 {
		return value.NewFloat(r.Float64()), nil
	}

	p1 := value.ToInteger(args[0])
	if value.IsNull(p1) {
		return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "the first argument must be an integer")
	}
	low := p1.(*value.Integer).Raw()
	value.Discard(p1)

	p2 := value.ToInteger(args[1])
	if value.IsNull(p2) {
		return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "the second argument must be an integer")
	}
	high := p2.(*value.Integer).Raw()
	value.Discard(p2)

	if high <= low {
		return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "the second argument must be greater than the first argument")
	}
	delta := high - low + 1
	return value.NewInteger(r.Int63n(delta) + low), nil
}

func execStrings1Arg(fn parser.Function, args []value.Primary, stringsf func(string) string) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}

	result := stringsf(s.(*value.String).Raw())
	value.Discard(s)

	return value.NewString(result), nil
}

func execStringsTrim(fn parser.Function, args []value.Primary, stringsf func(string, string) string) (value.Primary, error) {
	if len(args) < 1 || 2 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1, 2})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}

	cutset := ""
	if 2 == len(args) {
		cs := value.ToString(args[1])
		if value.IsNull(cs) {
			value.Discard(s)
			return value.NewNull(), nil
		}
		cutset = cs.(*value.String).Raw()
		value.Discard(cs)
	}

	result := stringsf(s.(*value.String).Raw(), cutset)
	value.Discard(s)

	return value.NewString(result), nil
}

func base64Encode(s string) string {
	return base64.StdEncoding.EncodeToString([]byte(s))
}

func base64Decode(s string) string {
	bytes, _ := base64.StdEncoding.DecodeString(s)
	return string(bytes)
}

func hexEncode(s string) string {
	return hex.EncodeToString([]byte(s))
}

func hexDecode(s string) string {
	bytes, _ := hex.DecodeString(s)
	return string(bytes)
}

func trim(s string, cutset string) string {
	if len(cutset) < 1 {
		return strings.TrimSpace(s)
	}
	return strings.Trim(s, cutset)
}

func ltrim(s string, cutset string) string {
	if len(cutset) < 1 {
		return strings.TrimLeftFunc(s, unicode.IsSpace)
	}
	return strings.TrimLeft(s, cutset)
}

func rtrim(s string, cutset string) string {
	if len(cutset) < 1 {
		return strings.TrimRightFunc(s, unicode.IsSpace)
	}
	return strings.TrimRight(s, cutset)
}

func execStringsLen(fn parser.Function, args []value.Primary, stringsf func(string) int) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}
	result := stringsf(s.(*value.String).Raw())
	value.Discard(s)

	return value.NewInteger(int64(result)), nil
}

func execStringsPadding(fn parser.Function, args []value.Primary, direction Direction, flags *option.Flags) (value.Primary, error) {
	if len(args) < 3 || 5 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{3, 4, 5})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}
	str := s.(*value.String).Raw()
	value.Discard(s)

	l := value.ToInteger(args[1])
	if value.IsNull(l) {
		return value.NewNull(), nil
	}
	length := int(l.(*value.Integer).Raw())
	value.Discard(l)

	p := value.ToString(args[2])
	if value.IsNull(p) {
		return value.NewNull(), nil
	}
	padstr := p.(*value.String).Raw()
	value.Discard(p)

	padType := PaddingRuneCount
	if 3 < len(args) {
		t := value.ToString(args[3])
		if !value.IsNull(t) {
			switch PaddingType(strings.ToUpper(t.(*value.String).Raw())) {
			case PaddingRuneCount:
				// Do Nothing
			case PaddingByteCount:
				padType = PaddingByteCount
			case PaddingWidth:
				padType = PaddingWidth
			default:
				return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "padding type must be one of LEN|BYTE|WIDTH")
			}
			value.Discard(t)
		}
	}

	enc := text.UTF8
	if 4 < len(args) {
		encs := value.ToString(args[4])
		if !value.IsNull(encs) {
			e, err := option.ParseEncoding(encs.(*value.String).Raw())
			value.Discard(encs)

			if err != nil || e == text.AUTO {
				return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "encoding must be one of UTF8|UTF16|SJIS")
			}
			enc = e
		}
	}

	var strLen int
	var padstrLen int
	switch padType {
	case PaddingRuneCount:
		strLen = utf8.RuneCountInString(str)
		padstrLen = utf8.RuneCountInString(padstr)
	case PaddingByteCount:
		strLen = text.ByteSize(str, enc)
		padstrLen = text.ByteSize(padstr, enc)
	case PaddingWidth:
		strLen = option.TextWidth(str, flags)
		padstrLen = option.TextWidth(padstr, flags)
	}

	if length <= strLen {
		return args[0], nil
	}

	padLen := length - strLen
	repeat := int(math.Ceil(float64(padLen) / float64(padstrLen)))
	padding := strings.Repeat(padstr, repeat)
	switch padType {
	case PaddingRuneCount:
		padding = string([]rune(padding)[:padLen])
	default:
		buf := make([]rune, 0, len(padding))
		w := 0
		l := 0
		for _, r := range padding {
			switch padType {
			case PaddingByteCount:
				w = text.RuneByteSize(r, enc)
			default:
				w = option.RuneWidth(r, flags)
			}
			l = l + w
			buf = append(buf, r)
			if padLen == l {
				break
			} else if padLen < l {
				return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "cannot split pad string in a byte array of a character")
			}
		}
		padding = string(buf)
	}

	if direction == RightDirection {
		str = str + padding
	} else {
		str = padding + str
	}

	return value.NewString(str), nil
}

func execCrypto(fn parser.Function, args []value.Primary, cryptof func() hash.Hash) (value.Primary, error) {
	if 1 != len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}

	h := cryptof()
	h.Write([]byte(s.(*value.String).Raw()))
	r := hex.EncodeToString(h.Sum(nil))
	value.Discard(s)

	return value.NewString(r), nil

}

func execCryptoHMAC(fn parser.Function, args []value.Primary, cryptof func() hash.Hash) (value.Primary, error) {
	if 2 != len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}

	key := value.ToString(args[1])
	if value.IsNull(key) {
		value.Discard(s)
		return value.NewNull(), nil
	}

	h := hmac.New(cryptof, []byte(key.(*value.String).Raw()))
	h.Write([]byte(s.(*value.String).Raw()))
	r := hex.EncodeToString(h.Sum(nil))
	value.Discard(s)
	value.Discard(key)

	return value.NewString(r), nil
}

func Trim(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStringsTrim(fn, args, trim)
}

func Ltrim(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStringsTrim(fn, args, ltrim)
}

func Rtrim(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStringsTrim(fn, args, rtrim)
}

func Upper(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStrings1Arg(fn, args, strings.ToUpper)
}

func Lower(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStrings1Arg(fn, args, strings.ToLower)
}

func Base64Encode(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStrings1Arg(fn, args, base64Encode)
}

func Base64Decode(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStrings1Arg(fn, args, base64Decode)
}

func HexEncode(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStrings1Arg(fn, args, hexEncode)
}

func HexDecode(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStrings1Arg(fn, args, hexDecode)
}

func Len(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execStringsLen(fn, args, utf8.RuneCountInString)
}

func ByteLen(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) < 1 || 2 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1, 2})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}

	enc := text.UTF8
	if 1 < len(args) {
		encs := value.ToString(args[1])
		if !value.IsNull(encs) {
			e, err := option.ParseEncoding(encs.(*value.String).Raw())
			value.Discard(encs)

			if err != nil || e == text.AUTO {
				value.Discard(s)
				return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "encoding must be one of UTF8|UTF16|SJIS")
			}
			enc = e
		}
	}

	i := int64(text.ByteSize(s.(*value.String).Raw(), enc))
	value.Discard(s)

	return value.NewInteger(i), nil
}

func Width(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}
	result := option.TextWidth(s.(*value.String).Raw(), flags)
	value.Discard(s)

	return value.NewInteger(int64(result)), nil
}

func Lpad(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execStringsPadding(fn, args, LeftDirection, flags)
}

func Rpad(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execStringsPadding(fn, args, RightDirection, flags)
}

func substr(fn parser.Function, args []value.Primary, zeroBasedIndex bool) (value.Primary, error) {
	if len(args) < 2 || 3 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2, 3})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}
	runes := []rune(s.(*value.String).Raw())
	value.Discard(s)

	strlen := len(runes)
	start := 0
	end := strlen

	i := value.ToInteger(args[1])
	if value.IsNull(i) {
		return value.NewNull(), nil
	}
	start = int(i.(*value.Integer).Raw())
	value.Discard(i)

	if !zeroBasedIndex && start > 0 {
		start = start - 1
	}
	if start < 0 {
		start = strlen + start
	}
	if start < 0 || strlen <= start {
		return value.NewNull(), nil
	}

	if 3 == len(args) {
		i := value.ToInteger(args[2])
		if value.IsNull(i) {
			return value.NewNull(), nil
		}
		sublen := int(i.(*value.Integer).Raw())
		value.Discard(i)

		if sublen < 0 {
			return value.NewNull(), nil
		}
		end = start + sublen
		if strlen < end {
			end = strlen
		}
	}

	return value.NewString(string(runes[start:end])), nil
}

func Substring(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return substr(fn, args, false)
}

func Substr(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return substr(fn, args, true)
}

func Instr(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) < 2 || 2 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}

	substr := value.ToString(args[1])
	if value.IsNull(substr) {
		value.Discard(s)
		return value.NewNull(), nil
	}

	index := strings.Index(s.(*value.String).Raw(), substr.(*value.String).Raw())
	value.Discard(s)
	value.Discard(substr)

	if index < 0 {
		return value.NewNull(), nil
	}
	return value.NewInteger(int64(index)), nil
}

func ListElem(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) < 3 || 3 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{3})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}
	str := s.(*value.String).Raw()
	value.Discard(s)

	sep := value.ToString(args[1])
	if value.IsNull(sep) {
		return value.NewNull(), nil
	}
	sepStr := sep.(*value.String).Raw()
	value.Discard(sep)

	i := value.ToInteger(args[2])
	if value.IsNull(i) {
		return value.NewNull(), nil
	}
	index := int(i.(*value.Integer).Raw())
	value.Discard(i)

	if index < 0 {
		return value.NewNull(), nil
	}

	list := strings.Split(str, sepStr)

	if len(list) <= index {
		return value.NewNull(), nil
	}
	return value.NewString(list[index]), nil
}

func ReplaceFn(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if 3 != len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{3})
	}

	s := value.ToString(args[0])
	if value.IsNull(s) {
		return value.NewNull(), nil
	}
	str := s.(*value.String).Raw()
	value.Discard(s)

	oldstr := value.ToString(args[1])
	if value.IsNull(oldstr) {
		return value.NewNull(), nil
	}
	oldStr := oldstr.(*value.String).Raw()
	value.Discard(oldstr)

	newstr := value.ToString(args[2])
	if value.IsNull(newstr) {
		return value.NewNull(), nil
	}
	newStr := newstr.(*value.String).Raw()
	value.Discard(newstr)

	r := strings.Replace(str, oldStr, newStr, -1)
	return value.NewString(r), nil
}

var regExpStrIsNull = errors.New("cannot convert the value to string")

func prepareRegExp(fn parser.Function, str value.Primary, expr value.Primary, flags value.Primary) (string, *regexp.Regexp, error) {
	sVal := value.ToString(str)
	if value.IsNull(sVal) {
		return "", nil, regExpStrIsNull
	}
	s := sVal.(*value.String).Raw()
	value.Discard(sVal)

	exprVal := value.ToString(expr)
	if value.IsNull(exprVal) {
		return "", nil, NewFunctionInvalidArgumentError(fn, fn.Name, "pattern must be a string")
	}
	exprStr := exprVal.(*value.String).Raw()
	value.Discard(exprVal)

	if flags != nil && !value.IsNull(flags) {
		flagsVal := value.ToString(flags)
		if value.IsNull(flagsVal) {
			return s, nil, NewFunctionInvalidArgumentError(fn, fn.Name, "flags must be a string")
		}
		flagsStr := flagsVal.(*value.String).Raw()
		value.Discard(flagsVal)

		if !validFlagsRegExp.MatchString(flagsStr) {
			return s, nil, NewFunctionInvalidArgumentError(fn, fn.Name, fmt.Sprintf("invalid flag %q", flagsStr))
		}

		exprStr = strings.Join([]string{"(?", flagsStr, ")", exprStr}, "")
	}

	regExp, err := RegExps.Get(exprStr)
	if err != nil {
		return s, nil, NewFunctionInvalidArgumentError(fn, fn.Name, err.Error())
	}

	return s, regExp, nil
}

func prepareRegExpMatch(fn parser.Function, args []value.Primary) (string, *regexp.Regexp, error) {
	if len(args) < 2 || 3 < len(args) {
		return "", nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2, 3})
	}

	var flags value.Primary
	if 2 < len(args) {
		flags = args[2]
	}

	return prepareRegExp(fn, args[0], args[1], flags)
}

func prepareRegExpReplace(fn parser.Function, args []value.Primary) (string, *regexp.Regexp, string, error) {
	if len(args) < 3 || 4 < len(args) {
		return "", nil, "", NewFunctionArgumentLengthError(fn, fn.Name, []int{3, 4})
	}

	var flags value.Primary
	if 3 < len(args) {
		flags = args[3]
	}

	s, regExp, err := prepareRegExp(fn, args[0], args[1], flags)

	replVal := value.ToString(args[2])
	if value.IsNull(replVal) {
		return "", nil, "", NewFunctionInvalidArgumentError(fn, fn.Name, "replacement string must be a string")
	}
	replStr := replVal.(*value.String).Raw()
	value.Discard(replVal)

	return s, regExp, replStr, err
}

func RegExpMatch(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	s, regExp, err := prepareRegExpMatch(fn, args)
	if err != nil {
		if err == regExpStrIsNull {
			return value.NewTernary(ternary.UNKNOWN), nil
		}
		return nil, err
	}

	return value.NewTernary(ternary.ConvertFromBool(regExp.MatchString(s))), nil
}

func RegExpFind(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	s, regExp, err := prepareRegExpMatch(fn, args)
	if err != nil {
		if err == regExpStrIsNull {
			return value.NewNull(), nil
		}
		return nil, err
	}

	m := regExp.FindStringSubmatch(s)

	switch len(m) {
	case 0:
		return value.NewNull(), nil
	case 1:
		return value.NewString(m[0]), nil
	default:
		return value.NewString(m[1]), err
	}
}

func RegExpFindSubMatches(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	s, regExp, err := prepareRegExpMatch(fn, args)
	if err != nil {
		if err == regExpStrIsNull {
			return value.NewNull(), nil
		}
		return nil, err
	}

	m := regExp.FindStringSubmatch(s)

	if len(m) < 1 {
		return value.NewNull(), nil
	}

	b, _ := gojson.Marshal(m)
	return value.NewString(string(b)), err
}

func RegExpFindAll(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	s, regExp, err := prepareRegExpMatch(fn, args)
	if err != nil {
		if err == regExpStrIsNull {
			return value.NewNull(), nil
		}
		return nil, err
	}

	m := regExp.FindAllStringSubmatch(s, 10)

	if len(m) < 1 {
		return value.NewNull(), nil
	}

	b, _ := gojson.Marshal(m)
	return value.NewString(string(b)), err
}

func RegExpReplace(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	s, regExp, replStr, err := prepareRegExpReplace(fn, args)
	if err != nil {
		if err == regExpStrIsNull {
			return value.NewNull(), nil
		}
		return nil, err
	}

	return value.NewString(regExp.ReplaceAllString(s, replStr)), nil
}

func TitleCase(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	format := value.ToString(args[0])
	if value.IsNull(format) {
		return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "the first argument must be a string")
	}

	c := cases.Title(language.English, cases.NoLower)
	return value.NewString(c.String(format.(*value.String).Raw())), nil
}

func Format(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) < 1 {
		return nil, NewFunctionArgumentLengthErrorWithCustomArgs(fn, fn.Name, "at least 1 argument")
	}

	format := value.ToString(args[0])
	if value.IsNull(format) {
		return nil, NewFunctionInvalidArgumentError(fn, fn.Name, "the first argument must be a string")
	}
	str, err := NewStringFormatter().Format(format.(*value.String).Raw(), args[1:])
	value.Discard(format)

	if err != nil {
		return nil, NewFunctionInvalidArgumentError(fn, fn.Name, err.(Error).Message())
	}
	return value.NewString(str), nil
}

func JsonValue(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	query := value.ToString(args[0])
	if value.IsNull(query) {
		return value.NewNull(), nil
	}

	jsonText := value.ToString(args[1])
	if value.IsNull(jsonText) {
		value.Discard(query)
		return value.NewNull(), nil
	}

	v, err := json.LoadValue(query.(*value.String).Raw(), jsonText.(*value.String).Raw())
	value.Discard(query)
	value.Discard(jsonText)

	if err != nil {
		return v, NewFunctionInvalidArgumentError(fn, fn.Name, err.Error())
	}
	return v, nil
}

func Md5(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execCrypto(fn, args, md5.New)
}

func Sha1(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execCrypto(fn, args, sha1.New)
}

func Sha256(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execCrypto(fn, args, sha256.New)
}

func Sha512(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execCrypto(fn, args, sha512.New)
}

func Md5Hmac(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execCryptoHMAC(fn, args, md5.New)
}

func Sha1Hmac(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execCryptoHMAC(fn, args, sha1.New)
}

func Sha256Hmac(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execCryptoHMAC(fn, args, sha256.New)
}

func Sha512Hmac(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	return execCryptoHMAC(fn, args, sha512.New)
}

func DatetimeFormat(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	if len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	p := value.ToDatetime(args[0], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(p) {
		return value.NewNull(), nil
	}

	format := value.ToString(args[1])
	if value.IsNull(format) {
		value.Discard(p)
		return value.NewNull(), nil
	}

	str := p.(*value.Datetime).Format(value.DatetimeFormats.Get(format.(*value.String).Raw()))
	value.Discard(p)
	value.Discard(format)

	return value.NewString(str), nil
}

func execDatetimeToInt(fn parser.Function, args []value.Primary, timef func(time.Time) int64, flags *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	dt := value.ToDatetime(args[0], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(dt) {
		return value.NewNull(), nil
	}
	result := timef(dt.(*value.Datetime).Raw())
	value.Discard(dt)

	return value.NewInteger(result), nil
}

func execDatetimeAdd(fn parser.Function, args []value.Primary, timef func(time.Time, int) time.Time, flags *option.Flags) (value.Primary, error) {
	if len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	p1 := value.ToDatetime(args[0], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(p1) {
		return value.NewNull(), nil
	}

	p2 := value.ToInteger(args[1])
	if value.IsNull(p2) {
		value.Discard(p1)
		return value.NewNull(), nil
	}

	dt := p1.(*value.Datetime).Raw()
	i := int(p2.(*value.Integer).Raw())
	value.Discard(p1)
	value.Discard(p2)
	return value.NewDatetime(timef(dt, i)), nil
}

func year(t time.Time) int64 {
	return int64(t.Year())
}

func month(t time.Time) int64 {
	return int64(t.Month())
}

func day(t time.Time) int64 {
	return int64(t.Day())
}

func hour(t time.Time) int64 {
	return int64(t.Hour())
}

func minute(t time.Time) int64 {
	return int64(t.Minute())
}

func second(t time.Time) int64 {
	return int64(t.Second())
}

func millisecond(t time.Time) int64 {
	return int64(round(float64(t.Nanosecond())/1e6, 0))
}

func microsecond(t time.Time) int64 {
	return int64(round(float64(t.Nanosecond())/1e3, 0))
}

func nanosecond(t time.Time) int64 {
	return int64(t.Nanosecond())
}

func weekday(t time.Time) int64 {
	return int64(t.Weekday())
}

func unixTime(t time.Time) int64 {
	return t.Unix()
}

func unixNanoTime(t time.Time) int64 {
	return t.UnixNano()
}

func dayOfYear(t time.Time) int64 {
	return int64(t.YearDay())
}

func weekOfYear(t time.Time) int64 {
	_, w := t.ISOWeek()
	return int64(w)
}

func addYear(t time.Time, duration int) time.Time {
	return t.AddDate(duration, 0, 0)
}

func addMonth(t time.Time, duration int) time.Time {
	return t.AddDate(0, duration, 0)
}

func addDay(t time.Time, duration int) time.Time {
	return t.AddDate(0, 0, duration)
}

func addHour(t time.Time, duration int) time.Time {
	dur := time.Duration(duration)
	return t.Add(dur * time.Hour)
}

func addMinute(t time.Time, duration int) time.Time {
	dur := time.Duration(duration)
	return t.Add(dur * time.Minute)
}

func addSecond(t time.Time, duration int) time.Time {
	dur := time.Duration(duration)
	return t.Add(dur * time.Second)
}

func addMilli(t time.Time, duration int) time.Time {
	dur := time.Duration(duration)
	return t.Add(dur * time.Millisecond)
}

func addMicro(t time.Time, duration int) time.Time {
	dur := time.Duration(duration)
	return t.Add(dur * time.Microsecond)
}

func addNano(t time.Time, duration int) time.Time {
	dur := time.Duration(duration)
	return t.Add(dur * time.Nanosecond)
}

func Year(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, year, flags)
}

func Month(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, month, flags)
}

func Day(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, day, flags)
}

func Hour(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, hour, flags)
}

func Minute(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, minute, flags)
}

func Second(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, second, flags)
}

func Millisecond(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, millisecond, flags)
}

func Microsecond(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, microsecond, flags)
}

func Nanosecond(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, nanosecond, flags)
}

func Weekday(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, weekday, flags)
}

func UnixTime(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, unixTime, flags)
}

func UnixNanoTime(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, unixNanoTime, flags)
}

func DayOfYear(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, dayOfYear, flags)
}

func WeekOfYear(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeToInt(fn, args, weekOfYear, flags)
}

func AddYear(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addYear, flags)
}

func AddMonth(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addMonth, flags)
}

func AddDay(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addDay, flags)
}

func AddHour(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addHour, flags)
}

func AddMinute(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addMinute, flags)
}

func AddSecond(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addSecond, flags)
}

func AddMilli(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addMilli, flags)
}

func AddMicro(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addMicro, flags)
}

func AddNano(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return execDatetimeAdd(fn, args, addNano, flags)
}

func truncateDate(fn parser.Function, args []value.Primary, place int8, flags *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	dt := value.ToDatetime(args[0], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(dt) {
		return value.NewNull(), nil
	}
	t := dt.(*value.Datetime).Raw()
	value.Discard(dt)

	y, m, d := t.Date()
	switch place {
	case 1:
		d = 1
	case 2:
		d = 1
		m = 1
	}
	return value.NewDatetime(time.Date(y, m, d, 0, 0, 0, 0, t.Location())), nil
}

func TruncMonth(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return truncateDate(fn, args, 2, flags)
}

func TruncDay(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return truncateDate(fn, args, 1, flags)
}

func TruncTime(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return truncateDate(fn, args, 0, flags)
}

func truncateDuration(fn parser.Function, args []value.Primary, dur time.Duration, flags *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	dt := value.ToDatetime(args[0], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(dt) {
		return value.NewNull(), nil
	}
	t := dt.(*value.Datetime).Raw().Truncate(dur)
	value.Discard(dt)

	return value.NewDatetime(t), nil
}

func TruncMinute(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return truncateDuration(fn, args, time.Hour, flags)
}

func TruncSecond(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return truncateDuration(fn, args, time.Minute, flags)
}

func TruncMilli(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return truncateDuration(fn, args, time.Second, flags)
}

func TruncMicro(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return truncateDuration(fn, args, time.Millisecond, flags)
}

func TruncNano(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return truncateDuration(fn, args, time.Microsecond, flags)
}

func DateDiff(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	if len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	p1 := value.ToDatetime(args[0], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(p1) {
		return value.NewNull(), nil
	}

	p2 := value.ToDatetime(args[1], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(p2) {
		value.Discard(p1)
		return value.NewNull(), nil
	}

	dt1 := p1.(*value.Datetime).Raw()
	dt2 := p2.(*value.Datetime).Raw()
	value.Discard(p1)
	value.Discard(p2)

	subdt1 := time.Date(dt1.Year(), dt1.Month(), dt1.Day(), 0, 0, 0, 0, flags.GetTimeLocation())
	subdt2 := time.Date(dt2.Year(), dt2.Month(), dt2.Day(), 0, 0, 0, 0, flags.GetTimeLocation())
	dur := subdt1.Sub(subdt2)

	return value.NewInteger(int64(dur.Hours() / 24)), nil
}

func timeDiff(fn parser.Function, args []value.Primary, durf func(time.Duration) value.Primary, flags *option.Flags) (value.Primary, error) {
	if len(args) != 2 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{2})
	}

	p1 := value.ToDatetime(args[0], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(p1) {
		return value.NewNull(), nil
	}

	p2 := value.ToDatetime(args[1], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(p2) {
		value.Discard(p1)
		return value.NewNull(), nil
	}

	dt1 := p1.(*value.Datetime).Raw()
	dt2 := p2.(*value.Datetime).Raw()
	value.Discard(p1)
	value.Discard(p2)

	dur := dt1.Sub(dt2)
	return durf(dur), nil
}

func durationSeconds(dur time.Duration) value.Primary {
	return value.NewFloat(dur.Seconds())
}

func durationNanoseconds(dur time.Duration) value.Primary {
	return value.NewInteger(dur.Nanoseconds())
}

func TimeDiff(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return timeDiff(fn, args, durationSeconds, flags)
}

func TimeNanoDiff(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	return timeDiff(fn, args, durationNanoseconds, flags)
}

func UTC(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	dt := value.ToDatetime(args[0], flags.DatetimeFormat, flags.GetTimeLocation())
	if value.IsNull(dt) {
		return value.NewNull(), nil
	}
	t := dt.(*value.Datetime).Raw().UTC()
	value.Discard(dt)

	return value.NewDatetime(t), nil
}

func MilliToDatetime(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	p := value.ToInteger(args[0])
	if value.IsNull(p) {
		return value.NewNull(), nil
	}
	i := p.(*value.Integer).Raw()
	value.Discard(p)

	return value.NewDatetime(time.Unix(i/1000, (i%1000)*1000000).In(flags.GetTimeLocation())), nil
}

func NanoToDatetime(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	p := value.ToInteger(args[0])
	if value.IsNull(p) {
		return value.NewNull(), nil
	}
	i := p.(*value.Integer).Raw()
	value.Discard(p)

	return value.NewDatetime(time.Unix(0, i).In(flags.GetTimeLocation())), nil
}

func String(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	switch p := args[0].(type) {
	case *value.Boolean:
		return value.NewString(strconv.FormatBool(p.Raw())), nil
	case *value.Ternary:
		return value.NewString(p.Ternary().String()), nil
	case *value.Datetime:
		return value.NewString(p.Format(time.RFC3339Nano)), nil
	default:
		return value.ToString(args[0]), nil
	}
}

func Integer(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	switch p := args[0].(type) {
	case *value.Datetime:
		return value.NewInteger(p.Raw().Unix()), nil
	default:
		return value.ToInteger(args[0]), nil
	}
}

func Float(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	switch p := args[0].(type) {
	case *value.Datetime:
		t := p.Raw()
		f := float64(t.Unix())
		if t.Nanosecond() > 0 {
			f = f + float64(t.Nanosecond())/1e9
		}
		return value.NewFloat(f), nil
	default:
		return value.ToFloat(args[0]), nil
	}
}

func Boolean(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	return value.ToBoolean(args[0]), nil
}

func Ternary(fn parser.Function, args []value.Primary, _ *option.Flags) (value.Primary, error) {
	if len(args) != 1 {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1})
	}

	return value.NewTernary(args[0].Ternary()), nil
}

func Datetime(fn parser.Function, args []value.Primary, flags *option.Flags) (value.Primary, error) {
	conv := func(p value.Primary, location *time.Location) value.Primary {
		if dt := value.ToDatetime(p, flags.DatetimeFormat, location); !value.IsNull(dt) {
			return dt
		}

		if i := value.ToIntegerStrictly(p); !value.IsNull(i) {
			val := i.(*value.Integer).Raw()
			value.Discard(i)
			return value.NewDatetime(value.TimeFromUnixTime(val, 0, location))
		}

		if f := value.ToFloat(p); !value.IsNull(f) {
			val := f.(*value.Float).Raw()
			value.Discard(f)

			if math.IsNaN(val) || math.IsInf(val, 0) {
				return value.NewNull()
			}
			return value.NewDatetime(value.Float64ToTime(val, location))
		}

		return value.NewNull()
	}

	if len(args) < 1 || 2 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{1, 2})
	}

	var location *time.Location
	if 1 < len(args) {
		s := value.ToString(args[1])
		if value.IsNull(s) {
			return nil, NewFunctionInvalidArgumentError(fn, fn.Name, fmt.Sprintf("failed to load time zone %s", args[1].String()))
		}

		l, err := option.GetLocation(s.(*value.String).Raw())
		if err != nil {
			return nil, NewFunctionInvalidArgumentError(fn, fn.Name, fmt.Sprintf("failed to load time zone %s", args[1].String()))
		}
		location = l
	} else {
		location = flags.GetTimeLocation()
	}

	p := conv(args[0], location)

	if len(args) < 2 || value.IsNull(p) {
		return p, nil
	}

	p2 := value.NewDatetime(p.(*value.Datetime).Raw().In(location))
	value.Discard(p)

	return p2, nil
}

func Call(ctx context.Context, fn parser.Function, args []value.Primary) (value.Primary, error) {
	if len(args) < 1 {
		return nil, NewFunctionArgumentLengthErrorWithCustomArgs(fn, fn.Name, "at least 1 argument")
	}

	cmdargs := make([]string, 0, len(args))
	for _, v := range args {
		s, _ := NewStringFormatter().Format("%s", []value.Primary{v})
		cmdargs = append(cmdargs, s)
	}

	buf, err := exec.CommandContext(ctx, cmdargs[0], cmdargs[1:]...).Output()
	if err != nil {
		return nil, NewExternalCommandError(fn, err.Error())
	}
	return value.NewString(string(buf)), nil
}

func Now(scope *ReferenceScope, fn parser.Function, args []value.Primary) (value.Primary, error) {
	if 0 < len(args) {
		return nil, NewFunctionArgumentLengthError(fn, fn.Name, []int{0})
	}
	return value.NewDatetime(scope.Now()), nil
}

func JsonObject(ctx context.Context, scope *ReferenceScope, fn parser.Function) (value.Primary, error) {
	if len(scope.Records) < 1 {
		return value.NewNull(), nil
	}

	view := NewView()
	view.Header = scope.Records[0].view.Header.Copy()
	view.RecordSet = RecordSet{scope.Records[0].view.RecordSet[scope.Records[0].recordIndex].Copy()}

	if len(fn.Args) < 1 {
		if err := view.SelectAllColumns(ctx, scope); err != nil {
			return nil, err
		}
	} else {
		selectClause := parser.SelectClause{
			Fields: fn.Args,
		}
		if err := view.Select(ctx, scope, selectClause); err != nil {
			return nil, err
		}
	}
	if err := view.Fix(ctx, scope.Tx.Flags); err != nil {
		return nil, err
	}

	pathes, err := json.ParsePathes(view.Header.TableColumnNames())
	if err != nil {
		return nil, NewFunctionInvalidArgumentError(fn, fn.Name, err.Error())
	}

	record := make([]value.Primary, view.FieldLen())
	for i := range view.RecordSet[0] {
		record[i] = view.RecordSet[0][i][0]
	}
	structure, _ := json.ConvertRecordValueToJsonStructure(pathes, record)

	encoder := txjson.NewEncoder()
	encoder.EscapeType = scope.Tx.Flags.ExportOptions.JsonEscape
	encoder.LineBreak = scope.Tx.Flags.ExportOptions.LineBreak
	encoder.FloatFormat = jsonFloatFormat(scope.Tx.Flags.ExportOptions.ScientificNotation)

	val, err := encoder.Encode(structure)
	if err != nil {
		return nil, NewDataEncodingError(fmt.Sprintf("%s in JSON encoding", err.Error()))
	}

	return value.NewString(val), nil
}
