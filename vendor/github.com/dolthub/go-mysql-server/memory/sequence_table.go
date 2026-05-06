package memory

import (
	"encoding/binary"
	"fmt"
	"io"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.TableFunction = IntSequenceTable{}
var _ sql.CollationCoercible = IntSequenceTable{}
var _ sql.ExecSourceRel = IntSequenceTable{}

// IntSequenceTable a simple table function that returns a sequence
// of integers.
type IntSequenceTable struct {
	db   sql.Database
	name string
	Len  sql.Expression
}

func (s IntSequenceTable) NewInstance(ctx *sql.Context, db sql.Database, args []sql.Expression) (sql.Node, error) {
	if len(args) != 2 {
		return nil, fmt.Errorf("sequence table expects 2 arguments: (name, len)")
	}
	nameExp, ok := args[0].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("sequence table expects arguments to be literal expressions")
	}
	name, ok := nameExp.Value().(string)
	if !ok {
		return nil, fmt.Errorf("sequence table expects 1st argument to be column name")
	}
	lenExp := args[1]
	if !sql.IsNumberType(lenExp.Type()) {
		return nil, fmt.Errorf("sequence table expects length argument to be a number")
	}
	return IntSequenceTable{db: db, name: name, Len: lenExp}, nil
}

func (s IntSequenceTable) Resolved() bool {
	return true
}

func (s IntSequenceTable) IsReadOnly() bool {
	return true
}

func (s IntSequenceTable) String() string {
	return fmt.Sprintf("sequence(%s, %d)", s.name, s.Len)
}

func (s IntSequenceTable) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("sequence")
	children := []string{
		fmt.Sprintf("name: %s", s.name),
		fmt.Sprintf("len: %d", s.Len),
	}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (s IntSequenceTable) Schema() sql.Schema {
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

func (s IntSequenceTable) Children() []sql.Node {
	return []sql.Node{}
}

func (s IntSequenceTable) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	iterLen, err := s.Len.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	iterLenVal, inRange, err := types.Int64.Convert(ctx, iterLen)
	if err != nil {
		return nil, err
	}
	if inRange != sql.InRange {
		return nil, fmt.Errorf("sequence table expects integer argument")
	}

	rowIter := &SequenceTableFnRowIter{i: 0, n: iterLenVal.(int64)}
	return rowIter, nil
}

func (s IntSequenceTable) WithChildren(_ ...sql.Node) (sql.Node, error) {
	return s, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (IntSequenceTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Collation implements the sql.Table interface.
func (IntSequenceTable) Collation() sql.CollationID {
	return sql.Collation_Default
}

func (s IntSequenceTable) Expressions() []sql.Expression {
	return []sql.Expression{s.Len}
}

func (s IntSequenceTable) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	if len(e) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(e), 1)
	}
	newSequenceTable := s
	newSequenceTable.Len = e[0]
	return newSequenceTable, nil
}

func (s IntSequenceTable) Database() sql.Database {
	return s.db
}

func (s IntSequenceTable) WithDatabase(_ sql.Database) (sql.Node, error) {
	return s, nil
}

func (s IntSequenceTable) Name() string {
	return "sequence_table"
}

func (s IntSequenceTable) Description() string {
	return "sequence"
}

var _ sql.RowIter = (*SequenceTableFnRowIter)(nil)

type SequenceTableFnRowIter struct {
	n int64
	i int64
}

func (i *SequenceTableFnRowIter) Next(_ *sql.Context) (sql.Row, error) {
	if i.i >= i.n {
		return nil, io.EOF
	}
	ret := sql.Row{i.i}
	i.i++
	return ret, nil
}

func (i *SequenceTableFnRowIter) Close(_ *sql.Context) error {
	return nil
}

var _ sql.Partition = (*sequencePartition)(nil)

type sequencePartition struct {
	min, max int64
}

func (s sequencePartition) Key() []byte {
	return binary.LittleEndian.AppendUint64(binary.LittleEndian.AppendUint64(nil, uint64(s.min)), uint64(s.max))
}
