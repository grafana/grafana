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
	"math"
	"math/bits"
	"reflect"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/encodings"
)

const (
	// SetTypeMaxElements returns the maximum number of elements for the Set type.
	SetTypeMaxElements = 64
)

var (
	setValueType = reflect.TypeOf(uint64(0))
)

type SetType struct {
	hashedValToBit        map[uint64]uint64
	bitToVal              map[uint64]string
	valToBit              map[string]uint64
	maxResponseByteLength uint32
	collation             sql.CollationID
}

var _ sql.SetType = SetType{}
var _ sql.TypeWithCollation = SetType{}
var _ sql.CollationCoercible = SetType{}

// CreateSetType creates a SetType.
func CreateSetType(values []string, collation sql.CollationID) (sql.SetType, error) {
	if len(values) == 0 {
		return nil, fmt.Errorf("number of values may not be zero")
	}
	// A SET column can have a maximum of 64 distinct members.
	if len(values) > SetTypeMaxElements {
		return nil, fmt.Errorf("number of values is too large")
	}

	hashedValToBit := make(map[uint64]uint64)
	bitToVal := make(map[uint64]string)
	valToBit := make(map[string]uint64)
	var maxByteLength uint32
	maxCharLength := collation.Collation().CharacterSet.MaxLength()
	for i, value := range values {
		// SET member values should not themselves contain commas.
		if strings.Contains(value, ",") {
			return nil, fmt.Errorf("values cannot contain a comma")
		}
		if collation != sql.Collation_binary {
			// Trailing spaces are automatically deleted from SET member values in the table definition when a table is created.
			value = strings.TrimRight(value, " ")
		}

		hashedVal, err := collation.HashToUint(value)
		if err != nil {
			return nil, err
		}
		if _, ok := hashedValToBit[hashedVal]; ok {
			return nil, sql.ErrDuplicateEntrySet.New(value)
		}
		bit := uint64(1 << uint64(i))
		hashedValToBit[hashedVal] = bit
		valToBit[value] = bit
		bitToVal[bit] = value
		maxByteLength = maxByteLength + uint32(utf8.RuneCountInString(value)*int(maxCharLength))
		if i != 0 {
			maxByteLength = maxByteLength + uint32(maxCharLength)
		}
	}
	return SetType{
		collation:             collation,
		hashedValToBit:        hashedValToBit,
		bitToVal:              bitToVal,
		valToBit:              valToBit,
		maxResponseByteLength: maxByteLength,
	}, nil
}

// MustCreateSetType is the same as CreateSetType except it panics on errors.
func MustCreateSetType(values []string, collation sql.CollationID) sql.SetType {
	et, err := CreateSetType(values, collation)
	if err != nil {
		panic(err)
	}
	return et
}

// Compare implements Type interface.
func (t SetType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	ai, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bi, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}
	au := ai.(uint64)
	bu := bi.(uint64)

	// If there's an empty string in the set, empty strings should match both 0 and an empty string bit field
	if emptyStringBitField, ok := t.emptyStringBitField(); ok {
		aIsEmptyString := isEmptyString(a)
		bIsEmptyString := isEmptyString(b)
		if aIsEmptyString {
			if bu == 0 || bu == emptyStringBitField {
				return 0, nil
			}
			return -1, nil
		}
		if bIsEmptyString {
			if au == 0 || au == emptyStringBitField {
				return 0, nil
			}
			return 1, nil
		}
	}

	if au < bu {
		return -1, nil
	} else if au > bu {
		return 1, nil
	}
	return 0, nil
}

// Convert implements Type interface.
// Returns the string representing the given value if applicable.
func (t SetType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return nil, sql.InRange, nil
	}

	switch value := v.(type) {
	case int:
		return t.Convert(ctx, uint64(value))
	case uint:
		return t.Convert(ctx, uint64(value))
	case int8:
		return t.Convert(ctx, uint64(value))
	case uint8:
		return t.Convert(ctx, uint64(value))
	case int16:
		return t.Convert(ctx, uint64(value))
	case uint16:
		return t.Convert(ctx, uint64(value))
	case int32:
		return t.Convert(ctx, uint64(value))
	case uint32:
		return t.Convert(ctx, uint64(value))
	case int64:
		return t.Convert(ctx, uint64(value))
	case uint64:
		if value <= t.allValuesBitField() {
			return value, sql.InRange, nil
		}
	case float32:
		return t.Convert(ctx, uint64(value))
	case float64:
		return t.Convert(ctx, uint64(value))
	case decimal.Decimal:
		return t.Convert(ctx, value.BigInt().Uint64())
	case decimal.NullDecimal:
		if !value.Valid {
			return nil, sql.InRange, nil
		}
		return t.Convert(ctx, value.Decimal.BigInt().Uint64())
	case string:
		ret, err := t.convertStringToBitField(value)
		return ret, err == nil, err
	case []byte:
		return t.Convert(ctx, string(value))
	}

	return uint64(0), sql.OutOfRange, sql.ErrConvertingToSet.New(v)
}

// MaxTextResponseByteLength implements the Type interface
func (t SetType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return t.maxResponseByteLength
}

// Equals implements the Type interface.
func (t SetType) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(SetType); ok && t.collation.Equals(ot.collation) && len(t.bitToVal) == len(ot.bitToVal) {
		for bit, val := range t.bitToVal {
			if ot.bitToVal[bit] != val {
				return false
			}
		}
		return true
	}
	return false
}

// Promote implements the Type interface.
func (t SetType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t SetType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}
	convertedValue, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, err
	}
	value, err := t.BitsToString(convertedValue.(uint64))
	if err != nil {
		return sqltypes.Value{}, err
	}

	resultCharset := ctx.GetCharacterSetResults()
	if resultCharset == sql.CharacterSet_Unspecified || resultCharset == sql.CharacterSet_binary {
		resultCharset = t.collation.CharacterSet()
	}
	encodedBytes, ok := resultCharset.Encoder().Encode(encodings.StringToBytes(value))
	if !ok {
		snippet := value
		if len(snippet) > 50 {
			snippet = snippet[:50]
		}
		snippet = strings.ToValidUTF8(snippet, string(utf8.RuneError))
		return sqltypes.Value{}, sql.ErrCharSetFailedToEncode.New(resultCharset.Name(), utf8.ValidString(value), snippet)
	}
	val := encodedBytes

	return sqltypes.MakeTrusted(sqltypes.Set, val), nil
}

// String implements Type interface.
func (t SetType) String() string {
	return t.StringWithTableCollation(sql.Collation_Default)
}

// Type implements Type interface.
func (t SetType) Type() query.Type {
	return sqltypes.Set
}

// ValueType implements Type interface.
func (t SetType) ValueType() reflect.Type {
	return setValueType
}

// Zero implements Type interface.
func (t SetType) Zero() interface{} {
	return uint64(0)
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (t SetType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return t.collation, 4
}

// CharacterSet implements SetType interface.
func (t SetType) CharacterSet() sql.CharacterSetID {
	return t.collation.CharacterSet()
}

// Collation implements SetType interface.
func (t SetType) Collation() sql.CollationID {
	return t.collation
}

// NumberOfElements implements SetType interface.
func (t SetType) NumberOfElements() uint16 {
	return uint16(len(t.hashedValToBit))
}

// BitsToString implements SetType interface.
func (t SetType) BitsToString(v uint64) (string, error) {
	return t.convertBitFieldToString(v)
}

// Values implements SetType interface.
func (t SetType) Values() []string {
	bitEdge := 64 - bits.LeadingZeros64(t.allValuesBitField())
	valArray := make([]string, bitEdge)
	for i := 0; i < bitEdge; i++ {
		bit := uint64(1 << uint64(i))
		valArray[i] = t.bitToVal[bit]
	}
	return valArray
}

// WithNewCollation implements sql.TypeWithCollation interface.
func (t SetType) WithNewCollation(collation sql.CollationID) (sql.Type, error) {
	return CreateSetType(t.Values(), collation)
}

// StringWithTableCollation implements sql.TypeWithCollation interface.
func (t SetType) StringWithTableCollation(tableCollation sql.CollationID) string {
	values := t.Values()
	escapedValues := make([]string, len(values))
	for i, value := range values {
		escapedValues[i] = strings.ReplaceAll(value, "'", "''")
	}
	s := fmt.Sprintf("set('%s')", strings.Join(escapedValues, `','`))
	if t.CharacterSet() != tableCollation.CharacterSet() {
		s += " CHARACTER SET " + t.CharacterSet().String()
	}
	if t.collation != tableCollation {
		s += " COLLATE " + t.collation.String()
	}
	return s
}

// allValuesBitField returns a bit field that references every value that the set contains.
func (t SetType) allValuesBitField() uint64 {
	valCount := uint64(len(t.hashedValToBit))
	if valCount == 64 {
		return math.MaxUint64
	}
	// A set with 3 values will have an upper bound of 8, or 0b1000.
	// 8 - 1 == 7, and 7 is 0b0111, which would map to every value in the set.
	return uint64(1<<valCount) - 1
}

// convertBitFieldToString converts the given bit field into the equivalent comma-delimited string.
func (t SetType) convertBitFieldToString(bitField uint64) (string, error) {
	strBuilder := strings.Builder{}
	bitEdge := 64 - bits.LeadingZeros64(bitField)
	writeCommas := false
	if bitEdge > len(t.bitToVal) {
		return "", sql.ErrTooLargeForSet.New(bitField)
	}
	for i := 0; i < bitEdge; i++ {
		bit := uint64(1 << uint64(i))
		if bit&bitField != 0 {
			val, ok := t.bitToVal[bit]
			if !ok {
				return "", sql.ErrInvalidSetValue.New(bitField)
			}
			if writeCommas {
				strBuilder.WriteByte(',')
			} else {
				writeCommas = true
			}
			strBuilder.WriteString(val)
		}
	}
	return strBuilder.String(), nil
}

// convertStringToBitField converts the given string into a bit field.
func (t SetType) convertStringToBitField(str string) (uint64, error) {
	if str == "" {
		return 0, nil
	}
	var bitField uint64
	_, allowEmptyString := t.emptyStringBitField()
	lastI := 0
	var val string
	for i := 0; i < len(str)+1; i++ {
		if i < len(str) && str[i] != ',' {
			continue
		}

		// empty string should hash to 0, so just skip
		if lastI == i && !allowEmptyString {
			lastI = i + 1
			continue
		}
		val = str[lastI:i]
		lastI = i + 1

		compareVal := val
		if t.collation != sql.Collation_binary {
			compareVal = strings.TrimRight(compareVal, " ")
		}
		if bit, ok := t.valToBit[compareVal]; ok {
			bitField |= bit
			continue
		}
		hashedVal, err := t.collation.HashToUint(compareVal)
		if err == nil {
			if bit, ok := t.hashedValToBit[hashedVal]; ok {
				bitField |= bit
				continue
			}
		}

		asUint, err := strconv.ParseUint(val, 10, 64)
		if err == nil {
			if asUint == 0 {
				continue
			}
			if _, ok := t.bitToVal[asUint]; ok {
				bitField |= asUint
				continue
			}
		}
		return 0, sql.ErrInvalidSetValue.New(val)
	}
	return bitField, nil
}

func (t SetType) emptyStringBitField() (bitField uint64, ok bool) {
	bitField, ok = t.valToBit[""]
	return bitField, ok
}

func isEmptyString(val interface{}) bool {
	switch v := val.(type) {
	case string:
		return v == ""
	}
	return false
}
