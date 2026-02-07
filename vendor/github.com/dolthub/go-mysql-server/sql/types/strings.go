// Copyright 2022 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package types

import (
	"context"
	"fmt"
	"reflect"
	"strconv"
	strings2 "strings"
	"time"
	"unicode/utf8"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/encodings"
)

const (
	charBinaryMax       = 255
	varcharVarbinaryMax = 65_535
	MaxRowLength        = 65_535

	TinyTextBlobMax   = charBinaryMax
	TextBlobMax       = varcharVarbinaryMax
	MediumTextBlobMax = 16_777_215
	LongTextBlobMax   = int64(4_294_967_295)

	// Constants for charset validation
	asciiMax            = 127
	asciiMin            = 32
	invalidByteFormat   = "\\x%02X"
	fallbackInvalidByte = "\\x00"
)

// Context keys for passing column information during conversion
type contextKey string

const (
	ColumnNameKey contextKey = "column_name"
	RowNumberKey  contextKey = "row_number"
)

var (
	// ErrLengthTooLarge is thrown when a string's length is too large given the other parameters.
	ErrLengthTooLarge    = errors.NewKind("length is %v but max allowed is %v")
	ErrLengthBeyondLimit = errors.NewKind("string '%v' is too large for column '%v'")
	ErrBinaryCollation   = errors.NewKind("binary types must have the binary collation: %v")
	ErrBadCharsetString  = errors.NewKind("Incorrect string value: '%v' for column '%s' at row %d")

	TinyText   = MustCreateStringWithDefaults(sqltypes.Text, TinyTextBlobMax)
	Text       = MustCreateStringWithDefaults(sqltypes.Text, TextBlobMax)
	MediumText = MustCreateStringWithDefaults(sqltypes.Text, MediumTextBlobMax)
	LongText   = MustCreateStringWithDefaults(sqltypes.Text, LongTextBlobMax)
	TinyBlob   = MustCreateBinary(sqltypes.Blob, TinyTextBlobMax)
	Blob       = MustCreateBinary(sqltypes.Blob, TextBlobMax)
	MediumBlob = MustCreateBinary(sqltypes.Blob, MediumTextBlobMax)
	LongBlob   = MustCreateBinary(sqltypes.Blob, LongTextBlobMax)

	VarChar   = MustCreateStringWithDefaults(sqltypes.VarChar, varcharVarbinaryMax)
	VarBinary = MustCreateBinary(sqltypes.VarBinary, varcharVarbinaryMax)

	stringValueType = reflect.TypeOf(string(""))
	byteValueType   = reflect.TypeOf(([]byte)(nil))
)

type StringType struct {
	maxCharLength int64
	maxByteLength int64
	baseType      query.Type
	collation     sql.CollationID
}

var _ sql.StringType = StringType{}
var _ sql.TypeWithCollation = StringType{}
var _ sql.CollationCoercible = StringType{}

// CreateString creates a new StringType based on the specified type, length, and collation. Length is interpreted as
// the length of bytes in the new StringType for SQL types that are based on bytes (i.e. TEXT, BLOB, BINARY, and
// VARBINARY). For all other char-based SQL types, length is interpreted as the length of chars in the new
// StringType (i.e. CHAR, and VARCHAR).
func CreateString(baseType query.Type, length int64, collation sql.CollationID) (sql.StringType, error) {
	// TODO: remove character set and collation validity checks once all collations have been implemented (delete errors as well)
	if collation.CharacterSet().Encoder() == nil {
		return nil, sql.ErrCharSetNotYetImplementedTemp.New(collation.CharacterSet().Name())
	} else if collation.Sorter() == nil {
		return nil, sql.ErrCollationNotYetImplementedTemp.New(collation.Name())
	}

	// Check the base type first and fail immediately if it's unknown
	switch baseType {
	case sqltypes.Char, sqltypes.Binary, sqltypes.VarChar, sqltypes.VarBinary, sqltypes.Text, sqltypes.Blob:
	default:
		return nil, sql.ErrInvalidBaseType.New(baseType.String(), "string")
	}

	// We accept a length of zero, but a negative length is not valid
	if length < 0 {
		return nil, fmt.Errorf("length of %v is less than the minimum of 0", length)
	}

	switch baseType {
	case sqltypes.Binary, sqltypes.VarBinary, sqltypes.Blob:
		if collation != sql.Collation_binary {
			return nil, ErrBinaryCollation.New(collation.Name())
		}
	}

	// If the CharacterSet is binary, then we convert the type to the binary equivalent
	if collation.Equals(sql.Collation_binary) {
		switch baseType {
		case sqltypes.Char:
			baseType = sqltypes.Binary
		case sqltypes.VarChar:
			baseType = sqltypes.VarBinary
		case sqltypes.Text:
			baseType = sqltypes.Blob
		}
	}

	// Determine the max byte length and max char length based on whether the base type is byte-based or char-based
	charsetMaxLength := collation.CharacterSet().MaxLength()
	maxCharLength := length
	maxByteLength := length
	switch baseType {
	case sqltypes.Char, sqltypes.VarChar:
		maxByteLength = length * charsetMaxLength
	case sqltypes.Binary, sqltypes.VarBinary, sqltypes.Text, sqltypes.Blob:
		maxCharLength = length / charsetMaxLength
	}

	// Make sure that length is valid depending on the base type, since they each handle lengths differently
	switch baseType {
	case sqltypes.Char:
		if maxCharLength > charBinaryMax {
			return nil, ErrLengthTooLarge.New(length, charBinaryMax)
		}
	case sqltypes.VarChar:
		if maxCharLength > varcharVarbinaryMax {
			return nil, ErrLengthTooLarge.New(length, varcharVarbinaryMax/charsetMaxLength)
		}
	case sqltypes.Binary:
		if maxByteLength > charBinaryMax {
			return nil, ErrLengthTooLarge.New(length, charBinaryMax)
		}
	case sqltypes.VarBinary:
		// VarBinary fields transmitted over the wire could be for a VarBinary field,
		// or a JSON field, so we validate against JSON's larger limit (1GB)
		// instead of VarBinary's smaller limit (65k).
		if maxByteLength > MaxJsonFieldByteLength {
			return nil, ErrLengthTooLarge.New(length, MaxJsonFieldByteLength/charsetMaxLength)
		}
	case sqltypes.Text, sqltypes.Blob:
		if maxByteLength > LongTextBlobMax {
			return nil, ErrLengthTooLarge.New(length, LongTextBlobMax)
		}
		if maxByteLength <= TinyTextBlobMax {
			maxByteLength = TinyTextBlobMax
			maxCharLength = TinyTextBlobMax / charsetMaxLength
		} else if maxByteLength <= TextBlobMax {
			maxByteLength = TextBlobMax
			maxCharLength = TextBlobMax / charsetMaxLength
		} else if maxByteLength <= MediumTextBlobMax {
			maxByteLength = MediumTextBlobMax
			maxCharLength = MediumTextBlobMax / charsetMaxLength
		} else {
			maxByteLength = LongTextBlobMax
			maxCharLength = LongTextBlobMax / charsetMaxLength
		}
	}

	return StringType{
		maxCharLength: maxCharLength,
		maxByteLength: maxByteLength,
		baseType:      baseType,
		collation:     collation,
	}, nil
}

// MustCreateString is the same as CreateString except it panics on errors.
func MustCreateString(baseType query.Type, length int64, collation sql.CollationID) sql.StringType {
	st, err := CreateString(baseType, length, collation)
	if err != nil {
		panic(err)
	}
	return st
}

// CreateStringWithDefaults creates a StringType with the default character set and collation of the given size.
func CreateStringWithDefaults(baseType query.Type, length int64) (sql.StringType, error) {
	return CreateString(baseType, length, sql.Collation_Default)
}

// MustCreateStringWithDefaults creates a StringType with the default CharacterSet and Collation.
func MustCreateStringWithDefaults(baseType query.Type, length int64) sql.StringType {
	return MustCreateString(baseType, length, sql.Collation_Default)
}

// CreateBinary creates a StringType with a binary collation and character set of the given size.
func CreateBinary(baseType query.Type, lengthHint int64) (sql.StringType, error) {
	return CreateString(baseType, lengthHint, sql.Collation_binary)
}

// MustCreateBinary is the same as CreateBinary except it panics on errors.
func MustCreateBinary(baseType query.Type, lengthHint int64) sql.StringType {
	return MustCreateString(baseType, lengthHint, sql.Collation_binary)
}

// CreateTinyText creates a TINYTEXT with the given collation.
func CreateTinyText(collation sql.CollationID) sql.StringType {
	return MustCreateString(sqltypes.Text, TinyTextBlobMax/collation.CharacterSet().MaxLength(), collation)
}

// CreateText creates a TEXT with the given collation.
func CreateText(collation sql.CollationID) sql.StringType {
	return MustCreateString(sqltypes.Text, TextBlobMax/collation.CharacterSet().MaxLength(), collation)
}

// CreateMediumText creates a MEDIUMTEXT with the given collation.
func CreateMediumText(collation sql.CollationID) sql.StringType {
	return MustCreateString(sqltypes.Text, MediumTextBlobMax/collation.CharacterSet().MaxLength(), collation)
}

// CreateLongText creates a LONGTEXT with the given collation.
func CreateLongText(collation sql.CollationID) sql.StringType {
	return MustCreateString(sqltypes.Text, LongTextBlobMax/collation.CharacterSet().MaxLength(), collation)
}

// MaxTextResponseByteLength implements the Type interface
func (t StringType) MaxTextResponseByteLength(ctx *sql.Context) uint32 {
	// For TEXT types, MySQL returns the maxByteLength multiplied by the size of the largest
	// multibyte character in the associated charset for the maximum field bytes in the response
	// metadata.
	// The one exception is LongText types, which cannot be multiplied by a multibyte char multiplier,
	// since the max bytes field in a column definition response over the wire is a uint32 and multiplying
	// longTextBlobMax by anything over 1 would cause it to overflow.
	if t.baseType == sqltypes.Text && t.maxByteLength != LongTextBlobMax {
		characterSetResults := ctx.GetCharacterSetResults()
		charsetMaxLength := uint32(characterSetResults.MaxLength())
		return uint32(t.maxByteLength) * charsetMaxLength
	} else {
		return uint32(t.maxByteLength)
	}
}

func (t StringType) Length() int64 {
	return t.maxCharLength
}

// Compare implements Type interface.
func (t StringType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	var as string
	var bs string
	var ok bool
	if as, ok = a.(string); !ok {
		ai, _, err := t.Convert(ctx, a)
		if err != nil {
			return 0, err
		}
		ai, err = sql.UnwrapAny(ctx, ai)
		if err != nil {
			return 0, err
		}

		if IsBinaryType(t) {
			as = encodings.BytesToString(ai.([]byte))
		} else {
			as = ai.(string)
		}
	}
	if bs, ok = b.(string); !ok {
		bi, _, err := t.Convert(ctx, b)
		if err != nil {
			return 0, err
		}
		bi, err = sql.UnwrapAny(ctx, bi)
		if err != nil {
			return 0, err
		}
		if IsBinaryType(t) {
			bs = encodings.BytesToString(bi.([]byte))
		} else {
			bs = bi.(string)
		}
	}

	encoder := t.collation.CharacterSet().Encoder()
	getRuneWeight := t.collation.Sorter()
	for len(as) > 0 && len(bs) > 0 {
		ar, aRead := encoder.NextRune(as)
		br, bRead := encoder.NextRune(bs)
		if aRead == 0 || bRead == 0 || aRead == utf8.RuneError || bRead == utf8.RuneError {
			// TODO: return a real error
			return 0, fmt.Errorf("malformed string encountered while comparing")
		}
		aWeight := getRuneWeight(ar)
		bWeight := getRuneWeight(br)
		if aWeight < bWeight {
			return -1, nil
		} else if aWeight > bWeight {
			return 1, nil
		}
		as = as[aRead:]
		bs = bs[bRead:]
	}

	// Strings are equal up to the compared length, so shorter strings sort before longer strings
	if len(as) < len(bs) {
		return -1, nil
	} else if len(as) > len(bs) {
		return 1, nil
	} else {
		return 0, nil
	}
}

// Convert implements Type interface.
func (t StringType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return nil, sql.InRange, nil
	}

	switch v := v.(type) {
	case sql.StringWrapper:
		if t.baseType == sqltypes.Text && t.maxByteLength >= v.MaxByteLength() {
			return v, sql.InRange, nil
		}
	case sql.BytesWrapper:
		if t.baseType == sqltypes.Blob && t.maxByteLength >= v.MaxByteLength() {
			return v, sql.InRange, nil
		}
	}
	val, err := ConvertToBytes(ctx, v, t, nil)
	if err != nil {
		return nil, sql.OutOfRange, err
	}

	if IsBinaryType(t) {
		// Avoid returning nil
		if len(val) == 0 {
			return []byte{}, sql.InRange, nil
		}
		return val, sql.InRange, nil
	}
	return string(val), sql.InRange, nil

}

func ConvertToString(ctx context.Context, v interface{}, t sql.StringType, dest []byte) (string, error) {
	ret, err := ConvertToBytes(ctx, v, t, dest)
	return string(ret), err
}

func ConvertToBytes(ctx context.Context, v interface{}, t sql.StringType, dest []byte) ([]byte, error) {
	var val []byte
	start := len(dest)
	// Based on the type of the input, convert it into a byte array, writing it into |dest| to avoid an allocation.
	// If the current implementation must make a separate allocation anyway, avoid copying it into dest by replacing
	// |val| entirely (and setting |start| to 0).
	switch s := v.(type) {
	case bool:
		if s {
			val = append(dest, '1')
		} else {
			val = append(dest, '0')
		}
	case float64:
		val = strconv.AppendFloat(dest, s, 'f', -1, 64)
		if len(val) == 2 && val[start] == '-' && val[start+1] == '0' {
			val = val[start+1:]
		}
	case float32:
		val = strconv.AppendFloat(dest, float64(s), 'f', -1, 32)
		if len(val) == 2 && val[start] == '-' && val[start+1] == '0' {
			val = val[start+1:]
		}
	case int:
		val = strconv.AppendInt(dest, int64(s), 10)
	case int8:
		val = strconv.AppendInt(dest, int64(s), 10)
	case int16:
		val = strconv.AppendInt(dest, int64(s), 10)
	case int32:
		val = strconv.AppendInt(dest, int64(s), 10)
	case int64:
		val = strconv.AppendInt(dest, s, 10)
	case uint:
		val = strconv.AppendUint(dest, uint64(s), 10)
	case uint8:
		val = strconv.AppendUint(dest, uint64(s), 10)
	case uint16:
		val = strconv.AppendUint(dest, uint64(s), 10)
	case uint32:
		val = strconv.AppendUint(dest, uint64(s), 10)
	case uint64:
		val = strconv.AppendUint(dest, s, 10)
	case string:
		val = append(dest, s...)
	case []byte:
		// We can avoid copying the slice if this isn't a conversion to BINARY
		// We'll check for that below, immediately before extending the slice.
		val = s
		start = 0
	case time.Time:
		val = s.AppendFormat(dest, sql.TimestampDatetimeLayout)
	case decimal.Decimal:
		val = append(dest, s.StringFixed(s.Exponent()*-1)...)
	case decimal.NullDecimal:
		if !s.Valid {
			return nil, nil
		}
		val = append(dest, s.Decimal.String()...)
	case sql.JSONWrapper:
		var err error
		val, err = JsonToMySqlBytes(ctx, s)
		if err != nil {
			return nil, err
		}
		start = 0
	case sql.Wrapper[string]:
		unwrapped, err := s.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		val = append(val, unwrapped...)
	case sql.Wrapper[[]byte]:
		var err error
		val, err = s.Unwrap(ctx)
		if err != nil {
			return nil, err
		}
		start = 0
	case GeometryValue:
		return s.Serialize(), nil
	default:
		return nil, sql.ErrConvertToSQL.New(s, t)
	}

	// TODO: add this checking to the interface, rather than relying on the StringType implementation
	st, isStringType := t.(StringType)
	if isStringType {
		if st.baseType == sqltypes.Text {
			// for TEXT types, we use the byte length instead of the character length
			if int64(len(val)) > st.maxByteLength {
				return nil, ErrLengthBeyondLimit.New(val, t.String())
			}
		} else {
			if t.CharacterSet().MaxLength() == 1 {
				// if the character set only has a max size of 1, we can just count the bytes
				if int64(len(val)) > st.maxCharLength {
					return nil, ErrLengthBeyondLimit.New(val, t.String())
				}
			} else {
				// TODO: this should count the string's length properly according to the character set
				// convert 'val' string to rune to count the character length, not byte length
				if int64(len(val)) > st.maxCharLength {
					if int64(len([]rune(string(val)))) > st.maxCharLength {
						return nil, ErrLengthBeyondLimit.New(val, t.String())
					}
				}
			}
		}

		if st.baseType == sqltypes.Binary {
			if b, ok := v.([]byte); ok {
				// Make a copy now to avoid overwriting the original allocation.
				val = append(dest, b...)
				start = len(dest)
			}
			val = append(val, make([]byte, int(st.maxCharLength)-len(val))...)
		}
	}
	val = val[start:]

	// TODO: Completely unsure how this should actually be handled.
	// We need to handle the conversion to the correct character set, but we only need to do it once. At this point, we
	// don't know if we've done a conversion from an introducer (https://dev.mysql.com/doc/refman/8.4/en/charset-introducer.html).
	// Additionally, it's unknown if there are valid UTF8 strings that aren't valid for a conversion.
	// It seems like MySQL handles some of this using repertoires, but it seems like a massive refactoring to really get
	// it implemented (https://dev.mysql.com/doc/refman/8.4/en/charset-repertoire.html).
	// On top of that, we internally only work with UTF8MB4 strings, so we'll make a hard assumption that all UTF8
	// strings are valid for all character sets, and that all invalid UTF8 strings have not yet been converted.
	// This isn't correct, but it's a better approximation than the old logic.
	bytesVal := val
	if !IsBinaryType(t) && !utf8.Valid(bytesVal) {
		charset := t.CharacterSet()
		if charset == sql.CharacterSet_utf8mb4 {
			if sqlCtx, ok := ctx.(*sql.Context); ok && sql.LoadSqlMode(sqlCtx).Strict() {
				// Strict mode: reject invalid UTF8
				invalidByte := formatInvalidByteForError(bytesVal)
				colName, rowNum := getColumnContext(ctx)
				return nil, ErrBadCharsetString.New(invalidByte, colName, rowNum)
			} else {
				// Non-strict mode: truncate invalid bytes (MySQL behavior)
				bytesVal = truncateInvalidUTF8(bytesVal)
			}
		} else {
			var ok bool
			if bytesVal, ok = t.CharacterSet().Encoder().Decode(bytesVal); !ok {
				invalidByte := formatInvalidByteForError(bytesVal)
				colName, rowNum := getColumnContext(ctx)
				return nil, ErrBadCharsetString.New(invalidByte, colName, rowNum)
			}
		}
	}

	return bytesVal, nil
}

// getColumnContext extracts column name and row number from context.
func getColumnContext(ctx context.Context) (string, int64) {
	colName := "<unknown>"
	rowNum := int64(0)

	if name, ok := ctx.Value(ColumnNameKey).(string); ok {
		colName = name
	}
	if num, ok := ctx.Value(RowNumberKey).(int64); ok {
		rowNum = num
	}

	return colName, rowNum
}

// truncateInvalidUTF8 truncates byte slice at first invalid UTF8 sequence (MySQL non-strict behavior)
func truncateInvalidUTF8(data []byte) []byte {
	for i := 0; i < len(data); {
		r, size := utf8.DecodeRune(data[i:])
		if r == utf8.RuneError && size == 1 {
			// Invalid UTF8 sequence found, truncate here
			return data[:i]
		}
		i += size
	}
	return data
}

// formatInvalidByteForError formats invalid bytes for MySQL-compatible error messages.
// Shows consecutive invalid bytes, truncating with "..." after 6 bytes.
func formatInvalidByteForError(bytesVal []byte) string {
	if len(bytesVal) == 0 {
		return fallbackInvalidByte
	}

	// Find the first invalid UTF-8 position
	firstInvalidPos := -1
	for i := 0; i < len(bytesVal); {
		r, size := utf8.DecodeRune(bytesVal[i:])
		if r == utf8.RuneError && size == 1 {
			firstInvalidPos = i
			break
		}
		i += size
	}

	// If no invalid bytes found, but we're here due to invalid UTF-8,
	// show the first byte (this handles edge cases)
	if firstInvalidPos == -1 {
		return fmt.Sprintf(invalidByteFormat, bytesVal[0])
	}

	// Build the error string starting from first invalid byte
	var result strings2.Builder
	maxBytesToShow := 6 // MySQL seems to show around 6 bytes before truncating
	remainingBytes := bytesVal[firstInvalidPos:]

	for i, b := range remainingBytes {
		if i >= maxBytesToShow {
			result.WriteString("...")
			break
		}

		// MySQL shows valid ASCII characters as their actual characters,
		// but invalid UTF-8 bytes (> 127) or control characters as hex
		if b >= asciiMin && b <= asciiMax {
			// Printable ASCII character - show as character
			result.WriteByte(b)
		} else {
			// Invalid UTF-8 byte or control character - show as hex
			result.WriteString(fmt.Sprintf(invalidByteFormat, b))
		}
	}

	return result.String()
}

// convertToLongTextString safely converts a value to string using LongText.Convert with nil checking
func convertToLongTextString(ctx context.Context, val interface{}) (string, error) {
	converted, _, err := LongText.Convert(ctx, val)
	if err != nil {
		return "", err
	}
	if converted == nil {
		return "", nil
	}
	return converted.(string), nil
}

// convertEnumToString converts an enum value to its string representation
func convertEnumToString(ctx context.Context, val interface{}, enumType EnumType) (string, error) {
	if enumVal, ok := val.(uint16); ok {
		if enumStr, exists := enumType.At(int(enumVal)); exists {
			return enumStr, nil
		}
		return "", nil
	}
	return convertToLongTextString(ctx, val)
}

// convertSetToString converts a set value to its string representation
func convertSetToString(ctx context.Context, val interface{}, setType SetType) (string, error) {
	if setVal, ok := val.(uint64); ok {
		return setType.BitsToString(setVal)
	}
	return convertToLongTextString(ctx, val)
}

// ConvertToCollatedString returns the given interface as a string, along with its collation. If the Type possess a
// collation, then that collation is returned. If the Type does not possess a collation (such as an integer), then the
// value is converted to a string and the default collation is used. If the value is already a string then no additional
// conversions are made. If the value is a byte slice then a non-copying conversion is made, which means that the
// original byte slice MUST NOT be modified after being passed to this function. If modifications need to be made, then
// you must allocate a new byte slice and pass that new one in.
func ConvertToCollatedString(ctx context.Context, val interface{}, typ sql.Type) (string, sql.CollationID, error) {
	var content string
	var collation sql.CollationID
	var err error
	val, err = sql.UnwrapAny(ctx, val)
	if err != nil {
		return "", sql.Collation_Unspecified, err
	}
	if typeWithCollation, ok := typ.(sql.TypeWithCollation); ok {
		collation = typeWithCollation.Collation()
		if strVal, ok := val.(string); ok {
			content = strVal
		} else if byteVal, ok := val.([]byte); ok {
			content = encodings.BytesToString(byteVal)
		} else {
			switch typ := typ.(type) {
			case EnumType:
				content, err = convertEnumToString(ctx, val, typ)
				if err != nil {
					return "", sql.Collation_Unspecified, err
				}
			case SetType:
				content, err = convertSetToString(ctx, val, typ)
				if err != nil {
					return "", sql.Collation_Unspecified, err
				}
			default:
				content, err = convertToLongTextString(ctx, val)
				if err != nil {
					return "", sql.Collation_Unspecified, err
				}
			}
		}
	} else {
		collation = sql.Collation_Default
		content, err = convertToLongTextString(ctx, val)
		if err != nil {
			return "", sql.Collation_Unspecified, err
		}
	}
	return content, collation, nil
}

// Equals implements the Type interface.
func (t StringType) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(StringType); ok {
		return t.baseType == ot.baseType && t.collation == ot.collation && t.maxCharLength == ot.maxCharLength
	}
	return false
}

// Promote implements the Type interface.
func (t StringType) Promote() sql.Type {
	switch t.baseType {
	case sqltypes.Char, sqltypes.VarChar, sqltypes.Text:
		return MustCreateString(sqltypes.Text, LongTextBlobMax, t.collation)
	case sqltypes.Binary, sqltypes.VarBinary, sqltypes.Blob:
		return LongBlob
	default:
		panic(sql.ErrInvalidBaseType.New(t.baseType.String(), "string"))
	}
}

// SQL implements Type interface.
func (t StringType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	var err error
	if v == nil {
		return sqltypes.NULL, nil
	}

	start := len(dest)
	var val []byte
	if IsBinaryType(t) {
		val, err = ConvertToBytes(ctx, v, t, dest)
		if err != nil {
			return sqltypes.Value{}, err
		}
	} else {
		var valueBytes []byte
		switch v := v.(type) {
		case JSONBytes:
			valueBytes, err = v.GetBytes(ctx)
			if err != nil {
				return sqltypes.Value{}, err
			}
		case []byte:
			valueBytes = v
		case string:
			dest = append(dest, v...)
			valueBytes = dest[start:]
		case int, int8, int16, int32, int64:
			num, _, err := convertToInt64(Int64.(NumberTypeImpl_), v, false)
			if err != nil {
				return sqltypes.Value{}, err
			}
			valueBytes = strconv.AppendInt(dest, num, 10)
		case uint, uint8, uint16, uint32, uint64:
			num, _, err := convertToUint64(Int64.(NumberTypeImpl_), v, false)
			if err != nil {
				return sqltypes.Value{}, err
			}
			valueBytes = strconv.AppendUint(dest, num, 10)
		case bool:
			if v {
				dest = append(dest, '1')
			} else {
				dest = append(dest, '0')
			}
			valueBytes = dest[start:]
		case float64:
			valueBytes = strconv.AppendFloat(dest, v, 'f', -1, 64)
			if valueBytes[start] == '-' {
				valueBytes = valueBytes[start+1:]
			}
		case float32:
			valueBytes = strconv.AppendFloat(dest, float64(v), 'f', -1, 32)
			if valueBytes[start] == '-' {
				valueBytes = valueBytes[start+1:]
			}
		default:
			valueBytes, err = ConvertToBytes(ctx, v, t, dest)
		}
		if t.baseType == sqltypes.Binary {
			val = append(val, make([]byte, int(t.maxCharLength)-len(val))...)
		}
		// Note: MySQL does not validate charset when returning query results.
		// It returns whatever data is stored, allowing users to query and clean up
		// invalid data that may have been inserted through various means.
		// Charset validation should only occur during data insertion/conversion.

		resultCharset := ctx.GetCharacterSetResults()
		if resultCharset == sql.CharacterSet_Unspecified || resultCharset == sql.CharacterSet_binary {
			resultCharset = t.collation.CharacterSet()
		}
		encodedBytes, ok := resultCharset.Encoder().Encode(valueBytes)
		if !ok {
			snippet := valueBytes
			if len(snippet) > 50 {
				snippet = snippet[:50]
			}
			snippetStr := strings2.ToValidUTF8(string(snippet), string(utf8.RuneError))
			return sqltypes.Value{}, sql.ErrCharSetFailedToEncode.New(resultCharset.Name(), utf8.ValidString(snippetStr), snippet)
		}
		val = encodedBytes
	}

	return sqltypes.MakeTrusted(t.baseType, val), nil
}

// String implements Type interface.
func (t StringType) String() string {
	return t.StringWithTableCollation(sql.Collation_Default)
}

// Type implements Type interface.
func (t StringType) Type() query.Type {
	return t.baseType
}

// ValueType implements Type interface.
func (t StringType) ValueType() reflect.Type {
	if IsBinaryType(t) {
		return byteValueType
	}
	return stringValueType
}

// Zero implements Type interface.
func (t StringType) Zero() interface{} {
	return ""
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (t StringType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return t.collation, 4
}

func (t StringType) CharacterSet() sql.CharacterSetID {
	return t.collation.CharacterSet()
}

func (t StringType) Collation() sql.CollationID {
	return t.collation
}

// StringWithTableCollation implements sql.TypeWithCollation interface.
func (t StringType) StringWithTableCollation(tableCollation sql.CollationID) string {
	var s string

	switch t.baseType {
	case sqltypes.Char:
		s = fmt.Sprintf("char(%v)", t.maxCharLength)
	case sqltypes.Binary:
		s = fmt.Sprintf("binary(%v)", t.maxCharLength)
	case sqltypes.VarChar:
		s = fmt.Sprintf("varchar(%v)", t.maxCharLength)
	case sqltypes.VarBinary:
		s = fmt.Sprintf("varbinary(%v)", t.maxCharLength)
	case sqltypes.Text:
		if t.maxByteLength <= TinyTextBlobMax {
			s = "tinytext"
		} else if t.maxByteLength <= TextBlobMax {
			s = "text"
		} else if t.maxByteLength <= MediumTextBlobMax {
			s = "mediumtext"
		} else {
			s = "longtext"
		}
	case sqltypes.Blob:
		if t.maxByteLength <= TinyTextBlobMax {
			s = "tinyblob"
		} else if t.maxByteLength <= TextBlobMax {
			s = "blob"
		} else if t.maxByteLength <= MediumTextBlobMax {
			s = "mediumblob"
		} else {
			s = "longblob"
		}
	}

	if t.CharacterSet() != sql.CharacterSet_binary {
		if t.CharacterSet() != tableCollation.CharacterSet() && t.CharacterSet() != sql.CharacterSet_Unspecified {
			s += " CHARACTER SET " + t.CharacterSet().String()
		}
		if t.collation != tableCollation && t.collation != sql.Collation_Unspecified {
			s += " COLLATE " + t.collation.Name()
		}
	}

	return s
}

// WithNewCollation implements TypeWithCollation interface.
func (t StringType) WithNewCollation(collation sql.CollationID) (sql.Type, error) {
	// Blobs are special as, although they use collations, they don't change like a standard collated type
	if t.baseType == sqltypes.Blob || t.baseType == sqltypes.Binary || t.baseType == sqltypes.VarBinary {
		return t, nil
	}
	return CreateString(t.baseType, t.maxCharLength, collation)
}

// MaxCharacterLength is the maximum character length for this type.
func (t StringType) MaxCharacterLength() int64 {
	return t.maxCharLength
}

// MaxByteLength is the maximum number of bytes that may be consumed by a string that conforms to this type.
func (t StringType) MaxByteLength() int64 {
	return t.maxByteLength
}

// TODO: move me
func AppendAndSliceString(buffer []byte, addition string) (slice []byte) {
	stop := len(buffer)
	buffer = append(buffer, addition...)
	slice = buffer[stop:]
	return
}
