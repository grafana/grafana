package memory

import (
	"fmt"
	"io"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.TableFunction = TableFunc{}
var _ sql.ExecSourceRel = TableFunc{}

// TableFunc a simple table function that returns the instantiated value.
type TableFunc struct {
	db    sql.Database
	name  string
	value int64
}

func (s TableFunc) NewInstance(ctx *sql.Context, db sql.Database, args []sql.Expression) (sql.Node, error) {
	if len(args) != 2 {
		return nil, fmt.Errorf("table_func table expects 2 arguments: (name, len)")
	}
	nameExp, ok := args[0].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("table_func table expects arguments to be literal expressions")
	}
	name, ok := nameExp.Value().(string)
	if !ok {
		return nil, fmt.Errorf("table_func table expects 1st argument to be column name")
	}
	valueExpr, ok := args[1].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("table_func table expects arguments to be literal expressions")
	}
	value, _, err := types.Int64.Convert(ctx, valueExpr.Value())
	if !ok {
		return nil, fmt.Errorf("%w; table_func table expects 2nd argument to be a table_func length integer", err)
	}
	return TableFunc{db: db, name: name, value: value.(int64)}, nil
}

func (s TableFunc) Resolved() bool {
	return true
}

func (s TableFunc) IsReadOnly() bool {
	return true
}

func (s TableFunc) String() string {
	return fmt.Sprintf("table_func(%s, %d)", s.name, s.value)
}

func (s TableFunc) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("table_func")
	children := []string{
		fmt.Sprintf("name: %s", s.name),
		fmt.Sprintf("len: %d", s.value),
	}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (s TableFunc) Schema() sql.Schema {
	schema := []*sql.Column{
		{
			DatabaseSource: s.db.Name(),
			Source:         s.Name(),
			Name:           s.name,
			Type:           types.Int64,
		},
	}

	return schema
}

func (s TableFunc) Children() []sql.Node {
	return []sql.Node{}
}

func (s TableFunc) RowIter(_ *sql.Context, _ sql.Row) (sql.RowIter, error) {
	rowIter := &TableFunctionRowIter{val: s.value}
	return rowIter, nil
}

func (s TableFunc) WithChildren(_ ...sql.Node) (sql.Node, error) {
	return s, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (TableFunc) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Collation implements the sql.Table interface.
func (TableFunc) Collation() sql.CollationID {
	return sql.Collation_Default
}

func (s TableFunc) Expressions() []sql.Expression {
	return []sql.Expression{}
}

func (s TableFunc) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	return s, nil
}

func (s TableFunc) Database() sql.Database {
	return s.db
}

func (s TableFunc) WithDatabase(_ sql.Database) (sql.Node, error) {
	return s, nil
}

func (s TableFunc) Name() string {
	return "table_func"
}

func (s TableFunc) Description() string {
	return "table function"
}

var _ sql.RowIter = (*TableFunctionRowIter)(nil)

type TableFunctionRowIter struct {
	val  interface{}
	done bool
}

func (i *TableFunctionRowIter) Next(_ *sql.Context) (sql.Row, error) {
	if i.done {
		return nil, io.EOF
	}
	ret := sql.Row{i.val}
	i.done = true
	return ret, nil
}

func (i *TableFunctionRowIter) Close(_ *sql.Context) error {
	return nil
}
