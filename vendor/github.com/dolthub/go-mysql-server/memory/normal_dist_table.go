package memory

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/stats"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.TableFunction = NormalDistTable{}
var _ sql.CollationCoercible = NormalDistTable{}
var _ sql.ExecSourceRel = NormalDistTable{}
var _ sql.TableNode = NormalDistTable{}

// NormalDistTable a simple table function that returns samples
// from a parameterized normal distribution.
type NormalDistTable struct {
	db     sql.Database
	name   string
	rowCnt int
	colCnt int
	mean   float64
	std    float64
}

func (s NormalDistTable) UnderlyingTable() sql.Table {
	return s
}

func (s NormalDistTable) NewInstance(ctx *sql.Context, db sql.Database, args []sql.Expression) (sql.Node, error) {
	if len(args) != 4 {
		return nil, fmt.Errorf("normal_dist table expects 4 arguments: (cols, rows, mean, std)")
	}
	colCntLit, ok := args[0].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("normal_dist table expects arguments to be literal expressions")
	}
	colCnt, inBounds, _ := types.Int64.Convert(ctx, colCntLit.Value())
	if !inBounds {
		return nil, fmt.Errorf("normal_dist table expects 1st argument to be column count")
	}
	rowCntLit, ok := args[1].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("normal_dist table expects arguments to be literal expressions")
	}
	rowCnt, inBounds, _ := types.Int64.Convert(ctx, rowCntLit.Value())
	if !inBounds {
		return nil, fmt.Errorf("normal_dist table expects 2nd argument to be row count")
	}
	meanLit, ok := args[2].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("normal_dist table expects arguments to be literal expressions")
	}
	mean, inBounds, _ := types.Float64.Convert(ctx, meanLit.Value())
	if !inBounds {
		return nil, fmt.Errorf("normal_dist table expects 3rd argument to be row count")
	}
	stdLit, ok := args[3].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("normal_dist table expects arguments to be literal expressions")
	}
	std, inBounds, _ := types.Float64.Convert(ctx, stdLit.Value())
	if !inBounds {
		return nil, fmt.Errorf("normal_dist table expects 4th argument to be row count")
	}

	return NormalDistTable{db: db, colCnt: int(colCnt.(int64)), rowCnt: int(rowCnt.(int64)), mean: mean.(float64), std: std.(float64)}, nil
}

func (s NormalDistTable) Resolved() bool {
	return true
}

func (s NormalDistTable) IsReadOnly() bool {
	return true
}

func (s NormalDistTable) String() string {
	return "normal_dist"
}

func (s NormalDistTable) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("normal_dist")
	children := []string{
		fmt.Sprintf("columns: %d", s.colCnt),
		fmt.Sprintf("rows: %d", s.rowCnt),
		fmt.Sprintf("mean: %.2f", s.mean),
		fmt.Sprintf("std: %.2f", s.std),
	}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (s NormalDistTable) Schema() sql.Schema {
	var sch sql.Schema
	for i := 0; i < s.colCnt+1; i++ {
		sch = append(sch, &sql.Column{
			DatabaseSource: s.db.Name(),
			Source:         s.Name(),
			Name:           fmt.Sprintf("col%d", i),
			Type:           types.Int64,
		})
	}
	return sch
}

func (s NormalDistTable) Children() []sql.Node {
	return []sql.Node{}
}

func (s NormalDistTable) RowIter(_ *sql.Context, _ sql.Row) (sql.RowIter, error) {
	return stats.NewNormDistIter(s.colCnt, s.rowCnt, s.mean, s.std), nil
}

func (s NormalDistTable) WithChildren(_ ...sql.Node) (sql.Node, error) {
	return s, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (NormalDistTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Collation implements the sql.Table interface.
func (NormalDistTable) Collation() sql.CollationID {
	return sql.Collation_Default
}

func (s NormalDistTable) Expressions() []sql.Expression {
	return []sql.Expression{}
}

func (s NormalDistTable) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	return s, nil
}

func (s NormalDistTable) Database() sql.Database {
	return s.db
}

func (s NormalDistTable) WithDatabase(_ sql.Database) (sql.Node, error) {
	return s, nil
}

func (s NormalDistTable) Name() string {
	return "normal_dist"
}

func (s NormalDistTable) Description() string {
	return "normal distribution"
}

var _ sql.RowIter = (*SequenceTableFnRowIter)(nil)

// Partitions is a sql.Table interface function that returns a partition of the data. This data has a single partition.
func (s NormalDistTable) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	return sql.PartitionsToPartitionIter(&sequencePartition{min: 0, max: int64(s.rowCnt) - 1}), nil
}

// PartitionRows is a sql.Table interface function that takes a partition and returns all rows in that partition.
// This table has a partition for just schema changes, one for just data changes, and one for both.
func (s NormalDistTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	return stats.NewNormDistIter(s.colCnt, s.rowCnt, s.mean, s.std), nil
}
