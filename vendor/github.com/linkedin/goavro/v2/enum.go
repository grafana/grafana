// Copyright [2019] LinkedIn Corp. Licensed under the Apache License, Version
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
	"io"
)

// enum does not have child objects, therefore whatever namespace it defines is
// just to store its name in the symbol table.
func makeEnumCodec(st map[string]*Codec, enclosingNamespace string, schemaMap map[string]interface{}) (*Codec, error) {
	c, err := registerNewCodec(st, schemaMap, enclosingNamespace)
	if err != nil {
		return nil, fmt.Errorf("Enum ought to have valid name: %s", err)
	}

	// enum type must have symbols
	s1, ok := schemaMap["symbols"]
	if !ok {
		return nil, fmt.Errorf("Enum %q ought to have symbols key", c.typeName)
	}
	s2, ok := s1.([]interface{})
	if !ok || len(s2) == 0 {
		return nil, fmt.Errorf("Enum %q symbols ought to be non-empty array of strings: %v", c.typeName, s1)
	}
	symbols := make([]string, len(s2))
	for i, s := range s2 {
		symbol, ok := s.(string)
		if !ok {
			return nil, fmt.Errorf("Enum %q symbol %d ought to be non-empty string; received: %T", c.typeName, i+1, symbol)
		}
		if err := checkString(symbol); err != nil {
			return nil, fmt.Errorf("Enum %q symbol %d ought to %s", c.typeName, i+1, err)
		}
		symbols[i] = symbol
	}

	c.nativeFromBinary = func(buf []byte) (interface{}, []byte, error) {
		var value interface{}
		var err error
		var index int64

		if value, buf, err = longNativeFromBinary(buf); err != nil {
			return nil, nil, fmt.Errorf("cannot decode binary enum %q index: %s", c.typeName, err)
		}
		index = value.(int64)
		if index < 0 || index >= int64(len(symbols)) {
			return nil, nil, fmt.Errorf("cannot decode binary enum %q: index ought to be between 0 and %d; read index: %d", c.typeName, len(symbols)-1, index)
		}
		return symbols[index], buf, nil
	}
	c.binaryFromNative = func(buf []byte, datum interface{}) ([]byte, error) {
		someString, ok := datum.(string)
		if !ok {
			return nil, fmt.Errorf("cannot encode binary enum %q: expected string; received: %T", c.typeName, datum)
		}
		for i, symbol := range symbols {
			if symbol == someString {
				return longBinaryFromNative(buf, i)
			}
		}
		return nil, fmt.Errorf("cannot encode binary enum %q: value ought to be member of symbols: %v; %q", c.typeName, symbols, someString)
	}
	c.nativeFromTextual = func(buf []byte) (interface{}, []byte, error) {
		if buf, _ = advanceToNonWhitespace(buf); len(buf) == 0 {
			return nil, nil, fmt.Errorf("cannot decode textual enum: %s", io.ErrShortBuffer)
		}
		// decode enum string
		var value interface{}
		var err error
		value, buf, err = stringNativeFromTextual(buf)
		if err != nil {
			return nil, nil, fmt.Errorf("cannot decode textual enum: expected key: %s", err)
		}
		someString := value.(string)
		for _, symbol := range symbols {
			if symbol == someString {
				return someString, buf, nil
			}
		}
		return nil, nil, fmt.Errorf("cannot decode textual enum %q: value ought to be member of symbols: %v; %q", c.typeName, symbols, someString)
	}
	c.textualFromNative = func(buf []byte, datum interface{}) ([]byte, error) {
		someString, ok := datum.(string)
		if !ok {
			return nil, fmt.Errorf("cannot encode textual enum %q: expected string; received: %T", c.typeName, datum)
		}
		for _, symbol := range symbols {
			if symbol == someString {
				return stringTextualFromNative(buf, someString)
			}
		}
		return nil, fmt.Errorf("cannot encode textual enum %q: value ought to be member of symbols: %v; %q", c.typeName, symbols, someString)
	}

	return c, nil
}
