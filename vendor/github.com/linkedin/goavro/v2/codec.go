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
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
)

var (
	// MaxBlockCount is the maximum number of data items allowed in a single
	// block that will be decoded from a binary stream, whether when reading
	// blocks to decode an array or a map, or when reading blocks from an OCF
	// stream. This check is to ensure decoding binary data will not cause the
	// library to over allocate RAM, potentially creating a denial of service on
	// the system.
	//
	// If a particular application needs to decode binary Avro data that
	// potentially has more data items in a single block, then this variable may
	// be modified at your discretion.
	MaxBlockCount = int64(math.MaxInt32)

	// MaxBlockSize is the maximum number of bytes that will be allocated for a
	// single block of data items when decoding from a binary stream. This check
	// is to ensure decoding binary data will not cause the library to over
	// allocate RAM, potentially creating a denial of service on the system.
	//
	// If a particular application needs to decode binary Avro data that
	// potentially has more bytes in a single block, then this variable may be
	// modified at your discretion.
	MaxBlockSize = int64(math.MaxInt32)
)

// Codec supports decoding binary and text Avro data to Go native data types,
// and conversely encoding Go native data types to binary or text Avro data. A
// Codec is created as a stateless structure that can be safely used in multiple
// go routines simultaneously.
type Codec struct {
	soeHeader       []byte // single-object-encoding header
	schemaOriginal  string
	schemaCanonical string
	typeName        *name

	nativeFromTextual func([]byte) (interface{}, []byte, error)
	binaryFromNative  func([]byte, interface{}) ([]byte, error)
	nativeFromBinary  func([]byte) (interface{}, []byte, error)
	textualFromNative func([]byte, interface{}) ([]byte, error)

	Rabin uint64
}

// NewCodec returns a Codec used to translate between a byte slice of either
// binary or textual Avro data and native Go data.
//
// Creating a `Codec` is fast, but ought to be performed exactly once per Avro
// schema to process. Once a `Codec` is created, it may be used multiple times
// to convert data between native form and binary Avro representation, or
// between native form and textual Avro representation.
//
// A particular `Codec` can work with only one Avro schema. However,
// there is no practical limit to how many `Codec`s may be created and
// used in a program. Internally a `Codec` is merely a named tuple of
// four function pointers, and maintains no runtime state that is mutated
// after instantiation. In other words, `Codec`s may be safely used by
// many go routines simultaneously, as your program requires.
//
//     codec, err := goavro.NewCodec(`
//         {
//           "type": "record",
//           "name": "LongList",
//           "fields" : [
//             {"name": "next", "type": ["null", "LongList"], "default": null}
//           ]
//         }`)
//     if err != nil {
//             fmt.Println(err)
//     }
func NewCodec(schemaSpecification string) (*Codec, error) {
	var schema interface{}

	if err := json.Unmarshal([]byte(schemaSpecification), &schema); err != nil {
		return nil, fmt.Errorf("cannot unmarshal schema JSON: %s", err)
	}

	// bootstrap a symbol table with primitive type codecs for the new codec
	st := newSymbolTable()

	c, err := buildCodec(st, nullNamespace, schema)
	if err != nil {
		return nil, err
	}
	c.schemaCanonical, err = parsingCanonicalForm(schema, "", make(map[string]string))
	if err != nil {
		return nil, err // should not get here because schema was validated above
	}

	c.Rabin = rabin([]byte(c.schemaCanonical))
	c.soeHeader = []byte{0xC3, 0x01, 0, 0, 0, 0, 0, 0, 0, 0}
	binary.LittleEndian.PutUint64(c.soeHeader[2:], c.Rabin)

	c.schemaOriginal = schemaSpecification
	return c, nil
}

func newSymbolTable() map[string]*Codec {
	return map[string]*Codec{
		"boolean": {
			typeName:          &name{"boolean", nullNamespace},
			schemaOriginal:    "boolean",
			schemaCanonical:   "boolean",
			binaryFromNative:  booleanBinaryFromNative,
			nativeFromBinary:  booleanNativeFromBinary,
			nativeFromTextual: booleanNativeFromTextual,
			textualFromNative: booleanTextualFromNative,
		},
		"bytes": {
			typeName:          &name{"bytes", nullNamespace},
			schemaOriginal:    "bytes",
			schemaCanonical:   "bytes",
			binaryFromNative:  bytesBinaryFromNative,
			nativeFromBinary:  bytesNativeFromBinary,
			nativeFromTextual: bytesNativeFromTextual,
			textualFromNative: bytesTextualFromNative,
		},
		"double": {
			typeName:          &name{"double", nullNamespace},
			schemaOriginal:    "double",
			schemaCanonical:   "double",
			binaryFromNative:  doubleBinaryFromNative,
			nativeFromBinary:  doubleNativeFromBinary,
			nativeFromTextual: doubleNativeFromTextual,
			textualFromNative: doubleTextualFromNative,
		},
		"float": {
			typeName:          &name{"float", nullNamespace},
			schemaOriginal:    "float",
			schemaCanonical:   "float",
			binaryFromNative:  floatBinaryFromNative,
			nativeFromBinary:  floatNativeFromBinary,
			nativeFromTextual: floatNativeFromTextual,
			textualFromNative: floatTextualFromNative,
		},
		"int": {
			typeName:          &name{"int", nullNamespace},
			schemaOriginal:    "int",
			schemaCanonical:   "int",
			binaryFromNative:  intBinaryFromNative,
			nativeFromBinary:  intNativeFromBinary,
			nativeFromTextual: intNativeFromTextual,
			textualFromNative: intTextualFromNative,
		},
		"long": {
			typeName:          &name{"long", nullNamespace},
			schemaOriginal:    "long",
			schemaCanonical:   "long",
			binaryFromNative:  longBinaryFromNative,
			nativeFromBinary:  longNativeFromBinary,
			nativeFromTextual: longNativeFromTextual,
			textualFromNative: longTextualFromNative,
		},
		"null": {
			typeName:          &name{"null", nullNamespace},
			schemaOriginal:    "null",
			schemaCanonical:   "null",
			binaryFromNative:  nullBinaryFromNative,
			nativeFromBinary:  nullNativeFromBinary,
			nativeFromTextual: nullNativeFromTextual,
			textualFromNative: nullTextualFromNative,
		},
		"string": {
			typeName:          &name{"string", nullNamespace},
			schemaOriginal:    "string",
			schemaCanonical:   "string",
			binaryFromNative:  stringBinaryFromNative,
			nativeFromBinary:  stringNativeFromBinary,
			nativeFromTextual: stringNativeFromTextual,
			textualFromNative: stringTextualFromNative,
		},
		// Start of compiled logical types using format typeName.logicalType where there is
		// no dependence on schema.
		"long.timestamp-millis": {
			typeName:          &name{"long.timestamp-millis", nullNamespace},
			schemaOriginal:    "long",
			schemaCanonical:   "long",
			nativeFromTextual: nativeFromTimeStampMillis(longNativeFromTextual),
			binaryFromNative:  timeStampMillisFromNative(longBinaryFromNative),
			nativeFromBinary:  nativeFromTimeStampMillis(longNativeFromBinary),
			textualFromNative: timeStampMillisFromNative(longTextualFromNative),
		},
		"long.timestamp-micros": {
			typeName:          &name{"long.timestamp-micros", nullNamespace},
			schemaOriginal:    "long",
			schemaCanonical:   "long",
			nativeFromTextual: nativeFromTimeStampMicros(longNativeFromTextual),
			binaryFromNative:  timeStampMicrosFromNative(longBinaryFromNative),
			nativeFromBinary:  nativeFromTimeStampMicros(longNativeFromBinary),
			textualFromNative: timeStampMicrosFromNative(longTextualFromNative),
		},
		"int.time-millis": {
			typeName:          &name{"int.time-millis", nullNamespace},
			schemaOriginal:    "int",
			schemaCanonical:   "int",
			nativeFromTextual: nativeFromTimeMillis(intNativeFromTextual),
			binaryFromNative:  timeMillisFromNative(intBinaryFromNative),
			nativeFromBinary:  nativeFromTimeMillis(intNativeFromBinary),
			textualFromNative: timeMillisFromNative(intTextualFromNative),
		},
		"long.time-micros": {
			typeName:          &name{"long.time-micros", nullNamespace},
			schemaOriginal:    "long",
			schemaCanonical:   "long",
			nativeFromTextual: nativeFromTimeMicros(longNativeFromTextual),
			binaryFromNative:  timeMicrosFromNative(longBinaryFromNative),
			nativeFromBinary:  nativeFromTimeMicros(longNativeFromBinary),
			textualFromNative: timeMicrosFromNative(longTextualFromNative),
		},
		"int.date": {
			typeName:          &name{"int.date", nullNamespace},
			schemaOriginal:    "int",
			schemaCanonical:   "int",
			nativeFromTextual: nativeFromDate(intNativeFromTextual),
			binaryFromNative:  dateFromNative(intBinaryFromNative),
			nativeFromBinary:  nativeFromDate(intNativeFromBinary),
			textualFromNative: dateFromNative(intTextualFromNative),
		},
	}
}

// BinaryFromNative appends the binary encoded byte slice representation of the
// provided native datum value to the provided byte slice in accordance with the
// Avro schema supplied when creating the Codec.  It is supplied a byte slice to
// which to append the binary encoded data along with the actual data to encode.
// On success, it returns a new byte slice with the encoded bytes appended, and
// a nil error value.  On error, it returns the original byte slice, and the
// error message.
//
//     func ExampleBinaryFromNative() {
//         codec, err := goavro.NewCodec(`
//             {
//               "type": "record",
//               "name": "LongList",
//               "fields" : [
//                 {"name": "next", "type": ["null", "LongList"], "default": null}
//               ]
//             }`)
//         if err != nil {
//             fmt.Println(err)
//         }
//
//         // Convert native Go form to binary Avro data
//         binary, err := codec.BinaryFromNative(nil, map[string]interface{}{
//             "next": map[string]interface{}{
//                 "LongList": map[string]interface{}{
//                     "next": map[string]interface{}{
//                         "LongList": map[string]interface{}{
//                         // NOTE: May omit fields when using default value
//                         },
//                     },
//                 },
//             },
//         })
//         if err != nil {
//             fmt.Println(err)
//         }
//
//         fmt.Printf("%#v", binary)
//         // Output: []byte{0x2, 0x2, 0x0}
//     }
func (c *Codec) BinaryFromNative(buf []byte, datum interface{}) ([]byte, error) {
	newBuf, err := c.binaryFromNative(buf, datum)
	if err != nil {
		return buf, err // if error, return original byte slice
	}
	return newBuf, nil
}

// NativeFromBinary returns a native datum value from the binary encoded byte
// slice in accordance with the Avro schema supplied when creating the Codec. On
// success, it returns the decoded datum, a byte slice containing the remaining
// undecoded bytes, and a nil error value. On error, it returns nil for
// the datum value, the original byte slice, and the error message.
//
//     func ExampleNativeFromBinary() {
//         codec, err := goavro.NewCodec(`
//             {
//               "type": "record",
//               "name": "LongList",
//               "fields" : [
//                 {"name": "next", "type": ["null", "LongList"], "default": null}
//               ]
//             }`)
//         if err != nil {
//             fmt.Println(err)
//         }
//
//         // Convert native Go form to binary Avro data
//         binary := []byte{0x2, 0x2, 0x0}
//
//         native, _, err := codec.NativeFromBinary(binary)
//         if err != nil {
//             fmt.Println(err)
//         }
//
//         fmt.Printf("%v", native)
//         // Output: map[next:map[LongList:map[next:map[LongList:map[next:<nil>]]]]]
//     }
func (c *Codec) NativeFromBinary(buf []byte) (interface{}, []byte, error) {
	value, newBuf, err := c.nativeFromBinary(buf)
	if err != nil {
		return nil, buf, err // if error, return original byte slice
	}
	return value, newBuf, nil
}

// NativeFromSingle converts Avro data from Single-Object-Encoded format from
// the provided byte slice to Go native data types in accordance with the Avro
// schema supplied when creating the Codec.  On success, it returns the decoded
// datum, along with a new byte slice with the decoded bytes consumed, and a nil
// error value.  On error, it returns nil for the datum value, the original byte
// slice, and the error message.
//
//     func decode(codec *goavro.Codec, buf []byte) error {
//         datum, _, err := codec.NativeFromSingle(buf)
//         if err != nil {
//             return err
//         }
//         _, err = fmt.Println(datum)
//         return err
//     }
func (c *Codec) NativeFromSingle(buf []byte) (interface{}, []byte, error) {
	fingerprint, newBuf, err := FingerprintFromSOE(buf)
	if err != nil {
		return nil, buf, err
	}
	if !bytes.Equal(buf[:len(c.soeHeader)], c.soeHeader) {
		return nil, buf, ErrWrongCodec(fingerprint)
	}
	value, newBuf, err := c.nativeFromBinary(newBuf)
	if err != nil {
		return nil, buf, err // if error, return original byte slice
	}
	return value, newBuf, nil
}

// NativeFromTextual converts Avro data in JSON text format from the provided byte
// slice to Go native data types in accordance with the Avro schema supplied
// when creating the Codec. On success, it returns the decoded datum, along with
// a new byte slice with the decoded bytes consumed, and a nil error value. On
// error, it returns nil for the datum value, the original byte slice, and the
// error message.
//
//     func ExampleNativeFromTextual() {
//         codec, err := goavro.NewCodec(`
//             {
//               "type": "record",
//               "name": "LongList",
//               "fields" : [
//                 {"name": "next", "type": ["null", "LongList"], "default": null}
//               ]
//             }`)
//         if err != nil {
//             fmt.Println(err)
//         }
//
//         // Convert native Go form to text Avro data
//         text := []byte(`{"next":{"LongList":{"next":{"LongList":{"next":null}}}}}`)
//
//         native, _, err := codec.NativeFromTextual(text)
//         if err != nil {
//             fmt.Println(err)
//         }
//
//         fmt.Printf("%v", native)
//         // Output: map[next:map[LongList:map[next:map[LongList:map[next:<nil>]]]]]
//     }
func (c *Codec) NativeFromTextual(buf []byte) (interface{}, []byte, error) {
	value, newBuf, err := c.nativeFromTextual(buf)
	if err != nil {
		return nil, buf, err // if error, return original byte slice
	}
	return value, newBuf, nil
}

// SingleFromNative appends the single-object-encoding byte slice representation
// of the provided native datum value to the provided byte slice in accordance
// with the Avro schema supplied when creating the Codec.  It is supplied a byte
// slice to which to append the header and binary encoded data, along with the
// actual data to encode.  On success, it returns a new byte slice with the
// encoded bytes appended, and a nil error value.  On error, it returns the
// original byte slice, and the error message.
//
//     func ExampleSingleItemEncoding() {
//         codec, err := goavro.NewCodec(`"int"`)
//         if err != nil {
//             fmt.Fprintf(os.Stderr, "%s\n", err)
//             return
//         }
//
//         buf, err := codec.SingleFromNative(nil, 3)
//         if err != nil {
//             fmt.Fprintf(os.Stderr, "%s\n", err)
//             return
//         }
//
//         fmt.Println(buf)
//         // Output: [195 1 143 92 57 63 26 213 117 114 6]
//     }
func (c *Codec) SingleFromNative(buf []byte, datum interface{}) ([]byte, error) {
	newBuf, err := c.binaryFromNative(append(buf, c.soeHeader...), datum)
	if err != nil {
		return buf, err
	}
	return newBuf, nil
}

// TextualFromNative converts Go native data types to Avro data in JSON text format in
// accordance with the Avro schema supplied when creating the Codec. It is
// supplied a byte slice to which to append the encoded data and the actual data
// to encode. On success, it returns a new byte slice with the encoded bytes
// appended, and a nil error value. On error, it returns the original byte
// slice, and the error message.
//
//     func ExampleTextualFromNative() {
//         codec, err := goavro.NewCodec(`
//             {
//               "type": "record",
//               "name": "LongList",
//               "fields" : [
//                 {"name": "next", "type": ["null", "LongList"], "default": null}
//               ]
//             }`)
//         if err != nil {
//             fmt.Println(err)
//         }
//
//         // Convert native Go form to text Avro data
//         text, err := codec.TextualFromNative(nil, map[string]interface{}{
//             "next": map[string]interface{}{
//                 "LongList": map[string]interface{}{
//                     "next": map[string]interface{}{
//                         "LongList": map[string]interface{}{
//                         // NOTE: May omit fields when using default value
//                         },
//                     },
//                 },
//             },
//         })
//         if err != nil {
//             fmt.Println(err)
//         }
//
//         fmt.Printf("%s", text)
//         // Output: {"next":{"LongList":{"next":{"LongList":{"next":null}}}}}
//     }
func (c *Codec) TextualFromNative(buf []byte, datum interface{}) ([]byte, error) {
	newBuf, err := c.textualFromNative(buf, datum)
	if err != nil {
		return buf, err // if error, return original byte slice
	}
	return newBuf, nil
}

// Schema returns the original schema used to create the Codec.
func (c *Codec) Schema() string {
	return c.schemaOriginal
}

// CanonicalSchema returns the Parsing Canonical Form of the schema according to
// the Avro specification.
func (c *Codec) CanonicalSchema() string {
	return c.schemaCanonical
}

// SchemaCRC64Avro returns a signed 64-bit integer Rabin fingerprint for the
// canonical schema.  This method returns the signed 64-bit cast of the unsigned
// 64-bit schema Rabin fingerprint.
//
// DEPRECATED: This method has been replaced by the Rabin structure Codec field
// and is provided for backward compatibility only.
func (c *Codec) SchemaCRC64Avro() int64 {
	return int64(c.Rabin)
}

// convert a schema data structure to a codec, prefixing with specified
// namespace
func buildCodec(st map[string]*Codec, enclosingNamespace string, schema interface{}) (*Codec, error) {
	switch schemaType := schema.(type) {
	case map[string]interface{}:
		return buildCodecForTypeDescribedByMap(st, enclosingNamespace, schemaType)
	case string:
		return buildCodecForTypeDescribedByString(st, enclosingNamespace, schemaType, nil)
	case []interface{}:
		return buildCodecForTypeDescribedBySlice(st, enclosingNamespace, schemaType)
	default:
		return nil, fmt.Errorf("unknown schema type: %T", schema)
	}
}

// Reach into the map, grabbing its "type". Use that to create the codec.
func buildCodecForTypeDescribedByMap(st map[string]*Codec, enclosingNamespace string, schemaMap map[string]interface{}) (*Codec, error) {
	t, ok := schemaMap["type"]
	if !ok {
		return nil, fmt.Errorf("missing type: %v", schemaMap)
	}
	switch v := t.(type) {
	case string:
		// Already defined types may be abbreviated with its string name.
		// EXAMPLE: "type":"array"
		// EXAMPLE: "type":"enum"
		// EXAMPLE: "type":"fixed"
		// EXAMPLE: "type":"int"
		// EXAMPLE: "type":"record"
		// EXAMPLE: "type":"somePreviouslyDefinedCustomTypeString"
		return buildCodecForTypeDescribedByString(st, enclosingNamespace, v, schemaMap)
	case map[string]interface{}:
		return buildCodecForTypeDescribedByMap(st, enclosingNamespace, v)
	case []interface{}:
		return buildCodecForTypeDescribedBySlice(st, enclosingNamespace, v)
	default:
		return nil, fmt.Errorf("type ought to be either string, map[string]interface{}, or []interface{}; received: %T", t)
	}
}

func buildCodecForTypeDescribedByString(st map[string]*Codec, enclosingNamespace string, typeName string, schemaMap map[string]interface{}) (*Codec, error) {
	isLogicalType := false
	searchType := typeName
	// logicalType will be non-nil for those fields without a logicalType property set
	if lt := schemaMap["logicalType"]; lt != nil {
		isLogicalType = true
		searchType = fmt.Sprintf("%s.%s", typeName, lt)
	}
	// NOTE: When codec already exists, return it. This includes both primitive and
	// logicalType codecs added in NewCodec, and user-defined types, added while
	// building the codec.
	if cd, ok := st[searchType]; ok {
		return cd, nil
	}

	// Avro specification allows abbreviation of type name inside a namespace.
	if enclosingNamespace != "" {
		if cd, ok := st[enclosingNamespace+"."+typeName]; ok {
			return cd, nil
		}
	}

	// There are only a small handful of complex Avro data types.
	switch searchType {
	case "array":
		return makeArrayCodec(st, enclosingNamespace, schemaMap)
	case "enum":
		return makeEnumCodec(st, enclosingNamespace, schemaMap)
	case "fixed":
		return makeFixedCodec(st, enclosingNamespace, schemaMap)
	case "map":
		return makeMapCodec(st, enclosingNamespace, schemaMap)
	case "record":
		return makeRecordCodec(st, enclosingNamespace, schemaMap)
	case "bytes.decimal":
		return makeDecimalBytesCodec(st, enclosingNamespace, schemaMap)
	case "fixed.decimal":
		return makeDecimalFixedCodec(st, enclosingNamespace, schemaMap)
	default:
		if isLogicalType {
			delete(schemaMap, "logicalType")
			return buildCodecForTypeDescribedByString(st, enclosingNamespace, typeName, schemaMap)
		}
		return nil, fmt.Errorf("unknown type name: %q", searchType)
	}
}

// notion of enclosing namespace changes when record, enum, or fixed create a
// new namespace, for child objects.
func registerNewCodec(st map[string]*Codec, schemaMap map[string]interface{}, enclosingNamespace string) (*Codec, error) {
	n, err := newNameFromSchemaMap(enclosingNamespace, schemaMap)
	if err != nil {
		return nil, err
	}
	c := &Codec{typeName: n}
	st[n.fullName] = c
	return c, nil
}

// ErrWrongCodec is returned when an attempt is made to decode a single-object
// encoded value using the wrong codec.
type ErrWrongCodec uint64

func (e ErrWrongCodec) Error() string { return "wrong codec: " + strconv.FormatUint(uint64(e), 10) }

// ErrNotSingleObjectEncoded is returned when an attempt is made to decode a
// single-object encoded value from a buffer that does not have the correct
// magic prefix.
type ErrNotSingleObjectEncoded string

func (e ErrNotSingleObjectEncoded) Error() string {
	return "cannot decode buffer as single-object encoding: " + string(e)
}
