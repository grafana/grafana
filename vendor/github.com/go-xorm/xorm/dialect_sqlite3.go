// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/go-xorm/core"
)

var (
	sqlite3ReservedWords = map[string]bool{
		"ABORT":             true,
		"ACTION":            true,
		"ADD":               true,
		"AFTER":             true,
		"ALL":               true,
		"ALTER":             true,
		"ANALYZE":           true,
		"AND":               true,
		"AS":                true,
		"ASC":               true,
		"ATTACH":            true,
		"AUTOINCREMENT":     true,
		"BEFORE":            true,
		"BEGIN":             true,
		"BETWEEN":           true,
		"BY":                true,
		"CASCADE":           true,
		"CASE":              true,
		"CAST":              true,
		"CHECK":             true,
		"COLLATE":           true,
		"COLUMN":            true,
		"COMMIT":            true,
		"CONFLICT":          true,
		"CONSTRAINT":        true,
		"CREATE":            true,
		"CROSS":             true,
		"CURRENT_DATE":      true,
		"CURRENT_TIME":      true,
		"CURRENT_TIMESTAMP": true,
		"DATABASE":          true,
		"DEFAULT":           true,
		"DEFERRABLE":        true,
		"DEFERRED":          true,
		"DELETE":            true,
		"DESC":              true,
		"DETACH":            true,
		"DISTINCT":          true,
		"DROP":              true,
		"EACH":              true,
		"ELSE":              true,
		"END":               true,
		"ESCAPE":            true,
		"EXCEPT":            true,
		"EXCLUSIVE":         true,
		"EXISTS":            true,
		"EXPLAIN":           true,
		"FAIL":              true,
		"FOR":               true,
		"FOREIGN":           true,
		"FROM":              true,
		"FULL":              true,
		"GLOB":              true,
		"GROUP":             true,
		"HAVING":            true,
		"IF":                true,
		"IGNORE":            true,
		"IMMEDIATE":         true,
		"IN":                true,
		"INDEX":             true,
		"INDEXED":           true,
		"INITIALLY":         true,
		"INNER":             true,
		"INSERT":            true,
		"INSTEAD":           true,
		"INTERSECT":         true,
		"INTO":              true,
		"IS":                true,
		"ISNULL":            true,
		"JOIN":              true,
		"KEY":               true,
		"LEFT":              true,
		"LIKE":              true,
		"LIMIT":             true,
		"MATCH":             true,
		"NATURAL":           true,
		"NO":                true,
		"NOT":               true,
		"NOTNULL":           true,
		"NULL":              true,
		"OF":                true,
		"OFFSET":            true,
		"ON":                true,
		"OR":                true,
		"ORDER":             true,
		"OUTER":             true,
		"PLAN":              true,
		"PRAGMA":            true,
		"PRIMARY":           true,
		"QUERY":             true,
		"RAISE":             true,
		"RECURSIVE":         true,
		"REFERENCES":        true,
		"REGEXP":            true,
		"REINDEX":           true,
		"RELEASE":           true,
		"RENAME":            true,
		"REPLACE":           true,
		"RESTRICT":          true,
		"RIGHT":             true,
		"ROLLBACK":          true,
		"ROW":               true,
		"SAVEPOINT":         true,
		"SELECT":            true,
		"SET":               true,
		"TABLE":             true,
		"TEMP":              true,
		"TEMPORARY":         true,
		"THEN":              true,
		"TO":                true,
		"TRANSACTI":         true,
		"TRIGGER":           true,
		"UNION":             true,
		"UNIQUE":            true,
		"UPDATE":            true,
		"USING":             true,
		"VACUUM":            true,
		"VALUES":            true,
		"VIEW":              true,
		"VIRTUAL":           true,
		"WHEN":              true,
		"WHERE":             true,
		"WITH":              true,
		"WITHOUT":           true,
	}
)

type sqlite3 struct {
	core.Base
}

func (db *sqlite3) Init(d *core.DB, uri *core.Uri, drivername, dataSourceName string) error {
	return db.Base.Init(d, db, uri, drivername, dataSourceName)
}

func (db *sqlite3) SqlType(c *core.Column) string {
	switch t := c.SQLType.Name; t {
	case core.Bool:
		if c.Default == "true" {
			c.Default = "1"
		} else if c.Default == "false" {
			c.Default = "0"
		}
		return core.Integer
	case core.Date, core.DateTime, core.TimeStamp, core.Time:
		return core.DateTime
	case core.TimeStampz:
		return core.Text
	case core.Char, core.Varchar, core.NVarchar, core.TinyText,
		core.Text, core.MediumText, core.LongText, core.Json:
		return core.Text
	case core.Bit, core.TinyInt, core.SmallInt, core.MediumInt, core.Int, core.Integer, core.BigInt:
		return core.Integer
	case core.Float, core.Double, core.Real:
		return core.Real
	case core.Decimal, core.Numeric:
		return core.Numeric
	case core.TinyBlob, core.Blob, core.MediumBlob, core.LongBlob, core.Bytea, core.Binary, core.VarBinary:
		return core.Blob
	case core.Serial, core.BigSerial:
		c.IsPrimaryKey = true
		c.IsAutoIncrement = true
		c.Nullable = false
		return core.Integer
	default:
		return t
	}
}

func (db *sqlite3) FormatBytes(bs []byte) string {
	return fmt.Sprintf("X'%x'", bs)
}

func (db *sqlite3) SupportInsertMany() bool {
	return true
}

func (db *sqlite3) IsReserved(name string) bool {
	_, ok := sqlite3ReservedWords[name]
	return ok
}

func (db *sqlite3) Quote(name string) string {
	return "`" + name + "`"
}

func (db *sqlite3) QuoteStr() string {
	return "`"
}

func (db *sqlite3) AutoIncrStr() string {
	return "AUTOINCREMENT"
}

func (db *sqlite3) SupportEngine() bool {
	return false
}

func (db *sqlite3) SupportCharset() bool {
	return false
}

func (db *sqlite3) IndexOnTable() bool {
	return false
}

func (db *sqlite3) IndexCheckSql(tableName, idxName string) (string, []interface{}) {
	args := []interface{}{idxName}
	return "SELECT name FROM sqlite_master WHERE type='index' and name = ?", args
}

func (db *sqlite3) TableCheckSql(tableName string) (string, []interface{}) {
	args := []interface{}{tableName}
	return "SELECT name FROM sqlite_master WHERE type='table' and name = ?", args
}

func (db *sqlite3) DropIndexSql(tableName string, index *core.Index) string {
	// var unique string
	quote := db.Quote
	idxName := index.Name

	if !strings.HasPrefix(idxName, "UQE_") &&
		!strings.HasPrefix(idxName, "IDX_") {
		if index.Type == core.UniqueType {
			idxName = fmt.Sprintf("UQE_%v_%v", tableName, index.Name)
		} else {
			idxName = fmt.Sprintf("IDX_%v_%v", tableName, index.Name)
		}
	}
	return fmt.Sprintf("DROP INDEX %v", quote(idxName))
}

func (db *sqlite3) ForUpdateSql(query string) string {
	return query
}

/*func (db *sqlite3) ColumnCheckSql(tableName, colName string) (string, []interface{}) {
	args := []interface{}{tableName}
	sql := "SELECT name FROM sqlite_master WHERE type='table' and name = ? and ((sql like '%`" + colName + "`%') or (sql like '%[" + colName + "]%'))"
	return sql, args
}*/

func (db *sqlite3) IsColumnExist(tableName, colName string) (bool, error) {
	args := []interface{}{tableName}
	query := "SELECT name FROM sqlite_master WHERE type='table' and name = ? and ((sql like '%`" + colName + "`%') or (sql like '%[" + colName + "]%'))"
	db.LogSQL(query, args)
	rows, err := db.DB().Query(query, args...)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	if rows.Next() {
		return true, nil
	}
	return false, nil
}

func (db *sqlite3) GetColumns(tableName string) ([]string, map[string]*core.Column, error) {
	args := []interface{}{tableName}
	s := "SELECT sql FROM sqlite_master WHERE type='table' and name = ?"
	db.LogSQL(s, args)
	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var name string
	for rows.Next() {
		err = rows.Scan(&name)
		if err != nil {
			return nil, nil, err
		}
		break
	}

	if name == "" {
		return nil, nil, errors.New("no table named " + tableName)
	}

	nStart := strings.Index(name, "(")
	nEnd := strings.LastIndex(name, ")")
	reg := regexp.MustCompile(`[^\(,\)]*(\([^\(]*\))?`)
	colCreates := reg.FindAllString(name[nStart+1:nEnd], -1)
	cols := make(map[string]*core.Column)
	colSeq := make([]string, 0)
	for _, colStr := range colCreates {
		reg = regexp.MustCompile(`,\s`)
		colStr = reg.ReplaceAllString(colStr, ",")
		if strings.HasPrefix(strings.TrimSpace(colStr), "PRIMARY KEY") {
			parts := strings.Split(strings.TrimSpace(colStr), "(")
			if len(parts) == 2 {
				pkCols := strings.Split(strings.TrimRight(strings.TrimSpace(parts[1]), ")"), ",")
				for _, pk := range pkCols {
					if col, ok := cols[strings.Trim(strings.TrimSpace(pk), "`")]; ok {
						col.IsPrimaryKey = true
					}
				}
			}
			continue
		}

		fields := strings.Fields(strings.TrimSpace(colStr))
		col := new(core.Column)
		col.Indexes = make(map[string]int)
		col.Nullable = true
		col.DefaultIsEmpty = true

		for idx, field := range fields {
			if idx == 0 {
				col.Name = strings.Trim(strings.Trim(field, "`[] "), `"`)
				continue
			} else if idx == 1 {
				col.SQLType = core.SQLType{Name: field, DefaultLength: 0, DefaultLength2: 0}
			}
			switch field {
			case "PRIMARY":
				col.IsPrimaryKey = true
			case "AUTOINCREMENT":
				col.IsAutoIncrement = true
			case "NULL":
				if fields[idx-1] == "NOT" {
					col.Nullable = false
				} else {
					col.Nullable = true
				}
			case "DEFAULT":
				col.Default = fields[idx+1]
				col.DefaultIsEmpty = false
			}
		}
		if !col.SQLType.IsNumeric() && !col.DefaultIsEmpty {
			col.Default = "'" + col.Default + "'"
		}
		cols[col.Name] = col
		colSeq = append(colSeq, col.Name)
	}
	return colSeq, cols, nil
}

func (db *sqlite3) GetTables() ([]*core.Table, error) {
	args := []interface{}{}
	s := "SELECT name FROM sqlite_master WHERE type='table'"
	db.LogSQL(s, args)

	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := make([]*core.Table, 0)
	for rows.Next() {
		table := core.NewEmptyTable()
		err = rows.Scan(&table.Name)
		if err != nil {
			return nil, err
		}
		if table.Name == "sqlite_sequence" {
			continue
		}
		tables = append(tables, table)
	}
	return tables, nil
}

func (db *sqlite3) GetIndexes(tableName string) (map[string]*core.Index, error) {
	args := []interface{}{tableName}
	s := "SELECT sql FROM sqlite_master WHERE type='index' and tbl_name = ?"
	db.LogSQL(s, args)

	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := make(map[string]*core.Index, 0)
	for rows.Next() {
		var tmpSQL sql.NullString
		err = rows.Scan(&tmpSQL)
		if err != nil {
			return nil, err
		}

		if !tmpSQL.Valid {
			continue
		}
		sql := tmpSQL.String

		index := new(core.Index)
		nNStart := strings.Index(sql, "INDEX")
		nNEnd := strings.Index(sql, "ON")
		if nNStart == -1 || nNEnd == -1 {
			continue
		}

		indexName := strings.Trim(sql[nNStart+6:nNEnd], "` []")
		var isRegular bool
		if strings.HasPrefix(indexName, "IDX_"+tableName) || strings.HasPrefix(indexName, "UQE_"+tableName) {
			index.Name = indexName[5+len(tableName):]
			isRegular = true
		} else {
			index.Name = indexName
		}

		if strings.HasPrefix(sql, "CREATE UNIQUE INDEX") {
			index.Type = core.UniqueType
		} else {
			index.Type = core.IndexType
		}

		nStart := strings.Index(sql, "(")
		nEnd := strings.Index(sql, ")")
		colIndexes := strings.Split(sql[nStart+1:nEnd], ",")

		index.Cols = make([]string, 0)
		for _, col := range colIndexes {
			index.Cols = append(index.Cols, strings.Trim(col, "` []"))
		}
		index.IsRegular = isRegular
		indexes[index.Name] = index
	}

	return indexes, nil
}

func (db *sqlite3) Filters() []core.Filter {
	return []core.Filter{&core.IdFilter{}}
}

type sqlite3Driver struct {
}

func (p *sqlite3Driver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	if strings.Contains(dataSourceName, "?") {
		dataSourceName = dataSourceName[:strings.Index(dataSourceName, "?")]
	}

	return &core.Uri{DbType: core.SQLITE, DbName: dataSourceName}, nil
}
