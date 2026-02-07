// Copyright 2021 Dolthub, Inc.
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

package function

import (
	"fmt"
	"sync"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/google/uuid"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	"github.com/dolthub/go-mysql-server/sql/variables"
)

// Global state for UUID_SHORT function
var (
	uuidShortMu      sync.Mutex
	uuidShortCounter uint64
)

// UUID()
//
// Returns a Universal Unique Identifier (UUID) generated according to RFC 4122, “A Universally Unique IDentifier (UUID)
// URN Namespace” (http://www.ietf.org/rfc/rfc4122.txt). A UUID is designed as a number that is globally unique in space
// and time. Two calls to UUID() are expected to generate two different values, even if these calls are performed on two
// separate devices not connected to each other.
//
// Warning Although UUID() values are intended to be unique, they are not necessarily unguessable or unpredictable.
// If unpredictability is required, UUID values should be generated some other way. UUID() returns a value that conforms
// to UUID version 1 as described in RFC 4122. The value is a 128-bit number represented as a utf8 string of five
// hexadecimal numbers in aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee format:

// The first three numbers are generated from the low, middle, and high parts of a timestamp. The high part also includes
// the UUID version number.
//
// The fourth number preserves temporal uniqueness in case the timestamp value loses monotonicity
// (for example, due to daylight saving time).
//
// The fifth number is an IEEE 802 node number that provides spatial uniqueness. A random number is substituted if the
// latter is not available (for example, because the host device has no Ethernet card, or it is unknown how to find the
// hardware address of an interface on the host operating system). In this case, spatial uniqueness cannot be guaranteed.
// Nevertheless, a collision should have very low probability.
//
// The MAC address of an interface is taken into account only on FreeBSD, Linux, and Windows. On other operating systems,
// MySQL uses a randomly generated 48-bit number.
// https://dev.mysql.com/doc/refman/8.0/en/miscellaneous-functions.html#function_uuid

type UUIDFunc struct{}

var _ sql.FunctionExpression = &UUIDFunc{}
var _ sql.CollationCoercible = &UUIDFunc{}

func NewUUIDFunc() sql.Expression {
	return &UUIDFunc{}
}

// Description implements sql.FunctionExpression
func (u UUIDFunc) Description() string {
	return "returns a Universal Unique Identifier (UUID)."
}

func (u UUIDFunc) String() string {
	return fmt.Sprintf("%s()", u.FunctionName())
}

func (u UUIDFunc) Type() sql.Type {
	return types.MustCreateStringWithDefaults(sqltypes.VarChar, 36)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (UUIDFunc) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 4
}

func (u UUIDFunc) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return uuid.New().String(), nil
}

func (u UUIDFunc) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(u, len(children), 0)
	}

	return &UUIDFunc{}, nil
}

func (u UUIDFunc) FunctionName() string {
	return "uuid"
}

func (u UUIDFunc) Resolved() bool {
	return true
}

// Children returns the children expressions of this expression.
func (u UUIDFunc) Children() []sql.Expression {
	return nil
}

// IsNullable returns whether the expression can be null.
func (u UUIDFunc) IsNullable() bool {
	return false
}

func (u UUIDFunc) IsNonDeterministic() bool {
	return true
}

// IS_UUID(string_uuid)
//
// Returns 1 if the argument is a valid string-format UUID, 0 if the argument is not a valid UUID, and NULL if the
// argument is NULL.
//
// “Valid” means that the value is in a format that can be parsed. That is, it has the correct length and contains only
// the permitted characters (hexadecimal digits in any lettercase and, optionally, dashes and curly braces).

type IsUUID struct {
	child sql.Expression
}

var _ sql.FunctionExpression = &IsUUID{}
var _ sql.CollationCoercible = &IsUUID{}

func NewIsUUID(arg sql.Expression) sql.Expression {
	return &IsUUID{child: arg}
}

// FunctionName implements sql.FunctionExpression
func (u IsUUID) FunctionName() string {
	return "is_uuid"
}

// Description implements sql.FunctionExpression
func (u IsUUID) Description() string {
	return "returns whether argument is a valid UUID."
}

func (u IsUUID) String() string {
	return fmt.Sprintf("%s(%s)", u.FunctionName(), u.child)
}

func (u IsUUID) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (IsUUID) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (u IsUUID) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := u.child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if str == nil {
		return nil, nil
	}

	switch str := str.(type) {
	case string:
		_, err := uuid.Parse(str)
		if err != nil {
			return false, nil
		}

		return true, nil
	case []byte:
		_, err := uuid.ParseBytes(str)
		if err != nil {
			return false, nil
		}

		return true, nil
	default:
		return false, nil
	}
}

func (u IsUUID) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(u, len(children), 1)
	}

	return &IsUUID{child: children[0]}, nil
}

func (u IsUUID) Resolved() bool {
	return u.child.Resolved()
}

// Children returns the children expressions of this expression.
func (u IsUUID) Children() []sql.Expression {
	return []sql.Expression{u.child}
}

// IsNullable returns whether the expression can be null.
func (u IsUUID) IsNullable() bool {
	return false
}

// UUID_TO_BIN(string_uuid), UUID_TO_BIN(string_uuid, swap_flag)
//
// Converts a string UUID to a binary UUID and returns the result. (The IS_UUID() function description lists the
// permitted string UUID formats.) The return binary UUID is a VARBINARY(16) value. If the UUID argument is NULL,
// the return value is NULL. If any argument is invalid, an error occurs.
//
// UUID_TO_BIN() takes one or two arguments:
//
// The one-argument form takes a string UUID value. The binary result is in the same order as the string argument.
//
// The two-argument form takes a string UUID value and a flag value:
//
// If swap_flag is 0, the two-argument form is equivalent to the one-argument form. The binary result is in the same
// order as the string argument.
//
// If swap_flag is 1, the format of the return value differs: The time-low and time-high parts (the first and third
// groups of hexadecimal digits, respectively) are swapped. This moves the more rapidly varying part to the right and
// can improve indexing efficiency if the result is stored in an indexed column.
//
// Time-part swapping assumes the use of UUID version 1 values, such as are generated by the UUID() function. For UUID
// values produced by other means that do not follow version 1 format, time-part swapping provides no benefit. For
// details about version 1 format, see the UUID() function description.

type UUIDToBin struct {
	inputUUID sql.Expression
	swapFlag  sql.Expression
}

var _ sql.FunctionExpression = (*UUIDToBin)(nil)
var _ sql.CollationCoercible = (*UUIDToBin)(nil)

func NewUUIDToBin(args ...sql.Expression) (sql.Expression, error) {
	switch len(args) {
	case 1:
		return &UUIDToBin{inputUUID: args[0]}, nil
	case 2:
		return &UUIDToBin{inputUUID: args[0], swapFlag: args[1]}, nil
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("UUID_TO_BIN", "1 or 2", len(args))
	}
}

// Description implements sql.FunctionExpression
func (ub UUIDToBin) Description() string {
	return "converts string UUID to binary."
}

func (ub UUIDToBin) String() string {
	if ub.swapFlag != nil {
		return fmt.Sprintf("UUID_TO_BIN(%s, %s)", ub.inputUUID, ub.swapFlag)
	} else {
		return fmt.Sprintf("UUID_TO_BIN(%s)", ub.inputUUID)
	}
}

func (ub UUIDToBin) Type() sql.Type {
	return types.MustCreateBinary(query.Type_VARBINARY, int64(16))
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (UUIDToBin) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (ub *UUIDToBin) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := ub.inputUUID.Eval(ctx, row)
	if err != nil {
		return 0, err
	}

	// Get the inputted uuid as a string.
	converted, _, err := types.LongText.Convert(ctx, str)
	if err != nil {
		return nil, err
	}

	// If the UUID argument is NULL, the return value is NULL.
	if converted == nil {
		return nil, nil
	}

	uuidAsStr, ok := converted.(string)
	if !ok {
		return nil, fmt.Errorf("invalid data format passed to UUID_TO_BIN")
	}

	parsed, err := uuid.Parse(uuidAsStr)
	if err != nil {
		return nil, sql.ErrUuidUnableToParse.New(uuidAsStr, err.Error())
	}

	// If no swap flag is passed we can return uuid's byte format as is.
	if ub.swapFlag == nil {
		bt, err := parsed.MarshalBinary()
		if err != nil {
			return nil, err
		}
		return bt, nil
	}

	sf, err := ub.swapFlag.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	sf, _, err = types.Int8.Convert(ctx, sf)
	if err != nil {
		return nil, err
	}

	// If the swap flag is 0 we can return uuid's byte format as is.
	if sf == nil || sf.(int8) == 0 {
		bt, err := parsed.MarshalBinary()
		if err != nil {
			return nil, err
		}

		return bt, nil
	} else if sf.(int8) == 1 {
		encoding := swapUUIDBytes(parsed)
		return encoding, nil
	} else {
		return nil, fmt.Errorf("UUID_TO_BIN received invalid swap flag")
	}
}

// swapUUIDBytes swaps the time-low and time-high parts (the first and third groups of hexadecimal digits, respectively)
func swapUUIDBytes(cur uuid.UUID) []byte {
	ret := make([]byte, 16)

	copy(ret[0:2], cur[6:8])
	copy(ret[2:4], cur[4:6])
	copy(ret[4:8], cur[0:4])
	copy(ret[8:], cur[8:])

	return ret
}

func (ub UUIDToBin) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewUUIDToBin(children...)
}

func (ub UUIDToBin) FunctionName() string {
	return "uuid_to_bin"
}

func (ub UUIDToBin) Resolved() bool {
	return ub.inputUUID.Resolved()
}

// Children returns the children expressions of this expression.
func (ub UUIDToBin) Children() []sql.Expression {
	if ub.swapFlag == nil {
		return []sql.Expression{ub.inputUUID}
	}

	return []sql.Expression{ub.inputUUID, ub.swapFlag}
}

// IsNullable returns whether the expression can be null.
func (ub UUIDToBin) IsNullable() bool {
	return false
}

// BIN_TO_UUID(binary_uuid), BIN_TO_UUID(binary_uuid, swap_flag)

// BIN_TO_UUID() is the inverse of UUID_TO_BIN(). It converts a binary UUID to a string UUID and returns the result.
// The binary value should be a UUID as a VARBINARY(16) value. The return value is a utf8 string of five hexadecimal
// numbers separated by dashes. (For details about this format, see the UUID() function description.) If the UUID
// argument is NULL, the return value is NULL. If any argument is invalid, an error occurs.

// BIN_TO_UUID() takes one or two arguments:

// The one-argument form takes a binary UUID value. The UUID value is assumed not to have its time-low and time-high
// parts swapped. The string result is in the same order as the binary argument.

//The two-argument form takes a binary UUID value and a swap-flag value:
//
//If swap_flag is 0, the two-argument form is equivalent to the one-argument form. The string result is in the same
//order as the binary argument.
//
//If swap_flag is 1, the UUID value is assumed to have its time-low and time-high parts swapped. These parts are
//swapped back to their original position in the result value.

type BinToUUID struct {
	inputBinary sql.Expression
	swapFlag    sql.Expression
}

var _ sql.FunctionExpression = (*BinToUUID)(nil)
var _ sql.CollationCoercible = (*BinToUUID)(nil)

func NewBinToUUID(args ...sql.Expression) (sql.Expression, error) {
	switch len(args) {
	case 1:
		return &BinToUUID{inputBinary: args[0]}, nil
	case 2:
		return &BinToUUID{inputBinary: args[0], swapFlag: args[1]}, nil
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("BIN_TO_UUID", "1 or 2", len(args))
	}
}

// FunctionName implements sql.FunctionExpression
func (bu BinToUUID) FunctionName() string {
	return "bin_to_uuid"
}

// Description implements sql.FunctionExpression
func (bu BinToUUID) Description() string {
	return "converts a binary UUID to a string UUID and returns the result."
}

func (bu BinToUUID) String() string {
	if bu.swapFlag != nil {
		return fmt.Sprintf("BIN_TO_UUID(%s, %s)", bu.inputBinary, bu.swapFlag)
	} else {
		return fmt.Sprintf("BIN_TO_UUID(%s)", bu.inputBinary)
	}
}

func (bu BinToUUID) Type() sql.Type {
	return types.MustCreateStringWithDefaults(sqltypes.VarChar, 36)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (BinToUUID) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 4
}

func (bu BinToUUID) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	str, err := bu.inputBinary.Eval(ctx, row)
	if err != nil {
		return 0, err
	}

	if str == nil {
		return nil, nil
	}

	// Get the inputted uuid as a string.
	converted, _, err := types.MustCreateBinary(query.Type_VARBINARY, int64(16)).Convert(ctx, str)
	if err != nil {
		return nil, err
	}

	asBytes, ok := converted.([]byte)
	if !ok {
		return nil, fmt.Errorf("invalid data format passed to BIN_TO_UUID")
	}

	parsed, err := uuid.FromBytes(asBytes)
	if err != nil {
		return nil, sql.ErrUuidUnableToParse.New(asBytes, err.Error())
	}

	// If no swap flag is passed we can return uuid's string format as is.
	if bu.swapFlag == nil {
		return parsed.String(), nil
	}

	sf, err := bu.swapFlag.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	sf, _, err = types.Int8.Convert(ctx, sf)
	if err != nil {
		return nil, err
	}

	// If the swap flag is 0 we can return uuid's string format as is.
	if sf.(int8) == 0 {
		return parsed.String(), nil
	} else if sf.(int8) == 1 {
		encoding := unswapUUIDBytes(parsed)
		parsed, err = uuid.FromBytes(encoding)

		if err != nil {
			return nil, err
		}

		return parsed.String(), nil
	} else {
		return nil, fmt.Errorf("UUID_TO_BIN received invalid swap flag")
	}
}

// unswapUUIDBytes unswaps the time-low and time-high parts (the third and first groups of hexadecimal digits, respectively)
func unswapUUIDBytes(cur uuid.UUID) []byte {
	ret := make([]byte, 16)

	copy(ret[0:4], cur[4:8])
	copy(ret[4:6], cur[2:4])
	copy(ret[6:8], cur[0:2])
	copy(ret[8:], cur[8:])

	return ret
}

func (bu BinToUUID) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewBinToUUID(children...)
}

func (bu BinToUUID) Resolved() bool {
	return bu.inputBinary.Resolved()
}

// Children returns the children expressions of this expression.
func (bu BinToUUID) Children() []sql.Expression {
	if bu.swapFlag == nil {
		return []sql.Expression{bu.inputBinary}
	}

	return []sql.Expression{bu.inputBinary, bu.swapFlag}
}

// IsNullable returns whether the expression can be null.
func (bu BinToUUID) IsNullable() bool {
	return false
}

// UUID_SHORT()
//
// Returns a "short" universal identifier as a 64-bit unsigned integer. Values returned by UUID_SHORT() differ from the
// string-format 128-bit identifiers returned by the UUID() function and have different uniqueness properties. The value
// of UUID_SHORT() is guaranteed to be unique if the following conditions hold:
//
// The server_id value of the current server is between 0 and 255 and is unique among your set of source and replica servers
//
// The UUID_SHORT() return value is constructed this way:
//   (server_id & 255) << 56
// + (server_startup_time_in_seconds << 24)
// + incremented_variable++;
//
// Note: UUID_SHORT() does not work with statement-based replication.
// https://dev.mysql.com/doc/refman/8.4/en/miscellaneous-functions.html#function_uuid-short

type UUIDShortFunc struct{}

var _ sql.FunctionExpression = &UUIDShortFunc{}
var _ sql.CollationCoercible = &UUIDShortFunc{}

func NewUUIDShortFunc() sql.Expression {
	return &UUIDShortFunc{}
}

// Description returns a human-readable description of the UUID_SHORT function.
func (u *UUIDShortFunc) Description() string {
	return "returns a short universal identifier as a 64-bit unsigned integer."
}

// String returns a string representation of the UUID_SHORT function call.
func (u *UUIDShortFunc) String() string {
	return "UUID_SHORT()"
}

// Type returns the data type of the UUID_SHORT function result (Uint64).
func (u *UUIDShortFunc) Type() sql.Type {
	return types.Uint64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (u *UUIDShortFunc) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval generates a 64-bit UUID_SHORT value using server_id, startup time, and counter.
func (u *UUIDShortFunc) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	uuidShortMu.Lock()
	defer uuidShortMu.Unlock()

	uuidShortCounter++

	serverID := uint64(1) // Default fallback
	if _, val, ok := sql.SystemVariables.GetGlobal("server_id"); ok {
		if serverIDVal, ok := val.(uint32); ok {
			serverID = uint64(serverIDVal)
		}
	}

	// Construct the UUID_SHORT value according to MySQL specification:
	result := ((serverID & 255) << 56) + (uint64(variables.ServerStartUpTime.Unix()) << 24) + uuidShortCounter
	return result, nil
}

// WithChildren returns a new UUID_SHORT function with the given children (must be empty).
func (u *UUIDShortFunc) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(u, len(children), 0)
	}

	return &UUIDShortFunc{}, nil
}

// FunctionName returns the name of the UUID_SHORT function.
func (u *UUIDShortFunc) FunctionName() string {
	return "UUID_SHORT"
}

// Resolved returns true since UUID_SHORT has no dependencies to resolve.
func (u *UUIDShortFunc) Resolved() bool {
	return true
}

// Children returns the children expressions of this expression.
func (u *UUIDShortFunc) Children() []sql.Expression {
	return nil
}

// IsNullable returns false since UUID_SHORT always returns a value.
func (u *UUIDShortFunc) IsNullable() bool {
	return false
}

// IsNonDeterministic returns true since UUID_SHORT generates different values on each call.
func (u *UUIDShortFunc) IsNonDeterministic() bool {
	return true
}
