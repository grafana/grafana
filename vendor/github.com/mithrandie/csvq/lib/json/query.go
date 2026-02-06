package json

import (
	"errors"
	"fmt"

	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/go-text/json"
)

func LoadValue(queryString string, jsontext string) (value.Primary, error) {
	structure, _, err := load(queryString, jsontext)
	if err != nil {
		return nil, err
	}

	return ConvertToValue(structure), nil
}

func LoadArray(queryString string, jsontext string) ([]value.Primary, error) {
	structure, _, err := load(queryString, jsontext)
	if err != nil {
		return nil, err
	}

	array, ok := structure.(json.Array)
	if !ok {
		return nil, errors.New(fmt.Sprintf("json value does not exists for %q", queryString))
	}

	return ConvertToArray(array), nil
}

func LoadTable(queryString string, jsontext string) ([]string, [][]value.Primary, json.EscapeType, error) {
	structure, et, err := load(queryString, jsontext)
	if err != nil {
		return nil, nil, et, err
	}

	array, ok := structure.(json.Array)
	if !ok {
		return nil, nil, et, errors.New(fmt.Sprintf("json value does not exists for %q", queryString))
	}

	h, rows, err := ConvertToTableValue(array)
	return h, rows, et, err
}

func load(queryString string, jsontext string) (json.Structure, json.EscapeType, error) {
	query, err := Query.Parse(queryString)
	if err != nil {
		return nil, 0, err
	}

	d := json.NewDecoder()
	d.UseInteger = false
	data, et, err := d.Decode(jsontext)
	if err != nil {
		return nil, et, err
	}

	st, err := Extract(query, data)
	return st, et, err
}

func Extract(query QueryExpression, data json.Structure) (json.Structure, error) {
	var extracted json.Structure
	var err error

	if query == nil {
		return data, nil
	}

	switch query.(type) {
	case Element:
		switch data.(type) {
		case json.Object:
			element := query.(Element)

			obj := data.(json.Object)
			if obj.Exists(element.Label) {
				if element.Child == nil {
					extracted = obj.Value(element.Label)
				} else {
					extracted, err = Extract(element.Child, obj.Value(element.Label))
				}
			} else {
				extracted = json.Null{}
			}
		default:
			extracted = json.Null{}
		}
	case ArrayItem:
		switch data.(type) {
		case json.Array:
			arrayItem := query.(ArrayItem)

			ar := data.(json.Array)
			if arrayItem.Index < len(ar) {
				if arrayItem.Child == nil {
					extracted = ar[arrayItem.Index]
				} else {
					extracted, err = Extract(arrayItem.Child, ar[arrayItem.Index])
				}
			} else {
				extracted = json.Null{}
			}
		default:
			extracted = json.Null{}
		}
	case RowValueExpr:
		switch data.(type) {
		case json.Array:
			rowValue := query.(RowValueExpr)
			if rowValue.Child == nil {
				extracted = data
			} else {
				ar := data.(json.Array)
				elems := make(json.Array, 0, len(ar))
				for _, v := range ar {
					e, err := Extract(rowValue.Child, v)
					if err != nil {
						return extracted, err
					}
					elems = append(elems, e)
				}
				extracted = elems
			}
		default:
			return extracted, errors.New("json value must be an array")
		}
	case TableExpr:
		switch data.(type) {
		case json.Object:
			table := query.(TableExpr)
			if table.Fields == nil {
				extracted = json.Array{data}
			} else {
				obj := json.NewObject(len(table.Fields))
				for _, field := range table.Fields {
					e, err := Extract(field.Element, data)
					if err != nil {
						return extracted, err
					}

					obj.Add(field.FieldLabel(), e)
				}
				extracted = json.Array{obj}
			}
		case json.Array:
			table := query.(TableExpr)
			var fields []FieldExpr

			if table.Fields != nil {
				fields = table.Fields
			}

			array := data.(json.Array)
			for _, v := range array {
				obj, ok := v.(json.Object)
				if !ok {
					return extracted, errors.New("all elements in array must be objects")
				}

				if table.Fields == nil {
					if fields == nil {
						fields = make([]FieldExpr, 0, obj.Len())
					}
					for _, members := range obj.Members {
						if !existsKeyInFields(members.Key, fields) {
							fields = append(fields, FieldExpr{Element: Element{Label: members.Key}})
						}
					}
				}
			}

			elems := make(json.Array, 0, len(array))
			for _, v := range array {
				obj := json.NewObject(len(fields))
				for _, field := range fields {
					e, err := Extract(field.Element, v)
					if err != nil {
						return extracted, err
					}

					obj.Add(field.FieldLabel(), e)
				}
				elems = append(elems, obj)
			}
			extracted = elems
		default:
			return extracted, errors.New("json value must be an array or object")
		}
	default:
		return extracted, errors.New("invalid expression")
	}

	return extracted, err
}

func existsKeyInFields(key string, list []FieldExpr) bool {
	for _, v := range list {
		if key == v.Element.Label {
			return true
		}
	}
	return false
}
