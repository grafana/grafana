// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"strconv"

	"xorm.io/core"
)

// Get retrieve one record from database, bean's non-empty fields
// will be as conditions
func (session *Session) Get(bean interface{}) (bool, error) {
	if session.isAutoClose {
		defer session.Close()
	}
	return session.get(bean)
}

func (session *Session) get(bean interface{}) (bool, error) {
	defer session.resetStatement()

	if session.statement.lastError != nil {
		return false, session.statement.lastError
	}

	beanValue := reflect.ValueOf(bean)
	if beanValue.Kind() != reflect.Ptr {
		return false, errors.New("needs a pointer to a value")
	} else if beanValue.Elem().Kind() == reflect.Ptr {
		return false, errors.New("a pointer to a pointer is not allowed")
	}

	if beanValue.Elem().Kind() == reflect.Struct {
		if err := session.statement.setRefBean(bean); err != nil {
			return false, err
		}
	}

	var sqlStr string
	var args []interface{}
	var err error

	if session.statement.RawSQL == "" {
		if len(session.statement.TableName()) <= 0 {
			return false, ErrTableNotFound
		}
		session.statement.Limit(1)
		sqlStr, args, err = session.statement.genGetSQL(bean)
		if err != nil {
			return false, err
		}
	} else {
		sqlStr = session.statement.RawSQL
		args = session.statement.RawParams
	}

	table := session.statement.RefTable

	if session.canCache() && beanValue.Elem().Kind() == reflect.Struct {
		if cacher := session.engine.getCacher(session.statement.TableName()); cacher != nil &&
			!session.statement.unscoped {
			has, err := session.cacheGet(bean, sqlStr, args...)
			if err != ErrCacheFailed {
				return has, err
			}
		}
	}

	context := session.statement.context
	if context != nil {
		res := context.Get(fmt.Sprintf("%v-%v", sqlStr, args))
		if res != nil {
			session.engine.logger.Debug("hit context cache", sqlStr)

			structValue := reflect.Indirect(reflect.ValueOf(bean))
			structValue.Set(reflect.Indirect(reflect.ValueOf(res)))
			session.lastSQL = ""
			session.lastSQLArgs = nil
			return true, nil
		}
	}

	has, err := session.nocacheGet(beanValue.Elem().Kind(), table, bean, sqlStr, args...)
	if err != nil || !has {
		return has, err
	}

	if context != nil {
		context.Put(fmt.Sprintf("%v-%v", sqlStr, args), bean)
	}

	return true, nil
}

func (session *Session) nocacheGet(beanKind reflect.Kind, table *core.Table, bean interface{}, sqlStr string, args ...interface{}) (bool, error) {
	rows, err := session.queryRows(sqlStr, args...)
	if err != nil {
		return false, err
	}
	defer rows.Close()

	if !rows.Next() {
		if rows.Err() != nil {
			return false, rows.Err()
		}
		return false, nil
	}

	switch bean.(type) {
	case sql.NullInt64, sql.NullBool, sql.NullFloat64, sql.NullString:
		return true, rows.Scan(&bean)
	case *sql.NullInt64, *sql.NullBool, *sql.NullFloat64, *sql.NullString:
		return true, rows.Scan(bean)
	case *string:
		var res sql.NullString
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*string)) = res.String
		}
		return true, nil
	case *int:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*int)) = int(res.Int64)
		}
		return true, nil
	case *int8:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*int8)) = int8(res.Int64)
		}
		return true, nil
	case *int16:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*int16)) = int16(res.Int64)
		}
		return true, nil
	case *int32:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*int32)) = int32(res.Int64)
		}
		return true, nil
	case *int64:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*int64)) = int64(res.Int64)
		}
		return true, nil
	case *uint:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*uint)) = uint(res.Int64)
		}
		return true, nil
	case *uint8:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*uint8)) = uint8(res.Int64)
		}
		return true, nil
	case *uint16:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*uint16)) = uint16(res.Int64)
		}
		return true, nil
	case *uint32:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*uint32)) = uint32(res.Int64)
		}
		return true, nil
	case *uint64:
		var res sql.NullInt64
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*uint64)) = uint64(res.Int64)
		}
		return true, nil
	case *bool:
		var res sql.NullBool
		if err := rows.Scan(&res); err != nil {
			return true, err
		}
		if res.Valid {
			*(bean.(*bool)) = res.Bool
		}
		return true, nil
	}

	switch beanKind {
	case reflect.Struct:
		fields, err := rows.Columns()
		if err != nil {
			// WARN: Alougth rows return true, but get fields failed
			return true, err
		}

		scanResults, err := session.row2Slice(rows, fields, bean)
		if err != nil {
			return false, err
		}
		// close it before covert data
		rows.Close()

		dataStruct := rValue(bean)
		_, err = session.slice2Bean(scanResults, fields, bean, &dataStruct, table)
		if err != nil {
			return true, err
		}

		return true, session.executeProcessors()
	case reflect.Slice:
		err = rows.ScanSlice(bean)
	case reflect.Map:
		err = rows.ScanMap(bean)
	case reflect.String, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		err = rows.Scan(bean)
	default:
		err = rows.Scan(bean)
	}

	return true, err
}

func (session *Session) cacheGet(bean interface{}, sqlStr string, args ...interface{}) (has bool, err error) {
	// if has no reftable, then don't use cache currently
	if !session.canCache() {
		return false, ErrCacheFailed
	}

	for _, filter := range session.engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.engine.dialect, session.statement.RefTable)
	}
	newsql := session.statement.convertIDSQL(sqlStr)
	if newsql == "" {
		return false, ErrCacheFailed
	}

	tableName := session.statement.TableName()
	cacher := session.engine.getCacher(tableName)

	session.engine.logger.Debug("[cacheGet] find sql:", newsql, args)
	table := session.statement.RefTable
	ids, err := core.GetCacheSql(cacher, tableName, newsql, args)
	if err != nil {
		var res = make([]string, len(table.PrimaryKeys))
		rows, err := session.NoCache().queryRows(newsql, args...)
		if err != nil {
			return false, err
		}
		defer rows.Close()

		if rows.Next() {
			err = rows.ScanSlice(&res)
			if err != nil {
				return false, err
			}
		} else {
			return false, ErrCacheFailed
		}

		var pk core.PK = make([]interface{}, len(table.PrimaryKeys))
		for i, col := range table.PKColumns() {
			if col.SQLType.IsText() {
				pk[i] = res[i]
			} else if col.SQLType.IsNumeric() {
				n, err := strconv.ParseInt(res[i], 10, 64)
				if err != nil {
					return false, err
				}
				pk[i] = n
			} else {
				return false, errors.New("unsupported")
			}
		}

		ids = []core.PK{pk}
		session.engine.logger.Debug("[cacheGet] cache ids:", newsql, ids)
		err = core.PutCacheSql(cacher, ids, tableName, newsql, args)
		if err != nil {
			return false, err
		}
	} else {
		session.engine.logger.Debug("[cacheGet] cache hit sql:", newsql, ids)
	}

	if len(ids) > 0 {
		structValue := reflect.Indirect(reflect.ValueOf(bean))
		id := ids[0]
		session.engine.logger.Debug("[cacheGet] get bean:", tableName, id)
		sid, err := id.ToString()
		if err != nil {
			return false, err
		}
		cacheBean := cacher.GetBean(tableName, sid)
		if cacheBean == nil {
			cacheBean = bean
			has, err = session.nocacheGet(reflect.Struct, table, cacheBean, sqlStr, args...)
			if err != nil || !has {
				return has, err
			}

			session.engine.logger.Debug("[cacheGet] cache bean:", tableName, id, cacheBean)
			cacher.PutBean(tableName, sid, cacheBean)
		} else {
			session.engine.logger.Debug("[cacheGet] cache hit bean:", tableName, id, cacheBean)
			has = true
		}
		structValue.Set(reflect.Indirect(reflect.ValueOf(cacheBean)))

		return has, nil
	}
	return false, nil
}
