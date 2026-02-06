package memory

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.TableFunction = RequiredLookupTable{}
var _ sql.CollationCoercible = RequiredLookupTable{}
var _ sql.ExecSourceRel = RequiredLookupTable{}
var _ sql.IndexAddressable = RequiredLookupTable{}
var _ sql.IndexedTable = RequiredLookupTable{}
var _ sql.TableNode = RequiredLookupTable{}
var _ sql.IndexRequired = RequiredLookupTable{}

// RequiredLookupTable is a table that will error if not executed as an index lookup
type RequiredLookupTable struct {
	IntSequenceTable
	indexOk bool
}

func (s RequiredLookupTable) RequiredPredicates() []string {
	return []string{s.name}
}

func (s RequiredLookupTable) UnderlyingTable() sql.Table {
	return s
}

func (s RequiredLookupTable) NewInstance(ctx *sql.Context, db sql.Database, args []sql.Expression) (sql.Node, error) {
	node, err := s.IntSequenceTable.NewInstance(ctx, db, args)
	return RequiredLookupTable{IntSequenceTable: node.(IntSequenceTable)}, err
}

func (s RequiredLookupTable) String() string {
	return fmt.Sprintf("requiredLookup")
}

func (s RequiredLookupTable) DebugString() string {
	return "requiredLookup"
}

func (s RequiredLookupTable) Name() string {
	return "required_lookup_table"
}

func (s RequiredLookupTable) Description() string {
	return "required_lookup_table"
}

var _ sql.Partition = (*sequencePartition)(nil)

func (s RequiredLookupTable) PreciseMatch() bool {
	return true
}

func (s RequiredLookupTable) WithChildren(_ ...sql.Node) (sql.Node, error) {
	return s, nil
}

func (s RequiredLookupTable) Expressions() []sql.Expression {
	return []sql.Expression{}
}

func (s RequiredLookupTable) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	return s, nil
}

func (s RequiredLookupTable) Database() sql.Database {
	return s.db
}

func (s RequiredLookupTable) IndexedAccess(ctx *sql.Context, lookup sql.IndexLookup) sql.IndexedTable {
	return RequiredLookupTable{indexOk: true, IntSequenceTable: s.IntSequenceTable}
}

func (s RequiredLookupTable) RowIter(_ *sql.Context, _ sql.Row) (sql.RowIter, error) {
	return nil, fmt.Errorf("table requires index lookup")
}

func (s RequiredLookupTable) WithDatabase(_ sql.Database) (sql.Node, error) {
	return s, nil
}

// Partitions is a sql.Table interface function that returns a partition of the data. This data has a single partition.
func (s RequiredLookupTable) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	if !s.indexOk {
		return nil, fmt.Errorf("table requires index lookup")
	}
	return s.IntSequenceTable.Partitions(ctx)
}

func (s RequiredLookupTable) PartitionRows(ctx *sql.Context, partition sql.Partition) (sql.RowIter, error) {
	if !s.indexOk {
		return nil, fmt.Errorf("table requires index lookup")
	}
	return s.IntSequenceTable.PartitionRows(ctx, partition)
}

func (s RequiredLookupTable) GetIndexes(ctx *sql.Context) (indexes []sql.Index, err error) {
	return []sql.Index{
		pointLookupIndex{&Index{
			DB:         "",
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
		}},
	}, nil
}
