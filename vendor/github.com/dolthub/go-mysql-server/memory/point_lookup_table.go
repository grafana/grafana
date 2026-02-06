package memory

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.TableFunction = PointLookupTable{}
var _ sql.CollationCoercible = PointLookupTable{}
var _ sql.ExecSourceRel = PointLookupTable{}
var _ sql.IndexAddressable = PointLookupTable{}
var _ sql.IndexedTable = PointLookupTable{}
var _ sql.TableNode = PointLookupTable{}

// PointLookupTable is a table whose indexes only support point lookups but not range scans.
// It's used for testing optimizations on indexes.
type PointLookupTable struct {
	IntSequenceTable
}

func (s PointLookupTable) UnderlyingTable() sql.Table {
	return s
}

func (s PointLookupTable) NewInstance(ctx *sql.Context, db sql.Database, args []sql.Expression) (sql.Node, error) {
	node, err := s.IntSequenceTable.NewInstance(ctx, db, args)
	return PointLookupTable{node.(IntSequenceTable)}, err
}

func (s PointLookupTable) String() string {
	return fmt.Sprintf("pointLookup")
}

func (s PointLookupTable) DebugString() string {
	return "pointLookup"
}

func (s PointLookupTable) Name() string {
	return "point_lookup_table"
}

func (s PointLookupTable) Description() string {
	return "point_lookup_table"
}

var _ sql.Partition = (*sequencePartition)(nil)

func (s PointLookupTable) PreciseMatch() bool {
	return true
}

func (s PointLookupTable) GetIndexes(ctx *sql.Context) (indexes []sql.Index, err error) {
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

type pointLookupIndex struct {
	sql.Index
}

func (i pointLookupIndex) CanSupport(ctx *sql.Context, ranges ...sql.Range) bool {
	for _, r := range ranges {
		mysqlRange, ok := r.(sql.MySQLRange)
		if !ok || len(mysqlRange) != 1 {
			return false
		}
		below, ok := mysqlRange[0].LowerBound.(sql.Below)
		if !ok {
			return false
		}
		belowKey, _, err := types.Int64.Convert(ctx, below.Key)
		if err != nil {
			return false
		}

		above, ok := mysqlRange[0].UpperBound.(sql.Above)
		if !ok {
			return false
		}
		aboveKey, _, err := types.Int64.Convert(ctx, above.Key)
		if err != nil {
			return false
		}

		if belowKey != aboveKey {
			return false
		}
	}
	return true
}
