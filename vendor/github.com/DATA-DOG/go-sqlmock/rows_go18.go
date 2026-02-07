// +build go1.8

package sqlmock

import (
	"database/sql/driver"
	"io"
	"reflect"
)

// Implement the "RowsNextResultSet" interface
func (rs *rowSets) HasNextResultSet() bool {
	return rs.pos+1 < len(rs.sets)
}

// Implement the "RowsNextResultSet" interface
func (rs *rowSets) NextResultSet() error {
	if !rs.HasNextResultSet() {
		return io.EOF
	}

	rs.pos++
	return nil
}

// type for rows with columns definition created with sqlmock.NewRowsWithColumnDefinition
type rowSetsWithDefinition struct {
	*rowSets
}

// Implement the "RowsColumnTypeDatabaseTypeName" interface
func (rs *rowSetsWithDefinition) ColumnTypeDatabaseTypeName(index int) string {
	return rs.getDefinition(index).DbType()
}

// Implement the "RowsColumnTypeLength" interface
func (rs *rowSetsWithDefinition) ColumnTypeLength(index int) (length int64, ok bool) {
	return rs.getDefinition(index).Length()
}

// Implement the "RowsColumnTypeNullable" interface
func (rs *rowSetsWithDefinition) ColumnTypeNullable(index int) (nullable, ok bool) {
	return rs.getDefinition(index).IsNullable()
}

// Implement the "RowsColumnTypePrecisionScale" interface
func (rs *rowSetsWithDefinition) ColumnTypePrecisionScale(index int) (precision, scale int64, ok bool) {
	return rs.getDefinition(index).PrecisionScale()
}

// ColumnTypeScanType is defined from driver.RowsColumnTypeScanType
func (rs *rowSetsWithDefinition) ColumnTypeScanType(index int) reflect.Type {
	return rs.getDefinition(index).ScanType()
}

// return column definition from current set metadata
func (rs *rowSetsWithDefinition) getDefinition(index int) *Column {
	return rs.sets[rs.pos].def[index]
}

// NewRowsWithColumnDefinition return rows with columns metadata
func NewRowsWithColumnDefinition(columns ...*Column) *Rows {
	cols := make([]string, len(columns))
	for i, column := range columns {
		cols[i] = column.Name()
	}

	return &Rows{
		cols:      cols,
		def:       columns,
		nextErr:   make(map[int]error),
		converter: driver.DefaultParameterConverter,
	}
}
