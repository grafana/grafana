// Copyright [2017] LinkedIn Corp. Licensed under the Apache License, Version
// 2.0 (the "License"); you may not use this file except in compliance with the
// License.  You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

package goavro

import (
	"fmt"
)

func makeRecordCodec(st map[string]*Codec, enclosingNamespace string, schemaMap map[string]interface{}) (*Codec, error) {
	// NOTE: To support recursive data types, create the codec and register it
	// using the specified name, and fill in the codec functions later.
	c, err := registerNewCodec(st, schemaMap, enclosingNamespace)
	if err != nil {
		return nil, fmt.Errorf("Record ought to have valid name: %s", err)
	}

	fields, ok := schemaMap["fields"]
	if !ok {
		return nil, fmt.Errorf("Record %q ought to have fields key", c.typeName)
	}
	fieldSchemas, ok := fields.([]interface{})
	if !ok || len(fieldSchemas) == 0 {
		return nil, fmt.Errorf("Record %q fields ought to be non-empty array: %v", c.typeName, fields)
	}

	codecFromFieldName := make(map[string]*Codec)
	codecFromIndex := make([]*Codec, len(fieldSchemas))
	nameFromIndex := make([]string, len(fieldSchemas))
	defaultValueFromName := make(map[string]interface{}, len(fieldSchemas))

	for i, fieldSchema := range fieldSchemas {
		fieldSchemaMap, ok := fieldSchema.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("Record %q field %d ought to be valid Avro named type; received: %v", c.typeName, i+1, fieldSchema)
		}

		// NOTE: field names are not registered in the symbol table, because
		// field names are not individually addressable codecs.

		fieldCodec, err := buildCodecForTypeDescribedByMap(st, c.typeName.namespace, fieldSchemaMap)
		if err != nil {
			return nil, fmt.Errorf("Record %q field %d ought to be valid Avro named type: %s", c.typeName, i+1, err)
		}

		// However, when creating a full name for the field name, be sure to use
		// record's namespace
		n, err := newNameFromSchemaMap(c.typeName.namespace, fieldSchemaMap)
		if err != nil {
			return nil, fmt.Errorf("Record %q field %d ought to have valid name: %v", c.typeName, i+1, fieldSchemaMap)
		}
		fieldName := n.short()
		if _, ok := codecFromFieldName[fieldName]; ok {
			return nil, fmt.Errorf("Record %q field %d ought to have unique name: %q", c.typeName, i+1, fieldName)
		}

		if defaultValue, ok := fieldSchemaMap["default"]; ok {
			// if codec is union, then default value ought to encode using first schema in union
			if fieldCodec.typeName.short() == "union" {
				// NOTE: To support a null default value,
				// the string literal "null" must be coerced to a `nil`
				if defaultValue == "null" {
					defaultValue = nil
				}
				// NOTE: To support record field default values, union schema
				// set to the type name of first member
				defaultValue = Union(fieldCodec.schema, defaultValue)
			}
			// attempt to encode default value using codec
			_, err = fieldCodec.binaryFromNative(nil, defaultValue)
			if err != nil {
				return nil, fmt.Errorf("Record %q field %q: default value ought to encode using field schema: %s", c.typeName, fieldName, err)
			}
			defaultValueFromName[fieldName] = defaultValue
		}

		nameFromIndex[i] = fieldName
		codecFromIndex[i] = fieldCodec
		codecFromFieldName[fieldName] = fieldCodec
	}

	c.binaryFromNative = func(buf []byte, datum interface{}) ([]byte, error) {
		valueMap, ok := datum.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("cannot encode binary record %q: expected map[string]interface{}; received: %T", c.typeName, datum)
		}

		// records encoded in order fields were defined in schema
		for i, fieldCodec := range codecFromIndex {
			fieldName := nameFromIndex[i]

			// NOTE: If field value was not specified in map, then set
			// fieldValue to its default value (which may or may not have been
			// specified).
			fieldValue, ok := valueMap[fieldName]
			if !ok {
				if fieldValue, ok = defaultValueFromName[fieldName]; !ok {
					return nil, fmt.Errorf("cannot encode binary record %q field %q: schema does not specify default value and no value provided", c.typeName, fieldName)
				}
			}

			var err error
			buf, err = fieldCodec.binaryFromNative(buf, fieldValue)
			if err != nil {
				return nil, fmt.Errorf("cannot encode binary record %q field %q: value does not match its schema: %s", c.typeName, fieldName, err)
			}
		}
		return buf, nil
	}

	c.nativeFromBinary = func(buf []byte) (interface{}, []byte, error) {
		recordMap := make(map[string]interface{}, len(codecFromIndex))
		for i, fieldCodec := range codecFromIndex {
			name := nameFromIndex[i]
			var value interface{}
			var err error
			value, buf, err = fieldCodec.nativeFromBinary(buf)
			if err != nil {
				return nil, nil, fmt.Errorf("cannot decode binary record %q field %q: %s", c.typeName, name, err)
			}
			recordMap[name] = value
		}
		return recordMap, buf, nil
	}

	c.nativeFromTextual = func(buf []byte) (interface{}, []byte, error) {
		var mapValues map[string]interface{}
		var err error
		// NOTE: Setting `defaultCodec == nil` instructs genericMapTextDecoder
		// to return an error when a field name is not found in the
		// codecFromFieldName map.
		mapValues, buf, err = genericMapTextDecoder(buf, nil, codecFromFieldName)
		if err != nil {
			return nil, nil, fmt.Errorf("cannot decode textual record %q: %s", c.typeName, err)
		}
		if actual, expected := len(mapValues), len(codecFromFieldName); actual != expected {
			// set missing field keys to their respective default values, then
			// re-check number of keys
			for fieldName, defaultValue := range defaultValueFromName {
				if _, ok := mapValues[fieldName]; !ok {
					mapValues[fieldName] = defaultValue
				}
			}
			if actual, expected = len(mapValues), len(codecFromFieldName); actual != expected {
				return nil, nil, fmt.Errorf("cannot decode textual record %q: only found %d of %d fields", c.typeName, actual, expected)
			}
		}
		return mapValues, buf, nil
	}

	c.textualFromNative = func(buf []byte, datum interface{}) ([]byte, error) {
		// NOTE: Ensure only schema defined field names are encoded; and if
		// missing in datum, either use the provided field default value or
		// return an error.
		sourceMap, ok := datum.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("cannot encode textual record %q: expected map[string]interface{}; received: %T", c.typeName, datum)
		}
		destMap := make(map[string]interface{}, len(codecFromIndex))
		for fieldName := range codecFromFieldName {
			fieldValue, ok := sourceMap[fieldName]
			if !ok {
				defaultValue, ok := defaultValueFromName[fieldName]
				if !ok {
					return nil, fmt.Errorf("cannot encode textual record %q field %q: schema does not specify default value and no value provided", c.typeName, fieldName)
				}
				fieldValue = defaultValue
			}
			destMap[fieldName] = fieldValue
		}
		datum = destMap
		// NOTE: Setting `defaultCodec == nil` instructs genericMapTextEncoder
		// to return an error when a field name is not found in the
		// codecFromFieldName map.
		return genericMapTextEncoder(buf, datum, nil, codecFromFieldName)
	}

	return c, nil
}
