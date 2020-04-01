// Copyright 2018 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"reflect"
	"strings"

	"xorm.io/core"
)

// tbNameWithSchema will automatically add schema prefix on table name
func (engine *Engine) tbNameWithSchema(v string) string {
	// Add schema name as prefix of table name.
	// Only for postgres database.
	if engine.dialect.DBType() == core.POSTGRES &&
		engine.dialect.URI().Schema != "" &&
		engine.dialect.URI().Schema != postgresPublicSchema &&
		strings.Index(v, ".") == -1 {
		return engine.dialect.URI().Schema + "." + v
	}
	return v
}

// TableName returns table name with schema prefix if has
func (engine *Engine) TableName(bean interface{}, includeSchema ...bool) string {
	tbName := engine.tbNameNoSchema(bean)
	if len(includeSchema) > 0 && includeSchema[0] {
		tbName = engine.tbNameWithSchema(tbName)
	}

	return tbName
}

// tbName get some table's table name
func (session *Session) tbNameNoSchema(table *core.Table) string {
	if len(session.statement.AltTableName) > 0 {
		return session.statement.AltTableName
	}

	return table.Name
}

func (engine *Engine) tbNameForMap(v reflect.Value) string {
	if v.Type().Implements(tpTableName) {
		return v.Interface().(TableName).TableName()
	}
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
		if v.Type().Implements(tpTableName) {
			return v.Interface().(TableName).TableName()
		}
	}

	return engine.TableMapper.Obj2Table(v.Type().Name())
}

func (engine *Engine) tbNameNoSchema(tablename interface{}) string {
	switch tablename.(type) {
	case []string:
		t := tablename.([]string)
		if len(t) > 1 {
			return fmt.Sprintf("%v AS %v", engine.Quote(t[0]), engine.Quote(t[1]))
		} else if len(t) == 1 {
			return engine.Quote(t[0])
		}
	case []interface{}:
		t := tablename.([]interface{})
		l := len(t)
		var table string
		if l > 0 {
			f := t[0]
			switch f.(type) {
			case string:
				table = f.(string)
			case TableName:
				table = f.(TableName).TableName()
			default:
				v := rValue(f)
				t := v.Type()
				if t.Kind() == reflect.Struct {
					table = engine.tbNameForMap(v)
				} else {
					table = engine.Quote(fmt.Sprintf("%v", f))
				}
			}
		}
		if l > 1 {
			return fmt.Sprintf("%v AS %v", engine.Quote(table),
				engine.Quote(fmt.Sprintf("%v", t[1])))
		} else if l == 1 {
			return engine.Quote(table)
		}
	case TableName:
		return tablename.(TableName).TableName()
	case string:
		return tablename.(string)
	case reflect.Value:
		v := tablename.(reflect.Value)
		return engine.tbNameForMap(v)
	default:
		v := rValue(tablename)
		t := v.Type()
		if t.Kind() == reflect.Struct {
			return engine.tbNameForMap(v)
		}
		return engine.Quote(fmt.Sprintf("%v", tablename))
	}
	return ""
}
