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
var _ sql.IndexAddressable = IntSequenceTable{}
var _ sql.IndexedTable = IntSequenceTable{}
var _ sql.TableNode = IntSequenceTable{}

// IntSequenceTable a simple table function that returns a sequence
// of integers.
type IntSequenceTable struct {
	db   sql.Database
	name string
	Len  int64
}

func (s IntSequenceTable) UnderlyingTable() sql.Table {
	return s
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
	lenExp, ok := args[1].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("sequence table expects arguments to be literal expressions")
	}
	length, _, err := types.Int64.Convert(ctx, lenExp.Value())
	if !ok {
		return nil, fmt.Errorf("%w; sequence table expects 2nd argument to be a sequence length integer", err)
	}
	return IntSequenceTable{db: db, name: name, Len: length.(int64)}, nil
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

func (s IntSequenceTable) RowIter(_ *sql.Context, _ sql.Row) (sql.RowIter, error) {
	rowIter := &SequenceTableFnRowIter{i: 0, n: s.Len}
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
	return []sql.Expression{}
}

func (s IntSequenceTable) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	return s, nil
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

// Partitions is a sql.Table interface function that returns a partition of the data. This data has a single partition.
func (s IntSequenceTable) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	return sql.PartitionsToPartitionIter(&sequencePartition{min: 0, max: int64(s.Len) - 1}), nil
}

// PartitionRows is a sql.Table interface function that takes a partition and returns all rows in that partition.
// This table has a partition for just schema changes, one for just data changes, and one for both.
func (s IntSequenceTable) PartitionRows(ctx *sql.Context, partition sql.Partition) (sql.RowIter, error) {
	sp, ok := partition.(*sequencePartition)
	if !ok {
		return &SequenceTableFnRowIter{i: 0, n: s.Len}, nil
	}
	min := int64(0)
	if sp.min > min {
		min = sp.min
	}
	max := int64(s.Len) - 1
	if sp.max < max {
		max = sp.max
	}

	return &SequenceTableFnRowIter{i: min, n: max + 1}, nil
}

// LookupPartitions is a sql.IndexedTable interface function that takes an index lookup and returns the set of corresponding partitions.
func (s IntSequenceTable) LookupPartitions(ctx *sql.Context, lookup sql.IndexLookup) (sql.PartitionIter, error) {
	lowerBound := lookup.Ranges.(sql.MySQLRangeCollection)[0][0].LowerBound
	below, ok := lowerBound.(sql.Below)
	if !ok {
		return s.Partitions(ctx)
	}
	upperBound := lookup.Ranges.(sql.MySQLRangeCollection)[0][0].UpperBound
	above, ok := upperBound.(sql.Above)
	if !ok {
		return s.Partitions(ctx)
	}
	min, _, err := s.Schema()[0].Type.Convert(ctx, below.Key)
	if err != nil {
		return nil, err
	}
	max, _, err := s.Schema()[0].Type.Convert(ctx, above.Key)
	if err != nil {
		return nil, err
	}
	return sql.PartitionsToPartitionIter(&sequencePartition{min: min.(int64), max: max.(int64)}), nil
}

func (s IntSequenceTable) IndexedAccess(ctx *sql.Context, lookup sql.IndexLookup) sql.IndexedTable {
	return s
}

func (s IntSequenceTable) PreciseMatch() bool {
	return true
}

func (s IntSequenceTable) GetIndexes(ctx *sql.Context) ([]sql.Index, error) {
	return []sql.Index{
		&Index{
			DB:         s.db.Name(),
			DriverName: "",
			Tbl:        nil,
			TableName:  s.Name(),
			Exprs: []sql.Expression{
				expression.NewGetFieldWithTable(0, 0, types.Int64, s.db.Name(), s.Name(), s.name, false),
			},
			Name:         s.name,
			Unique:       true,
			Spatial:      false,
			Fulltext:     false,
			CommentStr:   "",
			PrefixLens:   nil,
			fulltextInfo: fulltextInfo{},
		},
	}, nil
}
