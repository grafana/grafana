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
	rows      *core.Rows
	fields    []string
	beanType  reflect.Type
	lastError error
}

func newRows(session *Session, bean interface{}) (*Rows, error) {
	rows := new(Rows)
	rows.session = session
	rows.beanType = reflect.Indirect(reflect.ValueOf(bean)).Type()

	var sqlStr string
	var args []interface{}
	var err error

	if err = rows.session.statement.setRefBean(bean); err != nil {
		return nil, err
	}

	if len(session.statement.TableName()) <= 0 {
		return nil, ErrTableNotFound
	}

	if rows.session.statement.RawSQL == "" {
		sqlStr, args, err = rows.session.statement.genGetSQL(bean)
		if err != nil {
			return nil, err
		}
	} else {
		sqlStr = rows.session.statement.RawSQL
		args = rows.session.statement.RawParams
	}

	rows.rows, err = rows.session.queryRows(sqlStr, args...)
	if err != nil {
		rows.lastError = err
		rows.Close()
		return nil, err
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

	if err := rows.session.statement.setRefBean(bean); err != nil {
		return err
	}

	scanResults, err := rows.session.row2Slice(rows.rows, rows.fields, bean)
	if err != nil {
		return err
	}

	dataStruct := rValue(bean)
	_, err = rows.session.slice2Bean(scanResults, rows.fields, bean, &dataStruct, rows.session.statement.RefTable)
	if err != nil {
		return err
	}

	return rows.session.executeProcessors()
}

// Close session if session.IsAutoClose is true, and claimed any opened resources
func (rows *Rows) Close() error {
	if rows.session.isAutoClose {
		defer rows.session.Close()
	}

	if rows.lastError == nil {
		if rows.rows != nil {
			rows.lastError = rows.rows.Close()
			if rows.lastError != nil {
				return rows.lastError
			}
		}
	} else {
		if rows.rows != nil {
			defer rows.rows.Close()
		}
	}
	return rows.lastError
}
