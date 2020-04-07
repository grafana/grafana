// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"xorm.io/builder"
	"xorm.io/core"
)

func (session *Session) genQuerySQL(sqlOrArgs ...interface{}) (string, []interface{}, error) {
	if len(sqlOrArgs) > 0 {
		return convertSQLOrArgs(sqlOrArgs...)
	}

	if session.statement.RawSQL != "" {
		return session.statement.RawSQL, session.statement.RawParams, nil
	}

	if len(session.statement.TableName()) <= 0 {
		return "", nil, ErrTableNotFound
	}

	var columnStr = session.statement.ColumnStr
	if len(session.statement.selectStr) > 0 {
		columnStr = session.statement.selectStr
	} else {
		if session.statement.JoinStr == "" {
			if columnStr == "" {
				if session.statement.GroupByStr != "" {
					columnStr = session.engine.quoteColumns(session.statement.GroupByStr)
				} else {
					columnStr = session.statement.genColumnStr()
				}
			}
		} else {
			if columnStr == "" {
				if session.statement.GroupByStr != "" {
					columnStr = session.engine.quoteColumns(session.statement.GroupByStr)
				} else {
					columnStr = "*"
				}
			}
		}
		if columnStr == "" {
			columnStr = "*"
		}
	}

	if err := session.statement.processIDParam(); err != nil {
		return "", nil, err
	}

	condSQL, condArgs, err := builder.ToSQL(session.statement.cond)
	if err != nil {
		return "", nil, err
	}

	args := append(session.statement.joinArgs, condArgs...)
	sqlStr, err := session.statement.genSelectSQL(columnStr, condSQL, true, true)
	if err != nil {
		return "", nil, err
	}
	// for mssql and use limit
	qs := strings.Count(sqlStr, "?")
	if len(args)*2 == qs {
		args = append(args, args...)
	}

	return sqlStr, args, nil
}

// Query runs a raw sql and return records as []map[string][]byte
func (session *Session) Query(sqlOrArgs ...interface{}) ([]map[string][]byte, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	sqlStr, args, err := session.genQuerySQL(sqlOrArgs...)
	if err != nil {
		return nil, err
	}

	return session.queryBytes(sqlStr, args...)
}

func value2String(rawValue *reflect.Value) (str string, err error) {
	aa := reflect.TypeOf((*rawValue).Interface())
	vv := reflect.ValueOf((*rawValue).Interface())
	switch aa.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		str = strconv.FormatInt(vv.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		str = strconv.FormatUint(vv.Uint(), 10)
	case reflect.Float32, reflect.Float64:
		str = strconv.FormatFloat(vv.Float(), 'f', -1, 64)
	case reflect.String:
		str = vv.String()
	case reflect.Array, reflect.Slice:
		switch aa.Elem().Kind() {
		case reflect.Uint8:
			data := rawValue.Interface().([]byte)
			str = string(data)
			if str == "\x00" {
				str = "0"
			}
		default:
			err = fmt.Errorf("Unsupported struct type %v", vv.Type().Name())
		}
	// time type
	case reflect.Struct:
		if aa.ConvertibleTo(core.TimeType) {
			str = vv.Convert(core.TimeType).Interface().(time.Time).Format(time.RFC3339Nano)
		} else {
			err = fmt.Errorf("Unsupported struct type %v", vv.Type().Name())
		}
	case reflect.Bool:
		str = strconv.FormatBool(vv.Bool())
	case reflect.Complex128, reflect.Complex64:
		str = fmt.Sprintf("%v", vv.Complex())
	/* TODO: unsupported types below
	   case reflect.Map:
	   case reflect.Ptr:
	   case reflect.Uintptr:
	   case reflect.UnsafePointer:
	   case reflect.Chan, reflect.Func, reflect.Interface:
	*/
	default:
		err = fmt.Errorf("Unsupported struct type %v", vv.Type().Name())
	}
	return
}

func row2mapStr(rows *core.Rows, fields []string) (resultsMap map[string]string, err error) {
	result := make(map[string]string)
	scanResultContainers := make([]interface{}, len(fields))
	for i := 0; i < len(fields); i++ {
		var scanResultContainer interface{}
		scanResultContainers[i] = &scanResultContainer
	}
	if err := rows.Scan(scanResultContainers...); err != nil {
		return nil, err
	}

	for ii, key := range fields {
		rawValue := reflect.Indirect(reflect.ValueOf(scanResultContainers[ii]))
		// if row is null then as empty string
		if rawValue.Interface() == nil {
			result[key] = ""
			continue
		}

		if data, err := value2String(&rawValue); err == nil {
			result[key] = data
		} else {
			return nil, err
		}
	}
	return result, nil
}

func row2sliceStr(rows *core.Rows, fields []string) (results []string, err error) {
	result := make([]string, 0, len(fields))
	scanResultContainers := make([]interface{}, len(fields))
	for i := 0; i < len(fields); i++ {
		var scanResultContainer interface{}
		scanResultContainers[i] = &scanResultContainer
	}
	if err := rows.Scan(scanResultContainers...); err != nil {
		return nil, err
	}

	for i := 0; i < len(fields); i++ {
		rawValue := reflect.Indirect(reflect.ValueOf(scanResultContainers[i]))
		// if row is null then as empty string
		if rawValue.Interface() == nil {
			result = append(result, "")
			continue
		}

		if data, err := value2String(&rawValue); err == nil {
			result = append(result, data)
		} else {
			return nil, err
		}
	}
	return result, nil
}

func rows2Strings(rows *core.Rows) (resultsSlice []map[string]string, err error) {
	fields, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		result, err := row2mapStr(rows, fields)
		if err != nil {
			return nil, err
		}
		resultsSlice = append(resultsSlice, result)
	}

	return resultsSlice, nil
}

func rows2SliceString(rows *core.Rows) (resultsSlice [][]string, err error) {
	fields, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		record, err := row2sliceStr(rows, fields)
		if err != nil {
			return nil, err
		}
		resultsSlice = append(resultsSlice, record)
	}

	return resultsSlice, nil
}

// QueryString runs a raw sql and return records as []map[string]string
func (session *Session) QueryString(sqlOrArgs ...interface{}) ([]map[string]string, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	sqlStr, args, err := session.genQuerySQL(sqlOrArgs...)
	if err != nil {
		return nil, err
	}

	rows, err := session.queryRows(sqlStr, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return rows2Strings(rows)
}

// QuerySliceString runs a raw sql and return records as [][]string
func (session *Session) QuerySliceString(sqlOrArgs ...interface{}) ([][]string, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	sqlStr, args, err := session.genQuerySQL(sqlOrArgs...)
	if err != nil {
		return nil, err
	}

	rows, err := session.queryRows(sqlStr, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return rows2SliceString(rows)
}

func row2mapInterface(rows *core.Rows, fields []string) (resultsMap map[string]interface{}, err error) {
	resultsMap = make(map[string]interface{}, len(fields))
	scanResultContainers := make([]interface{}, len(fields))
	for i := 0; i < len(fields); i++ {
		var scanResultContainer interface{}
		scanResultContainers[i] = &scanResultContainer
	}
	if err := rows.Scan(scanResultContainers...); err != nil {
		return nil, err
	}

	for ii, key := range fields {
		resultsMap[key] = reflect.Indirect(reflect.ValueOf(scanResultContainers[ii])).Interface()
	}
	return
}

func rows2Interfaces(rows *core.Rows) (resultsSlice []map[string]interface{}, err error) {
	fields, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		result, err := row2mapInterface(rows, fields)
		if err != nil {
			return nil, err
		}
		resultsSlice = append(resultsSlice, result)
	}

	return resultsSlice, nil
}

// QueryInterface runs a raw sql and return records as []map[string]interface{}
func (session *Session) QueryInterface(sqlOrArgs ...interface{}) ([]map[string]interface{}, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	sqlStr, args, err := session.genQuerySQL(sqlOrArgs...)
	if err != nil {
		return nil, err
	}

	rows, err := session.queryRows(sqlStr, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return rows2Interfaces(rows)
}
