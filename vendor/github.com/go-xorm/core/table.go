// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package core

import (
	"reflect"
	"strings"
)

// database table
type Table struct {
	Name          string
	Type          reflect.Type
	columnsSeq    []string
	columnsMap    map[string][]*Column
	columns       []*Column
	Indexes       map[string]*Index
	PrimaryKeys   []string
	AutoIncrement string
	Created       map[string]bool
	Updated       string
	Deleted       string
	Version       string
	Cacher        Cacher
	StoreEngine   string
	Charset       string
	Comment       string
}

func (table *Table) Columns() []*Column {
	return table.columns
}

func (table *Table) ColumnsSeq() []string {
	return table.columnsSeq
}

func NewEmptyTable() *Table {
	return NewTable("", nil)
}

func NewTable(name string, t reflect.Type) *Table {
	return &Table{Name: name, Type: t,
		columnsSeq:  make([]string, 0),
		columns:     make([]*Column, 0),
		columnsMap:  make(map[string][]*Column),
		Indexes:     make(map[string]*Index),
		Created:     make(map[string]bool),
		PrimaryKeys: make([]string, 0),
	}
}

func (table *Table) columnsByName(name string) []*Column {
	n := len(name)

	for k := range table.columnsMap {
		if len(k) != n {
			continue
		}
		if strings.EqualFold(k, name) {
			return table.columnsMap[k]
		}
	}
	return nil
}

func (table *Table) GetColumn(name string) *Column {

	cols := table.columnsByName(name)

	if cols != nil {
		return cols[0]
	}

	return nil
}

func (table *Table) GetColumnIdx(name string, idx int) *Column {
	cols := table.columnsByName(name)

	if cols != nil && idx < len(cols) {
		return cols[idx]
	}

	return nil
}

// if has primary key, return column
func (table *Table) PKColumns() []*Column {
	columns := make([]*Column, len(table.PrimaryKeys))
	for i, name := range table.PrimaryKeys {
		columns[i] = table.GetColumn(name)
	}
	return columns
}

func (table *Table) ColumnType(name string) reflect.Type {
	t, _ := table.Type.FieldByName(name)
	return t.Type
}

func (table *Table) AutoIncrColumn() *Column {
	return table.GetColumn(table.AutoIncrement)
}

func (table *Table) VersionColumn() *Column {
	return table.GetColumn(table.Version)
}

func (table *Table) UpdatedColumn() *Column {
	return table.GetColumn(table.Updated)
}

func (table *Table) DeletedColumn() *Column {
	return table.GetColumn(table.Deleted)
}

// add a column to table
func (table *Table) AddColumn(col *Column) {
	table.columnsSeq = append(table.columnsSeq, col.Name)
	table.columns = append(table.columns, col)
	colName := strings.ToLower(col.Name)
	if c, ok := table.columnsMap[colName]; ok {
		table.columnsMap[colName] = append(c, col)
	} else {
		table.columnsMap[colName] = []*Column{col}
	}

	if col.IsPrimaryKey {
		table.PrimaryKeys = append(table.PrimaryKeys, col.Name)
	}
	if col.IsAutoIncrement {
		table.AutoIncrement = col.Name
	}
	if col.IsCreated {
		table.Created[col.Name] = true
	}
	if col.IsUpdated {
		table.Updated = col.Name
	}
	if col.IsDeleted {
		table.Deleted = col.Name
	}
	if col.IsVersion {
		table.Version = col.Name
	}
}

// add an index or an unique to table
func (table *Table) AddIndex(index *Index) {
	table.Indexes[index.Name] = index
}
