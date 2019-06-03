// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/go-xorm/core"
)

// Extracted directly from database.
var (
	verticaReservedWords = map[string]bool{
		"ABS":                              true,
		"ABSOLUTE":                         true,
		"ACTION":                           true,
		"ADD":                              true,
		"ALL":                              true,
		"ALLOCATE":                         true,
		"ALTER":                            true,
		"AND":                              true,
		"ANY":                              true,
		"ARE":                              true,
		"ARRAY":                            true,
		"ARRAY_AGG":                        true,
		"ARRAY_MAX_CARDINALITY":            true,
		"AS":                               true,
		"ASC":                              true,
		"ASENSITIVE":                       true,
		"ASSERTION":                        true,
		"ASYMMETRIC":                       true,
		"AT":                               true,
		"ATOMIC":                           true,
		"AUTHORIZATION":                    true,
		"AVG":                              true,
		"BEGIN":                            true,
		"BEGIN_FRAME":                      true,
		"BEGIN_PARTITION":                  true,
		"BETWEEN":                          true,
		"BIGINT":                           true,
		"BINARY":                           true,
		"BIT":                              true,
		"BIT_LENGTH":                       true,
		"BLOB":                             true,
		"BOOLEAN":                          true,
		"BOTH":                             true,
		"BY":                               true,
		"CALL":                             true,
		"CALLED":                           true,
		"CARDINALITY":                      true,
		"CASCADE":                          true,
		"CASCADED":                         true,
		"CASE":                             true,
		"CAST":                             true,
		"CATALOG":                          true,
		"CEIL":                             true,
		"CEILING":                          true,
		"CHAR":                             true,
		"CHARACTER":                        true,
		"CHARACTER_LENGTH":                 true,
		"CHAR_LENGTH":                      true,
		"CHECK":                            true,
		"CLOB":                             true,
		"CLOSE":                            true,
		"COALESCE":                         true,
		"COLLATE":                          true,
		"COLLATION":                        true,
		"COLLECT":                          true,
		"COLUMN":                           true,
		"COMMIT":                           true,
		"CONDITION":                        true,
		"CONNECT":                          true,
		"CONNECTION":                       true,
		"CONSTRAINT":                       true,
		"CONSTRAINTS":                      true,
		"CONTAINS":                         true,
		"CONTINUE":                         true,
		"CONVERT":                          true,
		"CORR":                             true,
		"CORRESPONDING":                    true,
		"COUNT":                            true,
		"COVAR_POP":                        true,
		"COVAR_SAMP":                       true,
		"CREATE":                           true,
		"CROSS":                            true,
		"CUBE":                             true,
		"CUME_DIST":                        true,
		"CURRENT":                          true,
		"CURRENT_CATALOG":                  true,
		"CURRENT_DATE":                     true,
		"CURRENT_DEFAULT_TRANSFORM_GROUP":  true,
		"CURRENT_PATH":                     true,
		"CURRENT_ROLE":                     true,
		"CURRENT_ROW":                      true,
		"CURRENT_SCHEMA":                   true,
		"CURRENT_TIME":                     true,
		"CURRENT_TIMESTAMP":                true,
		"CURRENT_TRANSFORM_GROUP_FOR_TYPE": true,
		"CURRENT_USER":                     true,
		"CURSOR":                           true,
		"CYCLE":                            true,
		"DATALINK":                         true,
		"DATE":                             true,
		"DAY":                              true,
		"DEALLOCATE":                       true,
		"DEC":                              true,
		"DECIMAL":                          true,
		"DECLARE":                          true,
		"DEFAULT":                          true,
		"DEFERRABLE":                       true,
		"DEFERRED":                         true,
		"DELETE":                           true,
		"DENSE_RANK":                       true,
		"DEREF":                            true,
		"DESC":                             true,
		"DESCRIBE":                         true,
		"DESCRIPTOR":                       true,
		"DETERMINISTIC":                    true,
		"DIAGNOSTICS":                      true,
		"DISCONNECT":                       true,
		"DISTINCT":                         true,
		"DLNEWCOPY":                        true,
		"DLPREVIOUSCOPY":                   true,
		"DLURLCOMPLETE":                    true,
		"DLURLCOMPLETEONLY":                true,
		"DLURLCOMPLETEWRITE":               true,
		"DLURLPATH":                        true,
		"DLURLPATHONLY":                    true,
		"DLURLPATHWRITE":                   true,
		"DLURLSCHEME":                      true,
		"DLURLSERVER":                      true,
		"DLVALUE":                          true,
		"DOMAIN":                           true,
		"DOUBLE":                           true,
		"DROP":                             true,
		"DYNAMIC":                          true,
		"EACH":                             true,
		"ELEMENT":                          true,
		"ELSE":                             true,
		"END":                              true,
		"END-EXEC":                         true,
		"END_FRAME":                        true,
		"END_PARTITION":                    true,
		"EQUALS":                           true,
		"ESCAPE":                           true,
		"EVERY":                            true,
		"EXCEPT":                           true,
		"EXCEPTION":                        true,
		"EXEC":                             true,
		"EXECUTE":                          true,
		"EXISTS":                           true,
		"EXP":                              true,
		"EXTERNAL":                         true,
		"EXTRACT":                          true,
		"FALSE":                            true,
		"FETCH":                            true,
		"FILTER":                           true,
		"FIRST":                            true,
		"FIRST_VALUE":                      true,
		"FLOAT":                            true,
		"FLOOR":                            true,
		"FOR":                              true,
		"FOREIGN":                          true,
		"FOUND":                            true,
		"FRAME_ROW":                        true,
		"FREE":                             true,
		"FROM":                             true,
		"FULL":                             true,
		"FUNCTION":                         true,
		"FUSION":                           true,
		"GET":                              true,
		"GLOBAL":                           true,
		"GO":                               true,
		"GOTO":                             true,
		"GRANT":                            true,
		"GROUP":                            true,
		"GROUPING":                         true,
		"GROUPS":                           true,
		"HAVING":                           true,
		"HOLD":                             true,
		"HOUR":                             true,
		"IDENTITY":                         true,
		"IMMEDIATE":                        true,
		"IMPORT":                           true,
		"IN":                               true,
		"INDICATOR":                        true,
		"INITIALLY":                        true,
		"INNER":                            true,
		"INOUT":                            true,
		"INPUT":                            true,
		"INSENSITIVE":                      true,
		"INSERT":                           true,
		"INT":                              true,
		"INTEGER":                          true,
		"INTERSECT":                        true,
		"INTERSECTION":                     true,
		"INTERVAL":                         true,
		"INTO":                             true,
		"IS":                               true,
		"ISOLATION":                        true,
		"JOIN":                             true,
		"KEY":                              true,
		"LAG":                              true,
		"LANGUAGE":                         true,
		"LARGE":                            true,
		"LAST":                             true,
		"LAST_VALUE":                       true,
		"LATERAL":                          true,
		"LEAD":                             true,
		"LEADING":                          true,
		"LEFT":                             true,
		"LEVEL":                            true,
		"LIKE":                             true,
		"LIKE_REGEX":                       true,
		"LN":                               true,
		"LOCAL":                            true,
		"LOCALTIME":                        true,
		"LOCALTIMESTAMP":                   true,
		"LOWER":                            true,
		"MATCH":                            true,
		"MAX":                              true,
		"MEMBER":                           true,
		"MERGE":                            true,
		"METHOD":                           true,
		"MIN":                              true,
		"MINUTE":                           true,
		"MOD":                              true,
		"MODIFIES":                         true,
		"MODULE":                           true,
		"MONTH":                            true,
		"MULTISET":                         true,
		"NAMES":                            true,
		"NATIONAL":                         true,
		"NATURAL":                          true,
		"NCHAR":                            true,
		"NCLOB":                            true,
		"NEW":                              true,
		"NEXT":                             true,
		"NO":                               true,
		"NONE":                             true,
		"NORMALIZE":                        true,
		"NOT":                              true,
		"NTH_VALUE":                        true,
		"NTILE":                            true,
		"NULL":                             true,
		"NULLIF":                           true,
		"NUMERIC":                          true,
		"OCCURRENCES_REGEX":                true,
		"OCTET_LENGTH":                     true,
		"OF":                               true,
		"OFFSET":                           true,
		"OLD":                              true,
		"ON":                               true,
		"ONLY":                             true,
		"OPEN":                             true,
		"OPTION":                           true,
		"OR":                               true,
		"ORDER":                            true,
		"OUT":                              true,
		"OUTER":                            true,
		"OUTPUT":                           true,
		"OVER":                             true,
		"OVERLAPS":                         true,
		"OVERLAY":                          true,
		"PAD":                              true,
		"PARAMETER":                        true,
		"PARTIAL":                          true,
		"PARTITION":                        true,
		"PERCENT":                          true,
		"PERCENTILE_CONT":                  true,
		"PERCENTILE_DISC":                  true,
		"PERCENT_RANK":                     true,
		"PERIOD":                           true,
		"PORTION":                          true,
		"POSITION":                         true,
		"POSITION_REGEX":                   true,
		"POWER":                            true,
		"PRECEDES":                         true,
		"PRECISION":                        true,
		"PREPARE":                          true,
		"PRESERVE":                         true,
		"PRIMARY":                          true,
		"PRIOR":                            true,
		"PRIVILEGES":                       true,
		"PROCEDURE":                        true,
		"PUBLIC":                           true,
		"RANGE":                            true,
		"RANK":                             true,
		"READ":                             true,
		"READS":                            true,
		"REAL":                             true,
		"RECURSIVE":                        true,
		"REF":                              true,
		"REFERENCES":                       true,
		"REFERENCING":                      true,
		"REGR_AVGX":                        true,
		"REGR_AVGY":                        true,
		"REGR_COUNT":                       true,
		"REGR_INTERCEPT":                   true,
		"REGR_R2":                          true,
		"REGR_SLOPE":                       true,
		"REGR_SXX":                         true,
		"REGR_SXY":                         true,
		"REGR_SYY":                         true,
		"RELATIVE":                         true,
		"RELEASE":                          true,
		"RESTRICT":                         true,
		"RESULT":                           true,
		"RETURN":                           true,
		"RETURNS":                          true,
		"REVOKE":                           true,
		"RIGHT":                            true,
		"ROLLBACK":                         true,
		"ROLLUP":                           true,
		"ROW":                              true,
		"ROWS":                             true,
		"ROW_NUMBER":                       true,
		"SAVEPOINT":                        true,
		"SCHEMA":                           true,
		"SCOPE":                            true,
		"SCROLL":                           true,
		"SEARCH":                           true,
		"SECOND":                           true,
		"SECTION":                          true,
		"SELECT":                           true,
		"SENSITIVE":                        true,
		"SESSION":                          true,
		"SESSION_USER":                     true,
		"SET":                              true,
		"SIMILAR":                          true,
		"SIZE":                             true,
		"SMALLINT":                         true,
		"SOME":                             true,
		"SPACE":                            true,
		"SPECIFIC":                         true,
		"SPECIFICTYPE":                     true,
		"SQL":                              true,
		"SQLCODE":                          true,
		"SQLERROR":                         true,
		"SQLEXCEPTION":                     true,
		"SQLSTATE":                         true,
		"SQLWARNING":                       true,
		"SQRT":                             true,
		"START":                            true,
		"STATIC":                           true,
		"STDDEV_POP":                       true,
		"STDDEV_SAMP":                      true,
		"SUBMULTISET":                      true,
		"SUBSTRING":                        true,
		"SUBSTRING_REGEX":                  true,
		"SUCCEEDS":                         true,
		"SUM":                              true,
		"SYMMETRIC":                        true,
		"SYSTEM":                           true,
		"SYSTEM_TIME":                      true,
		"SYSTEM_USER":                      true,
		"TABLE":                            true,
		"TABLESAMPLE":                      true,
		"TEMPORARY":                        true,
		"THEN":                             true,
		"TIME":                             true,
		"TIMESTAMP":                        true,
		"TIMEZONE_HOUR":                    true,
		"TIMEZONE_MINUTE":                  true,
		"TO":                               true,
		"TRAILING":                         true,
		"TRANSACTION":                      true,
		"TRANSLATE":                        true,
		"TRANSLATE_REGEX":                  true,
		"TRANSLATION":                      true,
		"TREAT":                            true,
		"TRIGGER":                          true,
		"TRIM":                             true,
		"TRIM_ARRAY":                       true,
		"TRUE":                             true,
		"TRUNCATE":                         true,
		"UESCAPE":                          true,
		"UNION":                            true,
		"UNIQUE":                           true,
		"UNKNOWN":                          true,
		"UNNEST":                           true,
		"UPDATE":                           true,
		"UPPER":                            true,
		"USAGE":                            true,
		"USER":                             true,
		"USING":                            true,
		"VALUE":                            true,
		"VALUES":                           true,
		"VALUE_OF":                         true,
		"VARBINARY":                        true,
		"VARCHAR":                          true,
		"VARYING":                          true,
		"VAR_POP":                          true,
		"VAR_SAMP":                         true,
		"VERSIONING":                       true,
		"VIEW":                             true,
		"WHEN":                             true,
		"WHENEVER":                         true,
		"WHERE":                            true,
		"WIDTH_BUCKET":                     true,
		"WINDOW":                           true,
		"WITH":                             true,
		"WITHIN":                           true,
		"WITHOUT":                          true,
		"WORK":                             true,
		"WRITE":                            true,
		"XML":                              true,
		"XMLAGG":                           true,
		"XMLATTRIBUTES":                    true,
		"XMLBINARY":                        true,
		"XMLCAST":                          true,
		"XMLCOMMENT":                       true,
		"XMLCONCAT":                        true,
		"XMLDOCUMENT":                      true,
		"XMLELEMENT":                       true,
		"XMLEXISTS":                        true,
		"XMLFOREST":                        true,
		"XMLITERATE":                       true,
		"XMLNAMESPACES":                    true,
		"XMLPARSE":                         true,
		"XMLPI":                            true,
		"XMLQUERY":                         true,
		"XMLSERIALIZE":                     true,
		"XMLTABLE":                         true,
		"XMLTEXT":                          true,
		"XMLVALIDATE":                      true,
		"YEAR":                             true,
		"ZONE":                             true,
	}

	// Default vertica schema
	DefaultVerticaSchema = "public"
)

type vertica struct {
	core.Base
}

// Init is the basic init. It calls the superclass.
func (db *vertica) Init(d *core.DB, uri *core.Uri, drivername, dataSourceName string) error {
	err := db.Base.Init(d, db, uri, drivername, dataSourceName)
	if err != nil {
		return err
	}
	if db.Schema == "" {
		db.Schema = DefaultVerticaSchema
	}
	return nil
}

// TODO: Map the sql types
func (db *vertica) SqlType(c *core.Column) string {
	var res string
	switch t := c.SQLType.Name; t {
	case core.TinyInt:
		res = core.SmallInt
		return res
	case core.Bit:
		res = core.Boolean
		return res
	case core.MediumInt, core.Int, core.Integer:
		if c.IsAutoIncrement {
			return core.Serial
		}
		return core.Integer
	case core.BigInt:
		if c.IsAutoIncrement {
			return core.BigSerial
		}
		return core.BigInt
	case core.Serial, core.BigSerial:
		c.IsAutoIncrement = true
		c.Nullable = false
		res = t
	case core.Binary, core.VarBinary:
		return core.Bytea
	case core.DateTime:
		res = core.TimeStamp
	case core.TimeStampz:
		return "timestamp with time zone"
	case core.Float:
		res = core.Real
	case core.TinyText, core.MediumText, core.LongText:
		res = core.Text
	case core.NVarchar:
		res = core.Varchar
	case core.Uuid:
		res = core.Uuid
	case core.Blob, core.TinyBlob, core.MediumBlob, core.LongBlob:
		return core.Bytea
	case core.Double:
		return "DOUBLE PRECISION"
	default:
		if c.IsAutoIncrement {
			return core.Serial
		}
		res = t
	}

	hasLen1 := (c.Length > 0)
	hasLen2 := (c.Length2 > 0)

	if hasLen2 {
		res += "(" + strconv.Itoa(c.Length) + "," + strconv.Itoa(c.Length2) + ")"
	} else if hasLen1 {
		res += "(" + strconv.Itoa(c.Length) + ")"
	}
	return res
}

func (db *vertica) SupportInsertMany() bool {
	return true
}

func (db *vertica) IsReserved(name string) bool {
	_, ok := verticaReservedWords[name]
	return ok
}

func (db *vertica) Quote(name string) string {
	name = strings.Replace(name, ".", `"."`, -1)
	return "\"" + name + "\""
}

func (db *vertica) QuoteStr() string {
	return "\""
}

func (db *vertica) AutoIncrStr() string {
	return ""
}

func (db *vertica) SupportEngine() bool {
	return false
}

func (db *vertica) SupportCharset() bool {
	return false
}

func (db *vertica) IndexOnTable() bool {
	return false
}

// IndexCheckSql checks for existence of an index. We may or may not have a schema defined.
// Note that Vertica doesn't have indexes, but projections somewhat fill the same function.
func (db *vertica) IndexCheckSql(tableName, idxName string) (string, []interface{}) {
	if len(db.Schema) == 0 {
		return `SELECT projection_name FROM v_catalog.projections WHERE anchor_table_name = ? AND projection_name = ?`, []interface{}{tableName, idxName}
	}

	return `SELECT projection_name FROM v_catalog.projections ` +
		`WHERE projection_schema = ? AND anchor_table_name = ? AND projection_name = ?`, []interface{}{db.Schema, tableName, idxName}
}

// TableCheckSql checks for the existence of a table. We may or may not have a schema defined.
func (db *vertica) TableCheckSql(tableName string) (string, []interface{}) {
	if len(db.Schema) == 0 {
		return "SELECT table_name FROM v_catalog.tables WHERE table_name = ?", []interface{}{tableName}
	}

	return `SELECT table_name FROM v_catalog.tables WHERE table_schema = ? AND table_name = ?`, []interface{}{db.Schema, tableName}
}

// ModifyColumnSql modifies a column (of course).
func (db *vertica) ModifyColumnSql(tableName string, col *core.Column) string {
	if len(db.Schema) == 0 {
		return fmt.Sprintf("ALTER TABLE %s ALTER COLUMN %s SET DATA TYPE %s", tableName, col.Name, db.SqlType(col))
	}

	return fmt.Sprintf("ALTER TABLE %s.%s ALTER COLUMN %s SET DATA TYPE %s", db.Schema, tableName, col.Name, db.SqlType(col))
}

// DropIndexSql drops an index. Again, in this case, we will drop a projection instead.
func (db *vertica) DropIndexSql(tableName string, index *core.Index) string {
	quote := db.Quote
	idxName := index.Name

	if len(db.Schema) == 0 {
		return fmt.Sprintf("DROP PROJECTION %v CASCADE", quote(idxName))
	}

	return fmt.Sprintf("DROP PROJECTION %v.%v CASCADE", db.Schema, quote(idxName))
}

// IsColumnExist checks to see if a column exists.
func (db *vertica) IsColumnExist(tableName, colName string) (bool, error) {

	var args []interface{}
	var query string

	if len(db.Schema) == 0 {
		args = []interface{}{tableName, colName}
		query = "SELECT column_name FROM v_catalog.columns WHERE table_name = ? AND column_name = ?"
	} else {
		args = []interface{}{db.Schema, tableName, colName}
		query = "SELECT column_name FROM v_catalog.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?"
	}

	db.LogSQL(query, args)

	rows, err := db.DB().Query(query, args...)

	if err != nil {
		return false, err
	}

	defer rows.Close()

	return rows.Next(), nil
}

// TODO: GetColumns returns
func (db *vertica) GetColumns(tableName string) ([]string, map[string]*core.Column, error) {
	args := []interface{}{tableName}
	s := `SELECT column_name, column_default, is_nullable, data_type, character_maximum_length, numeric_precision, numeric_precision_radix ,
    CASE WHEN p.contype = 'p' THEN true ELSE false END AS primarykey,
    CASE WHEN p.contype = 'u' THEN true ELSE false END AS uniquekey
FROM pg_attribute f
    JOIN pg_class c ON c.oid = f.attrelid JOIN pg_type t ON t.oid = f.atttypid
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = f.attnum
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_constraint p ON p.conrelid = c.oid AND f.attnum = ANY (p.conkey)
    LEFT JOIN pg_class AS g ON p.confrelid = g.oid
    LEFT JOIN INFORMATION_SCHEMA.COLUMNS s ON s.column_name=f.attname AND c.relname=s.table_name
WHERE c.relkind = 'r'::char AND c.relname = $1%s AND f.attnum > 0 ORDER BY f.attnum;`

	var f string
	if len(db.Schema) != 0 {
		args = append(args, db.Schema)
		f = " AND s.table_schema = $2"
	}
	s = fmt.Sprintf(s, f)

	db.LogSQL(s, args)

	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	cols := make(map[string]*core.Column)
	colSeq := make([]string, 0)

	for rows.Next() {
		col := new(core.Column)
		col.Indexes = make(map[string]int)

		var colName, isNullable, dataType string
		var maxLenStr, colDefault, numPrecision, numRadix *string
		var isPK, isUnique bool
		err = rows.Scan(&colName, &colDefault, &isNullable, &dataType, &maxLenStr, &numPrecision, &numRadix, &isPK, &isUnique)
		if err != nil {
			return nil, nil, err
		}

		//fmt.Println(args, colName, isNullable, dataType, maxLenStr, colDefault, numPrecision, numRadix, isPK, isUnique)
		var maxLen int
		if maxLenStr != nil {
			maxLen, err = strconv.Atoi(*maxLenStr)
			if err != nil {
				return nil, nil, err
			}
		}

		col.Name = strings.Trim(colName, `" `)

		if colDefault != nil || isPK {
			if isPK {
				col.IsPrimaryKey = true
			} else {
				col.Default = *colDefault
			}
		}

		if colDefault != nil && strings.HasPrefix(*colDefault, "nextval(") {
			col.IsAutoIncrement = true
		}

		col.Nullable = (isNullable == "YES")

		switch dataType {
		case "character varying", "character":
			col.SQLType = core.SQLType{Name: core.Varchar, DefaultLength: 0, DefaultLength2: 0}
		case "timestamp without time zone":
			col.SQLType = core.SQLType{Name: core.DateTime, DefaultLength: 0, DefaultLength2: 0}
		case "timestamp with time zone":
			col.SQLType = core.SQLType{Name: core.TimeStampz, DefaultLength: 0, DefaultLength2: 0}
		case "double precision":
			col.SQLType = core.SQLType{Name: core.Double, DefaultLength: 0, DefaultLength2: 0}
		case "boolean":
			col.SQLType = core.SQLType{Name: core.Bool, DefaultLength: 0, DefaultLength2: 0}
		case "time without time zone":
			col.SQLType = core.SQLType{Name: core.Time, DefaultLength: 0, DefaultLength2: 0}
		case "oid":
			col.SQLType = core.SQLType{Name: core.BigInt, DefaultLength: 0, DefaultLength2: 0}
		default:
			col.SQLType = core.SQLType{Name: strings.ToUpper(dataType), DefaultLength: 0, DefaultLength2: 0}
		}
		if _, ok := core.SqlTypes[col.SQLType.Name]; !ok {
			return nil, nil, fmt.Errorf("Unknown colType: %v", dataType)
		}

		col.Length = maxLen

		if col.SQLType.IsText() || col.SQLType.IsTime() {
			if col.Default != "" {
				col.Default = "'" + col.Default + "'"
			} else {
				if col.DefaultIsEmpty {
					col.Default = "''"
				}
			}
		}
		cols[col.Name] = col
		colSeq = append(colSeq, col.Name)
	}

	return colSeq, cols, nil
}

// GetTables returns a list of tables.
func (db *vertica) GetTables() ([]*core.Table, error) {
	args := []interface{}{}

	s := "SELECT table_name FROM v_catalog.tables"

	if len(db.Schema) != 0 {
		args = append(args, db.Schema)
		s = s + " WHERE table_schema = ?"
	}

	db.LogSQL(s, args)

	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := make([]*core.Table, 0)
	for rows.Next() {
		table := core.NewEmptyTable()
		var name string
		err = rows.Scan(&name)
		if err != nil {
			return nil, err
		}
		table.Name = name
		tables = append(tables, table)
	}

	return tables, nil
}

// TODO: GetIndexes return a list of all indexes (projections)
func (db *vertica) GetIndexes(tableName string) (map[string]*core.Index, error) {
	args := []interface{}{tableName}
	s := fmt.Sprintf("SELECT indexname, indexdef FROM pg_indexes WHERE tablename=$1")
	if len(db.Schema) != 0 {
		args = append(args, db.Schema)
		s = s + " AND schemaname=$2"
	}
	db.LogSQL(s, args)

	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := make(map[string]*core.Index, 0)
	for rows.Next() {
		var indexType int
		var indexName, indexdef string
		var colNames []string
		err = rows.Scan(&indexName, &indexdef)
		if err != nil {
			return nil, err
		}
		indexName = strings.Trim(indexName, `" `)
		if strings.HasSuffix(indexName, "_pkey") {
			continue
		}
		if strings.HasPrefix(indexdef, "CREATE UNIQUE INDEX") {
			indexType = core.UniqueType
		} else {
			indexType = core.IndexType
		}
		cs := strings.Split(indexdef, "(")
		colNames = strings.Split(cs[1][0:len(cs[1])-1], ",")
		var isRegular bool
		if strings.HasPrefix(indexName, "IDX_"+tableName) || strings.HasPrefix(indexName, "UQE_"+tableName) {
			newIdxName := indexName[5+len(tableName):]
			isRegular = true
			if newIdxName != "" {
				indexName = newIdxName
			}
		}

		index := &core.Index{Name: indexName, Type: indexType, Cols: make([]string, 0)}
		for _, colName := range colNames {
			index.Cols = append(index.Cols, strings.Trim(colName, `" `))
		}
		index.IsRegular = isRegular
		indexes[index.Name] = index
	}
	return indexes, nil
}

// TODO: Figure out what this is for.
func (db *vertica) Filters() []core.Filter {
	return []core.Filter{&core.IdFilter{}, &core.QuoteFilter{}, &core.SeqFilter{Prefix: "$", Start: 1}}
}

type verticaDriver struct {
}

// type values map[string]string

// func (vs values) Set(k, v string) {
// 	vs[k] = v
// }

// func (vs values) Get(k string) (v string) {
// 	return vs[k]
// }

// // TODO: Parse URL
// func parseURL(connstr string) (string, error) {
// 	u, err := url.Parse(connstr)

// 	if err != nil {
// 		return "", err
// 	}

// 	if u.Scheme != "vertica" {
// 		return "", fmt.Errorf("invalid connection protocol: %s", u.Scheme)
// 	}

// 	escaper := strings.NewReplacer(` `, `\ `, `'`, `\'`, `\`, `\\`)

// 	if u.Path != "" {
// 		return escaper.Replace(u.Path[1:]), nil
// 	}

// 	return "", nil
// }

// // TODO: Parse options
// func parseOpts(name string, o values) error {
// 	if len(name) == 0 {
// 		return fmt.Errorf("invalid options: %s", name)
// 	}

// 	name = strings.TrimSpace(name)

// 	ps := strings.Split(name, " ")
// 	for _, p := range ps {
// 		kv := strings.Split(p, "=")
// 		if len(kv) < 2 {
// 			return fmt.Errorf("invalid option: %q", p)
// 		}
// 		o.Set(kv[0], kv[1])
// 	}

// 	return nil
// }

// TODO: Parse options.
func (v *verticaDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	db := &core.Uri{DbType: core.VERTICA}
	var err error

	if strings.HasPrefix(dataSourceName, "vertica://") {

		u, err := url.Parse(dataSourceName)
		if err != nil {
			return nil, err
		}

		db.DbName = u.Path

	} else {
		o := make(values)
		err = parseOpts(dataSourceName, o)
		if err != nil {
			return nil, err
		}

		db.DbName = o.Get("dbname")
	}

	if db.DbName == "" {
		return nil, errors.New("dbname is empty")
	}

	return db, nil
}

type verticaDriverX struct {
	verticaDriver
}

// TODO: Parse extended options.
func (dx *verticaDriverX) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	// Remove the leading characters for driver to work
	if len(dataSourceName) >= 9 && dataSourceName[0] == 0 {
		dataSourceName = dataSourceName[9:]
	}
	return dx.verticaDriver.Parse(driverName, dataSourceName)
}
