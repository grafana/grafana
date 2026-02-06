package json

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/mithrandie/go-text/json"

	"github.com/mithrandie/csvq/lib/value"
	"github.com/mithrandie/ternary"
)

func ConvertToValue(structure json.Structure) value.Primary {
	var p value.Primary

	switch structure.(type) {
	case json.Number:
		p = value.NewFloat(structure.(json.Number).Raw())
	case json.Integer:
		p = value.NewInteger(structure.(json.Integer).Raw())
	case json.String:
		p = value.NewString(structure.(json.String).Raw())
	case json.Boolean:
		p = value.NewBoolean(structure.(json.Boolean).Raw())
	case json.Null:
		p = value.NewNull()
	default:
		p = value.NewString(structure.Encode())
	}

	return p
}

func ConvertToArray(array json.Array) []value.Primary {
	row := make([]value.Primary, 0, len(array))
	for _, v := range array {
		row = append(row, ConvertToValue(v))
	}

	return row
}

func ConvertToTableValue(array json.Array) ([]string, [][]value.Primary, error) {
	exists := func(s string, list []string) bool {
		for _, v := range list {
			if s == v {
				return true
			}
		}
		return false
	}

	var header []string
	for _, elem := range array {
		obj, ok := elem.(json.Object)
		if !ok {
			return nil, nil, errors.New("rows loaded from json must be objects")
		}
		if header == nil {
			header = make([]string, 0, obj.Len())
		}

		for _, m := range obj.Members {
			if !exists(m.Key, header) {
				header = append(header, m.Key)
			}
		}
	}

	rows := make([][]value.Primary, 0, len(array))
	for _, elem := range array {
		row := make([]value.Primary, 0, len(header))

		obj, _ := elem.(json.Object)
		for _, column := range header {
			if obj.Exists(column) {
				row = append(row, ConvertToValue(obj.Value(column)))
			} else {
				row = append(row, ConvertToValue(json.Null{}))
			}
		}

		rows = append(rows, row)
	}

	return header, rows, nil
}

func ConvertTableValueToJsonStructure(ctx context.Context, fields []string, rows [][]value.Primary) (json.Structure, error) {
	pathes, err := ParsePathes(fields)
	if err != nil {
		return nil, err
	}

	structure := make(json.Array, len(rows))
	for i := range rows {
		if i&15 == 0 && ctx.Err() != nil {
			return nil, ctx.Err()
		}

		rowStructure, err := ConvertRecordValueToJsonStructure(pathes, rows[i])
		if err != nil {
			return nil, err
		}
		structure[i] = rowStructure
	}

	return structure, nil
}

func ParsePathes(fields []string) ([]PathExpression, error) {
	var err error
	pathes := make([]PathExpression, len(fields))
	for i, field := range fields {
		pathes[i], err = Path.Parse(field)
		if err != nil {
			if perr, ok := err.(*PathSyntaxError); ok {
				err = errors.New(fmt.Sprintf("%s at column %d in %q", perr.Error(), perr.Column, field))
			}
			return nil, err
		}
	}
	return pathes, nil
}

func ConvertRecordValueToJsonStructure(pathes []PathExpression, row []value.Primary) (json.Structure, error) {
	var structure json.Structure

	fieldLen := len(pathes)

	if len(row) != fieldLen {
		return nil, errors.New("field length does not match")
	}

	for i, path := range pathes {
		structure = addPathValueToRowStructure(structure, path.(ObjectPath), row[i], fieldLen)
	}

	return structure, nil
}

func addPathValueToRowStructure(parent json.Structure, path ObjectPath, val value.Primary, fieldLen int) json.Structure {
	var obj json.Object
	if parent == nil {
		obj = json.NewObject(fieldLen)
	} else {
		obj = parent.(json.Object)
	}

	if path.Child == nil {
		obj.Add(path.Name, ParseValueToStructure(val))
	} else {
		valueStructure := addPathValueToRowStructure(obj.Value(path.Name), path.Child.(ObjectPath), val, fieldLen)
		if obj.Exists(path.Name) {
			obj.Update(path.Name, valueStructure)
		} else {
			obj.Add(path.Name, valueStructure)
		}
	}

	return obj
}

func ParseValueToStructure(val value.Primary) json.Structure {
	var s json.Structure

	switch val.(type) {
	case *value.String:
		s = json.String(val.(*value.String).Raw())
	case *value.Integer:
		s = json.Integer(val.(*value.Integer).Raw())
	case *value.Float:
		s = json.Float(val.(*value.Float).Raw())
	case *value.Boolean:
		s = json.Boolean(val.(*value.Boolean).Raw())
	case *value.Ternary:
		t := val.(*value.Ternary)
		if t.Ternary() == ternary.UNKNOWN {
			s = json.Null{}
		} else {
			s = json.Boolean(t.Ternary().ParseBool())
		}
	case *value.Datetime:
		s = json.String(val.(*value.Datetime).Format(time.RFC3339Nano))
	case *value.Null:
		s = json.Null{}
	}

	return s
}
