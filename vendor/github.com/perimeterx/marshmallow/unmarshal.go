// Copyright 2022 PerimeterX. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package marshmallow

import (
	"encoding/json"
	"github.com/mailru/easyjson/jlexer"
	"reflect"
)

// Unmarshal parses the JSON-encoded object in data and stores the values
// in the struct pointed to by v and in the returned map.
// If v is nil or not a pointer to a struct, Unmarshal returns an ErrInvalidValue.
// If data is not a valid JSON or not a JSON object Unmarshal returns an ErrInvalidInput.
//
// Unmarshal follows the rules of json.Unmarshal with the following exceptions:
// - All input fields are stored in the resulting map, including fields that do not exist in the
// struct pointed by v.
// - Unmarshal only operates on JSON object inputs. It will reject all other types of input
// by returning ErrInvalidInput.
// - Unmarshal only operates on struct values. It will reject all other types of v by
// returning ErrInvalidValue.
// - Unmarshal supports three types of Mode values. Each mode is self documented and affects
// how Unmarshal behaves.
func Unmarshal(data []byte, v interface{}, options ...UnmarshalOption) (map[string]interface{}, error) {
	if !isValidValue(v) {
		return nil, ErrInvalidValue
	}
	opts := buildUnmarshalOptions(options)
	useMultipleErrors := opts.mode == ModeAllowMultipleErrors || opts.mode == ModeFailOverToOriginalValue
	d := &decoder{options: opts, lexer: &jlexer.Lexer{Data: data, UseMultipleErrors: useMultipleErrors}}
	result := make(map[string]interface{})
	if d.lexer.IsNull() {
		d.lexer.Skip()
	} else if !d.lexer.IsDelim('{') {
		return nil, ErrInvalidInput
	} else {
		d.populateStruct(false, v, result)
	}
	d.lexer.Consumed()
	if useMultipleErrors {
		errors := d.lexer.GetNonFatalErrors()
		if len(errors) == 0 {
			return result, nil
		}
		return result, &MultipleLexerError{Errors: errors}
	}
	err := d.lexer.Error()
	if err != nil {
		return nil, err
	}
	return result, nil
}

type decoder struct {
	options *unmarshalOptions
	lexer   *jlexer.Lexer
}

func (d *decoder) populateStruct(forcePopulate bool, structInstance interface{}, result map[string]interface{}) (interface{}, bool) {
	doPopulate := !d.options.skipPopulateStruct || forcePopulate
	var structValue reflect.Value
	if doPopulate {
		structValue = reflectStructValue(structInstance)
	}
	fields := mapStructFields(structInstance)
	var clone map[string]interface{}
	if d.options.mode == ModeFailOverToOriginalValue {
		clone = make(map[string]interface{}, len(fields))
	}
	d.lexer.Delim('{')
	for !d.lexer.IsDelim('}') {
		key := d.lexer.UnsafeFieldName(false)
		d.lexer.WantColon()
		refInfo, exists := fields[key]
		if exists {
			value, isValidType := d.valueByReflectType(refInfo.t)
			if isValidType {
				if value != nil && doPopulate {
					field := refInfo.field(structValue)
					assignValue(field, value)
				}
				if !d.options.excludeKnownFieldsFromMap {
					if result != nil {
						result[key] = value
					}
					if clone != nil {
						clone[key] = value
					}
				}
			} else {
				switch d.options.mode {
				case ModeFailOnFirstError:
					return nil, false
				case ModeFailOverToOriginalValue:
					if !forcePopulate {
						result[key] = value
					} else {
						clone[key] = value
						d.lexer.WantComma()
						d.drainLexerMap(clone)
						return clone, false
					}
				}
			}
		} else {
			value := d.lexer.Interface()
			if result != nil {
				result[key] = value
			}
			if clone != nil {
				clone[key] = value
			}
		}
		d.lexer.WantComma()
	}
	d.lexer.Delim('}')
	return structInstance, true
}

func (d *decoder) valueByReflectType(t reflect.Type) (interface{}, bool) {
	if t.Implements(unmarshalerType) {
		result := reflect.New(t.Elem()).Interface()
		d.valueFromCustomUnmarshaler(result.(json.Unmarshaler))
		return result, true
	}
	if reflect.PtrTo(t).Implements(unmarshalerType) {
		value := reflect.New(t)
		d.valueFromCustomUnmarshaler(value.Interface().(json.Unmarshaler))
		return value.Elem().Interface(), true
	}
	kind := t.Kind()
	if converter := primitiveConverters[kind]; converter != nil {
		v := d.lexer.Interface()
		if v == nil {
			return nil, true
		}
		converted, ok := converter(v)
		if !ok {
			addUnexpectedTypeLexerError(d.lexer, t)
			return v, false
		}
		return converted, true
	}
	switch kind {
	case reflect.Slice:
		return d.buildSlice(t)
	case reflect.Array:
		return d.buildArray(t)
	case reflect.Map:
		return d.buildMap(t)
	case reflect.Struct:
		value, valid := d.buildStruct(t)
		if value == nil {
			return nil, valid
		}
		if !valid {
			return value, false
		}
		return reflect.ValueOf(value).Elem().Interface(), valid
	case reflect.Ptr:
		if t.Elem().Kind() == reflect.Struct {
			return d.buildStruct(t.Elem())
		}
		value, valid := d.valueByReflectType(t.Elem())
		if value == nil {
			return nil, valid
		}
		if !valid {
			return value, false
		}
		result := reflect.New(reflect.TypeOf(value))
		result.Elem().Set(reflect.ValueOf(value))
		return result.Interface(), valid
	}
	addUnsupportedTypeLexerError(d.lexer, t)
	return nil, false
}

func (d *decoder) buildSlice(sliceType reflect.Type) (interface{}, bool) {
	if d.lexer.IsNull() {
		d.lexer.Skip()
		return nil, true
	}
	if !d.lexer.IsDelim('[') {
		addUnexpectedTypeLexerError(d.lexer, sliceType)
		return d.lexer.Interface(), false
	}
	elemType := sliceType.Elem()
	d.lexer.Delim('[')
	var sliceValue reflect.Value
	if !d.lexer.IsDelim(']') {
		sliceValue = reflect.MakeSlice(sliceType, 0, 4)
	} else {
		sliceValue = reflect.MakeSlice(sliceType, 0, 0)
	}
	for !d.lexer.IsDelim(']') {
		current, valid := d.valueByReflectType(elemType)
		if !valid {
			if d.options.mode != ModeFailOverToOriginalValue {
				d.drainLexerArray(nil)
				return nil, true
			}
			result := d.cloneReflectArray(sliceValue, -1)
			result = append(result, current)
			return d.drainLexerArray(result), true
		}
		sliceValue = reflect.Append(sliceValue, safeReflectValue(elemType, current))
		d.lexer.WantComma()
	}
	d.lexer.Delim(']')
	return sliceValue.Interface(), true
}

func (d *decoder) buildArray(arrayType reflect.Type) (interface{}, bool) {
	if d.lexer.IsNull() {
		d.lexer.Skip()
		return nil, true
	}
	if !d.lexer.IsDelim('[') {
		addUnexpectedTypeLexerError(d.lexer, arrayType)
		return d.lexer.Interface(), false
	}
	elemType := arrayType.Elem()
	arrayValue := reflect.New(arrayType).Elem()
	d.lexer.Delim('[')
	for i := 0; !d.lexer.IsDelim(']'); i++ {
		current, valid := d.valueByReflectType(elemType)
		if !valid {
			if d.options.mode != ModeFailOverToOriginalValue {
				d.drainLexerArray(nil)
				return nil, true
			}
			result := d.cloneReflectArray(arrayValue, i)
			result = append(result, current)
			return d.drainLexerArray(result), true
		}
		if current != nil {
			arrayValue.Index(i).Set(reflect.ValueOf(current))
		}
		d.lexer.WantComma()
	}
	d.lexer.Delim(']')
	return arrayValue.Interface(), true
}

func (d *decoder) buildMap(mapType reflect.Type) (interface{}, bool) {
	if d.lexer.IsNull() {
		d.lexer.Skip()
		return nil, true
	}
	if !d.lexer.IsDelim('{') {
		addUnexpectedTypeLexerError(d.lexer, mapType)
		return d.lexer.Interface(), false
	}
	d.lexer.Delim('{')
	keyType := mapType.Key()
	valueType := mapType.Elem()
	mapValue := reflect.MakeMap(mapType)
	for !d.lexer.IsDelim('}') {
		key, valid := d.valueByReflectType(keyType)
		if !valid {
			if d.options.mode != ModeFailOverToOriginalValue {
				d.lexer.WantColon()
				d.lexer.Interface()
				d.lexer.WantComma()
				d.drainLexerMap(make(map[string]interface{}))
				return nil, true
			}
			strKey, _ := key.(string)
			d.lexer.WantColon()
			value := d.lexer.Interface()
			result := d.cloneReflectMap(mapValue)
			result[strKey] = value
			d.lexer.WantComma()
			d.drainLexerMap(result)
			return result, true
		}
		d.lexer.WantColon()
		value, valid := d.valueByReflectType(valueType)
		if !valid {
			if d.options.mode != ModeFailOverToOriginalValue {
				d.lexer.WantComma()
				d.drainLexerMap(make(map[string]interface{}))
				return nil, true
			}
			strKey, _ := key.(string)
			result := d.cloneReflectMap(mapValue)
			result[strKey] = value
			d.lexer.WantComma()
			d.drainLexerMap(result)
			return result, true
		}
		mapValue.SetMapIndex(safeReflectValue(keyType, key), safeReflectValue(valueType, value))
		d.lexer.WantComma()
	}
	d.lexer.Delim('}')
	return mapValue.Interface(), true
}

func (d *decoder) buildStruct(structType reflect.Type) (interface{}, bool) {
	if d.lexer.IsNull() {
		d.lexer.Skip()
		return nil, true
	}
	if !d.lexer.IsDelim('{') {
		addUnexpectedTypeLexerError(d.lexer, structType)
		return d.lexer.Interface(), false
	}
	value := reflect.New(structType).Interface()
	handler, ok := asJSONDataHandler(value)
	if !ok {
		return d.populateStruct(true, value, nil)
	}
	data := make(map[string]interface{})
	result, valid := d.populateStruct(true, value, data)
	if !valid {
		return result, false
	}
	err := handler(data)
	if err != nil {
		d.lexer.AddNonFatalError(err)
		return result, false
	}
	return result, true
}

func (d *decoder) valueFromCustomUnmarshaler(unmarshaler json.Unmarshaler) {
	data := d.lexer.Raw()
	if !d.lexer.Ok() {
		return
	}
	err := unmarshaler.UnmarshalJSON(data)
	if err != nil {
		d.lexer.AddNonFatalError(err)
	}
}

func (d *decoder) cloneReflectArray(value reflect.Value, length int) []interface{} {
	if length == -1 {
		length = value.Len()
	}
	result := make([]interface{}, length)
	for i := 0; i < length; i++ {
		result[i] = value.Index(i).Interface()
	}
	return result
}

func (d *decoder) cloneReflectMap(mapValue reflect.Value) map[string]interface{} {
	l := mapValue.Len()
	result := make(map[string]interface{}, l)
	for _, key := range mapValue.MapKeys() {
		value := mapValue.MapIndex(key)
		strKey, _ := key.Interface().(string)
		result[strKey] = value.Interface()
	}
	return result
}

func (d *decoder) drainLexerArray(target []interface{}) interface{} {
	d.lexer.WantComma()
	for !d.lexer.IsDelim(']') {
		current := d.lexer.Interface()
		target = append(target, current)
		d.lexer.WantComma()
	}
	d.lexer.Delim(']')
	return target
}

func (d *decoder) drainLexerMap(target map[string]interface{}) {
	for !d.lexer.IsDelim('}') {
		key := d.lexer.String()
		d.lexer.WantColon()
		value := d.lexer.Interface()
		target[key] = value
		d.lexer.WantComma()
	}
	d.lexer.Delim('}')
}
