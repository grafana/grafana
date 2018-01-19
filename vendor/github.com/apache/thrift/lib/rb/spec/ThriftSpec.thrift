/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

namespace rb SpecNamespace

struct Hello {
  1: string greeting = "hello world"
}

enum SomeEnum {
  ONE
  TWO
}

struct StructWithSomeEnum {
  1: SomeEnum some_enum;
}

union TestUnion {
  /**
   * A doc string
   */
  1: string string_field;
  2: i32 i32_field;
  3: i32 other_i32_field;
  4: SomeEnum enum_field;
  5: binary binary_field;
}

struct Foo {
  1: i32 simple = 53,
  2: string words = "words",
  3: Hello hello = {'greeting' : "hello, world!"},
  4: list<i32> ints = [1, 2, 2, 3],
  5: map<i32, map<string, double>> complex,
  6: set<i16> shorts = [5, 17, 239],
  7: optional string opt_string
  8: bool my_bool
}

struct Foo2 {
  1: binary my_binary
}

struct BoolStruct {
  1: bool yesno = 1
}

struct SimpleList {
  1: list<bool> bools,
  2: list<byte> bytes,
  3: list<i16> i16s,
  4: list<i32> i32s,
  5: list<i64> i64s,
  6: list<double> doubles,
  7: list<string> strings,
  8: list<map<i16, i16>> maps,
  9: list<list<i16>> lists,
  10: list<set<i16>> sets,
  11: list<Hello> hellos
}

exception Xception {
  1: string message,
  2: i32 code = 1
}

service NonblockingService {
  Hello greeting(1:bool english)
  bool block()
  oneway void unblock(1:i32 n)
  oneway void shutdown()
  void sleep(1:double seconds)
}

union My_union {
  1: bool im_true,
  2: byte a_bite,
  3: i16 integer16,
  4: i32 integer32,
  5: i64 integer64,
  6: double double_precision,
  7: string some_characters,
  8: i32 other_i32
  9: SomeEnum some_enum;
  10: map<SomeEnum, list<SomeEnum>> my_map;
}

struct Struct_with_union {
  1: My_union fun_union
  2: i32 integer32
  3: string some_characters
}

struct StructWithEnumMap {
  1: map<SomeEnum, list<SomeEnum>> my_map;
}

# Nested lists
struct NestedListInList {
  1: list<list<byte>> value
}

struct NestedListInSet {
  1: set<list<byte>> value
}

struct NestedListInMapKey {
  1: map<list<byte>, byte> value
}

struct NestedListInMapValue {
  1: map<byte, list<byte>> value
}

# Nested sets
struct NestedSetInList {
  1: list<set<byte>> value
}

struct NestedSetInSet {
  1: set<set<byte>> value
}

struct NestedSetInMapKey {
  1: map<set<byte>, byte> value
}

struct NestedSetInMapValue {
  1: map<byte, set<byte>> value
}

# Nested maps
struct NestedMapInList {
  1: list<map<byte, byte>> value
}

struct NestedMapInSet {
  1: set<map<byte, byte>> value
}

struct NestedMapInMapKey {
  2: map<map<byte, byte>, byte> value
}

struct NestedMapInMapValue {
  2: map<byte, map<byte, byte>> value
}
