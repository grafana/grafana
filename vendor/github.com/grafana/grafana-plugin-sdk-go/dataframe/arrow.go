package dataframe

import (
	"encoding/json"
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

		fieldMeta := map[string]string{"name": field.Name}

		if field.Labels != nil {
			if fieldMeta["labels"], err = toJSONString(field.Labels); err != nil {
				return nil, err
			}
		}

		if field.Config != nil {
			str, err := toJSONString(field.Config)
			if err != nil {
				return nil, err
			}
			fieldMeta["config"] = str
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

		case *int8Vector:
			columns[fieldIdx] = *buildInt8Column(pool, arrowFields[fieldIdx], v)
		case *nullableInt8Vector:
			columns[fieldIdx] = *buildNullableInt8Column(pool, arrowFields[fieldIdx], v)

		case *int16Vector:
			columns[fieldIdx] = *buildInt16Column(pool, arrowFields[fieldIdx], v)
		case *nullableInt16Vector:
			columns[fieldIdx] = *buildNullableInt16Column(pool, arrowFields[fieldIdx], v)

		case *int32Vector:
			columns[fieldIdx] = *buildInt32Column(pool, arrowFields[fieldIdx], v)
		case *nullableInt32Vector:
			columns[fieldIdx] = *buildNullableInt32Column(pool, arrowFields[fieldIdx], v)

		case *int64Vector:
			columns[fieldIdx] = *buildInt64Column(pool, arrowFields[fieldIdx], v)
		case *nullableInt64Vector:
			columns[fieldIdx] = *buildNullableInt64Column(pool, arrowFields[fieldIdx], v)

		case *uint8Vector:
			columns[fieldIdx] = *buildUInt8Column(pool, arrowFields[fieldIdx], v)
		case *nullableUint8Vector:
			columns[fieldIdx] = *buildNullableUInt8Column(pool, arrowFields[fieldIdx], v)

		case *uint16Vector:
			columns[fieldIdx] = *buildUInt16Column(pool, arrowFields[fieldIdx], v)
		case *nullableUint16Vector:
			columns[fieldIdx] = *buildNullableUInt16Column(pool, arrowFields[fieldIdx], v)

		case *uint32Vector:
			columns[fieldIdx] = *buildUInt32Column(pool, arrowFields[fieldIdx], v)
		case *nullableUint32Vector:
			columns[fieldIdx] = *buildNullableUInt32Column(pool, arrowFields[fieldIdx], v)

		case *uint64Vector:
			columns[fieldIdx] = *buildUInt64Column(pool, arrowFields[fieldIdx], v)
		case *nullableUint64Vector:
			columns[fieldIdx] = *buildNullableUInt64Column(pool, arrowFields[fieldIdx], v)

		case *stringVector:
			columns[fieldIdx] = *buildStringColumn(pool, arrowFields[fieldIdx], v)
		case *nullableStringVector:
			columns[fieldIdx] = *buildNullableStringColumn(pool, arrowFields[fieldIdx], v)

		case *float32Vector:
			columns[fieldIdx] = *buildFloat32Column(pool, arrowFields[fieldIdx], v)
		case *nullableFloat32Vector:
			columns[fieldIdx] = *buildNullableFloat32Column(pool, arrowFields[fieldIdx], v)

		case *float64Vector:
			columns[fieldIdx] = *buildFloat64Column(pool, arrowFields[fieldIdx], v)
		case *nullableFloat64Vector:
			columns[fieldIdx] = *buildNullableFloat64Column(pool, arrowFields[fieldIdx], v)

		case *boolVector:
			columns[fieldIdx] = *buildBoolColumn(pool, arrowFields[fieldIdx], v)
		case *nullableBoolVector:
			columns[fieldIdx] = *buildNullableBoolColumn(pool, arrowFields[fieldIdx], v)

		case *timeTimeVector:
			columns[fieldIdx] = *buildTimeColumn(pool, arrowFields[fieldIdx], v)
		case *nullableTimeTimeVector:
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
	if f.Meta != nil {
		str, err := toJSONString(f.Meta)
		if err != nil {
			return nil, err
		}
		tableMetaMap["meta"] = str
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

	// Ints
	case *int8Vector:
		return &arrow.Int8Type{}, false, nil
	case *nullableInt8Vector:
		return &arrow.Int8Type{}, true, nil

	case *int16Vector:
		return &arrow.Int16Type{}, false, nil
	case *nullableInt16Vector:
		return &arrow.Int16Type{}, true, nil

	case *int32Vector:
		return &arrow.Int32Type{}, false, nil
	case *nullableInt32Vector:
		return &arrow.Int32Type{}, true, nil

	case *int64Vector:
		return &arrow.Int64Type{}, false, nil
	case *nullableInt64Vector:
		return &arrow.Int64Type{}, true, nil

	// Uints
	case *uint8Vector:
		return &arrow.Uint8Type{}, false, nil
	case *nullableUint8Vector:
		return &arrow.Uint8Type{}, true, nil

	case *uint16Vector:
		return &arrow.Uint16Type{}, false, nil
	case *nullableUint16Vector:
		return &arrow.Uint16Type{}, true, nil

	case *uint32Vector:
		return &arrow.Uint32Type{}, false, nil
	case *nullableUint32Vector:
		return &arrow.Uint32Type{}, true, nil

	case *uint64Vector:
		return &arrow.Uint64Type{}, false, nil
	case *nullableUint64Vector:
		return &arrow.Uint64Type{}, true, nil

	case *float32Vector:
		return &arrow.Float32Type{}, false, nil
	case *nullableFloat32Vector:
		return &arrow.Float32Type{}, true, nil

	case *float64Vector:
		return &arrow.Float64Type{}, false, nil
	case *nullableFloat64Vector:
		return &arrow.Float64Type{}, true, nil

	case *boolVector:
		return &arrow.BooleanType{}, false, nil
	case *nullableBoolVector:
		return &arrow.BooleanType{}, true, nil

	case *timeTimeVector:
		return &arrow.TimestampType{}, false, nil
	case *nullableTimeTimeVector:
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
			if err := json.Unmarshal([]byte(labelsAsString), &sdkField.Labels); err != nil {
				return nil, err
			}
		}
		if configAsString, ok := getMDKey("config", field.Metadata); ok {
			if err := json.Unmarshal([]byte(configAsString), &sdkField.Config); err != nil {
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
		case arrow.INT8:
			if nullable[idx] {
				sdkField.Vector = newNullableInt8Vector(0)
				break
			}
			sdkField.Vector = newInt8Vector(0)
		case arrow.INT16:
			if nullable[idx] {
				sdkField.Vector = newNullableInt16Vector(0)
				break
			}
			sdkField.Vector = newInt16Vector(0)
		case arrow.INT32:
			if nullable[idx] {
				sdkField.Vector = newNullableInt32Vector(0)
				break
			}
			sdkField.Vector = newInt32Vector(0)
		case arrow.INT64:
			if nullable[idx] {
				sdkField.Vector = newNullableInt64Vector(0)
				break
			}
			sdkField.Vector = newInt64Vector(0)
		case arrow.UINT8:
			if nullable[idx] {
				sdkField.Vector = newNullableUint8Vector(0)
				break
			}
			sdkField.Vector = newUint8Vector(0)
		case arrow.UINT16:
			if nullable[idx] {
				sdkField.Vector = newNullableUint16Vector(0)
				break
			}
			sdkField.Vector = newUint16Vector(0)
		case arrow.UINT32:
			if nullable[idx] {
				sdkField.Vector = newNullableUint32Vector(0)
				break
			}
			sdkField.Vector = newUint32Vector(0)
		case arrow.UINT64:
			if nullable[idx] {
				sdkField.Vector = newNullableUint64Vector(0)
				break
			}
			sdkField.Vector = newUint64Vector(0)
		case arrow.FLOAT32:
			if nullable[idx] {
				sdkField.Vector = newNullableFloat32Vector(0)
				break
			}
			sdkField.Vector = newFloat32Vector(0)
		case arrow.FLOAT64:
			if nullable[idx] {
				sdkField.Vector = newNullableFloat64Vector(0)
				break
			}
			sdkField.Vector = newFloat64Vector(0)
		case arrow.BOOL:
			if nullable[idx] {
				sdkField.Vector = newNullableBoolVector(0)
				break
			}
			sdkField.Vector = newBoolVector(0)
		case arrow.TIMESTAMP:
			if nullable[idx] {
				sdkField.Vector = newNullableTimeTimeVector(0)
				break
			}
			sdkField.Vector = newTimeTimeVector(0)
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
			case arrow.INT8:
				v := array.NewInt8Data(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *int8
							frame.Fields[i].Vector.Append(ns)
							continue
						}
						rv := v.Value(rIdx)
						frame.Fields[i].Vector.Append(&rv)
						continue
					}
					frame.Fields[i].Vector.Append(v.Value(rIdx))
				}
			case arrow.INT16:
				v := array.NewInt16Data(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *int16
							frame.Fields[i].Vector.Append(ns)
							continue
						}
						rv := v.Value(rIdx)
						frame.Fields[i].Vector.Append(&rv)
						continue
					}
					frame.Fields[i].Vector.Append(v.Value(rIdx))
				}
			case arrow.INT32:
				v := array.NewInt32Data(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *int32
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
			case arrow.UINT8:
				v := array.NewUint8Data(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *uint8
							frame.Fields[i].Vector.Append(ns)
							continue
						}
						rv := v.Value(rIdx)
						frame.Fields[i].Vector.Append(&rv)
						continue
					}
					frame.Fields[i].Vector.Append(v.Value(rIdx))
				}
			case arrow.UINT32:
				v := array.NewUint32Data(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *uint32
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
			case arrow.UINT16:
				v := array.NewUint16Data(col.Data())
				for rIdx := 0; rIdx < col.Len(); rIdx++ {
					if nullable[i] {
						if v.IsNull(rIdx) {
							var ns *uint16
							frame.Fields[i].Vector.Append(ns)
							continue
						}
						rv := v.Value(rIdx)
						frame.Fields[i].Vector.Append(&rv)
						continue
					}
					frame.Fields[i].Vector.Append(v.Value(rIdx))
				}
			case arrow.FLOAT32:
				v := array.NewFloat32Data(col.Data())
				for vIdx, f := range v.Float32Values() {
					if nullable[i] {
						if v.IsNull(vIdx) {
							var nf *float32
							frame.Fields[i].Vector.Append(nf)
							continue
						}
						vF := f
						frame.Fields[i].Vector.Append(&vF)
						continue
					}
					frame.Fields[i].Vector.Append(f)
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

	if metaAsString, ok := getMDKey("meta", metaData); ok {
		var err error
		frame.Meta, err = QueryResultMetaFromJSON(metaAsString)
		if err != nil {
			return nil, err
		}
	}

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

// ToJSONString calls json.Marshal on val and returns it as a string. An
// error is returned if json.Marshal errors.
func toJSONString(val interface{}) (string, error) {
	b, err := json.Marshal(val)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
