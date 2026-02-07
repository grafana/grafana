package memory

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/stats"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var _ sql.TableFunction = ExponentialDistTable{}
var _ sql.CollationCoercible = ExponentialDistTable{}
var _ sql.ExecSourceRel = ExponentialDistTable{}
var _ sql.TableNode = ExponentialDistTable{}

// ExponentialDistTable a simple table function that returns samples
// from a parameterized exponential distribution.
type ExponentialDistTable struct {
	db     sql.Database
	name   string
	rowCnt int
	colCnt int
	lambda float64
}

func (s ExponentialDistTable) UnderlyingTable() sql.Table {
	return s
}

func (s ExponentialDistTable) NewInstance(ctx *sql.Context, db sql.Database, args []sql.Expression) (sql.Node, error) {
	if len(args) != 3 {
		return nil, fmt.Errorf("exponential_dist table expects 2 arguments: (cols, rows, lambda)")
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
	lambdaLit, ok := args[2].(*expression.Literal)
	if !ok {
		return nil, fmt.Errorf("exponential_dist table expects arguments to be literal expressions")
	}
	lambda, inBounds, _ := types.Float64.Convert(ctx, lambdaLit.Value())
	if !inBounds {
		return nil, fmt.Errorf("exponential_dist table expects 3rd argument to be row count")
	}
	return ExponentialDistTable{db: db, colCnt: int(colCnt.(int64)), rowCnt: int(rowCnt.(int64)), lambda: lambda.(float64)}, nil
}

func (s ExponentialDistTable) Resolved() bool {
	return true
}

func (s ExponentialDistTable) IsReadOnly() bool {
	return true
}

func (s ExponentialDistTable) String() string {
	return "normal_dist"
}

func (s ExponentialDistTable) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("normal_dist")
	children := []string{
		fmt.Sprintf("columns: %d", s.colCnt),
		fmt.Sprintf("rows: %d", s.rowCnt),
		fmt.Sprintf("lambda: %f.2", s.lambda),
	}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

func (s ExponentialDistTable) Schema() sql.Schema {
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

func (s ExponentialDistTable) Children() []sql.Node {
	return []sql.Node{}
}

func (s ExponentialDistTable) RowIter(_ *sql.Context, _ sql.Row) (sql.RowIter, error) {
	return stats.NewExpDistIter(s.colCnt, s.rowCnt, s.lambda), nil
}

func (s ExponentialDistTable) WithChildren(_ ...sql.Node) (sql.Node, error) {
	return s, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (ExponentialDistTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Collation implements the sql.Table interface.
func (ExponentialDistTable) Collation() sql.CollationID {
	return sql.Collation_Default
}

func (s ExponentialDistTable) Expressions() []sql.Expression {
	return []sql.Expression{}
}

func (s ExponentialDistTable) WithExpressions(e ...sql.Expression) (sql.Node, error) {
	return s, nil
}

func (s ExponentialDistTable) Database() sql.Database {
	return s.db
}

func (s ExponentialDistTable) WithDatabase(_ sql.Database) (sql.Node, error) {
	return s, nil
}

func (s ExponentialDistTable) Name() string {
	return "exponential_dist"
}

func (s ExponentialDistTable) Description() string {
	return "exponential distribution"
}

var _ sql.RowIter = (*SequenceTableFnRowIter)(nil)

// Partitions is a sql.Table interface function that returns a partition of the data. This data has a single partition.
func (s ExponentialDistTable) Partitions(ctx *sql.Context) (sql.PartitionIter, error) {
	return sql.PartitionsToPartitionIter(&sequencePartition{min: 0, max: int64(s.rowCnt) - 1}), nil
}

// PartitionRows is a sql.Table interface function that takes a partition and returns all rows in that partition.
// This table has a partition for just schema changes, one for just data changes, and one for both.
func (s ExponentialDistTable) PartitionRows(ctx *sql.Context, _ sql.Partition) (sql.RowIter, error) {
	return stats.NewExpDistIter(s.colCnt, s.rowCnt, s.lambda), nil
}
