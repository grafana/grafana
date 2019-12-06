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
	"bytes"
	"errors"
	"fmt"
)

// Union wraps a datum value in a map for encoding as a Union, as required by
// Union encoder.
//
// When providing a value for an Avro union, the encoder will accept `nil` for a
// `null` value. If the value is non-`nil`, it must be a
// `map[string]interface{}` with a single key-value pair, where the key is the
// Avro type name and the value is the datum's value. As a convenience, the
// `Union` function wraps any datum value in a map as specified above.
//
//     func ExampleUnion() {
//        codec, err := goavro.NewCodec(`["null","string","int"]`)
//        if err != nil {
//            fmt.Println(err)
//        }
//        buf, err := codec.TextFromNative(nil, goavro.Union("string", "some string"))
//        if err != nil {
//            fmt.Println(err)
//        }
//        fmt.Println(string(buf))
//        // Output: {"string":"some string"}
//     }
func Union(name string, datum interface{}) interface{} {
	if datum == nil && name == "null" {
		return nil
	}
	return map[string]interface{}{name: datum}
}

func buildCodecForTypeDescribedBySlice(st map[string]*Codec, enclosingNamespace string, schemaArray []interface{}) (*Codec, error) {
	if len(schemaArray) == 0 {
		return nil, errors.New("Union ought to have one or more members")
	}

	allowedTypes := make([]string, len(schemaArray)) // used for error reporting when encoder receives invalid datum type
	codecFromIndex := make([]*Codec, len(schemaArray))
	codecFromName := make(map[string]*Codec, len(schemaArray))
	indexFromName := make(map[string]int, len(schemaArray))

	for i, unionMemberSchema := range schemaArray {
		unionMemberCodec, err := buildCodec(st, enclosingNamespace, unionMemberSchema)
		if err != nil {
			return nil, fmt.Errorf("Union item %d ought to be valid Avro type: %s", i+1, err)
		}
		fullName := unionMemberCodec.typeName.fullName
		if _, ok := indexFromName[fullName]; ok {
			return nil, fmt.Errorf("Union item %d ought to be unique type: %s", i+1, unionMemberCodec.typeName)
		}
		allowedTypes[i] = fullName
		codecFromIndex[i] = unionMemberCodec
		codecFromName[fullName] = unionMemberCodec
		indexFromName[fullName] = i
	}

	return &Codec{
		// NOTE: To support record field default values, union schema set to the
		// type name of first member
		schema: codecFromIndex[0].typeName.short(),

		typeName: &name{"union", nullNamespace},
		nativeFromBinary: func(buf []byte) (interface{}, []byte, error) {
			var decoded interface{}
			var err error

			decoded, buf, err = longNativeFromBinary(buf)
			if err != nil {
				return nil, nil, err
			}
			index := decoded.(int64) // longDecoder always returns int64, so elide error checking
			if index < 0 || index >= int64(len(codecFromIndex)) {
				return nil, nil, fmt.Errorf("cannot decode binary union: index ought to be between 0 and %d; read index: %d", len(codecFromIndex)-1, index)
			}
			c := codecFromIndex[index]
			decoded, buf, err = c.nativeFromBinary(buf)
			if err != nil {
				return nil, nil, fmt.Errorf("cannot decode binary union item %d: %s", index+1, err)
			}
			if decoded == nil {
				// do not wrap a nil value in a map
				return nil, buf, nil
			}
			// Non-nil values are wrapped in a map with single key set to type name of value
			return Union(allowedTypes[index], decoded), buf, nil
		},
		binaryFromNative: func(buf []byte, datum interface{}) ([]byte, error) {
			switch v := datum.(type) {
			case nil:
				index, ok := indexFromName["null"]
				if !ok {
					return nil, fmt.Errorf("cannot encode binary union: no member schema types support datum: allowed types: %v; received: %T", allowedTypes, datum)
				}
				return longBinaryFromNative(buf, index)
			case map[string]interface{}:
				if len(v) != 1 {
					return nil, fmt.Errorf("cannot encode binary union: non-nil Union values ought to be specified with Go map[string]interface{}, with single key equal to type name, and value equal to datum value: %v; received: %T", allowedTypes, datum)
				}
				// will execute exactly once
				for key, value := range v {
					index, ok := indexFromName[key]
					if !ok {
						return nil, fmt.Errorf("cannot encode binary union: no member schema types support datum: allowed types: %v; received: %T", allowedTypes, datum)
					}
					c := codecFromIndex[index]
					buf, _ = longBinaryFromNative(buf, index)
					return c.binaryFromNative(buf, value)
				}
			}
			return nil, fmt.Errorf("cannot encode binary union: non-nil Union values ought to be specified with Go map[string]interface{}, with single key equal to type name, and value equal to datum value: %v; received: %T", allowedTypes, datum)
		},
		nativeFromTextual: func(buf []byte) (interface{}, []byte, error) {
			if len(buf) >= 4 && bytes.Equal(buf[:4], []byte("null")) {
				if _, ok := indexFromName["null"]; ok {
					return nil, buf[4:], nil
				}
			}

			var datum interface{}
			var err error
			datum, buf, err = genericMapTextDecoder(buf, nil, codecFromName)
			if err != nil {
				return nil, nil, fmt.Errorf("cannot decode textual union: %s", err)
			}

			return datum, buf, nil
		},
		textualFromNative: func(buf []byte, datum interface{}) ([]byte, error) {
			switch v := datum.(type) {
			case nil:
				_, ok := indexFromName["null"]
				if !ok {
					return nil, fmt.Errorf("cannot encode textual union: no member schema types support datum: allowed types: %v; received: %T", allowedTypes, datum)
				}
				return append(buf, "null"...), nil
			case map[string]interface{}:
				if len(v) != 1 {
					return nil, fmt.Errorf("cannot encode textual union: non-nil Union values ought to be specified with Go map[string]interface{}, with single key equal to type name, and value equal to datum value: %v; received: %T", allowedTypes, datum)
				}
				// will execute exactly once
				for key, value := range v {
					index, ok := indexFromName[key]
					if !ok {
						return nil, fmt.Errorf("cannot encode textual union: no member schema types support datum: allowed types: %v; received: %T", allowedTypes, datum)
					}
					buf = append(buf, '{')
					var err error
					buf, err = stringTextualFromNative(buf, key)
					if err != nil {
						return nil, fmt.Errorf("cannot encode textual union: %s", err)
					}
					buf = append(buf, ':')
					c := codecFromIndex[index]
					buf, err = c.textualFromNative(buf, value)
					if err != nil {
						return nil, fmt.Errorf("cannot encode textual union: %s", err)
					}
					return append(buf, '}'), nil
				}
			}
			return nil, fmt.Errorf("cannot encode textual union: non-nil values ought to be specified with Go map[string]interface{}, with single key equal to type name, and value equal to datum value: %v; received: %T", allowedTypes, datum)
		},
	}, nil
}
