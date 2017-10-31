// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/go-xorm/core"
)

func (session *Session) cacheDelete(sqlStr string, args ...interface{}) error {
	if session.Statement.RefTable == nil ||
		session.Tx != nil {
		return ErrCacheFailed
	}

	for _, filter := range session.Engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, session.Statement.RefTable)
	}

	newsql := session.Statement.convertIDSQL(sqlStr)
	if newsql == "" {
		return ErrCacheFailed
	}

	cacher := session.Engine.getCacher2(session.Statement.RefTable)
	tableName := session.Statement.TableName()
	ids, err := core.GetCacheSql(cacher, tableName, newsql, args)
	if err != nil {
		resultsSlice, err := session.query(newsql, args...)
		if err != nil {
			return err
		}
		ids = make([]core.PK, 0)
		if len(resultsSlice) > 0 {
			for _, data := range resultsSlice {
				var id int64
				var pk core.PK = make([]interface{}, 0)
				for _, col := range session.Statement.RefTable.PKColumns() {
					if v, ok := data[col.Name]; !ok {
						return errors.New("no id")
					} else if col.SQLType.IsText() {
						pk = append(pk, string(v))
					} else if col.SQLType.IsNumeric() {
						id, err = strconv.ParseInt(string(v), 10, 64)
						if err != nil {
							return err
						}
						pk = append(pk, id)
					} else {
						return errors.New("not supported primary key type")
					}
				}
				ids = append(ids, pk)
			}
		}
	} /*else {
	    session.Engine.LogDebug("delete cache sql %v", newsql)
	    cacher.DelIds(tableName, genSqlKey(newsql, args))
	}*/

	for _, id := range ids {
		session.Engine.logger.Debug("[cacheDelete] delete cache obj", tableName, id)
		sid, err := id.ToString()
		if err != nil {
			return err
		}
		cacher.DelBean(tableName, sid)
	}
	session.Engine.logger.Debug("[cacheDelete] clear cache sql", tableName)
	cacher.ClearIds(tableName)
	return nil
}

// Delete records, bean's non-empty fields are conditions
func (session *Session) Delete(bean interface{}) (int64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	session.Statement.setRefValue(rValue(bean))
	var table = session.Statement.RefTable

	// handle before delete processors
	for _, closure := range session.beforeClosures {
		closure(bean)
	}
	cleanupProcessorsClosures(&session.beforeClosures)

	if processor, ok := interface{}(bean).(BeforeDeleteProcessor); ok {
		processor.BeforeDelete()
	}

	// --
	condSQL, condArgs, _ := session.Statement.genConds(bean)
	if len(condSQL) == 0 && session.Statement.LimitN == 0 {
		return 0, ErrNeedDeletedCond
	}

	var tableName = session.Engine.Quote(session.Statement.TableName())
	var deleteSQL string
	if len(condSQL) > 0 {
		deleteSQL = fmt.Sprintf("DELETE FROM %v WHERE %v", tableName, condSQL)
	} else {
		deleteSQL = fmt.Sprintf("DELETE FROM %v", tableName)
	}

	var orderSQL string
	if len(session.Statement.OrderStr) > 0 {
		orderSQL += fmt.Sprintf(" ORDER BY %s", session.Statement.OrderStr)
	}
	if session.Statement.LimitN > 0 {
		orderSQL += fmt.Sprintf(" LIMIT %d", session.Statement.LimitN)
	}

	if len(orderSQL) > 0 {
		switch session.Engine.dialect.DBType() {
		case core.POSTGRES:
			inSQL := fmt.Sprintf("ctid IN (SELECT ctid FROM %s%s)", tableName, orderSQL)
			if len(condSQL) > 0 {
				deleteSQL += " AND " + inSQL
			} else {
				deleteSQL += " WHERE " + inSQL
			}
		case core.SQLITE:
			inSQL := fmt.Sprintf("rowid IN (SELECT rowid FROM %s%s)", tableName, orderSQL)
			if len(condSQL) > 0 {
				deleteSQL += " AND " + inSQL
			} else {
				deleteSQL += " WHERE " + inSQL
			}
		// TODO: how to handle delete limit on mssql?
		case core.MSSQL:
			return 0, ErrNotImplemented
		default:
			deleteSQL += orderSQL
		}
	}

	var realSQL string
	argsForCache := make([]interface{}, 0, len(condArgs)*2)
	if session.Statement.unscoped || table.DeletedColumn() == nil { // tag "deleted" is disabled
		realSQL = deleteSQL
		copy(argsForCache, condArgs)
		argsForCache = append(condArgs, argsForCache...)
	} else {
		// !oinume! sqlStrForCache and argsForCache is needed to behave as executing "DELETE FROM ..." for cache.
		copy(argsForCache, condArgs)
		argsForCache = append(condArgs, argsForCache...)

		deletedColumn := table.DeletedColumn()
		realSQL = fmt.Sprintf("UPDATE %v SET %v = ? WHERE %v",
			session.Engine.Quote(session.Statement.TableName()),
			session.Engine.Quote(deletedColumn.Name),
			condSQL)

		if len(orderSQL) > 0 {
			switch session.Engine.dialect.DBType() {
			case core.POSTGRES:
				inSQL := fmt.Sprintf("ctid IN (SELECT ctid FROM %s%s)", tableName, orderSQL)
				if len(condSQL) > 0 {
					realSQL += " AND " + inSQL
				} else {
					realSQL += " WHERE " + inSQL
				}
			case core.SQLITE:
				inSQL := fmt.Sprintf("rowid IN (SELECT rowid FROM %s%s)", tableName, orderSQL)
				if len(condSQL) > 0 {
					realSQL += " AND " + inSQL
				} else {
					realSQL += " WHERE " + inSQL
				}
			// TODO: how to handle delete limit on mssql?
			case core.MSSQL:
				return 0, ErrNotImplemented
			default:
				realSQL += orderSQL
			}
		}

		// !oinume! Insert NowTime to the head of session.Statement.Params
		condArgs = append(condArgs, "")
		paramsLen := len(condArgs)
		copy(condArgs[1:paramsLen], condArgs[0:paramsLen-1])

		val, t := session.Engine.NowTime2(deletedColumn.SQLType.Name)
		condArgs[0] = val

		var colName = deletedColumn.Name
		session.afterClosures = append(session.afterClosures, func(bean interface{}) {
			col := table.GetColumn(colName)
			setColumnTime(bean, col, t)
		})
	}

	if cacher := session.Engine.getCacher2(session.Statement.RefTable); cacher != nil && session.Statement.UseCache {
		session.cacheDelete(deleteSQL, argsForCache...)
	}

	res, err := session.exec(realSQL, condArgs...)
	if err != nil {
		return 0, err
	}

	// handle after delete processors
	if session.IsAutoCommit {
		for _, closure := range session.afterClosures {
			closure(bean)
		}
		if processor, ok := interface{}(bean).(AfterDeleteProcessor); ok {
			processor.AfterDelete()
		}
	} else {
		lenAfterClosures := len(session.afterClosures)
		if lenAfterClosures > 0 {
			if value, has := session.afterDeleteBeans[bean]; has && value != nil {
				*value = append(*value, session.afterClosures...)
			} else {
				afterClosures := make([]func(interface{}), lenAfterClosures)
				copy(afterClosures, session.afterClosures)
				session.afterDeleteBeans[bean] = &afterClosures
			}
		} else {
			if _, ok := interface{}(bean).(AfterDeleteProcessor); ok {
				session.afterDeleteBeans[bean] = nil
			}
		}
	}
	cleanupProcessorsClosures(&session.afterClosures)
	// --

	return res.RowsAffected()
}
