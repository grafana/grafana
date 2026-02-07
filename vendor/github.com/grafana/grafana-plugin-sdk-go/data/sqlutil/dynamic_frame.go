package sqlutil

import (
	"database/sql"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/converters"
)

const STRING = "string"

// removeDynamicConverter filters out the dynamic converter.  It is not a valid converter.
func removeDynamicConverter(converters []Converter) (bool, []Converter) {
	var filtered []Converter
	var isDynamic bool
	for _, conv := range converters {
		if conv.Dynamic {
			isDynamic = true
		} else {
			filtered = append(filtered, conv)
		}
	}
	return isDynamic, filtered
}

func findDataTypes(rows Rows, rowLimit int64, types []*sql.ColumnType) ([]Field, [][]interface{}, error) {
	var i int64
	fields := make(map[int]Field)

	var returnData [][]interface{}

	for {
		for rows.Next() {
			if i == rowLimit {
				break
			}
			row := make([]interface{}, len(types))
			for i := range row {
				row[i] = new(interface{})
			}
			err := rows.Scan(row)
			if err != nil {
				return nil, nil, err
			}

			returnData = append(returnData, row)

			if len(fields) == len(types) {
				// found all data types.  keep looping to load all the return data
				continue
			}

			for colIdx, col := range row {
				val := *col.(*interface{})
				var field Field
				colType := types[colIdx]
				switch val.(type) {
				case time.Time, *time.Time:
					field.converter = &TimeToNullableTime
					field.kind = "time"
					field.name = colType.Name()
				case float64, float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
					field.converter = &IntOrFloatToNullableFloat64
					field.kind = "float64"
					field.name = colType.Name()
				case string:
					field.converter = &converters.AnyToNullableString
					field.kind = STRING
					field.name = colType.Name()
				case []uint8:
					field.converter = &converters.Uint8ArrayToNullableString
					field.kind = STRING
					field.name = colType.Name()
				case nil:
					continue
				default:
					field.converter = &converters.AnyToNullableString
					field.kind = STRING
					field.name = colType.Name()
				}

				fields[colIdx] = field
			}

			i++
		}
		if i == rowLimit || !rows.NextResultSet() {
			break
		}
	}

	fieldList := make([]Field, len(types))
	for colIdx, col := range types {
		field, ok := fields[colIdx]
		field.name = col.Name()
		if !ok {
			field = Field{
				converter: &converters.AnyToNullableString,
				kind:      "string",
				name:      col.Name(),
			}
		}
		fieldList[colIdx] = field
	}

	return fieldList, returnData, nil
}

func frameDynamic(rows Rows, rowLimit int64, types []*sql.ColumnType, converters []Converter) (*data.Frame, error) {
	// find data type(s) from the data
	fields, rawRows, err := findDataTypes(rows, rowLimit, types)
	if err != nil {
		return nil, err
	}

	// if a converter is defined by column name, override data type that was found
	fields = overrideConverter(fields, converters)

	frameFields := make(data.Fields, len(fields))
	for i, f := range fields {
		frameFields[i] = data.NewFieldFromFieldType(f.converter.OutputFieldType, 0)
		frameFields[i].Name = f.name
	}

	frame := data.NewFrame("", frameFields...)

	for _, row := range rawRows {
		var rowData []interface{}

		for colIdx, col := range row {
			field := fields[colIdx]

			val := col
			ptr, ok := col.(*interface{})
			if ok {
				val = *ptr
			}

			val, err := field.converter.Converter(val)
			if err != nil {
				return nil, err
			}

			rowData = append(rowData, val)
		}
		frame.AppendRow(rowData...)
	}

	return frame, nil
}

// if a converter is defined by column name, override data type that was found
func overrideConverter(fields []Field, converters []Converter) []Field {
	var overrides []Field
	for _, field := range fields {
		converter := field.converter
		for _, c := range converters {
			if c.InputColumnName == field.name {
				var conv = data.FieldConverter{
					OutputFieldType: c.FrameConverter.FieldType,
					Converter:       c.FrameConverter.ConverterFunc,
				}
				converter = &conv
				break
			}
		}
		override := Field{
			name:      field.name,
			converter: converter,
			kind:      field.kind,
		}
		overrides = append(overrides, override)
	}
	return overrides
}

type Field struct {
	name      string
	converter *data.FieldConverter
	kind      string
}

type ResultSetIterator interface {
	NextResultSet() bool
}

type RowIterator interface {
	Next() bool
	Scan(dest ...interface{}) error
}

type Rows struct {
	itr RowIterator
}

func (rs Rows) NextResultSet() bool {
	if itr, has := rs.itr.(ResultSetIterator); has {
		return itr.NextResultSet()
	}
	return false
}

func (rs Rows) Next() bool {
	return rs.itr.Next()
}

func (rs Rows) Scan(dest []interface{}) error {
	return rs.itr.Scan(dest...)
}
