// Copyright 2024 Dolthub, Inc.
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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// GetFormat returns the time format string for the specified region
type GetFormat struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*GetFormat)(nil)
var _ sql.CollationCoercible = (*GetFormat)(nil)

// NewGetFormat creates a new GetFormat expression.
func NewGetFormat(e1, e2 sql.Expression) sql.Expression {
	return &GetFormat{
		expression.BinaryExpressionStub{
			LeftChild:  e1,
			RightChild: e2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (g *GetFormat) FunctionName() string {
	return "get_format"
}

// Description implements sql.FunctionExpression
func (g *GetFormat) Description() string {
	return "returns the time format string for the specified region"
}

// Type implements the Expression interface.
func (g *GetFormat) Type() sql.Type {
	return types.Text
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*GetFormat) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 5
}

func (g *GetFormat) String() string {
	return fmt.Sprintf("%s(%s, %s)", g.FunctionName(), g.LeftChild, g.RightChild)
}

// WithChildren implements the Expression interface.
func (g *GetFormat) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(g, len(children), 2)
	}
	return NewGetFormat(children[0], children[1]), nil
}

var formats = map[string]map[string]string{
	"date": {
		"usa":      "%m.%d.%Y",
		"jis":      "%Y-%m-%d",
		"iso":      "%Y-%m-%d",
		"eur":      "%d.%m.%Y",
		"internal": "%Y%m%d",
	},
	"datetime": {
		"usa":      "%Y-%m-%d %H.%i.%s",
		"jis":      "%Y-%m-%d %H:%i:%s",
		"iso":      "%Y-%m-%d %H:%i:%s",
		"eur":      "%Y-%m-%d %H.%i.%s",
		"internal": "%Y%m%d%H%i%s",
	},
	"time": {
		"usa":      "%h:%i:%s %p",
		"jis":      "%H:%i:%s",
		"iso":      "%H:%i:%s",
		"eur":      "%H.%i.%s",
		"internal": "%H%i%s",
	},
	"timestamp": {
		"usa":      "%Y-%m-%d %H.%i.%s",
		"jis":      "%Y-%m-%d %H:%i:%s",
		"iso":      "%Y-%m-%d %H:%i:%s",
		"eur":      "%Y-%m-%d %H.%i.%s",
		"internal": "%Y%m%d%H%i%s",
	},
}

// Eval implements the Expression interface.
func (g *GetFormat) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if g.LeftChild == nil || g.RightChild == nil {
		return nil, nil
	}

	left, err := g.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	right, err := g.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if left == nil || right == nil {
		return nil, nil
	}

	timeType, ok := left.(string)
	if !ok {
		return nil, nil
	}
	region, ok := right.(string)
	if !ok {
		return nil, nil
	}
	format, ok := formats[strings.ToLower(timeType)][strings.ToLower(region)]
	if !ok {
		return nil, nil
	}
	return format, nil
}
