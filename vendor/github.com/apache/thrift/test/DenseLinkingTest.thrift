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

/*
../compiler/cpp/thrift -gen cpp:dense DebugProtoTest.thrift
../compiler/cpp/thrift -gen cpp:dense DenseLinkingTest.thrift
g++ -Wall -g -I../lib/cpp/src -I/usr/local/include/boost-1_33_1 \
  DebugProtoTest.cpp gen-cpp/DebugProtoTest_types.cpp \
  gen-cpp/DenseLinkingTest_types.cpp \
  ../lib/cpp/.libs/libthrift.a -o DebugProtoTest
./DebugProtoTest
*/

/*
The idea of this test is that everything is structurally identical to DebugProtoTest.
If I messed up the naming of the reflection local typespecs,
then compiling this should give errors because of doubly defined symbols.
*/

namespace cpp thrift.test
namespace java thrift.test

struct OneOfEachZZ {
  1: bool im_true,
  2: bool im_false,
  3: byte a_bite,
  4: i16 integer16,
  5: i32 integer32,
  6: i64 integer64,
  7: double double_precision,
  8: string some_characters,
  9: string zomg_unicode,
  10: bool what_who,
}

struct BonkZZ {
  1: i32 type,
  2: string message,
}

struct NestingZZ {
  1: BonkZZ my_bonk,
  2: OneOfEachZZ my_ooe,
}

struct HolyMoleyZZ {
  1: list<OneOfEachZZ> big,
  2: set<list<string>> contain,
  3: map<string,list<BonkZZ>> bonks,
}

struct BackwardsZZ {
  2: i32 first_tag2,
  1: i32 second_tag1,
}

struct EmptyZZ {
}

struct WrapperZZ {
  1: EmptyZZ foo
}

struct RandomStuffZZ {
  1: i32 a,
  2: i32 b,
  3: i32 c,
  4: i32 d,
  5: list<i32> myintlist,
  6: map<i32,WrapperZZ> maps,
  7: i64 bigint,
  8: double triple,
}

service Srv {
  i32 Janky(1: i32 arg)
}

service UnderscoreSrv {
  i64 some_rpc_call(1: string message)
}

