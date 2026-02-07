package plan

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type AnalyzeTable struct {
	Db     string
	Stats  sql.StatsProvider
	Tables []sql.Table
}

var _ sql.Node = (*AnalyzeTable)(nil)
var _ sql.CollationCoercible = (*AnalyzeTable)(nil)

var analyzeSchema = sql.Schema{
	{Name: "Table", Type: types.LongText},
	{Name: "Op", Type: types.LongText},
	{Name: "Msg_type", Type: types.LongText},
	{Name: "Msg_text", Type: types.LongText},
}

func NewAnalyze(names []sql.Table) *AnalyzeTable {
	return &AnalyzeTable{
		Tables: names,
	}
}

// Schema implements the interface sql.Node.
// TODO: should be |Tables|Op|Msg_type|Msg_text|
func (n *AnalyzeTable) Schema() sql.Schema {
	return analyzeSchema
}

func (n *AnalyzeTable) WithCatalog(cat sql.Catalog) *AnalyzeTable {
	ret := *n
	return &ret
}

func (n *AnalyzeTable) WithTables(tables []sql.Table) *AnalyzeTable {
	n.Tables = tables
	return n
}

func (n *AnalyzeTable) WithDb(db string) *AnalyzeTable {
	n.Db = db
	return n
}

func (n *AnalyzeTable) WithStats(stats sql.StatsProvider) *AnalyzeTable {
	n.Stats = stats
	return n
}

func (n *AnalyzeTable) IsReadOnly() bool {
	return true
}

// String implements the interface sql.Node.
func (n *AnalyzeTable) String() string {
	tblNames := make([]string, len(n.Tables))
	for i, t := range n.Tables {
		tblNames[i] = t.String()
	}
	return fmt.Sprintf("AnalyzeTable table %s", strings.Join(tblNames, ", "))
}

// Resolved implements the Resolvable interface.
func (n *AnalyzeTable) Resolved() bool {
	return n.Stats != nil
}

// Children implements the interface sql.Node.
func (n *AnalyzeTable) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (n *AnalyzeTable) WithChildren(_ ...sql.Node) (sql.Node, error) {
	return n, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*AnalyzeTable) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
