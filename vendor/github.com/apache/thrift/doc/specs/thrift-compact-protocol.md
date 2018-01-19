Thrift Compact protocol encoding 
================================

<!--
--------------------------------------------------------------------

Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.

--------------------------------------------------------------------
-->

This documents describes the wire encoding for RPC using the Thrift *compact protocol*.

The information here is _mostly_ based on the Java implementation in the Apache thrift library (version 0.9.1) and
[THRIFT-110 A more compact format](https://issues.apache.org/jira/browse/THRIFT-110). Other implementation however,
should behave the same.

For background on Thrift see the [Thrift whitepaper (pdf)](https://thrift.apache.org/static/files/thrift-20070401.pdf).

# Contents

* Compact protocol
  * Base types
  * Message
  * Struct
  * List and Set
  * Map
* BNF notation used in this document

# Compact protocol

## Base types

### Integer encoding

The _compact protocol_ uses multiple encodings for ints: the _zigzag int_, and the _var int_.

Values of type `int32` and `int64` are first transformed to a *zigzag int*. A zigzag int folds positive and negative
numbers into the positive number space. When we read 0, 1, 2, 3, 4 or 5 from the wire, this is translated to 0, -1, 1,
-2 or 2 respectively. Here are the (Scala) formulas to convert from int32/int64 to a zigzag int and back:

```scala
def intToZigZag(n: Int): Int = (n << 1) ^ (n >> 31)
def zigzagToInt(n: Int): Int = (n >>> 1) ^ - (n & 1)
def longToZigZag(n: Long): Long = (n << 1) ^ (n >> 63)
def zigzagToLong(n: Long): Long = (n >>> 1) ^ - (n & 1)
```

The zigzag int is then encoded as a *var int*. Var ints take 1 to 5 bytes (int32) or 1 to 10 bytes (int64). The most
significant bit of each byte indicates if more bytes follow. The concatenation of the least significant 7 bits from each
byte form the number, where the first byte has the most significant bits (so they are in big endian or network order).

Var ints are sometimes used directly inside the compact protocol to represent positive numbers.

To encode an `int16` as zigzag int, it is first converted to an `int32` and then encoded as such. The type `int8` simply
uses a single byte as in the binary protocol.

### Enum encoding

The generated code encodes `Enum`s by taking the ordinal value and then encoding that as an int32.

### Binary encoding

Binary is sent as follows:

```
Binary protocol, binary data, 1+ bytes:
+--------+...+--------+--------+...+--------+
| byte length         | bytes               |
+--------+...+--------+--------+...+--------+
```

Where:

* `byte length` is the length of the byte array, using var int encoding (must be >= 0).
* `bytes` are the bytes of the byte array.

### String encoding

*String*s are first encoded to UTF-8, and then send as binary.

### Double encoding

Values of type `double` are first converted to an int64 according to the IEEE 754 floating-point "double format" bit
layout. Most run-times provide a library to make this conversion. Both the binary protocol as the compact protocol then
encode the int64 in 8 bytes in big endian order.

### Boolean encoding

Booleans are encoded differently depending on whether it is a field value (in a struct) or an element value (in a set,
list or map). Field values are encoded directly in the field header. Element values of type `bool` are sent as an int8;
true as `1` and false as `0`.

## Message

A `Message` on the wire looks as follows:

```
Compact protocol Message (4+ bytes):
+--------+--------+--------+...+--------+--------+...+--------+--------+...+--------+
|pppppppp|mmmvvvvv| seq id              | name length         | name                |
+--------+--------+--------+...+--------+--------+...+--------+--------+...+--------+
```

Where:

* `pppppppp` is the protocol id, fixed to `1000 0010`, 0x82.
* `mmm` is the message type, an unsigned 3 bit integer.
* `vvvvv` is the version, an unsigned 5 bit integer, fixed to `00001`.
* `seq id` is the sequence id, a signed 32 bit integer encoded as a var int.
* `name length` is the byte length of the name field, a signed 32 bit integer encoded as a var int (must be >= 0).
* `name` is the method name to invoke, a UTF-8 encoded string.

Message types are encoded with the following values:

* _Call_: 1
* _Reply_: 2
* _Exception_: 3
* _Oneway_: 4

### Struct

A *Struct* is a sequence of zero or more fields, followed by a stop field. Each field starts with a field header and
is followed by the encoded field value. The encoding can be summarized by the following BNF:

```
struct        ::= ( field-header field-value )* stop-field
field-header  ::= field-type field-id
```

Because each field header contains the field-id (as defined by the Thrift IDL file), the fields can be encoded in any
order. Thrift's type system is not extensible; you can only encode the primitive types and structs. Therefore is also
possible to handle unknown fields while decoding; these are simply ignored. While decoding the field type can be used to
determine how to decode the field value.

Note that the field name is not encoded so field renames in the IDL do not affect forward and backward compatibility.

The default Java implementation (Apache Thrift 0.9.1) has undefined behavior when it tries to decode a field that has
another field-type then what is expected. Theoretically this could be detected at the cost of some additional checking.
Other implementation may perform this check and then either ignore the field, or return a protocol exception.

A *Union* is encoded exactly the same as a struct with the additional restriction that at most 1 field may be encoded.

An *Exception* is encoded exactly the same as a struct.

### Struct encoding

```
Compact protocol field header (short form) and field value:
+--------+--------+...+--------+
|ddddtttt| field value         |
+--------+--------+...+--------+

Compact protocol field header (1 to 3 bytes, long form) and field value:
+--------+--------+...+--------+--------+...+--------+
|0000tttt| field id            | field value         |
+--------+--------+...+--------+--------+...+--------+

Compact protocol stop field:
+--------+
|00000000|
+--------+
```

Where:

* `dddd` is the field id delta, an unsigned 4 bits integer, strictly positive.
* `tttt` is field-type id, an unsigned 4 bit integer.
* `field id` the field id, a signed 16 bit integer encoded as zigzag int.
* `field-value` the encoded field value.

The field id delta can be computed by `current-field-id - previous-field-id`, or just `current-field-id` if this is the
first of the struct. The short form should be used when the field id delta is in the range 1 - 15 (inclusive).

The following field-types can be encoded:

* `BOOLEAN_TRUE`, encoded as `1`
* `BOOLEAN_FALSE`, encoded as `2`
* `BYTE`, encoded as `3`
* `I16`, encoded as `4`
* `I32`, encoded as `5`
* `I64`, encoded as `6`
* `DOUBLE`, encoded as `7`
* `BINARY`, used for binary and string fields, encoded as `8`
* `LIST`, encoded as `9`
* `SET`, encoded as `10`
* `MAP`, encoded as `11`
* `STRUCT`, used for both structs and union fields, encoded as `12`

Note that because there are 2 specific field types for the boolean values, the encoding of a boolean field value has no
length (0 bytes).

## List and Set

List and sets are encoded the same: a header indicating the size and the element-type of the elements, followed by the
encoded elements.

```
Compact protocol list header (1 byte, short form) and elements:
+--------+--------+...+--------+
|sssstttt| elements            |
+--------+--------+...+--------+

Compact protocol list header (2+ bytes, long form) and elements:
+--------+--------+...+--------+--------+...+--------+
|1111tttt| size                | elements            |
+--------+--------+...+--------+--------+...+--------+
```

Where:

* `ssss` is the size, 4 bit unsigned int, values `0` - `14`
* `tttt` is the element-type, a 4 bit unsigned int
* `size` is the size, a var int (int32), positive values `15` or higher
* `elements` are the encoded elements

The short form should be used when the length is in the range 0 - 14 (inclusive).

The following element-types are used (note that these are _different_ from the field-types):

* `BOOL`, encoded as `2`
* `BYTE`, encoded as `3`
* `DOUBLE`, encoded as `4`
* `I16`, encoded as `6`
* `I32`, encoded as `8`
* `I64`, encoded as `10`
* `STRING`, used for binary and string fields, encoded as `11`
* `STRUCT`, used for structs and union fields, encoded as `12`
* `MAP`, encoded as `13`
* `SET`, encoded as `14`
* `LIST`, encoded as `15`


The maximum list/set size is configurable. By default there is no limit (meaning the limit is the maximum int32 value:
2147483647).

## Map

Maps are encoded with a header indicating the size, the type of the keys and the element-type of the elements, followed
by the encoded elements. The encoding follows this BNF:

```
map           ::= empty-map | non-empty-map
empty-map     ::= `0`
non-empty-map ::= size key-element-type value-element-type (key value)+
```

```
Compact protocol map header (1 byte, empty map):
+--------+
|00000000|
+--------+

Compact protocol map header (2+ bytes, non empty map) and key value pairs:
+--------+...+--------+--------+--------+...+--------+
| size                |kkkkvvvv| key value pairs     |
+--------+...+--------+--------+--------+...+--------+
```

Where:

* `size` is the size, a var int (int32), strictly positive values
* `kkkk` is the key element-type, a 4 bit unsigned int
* `vvvv` is the value element-type, a 4 bit unsigned int
* `key value pairs` are the encoded keys and values

The element-types are the same as for lists. The full list is included in the 'List and set' section.

The maximum map size is configurable. By default there is no limit (meaning the limit is the maximum int32 value:
2147483647).

# BNF notation used in this document

The following BNF notation is used:

* a plus `+` appended to an item represents repetition; the item is repeated 1 or more times
* a star `*` appended to an item represents optional repetition; the item is repeated 0 or more times
* a pipe `|` between items represents choice, the first matching item is selected
* parenthesis `(` and `)` are used for grouping multiple items
