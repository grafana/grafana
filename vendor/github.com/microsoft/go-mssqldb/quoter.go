package mssql

import (
	"strings"
)

// TSQLQuoter implements sqlexp.Quoter
type TSQLQuoter struct {
}

// ID quotes identifiers such as schema, table, or column names.
// This implementation handles multi-part names.
func (TSQLQuoter) ID(name string) string {
	return "[" + strings.Replace(name, "]", "]]", -1) + "]"
}

// Value quotes database values such as string or []byte types as strings
// that are suitable and safe to embed in SQL text. The returned value
// of a string will include all surrounding quotes.
//
// If a value type is not supported it must panic.
func (TSQLQuoter) Value(v interface{}) string {
	switch v := v.(type) {
	default:
		panic("unsupported value")

	case string:
		return sqlString(v)
	case VarChar:
		return sqlString(string(v))
	case VarCharMax:
		return sqlString(string(v))
	case NVarCharMax:
		return sqlString(string(v))
	}
}

func sqlString(v string) string {
	return "'" + strings.Replace(string(v), "'", "''", -1) + "'"
}
