// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package variant provides an implementation of the Apache Parquet Variant data type.
//
// The Variant type is a flexible binary format designed to represent complex nested
// data structures with minimal overhead. It supports a wide range of primitive types
// as well as nested arrays and objects (similar to JSON). The format uses a memory-efficient
// binary representation with a separate metadata section for dictionary encoding of keys.
//
// # Key Components
//
// - [Value]: The primary type representing a variant value
// - [Metadata]: Contains information about the dictionary of keys
// - [Builder]: Used to construct variant values
//
// # Format Overview
//
// The variant format consists of two parts:
//
//  1. Metadata: A dictionary of keys used in objects
//  2. Value: The actual data payload
//
// Values can be one of the following types:
//
//   - Primitive values (null, bool, int8/16/32/64, float32/64, etc.)
//   - Short strings (less than 64 bytes)
//   - Long strings and binary data
//   - Date, time and timestamp values
//   - Decimal values (4, 8, or 16 bytes)
//   - Arrays of any variant value
//   - Objects with key-value pairs
//
// # Working with Variants
//
// To create a variant value, use the Builder:
//
//	var b variant.Builder
//	b.Append(map[string]any{
//	    "id": 123,
//	    "name": "example",
//	    "data": []any{1, 2, 3},
//	})
//	value, err := b.Build()
//
// To parse an existing variant value:
//
//	v, err := variant.New(metadataBytes, valueBytes)
//
// You can access the data using the [Value.Value] method which returns the appropriate Go type:
//
//	switch v.Type() {
//	case variant.Object:
//	    obj := v.Value().(variant.ObjectValue)
//	    field, err := obj.ValueByKey("name")
//	case variant.Array:
//	    arr := v.Value().(variant.ArrayValue)
//	    elem, err := arr.Value(0)
//	case variant.String:
//	    s := v.Value().(string)
//	case variant.Int64:
//	    i := v.Value().(int64)
//	}
//
// You can also switch on the type of the result value from the [Value.Value] method:
//
//	switch val := v.Value().(type) {
//	case nil:
//	  // ...
//	case int32:
//	  // ...
//	case string:
//	  // ...
//	case variant.ArrayValue:
//	  for i, item := range val.Values() {
//	    // item is a variant.Value
//	  }
//	case variant.ObjectValue:
//	  for k, item := range val.Values() {
//	    // k is the field key
//	    // item is a variant.Value for that field
//	  }
//	}
//
// Values can also be converted to JSON:
//
//	jsonBytes, err := json.Marshal(v)
//
// # Low-level Construction
//
// For direct construction of complex nested structures, you can use the low-level
// methods:
//
//	var b variant.Builder
//	// Start an object
//	start := b.Offset()
//	fields := make([]variant.FieldEntry, 0)
//
//	// Add a field
//	fields = append(fields, b.NextField(start, "key"))
//	b.AppendString("value")
//
//	// Finish the object
//	b.FinishObject(start, fields)
//
//	value, err := b.Build()
//
// # Using Struct Tags
//
// When appending Go structs, you can use struct tags to control field names and
// encoding options:
//
//	type Person struct {
//	    ID        int       `variant:"id"`
//	    Name      string    `variant:"name"`
//	    CreatedAt time.Time `variant:"timestamp,nanos,utc"`
//	    Internal  string    `variant:"-"` // Ignored field
//	}
//
// # Reusing Builders
//
// When reusing a Builder for multiple values, use Reset() to clear it:
//
//	var b variant.Builder
//	v1, _ := b.Append(data1).Build()
//	v1 = v1.Clone() // Clone before reset if you need to keep the value
//	b.Reset()
//	v2, _ := b.Append(data2).Build()
package variant
