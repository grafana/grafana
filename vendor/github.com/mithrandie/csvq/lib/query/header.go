package query

import (
	"errors"
	"strconv"
	"strings"

	"github.com/mithrandie/csvq/lib/parser"
)

const InternalIdColumn = "@__internal_id"

type HeaderField struct {
	View         string
	Identifier   string
	Column       string
	Aliases      []string
	Number       int
	IsFromTable  bool
	IsJoinColumn bool
	IsGroupKey   bool
}

var errFieldAmbiguous = errors.New("field ambiguous")
var errFieldNotExist = errors.New("field not exists")

type Header []HeaderField

func NewHeaderWithId(view string, words []string) Header {
	h := make([]HeaderField, len(words)+1)

	h[0].View = view
	h[0].Column = InternalIdColumn

	for i := 1; i <= len(words); i++ {
		h[i].View = view
		h[i].Column = words[i-1]
		h[i].Number = i
		h[i].IsFromTable = true
	}

	return h
}

func NewHeader(view string, words []string) Header {
	h := make([]HeaderField, len(words))

	for i, v := range words {
		h[i].View = view
		h[i].Column = v
		h[i].Number = i + 1
		h[i].IsFromTable = true
	}

	return h
}

func NewHeaderWithAutofill(view string, words []string) Header {
	for i, v := range words {
		if v == "" {
			words[i] = "__@" + strconv.Itoa(i+1) + "__"
		}
	}
	return NewHeader(view, words)
}

func NewEmptyHeader(len int) Header {
	return make([]HeaderField, len, len+2)
}

func AddHeaderField(h Header, identifier string, column string, alias string) (header Header, index int) {
	hfield := HeaderField{
		Identifier: identifier,
		Column:     column,
	}
	if 0 < len(alias) && !strings.EqualFold(column, alias) {
		hfield.Aliases = append(hfield.Aliases, alias)
	}

	header = append(h, hfield)
	index = header.Len() - 1
	return
}

func (h Header) Len() int {
	return len(h)
}

func (h Header) TableColumns() []parser.QueryExpression {
	columns := make([]parser.QueryExpression, 0, h.Len())
	for _, f := range h {
		if !f.IsFromTable {
			continue
		}

		fieldRef := parser.FieldReference{
			Column: parser.Identifier{Literal: f.Column},
		}
		if 0 < len(f.View) {
			fieldRef.View = parser.Identifier{Literal: f.View}
		}

		columns = append(columns, fieldRef)
	}
	return columns
}

func (h Header) TableColumnNames() []string {
	names := make([]string, 0, h.Len())
	for _, f := range h {
		if !f.IsFromTable {
			continue
		}
		names = append(names, f.Column)
	}
	return names
}

func (h Header) ContainsObject(obj parser.QueryExpression) (int, bool) {
	switch obj.(type) {
	case parser.FieldReference, parser.ColumnNumber:
		if n, err := h.SearchIndex(obj); err == nil {
			return n, true
		} else {
			return -1, false
		}
	}

	column := FormatFieldIdentifier(obj)

	idx := -1
	for i, f := range h {
		if f.IsFromTable || len(f.Identifier) < 1 {
			continue
		}

		if !strings.EqualFold(f.Identifier, column) {
			continue
		}

		idx = i
		break
	}

	if idx < 0 {
		return -1, false
	}
	return idx, true
}

func (h Header) SearchIndex(fieldRef parser.QueryExpression) (int, error) {
	if number, ok := fieldRef.(parser.ColumnNumber); ok {
		return h.FieldNumberIndex(number)
	}
	return h.FieldIndex(fieldRef.(parser.FieldReference))
}

func (h Header) FieldNumberIndex(number parser.ColumnNumber) (int, error) {
	view := number.View.Literal
	idx := int(number.Number.Raw())

	if idx < 1 {
		return -1, errFieldNotExist
	}

	for i, f := range h {
		if strings.EqualFold(f.View, view) && f.Number == idx {
			return i, nil
		}
	}
	return -1, errFieldNotExist
}

func (h Header) FieldIndex(fieldRef parser.FieldReference) (int, error) {
	var view string
	if 0 < len(fieldRef.View.Literal) {
		view = fieldRef.View.Literal
	}

	col, ok := fieldRef.Column.(parser.Identifier)
	if !ok {
		return -1, errFieldAmbiguous
	}
	column := strings.TrimSpace(col.Literal)

	idx := -1

	for i := range h {
		hcol := strings.TrimSpace(h[i].Column)
		if 0 < len(view) {
			if !strings.EqualFold(h[i].View, view) || !strings.EqualFold(hcol, column) {
				continue
			}
		} else {
			isEqual := strings.EqualFold(hcol, column)
			if isEqual && h[i].IsJoinColumn {
				idx = i
				break
			}

			if !isEqual && !InStrSliceWithCaseInsensitive(column, h[i].Aliases) {
				continue
			}
		}

		if -1 < idx {
			return -1, errFieldAmbiguous
		}
		idx = i
	}

	if idx < 0 {
		return -1, errFieldNotExist
	}

	return idx, nil
}

func (h Header) ContainsInternalId(viewName string) (int, error) {
	fieldRef := parser.FieldReference{
		View:   parser.Identifier{Literal: viewName},
		Column: parser.Identifier{Literal: InternalIdColumn},
	}
	return h.SearchIndex(fieldRef)
}

func (h Header) Update(reference string, fields []parser.QueryExpression) error {
	if fields != nil && 0 < len(fields) {
		if len(fields) != h.Len() {
			return NewFieldLengthNotMatchError(fields[0])
		}

		names := make(map[string]bool, len(fields))
		for i := range fields {
			lit := strings.ToUpper(fields[i].(parser.Identifier).Literal)
			if _, ok := names[lit]; ok {
				return NewDuplicateFieldNameError(fields[i].(parser.Identifier))
			}
			names[lit] = true
		}
	}

	for i := range h {
		h[i].View = reference
		if fields != nil && 0 < len(fields) {
			h[i].Column = fields[i].(parser.Identifier).Literal
		}
		h[i].Aliases = nil
	}
	return nil
}

func (h Header) Merge(h2 Header) Header {
	header := make(Header, len(h)+len(h2))
	leftLen := len(h)
	for i := range h {
		header[i] = h[i]
	}
	for i := range h2 {
		header[i+leftLen] = h2[i]
	}
	return header
}

func (h Header) Copy() Header {
	header := make(Header, h.Len())
	for i := range h {
		header[i] = h[i]
	}
	return header
}
