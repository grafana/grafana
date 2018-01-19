// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bigquery

import (
	"encoding/base64"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"time"

	"cloud.google.com/go/civil"

	bq "google.golang.org/api/bigquery/v2"
)

// Value stores the contents of a single cell from a BigQuery result.
type Value interface{}

// ValueLoader stores a slice of Values representing a result row from a Read operation.
// See RowIterator.Next for more information.
type ValueLoader interface {
	Load(v []Value, s Schema) error
}

// valueList converts a []Value to implement ValueLoader.
type valueList []Value

// Load stores a sequence of values in a valueList.
// It resets the slice length to zero, then appends each value to it.
func (vs *valueList) Load(v []Value, _ Schema) error {
	*vs = append((*vs)[:0], v...)
	return nil
}

// valueMap converts a map[string]Value to implement ValueLoader.
type valueMap map[string]Value

// Load stores a sequence of values in a valueMap.
func (vm *valueMap) Load(v []Value, s Schema) error {
	if *vm == nil {
		*vm = map[string]Value{}
	}
	loadMap(*vm, v, s)
	return nil
}

func loadMap(m map[string]Value, vals []Value, s Schema) {
	for i, f := range s {
		val := vals[i]
		var v interface{}
		switch {
		case f.Schema == nil:
			v = val
		case !f.Repeated:
			m2 := map[string]Value{}
			loadMap(m2, val.([]Value), f.Schema)
			v = m2
		default: // repeated and nested
			sval := val.([]Value)
			vs := make([]Value, len(sval))
			for j, e := range sval {
				m2 := map[string]Value{}
				loadMap(m2, e.([]Value), f.Schema)
				vs[j] = m2
			}
			v = vs
		}
		m[f.Name] = v
	}
}

type structLoader struct {
	typ reflect.Type // type of struct
	err error
	ops []structLoaderOp

	vstructp reflect.Value // pointer to current struct value; changed by set
}

// A setFunc is a function that sets a struct field or slice/array
// element to a value.
type setFunc func(v reflect.Value, val interface{}) error

// A structLoaderOp instructs the loader to set a struct field to a row value.
type structLoaderOp struct {
	fieldIndex []int
	valueIndex int
	setFunc    setFunc
	repeated   bool
}

var errNoNulls = errors.New("bigquery: NULL values cannot be read into structs")

func setAny(v reflect.Value, x interface{}) error {
	if x == nil {
		return errNoNulls
	}
	v.Set(reflect.ValueOf(x))
	return nil
}

func setInt(v reflect.Value, x interface{}) error {
	if x == nil {
		return errNoNulls
	}
	xx := x.(int64)
	if v.OverflowInt(xx) {
		return fmt.Errorf("bigquery: value %v overflows struct field of type %v", xx, v.Type())
	}
	v.SetInt(xx)
	return nil
}

func setFloat(v reflect.Value, x interface{}) error {
	if x == nil {
		return errNoNulls
	}
	xx := x.(float64)
	if v.OverflowFloat(xx) {
		return fmt.Errorf("bigquery: value %v overflows struct field of type %v", xx, v.Type())
	}
	v.SetFloat(xx)
	return nil
}

func setBool(v reflect.Value, x interface{}) error {
	if x == nil {
		return errNoNulls
	}
	v.SetBool(x.(bool))
	return nil
}

func setString(v reflect.Value, x interface{}) error {
	if x == nil {
		return errNoNulls
	}
	v.SetString(x.(string))
	return nil
}

func setBytes(v reflect.Value, x interface{}) error {
	if x == nil {
		return errNoNulls
	}
	v.SetBytes(x.([]byte))
	return nil
}

// set remembers a value for the next call to Load. The value must be
// a pointer to a struct. (This is checked in RowIterator.Next.)
func (sl *structLoader) set(structp interface{}, schema Schema) error {
	if sl.err != nil {
		return sl.err
	}
	sl.vstructp = reflect.ValueOf(structp)
	typ := sl.vstructp.Type().Elem()
	if sl.typ == nil {
		// First call: remember the type and compile the schema.
		sl.typ = typ
		ops, err := compileToOps(typ, schema)
		if err != nil {
			sl.err = err
			return err
		}
		sl.ops = ops
	} else if sl.typ != typ {
		return fmt.Errorf("bigquery: struct type changed from %s to %s", sl.typ, typ)
	}
	return nil
}

// compileToOps produces a sequence of operations that will set the fields of a
// value of structType to the contents of a row with schema.
func compileToOps(structType reflect.Type, schema Schema) ([]structLoaderOp, error) {
	var ops []structLoaderOp
	fields, err := fieldCache.Fields(structType)
	if err != nil {
		return nil, err
	}
	for i, schemaField := range schema {
		// Look for an exported struct field with the same name as the schema
		// field, ignoring case (BigQuery column names are case-insensitive,
		// and we want to act like encoding/json anyway).
		structField := fields.Match(schemaField.Name)
		if structField == nil {
			// Ignore schema fields with no corresponding struct field.
			continue
		}
		op := structLoaderOp{
			fieldIndex: structField.Index,
			valueIndex: i,
		}
		t := structField.Type
		if schemaField.Repeated {
			if t.Kind() != reflect.Slice && t.Kind() != reflect.Array {
				return nil, fmt.Errorf("bigquery: repeated schema field %s requires slice or array, but struct field %s has type %s",
					schemaField.Name, structField.Name, t)
			}
			t = t.Elem()
			op.repeated = true
		}
		if schemaField.Type == RecordFieldType {
			// Field can be a struct or a pointer to a struct.
			if t.Kind() == reflect.Ptr {
				t = t.Elem()
			}
			if t.Kind() != reflect.Struct {
				return nil, fmt.Errorf("bigquery: field %s has type %s, expected struct or *struct",
					structField.Name, structField.Type)
			}
			nested, err := compileToOps(t, schemaField.Schema)
			if err != nil {
				return nil, err
			}
			op.setFunc = func(v reflect.Value, val interface{}) error {
				return setNested(nested, v, val.([]Value))
			}
		} else {
			op.setFunc = determineSetFunc(t, schemaField.Type)
			if op.setFunc == nil {
				return nil, fmt.Errorf("bigquery: schema field %s of type %s is not assignable to struct field %s of type %s",
					schemaField.Name, schemaField.Type, structField.Name, t)
			}
		}
		ops = append(ops, op)
	}
	return ops, nil
}

// determineSetFunc chooses the best function for setting a field of type ftype
// to a value whose schema field type is stype. It returns nil if stype
// is not assignable to ftype.
// determineSetFunc considers only basic types. See compileToOps for
// handling of repetition and nesting.
func determineSetFunc(ftype reflect.Type, stype FieldType) setFunc {
	switch stype {
	case StringFieldType:
		if ftype.Kind() == reflect.String {
			return setString
		}

	case BytesFieldType:
		if ftype == typeOfByteSlice {
			return setBytes
		}

	case IntegerFieldType:
		if isSupportedIntType(ftype) {
			return setInt
		}

	case FloatFieldType:
		switch ftype.Kind() {
		case reflect.Float32, reflect.Float64:
			return setFloat
		}

	case BooleanFieldType:
		if ftype.Kind() == reflect.Bool {
			return setBool
		}

	case TimestampFieldType:
		if ftype == typeOfGoTime {
			return setAny
		}

	case DateFieldType:
		if ftype == typeOfDate {
			return setAny
		}

	case TimeFieldType:
		if ftype == typeOfTime {
			return setAny
		}

	case DateTimeFieldType:
		if ftype == typeOfDateTime {
			return setAny
		}
	}
	return nil
}

func (sl *structLoader) Load(values []Value, _ Schema) error {
	if sl.err != nil {
		return sl.err
	}
	return runOps(sl.ops, sl.vstructp.Elem(), values)
}

// runOps executes a sequence of ops, setting the fields of vstruct to the
// supplied values.
func runOps(ops []structLoaderOp, vstruct reflect.Value, values []Value) error {
	for _, op := range ops {
		field := vstruct.FieldByIndex(op.fieldIndex)
		var err error
		if op.repeated {
			err = setRepeated(field, values[op.valueIndex].([]Value), op.setFunc)
		} else {
			err = op.setFunc(field, values[op.valueIndex])
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func setNested(ops []structLoaderOp, v reflect.Value, vals []Value) error {
	// v is either a struct or a pointer to a struct.
	if v.Kind() == reflect.Ptr {
		// If the pointer is nil, set it to a zero struct value.
		if v.IsNil() {
			v.Set(reflect.New(v.Type().Elem()))
		}
		v = v.Elem()
	}
	return runOps(ops, v, vals)
}

func setRepeated(field reflect.Value, vslice []Value, setElem setFunc) error {
	vlen := len(vslice)
	var flen int
	switch field.Type().Kind() {
	case reflect.Slice:
		// Make a slice of the right size, avoiding allocation if possible.
		switch {
		case field.Len() < vlen:
			field.Set(reflect.MakeSlice(field.Type(), vlen, vlen))
		case field.Len() > vlen:
			field.SetLen(vlen)
		}
		flen = vlen

	case reflect.Array:
		flen = field.Len()
		if flen > vlen {
			// Set extra elements to their zero value.
			z := reflect.Zero(field.Type().Elem())
			for i := vlen; i < flen; i++ {
				field.Index(i).Set(z)
			}
		}
	default:
		return fmt.Errorf("bigquery: impossible field type %s", field.Type())
	}
	for i, val := range vslice {
		if i < flen { // avoid writing past the end of a short array
			if err := setElem(field.Index(i), val); err != nil {
				return err
			}
		}
	}
	return nil
}

// A ValueSaver returns a row of data to be inserted into a table.
type ValueSaver interface {
	// Save returns a row to be inserted into a BigQuery table, represented
	// as a map from field name to Value.
	// If insertID is non-empty, BigQuery will use it to de-duplicate
	// insertions of this row on a best-effort basis.
	Save() (row map[string]Value, insertID string, err error)
}

// ValuesSaver implements ValueSaver for a slice of Values.
type ValuesSaver struct {
	Schema Schema

	// If non-empty, BigQuery will use InsertID to de-duplicate insertions
	// of this row on a best-effort basis.
	InsertID string

	Row []Value
}

// Save implements ValueSaver.
func (vls *ValuesSaver) Save() (map[string]Value, string, error) {
	m, err := valuesToMap(vls.Row, vls.Schema)
	return m, vls.InsertID, err
}

func valuesToMap(vs []Value, schema Schema) (map[string]Value, error) {
	if len(vs) != len(schema) {
		return nil, errors.New("Schema does not match length of row to be inserted")
	}

	m := make(map[string]Value)
	for i, fieldSchema := range schema {
		if fieldSchema.Type != RecordFieldType {
			m[fieldSchema.Name] = toUploadValue(vs[i], fieldSchema)
			continue
		}
		// Nested record, possibly repeated.
		vals, ok := vs[i].([]Value)
		if !ok {
			return nil, errors.New("nested record is not a []Value")
		}
		if !fieldSchema.Repeated {
			value, err := valuesToMap(vals, fieldSchema.Schema)
			if err != nil {
				return nil, err
			}
			m[fieldSchema.Name] = value
			continue
		}
		// A repeated nested field is converted into a slice of maps.
		var maps []Value
		for _, v := range vals {
			sv, ok := v.([]Value)
			if !ok {
				return nil, errors.New("nested record in slice is not a []Value")
			}
			value, err := valuesToMap(sv, fieldSchema.Schema)
			if err != nil {
				return nil, err
			}
			maps = append(maps, value)
		}
		m[fieldSchema.Name] = maps
	}
	return m, nil
}

// StructSaver implements ValueSaver for a struct.
// The struct is converted to a map of values by using the values of struct
// fields corresponding to schema fields. Additional and missing
// fields are ignored, as are nested struct pointers that are nil.
type StructSaver struct {
	// Schema determines what fields of the struct are uploaded. It should
	// match the table's schema.
	Schema Schema

	// If non-empty, BigQuery will use InsertID to de-duplicate insertions
	// of this row on a best-effort basis.
	InsertID string

	// Struct should be a struct or a pointer to a struct.
	Struct interface{}
}

// Save implements ValueSaver.
func (ss *StructSaver) Save() (row map[string]Value, insertID string, err error) {
	vstruct := reflect.ValueOf(ss.Struct)
	row, err = structToMap(vstruct, ss.Schema)
	if err != nil {
		return nil, "", err
	}
	return row, ss.InsertID, nil
}

func structToMap(vstruct reflect.Value, schema Schema) (map[string]Value, error) {
	if vstruct.Kind() == reflect.Ptr {
		vstruct = vstruct.Elem()
	}
	if !vstruct.IsValid() {
		return nil, nil
	}
	m := map[string]Value{}
	if vstruct.Kind() != reflect.Struct {
		return nil, fmt.Errorf("bigquery: type is %s, need struct or struct pointer", vstruct.Type())
	}
	fields, err := fieldCache.Fields(vstruct.Type())
	if err != nil {
		return nil, err
	}
	for _, schemaField := range schema {
		// Look for an exported struct field with the same name as the schema
		// field, ignoring case.
		structField := fields.Match(schemaField.Name)
		if structField == nil {
			continue
		}
		val, err := structFieldToUploadValue(vstruct.FieldByIndex(structField.Index), schemaField)
		if err != nil {
			return nil, err
		}
		// Add the value to the map, unless it is nil.
		if val != nil {
			m[schemaField.Name] = val
		}
	}
	return m, nil
}

// structFieldToUploadValue converts a struct field to a value suitable for ValueSaver.Save, using
// the schemaField as a guide.
// structFieldToUploadValue is careful to return a true nil interface{} when needed, so its
// caller can easily identify a nil value.
func structFieldToUploadValue(vfield reflect.Value, schemaField *FieldSchema) (interface{}, error) {
	if schemaField.Repeated && (vfield.Kind() != reflect.Slice && vfield.Kind() != reflect.Array) {
		return nil, fmt.Errorf("bigquery: repeated schema field %s requires slice or array, but value has type %s",
			schemaField.Name, vfield.Type())
	}

	// A non-nested field can be represented by its Go value, except for civil times.
	if schemaField.Type != RecordFieldType {
		return toUploadValueReflect(vfield, schemaField), nil
	}
	// A non-repeated nested field is converted into a map[string]Value.
	if !schemaField.Repeated {
		m, err := structToMap(vfield, schemaField.Schema)
		if err != nil {
			return nil, err
		}
		if m == nil {
			return nil, nil
		}
		return m, nil
	}
	// A repeated nested field is converted into a slice of maps.
	if vfield.Len() == 0 {
		return nil, nil
	}
	var vals []Value
	for i := 0; i < vfield.Len(); i++ {
		m, err := structToMap(vfield.Index(i), schemaField.Schema)
		if err != nil {
			return nil, err
		}
		vals = append(vals, m)
	}
	return vals, nil
}

func toUploadValue(val interface{}, fs *FieldSchema) interface{} {
	if fs.Type == TimeFieldType || fs.Type == DateTimeFieldType {
		return toUploadValueReflect(reflect.ValueOf(val), fs)
	}
	return val
}

func toUploadValueReflect(v reflect.Value, fs *FieldSchema) interface{} {
	switch fs.Type {
	case TimeFieldType:
		return civilToUploadValue(v, fs, func(v reflect.Value) string {
			return CivilTimeString(v.Interface().(civil.Time))
		})
	case DateTimeFieldType:
		return civilToUploadValue(v, fs, func(v reflect.Value) string {
			return CivilDateTimeString(v.Interface().(civil.DateTime))
		})
	default:
		if !fs.Repeated || v.Len() > 0 {
			return v.Interface()
		}
		// The service treats a null repeated field as an error. Return
		// nil to omit the field entirely.
		return nil
	}
}

func civilToUploadValue(v reflect.Value, fs *FieldSchema, cvt func(reflect.Value) string) interface{} {
	if !fs.Repeated {
		return cvt(v)
	}
	if v.Len() == 0 {
		return nil
	}
	s := make([]string, v.Len())
	for i := 0; i < v.Len(); i++ {
		s[i] = cvt(v.Index(i))
	}
	return s
}

// CivilTimeString returns a string representing a civil.Time in a format compatible
// with BigQuery SQL. It rounds the time to the nearest microsecond and returns a
// string with six digits of sub-second precision.
//
// Use CivilTimeString when using civil.Time in DML, for example in INSERT
// statements.
func CivilTimeString(t civil.Time) string {
	if t.Nanosecond == 0 {
		return t.String()
	} else {
		micro := (t.Nanosecond + 500) / 1000 // round to nearest microsecond
		t.Nanosecond = 0
		return t.String() + fmt.Sprintf(".%06d", micro)
	}
}

// CivilDateTimeString returns a string representing a civil.DateTime in a format compatible
// with BigQuery SQL. It separate the date and time with a space, and formats the time
// with CivilTimeString.
//
// Use CivilDateTimeString when using civil.DateTime in DML, for example in INSERT
// statements.
func CivilDateTimeString(dt civil.DateTime) string {
	return dt.Date.String() + " " + CivilTimeString(dt.Time)
}

// convertRows converts a series of TableRows into a series of Value slices.
// schema is used to interpret the data from rows; its length must match the
// length of each row.
func convertRows(rows []*bq.TableRow, schema Schema) ([][]Value, error) {
	var rs [][]Value
	for _, r := range rows {
		row, err := convertRow(r, schema)
		if err != nil {
			return nil, err
		}
		rs = append(rs, row)
	}
	return rs, nil
}

func convertRow(r *bq.TableRow, schema Schema) ([]Value, error) {
	if len(schema) != len(r.F) {
		return nil, errors.New("schema length does not match row length")
	}
	var values []Value
	for i, cell := range r.F {
		fs := schema[i]
		v, err := convertValue(cell.V, fs.Type, fs.Schema)
		if err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, nil
}

func convertValue(val interface{}, typ FieldType, schema Schema) (Value, error) {
	switch val := val.(type) {
	case nil:
		return nil, nil
	case []interface{}:
		return convertRepeatedRecord(val, typ, schema)
	case map[string]interface{}:
		return convertNestedRecord(val, schema)
	case string:
		return convertBasicType(val, typ)
	default:
		return nil, fmt.Errorf("got value %v; expected a value of type %s", val, typ)
	}
}

func convertRepeatedRecord(vals []interface{}, typ FieldType, schema Schema) (Value, error) {
	var values []Value
	for _, cell := range vals {
		// each cell contains a single entry, keyed by "v"
		val := cell.(map[string]interface{})["v"]
		v, err := convertValue(val, typ, schema)
		if err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, nil
}

func convertNestedRecord(val map[string]interface{}, schema Schema) (Value, error) {
	// convertNestedRecord is similar to convertRow, as a record has the same structure as a row.

	// Nested records are wrapped in a map with a single key, "f".
	record := val["f"].([]interface{})
	if len(record) != len(schema) {
		return nil, errors.New("schema length does not match record length")
	}

	var values []Value
	for i, cell := range record {
		// each cell contains a single entry, keyed by "v"
		val := cell.(map[string]interface{})["v"]
		fs := schema[i]
		v, err := convertValue(val, fs.Type, fs.Schema)
		if err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, nil
}

// convertBasicType returns val as an interface with a concrete type specified by typ.
func convertBasicType(val string, typ FieldType) (Value, error) {
	switch typ {
	case StringFieldType:
		return val, nil
	case BytesFieldType:
		return base64.StdEncoding.DecodeString(val)
	case IntegerFieldType:
		return strconv.ParseInt(val, 10, 64)
	case FloatFieldType:
		return strconv.ParseFloat(val, 64)
	case BooleanFieldType:
		return strconv.ParseBool(val)
	case TimestampFieldType:
		f, err := strconv.ParseFloat(val, 64)
		return Value(time.Unix(0, int64(f*1e9)).UTC()), err
	case DateFieldType:
		return civil.ParseDate(val)
	case TimeFieldType:
		return civil.ParseTime(val)
	case DateTimeFieldType:
		return civil.ParseDateTime(val)
	default:
		return nil, fmt.Errorf("unrecognized type: %s", typ)
	}
}
