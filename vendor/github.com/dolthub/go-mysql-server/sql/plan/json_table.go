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
	"fmt"
	"io"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

type jsonTablePartition struct {
	key []byte
}

var _ sql.Partition = &jsonTablePartition{}

func (j *jsonTablePartition) Key() []byte {
	return j.key
}

type jsonTablePartitionIter struct {
	keys [][]byte
	pos  int
}

var _ sql.PartitionIter = &jsonTablePartitionIter{}

func (j *jsonTablePartitionIter) Close(ctx *sql.Context) error {
	return nil
}

func (j *jsonTablePartitionIter) Next(ctx *sql.Context) (sql.Partition, error) {
	if j.pos >= len(j.keys) {
		return nil, io.EOF
	}

	key := j.keys[j.pos]
	j.pos++
	return &jsonTablePartition{key}, nil
}

type JSONTableColOpts struct {
	Type         sql.Type
	DefEmptyVal  sql.Expression
	DefErrorVal  sql.Expression
	Name         string
	ForOrd       bool
	Exists       bool
	ErrorOnError bool
	ErrorOnEmpty bool
}

type JSONTableCol struct {
	Path       string
	Opts       *JSONTableColOpts
	NestedCols []JSONTableCol
}

func (c *JSONTableCol) Resolved() bool {
	for _, col := range c.NestedCols {
		if !col.Resolved() {
			return false
		}
	}

	return c.Opts == nil || (c.Opts.DefErrorVal.Resolved() && c.Opts.DefEmptyVal.Resolved())
}

func (c *JSONTableCol) Expressions() []sql.Expression {
	if c.Opts != nil {
		return []sql.Expression{c.Opts.DefEmptyVal, c.Opts.DefErrorVal}
	}
	var exprs []sql.Expression
	for _, col := range c.NestedCols {
		exprs = append(exprs, col.Expressions()...)
	}
	return exprs
}

func (c *JSONTableCol) WithExpressions(exprs []sql.Expression, idx *int) error {
	i := *idx
	if i >= len(exprs) {
		return fmt.Errorf("not enough expressions for JSONTableCol")
	}
	if c.Opts != nil {
		c.Opts.DefEmptyVal = exprs[i]
		c.Opts.DefErrorVal = exprs[i+1]
		*idx += 2
		return nil
	}
	for _, col := range c.NestedCols {
		if err := col.WithExpressions(exprs, idx); err != nil {
			return err
		}
	}
	return nil
}

type JSONTable struct {
	DataExpr  sql.Expression
	b         sql.NodeExecBuilder
	colset    sql.ColSet
	TableName string
	RootPath  string
	Cols      []JSONTableCol
	id        sql.TableId
}

var _ sql.Table = (*JSONTable)(nil)
var _ sql.Node = (*JSONTable)(nil)
var _ sql.Expressioner = (*JSONTable)(nil)
var _ sql.CollationCoercible = (*JSONTable)(nil)
var _ TableIdNode = (*JSONTable)(nil)
var _ sql.RenameableNode = (*JSONTable)(nil)

// WithId implements sql.TableIdNode
func (t *JSONTable) WithId(id sql.TableId) TableIdNode {
	ret := *t
	ret.id = id
	return &ret
}

// Id implements sql.TableIdNode
func (t *JSONTable) Id() sql.TableId {
	return t.id
}

// WithColumns implements sql.TableIdNode
func (t *JSONTable) WithColumns(set sql.ColSet) TableIdNode {
	ret := *t
	ret.colset = set
	return &ret
}

// Columns implements sql.TableIdNode
func (t *JSONTable) Columns() sql.ColSet {
	return t.colset
}

// Name implements the sql.Table interface
func (t *JSONTable) Name() string {
	return t.TableName
}

func (t *JSONTable) WithName(s string) sql.Node {
	ret := *t
	ret.TableName = s
	return &ret
}

func (t *JSONTable) IsReadOnly() bool {
	return true
}

// String implements the sql.Table interface
func (t *JSONTable) String() string {
	return t.TableName
}

// DebugString implements the sql.Table interface
func (t *JSONTable) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("json_table")
	var cols []string
	for _, col := range t.Cols {
		cols = append(cols, col.Path)
	}
	children := []string{
		fmt.Sprintf("name: %s", t.TableName),
		fmt.Sprintf("root_path: %s", t.RootPath),
		fmt.Sprintf("data_expr: %s", sql.DebugString(t.DataExpr)),
		fmt.Sprintf("cols: %s", strings.Join(cols, ", ")),
	}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// FlattenSchema returns the flattened schema of a JSONTableCol
func (t *JSONTable) FlattenSchema(cols []JSONTableCol) sql.Schema {
	var sch sql.Schema
	for _, col := range cols {
		if len(col.NestedCols) == 0 {
			sch = append(sch, &sql.Column{
				Source:        t.TableName,
				Name:          col.Opts.Name,
				Type:          col.Opts.Type,
				AutoIncrement: col.Opts.ForOrd,
			})
			continue
		}
		sch = append(sch, t.FlattenSchema(col.NestedCols)...)
	}
	return sch
}

// Schema implements the sql.Table interface
func (t *JSONTable) Schema() sql.Schema {
	return t.FlattenSchema(t.Cols)
}

// Collation implements the sql.Table interface
func (t *JSONTable) Collation() sql.CollationID {
	return sql.Collation_Default
}

// Partitions implements the sql.Table interface
func (t *JSONTable) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	// TODO: this does Nothing
	return &jsonTablePartitionIter{
		keys: [][]byte{{0}},
	}, nil
}

// PartitionRows implements the sql.Table interface
func (t *JSONTable) PartitionRows(ctx *sql.Context, partition sql.Partition) (sql.RowIter, error) {
	return t.b.Build(ctx, t, nil)
}

// Resolved implements the sql.Resolvable interface
func (t *JSONTable) Resolved() bool {
	if !t.DataExpr.Resolved() {
		return false
	}
	for _, col := range t.Cols {
		if !col.Resolved() {
			return false
		}
	}
	return true
}

// Children implements the sql.Node interface
func (t *JSONTable) Children() []sql.Node {
	return nil
}

// WithChildren implements the sql.Node interface
func (t *JSONTable) WithChildren(children ...sql.Node) (sql.Node, error) {
	return t, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*JSONTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Expressions implements the sql.Expressioner interface
func (t *JSONTable) Expressions() []sql.Expression {
	exprs := []sql.Expression{t.DataExpr}
	for _, col := range t.Cols {
		innerExprs := col.Expressions()
		exprs = append(exprs, innerExprs...)
	}
	return exprs
}

// WithExpressions implements the sql.Expressioner interface
func (t *JSONTable) WithExpressions(expression ...sql.Expression) (sql.Node, error) {
	nt := *t
	nt.DataExpr = expression[0]
	idx := 1
	for i := range nt.Cols {
		if err := nt.Cols[i].WithExpressions(expression, &idx); err != nil {
			return nil, err
		}
	}
	if idx != len(expression) {
		return nil, fmt.Errorf("too many expressions for JSONTable")
	}
	return &nt, nil
}

// NewJSONTable creates a new in memory table from the JSON formatted data, a jsonpath path string, and table spec.
func NewJSONTable(dataExpr sql.Expression, path string, alias string, cols []JSONTableCol) (*JSONTable, error) {
	if _, ok := dataExpr.(*Subquery); ok {
		return nil, sql.ErrInvalidArgument.New("JSON_TABLE")
	}

	return &JSONTable{
		TableName: alias,
		DataExpr:  dataExpr,
		RootPath:  path,
		Cols:      cols,
	}, nil
}
