package query

import (
	"path/filepath"
	"strings"
	"time"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"
)

func FormatTableName(s string) string {
	if len(s) < 1 {
		return ""
	}
	return strings.TrimSuffix(filepath.Base(s), filepath.Ext(s))
}

func FormatFieldIdentifier(e parser.QueryExpression) string {
	if pt, ok := e.(parser.PrimitiveType); ok {
		prefix := "@__PT:"
		switch pt.Value.(type) {
		case *value.String:
			prefix = prefix + "S"
		case *value.Integer:
			prefix = prefix + "I"
		case *value.Float:
			prefix = prefix + "F"
		case *value.Boolean:
			prefix = prefix + "B"
		case *value.Ternary:
			prefix = prefix + "T"
		case *value.Datetime:
			prefix = prefix + "D"
		case *value.Null:
			prefix = prefix + "N"
		}
		return prefix + ":" + FormatFieldLabel(e)
	}
	if fr, ok := e.(parser.FieldReference); ok {
		if col, ok := fr.Column.(parser.Identifier); ok {
			return "@__IDENT:" + col.Literal
		}
	}
	return e.String()
}

func FormatFieldLabel(e parser.QueryExpression) string {
	if pt, ok := e.(parser.PrimitiveType); ok {
		if s, ok := pt.Value.(*value.String); ok {
			return s.Raw()
		}
		if dt, ok := pt.Value.(*value.Datetime); ok {
			return dt.Format(time.RFC3339Nano)
		}
		return pt.Value.String()
	}
	if fr, ok := e.(parser.FieldReference); ok {
		if col, ok := fr.Column.(parser.Identifier); ok {
			return col.Literal
		}
	}
	return e.String()
}
