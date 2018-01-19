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

namespace c_glib TTest
namespace cpp thrift.test.debug
namespace java thrift.test
namespace rb thrift.test

struct Doubles {
 1: double nan,
 2: double inf,
 3: double neginf,
 4: double repeating,
 5: double big,
 6: double tiny,
 7: double zero,
 8: double negzero,
}

struct OneOfEach {
  1: bool im_true,
  2: bool im_false,
  3: i8 a_bite = 0x7f,
  4: i16 integer16 = 0x7fff,
  5: i32 integer32,
  6: i64 integer64 = 10000000000,
  7: double double_precision,
  8: string some_characters,
  9: string zomg_unicode,
  10: bool what_who,
  11: binary base64,
  12: list<i8> byte_list = [1, 2, 3],
  13: list<i16> i16_list = [1,2,3],
  14: list<i64> i64_list = [1,2,3]
}

struct Bonk {
  1: i32 type,
  2: string message,
}

struct Nesting {
  1: Bonk my_bonk,
  2: OneOfEach my_ooe,
}

struct HolyMoley {
  1: list<OneOfEach> big,
  2: set<list<string> (python.immutable = "")> contain,
  3: map<string,list<Bonk>> bonks,
}

struct Backwards {
  2: i32 first_tag2,
  1: i32 second_tag1,
}

struct Empty {
} (
  python.immutable = "",
)

struct Wrapper {
  1: Empty foo
} (
  python.immutable = "",
)

struct RandomStuff {
  1: i32 a,
  2: i32 b,
  3: i32 c,
  4: i32 d,
  5: list<i32> myintlist,
  6: map<i32,Wrapper> maps,
  7: i64 bigint,
  8: double triple,
}

struct Base64 {
  1: i32 a,
  2: binary b1,
  3: binary b2,
  4: binary b3,
  5: binary b4,
  6: binary b5,
  7: binary b6,
}

struct CompactProtoTestStruct {
  // primitive fields
  1: i8     a_byte;
  2: i16    a_i16;
  3: i32    a_i32;
  4: i64    a_i64;
  5: double a_double;
  6: string a_string;
  7: binary a_binary;
  8: bool   true_field;
  9: bool   false_field;
  10: Empty empty_struct_field;

  // primitives in lists
  11: list<i8>      byte_list;
  12: list<i16>     i16_list;
  13: list<i32>     i32_list;
  14: list<i64>     i64_list;
  15: list<double>  double_list;
  16: list<string>  string_list;
  17: list<binary>  binary_list;
  18: list<bool>    boolean_list;
  19: list<Empty>   struct_list;

  // primitives in sets
  20: set<i8>       byte_set;
  21: set<i16>      i16_set;
  22: set<i32>      i32_set;
  23: set<i64>      i64_set;
  24: set<double>   double_set;
  25: set<string>   string_set;
  26: set<binary>   binary_set;
  27: set<bool>     boolean_set;
  28: set<Empty>    struct_set;

  // maps
  // primitives as keys
  29: map<i8, i8>               byte_byte_map;
  30: map<i16, i8>              i16_byte_map;
  31: map<i32, i8>              i32_byte_map;
  32: map<i64, i8>              i64_byte_map;
  33: map<double, i8>           double_byte_map;
  34: map<string, i8>           string_byte_map;
  35: map<binary, i8>           binary_byte_map;
  36: map<bool, i8>             boolean_byte_map;
  // primitives as values
  37: map<i8, i16>              byte_i16_map;
  38: map<i8, i32>              byte_i32_map;
  39: map<i8, i64>              byte_i64_map;
  40: map<i8, double>           byte_double_map;
  41: map<i8, string>           byte_string_map;
  42: map<i8, binary>           byte_binary_map;
  43: map<i8, bool>             byte_boolean_map;
  // collections as keys
  44: map<list<i8> (python.immutable = ""), i8>       list_byte_map;
  45: map<set<i8> (python.immutable = ""), i8>        set_byte_map;
  46: map<map<i8,i8> (python.immutable = ""), i8>     map_byte_map;
  // collections as values
  47: map<i8, map<i8,i8>>     byte_map_map;
  48: map<i8, set<i8>>        byte_set_map;
  49: map<i8, list<i8>>       byte_list_map;
}

// To be used to test the serialization of an empty map
struct SingleMapTestStruct {
  1: required map<i32, i32>       i32_map;
}

const CompactProtoTestStruct COMPACT_TEST = {
  'a_byte'             : 127,
  'a_i16'              : 32000,
  'a_i32'              : 1000000000,
  'a_i64'              : 0xffffffffff,
  'a_double'           : 5.6789,
  'a_string'           : "my string",
//'a_binary,'
  'true_field'         : 1,
  'false_field'        : 0,
  'empty_struct_field' : {},
  'byte_list'          : [-127, -1, 0, 1, 127],
  'i16_list'           : [-1, 0, 1, 0x7fff],
  'i32_list'           : [-1, 0, 0xff, 0xffff, 0xffffff, 0x7fffffff],
  'i64_list'           : [-1, 0, 0xff, 0xffff, 0xffffff, 0xffffffff, 0xffffffffff, 0xffffffffffff, 0xffffffffffffff, 0x7fffffffffffffff],
  'double_list'        : [0.1, 0.2, 0.3],
  'string_list'        : ["first", "second", "third"],
//'binary_list,'
  'boolean_list'       : [1, 1, 1, 0, 0, 0],
  'struct_list'        : [{}, {}],
  'byte_set'           : [-127, -1, 0, 1, 127],
  'i16_set'            : [-1, 0, 1, 0x7fff],
  'i32_set'            : [1, 2, 3],
  'i64_set'            : [-1, 0, 0xff, 0xffff, 0xffffff, 0xffffffff, 0xffffffffff, 0xffffffffffff, 0xffffffffffffff, 0x7fffffffffffffff],
  'double_set'         : [0.1, 0.2, 0.3],
  'string_set'         : ["first", "second", "third"],
//'binary_set,'
  'boolean_set'        : [1, 0],
  'struct_set'         : [{}],
  'byte_byte_map'      : {1 : 2},
  'i16_byte_map'       : {1 : 1, -1 : 1, 0x7fff : 1},
  'i32_byte_map'       : {1 : 1, -1 : 1, 0x7fffffff : 1},
  'i64_byte_map'       : {0 : 1,  1 : 1, -1 : 1, 0x7fffffffffffffff : 1},
  'double_byte_map'    : {-1.1 : 1, 1.1 : 1},
  'string_byte_map'    : {"first" : 1, "second" : 2, "third" : 3, "" : 0},
//'binary_byte_map,'
  'boolean_byte_map'   : {1 : 1, 0 : 0},
  'byte_i16_map'       : {1 : 1, 2 : -1, 3 : 0x7fff},
  'byte_i32_map'       : {1 : 1, 2 : -1, 3 : 0x7fffffff},
  'byte_i64_map'       : {1 : 1, 2 : -1, 3 : 0x7fffffffffffffff},
  'byte_double_map'    : {1 : 0.1, 2 : -0.1, 3 : 1000000.1},
  'byte_string_map'    : {1 : "", 2 : "blah", 3 : "loooooooooooooong string"},
//'byte_binary_map,'
  'byte_boolean_map'   : {1 : 1, 2 : 0},
  'list_byte_map'      : {[1, 2, 3] : 1, [0, 1] : 2, [] : 0},
  'set_byte_map'       : {[1, 2, 3] : 1, [0, 1] : 2, [] : 0},
  'map_byte_map'       : {{1 : 1} : 1, {2 : 2} : 2, {} : 0},
  'byte_map_map'       : {0 : {}, 1 : {1 : 1}, 2 : {1 : 1, 2 : 2}},
  'byte_set_map'       : {0 : [], 1 : [1], 2 : [1, 2]},
  'byte_list_map'      : {0 : [], 1 : [1], 2 : [1, 2]},
}


const i32 MYCONST = 2


exception ExceptionWithAMap {
  1: string blah;
  2: map<string, string> map_field;
}

service ServiceForExceptionWithAMap {
  void methodThatThrowsAnException() throws (1: ExceptionWithAMap xwamap);
}

service Srv {
  i32 Janky(1: i32 arg);

  // return type only methods

  void voidMethod();
  i32 primitiveMethod();
  CompactProtoTestStruct structMethod();

  void methodWithDefaultArgs(1: i32 something = MYCONST);

  oneway void onewayMethod();

  bool declaredExceptionMethod(1: bool shouldThrow) throws (1: ExceptionWithAMap xwamap);
}

service Inherited extends Srv {
  i32 identity(1: i32 arg)
}

service EmptyService {}

// The only purpose of this thing is to increase the size of the generated code
// so that ZlibTest has more highly compressible data to play with.
struct BlowUp {
  1: map<list<i32>(python.immutable = ""),set<map<i32,string> (python.immutable = "")>> b1;
  2: map<list<i32>(python.immutable = ""),set<map<i32,string> (python.immutable = "")>> b2;
  3: map<list<i32>(python.immutable = ""),set<map<i32,string> (python.immutable = "")>> b3;
  4: map<list<i32>(python.immutable = ""),set<map<i32,string> (python.immutable = "")>> b4;
}


struct ReverseOrderStruct {
  4: string first;
  3: i16 second;
  2: i32 third;
  1: i64 fourth;
}

service ReverseOrderService {
  void myMethod(4: string first, 3: i16 second, 2: i32 third, 1: i64 fourth);
}

enum SomeEnum {
  ONE = 1
  TWO = 2
}

/** This is a docstring on a constant! */
const SomeEnum MY_SOME_ENUM = SomeEnum.ONE

const SomeEnum MY_SOME_ENUM_1 = 1
/*const SomeEnum MY_SOME_ENUM_2 = 7*/

const map<SomeEnum,SomeEnum> MY_ENUM_MAP = {
  SomeEnum.ONE : SomeEnum.TWO
}

struct StructWithSomeEnum {
  1: SomeEnum blah;
}

const map<SomeEnum,StructWithSomeEnum> EXTRA_CRAZY_MAP = {
  SomeEnum.ONE : {"blah" : SomeEnum.TWO}
}

union TestUnion {
  /**
   * A doc string
   */
  1: string string_field;
  2: i32 i32_field;
  3: OneOfEach struct_field;
  4: list<RandomStuff> struct_list;
  5: i32 other_i32_field;
  6: SomeEnum enum_field;
  7: set<i32> i32_set;
  8: map<i32, i32> i32_map;
}

union TestUnionMinusStringField {
  2: i32 i32_field;
  3: OneOfEach struct_field;
  4: list<RandomStuff> struct_list;
  5: i32 other_i32_field;
  6: SomeEnum enum_field;
  7: set<i32> i32_set;
  8: map<i32, i32> i32_map;
}

union ComparableUnion {
  1: string string_field;
  2: binary binary_field;
}

struct StructWithAUnion {
  1: TestUnion test_union;
}

struct PrimitiveThenStruct {
  1: i32 blah;
  2: i32 blah2;
  3: Backwards bw;
}

typedef map<i32,i32> SomeMap

struct StructWithASomemap {
  1: required SomeMap somemap_field;
}

struct BigFieldIdStruct {
  1: string field1;
  45: string field2;
}

struct BreaksRubyCompactProtocol {
  1: string field1;
  2: BigFieldIdStruct field2;
  3: i32 field3;
}

struct TupleProtocolTestStruct {
  optional i32 field1;
  optional i32 field2;
  optional i32 field3;
  optional i32 field4;
  optional i32 field5;
  optional i32 field6;
  optional i32 field7;
  optional i32 field8;
  optional i32 field9;
  optional i32 field10;
  optional i32 field11;
  optional i32 field12;
}

struct ListDoublePerf {
  1: list<double> field;
}
