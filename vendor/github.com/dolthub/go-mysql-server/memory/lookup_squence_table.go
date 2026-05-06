package memory

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.TableFunction = LookupSequenceTable{}
var _ sql.CollationCoercible = LookupSequenceTable{}
var _ sql.ExecSourceRel = LookupSequenceTable{}
var _ sql.IndexAddressable = LookupSequenceTable{}
var _ sql.IndexedTable = LookupSequenceTable{}
var _ sql.TableNode = LookupSequenceTable{}

// LookupSequenceTable is a variation of IntSequenceTable that supports lookups and implements sql.TableNode
type LookupSequenceTable struct {
	IntSequenceTable
	length int64
}

func (s LookupSequenceTable) UnderlyingTable() sql.Table {
	return s
}

func (s LookupSequenceTable) NewInstance(ctx *sql.Context, db sql.Database, args []sql.Expression) (sql.Node, error) {
	newIntSequenceTable, err := s.IntSequenceTable.NewInstance(ctx, db, args)
	if err != nil {
		return nil, err
	}
	lenExp, ok := args[1].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("sequence table expects arguments to be literal expressions")
	}
	length, _, err := types.Int64.Convert(ctx, lenExp.Value())
	if err != nil {
		return nil, err
	}
	return LookupSequenceTable{newIntSequenceTable.(IntSequenceTable), length.(int64)}, nil
}

func (s LookupSequenceTable) String() string {
	return fmt.Sprintf("sequence(%s, %d)", s.name, s.Len)
}

func (s LookupSequenceTable) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("sequence")
	children := []string{
		fmt.Sprintf("name: %s", s.name),
		fmt.Sprintf("len: %d", s.Len),
	}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (s LookupSequenceTable) Schema() sql.Schema {
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

func (s LookupSequenceTable) WithChildren(_ ...sql.Node) (sql.Node, error) {
	return s, nil
}

func (s LookupSequenceTable) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	return s, nil
}

func (s LookupSequenceTable) WithDatabase(_ sql.Database) (sql.Node, error) {
	return s, nil
}

func (s LookupSequenceTable) Name() string {
	return "lookup_sequence_table"
}

func (s LookupSequenceTable) Description() string {
	return "a integer sequence that supports lookup operations"
}

// Partitions is a sql.Table interface function that returns a partition of the data. This data has a single partition.
func (s LookupSequenceTable) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	return sql.PartitionsToPartitionIter(&sequencePartition{min: 0, max: s.length - 1}), nil
}

// PartitionRows is a sql.Table interface function that takes a partition and returns all rows in that partition.
// This table has a partition for just schema changes, one for just data changes, and one for both.
func (s LookupSequenceTable) PartitionRows(ctx *sql.Context, partition sql.Partition) (sql.RowIter, error) {
	sp, ok := partition.(*sequencePartition)
	if !ok {
		return &SequenceTableFnRowIter{i: 0, n: s.length}, nil
	}
	min := int64(0)
	if sp.min > min {
		min = sp.min
	}
	max := int64(s.length) - 1
	if sp.max < max {
		max = sp.max
	}

	return &SequenceTableFnRowIter{i: min, n: max + 1}, nil
}

// LookupPartitions is a sql.IndexedTable interface function that takes an index lookup and returns the set of corresponding partitions.
func (s LookupSequenceTable) LookupPartitions(ctx *sql.Context, lookup sql.IndexLookup) (sql.PartitionIter, error) {
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

func (s LookupSequenceTable) IndexedAccess(ctx *sql.Context, lookup sql.IndexLookup) sql.IndexedTable {
	return s
}

func (s LookupSequenceTable) PreciseMatch() bool {
	return true
}

func (s LookupSequenceTable) GetIndexes(ctx *sql.Context) ([]sql.Index, error) {
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
