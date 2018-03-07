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

func (session *Session) cacheUpdate(sqlStr string, args ...interface{}) error {
	if session.Statement.RefTable == nil ||
		session.Tx != nil {
		return ErrCacheFailed
	}

	oldhead, newsql := session.Statement.convertUpdateSQL(sqlStr)
	if newsql == "" {
		return ErrCacheFailed
	}
	for _, filter := range session.Engine.dialect.Filters() {
		newsql = filter.Do(newsql, session.Engine.dialect, session.Statement.RefTable)
	}
	session.Engine.logger.Debug("[cacheUpdate] new sql", oldhead, newsql)

	var nStart int
	if len(args) > 0 {
		if strings.Index(sqlStr, "?") > -1 {
			nStart = strings.Count(oldhead, "?")
		} else {
			// only for pq, TODO: if any other databse?
			nStart = strings.Count(oldhead, "$")
		}
	}
	table := session.Statement.RefTable
	cacher := session.Engine.getCacher2(table)
	tableName := session.Statement.TableName()
	session.Engine.logger.Debug("[cacheUpdate] get cache sql", newsql, args[nStart:])
	ids, err := core.GetCacheSql(cacher, tableName, newsql, args[nStart:])
	if err != nil {
		rows, err := session.DB().Query(newsql, args[nStart:]...)
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
		session.Engine.logger.Debug("[cacheUpdate] find updated id", ids)
	} /*else {
	    session.Engine.LogDebug("[xorm:cacheUpdate] del cached sql:", tableName, newsql, args)
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
				} else if strings.Contains(colName, session.Engine.QuoteStr()) {
					colName = strings.TrimSpace(strings.Replace(colName, session.Engine.QuoteStr(), "", -1))
				} else {
					session.Engine.logger.Debug("[cacheUpdate] cannot find column", tableName, colName)
					return ErrCacheFailed
				}

				if col := table.GetColumn(colName); col != nil {
					fieldValue, err := col.ValueOf(bean)
					if err != nil {
						session.Engine.logger.Error(err)
					} else {
						session.Engine.logger.Debug("[cacheUpdate] set bean field", bean, colName, fieldValue.Interface())
						if col.IsVersion && session.Statement.checkVersion {
							fieldValue.SetInt(fieldValue.Int() + 1)
						} else {
							fieldValue.Set(reflect.ValueOf(args[idx]))
						}
					}
				} else {
					session.Engine.logger.Errorf("[cacheUpdate] ERROR: column %v is not table %v's",
						colName, table.Name)
				}
			}

			session.Engine.logger.Debug("[cacheUpdate] update cache", tableName, id, bean)
			cacher.PutBean(tableName, sid, bean)
		}
	}
	session.Engine.logger.Debug("[cacheUpdate] clear cached table sql:", tableName)
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
	defer session.resetStatement()
	if session.IsAutoClose {
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
		session.Statement.setRefValue(v)

		if len(session.Statement.TableName()) <= 0 {
			return 0, ErrTableNotFound
		}

		if session.Statement.ColumnStr == "" {
			colNames, args = buildUpdates(session.Engine, session.Statement.RefTable, bean, false, false,
				false, false, session.Statement.allUseBool, session.Statement.useAllCols,
				session.Statement.mustColumnMap, session.Statement.nullableMap,
				session.Statement.columnMap, true, session.Statement.unscoped)
		} else {
			colNames, args, err = genCols(session.Statement.RefTable, session, bean, true, true)
			if err != nil {
				return 0, err
			}
		}
	} else if isMap {
		colNames = make([]string, 0)
		args = make([]interface{}, 0)
		bValue := reflect.Indirect(reflect.ValueOf(bean))

		for _, v := range bValue.MapKeys() {
			colNames = append(colNames, session.Engine.Quote(v.String())+" = ?")
			args = append(args, bValue.MapIndex(v).Interface())
		}
	} else {
		return 0, ErrParamsType
	}

	table := session.Statement.RefTable

	if session.Statement.UseAutoTime && table != nil && table.Updated != "" {
		colNames = append(colNames, session.Engine.Quote(table.Updated)+" = ?")
		col := table.UpdatedColumn()
		val, t := session.Engine.NowTime2(col.SQLType.Name)
		args = append(args, val)

		var colName = col.Name
		if isStruct {
			session.afterClosures = append(session.afterClosures, func(bean interface{}) {
				col := table.GetColumn(colName)
				setColumnTime(bean, col, t)
			})
		}
	}

	//for update action to like "column = column + ?"
	incColumns := session.Statement.getInc()
	for _, v := range incColumns {
		colNames = append(colNames, session.Engine.Quote(v.colName)+" = "+session.Engine.Quote(v.colName)+" + ?")
		args = append(args, v.arg)
	}
	//for update action to like "column = column - ?"
	decColumns := session.Statement.getDec()
	for _, v := range decColumns {
		colNames = append(colNames, session.Engine.Quote(v.colName)+" = "+session.Engine.Quote(v.colName)+" - ?")
		args = append(args, v.arg)
	}
	//for update action to like "column = expression"
	exprColumns := session.Statement.getExpr()
	for _, v := range exprColumns {
		colNames = append(colNames, session.Engine.Quote(v.colName)+" = "+v.expr)
	}

	session.Statement.processIDParam()

	var autoCond builder.Cond
	if !session.Statement.noAutoCondition && len(condiBean) > 0 {
		var err error
		autoCond, err = session.Statement.buildConds(session.Statement.RefTable, condiBean[0], true, true, false, true, false)
		if err != nil {
			return 0, err
		}
	}

	st := session.Statement
	defer session.resetStatement()

	var sqlStr string
	var condArgs []interface{}
	var condSQL string
	cond := session.Statement.cond.And(autoCond)

	var doIncVer = (table != nil && table.Version != "" && session.Statement.checkVersion)
	var verValue *reflect.Value
	if doIncVer {
		verValue, err = table.VersionColumn().ValueOf(bean)
		if err != nil {
			return 0, err
		}

		cond = cond.And(builder.Eq{session.Engine.Quote(table.Version): verValue.Interface()})
		colNames = append(colNames, session.Engine.Quote(table.Version)+" = "+session.Engine.Quote(table.Version)+" + 1")
	}

	condSQL, condArgs, _ = builder.ToSQL(cond)
	if len(condSQL) > 0 {
		condSQL = "WHERE " + condSQL
	}

	if st.OrderStr != "" {
		condSQL = condSQL + fmt.Sprintf(" ORDER BY %v", st.OrderStr)
	}

	// TODO: Oracle support needed
	var top string
	if st.LimitN > 0 {
		if st.Engine.dialect.DBType() == core.MYSQL {
			condSQL = condSQL + fmt.Sprintf(" LIMIT %d", st.LimitN)
		} else if st.Engine.dialect.DBType() == core.SQLITE {
			tempCondSQL := condSQL + fmt.Sprintf(" LIMIT %d", st.LimitN)
			cond = cond.And(builder.Expr(fmt.Sprintf("rowid IN (SELECT rowid FROM %v %v)",
				session.Engine.Quote(session.Statement.TableName()), tempCondSQL), condArgs...))
			condSQL, condArgs, _ = builder.ToSQL(cond)
			if len(condSQL) > 0 {
				condSQL = "WHERE " + condSQL
			}
		} else if st.Engine.dialect.DBType() == core.POSTGRES {
			tempCondSQL := condSQL + fmt.Sprintf(" LIMIT %d", st.LimitN)
			cond = cond.And(builder.Expr(fmt.Sprintf("CTID IN (SELECT CTID FROM %v %v)",
				session.Engine.Quote(session.Statement.TableName()), tempCondSQL), condArgs...))
			condSQL, condArgs, _ = builder.ToSQL(cond)
			if len(condSQL) > 0 {
				condSQL = "WHERE " + condSQL
			}
		} else if st.Engine.dialect.DBType() == core.MSSQL {
			top = fmt.Sprintf("top (%d) ", st.LimitN)
		}
	}

	sqlStr = fmt.Sprintf("UPDATE %v%v SET %v %v",
		top,
		session.Engine.Quote(session.Statement.TableName()),
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

	if table != nil {
		if cacher := session.Engine.getCacher2(table); cacher != nil && session.Statement.UseCache {
			cacher.ClearIds(session.Statement.TableName())
			cacher.ClearBeans(session.Statement.TableName())
		}
	}

	// handle after update processors
	if session.IsAutoCommit {
		for _, closure := range session.afterClosures {
			closure(bean)
		}
		if processor, ok := interface{}(bean).(AfterUpdateProcessor); ok {
			session.Engine.logger.Debug("[event]", session.Statement.TableName(), " has after update processor")
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
