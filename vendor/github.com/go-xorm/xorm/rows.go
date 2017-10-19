// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"fmt"
	"reflect"

	"github.com/go-xorm/core"
)

// Rows rows wrapper a rows to
type Rows struct {
	NoTypeCheck bool

	session   *Session
	stmt      *core.Stmt
	rows      *core.Rows
	fields    []string
	beanType  reflect.Type
	lastError error
}

func newRows(session *Session, bean interface{}) (*Rows, error) {
	rows := new(Rows)
	rows.session = session
	rows.beanType = reflect.Indirect(reflect.ValueOf(bean)).Type()

	defer rows.session.resetStatement()

	var sqlStr string
	var args []interface{}

	rows.session.Statement.setRefValue(rValue(bean))
	if len(session.Statement.TableName()) <= 0 {
		return nil, ErrTableNotFound
	}

	if rows.session.Statement.RawSQL == "" {
		sqlStr, args = rows.session.Statement.genGetSQL(bean)
	} else {
		sqlStr = rows.session.Statement.RawSQL
		args = rows.session.Statement.RawParams
	}

	for _, filter := range rows.session.Engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, rows.session.Statement.RefTable)
	}

	rows.session.saveLastSQL(sqlStr, args...)
	var err error
	if rows.session.prepareStmt {
		rows.stmt, err = rows.session.DB().Prepare(sqlStr)
		if err != nil {
			rows.lastError = err
			rows.Close()
			return nil, err
		}

		rows.rows, err = rows.stmt.Query(args...)
		if err != nil {
			rows.lastError = err
			rows.Close()
			return nil, err
		}
	} else {
		rows.rows, err = rows.session.DB().Query(sqlStr, args...)
		if err != nil {
			rows.lastError = err
			rows.Close()
			return nil, err
		}
	}

	rows.fields, err = rows.rows.Columns()
	if err != nil {
		rows.lastError = err
		rows.Close()
		return nil, err
	}

	return rows, nil
}

// Next move cursor to next record, return false if end has reached
func (rows *Rows) Next() bool {
	if rows.lastError == nil && rows.rows != nil {
		hasNext := rows.rows.Next()
		if !hasNext {
			rows.lastError = sql.ErrNoRows
		}
		return hasNext
	}
	return false
}

// Err returns the error, if any, that was encountered during iteration. Err may be called after an explicit or implicit Close.
func (rows *Rows) Err() error {
	return rows.lastError
}

// Scan row record to bean properties
func (rows *Rows) Scan(bean interface{}) error {
	if rows.lastError != nil {
		return rows.lastError
	}

	if !rows.NoTypeCheck && reflect.Indirect(reflect.ValueOf(bean)).Type() != rows.beanType {
		return fmt.Errorf("scan arg is incompatible type to [%v]", rows.beanType)
	}

	dataStruct := rValue(bean)
	rows.session.Statement.setRefValue(dataStruct)
	_, err := rows.session.row2Bean(rows.rows, rows.fields, len(rows.fields), bean, &dataStruct, rows.session.Statement.RefTable)

	return err
}

// Close session if session.IsAutoClose is true, and claimed any opened resources
func (rows *Rows) Close() error {
	if rows.session.IsAutoClose {
		defer rows.session.Close()
	}

	if rows.lastError == nil {
		if rows.rows != nil {
			rows.lastError = rows.rows.Close()
			if rows.lastError != nil {
				defer rows.stmt.Close()
				return rows.lastError
			}
		}
		if rows.stmt != nil {
			rows.lastError = rows.stmt.Close()
		}
	} else {
		if rows.stmt != nil {
			defer rows.stmt.Close()
		}
		if rows.rows != nil {
			defer rows.rows.Close()
		}
	}
	return rows.lastError
}
