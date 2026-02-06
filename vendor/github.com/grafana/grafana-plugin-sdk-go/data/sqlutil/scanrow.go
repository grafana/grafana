package sqlutil

import (
	"database/sql"
	"fmt"
	"reflect"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// ErrColumnTypeNotSupported is returned when an SQL column has a type that cannot be processed.
// This typically occurs when a database driver doesn't provide a valid scan type for a column
// or when encountering custom/exotic data types that don't have appropriate conversion handlers.
type ErrColumnTypeNotSupported struct {
	Type   string
	Column string
}

func (e ErrColumnTypeNotSupported) Error() string {
	return fmt.Sprintf("type %q is not supported (column %q)", e.Type, e.Column)
}

// A ScanRow is a container for SQL metadata for a single row.
// The row metadata is used to generate dataframe fields and a slice that can be used with sql.Scan
type ScanRow struct {
	Columns []string
	Types   []reflect.Type
}

// NewScanRow creates a new ScanRow with a length of `length`. Use the `Set` function to manually set elements at specific indices.
func NewScanRow(length int) *ScanRow {
	return &ScanRow{
		Columns: make([]string, length),
		Types:   make([]reflect.Type, length),
	}
}

// Append adds data to the end of the list of types and columns
func (s *ScanRow) Append(name string, colType reflect.Type) {
	s.Columns = append(s.Columns, name)
	s.Types = append(s.Types, colType)
}

// Set sets the internal data at i
func (s *ScanRow) Set(i int, name string, colType reflect.Type) {
	s.Columns[i] = name
	s.Types[i] = colType
}

// NewScannableRow creates a slice where each element is usable in a call to `(database/sql.Rows).Scan`
// aka a pointer
func (s *ScanRow) NewScannableRow() []interface{} {
	values := make([]interface{}, len(s.Types))

	for i, v := range s.Types {
		if v.Kind() == reflect.Ptr {
			n := reflect.New(v.Elem())
			values[i] = n.Interface()
		} else {
			values[i] = reflect.New(v).Interface()
		}
	}

	return values
}

// MakeScanRow creates a new scan row given the column types and names.
// Applicable converters will substitute the SQL scan type with the one provided by the converter.
// The list of returned converters is the same length as the SQL rows and corresponds with the rows at the same index. (e.g. value at slice element 3 corresponds with the converter at slice element 3)
// If no converter is provided for a row that has a type that does not fit into a dataframe, it is skipped.
func MakeScanRow(colTypes []*sql.ColumnType, colNames []string, converters ...Converter) (*RowConverter, error) {
	// In the future we can probably remove this restriction. But right now we map names to Arrow Field Names.
	// Arrow Field names must be unique: https://github.com/grafana/grafana-plugin-sdk-go/issues/59
	seen := map[string]int{}
	for i, name := range colNames {
		if j, ok := seen[name]; ok {
			return nil, backend.DownstreamError(fmt.Errorf(`duplicate column names are not allowed, found identical name "%v" at column indices %v and %v`, name, j, i))
		}
		seen[name] = i
	}

	rc := NewRowConverter()
	// For each column, define a concrete type in the list of values
	for i, colType := range colTypes {
		colName := colNames[i]
		colType = columnType(colType)
		nullable, ok := colType.Nullable()
		if !ok {
			nullable = true // If we don't know if it is nullable, assume it is
		}

		for _, v := range converters {
			if converterMatches(v, colType.DatabaseTypeName(), colName) {
				rc.append(colName, scanType(v, colType.ScanType()), v)
				break
			}
		}

		if !rc.hasConverter(i) {
			scanTypeValue := colType.ScanType()
			if scanTypeValue == nil {
				return nil, ErrColumnTypeNotSupported{Type: colType.DatabaseTypeName(), Column: colName}
			}
			v := NewDefaultConverter(colName, nullable, scanTypeValue)
			rc.append(colName, scanType(v, colType.ScanType()), v)
		}
	}

	return rc, nil
}

func scanType(v Converter, t reflect.Type) reflect.Type {
	if v.InputScanType != nil {
		return v.InputScanType
	}
	return t
}

type RowConverter struct {
	Row        *ScanRow
	Converters []Converter
}

func NewRowConverter() *RowConverter {
	return &RowConverter{Row: NewScanRow(0)}
}

func (r *RowConverter) append(name string, kind reflect.Type, conv Converter) {
	r.Row.Append(name, kind)
	r.Converters = append(r.Converters, conv)
}

func (r *RowConverter) hasConverter(i int) bool {
	return len(r.Converters) > i
}

func (r *RowConverter) NewScannableRow() []any {
	return r.Row.NewScannableRow()
}

func converterMatches(v Converter, dbType string, colName string) bool {
	return (v.InputColumnName == colName && v.InputColumnName != "") ||
		v.InputTypeName == dbType || (v.InputTypeRegex != nil && v.InputTypeRegex.MatchString(dbType))
}

func columnType(colType *sql.ColumnType) *sql.ColumnType {
	if colType != nil {
		return colType
	}
	return &sql.ColumnType{}
}
