Thrift Binary protocol encoding 
===============================

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

This documents describes the wire encoding for RPC using the older Thrift *binary protocol*.

The information here is _mostly_ based on the Java implementation in the Apache thrift library (version 0.9.1 and
0.9.3). Other implementation however, should behave the same.

For background on Thrift see the [Thrift whitepaper (pdf)](https://thrift.apache.org/static/files/thrift-20070401.pdf).

# Contents

* Binary protocol
  * Base types
  * Message
  * Struct
  * List and Set
  * Map
* BNF notation used in this document

# Binary protocol

## Base types

### Integer encoding

In the _binary protocol_ integers are encoded with the most significant byte first (big endian byte order, aka network
order). An `int8` needs 1 byte, an `int16` 2, an `int32` 4 and an `int64` needs 8 bytes.

The CPP version has the option to use the binary protocol with little endian order. Little endian gives a small but
noticeable performance boost because contemporary CPUs use little endian when storing integers to RAM.

### Enum encoding

The generated code encodes `Enum`s by taking the ordinal value and then encoding that as an int32.

### Binary encoding

Binary is sent as follows:

```
Binary protocol, binary data, 4+ bytes:
+--------+--------+--------+--------+--------+...+--------+
| byte length                       | bytes                |
+--------+--------+--------+--------+--------+...+--------+
```

Where:

* `byte length` is the length of the byte array, a signed 32 bit integer encoded in network (big endian) order (must be >= 0).
* `bytes` are the bytes of the byte array.

### String encoding

*String*s are first encoded to UTF-8, and then send as binary.

### Double encoding

Values of type `double` are first converted to an int64 according to the IEEE 754 floating-point "double format" bit
layout. Most run-times provide a library to make this conversion. Both the binary protocol as the compact protocol then
encode the int64 in 8 bytes in big endian order.

### Boolean encoding

Values of `bool` type are first converted to an int8. True is converted to `1`, false to `0`.

## Message

A `Message` can be encoded in two different ways:

```
Binary protocol Message, strict encoding, 12+ bytes:
+--------+--------+--------+--------+--------+--------+--------+--------+--------+...+--------+--------+--------+--------+--------+
|1vvvvvvv|vvvvvvvv|unused  |00000mmm| name length                       | name                | seq id                            |
+--------+--------+--------+--------+--------+--------+--------+--------+--------+...+--------+--------+--------+--------+--------+
```

Where:

* `vvvvvvvvvvvvvvv` is the version, an unsigned 15 bit number fixed to `1` (in binary: `000 0000 0000 0001`).
  The leading bit is `1`.
* `unused` is an ignored byte.
* `mmm` is the message type, an unsigned 3 bit integer. The 5 leading bits must be `0` as some clients (checked for
  java in 0.9.1) take the whole byte.
* `name length` is the byte length of the name field, a signed 32 bit integer encoded in network (big endian) order (must be >= 0).
* `name` is the method name, a UTF-8 encoded string.
* `seq id` is the sequence id, a signed 32 bit integer encoded in network (big endian) order.

The second, older encoding (aka non-strict) is:

```
Binary protocol Message, old encoding, 9+ bytes:
+--------+--------+--------+--------+--------+...+--------+--------+--------+--------+--------+--------+
| name length                       | name                |00000mmm| seq id                            |
+--------+--------+--------+--------+--------+...+--------+--------+--------+--------+--------+--------+
```

Where `name length`, `name`, `mmm`, `seq id` are as above.

Because `name length` must be positive (therefore the first bit is always `0`), the first bit allows the receiver to see
whether the strict format or the old format is used. Therefore a server and client using the different variants of the
binary protocol can transparently talk with each other. However, when strict mode is enforced, the old format is
rejected.

Message types are encoded with the following values:

* _Call_: 1
* _Reply_: 2
* _Exception_: 3
* _Oneway_: 4

## Struct

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

In the binary protocol field headers and the stop field are encoded as follows:

```
Binary protocol field header and field value:
+--------+--------+--------+--------+...+--------+
|tttttttt| field id        | field value         |
+--------+--------+--------+--------+...+--------+

Binary protocol stop field:
+--------+
|00000000|
+--------+
```

Where:

* `tttttttt` the field-type, a signed 8 bit integer.
* `field id` the field-id, a signed 16 bit integer in big endian order.
* `field-value` the encoded field value.

The following field-types are used:

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

## List and Set

List and sets are encoded the same: a header indicating the size and the element-type of the elements, followed by the
encoded elements.

```
Binary protocol list (5+ bytes) and elements:
+--------+--------+--------+--------+--------+--------+...+--------+
|tttttttt| size                              | elements            |
+--------+--------+--------+--------+--------+--------+...+--------+
```

Where:

* `tttttttt` is the element-type, encoded as an int8
* `size` is the size, encoded as an int32, positive values only
* `elements` the element values

The element-type values are the same as field-types. The full list is included in the struct section above.

The maximum list/set size is configurable. By default there is no limit (meaning the limit is the maximum int32 value:
2147483647).

## Map

Maps are encoded with a header indicating the size, the element-type of the keys and the element-type of the elements,
followed by the encoded elements. The encoding follows this BNF:

```
map  ::=  key-element-type value-element-type size ( key value )*
```

```
Binary protocol map (6+ bytes) and key value pairs:
+--------+--------+--------+--------+--------+--------+--------+...+--------+
|kkkkkkkk|vvvvvvvv| size                              | key value pairs     |
+--------+--------+--------+--------+--------+--------+--------+...+--------+
```

Where:

* `kkkkkkkk` is the key element-type, encoded as an int8
* `vvvvvvvv` is the value element-type, encoded as an int8
* `size` is the size of the map, encoded as an int32, positive values only
* `key value pairs` are the encoded keys and values

The element-type values are the same as field-types. The full list is included in the struct section above.

The maximum map size is configurable. By default there is no limit (meaning the limit is the maximum int32 value:
2147483647).

# BNF notation used in this document

The following BNF notation is used:

* a plus `+` appended to an item represents repetition; the item is repeated 1 or more times
* a star `*` appended to an item represents optional repetition; the item is repeated 0 or more times
* a pipe `|` between items represents choice, the first matching item is selected
* parenthesis `(` and `)` are used for grouping multiple items
