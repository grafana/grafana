// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import "database/sql"

// Count counts the records. bean's non-empty fields
// are conditions.
func (session *Session) Count(bean interface{}) (int64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	var sqlStr string
	var args []interface{}
	if session.Statement.RawSQL == "" {
		sqlStr, args = session.Statement.genCountSQL(bean)
	} else {
		sqlStr = session.Statement.RawSQL
		args = session.Statement.RawParams
	}

	session.queryPreprocess(&sqlStr, args...)

	var err error
	var total int64
	if session.IsAutoCommit {
		err = session.DB().QueryRow(sqlStr, args...).Scan(&total)
	} else {
		err = session.Tx.QueryRow(sqlStr, args...).Scan(&total)
	}

	if err == sql.ErrNoRows || err == nil {
		return total, nil
	}

	return 0, err
}

// Sum call sum some column. bean's non-empty fields are conditions.
func (session *Session) Sum(bean interface{}, columnName string) (float64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	var sqlStr string
	var args []interface{}
	if len(session.Statement.RawSQL) == 0 {
		sqlStr, args = session.Statement.genSumSQL(bean, columnName)
	} else {
		sqlStr = session.Statement.RawSQL
		args = session.Statement.RawParams
	}

	session.queryPreprocess(&sqlStr, args...)

	var err error
	var res float64
	if session.IsAutoCommit {
		err = session.DB().QueryRow(sqlStr, args...).Scan(&res)
	} else {
		err = session.Tx.QueryRow(sqlStr, args...).Scan(&res)
	}

	if err == sql.ErrNoRows || err == nil {
		return res, nil
	}
	return 0, err
}

// Sums call sum some columns. bean's non-empty fields are conditions.
func (session *Session) Sums(bean interface{}, columnNames ...string) ([]float64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	var sqlStr string
	var args []interface{}
	if len(session.Statement.RawSQL) == 0 {
		sqlStr, args = session.Statement.genSumSQL(bean, columnNames...)
	} else {
		sqlStr = session.Statement.RawSQL
		args = session.Statement.RawParams
	}

	session.queryPreprocess(&sqlStr, args...)

	var err error
	var res = make([]float64, len(columnNames), len(columnNames))
	if session.IsAutoCommit {
		err = session.DB().QueryRow(sqlStr, args...).ScanSlice(&res)
	} else {
		err = session.Tx.QueryRow(sqlStr, args...).ScanSlice(&res)
	}

	if err == sql.ErrNoRows || err == nil {
		return res, nil
	}
	return nil, err
}

// SumsInt sum specify columns and return as []int64 instead of []float64
func (session *Session) SumsInt(bean interface{}, columnNames ...string) ([]int64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	var sqlStr string
	var args []interface{}
	if len(session.Statement.RawSQL) == 0 {
		sqlStr, args = session.Statement.genSumSQL(bean, columnNames...)
	} else {
		sqlStr = session.Statement.RawSQL
		args = session.Statement.RawParams
	}

	session.queryPreprocess(&sqlStr, args...)

	var err error
	var res = make([]int64, len(columnNames), len(columnNames))
	if session.IsAutoCommit {
		err = session.DB().QueryRow(sqlStr, args...).ScanSlice(&res)
	} else {
		err = session.Tx.QueryRow(sqlStr, args...).ScanSlice(&res)
	}

	if err == sql.ErrNoRows || err == nil {
		return res, nil
	}
	return nil, err
}
