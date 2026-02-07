package sqlutil

import (
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// NewFrame creates a new data.Frame with empty fields given the columns and converters
func NewFrame(columns []string, converters ...Converter) *data.Frame {
	fields := make(data.Fields, len(converters))

	for i, v := range converters {
		fields[i] = data.NewFieldFromFieldType(v.FrameConverter.FieldType, 0)
		fields[i].Name = columns[i]
	}

	return data.NewFrame("", fields...)
}

// Append appends the row to the dataframe, using the converters to convert the scanned value into a value that can be put into a data.Frame
func Append(frame *data.Frame, row []interface{}, converters ...Converter) error {
	if len(row) != len(converters) {
		return errors.New("the number of rows must match the number of converters")
	}

	d := make([]interface{}, len(row))
	for i, v := range row {
		if converters[i].FrameConverter.ConvertWithColumn != nil {
			value, err := converters[i].FrameConverter.ConvertWithColumn(v, converters[i].colType)
			if err != nil {
				return err
			}
			d[i] = value
			continue
		}
		value, err := converters[i].FrameConverter.ConverterFunc(v)
		if err != nil {
			return err
		}
		d[i] = value
	}

	frame.AppendRow(d...)
	return nil
}
