// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"

	"github.com/go-xorm/core"
)

func (session *Session) query(sqlStr string, paramStr ...interface{}) (resultsSlice []map[string][]byte, err error) {
	session.queryPreprocess(&sqlStr, paramStr...)

	if session.IsAutoCommit {
		return session.innerQuery2(sqlStr, paramStr...)
	}
	return session.txQuery(session.Tx, sqlStr, paramStr...)
}

func (session *Session) txQuery(tx *core.Tx, sqlStr string, params ...interface{}) (resultsSlice []map[string][]byte, err error) {
	rows, err := tx.Query(sqlStr, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return rows2maps(rows)
}

func (session *Session) innerQuery(sqlStr string, params ...interface{}) (*core.Stmt, *core.Rows, error) {
	var callback func() (*core.Stmt, *core.Rows, error)
	if session.prepareStmt {
		callback = func() (*core.Stmt, *core.Rows, error) {
			stmt, err := session.doPrepare(sqlStr)
			if err != nil {
				return nil, nil, err
			}
			rows, err := stmt.Query(params...)
			if err != nil {
				return nil, nil, err
			}
			return stmt, rows, nil
		}
	} else {
		callback = func() (*core.Stmt, *core.Rows, error) {
			rows, err := session.DB().Query(sqlStr, params...)
			if err != nil {
				return nil, nil, err
			}
			return nil, rows, err
		}
	}
	stmt, rows, err := session.Engine.logSQLQueryTime(sqlStr, params, callback)
	if err != nil {
		return nil, nil, err
	}
	return stmt, rows, nil
}

func (session *Session) innerQuery2(sqlStr string, params ...interface{}) ([]map[string][]byte, error) {
	_, rows, err := session.innerQuery(sqlStr, params...)
	if rows != nil {
		defer rows.Close()
	}
	if err != nil {
		return nil, err
	}
	return rows2maps(rows)
}

// Query a raw sql and return records as []map[string][]byte
func (session *Session) Query(sqlStr string, paramStr ...interface{}) (resultsSlice []map[string][]byte, err error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	return session.query(sqlStr, paramStr...)
}

// =============================
// for string
// =============================
func (session *Session) query2(sqlStr string, paramStr ...interface{}) (resultsSlice []map[string]string, err error) {
	session.queryPreprocess(&sqlStr, paramStr...)

	if session.IsAutoCommit {
		return query2(session.DB(), sqlStr, paramStr...)
	}
	return txQuery2(session.Tx, sqlStr, paramStr...)
}

// Execute sql
func (session *Session) innerExec(sqlStr string, args ...interface{}) (sql.Result, error) {
	if session.prepareStmt {
		stmt, err := session.doPrepare(sqlStr)
		if err != nil {
			return nil, err
		}

		res, err := stmt.Exec(args...)
		if err != nil {
			return nil, err
		}
		return res, nil
	}

	return session.DB().Exec(sqlStr, args...)
}

func (session *Session) exec(sqlStr string, args ...interface{}) (sql.Result, error) {
	for _, filter := range session.Engine.dialect.Filters() {
		// TODO: for table name, it's no need to RefTable
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, session.Statement.RefTable)
	}

	session.saveLastSQL(sqlStr, args...)

	return session.Engine.logSQLExecutionTime(sqlStr, args, func() (sql.Result, error) {
		if session.IsAutoCommit {
			// FIXME: oci8 can not auto commit (github.com/mattn/go-oci8)
			if session.Engine.dialect.DBType() == core.ORACLE {
				session.Begin()
				r, err := session.Tx.Exec(sqlStr, args...)
				session.Commit()
				return r, err
			}
			return session.innerExec(sqlStr, args...)
		}
		return session.Tx.Exec(sqlStr, args...)
	})
}

// Exec raw sql
func (session *Session) Exec(sqlStr string, args ...interface{}) (sql.Result, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	return session.exec(sqlStr, args...)
}
