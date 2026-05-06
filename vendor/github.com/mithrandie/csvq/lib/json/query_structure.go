package json

import (
	"strconv"
)

type QueryExpression interface{}

type Element struct {
	Label string
	Child QueryExpression
}

func (e Element) FieldLabel() string {
	label := EscapeIdentifier(e.Label)

	if e.Child != nil {
		switch e.Child.(type) {
		case Element:
			label = label + string(PathSeparator) + e.Child.(Element).FieldLabel()
		case ArrayItem:
			label = label + e.Child.(ArrayItem).FieldLabel()
		}
	}
	return label
}

type ArrayItem struct {
	Index int
	Child QueryExpression
}

func (e ArrayItem) FieldLabel() string {
	label := "[" + strconv.Itoa(e.Index) + "]"
	if e.Child != nil {
		switch e.Child.(type) {
		case Element:
			label = label + string(PathSeparator) + e.Child.(Element).FieldLabel()
		case ArrayItem:
			label = label + e.Child.(ArrayItem).FieldLabel()
		}
	}
	return label
}

type RowValueExpr struct {
	Child QueryExpression
}

type TableExpr struct {
	Fields []FieldExpr
}

type FieldExpr struct {
	Element Element
	Alias   string
}

func (e FieldExpr) FieldLabel() string {
	var label string

	if 0 < len(e.Alias) {
		label = e.Alias
	} else {
		label = e.Element.FieldLabel()
	}

	return label
}

func EscapeIdentifier(s string) string {
	escaped := make([]rune, 0, len(s)+10)
	runes := []rune(s)

	for _, r := range runes {
		switch r {
		case PathSeparator, PathEscape:
			escaped = append(escaped, PathEscape, r)
		default:
			escaped = append(escaped, r)
		}
	}

	return string(escaped)
}
