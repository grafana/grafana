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
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

namespace c_glib TTest

enum MyEnum1 {
  ME1_0 = 0,
  ME1_1 = 1,
  ME1_2,
  ME1_3,
  ME1_5 = 5,
  ME1_6,
}

enum MyEnum2 {
  ME2_0,
  ME2_1,
  ME2_2,
}

enum MyEnum2_again {
  // enum value identifiers may appear again in another enum type
  ME0_1,
  ME1_1,
  ME2_1,
  ME3_1,
}

enum MyEnum3 {
  ME3_0,
  ME3_1,
  ME3_N2 = -2,
  ME3_N1,
  ME3_D0,
  ME3_D1,
  ME3_9 = 9,
  ME3_10,
}

enum MyEnum4 {
  ME4_A = 0x7ffffffd
  ME4_B
  ME4_C
  // attempting to define another enum value here fails
  // with an overflow error, as we overflow values that can be
  // represented with an i32.
}

enum MyEnum5 {
  e1        // fails with 0.9.3 and earlier
  e2 = 42   // fails with 0.9.3 and earlier
}

struct MyStruct {
  1: MyEnum2 me2_2 = MyEnum1.ME2_2
  2: MyEnum3 me3_n2 = MyEnum3.ME3_N2
  3: MyEnum3 me3_d1 = MyEnum3.ME3_D1
}

struct EnumTestStruct {
  1: MyEnum3 a_enum;
  2: list<MyEnum3> enum_list;
  3: set<MyEnum3> enum_set;
  4: map<MyEnum3, MyEnum3> enum_enum_map;
  // collections as keys
  44: map<list<MyEnum3> (python.immutable = ""), MyEnum3> list_enum_map;
  45: map<set<MyEnum3> (python.immutable = ""), MyEnum3> set_enum_map;
  46: map<map<MyEnum3,MyEnum3> (python.immutable = ""), MyEnum3> map_enum_map;
  // collections as values
  47: map<MyEnum3, map<MyEnum3, MyEnum3>> enum_map_map;
  48: map<MyEnum3, set<MyEnum3>> enum_set_map;
  49: map<MyEnum3, list<MyEnum3>> enum_list_map;
}

const EnumTestStruct ENUM_TEST = {
  'a_enum': MyEnum3.ME3_D1,
  'enum_list': [MyEnum3.ME3_D1, MyEnum3.ME3_0, MyEnum3.ME3_N2],
  'enum_set': [MyEnum3.ME3_D1, MyEnum3.ME3_N1],
  'enum_enum_map': {MyEnum3.ME3_D1: MyEnum3.ME3_0, MyEnum3.ME3_0: MyEnum3.ME3_D1},
  'list_enum_map': {[MyEnum3.ME3_D1, MyEnum3.ME3_0]: MyEnum3.ME3_0, [MyEnum3.ME3_D1]: MyEnum3.ME3_0, [MyEnum3.ME3_0]: MyEnum3.ME3_D1},
  'set_enum_map': {[MyEnum3.ME3_D1, MyEnum3.ME3_0]: MyEnum3.ME3_0, [MyEnum3.ME3_D1]: MyEnum3.ME3_0},
  'map_enum_map': {{MyEnum3.ME3_N1: MyEnum3.ME3_10}: MyEnum3.ME3_1},
  'enum_map_map': {MyEnum3.ME3_N1: {MyEnum3.ME3_D1: MyEnum3.ME3_D1}},
  'enum_set_map': {MyEnum3.ME3_N2: [MyEnum3.ME3_D1, MyEnum3.ME3_N1], MyEnum3.ME3_10: [MyEnum3.ME3_D1, MyEnum3.ME3_N1]},
  'enum_list_map': {MyEnum3.ME3_D1: [MyEnum3.ME3_10], MyEnum3.ME3_0: [MyEnum3.ME3_9, MyEnum3.ME3_10]},
}

service EnumTestService {
  MyEnum3 testEnum(1: MyEnum3 enum1),
  list<MyEnum3> testEnumList(1: list<MyEnum3> enum1),
  set<MyEnum3> testEnumSet(1: set<MyEnum3> enum1),
  map<MyEnum3, MyEnum3> testEnumMap(1: map<MyEnum3, MyEnum3> enum1),
  EnumTestStruct testEnumStruct(1: EnumTestStruct enum1),
}
