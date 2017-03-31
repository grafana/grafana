// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"reflect"
	"strconv"

	"github.com/go-xorm/core"
)

// Get retrieve one record from database, bean's non-empty fields
// will be as conditions
func (session *Session) Get(bean interface{}) (bool, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	beanValue := reflect.ValueOf(bean)
	if beanValue.Kind() != reflect.Ptr {
		return false, errors.New("needs a pointer to a struct")
	}

	// FIXME: remove this after support non-struct Get
	if beanValue.Elem().Kind() != reflect.Struct {
		return false, errors.New("needs a pointer to a struct")
	}

	if beanValue.Elem().Kind() == reflect.Struct {
		session.Statement.setRefValue(beanValue.Elem())
	}

	var sqlStr string
	var args []interface{}

	if session.Statement.RawSQL == "" {
		if len(session.Statement.TableName()) <= 0 {
			return false, ErrTableNotFound
		}
		session.Statement.Limit(1)
		sqlStr, args = session.Statement.genGetSQL(bean)
	} else {
		sqlStr = session.Statement.RawSQL
		args = session.Statement.RawParams
	}

	if session.canCache() {
		if cacher := session.Engine.getCacher2(session.Statement.RefTable); cacher != nil &&
			!session.Statement.unscoped {
			has, err := session.cacheGet(bean, sqlStr, args...)
			if err != ErrCacheFailed {
				return has, err
			}
		}
	}

	return session.nocacheGet(beanValue.Elem().Kind(), bean, sqlStr, args...)
}

func (session *Session) nocacheGet(beanKind reflect.Kind, bean interface{}, sqlStr string, args ...interface{}) (bool, error) {
	var rawRows *core.Rows
	var err error
	session.queryPreprocess(&sqlStr, args...)
	if session.IsAutoCommit {
		_, rawRows, err = session.innerQuery(sqlStr, args...)
	} else {
		rawRows, err = session.Tx.Query(sqlStr, args...)
	}
	if err != nil {
		return false, err
	}

	defer rawRows.Close()

	if rawRows.Next() {
		fields, err := rawRows.Columns()
		if err != nil {
			// WARN: Alougth rawRows return true, but get fields failed
			return true, err
		}

		switch beanKind {
		case reflect.Struct:
			dataStruct := rValue(bean)
			session.Statement.setRefValue(dataStruct)
			_, err = session.row2Bean(rawRows, fields, len(fields), bean, &dataStruct, session.Statement.RefTable)
		case reflect.Slice:
			err = rawRows.ScanSlice(bean)
		case reflect.Map:
			err = rawRows.ScanMap(bean)
		default:
			err = rawRows.Scan(bean)
		}

		return true, err
	}
	return false, nil
}

func (session *Session) cacheGet(bean interface{}, sqlStr string, args ...interface{}) (has bool, err error) {
	// if has no reftable, then don't use cache currently
	if !session.canCache() {
		return false, ErrCacheFailed
	}

	for _, filter := range session.Engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, session.Statement.RefTable)
	}
	newsql := session.Statement.convertIDSQL(sqlStr)
	if newsql == "" {
		return false, ErrCacheFailed
	}

	cacher := session.Engine.getCacher2(session.Statement.RefTable)
	tableName := session.Statement.TableName()
	session.Engine.logger.Debug("[cacheGet] find sql:", newsql, args)
	ids, err := core.GetCacheSql(cacher, tableName, newsql, args)
	table := session.Statement.RefTable
	if err != nil {
		var res = make([]string, len(table.PrimaryKeys))
		rows, err := session.DB().Query(newsql, args...)
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
		session.Engine.logger.Debug("[cacheGet] cache ids:", newsql, ids)
		err = core.PutCacheSql(cacher, ids, tableName, newsql, args)
		if err != nil {
			return false, err
		}
	} else {
		session.Engine.logger.Debug("[cacheGet] cache hit sql:", newsql)
	}

	if len(ids) > 0 {
		structValue := reflect.Indirect(reflect.ValueOf(bean))
		id := ids[0]
		session.Engine.logger.Debug("[cacheGet] get bean:", tableName, id)
		sid, err := id.ToString()
		if err != nil {
			return false, err
		}
		cacheBean := cacher.GetBean(tableName, sid)
		if cacheBean == nil {
			cacheBean = bean
			has, err = session.nocacheGet(reflect.Struct, cacheBean, sqlStr, args...)
			if err != nil || !has {
				return has, err
			}

			session.Engine.logger.Debug("[cacheGet] cache bean:", tableName, id, cacheBean)
			cacher.PutBean(tableName, sid, cacheBean)
		} else {
			session.Engine.logger.Debug("[cacheGet] cache hit bean:", tableName, id, cacheBean)
			has = true
		}
		structValue.Set(reflect.Indirect(reflect.ValueOf(cacheBean)))

		return has, nil
	}
	return false, nil
}
