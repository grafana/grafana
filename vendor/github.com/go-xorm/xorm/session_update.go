// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"github.com/go-xorm/builder"
	"github.com/go-xorm/core"
)

func (session *Session) cacheUpdate(table *core.Table, tableName, sqlStr string, args ...interface{}) error {
	if table == nil ||
		session.tx != nil {
		return ErrCacheFailed
	}

	oldhead, newsql := session.statement.convertUpdateSQL(sqlStr)
	if newsql == "" {
		return ErrCacheFailed
	}
	for _, filter := range session.engine.dialect.Filters() {
		newsql = filter.Do(newsql, session.engine.dialect, table)
	}
	session.engine.logger.Debug("[cacheUpdate] new sql", oldhead, newsql)

	var nStart int
	if len(args) > 0 {
		if strings.Index(sqlStr, "?") > -1 {
			nStart = strings.Count(oldhead, "?")
		} else {
			// only for pq, TODO: if any other databse?
			nStart = strings.Count(oldhead, "$")
		}
	}

	cacher := session.engine.getCacher(tableName)
	session.engine.logger.Debug("[cacheUpdate] get cache sql", newsql, args[nStart:])
	ids, err := core.GetCacheSql(cacher, tableName, newsql, args[nStart:])
	if err != nil {
		rows, err := session.NoCache().queryRows(newsql, args[nStart:]...)
		if err != nil {
			return err
		}
		defer rows.Close()

		ids = make([]core.PK, 0)
		for rows.Next() {
			var res = make([]string, len(table.PrimaryKeys))
			err = rows.ScanSlice(&res)
			if err != nil {
				return err
			}
			var pk core.PK = make([]interface{}, len(table.PrimaryKeys))
			for i, col := range table.PKColumns() {
				if col.SQLType.IsNumeric() {
					n, err := strconv.ParseInt(res[i], 10, 64)
					if err != nil {
						return err
					}
					pk[i] = n
				} else if col.SQLType.IsText() {
					pk[i] = res[i]
				} else {
					return errors.New("not supported")
				}
			}

			ids = append(ids, pk)
		}
		session.engine.logger.Debug("[cacheUpdate] find updated id", ids)
	} /*else {
	    session.engine.LogDebug("[xorm:cacheUpdate] del cached sql:", tableName, newsql, args)
	    cacher.DelIds(tableName, genSqlKey(newsql, args))
	}*/

	for _, id := range ids {
		sid, err := id.ToString()
		if err != nil {
			return err
		}
		if bean := cacher.GetBean(tableName, sid); bean != nil {
			sqls := splitNNoCase(sqlStr, "where", 2)
			if len(sqls) == 0 || len(sqls) > 2 {
				return ErrCacheFailed
			}

			sqls = splitNNoCase(sqls[0], "set", 2)
			if len(sqls) != 2 {
				return ErrCacheFailed
			}
			kvs := strings.Split(strings.TrimSpace(sqls[1]), ",")
			for idx, kv := range kvs {
				sps := strings.SplitN(kv, "=", 2)
				sps2 := strings.Split(sps[0], ".")
				colName := sps2[len(sps2)-1]
				if strings.Contains(colName, "`") {
					colName = strings.TrimSpace(strings.Replace(colName, "`", "", -1))
				} else if strings.Contains(colName, session.engine.QuoteStr()) {
					colName = strings.TrimSpace(strings.Replace(colName, session.engine.QuoteStr(), "", -1))
				} else {
					session.engine.logger.Debug("[cacheUpdate] cannot find column", tableName, colName)
					return ErrCacheFailed
				}

				if col := table.GetColumn(colName); col != nil {
					fieldValue, err := col.ValueOf(bean)
					if err != nil {
						session.engine.logger.Error(err)
					} else {
						session.engine.logger.Debug("[cacheUpdate] set bean field", bean, colName, fieldValue.Interface())
						if col.IsVersion && session.statement.checkVersion {
							fieldValue.SetInt(fieldValue.Int() + 1)
						} else {
							fieldValue.Set(reflect.ValueOf(args[idx]))
						}
					}
				} else {
					session.engine.logger.Errorf("[cacheUpdate] ERROR: column %v is not table %v's",
						colName, table.Name)
				}
			}

			session.engine.logger.Debug("[cacheUpdate] update cache", tableName, id, bean)
			cacher.PutBean(tableName, sid, bean)
		}
	}
	session.engine.logger.Debug("[cacheUpdate] clear cached table sql:", tableName)
	cacher.ClearIds(tableName)
	return nil
}

// Update records, bean's non-empty fields are updated contents,
// condiBean' non-empty filds are conditions
// CAUTION:
//        1.bool will defaultly be updated content nor conditions
//         You should call UseBool if you have bool to use.
//        2.float32 & float64 may be not inexact as conditions
func (session *Session) Update(bean interface{}, condiBean ...interface{}) (int64, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	v := rValue(bean)
	t := v.Type()

	var colNames []string
	var args []interface{}

	// handle before update processors
	for _, closure := range session.beforeClosures {
		closure(bean)
	}
	cleanupProcessorsClosures(&session.beforeClosures) // cleanup after used
	if processor, ok := interface{}(bean).(BeforeUpdateProcessor); ok {
		processor.BeforeUpdate()
	}
	// --

	var err error
	var isMap = t.Kind() == reflect.Map
	var isStruct = t.Kind() == reflect.Struct
	if isStruct {
		if err := session.statement.setRefBean(bean); err != nil {
			return 0, err
		}

		if len(session.statement.TableName()) <= 0 {
			return 0, ErrTableNotFound
		}

		if session.statement.ColumnStr == "" {
			colNames, args = session.statement.buildUpdates(bean, false, false,
				false, false, true)
		} else {
			colNames, args, err = session.genUpdateColumns(bean)
			if err != nil {
				return 0, err
			}
		}
	} else if isMap {
		colNames = make([]string, 0)
		args = make([]interface{}, 0)
		bValue := reflect.Indirect(reflect.ValueOf(bean))

		for _, v := range bValue.MapKeys() {
			colNames = append(colNames, session.engine.Quote(v.String())+" = ?")
			args = append(args, bValue.MapIndex(v).Interface())
		}
	} else {
		return 0, ErrParamsType
	}

	table := session.statement.RefTable

	if session.statement.UseAutoTime && table != nil && table.Updated != "" {
		if !session.statement.columnMap.contain(table.Updated) &&
			!session.statement.omitColumnMap.contain(table.Updated) {
			colNames = append(colNames, session.engine.Quote(table.Updated)+" = ?")
			col := table.UpdatedColumn()
			val, t := session.engine.nowTime(col)
			args = append(args, val)

			var colName = col.Name
			if isStruct {
				session.afterClosures = append(session.afterClosures, func(bean interface{}) {
					col := table.GetColumn(colName)
					setColumnTime(bean, col, t)
				})
			}
		}
	}

	//for update action to like "column = column + ?"
	incColumns := session.statement.getInc()
	for _, v := range incColumns {
		colNames = append(colNames, session.engine.Quote(v.colName)+" = "+session.engine.Quote(v.colName)+" + ?")
		args = append(args, v.arg)
	}
	//for update action to like "column = column - ?"
	decColumns := session.statement.getDec()
	for _, v := range decColumns {
		colNames = append(colNames, session.engine.Quote(v.colName)+" = "+session.engine.Quote(v.colName)+" - ?")
		args = append(args, v.arg)
	}
	//for update action to like "column = expression"
	exprColumns := session.statement.getExpr()
	for _, v := range exprColumns {
		colNames = append(colNames, session.engine.Quote(v.colName)+" = "+v.expr)
	}

	if err = session.statement.processIDParam(); err != nil {
		return 0, err
	}

	var autoCond builder.Cond
	if !session.statement.noAutoCondition && len(condiBean) > 0 {
		if c, ok := condiBean[0].(map[string]interface{}); ok {
			autoCond = builder.Eq(c)
		} else {
			ct := reflect.TypeOf(condiBean[0])
			k := ct.Kind()
			if k == reflect.Ptr {
				k = ct.Elem().Kind()
			}
			if k == reflect.Struct {
				var err error
				autoCond, err = session.statement.buildConds(session.statement.RefTable, condiBean[0], true, true, false, true, false)
				if err != nil {
					return 0, err
				}
			} else {
				return 0, ErrConditionType
			}
		}
	}

	st := &session.statement

	var sqlStr string
	var condArgs []interface{}
	var condSQL string
	cond := session.statement.cond.And(autoCond)

	var doIncVer = (table != nil && table.Version != "" && session.statement.checkVersion)
	var verValue *reflect.Value
	if doIncVer {
		verValue, err = table.VersionColumn().ValueOf(bean)
		if err != nil {
			return 0, err
		}

		cond = cond.And(builder.Eq{session.engine.Quote(table.Version): verValue.Interface()})
		colNames = append(colNames, session.engine.Quote(table.Version)+" = "+session.engine.Quote(table.Version)+" + 1")
	}

	condSQL, condArgs, err = builder.ToSQL(cond)
	if err != nil {
		return 0, err
	}

	if len(condSQL) > 0 {
		condSQL = "WHERE " + condSQL
	}

	if st.OrderStr != "" {
		condSQL = condSQL + fmt.Sprintf(" ORDER BY %v", st.OrderStr)
	}

	var tableName = session.statement.TableName()
	// TODO: Oracle support needed
	var top string
	if st.LimitN > 0 {
		if st.Engine.dialect.DBType() == core.MYSQL {
			condSQL = condSQL + fmt.Sprintf(" LIMIT %d", st.LimitN)
		} else if st.Engine.dialect.DBType() == core.SQLITE {
			tempCondSQL := condSQL + fmt.Sprintf(" LIMIT %d", st.LimitN)
			cond = cond.And(builder.Expr(fmt.Sprintf("rowid IN (SELECT rowid FROM %v %v)",
				session.engine.Quote(tableName), tempCondSQL), condArgs...))
			condSQL, condArgs, err = builder.ToSQL(cond)
			if err != nil {
				return 0, err
			}
			if len(condSQL) > 0 {
				condSQL = "WHERE " + condSQL
			}
		} else if st.Engine.dialect.DBType() == core.POSTGRES {
			tempCondSQL := condSQL + fmt.Sprintf(" LIMIT %d", st.LimitN)
			cond = cond.And(builder.Expr(fmt.Sprintf("CTID IN (SELECT CTID FROM %v %v)",
				session.engine.Quote(tableName), tempCondSQL), condArgs...))
			condSQL, condArgs, err = builder.ToSQL(cond)
			if err != nil {
				return 0, err
			}

			if len(condSQL) > 0 {
				condSQL = "WHERE " + condSQL
			}
		} else if st.Engine.dialect.DBType() == core.MSSQL {
			if st.OrderStr != "" && st.Engine.dialect.DBType() == core.MSSQL &&
				table != nil && len(table.PrimaryKeys) == 1 {
				cond = builder.Expr(fmt.Sprintf("%s IN (SELECT TOP (%d) %s FROM %v%v)",
					table.PrimaryKeys[0], st.LimitN, table.PrimaryKeys[0],
					session.engine.Quote(tableName), condSQL), condArgs...)

				condSQL, condArgs, err = builder.ToSQL(cond)
				if err != nil {
					return 0, err
				}
				if len(condSQL) > 0 {
					condSQL = "WHERE " + condSQL
				}
			} else {
				top = fmt.Sprintf("TOP (%d) ", st.LimitN)
			}
		}
	}

	if len(colNames) <= 0 {
		return 0, errors.New("No content found to be updated")
	}

	sqlStr = fmt.Sprintf("UPDATE %v%v SET %v %v",
		top,
		session.engine.Quote(tableName),
		strings.Join(colNames, ", "),
		condSQL)

	res, err := session.exec(sqlStr, append(args, condArgs...)...)
	if err != nil {
		return 0, err
	} else if doIncVer {
		if verValue != nil && verValue.IsValid() && verValue.CanSet() {
			verValue.SetInt(verValue.Int() + 1)
		}
	}

	if cacher := session.engine.getCacher(tableName); cacher != nil && session.statement.UseCache {
		//session.cacheUpdate(table, tableName, sqlStr, args...)
		session.engine.logger.Debug("[cacheUpdate] clear table ", tableName)
		cacher.ClearIds(tableName)
		cacher.ClearBeans(tableName)
	}

	// handle after update processors
	if session.isAutoCommit {
		for _, closure := range session.afterClosures {
			closure(bean)
		}
		if processor, ok := interface{}(bean).(AfterUpdateProcessor); ok {
			session.engine.logger.Debug("[event]", tableName, " has after update processor")
			processor.AfterUpdate()
		}
	} else {
		lenAfterClosures := len(session.afterClosures)
		if lenAfterClosures > 0 {
			if value, has := session.afterUpdateBeans[bean]; has && value != nil {
				*value = append(*value, session.afterClosures...)
			} else {
				afterClosures := make([]func(interface{}), lenAfterClosures)
				copy(afterClosures, session.afterClosures)
				// FIXME: if bean is a map type, it will panic because map cannot be as map key
				session.afterUpdateBeans[bean] = &afterClosures
			}

		} else {
			if _, ok := interface{}(bean).(AfterUpdateProcessor); ok {
				session.afterUpdateBeans[bean] = nil
			}
		}
	}
	cleanupProcessorsClosures(&session.afterClosures) // cleanup after used
	// --

	return res.RowsAffected()
}

func (session *Session) genUpdateColumns(bean interface{}) ([]string, []interface{}, error) {
	table := session.statement.RefTable
	colNames := make([]string, 0, len(table.ColumnsSeq()))
	args := make([]interface{}, 0, len(table.ColumnsSeq()))

	for _, col := range table.Columns() {
		if !col.IsVersion && !col.IsCreated && !col.IsUpdated {
			if session.statement.omitColumnMap.contain(col.Name) {
				continue
			}
		}
		if col.MapType == core.ONLYFROMDB {
			continue
		}

		fieldValuePtr, err := col.ValueOf(bean)
		if err != nil {
			return nil, nil, err
		}
		fieldValue := *fieldValuePtr

		if col.IsAutoIncrement {
			switch fieldValue.Type().Kind() {
			case reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int, reflect.Int64:
				if fieldValue.Int() == 0 {
					continue
				}
			case reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint, reflect.Uint64:
				if fieldValue.Uint() == 0 {
					continue
				}
			case reflect.String:
				if len(fieldValue.String()) == 0 {
					continue
				}
			case reflect.Ptr:
				if fieldValue.Pointer() == 0 {
					continue
				}
			}
		}

		if col.IsDeleted || col.IsCreated {
			continue
		}

		if len(session.statement.columnMap) > 0 {
			if !session.statement.columnMap.contain(col.Name) {
				continue
			} else if _, ok := session.statement.incrColumns[col.Name]; ok {
				continue
			} else if _, ok := session.statement.decrColumns[col.Name]; ok {
				continue
			}
		}

		// !evalphobia! set fieldValue as nil when column is nullable and zero-value
		if _, ok := getFlagForColumn(session.statement.nullableMap, col); ok {
			if col.Nullable && isZero(fieldValue.Interface()) {
				var nilValue *int
				fieldValue = reflect.ValueOf(nilValue)
			}
		}

		if col.IsUpdated && session.statement.UseAutoTime /*&& isZero(fieldValue.Interface())*/ {
			// if time is non-empty, then set to auto time
			val, t := session.engine.nowTime(col)
			args = append(args, val)

			var colName = col.Name
			session.afterClosures = append(session.afterClosures, func(bean interface{}) {
				col := table.GetColumn(colName)
				setColumnTime(bean, col, t)
			})
		} else if col.IsVersion && session.statement.checkVersion {
			args = append(args, 1)
		} else {
			arg, err := session.value2Interface(col, fieldValue)
			if err != nil {
				return colNames, args, err
			}
			args = append(args, arg)
		}

		colNames = append(colNames, session.engine.Quote(col.Name)+" = ?")
	}
	return colNames, args, nil
}
