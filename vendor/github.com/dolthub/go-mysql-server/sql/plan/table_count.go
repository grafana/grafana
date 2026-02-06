package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// TableCountLookup short-circuits `select count(*) from table`
// using the sql.StatisticsTable interface.
type TableCountLookup struct {
	db        sql.Database
	table     sql.StatisticsTable
	aliasName string
	cnt       uint64
	id        sql.ColumnId
}

func NewTableCount(aliasName string, db sql.Database, table sql.StatisticsTable, cnt uint64, id sql.ColumnId) sql.Node {
	return &TableCountLookup{aliasName: aliasName, db: db, table: table, cnt: cnt, id: id}
}

var _ sql.Node = (*TableCountLookup)(nil)

func (t *TableCountLookup) Id() sql.ColumnId {
	return t.id
}

func (t *TableCountLookup) WithId(id sql.ColumnId) *TableCountLookup {
	ret := *t
	ret.id = t.id
	return &ret
}

func (t *TableCountLookup) Name() string {
	return t.aliasName
}

func (t *TableCountLookup) Count() uint64 {
	return t.cnt
}

func (t *TableCountLookup) Resolved() bool {
	return true
}

func (t *TableCountLookup) Table() sql.Table {
	return t.table
}

func (t *TableCountLookup) IsReadOnly() bool {
	return true
}

func (t *TableCountLookup) Db() sql.Database {
	return t.db
}

func (t *TableCountLookup) String() string {
	return fmt.Sprintf("table_count(%s) as %s", t.table.Name(), t.aliasName)
}

func (t *TableCountLookup) Schema() sql.Schema {
	return sql.Schema{{
		Name:     t.aliasName,
		Type:     types.Int64,
		Nullable: false,
		Source:   t.table.Name(),
	}}
}

func (t *TableCountLookup) Children() []sql.Node {
	return nil
}

func (t *TableCountLookup) WithChildren(_ ...sql.Node) (sql.Node, error) {
	return t, nil
}
