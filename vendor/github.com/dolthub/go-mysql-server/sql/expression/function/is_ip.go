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
	"fmt"
	"net"
	"strings"

	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

type IsIPv4 struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*IsIPv4)(nil)
var _ sql.CollationCoercible = (*IsIPv4)(nil)

func NewIsIPv4(val sql.Expression) sql.Expression {
	return &IsIPv4{expression.UnaryExpression{Child: val}}
}

// FunctionName implements sql.FunctionExpression
func (i *IsIPv4) FunctionName() string {
	return "is_ipv4"
}

// Description implements sql.FunctionExpression
func (i *IsIPv4) Description() string {
	return "returns whether argument is an IPv4 address."
}

func (i *IsIPv4) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

func (i *IsIPv4) Type() sql.Type { return types.Boolean }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsIPv4) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *IsIPv4) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewIsIPv4(children[0]), nil
}

// Eval implements the Expression interface
func (i *IsIPv4) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate value
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// If null, return nul
	if val == nil {
		return nil, nil
	}

	// Must be of type string
	switch val.(type) {
	case string:
		// Parse IP address, return false if not valid ip
		ip := net.ParseIP(val.(string))
		if ip == nil {
			return false, nil
		}

		// Check if ip address is valid IPv4 address
		return ip.To4() != nil, nil
	default:
		return false, nil
	}
}

type IsIPv6 struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*IsIPv6)(nil)
var _ sql.CollationCoercible = (*IsIPv6)(nil)

func NewIsIPv6(val sql.Expression) sql.Expression {
	return &IsIPv6{expression.UnaryExpression{Child: val}}
}

// FunctionName implements sql.FunctionExpression
func (i *IsIPv6) FunctionName() string {
	return "is_ipv6"
}

// Description implements sql.FunctionExpression
func (i *IsIPv6) Description() string {
	return "returns whether argument is an IPv6 address."
}

func (i *IsIPv6) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

func (i *IsIPv6) Type() sql.Type { return types.Boolean }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsIPv6) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *IsIPv6) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewIsIPv6(children[0]), nil
}

// Eval implements the Expression interface
func (i *IsIPv6) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate value
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// If null, return nul
	if val == nil {
		return nil, nil
	}

	// Must be of type string
	switch val.(type) {
	case string:
		// Parse IP address, return false if not valid ip
		ip := net.ParseIP(val.(string))
		if ip == nil {
			return false, nil
		}

		// Check if ip address is valid IPv6 address
		return ip.To16() != nil && (strings.Count(val.(string), ":") >= 2), nil
	default:
		return false, nil
	}
}

type IsIPv4Compat struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*IsIPv4Compat)(nil)
var _ sql.CollationCoercible = (*IsIPv4Compat)(nil)

func NewIsIPv4Compat(val sql.Expression) sql.Expression {
	return &IsIPv4Compat{expression.UnaryExpression{Child: val}}
}

// FunctionName implements sql.FunctionExpression
func (i *IsIPv4Compat) FunctionName() string {
	return "is_ipv4_compat"
}

// Description implements sql.FunctionExpression
func (i *IsIPv4Compat) Description() string {
	return "returns whether argument is an IPv4-compatible address."
}

func (i *IsIPv4Compat) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

func (i *IsIPv4Compat) Type() sql.Type { return types.Boolean }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsIPv4Compat) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *IsIPv4Compat) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewIsIPv4Compat(children[0]), nil
}

// Eval implements the Expression interface
func (i *IsIPv4Compat) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate value
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// If null, return nul
	if val == nil {
		return nil, nil
	}

	// Expect to receive a hex encoded string
	switch val.(type) {
	case []byte:
		// Must be of length 16
		if len(val.([]byte)) != 16 {
			return false, nil
		}

		// Check if first 12 bytes are all 0
		for _, b := range val.([]byte)[:12] {
			if b != 0 {
				return false, nil
			}
		}
		return true, nil
	default:
		return false, nil
	}
}

type IsIPv4Mapped struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*IsIPv4Mapped)(nil)
var _ sql.CollationCoercible = (*IsIPv4Mapped)(nil)

func NewIsIPv4Mapped(val sql.Expression) sql.Expression {
	return &IsIPv4Mapped{expression.UnaryExpression{Child: val}}
}

// FunctionName implements sql.FunctionExpression
func (i *IsIPv4Mapped) FunctionName() string {
	return "is_ipv4_mapped"
}

// Description implements sql.FunctionExpression
func (i *IsIPv4Mapped) Description() string {
	return "returns whether argument is an IPv4-mapped address."
}

func (i *IsIPv4Mapped) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

func (i *IsIPv4Mapped) Type() sql.Type { return types.Boolean }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsIPv4Mapped) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *IsIPv4Mapped) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewIsIPv4Mapped(children[0]), nil
}

// Eval implements the Expression interface
func (i *IsIPv4Mapped) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate value
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// If null, return nul
	if val == nil {
		return nil, nil
	}

	// Expect to receive a hex encoded string
	switch val.(type) {
	case []byte:
		// Must be of length 16
		if len(val.([]byte)) != 16 {
			return false, nil
		}

		// Check if first 10 bytes are all 0
		for _, b := range val.([]byte)[:10] {
			if b != 0 {
				return false, nil
			}
		}

		// Bytes 11 and 12 must be 0xFF
		return val.([]byte)[10] == 0xFF && val.([]byte)[11] == 0xFF, nil
	default:
		return false, nil
	}
}
