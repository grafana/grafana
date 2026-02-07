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

package plan

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/vitess/go/sqltypes"
)

// Describe is a node that describes its children.
type Describe struct {
	UnaryNode
}

var _ sql.Node = (*Describe)(nil)
var _ sql.CollationCoercible = (*Describe)(nil)

// NewDescribe creates a new Describe node.
func NewDescribe(child sql.Node) *Describe {
	return &Describe{UnaryNode{child}}
}

// Schema implements the Node interface.
func (d *Describe) Schema() sql.Schema {
	return sql.Schema{{
		Name: "name",
		Type: VarChar25000,
	}, {
		Name: "type",
		Type: VarChar25000,
	}}
}

func (d *Describe) IsReadOnly() bool {
	return true
}

// WithChildren implements the Node interface.
func (d *Describe) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}

	return NewDescribe(children[0]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Describe) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (d Describe) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("Describe")
	_ = p.WriteChildren(d.Child.String())
	return p.String()
}

// DescribeQuery returns the description of the query plan.
type DescribeQuery struct {
	UnaryNode
	Format sql.DescribeOptions
}

var _ sql.Node = (*DescribeQuery)(nil)
var _ sql.CollationCoercible = (*DescribeQuery)(nil)

func (d *DescribeQuery) Resolved() bool {
	return d.Child.Resolved()
}

func (d *DescribeQuery) IsReadOnly() bool {
	return true
}

func (d *DescribeQuery) Children() []sql.Node {
	return nil
}

func (d *DescribeQuery) WithChildren(node ...sql.Node) (sql.Node, error) {
	if len(node) > 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(node), 0)
	}
	return d, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DescribeQuery) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// DescribeSchema is the schema returned by a DescribeQuery node.
var DescribeSchema = sql.Schema{
	{Name: "id", Type: types.Uint64},
	{Name: "select_type", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 57)},
	{Name: "table", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 192)},
	{Name: "partitions", Type: types.Text},
	{Name: "type", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 30)},
	{Name: "possible_keys", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 12288)},
	{Name: "key", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 192)},
	{Name: "key_len", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 12288)},
	{Name: "ref", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 3072)},
	{Name: "rows", Type: types.Uint64},
	{Name: "filtered", Type: types.Float64},
	{Name: "Extra", Type: types.MustCreateStringWithDefaults(sqltypes.VarChar, 765)},
}

// DescribePlanSchema is the schema returned by a DescribeQuery node.
var DescribePlanSchema = sql.Schema{
	{Name: "plan", Type: VarChar25000},
}

// NewDescribeQuery creates a new DescribeQuery node.
func NewDescribeQuery(format sql.DescribeOptions, child sql.Node) *DescribeQuery {
	return &DescribeQuery{UnaryNode{Child: child}, format}
}

// Schema implements the Node interface.
func (d *DescribeQuery) Schema() sql.Schema {
	if d.Format.Plan {
		return DescribePlanSchema
	} else {
		return DescribeSchema
	}
}

func (d *DescribeQuery) Describe(options sql.DescribeOptions) string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("DescribeQuery(format=%s)", d.Format)
	options.Estimates = d.Format.Estimates || options.Estimates
	options.Analyze = d.Format.Analyze || options.Analyze
	options.Debug = d.Format.Debug || options.Debug
	_ = pr.WriteChildren(sql.Describe(d.Child, options))

	return pr.String()
}

func (d *DescribeQuery) String() string {
	return d.Describe(sql.DescribeOptions{
		Analyze:   false,
		Estimates: false,
		Debug:     false,
	})
}

func (d *DescribeQuery) DebugString() string {
	return d.Describe(sql.DescribeOptions{
		Analyze:   false,
		Estimates: false,
		Debug:     true,
	})
}

// Query returns the query node being described
func (d *DescribeQuery) Query() sql.Node {
	return d.Child
}

// WithQuery returns a copy of this node with the query node given
func (d *DescribeQuery) WithQuery(child sql.Node) sql.Node {
	res := *d
	res.Child = child
	return &res
}
