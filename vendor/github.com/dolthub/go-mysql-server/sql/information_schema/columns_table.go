// Copyright 2022 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package information_schema

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/planbuilder"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const defaultColumnsTableRowCount = 1000

var typeToNumericPrecision = map[query.Type]int{
	sqltypes.Int8:    3,
	sqltypes.Uint8:   3,
	sqltypes.Int16:   5,
	sqltypes.Uint16:  5,
	sqltypes.Int24:   7,
	sqltypes.Uint24:  7,
	sqltypes.Int32:   10,
	sqltypes.Uint32:  10,
	sqltypes.Int64:   19,
	sqltypes.Uint64:  20,
	sqltypes.Float32: 12,
	sqltypes.Float64: 22,
}

// ColumnsTable describes the information_schema.columns table. It implements both sql.Node and sql.Table
// as way to handle resolving column defaults.
type ColumnsTable struct {
	catalog     sql.Catalog
	RowIter     func(*sql.Context, sql.Catalog, sql.Schema) (sql.RowIter, error)
	TableName   string
	TableSchema sql.Schema
	// allColsWithDefaultValue is the full schema of all tables in all databases. We need this during analysis in order
	// to resolve the default values of some columns, so we pre-compute it.
	allColsWithDefaultValue sql.Schema
}

var _ sql.Table = (*ColumnsTable)(nil)
var _ sql.StatisticsTable = (*ColumnsTable)(nil)
var _ sql.Databaseable = (*ColumnsTable)(nil)
var _ sql.DynamicColumnsTable = (*ColumnsTable)(nil)

// newMySQLColumnsTable returns a ColumnsTable for MySQL.
func newMySQLColumnsTable() *ColumnsTable {
	return &ColumnsTable{
		TableName:   ColumnsTableName,
		TableSchema: columnsSchema,
		RowIter:     columnsRowIter,
	}
}

// NewColumnsTable is used by Doltgres to inject its correct schema and row
// iter. In Dolt, this just returns the current columns table implementation.
var NewColumnsTable = newMySQLColumnsTable

// String implements the sql.Table interface.
func (c *ColumnsTable) String() string {
	return printTable(ColumnsTableName, c.TableSchema)
}

// Schema implements the sql.Table interface.
func (c *ColumnsTable) Schema() sql.Schema {
	return c.TableSchema
}

// Collation implements the sql.Table interface.
func (c *ColumnsTable) Collation() sql.CollationID {
	return sql.Collation_Information_Schema_Default
}

// Name implements the sql.Table interface.
func (c *ColumnsTable) Name() string {
	return ColumnsTableName
}

// Database implements the sql.Databaseable interface.
func (c *ColumnsTable) Database() string {
	return sql.InformationSchemaDatabaseName
}

func (c *ColumnsTable) DataLength(_ *sql.Context) (uint64, error) {
	return uint64(len(c.Schema()) * int(types.Text.MaxByteLength()) * defaultColumnsTableRowCount), nil
}

func (c *ColumnsTable) RowCount(ctx *sql.Context) (uint64, bool, error) {
	return defaultColumnsTableRowCount, false, nil
}

func (c *ColumnsTable) AssignCatalog(cat sql.Catalog) sql.Table {
	c.catalog = cat
	return c
}

// Partitions implements the sql.Table interface.
func (c *ColumnsTable) Partitions(context *sql.Context) (sql.PartitionIter, error) {
	return &informationSchemaPartitionIter{informationSchemaPartition: informationSchemaPartition{partitionKey(c.Name())}}, nil
}

// PartitionRows implements the sql.Table interface.
func (c *ColumnsTable) PartitionRows(context *sql.Context, partition sql.Partition) (sql.RowIter, error) {
	if !bytes.Equal(partition.Key(), partitionKey(c.Name())) {
		return nil, sql.ErrPartitionNotFound.New(partition.Key())
	}

	if c.catalog == nil {
		return nil, fmt.Errorf("nil catalog for info schema table %s", c.Name())
	}

	return c.RowIter(context, c.catalog, c.allColsWithDefaultValue)
}
func (c *ColumnsTable) HasDynamicColumns() bool {
	return true
}

// AllColumns returns all columns in the catalog, renamed to reflect their database and table names
func (c *ColumnsTable) AllColumns(ctx *sql.Context) (sql.Schema, error) {
	if len(c.allColsWithDefaultValue) > 0 {
		return c.allColsWithDefaultValue, nil
	}

	if c.catalog == nil {
		return nil, fmt.Errorf("nil catalog for info schema table %s", c.Name())
	}

	var allColumns sql.Schema

	databases, err := AllDatabasesWithNames(ctx, c.catalog, false)
	if err != nil {
		return nil, err
	}

	for _, db := range databases {
		err := sql.DBTableIter(ctx, db.Database, func(t sql.Table) (cont bool, err error) {
			tableSch := t.Schema()
			for i := range tableSch {
				newCol := tableSch[i].Copy()
				newCol.DatabaseSource = db.Database.Name()
				allColumns = append(allColumns, newCol)
			}
			return true, nil
		})

		if err != nil {
			return nil, err
		}
	}

	c.allColsWithDefaultValue = allColumns
	return c.allColsWithDefaultValue, nil
}

func (c ColumnsTable) WithColumnDefaults(columnDefaults []sql.Expression) (sql.Table, error) {
	if c.allColsWithDefaultValue == nil {
		return nil, fmt.Errorf("WithColumnDefaults called with nil columns for table %s", c.Name())
	}

	if len(columnDefaults) != len(c.allColsWithDefaultValue) {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(columnDefaults), len(c.allColsWithDefaultValue))
	}

	sch, err := transform.SchemaWithDefaults(c.allColsWithDefaultValue, columnDefaults)
	if err != nil {
		return nil, err
	}

	c.allColsWithDefaultValue = sch
	return &c, nil
}

func (c ColumnsTable) WithDefaultsSchema(sch sql.Schema) (sql.Table, error) {
	if c.allColsWithDefaultValue == nil {
		return nil, fmt.Errorf("WithColumnDefaults called with nil columns for table %s", c.Name())
	}

	if len(sch) != len(c.allColsWithDefaultValue) {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(sch), len(c.allColsWithDefaultValue))
	}

	// TODO: generated values
	for i, col := range sch {
		c.allColsWithDefaultValue[i].Default = col.Default
	}
	return &c, nil
}

// columnsRowIter implements the custom sql.RowIter for the information_schema.columns table.
func columnsRowIter(ctx *sql.Context, catalog sql.Catalog, allColsWithDefaultValue sql.Schema) (sql.RowIter, error) {
	var (
		rows             []sql.Row
		globalPrivSetMap = make(map[string]struct{})
	)

	privSet, _ := ctx.GetPrivilegeSet()
	if privSet == nil {
		privSet = mysql_db.NewPrivilegeSet()
	}
	globalPrivSetMap = getCurrentPrivSetMapForColumn(privSet.ToSlice(), globalPrivSetMap)

	databases, err := AllDatabasesWithNames(ctx, catalog, false)
	if err != nil {
		return nil, err
	}

	for _, db := range databases {
		rs, err := getRowsFromDatabase(ctx, db, privSet, globalPrivSetMap, allColsWithDefaultValue)
		if err != nil {
			return nil, err
		}
		rows = append(rows, rs...)

		rs, err = getRowsFromViews(ctx, catalog, db, privSet, globalPrivSetMap)
		if err != nil {
			return nil, err
		}
		rows = append(rows, rs...)
	}
	return sql.RowsToRowIter(rows...), nil
}

// getRowFromColumn returns a single row for given column. The arguments passed are used to define all row values.
// These include the current ordinal position, so this column will get the next position number, sql.Column object,
// database name, table name, column key and column privileges information through privileges set for the table.
func getRowFromColumn(ctx *sql.Context, curOrdPos int, col *sql.Column, catName, schName, tblName, columnKey string, privSetTbl sql.PrivilegeSetTable, privSetMap map[string]struct{}) sql.Row {
	var (
		ordinalPos        = uint32(curOrdPos + 1)
		nullable          = "NO"
		datetimePrecision interface{}
		srsId             interface{}
	)

	colType, dataType := getDtdIdAndDataType(col.Type)

	if col.Nullable {
		nullable = "YES"
	}

	if s, ok := col.Type.(sql.SpatialColumnType); ok {
		if srid, d := s.GetSpatialTypeSRID(); d {
			srsId = srid
		}
	}

	charName, collName, charMaxLen, charOctetLen := getCharAndCollNamesAndCharMaxAndOctetLens(ctx, col.Type)

	numericPrecision, numericScale := getColumnPrecisionAndScale(col.Type)
	if types.IsTimespan(col.Type) {
		// TODO: TIME length not yet supported
		datetimePrecision = 6
	} else if dtType, ok := col.Type.(sql.DatetimeType); ok {
		datetimePrecision = dtType.Precision()
	}

	columnDefault := GetColumnDefault(ctx, col.Default)

	extra := col.Extra
	// If extra is not defined, fill it here.
	if extra == "" && !col.Default.IsLiteral() {
		extra = "DEFAULT_GENERATED"
	}

	var curColPrivStr []string
	for p := range privSetMap {
		curColPrivStr = append(curColPrivStr, p)
	}

	privSetCol := privSetTbl.Column(col.Name)
	for _, pt := range privSetCol.ToSlice() {
		priv := strings.ToLower(pt.String())
		if _, ok := privSetMap[priv]; !ok {
			curColPrivStr = append(curColPrivStr, priv)
		}
	}

	sort.Strings(curColPrivStr)
	privileges := strings.Join(curColPrivStr, ",")

	return sql.Row{
		catName,           // table_catalog
		schName,           // table_schema
		tblName,           // table_name
		col.Name,          // column_name
		ordinalPos,        // ordinal_position
		columnDefault,     // column_default
		nullable,          // is_nullable
		dataType,          // data_type
		charMaxLen,        // character_maximum_length
		charOctetLen,      // character_octet_length
		numericPrecision,  // numeric_precision
		numericScale,      // numeric_scale
		datetimePrecision, // datetime_precision
		charName,          // character_set_name
		collName,          // collation_name
		colType,           // column_type
		columnKey,         // column_key
		extra,             // extra
		privileges,        // privileges
		col.Comment,       // column_comment
		"",                // generation_expression
		srsId,             // srs_id
	}
}

// getRowsFromTable returns array of rows for all accessible columns of the given table.
func getRowsFromTable(ctx *sql.Context, db DbWithNames, t sql.Table, privSetDb sql.PrivilegeSetDatabase, privSetMap map[string]struct{}, allColsWithDefaultValue sql.Schema) ([]sql.Row, error) {
	var rows []sql.Row

	privSetTbl := privSetDb.Table(t.Name())
	curPrivSetMap := getCurrentPrivSetMapForColumn(privSetTbl.ToSlice(), privSetMap)

	columnKeyMap, hasPK, err := getIndexKeyInfo(ctx, t)
	if err != nil {
		return nil, err
	}

	tblName := t.Name()
	for i, col := range SchemaForTable(t, db.Database, allColsWithDefaultValue) {
		var columnKey string
		// Check column PK here first because there are PKs from table implementations that don't implement sql.IndexedTable
		if col.PrimaryKey {
			columnKey = "PRI"
		} else if val, ok := columnKeyMap[col.Name]; ok {
			columnKey = val
			// A UNIQUE index may be displayed as PRI if it cannot contain NULL values and there is no PRIMARY KEY in the table
			if !col.Nullable && !hasPK && columnKey == "UNI" {
				columnKey = "PRI"
				hasPK = true
			}
		}

		r := getRowFromColumn(ctx, i, col, db.CatalogName, db.SchemaName, tblName, columnKey, privSetTbl, curPrivSetMap)
		if r != nil {
			rows = append(rows, r)
		}
	}

	return rows, nil
}

// getRowsFromViews returns array or rows for columns for all views for given database.
func getRowsFromViews(ctx *sql.Context, catalog sql.Catalog, db DbWithNames, privSet sql.PrivilegeSet, privSetMap map[string]struct{}) ([]sql.Row, error) {
	var rows []sql.Row
	views, err := ViewsInDatabase(ctx, db.Database)
	if err != nil {
		return nil, err
	}
	privSetDb := privSet.Database(db.Database.Name())
	for _, view := range views {
		// TODO: figure out how auth works in this case
		node, _, err := planbuilder.Parse(ctx, catalog, view.CreateViewStatement)
		if err != nil {
			continue // sometimes views contains views from other databases
		}
		createViewNode, ok := node.(*plan.CreateView)
		if !ok {
			continue
		}
		privSetTbl := privSetDb.Table(view.Name)
		curPrivSetMap := getCurrentPrivSetMapForColumn(privSetDb.ToSlice(), privSetMap)
		for i, col := range createViewNode.TargetSchema() {
			r := getRowFromColumn(ctx, i, col, db.CatalogName, db.SchemaName, view.Name, "", privSetTbl, curPrivSetMap)
			if r != nil {
				rows = append(rows, r)
			}
		}
	}

	return rows, nil
}

// getRowsFromDatabase returns array of rows for all accessible columns of accessible table of the given database.
func getRowsFromDatabase(ctx *sql.Context, db DbWithNames, privSet sql.PrivilegeSet, privSetMap map[string]struct{}, allColsWithDefaultValue sql.Schema) ([]sql.Row, error) {
	var rows []sql.Row
	dbName := db.Database.Name()

	privSetDb := privSet.Database(dbName)
	curPrivSetMap := getCurrentPrivSetMapForColumn(privSetDb.ToSlice(), privSetMap)
	if dbName == sql.InformationSchemaDatabaseName {
		curPrivSetMap["select"] = struct{}{}
	}

	err := sql.DBTableIter(ctx, db.Database, func(t sql.Table) (cont bool, err error) {
		rs, err := getRowsFromTable(ctx, db, t, privSetDb, curPrivSetMap, allColsWithDefaultValue)
		if err != nil {
			return false, err
		}
		rows = append(rows, rs...)
		return true, nil
	})
	if err != nil {
		return nil, err
	}

	return rows, nil
}

// getCurrentPrivSetMapForColumn returns a new privilege set map that contains what the given privilege set map has,
// and it adds any available privileges from given array of privilege type. For example, the given privilege set map
// may contain general privilege types for the database only, and the given array of privilege type will contain all
// privilege types defined for the table specifically. This function only add `select`, `insert`, `update` and
// `references` privileges to the new privilege set map if available. These are column level privileges only.
func getCurrentPrivSetMapForColumn(privs []sql.PrivilegeType, privSetMap map[string]struct{}) map[string]struct{} {
	curPrivSetMap := make(map[string]struct{})
	for p := range privSetMap {
		curPrivSetMap[p] = struct{}{}
	}
	for _, pt := range privs {
		switch pt {
		// columns can have 'select', 'insert', 'update', 'references' privileges only.
		case sql.PrivilegeType_Select, sql.PrivilegeType_Insert, sql.PrivilegeType_Update, sql.PrivilegeType_References:
			curPrivSetMap[strings.ToLower(pt.String())] = struct{}{}
		}
	}
	return curPrivSetMap
}

// getIndexKeyInfo returns map of columns and its index information whether this column is PK or unique index, etc.
func getIndexKeyInfo(ctx *sql.Context, t sql.Table) (map[string]string, bool, error) {
	var columnKeyMap = make(map[string]string)
	// Get UNIQUEs, PRIMARY KEYs
	hasPK := false
	if indexTable, ok := t.(sql.IndexAddressable); ok {
		indexes, iErr := indexTable.GetIndexes(ctx)
		if iErr != nil {
			return columnKeyMap, hasPK, iErr
		}

		for _, index := range indexes {
			idx := ""
			if index.ID() == "PRIMARY" {
				idx = "PRI"
				hasPK = true
			} else if index.IsUnique() {
				idx = "UNI"
			} else {
				idx = "MUL"
			}

			colNames := getColumnNamesFromIndex(index, t)
			// A UNIQUE index may display as MUL if several columns form a composite UNIQUE index
			if idx == "UNI" && len(colNames) > 1 {
				idx = "MUL"
				columnKeyMap[colNames[0]] = idx
			} else {
				for _, colName := range colNames {
					columnKeyMap[colName] = idx
				}
			}
		}
	}

	return columnKeyMap, hasPK, nil
}

// GetColumnDefault returns the column default value for given sql.ColumnDefaultValue
func GetColumnDefault(ctx *sql.Context, cd *sql.ColumnDefaultValue) interface{} {
	if cd == nil {
		return nil
	}

	defStr := cd.String()
	if defStr == "NULL" {
		return nil
	}

	if !cd.IsLiteral() {
		if strings.HasPrefix(defStr, "(") && strings.HasSuffix(defStr, ")") {
			defStr = strings.TrimSuffix(strings.TrimPrefix(defStr, "("), ")")
		}
		if types.IsTime(cd.Type()) && (strings.HasPrefix(defStr, "NOW") || strings.HasPrefix(defStr, "CURRENT_TIMESTAMP")) {
			defStr = strings.Replace(defStr, "NOW", "CURRENT_TIMESTAMP", -1)
			defStr = strings.TrimSuffix(defStr, "()")
		}
		return fmt.Sprint(defStr)
	}

	if types.IsEnum(cd.Type()) || types.IsSet(cd.Type()) {
		return strings.Trim(defStr, "'")
	}

	v, err := cd.Eval(ctx, nil)
	if err != nil {
		return ""
	}

	switch l := v.(type) {
	case time.Time:
		v = l.Format("2006-01-02 15:04:05")
	case []uint8:
		hexStr := hex.EncodeToString(l)
		v = fmt.Sprintf("0x%s", hexStr)
	}

	if types.IsBit(cd.Type()) {
		if i, ok := v.(uint64); ok {
			bitStr := strconv.FormatUint(i, 2)
			v = fmt.Sprintf("b'%s'", bitStr)
		}
	}

	return fmt.Sprint(v)
}

func SchemaForTable(t sql.Table, db sql.Database, allColsWithDefaultValue sql.Schema) sql.Schema {
	start, end := -1, -1
	tableName := strings.ToLower(t.Name())

	for i, col := range allColsWithDefaultValue {
		dbName := strings.ToLower(db.Name())
		if start < 0 && strings.ToLower(col.Source) == tableName && strings.ToLower(col.DatabaseSource) == dbName {
			start = i
		} else if start >= 0 && (strings.ToLower(col.Source) != tableName || strings.ToLower(col.DatabaseSource) != dbName) {
			end = i
			break
		}
	}

	if start < 0 {
		return nil
	}

	if end < 0 {
		end = len(allColsWithDefaultValue)
	}

	return allColsWithDefaultValue[start:end]
}

// get DtdIdAndDataType returns data types for given sql.Type but in two different ways.
// The DTD_IDENTIFIER value contains the type name and possibly other information such as the precision or length.
// The DATA_TYPE value is the type name only with no other information.
func getDtdIdAndDataType(colType sql.Type) (string, string) {
	dtdId := strings.Split(strings.Split(colType.String(), " COLLATE")[0], " CHARACTER SET")[0]

	// The DATA_TYPE value is the type name only with no other information
	dataType := strings.Split(dtdId, "(")[0]
	dataType = strings.Split(dataType, " ")[0]

	return dtdId, dataType
}

// getColumnPrecisionAndScale returns the precision or a number of mysql type. For non-numeric or decimal types this
// function should return nil,nil.
func getColumnPrecisionAndScale(colType sql.Type) (interface{}, interface{}) {
	var numericScale interface{}
	switch t := colType.(type) {
	case types.BitType:
		return int(t.NumberOfBits()), numericScale
	case sql.DecimalType:
		return int(t.Precision()), int(t.Scale())
	case sql.NumberType:
		switch colType.Type() {
		case sqltypes.Float32, sqltypes.Float64:
			numericScale = nil
		default:
			numericScale = 0
		}
		return typeToNumericPrecision[colType.Type()], numericScale
	default:
		return nil, nil
	}
}

func getCharAndCollNamesAndCharMaxAndOctetLens(ctx *sql.Context, colType sql.Type) (interface{}, interface{}, interface{}, interface{}) {
	var (
		charName     interface{}
		collName     interface{}
		charMaxLen   interface{}
		charOctetLen interface{}
	)
	if twc, ok := colType.(sql.TypeWithCollation); ok && !types.IsBinaryType(colType) {
		colColl := twc.Collation()
		collName = colColl.Name()
		charName = colColl.CharacterSet().String()
		if types.IsEnum(colType) || types.IsSet(colType) {
			charOctetLen = int64(colType.MaxTextResponseByteLength(ctx))
			charMaxLen = int64(colType.MaxTextResponseByteLength(ctx)) / colColl.CharacterSet().MaxLength()
		}
	}
	if st, ok := colType.(sql.StringType); ok {
		charMaxLen = st.MaxCharacterLength()
		charOctetLen = st.MaxByteLength()
	}

	return charName, collName, charMaxLen, charOctetLen
}
