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
		t, nullable, err := fieldToArrow(field)
		if err != nil {
			return nil, err
		}

		fieldMeta := map[string]string{
			"name":   field.Name,
			"labels": field.Labels.String(),
		}

		arrowFields[i] = arrow.Field{
			Name:     field.Name,
			Type:     t,
			Metadata: arrow.MetadataFrom(fieldMeta),
			Nullable: nullable,
		}
	}

	return arrowFields, nil
}

// buildArrowColumns builds Arrow columns from a DataFrame.
func buildArrowColumns(f *Frame, arrowFields []arrow.Field) ([]array.Column, error) {
	pool := memory.NewGoAllocator()
	columns := make([]array.Column, len(f.Fields))

	for fieldIdx, field := range f.Fields {
		switch v := field.Vector.(type) {

		case *intVector:
			columns[fieldIdx] = *buildIntColumn(pool, arrowFields[fieldIdx], v)
		case *nullableIntVector:
			columns[fieldIdx] = *buildNullableIntColumn(pool, arrowFields[fieldIdx], v)

		case *uintVector:
			columns[fieldIdx] = *buildUIntColumn(pool, arrowFields[fieldIdx], v)
		case *nullableUintVector:
			columns[fieldIdx] = *buildNullableUIntColumn(pool, arrowFields[fieldIdx], v)

		case *stringVector:
			columns[fieldIdx] = *buildStringColumn(pool, arrowFields[fieldIdx], v)
		case *nullableStringVector:
			columns[fieldIdx] = *buildNullableStringColumn(pool, arrowFields[fieldIdx], v)

		case *floatVector:
			columns[fieldIdx] = *buildFloatColumn(pool, arrowFields[fieldIdx], v)
		case *nullableFloatVector:
			columns[fieldIdx] = *buildNullableFloatColumn(pool, arrowFields[fieldIdx], v)

		case *boolVector:
			columns[fieldIdx] = *buildBoolColumn(pool, arrowFields[fieldIdx], v)
		case *nullableBoolVector:
			columns[fieldIdx] = *buildNullableBoolColumn(pool, arrowFields[fieldIdx], v)

		case *timeVector:
			columns[fieldIdx] = *buildTimeColumn(pool, arrowFields[fieldIdx], v)
		case *nullableTimeVector:
			columns[fieldIdx] = *buildNullableTimeColumn(pool, arrowFields[fieldIdx], v)

		default:
			return nil, fmt.Errorf("unsupported field vector type for conversion to arrow: %T", v)
		}
	}
	return columns, nil
}

// buildArrowSchema builds an Arrow schema for a DataFrame.
func buildArrowSchema(f *Frame, fs []arrow.Field) (*arrow.Schema, error) {
	tableMetaMap := map[string]string{
		"name":  f.Name,
		"refId": f.RefID,
	}

	tableMeta := arrow.MetadataFrom(tableMetaMap)

	return arrow.NewSchema(fs, &tableMeta), nil
}

// fieldToArrow returns the corresponding Arrow primitive type and nullable property to the fields'
// Vector primitives.
func fieldToArrow(f *Field) (arrow.DataType, bool, error) {
	switch f.Vector.(type) {

	case *stringVector:
		return &arrow.StringType{}, false, nil
	case *nullableStringVector:
		return &arrow.StringType{}, true, nil

	case *intVector:
		return &arrow.Int64Type{}, false, nil
	case *nullableIntVector:
		return &arrow.Int64Type{}, true, nil

	case *uintVector:
		return &arrow.Uint64Type{}, false, nil
	case *nullableUintVector:
		return &arrow.Uint64Type{}, true, nil

	case *floatVector:
		return &arrow.Float64Type{}, false, nil
	case *nullableFloatVector:
		return &arrow.Float64Type{}, true, nil

	case *boolVector:
		return &arrow.BooleanType{}, false, nil
	case *nullableBoolVector:
		return &arrow.BooleanType{}, true, nil

	case *timeVector:
		return &arrow.TimestampType{}, false, nil
	case *nullableTimeVector:
		return &arrow.TimestampType{}, true, nil

	default:
		return nil, false, fmt.Errorf("unsupported type for conversion to arrow: %T", f.Vector)
	}
}

func getMDKey(key string, metaData arrow.Metadata) (string, bool) {
	idx := metaData.FindKey(key)
	if idx < 0 {
		return "", false
	}
	return metaData.Values()[idx], true
}

func initializeFrameFields(schema *arrow.Schema, frame *Frame) ([]bool, error) {
	nullable := make([]bool, len(schema.Fields()))
	for idx, field := range schema.Fields() {
		sdkField := &Field{
			Name: field.Name,
		}
		if labelsAsString, ok := getMDKey("labels", field.Metadata); ok {
			var err error
			sdkField.Labels, err = LabelsFromString(labelsAsString)
			if err != nil {
				return nil, err
			}
		}
		nullable[idx] = field.Nullable
		switch field.Type.ID() {
		case arrow.STRING:
			if nullable[idx] {
				sdkField.Vector = newNullableStringVector(0)
				break
			}
			sdkField.Vector = newStringVector(0)
		case arrow.INT64:
			if nullable[idx] {
				sdkField.Vector = newNullableIntVector(0)
				break
			}
			sdkField.Vector = newIntVector(0)
		case arrow.UINT64:
			if nullable[idx] {
				sdkField.Vector = newNullableUintVector(0)
				break
			}
			sdkField.Vector = newUintVector(0)
		case arrow.FLOAT64:
			if nullable[idx] {
				sdkField.Vector = newNullableFloatVector(0)
				break
			}
			sdkField.Vector = newFloatVector(0)
		case arrow.BOOL:
			if nullable[idx] {
				sdkField.Vector = newNullableBoolVector(0)
				break
			}
			sdkField.Vector = newBoolVector(0)
		case arrow.TIMESTAMP:
			if nullable[idx] {
				sdkField.Vector = newNullableTimeVector(0)
				break
			}
			sdkField.Vector = newTimeVector(0)
		default:
			return nullable, fmt.Errorf("unsupported conversion from arrow to sdk type for arrow type %v", field.Type.ID().String())
		}
		frame.Fields = append(frame.Fields, sdkField)
	}
	return nullable, nil
}

func populateFrameFields(fR *ipc.FileReader, nullable []bool, frame *Frame) error {
	for {
		record, err := fR.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		for i := 0; i < len(frame.Fields); i++ {
			col := record.Column(i)
			switch col.DataType().ID() {
			case arrow.STRING:
				v := array.NewStringData(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *string
							frame.Fields[i].Vector.Append(ns)
							continue
						}
						rv := v.Value(rIdx)
						frame.Fields[i].Vector.Append(&rv)
						continue
					}
					frame.Fields[i].Vector.Append(v.Value(rIdx))
				}
			case arrow.INT64:
				v := array.NewInt64Data(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *int64
							frame.Fields[i].Vector.Append(ns)
							continue
						}
						rv := v.Value(rIdx)
						frame.Fields[i].Vector.Append(&rv)
						continue
					}
					frame.Fields[i].Vector.Append(v.Value(rIdx))
				}
			case arrow.UINT64:
				v := array.NewUint64Data(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *uint64
							frame.Fields[i].Vector.Append(ns)
							continue
						}
						rv := v.Value(rIdx)
						frame.Fields[i].Vector.Append(&rv)
						continue
					}
					frame.Fields[i].Vector.Append(v.Value(rIdx))
				}
			case arrow.FLOAT64:
				v := array.NewFloat64Data(col.Data())
				for vIdx, f := range v.Float64Values() {
					if nullable[i] {
						if v.IsNull(vIdx) {
							var nf *float64
							frame.Fields[i].Vector.Append(nf)
							continue
						}
						vF := f
						frame.Fields[i].Vector.Append(&vF)
						continue
					}
					frame.Fields[i].Vector.Append(f)
				}
			case arrow.BOOL:
				v := array.NewBooleanData(col.Data())
				for sIdx := 0; sIdx < col.Len(); sIdx++ {
					if nullable[i] {
						if v.IsNull(sIdx) {
							var ns *bool
							frame.Fields[i].Vector.Append(ns)
							continue
						}
						vB := v.Value(sIdx)
						frame.Fields[i].Vector.Append(&vB)
						continue
					}
					frame.Fields[i].Vector.Append(v.Value(sIdx))
				}
			case arrow.TIMESTAMP:
				v := array.NewTimestampData(col.Data())
				for vIdx, ts := range v.TimestampValues() {
					t := time.Unix(0, int64(ts)) // nanosecond assumption
					if nullable[i] {
						if v.IsNull(vIdx) {
							var nt *time.Time
							frame.Fields[i].Vector.Append(nt)
							continue
						}
						frame.Fields[i].Vector.Append(&t)
						continue
					}
					frame.Fields[i].Vector.Append(t)
				}
			default:
				return fmt.Errorf("unsupported arrow type %s for conversion", col.DataType().ID())
			}
		}
	}
	return nil
}

// UnmarshalArrow converts a byte representation of an arrow table to a Frame
func UnmarshalArrow(b []byte) (*Frame, error) {
	fB := filebuffer.New(b)
	fR, err := ipc.NewFileReader(fB)
	if err != nil {
		return nil, err
	}
	defer fR.Close()

	schema := fR.Schema()
	metaData := schema.Metadata()
	frame := &Frame{}
	frame.Name, _ = getMDKey("name", metaData) // No need to check ok, zero value ("") is returned
	frame.RefID, _ = getMDKey("refId", metaData)
	nullable, err := initializeFrameFields(schema, frame)
	if err != nil {
		return nil, err
	}

	err = populateFrameFields(fR, nullable, frame)
	if err != nil {
		return nil, err
	}
	return frame, nil
}
