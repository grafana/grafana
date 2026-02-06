// Copyright 2020-2021 Dolthub, Inc.
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
	"encoding/binary"
	"fmt"
	"net"
	"reflect"
	"strings"

	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

type InetAton struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*InetAton)(nil)
var _ sql.CollationCoercible = (*InetAton)(nil)

func NewInetAton(val sql.Expression) sql.Expression {
	return &InetAton{expression.UnaryExpression{Child: val}}
}

// FunctionName implements sql.FunctionExpression
func (i *InetAton) FunctionName() string {
	return "inet_aton"
}

// Description implements sql.FunctionExpression
func (i *InetAton) Description() string {
	return "returns the numeric value of an IP address."
}

func (i *InetAton) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

func (i *InetAton) Type() sql.Type {
	return types.Uint32
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*InetAton) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *InetAton) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewInetAton(children[0]), nil
}

func (i *InetAton) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate value
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if given null
	if val == nil {
		return nil, nil
	}

	// Expect to receive an IP address, so convert val into string
	ipstr, err := types.ConvertToString(ctx, val, types.LongText, nil)
	if err != nil {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(val).String())
	}

	// Parse IP address
	ip := net.ParseIP(ipstr)
	if ip == nil {
		// Failed to Parse IP correctly
		ctx.Warn(1411, "Incorrect string value: ''%s'' for function %s", ipstr, i.FunctionName())
		return nil, nil
	}

	// Expect an IPv4 address
	ipv4 := ip.To4()
	if ipv4 == nil {
		// Received invalid IPv4 address (IPv6 address are invalid)
		ctx.Warn(1411, "Incorrect string value: ''%s'' for function %s", ipstr, i.FunctionName())
		return nil, nil
	}

	// Return IPv4 address as uint32
	ipv4int := binary.BigEndian.Uint32(ipv4)
	return ipv4int, nil
}

type Inet6Aton struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Inet6Aton)(nil)
var _ sql.CollationCoercible = (*Inet6Aton)(nil)

func NewInet6Aton(val sql.Expression) sql.Expression {
	return &Inet6Aton{expression.UnaryExpression{Child: val}}
}

// FunctionName implements sql.FunctionExpression
func (i *Inet6Aton) FunctionName() string {
	return "inet6_aton"
}

// Description implements sql.FunctionExpression
func (i *Inet6Aton) Description() string {
	return "returns the numeric value of an IPv6 address."
}

func (i *Inet6Aton) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

func (i *Inet6Aton) Type() sql.Type {
	return types.LongBlob
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Inet6Aton) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (i *Inet6Aton) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewInet6Aton(children[0]), nil
}

func (i *Inet6Aton) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate value
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if given null
	if val == nil {
		return nil, nil
	}

	// Parse IP address
	ipstr := val.(string)
	ip := net.ParseIP(ipstr)
	if ip == nil {
		// Failed to Parse IP correctly
		ctx.Warn(1411, "Incorrect string value: ''%s'' for function %s", ipstr, i.FunctionName())
		return nil, nil
	}

	// if it doesn't contain colons, treat it as ipv4
	if strings.Count(val.(string), ":") < 2 {
		ipv4 := ip.To4()
		return []byte(ipv4), nil
	}

	// Received IPv6 address
	ipv6 := ip.To16()
	if ipv6 == nil {
		// Invalid IPv6 address
		ctx.Warn(1411, "Incorrect string value: ''%s'' for function %s", ipstr, i.FunctionName())
		return nil, nil
	}

	// Return as []byte
	return []byte(ipv6), nil
}

type InetNtoa struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*InetNtoa)(nil)
var _ sql.CollationCoercible = (*InetNtoa)(nil)

func NewInetNtoa(val sql.Expression) sql.Expression {
	return &InetNtoa{expression.UnaryExpression{Child: val}}
}

// FunctionName implements sql.FunctionExpression
func (i *InetNtoa) FunctionName() string {
	return "inet_ntoa"
}

// Description implements sql.FunctionExpression
func (i *InetNtoa) Description() string {
	return "returns the IP address from a numeric value."
}

func (i *InetNtoa) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

func (i *InetNtoa) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*InetNtoa) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

func (i *InetNtoa) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewInetNtoa(children[0]), nil
}

func (i *InetNtoa) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate value
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if given null
	if val == nil {
		return nil, nil
	}

	// Convert val into int
	ipv4int, _, err := types.Int32.Convert(ctx, val)
	if ipv4int != nil && err != nil && !sql.ErrTruncatedIncorrect.Is(err) {
		return nil, sql.ErrInvalidType.New(reflect.TypeOf(val).String())
	}

	// Received a hex string instead of int
	if ipv4int == nil {
		// Create new IPv4
		var ipv4 net.IP = []byte{0, 0, 0, 0}
		return ipv4.String(), nil
	}

	// Create new IPv4, and fill with val
	ipv4 := make(net.IP, 4)
	binary.BigEndian.PutUint32(ipv4, uint32(ipv4int.(int32)))

	return ipv4.String(), nil
}

type Inet6Ntoa struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Inet6Ntoa)(nil)
var _ sql.CollationCoercible = (*Inet6Ntoa)(nil)

func NewInet6Ntoa(val sql.Expression) sql.Expression {
	return &Inet6Ntoa{expression.UnaryExpression{Child: val}}
}

// FunctionName implements sql.FunctionExpression
func (i *Inet6Ntoa) FunctionName() string {
	return "inet6_ntoa"
}

// Description implements sql.FunctionExpression
func (i *Inet6Ntoa) Description() string {
	return "returns the IPv6 address from a numeric value."
}

func (i *Inet6Ntoa) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

func (i *Inet6Ntoa) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Inet6Ntoa) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

func (i *Inet6Ntoa) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewInet6Ntoa(children[0]), nil
}

func (i *Inet6Ntoa) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate value
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return null if given null
	if val == nil {
		return nil, nil
	}

	// Only convert if received string as input
	switch val.(type) {
	case []byte:
		ipbytes := val.([]byte)

		// Exactly 4 bytes, treat as IPv4 address
		if len(ipbytes) == 4 {
			var ipv4 net.IP = ipbytes
			return ipv4.String(), nil
		}

		// There must be exactly 4 or 16 bytes (len == 4 satisfied above)
		if len(ipbytes) != 16 {
			ctx.Warn(1411, "Incorrect string value: ''%s'' for function %s", string(val.([]byte)), i.FunctionName())
			return nil, nil
		}

		// Check to see if it should be printed as IPv6; non-zero within first 10 bytes
		for _, b := range ipbytes[:10] {
			if b != 0 {
				// Create new IPv6
				var ipv6 net.IP = ipbytes
				return ipv6.String(), nil
			}
		}

		// IPv4-compatible (12 bytes of 0x00)
		if ipbytes[10] == 0 && ipbytes[11] == 0 && (ipbytes[12] != 0 || ipbytes[13] != 0) {
			var ipv4 net.IP = ipbytes[12:]
			return "::" + ipv4.String(), nil
		}

		// IPv4-mapped (10 bytes of 0x00 followed by 2 bytes of 0xFF)
		if ipbytes[10] == 0xFF && ipbytes[11] == 0xFF {
			var ipv4 net.IP = ipbytes[12:]
			return "::ffff:" + ipv4.String(), nil
		}

		// Print as IPv6 by default
		var ipv6 net.IP = ipbytes
		return ipv6.String(), nil
	default:
		ctx.Warn(1411, "Incorrect string value: ''%v'' for function %s", val, i.FunctionName())
		return nil, nil
	}
}
