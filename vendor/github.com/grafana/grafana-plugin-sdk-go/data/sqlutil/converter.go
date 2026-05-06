package sqlutil

import (
	"database/sql"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var ErrorUnexpectedTypeConversion = errors.New("conversion error")

// FrameConverter defines how to convert the scanned value into a value that can be put into a dataframe (OutputFieldType)
type FrameConverter struct {
	// FieldType is the type that is created for the dataframe field.
	// The returned value from `ConverterFunc` should match this type, otherwise the data package will panic.
	FieldType data.FieldType
	// ConverterFunc defines how to convert the scanned `InputScanType` to the supplied `FieldType`.
	// `in` is always supplied as a pointer, as it is scanned as a pointer, even if `InputScanType` is not a pointer.
	// For example, if `InputScanType` is `string`, then `in` is `*string`
	ConverterFunc func(in interface{}) (interface{}, error)
	// ConvertWithColumn is the same as ConverterFunc, but allows passing the column type
	// useful when column attributes are needed during conversion
	ConvertWithColumn func(in interface{}, col sql.ColumnType) (interface{}, error)
}

// StringConverter can be used to store types not supported by
// a Frame into a *string. When scanning, if a SQL's row's InputScanType's Kind
// and InputScanKind match that returned by the sql response, then the
// conversion func will be run on the row.
// Note, a Converter should be favored over a StringConverter as not all SQL rows can be scanned into a string.
// This type is only here for backwards compatibility.
type StringConverter struct {
	// Name is an optional property that can be used to identify a converter
	Name          string
	InputScanKind reflect.Kind // reflect.Type might better or worse option?
	InputTypeName string

	// Conversion func may be nil to do no additional operations on the string conversion.
	ConversionFunc func(in *string) (*string, error)

	// If the Replacer is not nil, the replacement will be performed.
	Replacer *StringFieldReplacer
}

// Note: StringConverter is perhaps better understood as []byte. However, currently
// the Vector type ([][]byte) is not supported. https://github.com/grafana/grafana-plugin-sdk-go/issues/57

// StringFieldReplacer is used to replace a *string Field in a Frame. The type
// returned by the ReplaceFunc must match the type of elements of VectorType.
// Both properties must be non-nil.
// Note, a Converter should be favored over a StringConverter as not all SQL rows can be scanned into a string.
// This type is only here for backwards compatibility.
type StringFieldReplacer struct {
	OutputFieldType data.FieldType
	ReplaceFunc     func(in *string) (interface{}, error)
}

// ToConverter turns this StringConverter into a Converter, using the ScanType of string
func (s StringConverter) ToConverter() Converter {
	return Converter{
		Name:           s.Name,
		InputScanType:  reflect.TypeOf(sql.NullString{}),
		InputTypeName:  s.InputTypeName,
		FrameConverter: StringFrameConverter(s),
	}
}

// StringFrameConverter creates a FrameConverter from a StringConverter
func StringFrameConverter(s StringConverter) FrameConverter {
	f := data.FieldTypeNullableString

	if s.Replacer != nil {
		f = s.Replacer.OutputFieldType
	}

	return FrameConverter{
		FieldType: f,
		ConverterFunc: func(in interface{}) (interface{}, error) {
			ns := in.(*sql.NullString)
			if !ns.Valid {
				return nil, nil
			}

			v := &ns.String
			if s.ConversionFunc != nil {
				converted, err := s.ConversionFunc(v)
				if err != nil {
					return nil, err
				}
				v = converted
			}

			if s.Replacer.ReplaceFunc != nil {
				return s.Replacer.ReplaceFunc(v)
			}

			return v, nil
		},
	}
}

// ToConverters creates a slice of Converters from a slice of StringConverters
func ToConverters(s ...StringConverter) []Converter {
	n := make([]Converter, len(s))
	for i, v := range s {
		n[i] = v.ToConverter()
	}

	return n
}

// Converter is used to convert known types returned in sql.Row to a type usable in a dataframe.
type Converter struct {
	// Name is the name of the converter that is used to distinguish them when debugging or parsing log output
	Name string

	// InputScanType is the type that is used when (*sql.Rows).Scan(...) is called.
	// Some drivers require certain data types to be used when scanning data from sql rows, and this type should reflect that.
	InputScanType reflect.Type

	// InputTypeName is the case-sensitive name that must match the type that this converter matches
	InputTypeName string

	// InputTypeRegex will be used if not nil instead of InputTypeName
	InputTypeRegex *regexp.Regexp

	// InputColumnName is the case-sensitive name that must match the column that this converter matches
	InputColumnName string

	// FrameConverter defines how to convert the scanned value into a value that can be put into a dataframe
	FrameConverter FrameConverter

	// colType is the underlying sql column type, set during scan
	colType sql.ColumnType

	// try to determine the type
	Dynamic bool
}

// DefaultConverterFunc assumes that the scanned value, in, is already a type that can be put into a dataframe.
func DefaultConverterFunc(t reflect.Type) func(in interface{}) (interface{}, error) {
	return func(in interface{}) (interface{}, error) {
		inType := reflect.TypeOf(in)
		if inType == reflect.PointerTo(t) {
			n := reflect.ValueOf(in)

			return n.Elem().Interface(), nil
		}

		return in, nil
	}
}

// NewDefaultConverter creates a Converter that assumes that the value is scannable into a String, and placed into the dataframe as a nullable string.
func NewDefaultConverter(name string, nullable bool, t reflect.Type) Converter {
	slice := reflect.MakeSlice(reflect.SliceOf(t), 0, 0).Interface()
	kind := fmt.Sprint(t)
	if !strings.HasPrefix(kind, "sql.Null") && !data.ValidFieldType(slice) {
		return Converter{
			Name:          fmt.Sprintf("[%s] String converter", t),
			InputScanType: reflect.TypeOf(sql.NullString{}),
			InputTypeName: name,
			FrameConverter: FrameConverter{
				FieldType: data.FieldTypeNullableString,
				ConverterFunc: func(in interface{}) (interface{}, error) {
					v := in.(*sql.NullString)

					if !v.Valid {
						return (*string)(nil), nil
					}

					f := v.String
					return &f, nil
				},
			},
		}
	}

	v := reflect.New(t)
	var fieldType data.FieldType
	if v.Type() == reflect.PointerTo(t) {
		v = v.Elem()
		fieldType = data.FieldTypeFor(v.Interface())
	} else {
		fieldType = data.FieldTypeFor(v.Interface()).NullableType()
	}

	if nullable {
		if converter, ok := NullConverters[t]; ok {
			return converter
		}
	}

	return Converter{
		Name:          fmt.Sprintf("Default converter for %s", name),
		InputScanType: t,
		InputTypeName: name,
		FrameConverter: FrameConverter{
			FieldType:     fieldType,
			ConverterFunc: DefaultConverterFunc(t),
		},
	}
}

var (
	// NullStringConverter creates a *string using the scan type of `sql.NullString`
	NullStringConverter = Converter{
		Name:          "nullable string converter",
		InputScanType: reflect.TypeOf(sql.NullString{}),
		InputTypeName: "STRING",
		FrameConverter: FrameConverter{
			FieldType: data.FieldTypeNullableString,
			ConverterFunc: func(n interface{}) (interface{}, error) {
				v := n.(*sql.NullString)

				if !v.Valid {
					return (*string)(nil), nil
				}

				f := v.String
				return &f, nil
			},
		},
	}

	// NullDecimalConverter creates a *float64 using the scan type of `sql.NullFloat64`
	NullDecimalConverter = Converter{
		Name:          "NULLABLE decimal converter",
		InputScanType: reflect.TypeOf(sql.NullFloat64{}),
		InputTypeName: "DOUBLE",
		FrameConverter: FrameConverter{
			FieldType: data.FieldTypeNullableFloat64,
			ConverterFunc: func(n interface{}) (interface{}, error) {
				v := n.(*sql.NullFloat64)

				if !v.Valid {
					return (*float64)(nil), nil
				}

				f := v.Float64
				return &f, nil
			},
		},
	}

	// NullInt64Converter creates a *int64 using the scan type of `sql.NullInt64`
	NullInt64Converter = Converter{
		Name:          "NULLABLE int64 converter",
		InputScanType: reflect.TypeOf(sql.NullInt64{}),
		InputTypeName: "INTEGER",
		FrameConverter: FrameConverter{
			FieldType: data.FieldTypeNullableInt64,
			ConverterFunc: func(n interface{}) (interface{}, error) {
				v := n.(*sql.NullInt64)

				if !v.Valid {
					return (*int64)(nil), nil
				}

				f := v.Int64
				return &f, nil
			},
		},
	}

	// NullInt32Converter creates a *int32 using the scan type of `sql.NullInt32`
	NullInt32Converter = Converter{
		Name:          "NULLABLE int32 converter",
		InputScanType: reflect.TypeOf(sql.NullInt32{}),
		InputTypeName: "INTEGER",
		FrameConverter: FrameConverter{
			FieldType: data.FieldTypeNullableInt32,
			ConverterFunc: func(n interface{}) (interface{}, error) {
				v := n.(*sql.NullInt32)

				if !v.Valid {
					return (*int32)(nil), nil
				}

				f := v.Int32
				return &f, nil
			},
		},
	}

	// NullInt16Converter creates a *int16 using the scan type of `sql.NullInt16`
	NullInt16Converter = Converter{
		Name:          "NULLABLE int16 converter",
		InputScanType: reflect.TypeOf(sql.NullInt16{}),
		InputTypeName: "INTEGER",
		FrameConverter: FrameConverter{
			FieldType: data.FieldTypeNullableInt16,
			ConverterFunc: func(n any) (any, error) {
				v := n.(*sql.NullInt16)

				if !v.Valid {
					return (*int16)(nil), nil
				}

				f := v.Int16
				return &f, nil
			},
		},
	}

	// NullTimeConverter creates a *time.time using the scan type of `sql.NullTime`
	NullTimeConverter = Converter{
		Name:          "NULLABLE time.Time converter",
		InputScanType: reflect.TypeOf(sql.NullTime{}),
		InputTypeName: "TIMESTAMP",
		FrameConverter: FrameConverter{
			FieldType: data.FieldTypeNullableTime,
			ConverterFunc: func(n interface{}) (interface{}, error) {
				v := n.(*sql.NullTime)

				if !v.Valid {
					return (*time.Time)(nil), nil
				}

				f := v.Time
				return &f, nil
			},
		},
	}

	// NullBoolConverter creates a *bool using the scan type of `sql.NullBool`
	NullBoolConverter = Converter{
		Name:          "nullable bool converter",
		InputScanType: reflect.TypeOf(sql.NullBool{}),
		InputTypeName: "BOOLEAN",
		FrameConverter: FrameConverter{
			FieldType: data.FieldTypeNullableBool,
			ConverterFunc: func(n interface{}) (interface{}, error) {
				v := n.(*sql.NullBool)

				if !v.Valid {
					return (*bool)(nil), nil
				}

				return &v.Bool, nil
			},
		},
	}

	// NullByteConverter creates a *string using the scan type of `sql.NullByte`
	NullByteConverter = Converter{
		Name:          "nullable byte converter",
		InputScanType: reflect.TypeOf(sql.NullByte{}),
		InputTypeName: "BYTE",
		FrameConverter: FrameConverter{
			FieldType: data.FieldTypeNullableString,
			ConverterFunc: func(n any) (any, error) {
				v := n.(*sql.NullByte)

				if !v.Valid {
					return (*string)(nil), nil
				}

				val := string(v.Byte)
				return &val, nil
			},
		},
	}
)

// NullConverters is a map of data type names (from reflect.TypeOf(...).String()) to converters
// Converters supplied here are used as defaults for fields that do not have a supplied Converter
var NullConverters = map[reflect.Type]Converter{
	reflect.TypeOf(float64(0)):        NullDecimalConverter,
	reflect.TypeOf(int64(0)):          NullInt64Converter,
	reflect.TypeOf(int32(0)):          NullInt32Converter,
	reflect.TypeOf(""):                NullStringConverter,
	reflect.TypeOf(time.Time{}):       NullTimeConverter,
	reflect.TypeOf(false):             NullBoolConverter,
	reflect.TypeOf(sql.NullFloat64{}): NullDecimalConverter,
	reflect.TypeOf(sql.NullTime{}):    NullTimeConverter,
	reflect.TypeOf(sql.NullBool{}):    NullBoolConverter,
	reflect.TypeOf(sql.NullInt64{}):   NullInt64Converter,
	reflect.TypeOf(sql.NullInt32{}):   NullInt32Converter,
	reflect.TypeOf(sql.NullInt16{}):   NullInt16Converter,
	reflect.TypeOf(sql.NullByte{}):    NullByteConverter,
	reflect.TypeOf(sql.NullString{}):  NullStringConverter,
}

// IntOrFloatToNullableFloat64 returns an error if the input is not a variation of int or float.
var IntOrFloatToNullableFloat64 = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableFloat64,
	Converter: func(v interface{}) (interface{}, error) {
		var ptr *float64
		if v == nil {
			return ptr, nil
		}

		switch val := v.(type) {
		case float64:
			return &val, nil
		case float32:
			fval := float64(val)
			return &fval, nil
		case int:
			fval := float64(val)
			return &fval, nil
		case int8:
			fval := float64(val)
			return &fval, nil
		case int16:
			fval := float64(val)
			return &fval, nil
		case int32:
			fval := float64(val)
			return &fval, nil
		case int64:
			fval := float64(val)
			return &fval, nil
		case uint:
			fval := float64(val)
			return &fval, nil
		case uint8:
			fval := float64(val)
			return &fval, nil
		case uint16:
			fval := float64(val)
			return &fval, nil
		case uint32:
			fval := float64(val)
			return &fval, nil
		case uint64:
			fval := float64(val)
			return &fval, nil
		}

		return ptr, toConversionError("int or float", v)
	},
}

// TimeToNullableTime returns an error if the input is not a time
var TimeToNullableTime = data.FieldConverter{
	OutputFieldType: data.FieldTypeNullableTime,
	Converter: func(v interface{}) (interface{}, error) {
		if v == nil {
			return nil, nil
		}
		val, ok := v.(time.Time)
		if ok {
			return &val, nil
		}
		return v, toConversionError("time", v)
	},
}

func toConversionError(expected string, v interface{}) error {
	return fmt.Errorf(`%w, expected %s input but got type %T for value "%v"`,
		ErrorUnexpectedTypeConversion, expected, v, v)
}
