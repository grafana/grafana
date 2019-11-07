package dataframe

import (
	"fmt"
	"io"
	"time"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/array"
	"github.com/apache/arrow/go/arrow/ipc"
	"github.com/apache/arrow/go/arrow/memory"
	"github.com/mattetti/filebuffer"
)

// MarshalArrow converts the Frame to an arrow table and returns a byte
// representation of that table.
func MarshalArrow(f *Frame) ([]byte, error) {
	arrowFields, err := buildArrowFields(f)
	if err != nil {
		return nil, err
	}

	schema, err := buildArrowSchema(f, arrowFields)
	if err != nil {
		return nil, err
	}

	columns, err := buildArrowColumns(f, arrowFields)
	if err != nil {
		return nil, err
	}
	defer func(cols []array.Column) {
		for _, col := range cols {
			col.Release()
		}
	}(columns)

	// Create a table from the schema and columns.
	table := array.NewTable(schema, columns, -1)
	defer table.Release()

	tableReader := array.NewTableReader(table, -1)
	defer tableReader.Release()

	// Arrow tables with the Go API are written to files, so we create a fake
	// file buffer that the FileWriter can write to. In the future, and with
	// streaming, I think will likely be using the Arrow message type some how.
	fb := filebuffer.New(nil)

	fw, err := ipc.NewFileWriter(fb, ipc.WithSchema(tableReader.Schema()))
	if err != nil {
		return nil, err
	}

	for tableReader.Next() {
		rec := tableReader.Record()

		if err := fw.Write(rec); err != nil {
			rec.Release()
			return nil, err
		}
		rec.Release()
	}

	if err := fw.Close(); err != nil {
		return nil, err
	}

	return fb.Buff.Bytes(), nil
}

// buildArrowFields builds Arrow field definitions from a DataFrame.
func buildArrowFields(f *Frame) ([]arrow.Field, error) {
	arrowFields := make([]arrow.Field, len(f.Fields))

	for i, field := range f.Fields {
		t, err := fieldToArrow(field.Type)
		if err != nil {
			return nil, err
		}

		fieldMeta := map[string]string{
			"name": field.Name,
			"type": field.Type.String(),
		}

		arrowFields[i] = arrow.Field{
			Name:     field.Name,
			Type:     t,
			Metadata: arrow.MetadataFrom(fieldMeta),
			Nullable: true,
		}
	}

	return arrowFields, nil
}

// buildArrowColumns builds Arrow columns from a DataFrame.
func buildArrowColumns(f *Frame, arrowFields []arrow.Field) ([]array.Column, error) {
	pool := memory.NewGoAllocator()
	columns := make([]array.Column, len(f.Fields))

	for fieldIdx, field := range f.Fields {
		switch field.Type {
		case FieldTypeNumber:
			columns[fieldIdx] = *buildFloatColumn(pool, arrowFields[fieldIdx], field.Vector.(*floatVector))
		case FieldTypeTime:
			columns[fieldIdx] = *buildTimeColumn(pool, arrowFields[fieldIdx], field.Vector.(*timeVector))
		default:
			return nil, fmt.Errorf("unsupported field type: %s", field.Type)
		}
	}
	return columns, nil
}

func buildFloatColumn(pool memory.Allocator, field arrow.Field, vec *floatVector) *array.Column {
	builder := array.NewFloat64Builder(pool)
	defer builder.Release()

	for _, v := range *vec {
		if v == nil {
			builder.AppendNull()
			continue
		}
		builder.Append(*v)
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

func buildTimeColumn(pool memory.Allocator, field arrow.Field, vec *timeVector) *array.Column {
	builder := array.NewTimestampBuilder(pool, &arrow.TimestampType{
		Unit: arrow.Nanosecond,
	})
	defer builder.Release()

	for _, v := range *vec {
		if v == nil {
			builder.AppendNull()
			continue
		}
		builder.Append(arrow.Timestamp((*v).UnixNano()))
	}

	chunked := array.NewChunked(field.Type, []array.Interface{builder.NewArray()})
	defer chunked.Release()

	return array.NewColumn(field, chunked)
}

// buildArrowSchema builds an Arrow schema for a DataFrame.
func buildArrowSchema(f *Frame, fs []arrow.Field) (*arrow.Schema, error) {
	tableMetaMap := map[string]string{
		"name":  f.Name,
		"refId": f.RefID,
	}

	if f.Labels != nil {
		tableMetaMap["labels"] = f.Labels.String()
	}

	tableMeta := arrow.MetadataFrom(tableMetaMap)

	return arrow.NewSchema(fs, &tableMeta), nil
}

// fieldToArrow returns the corresponding Arrow primitive type to the fields'
// Vector primitives.
func fieldToArrow(f FieldType) (arrow.DataType, error) {
	switch f {
	case FieldTypeString:
		return &arrow.StringType{}, nil
	case FieldTypeNumber:
		return &arrow.Float64Type{}, nil
	case FieldTypeTime:
		return &arrow.TimestampType{}, nil
	default:
		return nil, fmt.Errorf("unsupported type: %s", f)
	}
}

// UnMarshalArrow converts a byte representation of an arrow table to a Frame
func UnMarshalArrow(b []byte) (*Frame, error) {
	fB := filebuffer.New(b)
	fR, err := ipc.NewFileReader(fB)
	defer fR.Close()
	if err != nil {
		return nil, err
	}
	schema := fR.Schema()
	metaData := schema.Metadata()
	frame := &Frame{}
	getMDKey := func(key string) (string, bool) {
		idx := metaData.FindKey(key)
		if idx < 0 {
			return "", false
		}
		return metaData.Values()[idx], true
	}
	frame.Name, _ = getMDKey("name") // No need to check ok, zero value ("") is returned
	frame.RefID, _ = getMDKey("refId")
	if labelsAsString, ok := getMDKey("labels"); ok {
		frame.Labels, err = LabelsFromString(labelsAsString)
		if err != nil {
			return nil, err
		}
	}
	for _, field := range schema.Fields() {
		sdkField := &Field{
			Name: field.Name,
		}
		switch field.Type.ID() {
		case arrow.FLOAT64:
			sdkField.Type = FieldTypeNumber
			sdkField.Vector = newVector(FieldTypeNumber, 0)
		case arrow.TIMESTAMP:
			sdkField.Type = FieldTypeTime
			sdkField.Vector = newVector(FieldTypeTime, 0)
		default:
			return nil, fmt.Errorf("unsupported arrow type %s for conversion", field.Type)
		}
		frame.Fields = append(frame.Fields, sdkField)
	}

	rIdx := 0
	for {
		record, err := fR.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		for i := 0; i < len(frame.Fields); i++ {
			col := record.Column(i)
			switch col.DataType().ID() {
			case arrow.FLOAT64:
				v := array.NewFloat64Data(col.Data())
				for _, f := range v.Float64Values() {
					vF := f
					frame.Fields[i].Vector.Append(&vF)
				}
			case arrow.TIMESTAMP:
				v := array.NewTimestampData(col.Data())
				for _, ts := range v.TimestampValues() {
					t := time.Unix(0, int64(ts)) // nanosecond assumption
					frame.Fields[i].Vector.Append(&t)
				}
			default:
				return nil, fmt.Errorf("unsupported arrow type %s for conversion", col.DataType().ID())
			}
		}
		rIdx++
	}

	return frame, nil
}
