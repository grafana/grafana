// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"bufio"
	"bytes"
	"database/sql"
	"encoding/gob"
	"errors"
	"fmt"
	"io"
	"os"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-xorm/builder"
	"github.com/go-xorm/core"
)

// Engine is the major struct of xorm, it means a database manager.
// Commonly, an application only need one engine
type Engine struct {
	db      *core.DB
	dialect core.Dialect

	ColumnMapper  core.IMapper
	TableMapper   core.IMapper
	TagIdentifier string
	Tables        map[reflect.Type]*core.Table

	mutex  *sync.RWMutex
	Cacher core.Cacher

	showSQL      bool
	showExecTime bool

	logger     core.ILogger
	TZLocation *time.Location // The timezone of the application
	DatabaseTZ *time.Location // The timezone of the database

	disableGlobalCache bool

	tagHandlers map[string]tagHandler

	engineGroup *EngineGroup
}

// BufferSize sets buffer size for iterate
func (engine *Engine) BufferSize(size int) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.BufferSize(size)
}

// CondDeleted returns the conditions whether a record is soft deleted.
func (engine *Engine) CondDeleted(colName string) builder.Cond {
	if engine.dialect.DBType() == core.MSSQL {
		return builder.IsNull{colName}
	}
	return builder.IsNull{colName}.Or(builder.Eq{colName: zeroTime1})
}

// ShowSQL show SQL statement or not on logger if log level is great than INFO
func (engine *Engine) ShowSQL(show ...bool) {
	engine.logger.ShowSQL(show...)
	if len(show) == 0 {
		engine.showSQL = true
	} else {
		engine.showSQL = show[0]
	}
}

// ShowExecTime show SQL statement and execute time or not on logger if log level is great than INFO
func (engine *Engine) ShowExecTime(show ...bool) {
	if len(show) == 0 {
		engine.showExecTime = true
	} else {
		engine.showExecTime = show[0]
	}
}

// Logger return the logger interface
func (engine *Engine) Logger() core.ILogger {
	return engine.logger
}

// SetLogger set the new logger
func (engine *Engine) SetLogger(logger core.ILogger) {
	engine.logger = logger
	engine.dialect.SetLogger(logger)
}

// SetLogLevel sets the logger level
func (engine *Engine) SetLogLevel(level core.LogLevel) {
	engine.logger.SetLevel(level)
}

// SetDisableGlobalCache disable global cache or not
func (engine *Engine) SetDisableGlobalCache(disable bool) {
	if engine.disableGlobalCache != disable {
		engine.disableGlobalCache = disable
	}
}

// DriverName return the current sql driver's name
func (engine *Engine) DriverName() string {
	return engine.dialect.DriverName()
}

// DataSourceName return the current connection string
func (engine *Engine) DataSourceName() string {
	return engine.dialect.DataSourceName()
}

// SetMapper set the name mapping rules
func (engine *Engine) SetMapper(mapper core.IMapper) {
	engine.SetTableMapper(mapper)
	engine.SetColumnMapper(mapper)
}

// SetTableMapper set the table name mapping rule
func (engine *Engine) SetTableMapper(mapper core.IMapper) {
	engine.TableMapper = mapper
}

// SetColumnMapper set the column name mapping rule
func (engine *Engine) SetColumnMapper(mapper core.IMapper) {
	engine.ColumnMapper = mapper
}

// SupportInsertMany If engine's database support batch insert records like
// "insert into user values (name, age), (name, age)".
// When the return is ture, then engine.Insert(&users) will
// generate batch sql and exeute.
func (engine *Engine) SupportInsertMany() bool {
	return engine.dialect.SupportInsertMany()
}

// QuoteStr Engine's database use which character as quote.
// mysql, sqlite use ` and postgres use "
func (engine *Engine) QuoteStr() string {
	return engine.dialect.QuoteStr()
}

// Quote Use QuoteStr quote the string sql
func (engine *Engine) Quote(value string) string {
	value = strings.TrimSpace(value)
	if len(value) == 0 {
		return value
	}

	if string(value[0]) == engine.dialect.QuoteStr() || value[0] == '`' {
		return value
	}

	value = strings.Replace(value, ".", engine.dialect.QuoteStr()+"."+engine.dialect.QuoteStr(), -1)

	return engine.dialect.QuoteStr() + value + engine.dialect.QuoteStr()
}

// QuoteTo quotes string and writes into the buffer
func (engine *Engine) QuoteTo(buf *bytes.Buffer, value string) {
	if buf == nil {
		return
	}

	value = strings.TrimSpace(value)
	if value == "" {
		return
	}

	if string(value[0]) == engine.dialect.QuoteStr() || value[0] == '`' {
		buf.WriteString(value)
		return
	}

	value = strings.Replace(value, ".", engine.dialect.QuoteStr()+"."+engine.dialect.QuoteStr(), -1)

	buf.WriteString(engine.dialect.QuoteStr())
	buf.WriteString(value)
	buf.WriteString(engine.dialect.QuoteStr())
}

func (engine *Engine) quote(sql string) string {
	return engine.dialect.QuoteStr() + sql + engine.dialect.QuoteStr()
}

// SqlType will be deprecated, please use SQLType instead
//
// Deprecated: use SQLType instead
func (engine *Engine) SqlType(c *core.Column) string {
	return engine.SQLType(c)
}

// SQLType A simple wrapper to dialect's core.SqlType method
func (engine *Engine) SQLType(c *core.Column) string {
	return engine.dialect.SqlType(c)
}

// AutoIncrStr Database's autoincrement statement
func (engine *Engine) AutoIncrStr() string {
	return engine.dialect.AutoIncrStr()
}

// SetMaxOpenConns is only available for go 1.2+
func (engine *Engine) SetMaxOpenConns(conns int) {
	engine.db.SetMaxOpenConns(conns)
}

// SetMaxIdleConns set the max idle connections on pool, default is 2
func (engine *Engine) SetMaxIdleConns(conns int) {
	engine.db.SetMaxIdleConns(conns)
}

// SetDefaultCacher set the default cacher. Xorm's default not enable cacher.
func (engine *Engine) SetDefaultCacher(cacher core.Cacher) {
	engine.Cacher = cacher
}

// GetDefaultCacher returns the default cacher
func (engine *Engine) GetDefaultCacher() core.Cacher {
	return engine.Cacher
}

// NoCache If you has set default cacher, and you want temporilly stop use cache,
// you can use NoCache()
func (engine *Engine) NoCache() *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.NoCache()
}

// NoCascade If you do not want to auto cascade load object
func (engine *Engine) NoCascade() *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.NoCascade()
}

// MapCacher Set a table use a special cacher
func (engine *Engine) MapCacher(bean interface{}, cacher core.Cacher) error {
	v := rValue(bean)
	tb, err := engine.autoMapType(v)
	if err != nil {
		return err
	}

	tb.Cacher = cacher
	return nil
}

// NewDB provides an interface to operate database directly
func (engine *Engine) NewDB() (*core.DB, error) {
	return core.OpenDialect(engine.dialect)
}

// DB return the wrapper of sql.DB
func (engine *Engine) DB() *core.DB {
	return engine.db
}

// Dialect return database dialect
func (engine *Engine) Dialect() core.Dialect {
	return engine.dialect
}

// NewSession New a session
func (engine *Engine) NewSession() *Session {
	session := &Session{engine: engine}
	session.Init()
	return session
}

// Close the engine
func (engine *Engine) Close() error {
	return engine.db.Close()
}

// Ping tests if database is alive
func (engine *Engine) Ping() error {
	session := engine.NewSession()
	defer session.Close()
	return session.Ping()
}

// logging sql
func (engine *Engine) logSQL(sqlStr string, sqlArgs ...interface{}) {
	if engine.showSQL && !engine.showExecTime {
		if len(sqlArgs) > 0 {
			engine.logger.Infof("[SQL] %v %#v", sqlStr, sqlArgs)
		} else {
			engine.logger.Infof("[SQL] %v", sqlStr)
		}
	}
}

// Sql provides raw sql input parameter. When you have a complex SQL statement
// and cannot use Where, Id, In and etc. Methods to describe, you can use SQL.
//
// Deprecated: use SQL instead.
func (engine *Engine) Sql(querystring string, args ...interface{}) *Session {
	return engine.SQL(querystring, args...)
}

// SQL method let's you manually write raw SQL and operate
// For example:
//
//         engine.SQL("select * from user").Find(&users)
//
// This    code will execute "select * from user" and set the records to users
func (engine *Engine) SQL(query interface{}, args ...interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.SQL(query, args...)
}

// NoAutoTime Default if your struct has "created" or "updated" filed tag, the fields
// will automatically be filled with current time when Insert or Update
// invoked. Call NoAutoTime if you dont' want to fill automatically.
func (engine *Engine) NoAutoTime() *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.NoAutoTime()
}

// NoAutoCondition disable auto generate Where condition from bean or not
func (engine *Engine) NoAutoCondition(no ...bool) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.NoAutoCondition(no...)
}

// DBMetas Retrieve all tables, columns, indexes' informations from database.
func (engine *Engine) DBMetas() ([]*core.Table, error) {
	tables, err := engine.dialect.GetTables()
	if err != nil {
		return nil, err
	}

	for _, table := range tables {
		colSeq, cols, err := engine.dialect.GetColumns(table.Name)
		if err != nil {
			return nil, err
		}
		for _, name := range colSeq {
			table.AddColumn(cols[name])
		}
		indexes, err := engine.dialect.GetIndexes(table.Name)
		if err != nil {
			return nil, err
		}
		table.Indexes = indexes

		for _, index := range indexes {
			for _, name := range index.Cols {
				if col := table.GetColumn(name); col != nil {
					col.Indexes[index.Name] = index.Type
				} else {
					return nil, fmt.Errorf("Unknown col %s in index %v of table %v, columns %v", name, index.Name, table.Name, table.ColumnsSeq())
				}
			}
		}
	}
	return tables, nil
}

// DumpAllToFile dump database all table structs and data to a file
func (engine *Engine) DumpAllToFile(fp string, tp ...core.DbType) error {
	f, err := os.Create(fp)
	if err != nil {
		return err
	}
	defer f.Close()
	return engine.DumpAll(f, tp...)
}

// DumpAll dump database all table structs and data to w
func (engine *Engine) DumpAll(w io.Writer, tp ...core.DbType) error {
	tables, err := engine.DBMetas()
	if err != nil {
		return err
	}
	return engine.DumpTables(tables, w, tp...)
}

// DumpTablesToFile dump specified tables to SQL file.
func (engine *Engine) DumpTablesToFile(tables []*core.Table, fp string, tp ...core.DbType) error {
	f, err := os.Create(fp)
	if err != nil {
		return err
	}
	defer f.Close()
	return engine.DumpTables(tables, f, tp...)
}

// DumpTables dump specify tables to io.Writer
func (engine *Engine) DumpTables(tables []*core.Table, w io.Writer, tp ...core.DbType) error {
	return engine.dumpTables(tables, w, tp...)
}

// dumpTables dump database all table structs and data to w with specify db type
func (engine *Engine) dumpTables(tables []*core.Table, w io.Writer, tp ...core.DbType) error {
	var dialect core.Dialect
	var distDBName string
	if len(tp) == 0 {
		dialect = engine.dialect
		distDBName = string(engine.dialect.DBType())
	} else {
		dialect = core.QueryDialect(tp[0])
		if dialect == nil {
			return errors.New("Unsupported database type")
		}
		dialect.Init(nil, engine.dialect.URI(), "", "")
		distDBName = string(tp[0])
	}

	_, err := io.WriteString(w, fmt.Sprintf("/*Generated by xorm v%s %s, from %s to %s*/\n\n",
		Version, time.Now().In(engine.TZLocation).Format("2006-01-02 15:04:05"), engine.dialect.DBType(), strings.ToUpper(distDBName)))
	if err != nil {
		return err
	}

	for i, table := range tables {
		if i > 0 {
			_, err = io.WriteString(w, "\n")
			if err != nil {
				return err
			}
		}
		_, err = io.WriteString(w, dialect.CreateTableSql(table, "", table.StoreEngine, "")+";\n")
		if err != nil {
			return err
		}
		for _, index := range table.Indexes {
			_, err = io.WriteString(w, dialect.CreateIndexSql(table.Name, index)+";\n")
			if err != nil {
				return err
			}
		}

		cols := table.ColumnsSeq()
		colNames := dialect.Quote(strings.Join(cols, dialect.Quote(", ")))

		rows, err := engine.DB().Query("SELECT " + colNames + " FROM " + engine.Quote(table.Name))
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			dest := make([]interface{}, len(cols))
			err = rows.ScanSlice(&dest)
			if err != nil {
				return err
			}

			_, err = io.WriteString(w, "INSERT INTO "+dialect.Quote(table.Name)+" ("+colNames+") VALUES (")
			if err != nil {
				return err
			}

			var temp string
			for i, d := range dest {
				col := table.GetColumn(cols[i])
				if col == nil {
					return errors.New("unknow column error")
				}

				if d == nil {
					temp += ", NULL"
				} else if col.SQLType.IsText() || col.SQLType.IsTime() {
					var v = fmt.Sprintf("%s", d)
					if strings.HasSuffix(v, " +0000 UTC") {
						temp += fmt.Sprintf(", '%s'", v[0:len(v)-len(" +0000 UTC")])
					} else {
						temp += ", '" + strings.Replace(v, "'", "''", -1) + "'"
					}
				} else if col.SQLType.IsBlob() {
					if reflect.TypeOf(d).Kind() == reflect.Slice {
						temp += fmt.Sprintf(", %s", dialect.FormatBytes(d.([]byte)))
					} else if reflect.TypeOf(d).Kind() == reflect.String {
						temp += fmt.Sprintf(", '%s'", d.(string))
					}
				} else if col.SQLType.IsNumeric() {
					switch reflect.TypeOf(d).Kind() {
					case reflect.Slice:
						temp += fmt.Sprintf(", %s", string(d.([]byte)))
					case reflect.Int16, reflect.Int8, reflect.Int32, reflect.Int64, reflect.Int:
						if col.SQLType.Name == core.Bool {
							temp += fmt.Sprintf(", %v", strconv.FormatBool(reflect.ValueOf(d).Int() > 0))
						} else {
							temp += fmt.Sprintf(", %v", d)
						}
					case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
						if col.SQLType.Name == core.Bool {
							temp += fmt.Sprintf(", %v", strconv.FormatBool(reflect.ValueOf(d).Uint() > 0))
						} else {
							temp += fmt.Sprintf(", %v", d)
						}
					default:
						temp += fmt.Sprintf(", %v", d)
					}
				} else {
					s := fmt.Sprintf("%v", d)
					if strings.Contains(s, ":") || strings.Contains(s, "-") {
						if strings.HasSuffix(s, " +0000 UTC") {
							temp += fmt.Sprintf(", '%s'", s[0:len(s)-len(" +0000 UTC")])
						} else {
							temp += fmt.Sprintf(", '%s'", s)
						}
					} else {
						temp += fmt.Sprintf(", %s", s)
					}
				}
			}
			_, err = io.WriteString(w, temp[2:]+");\n")
			if err != nil {
				return err
			}
		}

		// FIXME: Hack for postgres
		if string(dialect.DBType()) == core.POSTGRES && table.AutoIncrColumn() != nil {
			_, err = io.WriteString(w, "SELECT setval('table_id_seq', COALESCE((SELECT MAX("+table.AutoIncrColumn().Name+") FROM "+dialect.Quote(table.Name)+"), 1), false);\n")
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (engine *Engine) tableName(beanOrTableName interface{}) (string, error) {
	v := rValue(beanOrTableName)
	if v.Type().Kind() == reflect.String {
		return beanOrTableName.(string), nil
	} else if v.Type().Kind() == reflect.Struct {
		return engine.tbName(v), nil
	}
	return "", errors.New("bean should be a struct or struct's point")
}

func (engine *Engine) tbName(v reflect.Value) string {
	if tb, ok := v.Interface().(TableName); ok {
		return tb.TableName()
	}

	if v.Type().Kind() == reflect.Ptr {
		if tb, ok := reflect.Indirect(v).Interface().(TableName); ok {
			return tb.TableName()
		}
	} else if v.CanAddr() {
		if tb, ok := v.Addr().Interface().(TableName); ok {
			return tb.TableName()
		}
	}
	return engine.TableMapper.Obj2Table(reflect.Indirect(v).Type().Name())
}

// Cascade use cascade or not
func (engine *Engine) Cascade(trueOrFalse ...bool) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Cascade(trueOrFalse...)
}

// Where method provide a condition query
func (engine *Engine) Where(query interface{}, args ...interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Where(query, args...)
}

// Id will be deprecated, please use ID instead
func (engine *Engine) Id(id interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Id(id)
}

// ID method provoide a condition as (id) = ?
func (engine *Engine) ID(id interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.ID(id)
}

// Before apply before Processor, affected bean is passed to closure arg
func (engine *Engine) Before(closures func(interface{})) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Before(closures)
}

// After apply after insert Processor, affected bean is passed to closure arg
func (engine *Engine) After(closures func(interface{})) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.After(closures)
}

// Charset set charset when create table, only support mysql now
func (engine *Engine) Charset(charset string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Charset(charset)
}

// StoreEngine set store engine when create table, only support mysql now
func (engine *Engine) StoreEngine(storeEngine string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.StoreEngine(storeEngine)
}

// Distinct use for distinct columns. Caution: when you are using cache,
// distinct will not be cached because cache system need id,
// but distinct will not provide id
func (engine *Engine) Distinct(columns ...string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Distinct(columns...)
}

// Select customerize your select columns or contents
func (engine *Engine) Select(str string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Select(str)
}

// Cols only use the parameters as select or update columns
func (engine *Engine) Cols(columns ...string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Cols(columns...)
}

// AllCols indicates that all columns should be use
func (engine *Engine) AllCols() *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.AllCols()
}

// MustCols specify some columns must use even if they are empty
func (engine *Engine) MustCols(columns ...string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.MustCols(columns...)
}

// UseBool xorm automatically retrieve condition according struct, but
// if struct has bool field, it will ignore them. So use UseBool
// to tell system to do not ignore them.
// If no parameters, it will use all the bool field of struct, or
// it will use parameters's columns
func (engine *Engine) UseBool(columns ...string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.UseBool(columns...)
}

// Omit only not use the parameters as select or update columns
func (engine *Engine) Omit(columns ...string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Omit(columns...)
}

// Nullable set null when column is zero-value and nullable for update
func (engine *Engine) Nullable(columns ...string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Nullable(columns...)
}

// In will generate "column IN (?, ?)"
func (engine *Engine) In(column string, args ...interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.In(column, args...)
}

// NotIn will generate "column NOT IN (?, ?)"
func (engine *Engine) NotIn(column string, args ...interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.NotIn(column, args...)
}

// Incr provides a update string like "column = column + ?"
func (engine *Engine) Incr(column string, arg ...interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Incr(column, arg...)
}

// Decr provides a update string like "column = column - ?"
func (engine *Engine) Decr(column string, arg ...interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Decr(column, arg...)
}

// SetExpr provides a update string like "column = {expression}"
func (engine *Engine) SetExpr(column string, expression string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.SetExpr(column, expression)
}

// Table temporarily change the Get, Find, Update's table
func (engine *Engine) Table(tableNameOrBean interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Table(tableNameOrBean)
}

// Alias set the table alias
func (engine *Engine) Alias(alias string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Alias(alias)
}

// Limit will generate "LIMIT start, limit"
func (engine *Engine) Limit(limit int, start ...int) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Limit(limit, start...)
}

// Desc will generate "ORDER BY column1 DESC, column2 DESC"
func (engine *Engine) Desc(colNames ...string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Desc(colNames...)
}

// Asc will generate "ORDER BY column1,column2 Asc"
// This method can chainable use.
//
//        engine.Desc("name").Asc("age").Find(&users)
//        // SELECT * FROM user ORDER BY name DESC, age ASC
//
func (engine *Engine) Asc(colNames ...string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Asc(colNames...)
}

// OrderBy will generate "ORDER BY order"
func (engine *Engine) OrderBy(order string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.OrderBy(order)
}

// Prepare enables prepare statement
func (engine *Engine) Prepare() *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Prepare()
}

// Join the join_operator should be one of INNER, LEFT OUTER, CROSS etc - this will be prepended to JOIN
func (engine *Engine) Join(joinOperator string, tablename interface{}, condition string, args ...interface{}) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Join(joinOperator, tablename, condition, args...)
}

// GroupBy generate group by statement
func (engine *Engine) GroupBy(keys string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.GroupBy(keys)
}

// Having generate having statement
func (engine *Engine) Having(conditions string) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Having(conditions)
}

// UnMapType removes the datbase mapper of a type
func (engine *Engine) UnMapType(t reflect.Type) {
	engine.mutex.Lock()
	defer engine.mutex.Unlock()
	delete(engine.Tables, t)
}

func (engine *Engine) autoMapType(v reflect.Value) (*core.Table, error) {
	t := v.Type()
	engine.mutex.Lock()
	defer engine.mutex.Unlock()
	table, ok := engine.Tables[t]
	if !ok {
		var err error
		table, err = engine.mapType(v)
		if err != nil {
			return nil, err
		}

		engine.Tables[t] = table
		if engine.Cacher != nil {
			if v.CanAddr() {
				engine.GobRegister(v.Addr().Interface())
			} else {
				engine.GobRegister(v.Interface())
			}
		}
	}
	return table, nil
}

// GobRegister register one struct to gob for cache use
func (engine *Engine) GobRegister(v interface{}) *Engine {
	gob.Register(v)
	return engine
}

// Table table struct
type Table struct {
	*core.Table
	Name string
}

// IsValid if table is valid
func (t *Table) IsValid() bool {
	return t.Table != nil && len(t.Name) > 0
}

// TableInfo get table info according to bean's content
func (engine *Engine) TableInfo(bean interface{}) *Table {
	v := rValue(bean)
	tb, err := engine.autoMapType(v)
	if err != nil {
		engine.logger.Error(err)
	}
	return &Table{tb, engine.tbName(v)}
}

func addIndex(indexName string, table *core.Table, col *core.Column, indexType int) {
	if index, ok := table.Indexes[indexName]; ok {
		index.AddColumn(col.Name)
		col.Indexes[index.Name] = indexType
	} else {
		index := core.NewIndex(indexName, indexType)
		index.AddColumn(col.Name)
		table.AddIndex(index)
		col.Indexes[index.Name] = indexType
	}
}

func (engine *Engine) newTable() *core.Table {
	table := core.NewEmptyTable()

	if !engine.disableGlobalCache {
		table.Cacher = engine.Cacher
	}
	return table
}

// TableName table name interface to define customerize table name
type TableName interface {
	TableName() string
}

var (
	tpTableName = reflect.TypeOf((*TableName)(nil)).Elem()
)

func (engine *Engine) mapType(v reflect.Value) (*core.Table, error) {
	t := v.Type()
	table := engine.newTable()
	if tb, ok := v.Interface().(TableName); ok {
		table.Name = tb.TableName()
	} else {
		if v.CanAddr() {
			if tb, ok = v.Addr().Interface().(TableName); ok {
				table.Name = tb.TableName()
			}
		}
		if table.Name == "" {
			table.Name = engine.TableMapper.Obj2Table(t.Name())
		}
	}

	table.Type = t

	var idFieldColName string
	var hasCacheTag, hasNoCacheTag bool

	for i := 0; i < t.NumField(); i++ {
		tag := t.Field(i).Tag

		ormTagStr := tag.Get(engine.TagIdentifier)
		var col *core.Column
		fieldValue := v.Field(i)
		fieldType := fieldValue.Type()

		if ormTagStr != "" {
			col = &core.Column{FieldName: t.Field(i).Name, Nullable: true, IsPrimaryKey: false,
				IsAutoIncrement: false, MapType: core.TWOSIDES, Indexes: make(map[string]int)}
			tags := splitTag(ormTagStr)

			if len(tags) > 0 {
				if tags[0] == "-" {
					continue
				}

				var ctx = tagContext{
					table:      table,
					col:        col,
					fieldValue: fieldValue,
					indexNames: make(map[string]int),
					engine:     engine,
				}

				if strings.ToUpper(tags[0]) == "EXTENDS" {
					if err := ExtendsTagHandler(&ctx); err != nil {
						return nil, err
					}
					continue
				}

				for j, key := range tags {
					if ctx.ignoreNext {
						ctx.ignoreNext = false
						continue
					}

					k := strings.ToUpper(key)
					ctx.tagName = k
					ctx.params = []string{}

					pStart := strings.Index(k, "(")
					if pStart == 0 {
						return nil, errors.New("( could not be the first charactor")
					}
					if pStart > -1 {
						if !strings.HasSuffix(k, ")") {
							return nil, fmt.Errorf("field %s tag %s cannot match ) charactor", col.FieldName, key)
						}

						ctx.tagName = k[:pStart]
						ctx.params = strings.Split(key[pStart+1:len(k)-1], ",")
					}

					if j > 0 {
						ctx.preTag = strings.ToUpper(tags[j-1])
					}
					if j < len(tags)-1 {
						ctx.nextTag = tags[j+1]
					} else {
						ctx.nextTag = ""
					}

					if h, ok := engine.tagHandlers[ctx.tagName]; ok {
						if err := h(&ctx); err != nil {
							return nil, err
						}
					} else {
						if strings.HasPrefix(key, "'") && strings.HasSuffix(key, "'") {
							col.Name = key[1 : len(key)-1]
						} else {
							col.Name = key
						}
					}

					if ctx.hasCacheTag {
						hasCacheTag = true
					}
					if ctx.hasNoCacheTag {
						hasNoCacheTag = true
					}
				}

				if col.SQLType.Name == "" {
					col.SQLType = core.Type2SQLType(fieldType)
				}
				engine.dialect.SqlType(col)
				if col.Length == 0 {
					col.Length = col.SQLType.DefaultLength
				}
				if col.Length2 == 0 {
					col.Length2 = col.SQLType.DefaultLength2
				}
				if col.Name == "" {
					col.Name = engine.ColumnMapper.Obj2Table(t.Field(i).Name)
				}

				if ctx.isUnique {
					ctx.indexNames[col.Name] = core.UniqueType
				} else if ctx.isIndex {
					ctx.indexNames[col.Name] = core.IndexType
				}

				for indexName, indexType := range ctx.indexNames {
					addIndex(indexName, table, col, indexType)
				}
			}
		} else {
			var sqlType core.SQLType
			if fieldValue.CanAddr() {
				if _, ok := fieldValue.Addr().Interface().(core.Conversion); ok {
					sqlType = core.SQLType{Name: core.Text}
				}
			}
			if _, ok := fieldValue.Interface().(core.Conversion); ok {
				sqlType = core.SQLType{Name: core.Text}
			} else {
				sqlType = core.Type2SQLType(fieldType)
			}
			col = core.NewColumn(engine.ColumnMapper.Obj2Table(t.Field(i).Name),
				t.Field(i).Name, sqlType, sqlType.DefaultLength,
				sqlType.DefaultLength2, true)

			if fieldType.Kind() == reflect.Int64 && (strings.ToUpper(col.FieldName) == "ID" || strings.HasSuffix(strings.ToUpper(col.FieldName), ".ID")) {
				idFieldColName = col.Name
			}
		}
		if col.IsAutoIncrement {
			col.Nullable = false
		}

		table.AddColumn(col)

	} // end for

	if idFieldColName != "" && len(table.PrimaryKeys) == 0 {
		col := table.GetColumn(idFieldColName)
		col.IsPrimaryKey = true
		col.IsAutoIncrement = true
		col.Nullable = false
		table.PrimaryKeys = append(table.PrimaryKeys, col.Name)
		table.AutoIncrement = col.Name
	}

	if hasCacheTag {
		if engine.Cacher != nil { // !nash! use engine's cacher if provided
			engine.logger.Info("enable cache on table:", table.Name)
			table.Cacher = engine.Cacher
		} else {
			engine.logger.Info("enable LRU cache on table:", table.Name)
			table.Cacher = NewLRUCacher2(NewMemoryStore(), time.Hour, 10000) // !nashtsai! HACK use LRU cacher for now
		}
	}
	if hasNoCacheTag {
		engine.logger.Info("no cache on table:", table.Name)
		table.Cacher = nil
	}

	return table, nil
}

// IsTableEmpty if a table has any reocrd
func (engine *Engine) IsTableEmpty(bean interface{}) (bool, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.IsTableEmpty(bean)
}

// IsTableExist if a table is exist
func (engine *Engine) IsTableExist(beanOrTableName interface{}) (bool, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.IsTableExist(beanOrTableName)
}

// IdOf get id from one struct
//
// Deprecated: use IDOf instead.
func (engine *Engine) IdOf(bean interface{}) core.PK {
	return engine.IDOf(bean)
}

// IDOf get id from one struct
func (engine *Engine) IDOf(bean interface{}) core.PK {
	return engine.IdOfV(reflect.ValueOf(bean))
}

// IdOfV get id from one value of struct
//
// Deprecated: use IDOfV instead.
func (engine *Engine) IdOfV(rv reflect.Value) core.PK {
	return engine.IDOfV(rv)
}

// IDOfV get id from one value of struct
func (engine *Engine) IDOfV(rv reflect.Value) core.PK {
	pk, err := engine.idOfV(rv)
	if err != nil {
		engine.logger.Error(err)
		return nil
	}
	return pk
}

func (engine *Engine) idOfV(rv reflect.Value) (core.PK, error) {
	v := reflect.Indirect(rv)
	table, err := engine.autoMapType(v)
	if err != nil {
		return nil, err
	}

	pk := make([]interface{}, len(table.PrimaryKeys))
	for i, col := range table.PKColumns() {
		var err error
		pkField := v.FieldByName(col.FieldName)
		switch pkField.Kind() {
		case reflect.String:
			pk[i], err = engine.idTypeAssertion(col, pkField.String())
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			pk[i], err = engine.idTypeAssertion(col, strconv.FormatInt(pkField.Int(), 10))
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			// id of uint will be converted to int64
			pk[i], err = engine.idTypeAssertion(col, strconv.FormatUint(pkField.Uint(), 10))
		}

		if err != nil {
			return nil, err
		}
	}
	return core.PK(pk), nil
}

func (engine *Engine) idTypeAssertion(col *core.Column, sid string) (interface{}, error) {
	if col.SQLType.IsNumeric() {
		n, err := strconv.ParseInt(sid, 10, 64)
		if err != nil {
			return nil, err
		}
		return n, nil
	} else if col.SQLType.IsText() {
		return sid, nil
	} else {
		return nil, errors.New("not supported")
	}
}

// CreateIndexes create indexes
func (engine *Engine) CreateIndexes(bean interface{}) error {
	session := engine.NewSession()
	defer session.Close()
	return session.CreateIndexes(bean)
}

// CreateUniques create uniques
func (engine *Engine) CreateUniques(bean interface{}) error {
	session := engine.NewSession()
	defer session.Close()
	return session.CreateUniques(bean)
}

func (engine *Engine) getCacher2(table *core.Table) core.Cacher {
	return table.Cacher
}

// ClearCacheBean if enabled cache, clear the cache bean
func (engine *Engine) ClearCacheBean(bean interface{}, id string) error {
	v := rValue(bean)
	t := v.Type()
	if t.Kind() != reflect.Struct {
		return errors.New("error params")
	}
	tableName := engine.tbName(v)
	table, err := engine.autoMapType(v)
	if err != nil {
		return err
	}
	cacher := table.Cacher
	if cacher == nil {
		cacher = engine.Cacher
	}
	if cacher != nil {
		cacher.ClearIds(tableName)
		cacher.DelBean(tableName, id)
	}
	return nil
}

// ClearCache if enabled cache, clear some tables' cache
func (engine *Engine) ClearCache(beans ...interface{}) error {
	for _, bean := range beans {
		v := rValue(bean)
		t := v.Type()
		if t.Kind() != reflect.Struct {
			return errors.New("error params")
		}
		tableName := engine.tbName(v)
		table, err := engine.autoMapType(v)
		if err != nil {
			return err
		}

		cacher := table.Cacher
		if cacher == nil {
			cacher = engine.Cacher
		}
		if cacher != nil {
			cacher.ClearIds(tableName)
			cacher.ClearBeans(tableName)
		}
	}
	return nil
}

// Sync the new struct changes to database, this method will automatically add
// table, column, index, unique. but will not delete or change anything.
// If you change some field, you should change the database manually.
func (engine *Engine) Sync(beans ...interface{}) error {
	session := engine.NewSession()
	defer session.Close()

	for _, bean := range beans {
		v := rValue(bean)
		tableName := engine.tbName(v)
		table, err := engine.autoMapType(v)
		if err != nil {
			return err
		}

		isExist, err := session.Table(bean).isTableExist(tableName)
		if err != nil {
			return err
		}
		if !isExist {
			err = session.createTable(bean)
			if err != nil {
				return err
			}
		}
		/*isEmpty, err := engine.IsEmptyTable(bean)
		  if err != nil {
		      return err
		  }*/
		var isEmpty bool
		if isEmpty {
			err = session.dropTable(bean)
			if err != nil {
				return err
			}
			err = session.createTable(bean)
			if err != nil {
				return err
			}
		} else {
			for _, col := range table.Columns() {
				isExist, err := engine.dialect.IsColumnExist(tableName, col.Name)
				if err != nil {
					return err
				}
				if !isExist {
					if err := session.statement.setRefValue(v); err != nil {
						return err
					}
					err = session.addColumn(col.Name)
					if err != nil {
						return err
					}
				}
			}

			for name, index := range table.Indexes {
				if err := session.statement.setRefValue(v); err != nil {
					return err
				}
				if index.Type == core.UniqueType {
					isExist, err := session.isIndexExist2(tableName, index.Cols, true)
					if err != nil {
						return err
					}
					if !isExist {
						if err := session.statement.setRefValue(v); err != nil {
							return err
						}

						err = session.addUnique(tableName, name)
						if err != nil {
							return err
						}
					}
				} else if index.Type == core.IndexType {
					isExist, err := session.isIndexExist2(tableName, index.Cols, false)
					if err != nil {
						return err
					}
					if !isExist {
						if err := session.statement.setRefValue(v); err != nil {
							return err
						}

						err = session.addIndex(tableName, name)
						if err != nil {
							return err
						}
					}
				} else {
					return errors.New("unknow index type")
				}
			}
		}
	}
	return nil
}

// Sync2 synchronize structs to database tables
func (engine *Engine) Sync2(beans ...interface{}) error {
	s := engine.NewSession()
	defer s.Close()
	return s.Sync2(beans...)
}

// CreateTables create tabls according bean
func (engine *Engine) CreateTables(beans ...interface{}) error {
	session := engine.NewSession()
	defer session.Close()

	err := session.Begin()
	if err != nil {
		return err
	}

	for _, bean := range beans {
		err = session.createTable(bean)
		if err != nil {
			session.Rollback()
			return err
		}
	}
	return session.Commit()
}

// DropTables drop specify tables
func (engine *Engine) DropTables(beans ...interface{}) error {
	session := engine.NewSession()
	defer session.Close()

	err := session.Begin()
	if err != nil {
		return err
	}

	for _, bean := range beans {
		err = session.dropTable(bean)
		if err != nil {
			session.Rollback()
			return err
		}
	}
	return session.Commit()
}

// DropIndexes drop indexes of a table
func (engine *Engine) DropIndexes(bean interface{}) error {
	session := engine.NewSession()
	defer session.Close()
	return session.DropIndexes(bean)
}

// Exec raw sql
func (engine *Engine) Exec(sql string, args ...interface{}) (sql.Result, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Exec(sql, args...)
}

// Query a raw sql and return records as []map[string][]byte
func (engine *Engine) Query(sqlorArgs ...interface{}) (resultsSlice []map[string][]byte, err error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Query(sqlorArgs...)
}

// QueryString runs a raw sql and return records as []map[string]string
func (engine *Engine) QueryString(sqlorArgs ...interface{}) ([]map[string]string, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.QueryString(sqlorArgs...)
}

// QueryInterface runs a raw sql and return records as []map[string]interface{}
func (engine *Engine) QueryInterface(sqlorArgs ...interface{}) ([]map[string]interface{}, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.QueryInterface(sqlorArgs...)
}

// Insert one or more records
func (engine *Engine) Insert(beans ...interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Insert(beans...)
}

// InsertOne insert only one record
func (engine *Engine) InsertOne(bean interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.InsertOne(bean)
}

// Update records, bean's non-empty fields are updated contents,
// condiBean' non-empty filds are conditions
// CAUTION:
//        1.bool will defaultly be updated content nor conditions
//         You should call UseBool if you have bool to use.
//        2.float32 & float64 may be not inexact as conditions
func (engine *Engine) Update(bean interface{}, condiBeans ...interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Update(bean, condiBeans...)
}

// Delete records, bean's non-empty fields are conditions
func (engine *Engine) Delete(bean interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Delete(bean)
}

// Get retrieve one record from table, bean's non-empty fields
// are conditions
func (engine *Engine) Get(bean interface{}) (bool, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Get(bean)
}

// Exist returns true if the record exist otherwise return false
func (engine *Engine) Exist(bean ...interface{}) (bool, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Exist(bean...)
}

// Find retrieve records from table, condiBeans's non-empty fields
// are conditions. beans could be []Struct, []*Struct, map[int64]Struct
// map[int64]*Struct
func (engine *Engine) Find(beans interface{}, condiBeans ...interface{}) error {
	session := engine.NewSession()
	defer session.Close()
	return session.Find(beans, condiBeans...)
}

// Iterate record by record handle records from table, bean's non-empty fields
// are conditions.
func (engine *Engine) Iterate(bean interface{}, fun IterFunc) error {
	session := engine.NewSession()
	defer session.Close()
	return session.Iterate(bean, fun)
}

// Rows return sql.Rows compatible Rows obj, as a forward Iterator object for iterating record by record, bean's non-empty fields
// are conditions.
func (engine *Engine) Rows(bean interface{}) (*Rows, error) {
	session := engine.NewSession()
	return session.Rows(bean)
}

// Count counts the records. bean's non-empty fields are conditions.
func (engine *Engine) Count(bean ...interface{}) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Count(bean...)
}

// Sum sum the records by some column. bean's non-empty fields are conditions.
func (engine *Engine) Sum(bean interface{}, colName string) (float64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Sum(bean, colName)
}

// SumInt sum the records by some column. bean's non-empty fields are conditions.
func (engine *Engine) SumInt(bean interface{}, colName string) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.SumInt(bean, colName)
}

// Sums sum the records by some columns. bean's non-empty fields are conditions.
func (engine *Engine) Sums(bean interface{}, colNames ...string) ([]float64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.Sums(bean, colNames...)
}

// SumsInt like Sums but return slice of int64 instead of float64.
func (engine *Engine) SumsInt(bean interface{}, colNames ...string) ([]int64, error) {
	session := engine.NewSession()
	defer session.Close()
	return session.SumsInt(bean, colNames...)
}

// ImportFile SQL DDL file
func (engine *Engine) ImportFile(ddlPath string) ([]sql.Result, error) {
	file, err := os.Open(ddlPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return engine.Import(file)
}

// Import SQL DDL from io.Reader
func (engine *Engine) Import(r io.Reader) ([]sql.Result, error) {
	var results []sql.Result
	var lastError error
	scanner := bufio.NewScanner(r)

	semiColSpliter := func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		if i := bytes.IndexByte(data, ';'); i >= 0 {
			return i + 1, data[0:i], nil
		}
		// If we're at EOF, we have a final, non-terminated line. Return it.
		if atEOF {
			return len(data), data, nil
		}
		// Request more data.
		return 0, nil, nil
	}

	scanner.Split(semiColSpliter)

	for scanner.Scan() {
		query := strings.Trim(scanner.Text(), " \t\n\r")
		if len(query) > 0 {
			engine.logSQL(query)
			result, err := engine.DB().Exec(query)
			results = append(results, result)
			if err != nil {
				return nil, err
			}
		}
	}

	return results, lastError
}

// nowTime return current time
func (engine *Engine) nowTime(col *core.Column) (interface{}, time.Time) {
	t := time.Now()
	var tz = engine.DatabaseTZ
	if !col.DisableTimeZone && col.TimeZone != nil {
		tz = col.TimeZone
	}
	return engine.formatTime(col.SQLType.Name, t.In(tz)), t.In(engine.TZLocation)
}

func (engine *Engine) formatColTime(col *core.Column, t time.Time) (v interface{}) {
	if t.IsZero() {
		if col.Nullable {
			return nil
		}
		return ""
	}

	if col.TimeZone != nil {
		return engine.formatTime(col.SQLType.Name, t.In(col.TimeZone))
	}
	return engine.formatTime(col.SQLType.Name, t.In(engine.DatabaseTZ))
}

// formatTime format time as column type
func (engine *Engine) formatTime(sqlTypeName string, t time.Time) (v interface{}) {
	switch sqlTypeName {
	case core.Time:
		s := t.Format("2006-01-02 15:04:05") //time.RFC3339
		v = s[11:19]
	case core.Date:
		v = t.Format("2006-01-02")
	case core.DateTime, core.TimeStamp:
		v = t.Format("2006-01-02 15:04:05")
	case core.TimeStampz:
		if engine.dialect.DBType() == core.MSSQL {
			v = t.Format("2006-01-02T15:04:05.9999999Z07:00")
		} else {
			v = t.Format(time.RFC3339Nano)
		}
	case core.BigInt, core.Int:
		v = t.Unix()
	default:
		v = t
	}
	return
}

// GetColumnMapper returns the column name mapper
func (engine *Engine) GetColumnMapper() core.IMapper {
	return engine.ColumnMapper
}

// GetTableMapper returns the table name mapper
func (engine *Engine) GetTableMapper() core.IMapper {
	return engine.TableMapper
}

// GetTZLocation returns time zone of the application
func (engine *Engine) GetTZLocation() *time.Location {
	return engine.TZLocation
}

// SetTZLocation sets time zone of the application
func (engine *Engine) SetTZLocation(tz *time.Location) {
	engine.TZLocation = tz
}

// GetTZDatabase returns time zone of the database
func (engine *Engine) GetTZDatabase() *time.Location {
	return engine.DatabaseTZ
}

// SetTZDatabase sets time zone of the database
func (engine *Engine) SetTZDatabase(tz *time.Location) {
	engine.DatabaseTZ = tz
}

// Unscoped always disable struct tag "deleted"
func (engine *Engine) Unscoped() *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Unscoped()
}
