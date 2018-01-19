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

#define _USE_MATH_DEFINES
#include <cmath>
#include "gen-cpp/DebugProtoTest_types.h"
#include <thrift/protocol/TDebugProtocol.h>

#define BOOST_TEST_MODULE DebugProtoTest
#include <boost/test/unit_test.hpp>

using namespace thrift::test::debug;

static std::auto_ptr<OneOfEach> ooe;

void testCaseSetup_1() {
  ooe.reset(new OneOfEach);
  ooe->im_true = true;
  ooe->im_false = false;
  ooe->a_bite = 0x7f;
  ooe->integer16 = 27000;
  ooe->integer32 = 1 << 24;
  ooe->integer64 = (uint64_t)6000 * 1000 * 1000;
  ooe->double_precision = M_PI;
  ooe->some_characters = "Debug THIS!";
  ooe->zomg_unicode = "\xd7\n\a\t";
}

BOOST_AUTO_TEST_CASE(test_debug_proto_1) {
  testCaseSetup_1();

  const std::string expected_result(
    "OneOfEach {\n"
    "  01: im_true (bool) = true,\n"
    "  02: im_false (bool) = false,\n"
    "  03: a_bite (byte) = 0x7f,\n"
    "  04: integer16 (i16) = 27000,\n"
    "  05: integer32 (i32) = 16777216,\n"
    "  06: integer64 (i64) = 6000000000,\n"
    "  07: double_precision (double) = 3.1415926535897931,\n"
    "  08: some_characters (string) = \"Debug THIS!\",\n"
    "  09: zomg_unicode (string) = \"\\xd7\\n\\a\\t\",\n"
    "  10: what_who (bool) = false,\n"
    "  11: base64 (string) = \"\",\n"
    "  12: byte_list (list) = list<byte>[3] {\n"
    "    [0] = 0x01,\n"
    "    [1] = 0x02,\n"
    "    [2] = 0x03,\n"
    "  },\n"
    "  13: i16_list (list) = list<i16>[3] {\n"
    "    [0] = 1,\n"
    "    [1] = 2,\n"
    "    [2] = 3,\n"
    "  },\n"
    "  14: i64_list (list) = list<i64>[3] {\n"
    "    [0] = 1,\n"
    "    [1] = 2,\n"
    "    [2] = 3,\n"
    "  },\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(*ooe));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

static std::auto_ptr<Nesting> n;

void testCaseSetup_2() {
  testCaseSetup_1();

  n.reset(new Nesting);
  n->my_ooe = *ooe;
  n->my_ooe.integer16 = 16;
  n->my_ooe.integer32 = 32;
  n->my_ooe.integer64 = 64;
  n->my_ooe.double_precision = (std::sqrt(5.0) + 1) / 2;
  n->my_ooe.some_characters = ":R (me going \"rrrr\")";
  n->my_ooe.zomg_unicode     = "\xd3\x80\xe2\x85\xae\xce\x9d\x20\xd0\x9d\xce"
                               "\xbf\xe2\x85\xbf\xd0\xbe\xc9\xa1\xd0\xb3\xd0"
                               "\xb0\xcf\x81\xe2\x84\x8e\x20\xce\x91\x74\x74"
                               "\xce\xb1\xe2\x85\xbd\xce\xba\xc7\x83\xe2\x80"
                               "\xbc";
  n->my_bonk.type = 31337;
  n->my_bonk.message = "I am a bonk... xor!";
}

BOOST_AUTO_TEST_CASE(test_debug_proto_2) {
  testCaseSetup_2();

  const std::string expected_result(
    "Nesting {\n"
    "  01: my_bonk (struct) = Bonk {\n"
    "    01: type (i32) = 31337,\n"
    "    02: message (string) = \"I am a bonk... xor!\",\n"
    "  },\n"
    "  02: my_ooe (struct) = OneOfEach {\n"
    "    01: im_true (bool) = true,\n"
    "    02: im_false (bool) = false,\n"
    "    03: a_bite (byte) = 0x7f,\n"
    "    04: integer16 (i16) = 16,\n"
    "    05: integer32 (i32) = 32,\n"
    "    06: integer64 (i64) = 64,\n"
    "    07: double_precision (double) = 1.6180339887498949,\n"
    "    08: some_characters (string) = \":R (me going \\\"rrrr\\\")\",\n"
    "    09: zomg_unicode (string) = \"\\xd3\\x80\\xe2\\x85\\xae\\xce\\x9d \\xd"
      "0\\x9d\\xce\\xbf\\xe2\\x85\\xbf\\xd0\\xbe\\xc9\\xa1\\xd0\\xb3\\xd0\\xb0"
      "\\xcf\\x81\\xe2\\x84\\x8e \\xce\\x91tt\\xce\\xb1\\xe2\\x85\\xbd\\xce\\xb"
      "a\\xc7\\x83\\xe2\\x80\\xbc\",\n"
    "    10: what_who (bool) = false,\n"
    "    11: base64 (string) = \"\",\n"
    "    12: byte_list (list) = list<byte>[3] {\n"
    "      [0] = 0x01,\n"
    "      [1] = 0x02,\n"
    "      [2] = 0x03,\n"
    "    },\n"
    "    13: i16_list (list) = list<i16>[3] {\n"
    "      [0] = 1,\n"
    "      [1] = 2,\n"
    "      [2] = 3,\n"
    "    },\n"
    "    14: i64_list (list) = list<i64>[3] {\n"
    "      [0] = 1,\n"
    "      [1] = 2,\n"
    "      [2] = 3,\n"
    "    },\n"
    "  },\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(*n));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

static std::auto_ptr<HolyMoley> hm;

void testCaseSetup_3() {
  testCaseSetup_2();

  hm.reset(new HolyMoley);

  hm->big.push_back(*ooe);
  hm->big.push_back(n->my_ooe);
  hm->big[0].a_bite = 0x22;
  hm->big[1].a_bite = 0x33;

  std::vector<std::string> stage1;
  stage1.push_back("and a one");
  stage1.push_back("and a two");
  hm->contain.insert(stage1);
  stage1.clear();
  stage1.push_back("then a one, two");
  stage1.push_back("three!");
  stage1.push_back("FOUR!!");
  hm->contain.insert(stage1);
  stage1.clear();
  hm->contain.insert(stage1);

  std::vector<Bonk> stage2;
  hm->bonks["nothing"] = stage2;
  stage2.resize(stage2.size() + 1);
  stage2.back().type = 1;
  stage2.back().message = "Wait.";
  stage2.resize(stage2.size() + 1);
  stage2.back().type = 2;
  stage2.back().message = "What?";
  hm->bonks["something"] = stage2;
  stage2.clear();
  stage2.resize(stage2.size() + 1);
  stage2.back().type = 3;
  stage2.back().message = "quoth";
  stage2.resize(stage2.size() + 1);
  stage2.back().type = 4;
  stage2.back().message = "the raven";
  stage2.resize(stage2.size() + 1);
  stage2.back().type = 5;
  stage2.back().message = "nevermore";
  hm->bonks["poe"] = stage2;
}

BOOST_AUTO_TEST_CASE(test_debug_proto_3) {
  testCaseSetup_3();

  const std::string expected_result(
    "HolyMoley {\n"
    "  01: big (list) = list<struct>[2] {\n"
    "    [0] = OneOfEach {\n"
    "      01: im_true (bool) = true,\n"
    "      02: im_false (bool) = false,\n"
    "      03: a_bite (byte) = 0x22,\n"
    "      04: integer16 (i16) = 27000,\n"
    "      05: integer32 (i32) = 16777216,\n"
    "      06: integer64 (i64) = 6000000000,\n"
    "      07: double_precision (double) = 3.1415926535897931,\n"
    "      08: some_characters (string) = \"Debug THIS!\",\n"
    "      09: zomg_unicode (string) = \"\\xd7\\n\\a\\t\",\n"
    "      10: what_who (bool) = false,\n"
    "      11: base64 (string) = \"\",\n"
    "      12: byte_list (list) = list<byte>[3] {\n"
    "        [0] = 0x01,\n"
    "        [1] = 0x02,\n"
    "        [2] = 0x03,\n"
    "      },\n"
    "      13: i16_list (list) = list<i16>[3] {\n"
    "        [0] = 1,\n"
    "        [1] = 2,\n"
    "        [2] = 3,\n"
    "      },\n"
    "      14: i64_list (list) = list<i64>[3] {\n"
    "        [0] = 1,\n"
    "        [1] = 2,\n"
    "        [2] = 3,\n"
    "      },\n"
    "    },\n"
    "    [1] = OneOfEach {\n"
    "      01: im_true (bool) = true,\n"
    "      02: im_false (bool) = false,\n"
    "      03: a_bite (byte) = 0x33,\n"
    "      04: integer16 (i16) = 16,\n"
    "      05: integer32 (i32) = 32,\n"
    "      06: integer64 (i64) = 64,\n"
    "      07: double_precision (double) = 1.6180339887498949,\n"
    "      08: some_characters (string) = \":R (me going \\\"rrrr\\\")\",\n"
    "      09: zomg_unicode (string) = \"\\xd3\\x80\\xe2\\x85\\xae\\xce\\x9d \\"
      "xd0\\x9d\\xce\\xbf\\xe2\\x85\\xbf\\xd0\\xbe\\xc9\\xa1\\xd0\\xb3\\xd0\\xb"
      "0\\xcf\\x81\\xe2\\x84\\x8e \\xce\\x91tt\\xce\\xb1\\xe2\\x85\\xbd\\xce\\x"
      "ba\\xc7\\x83\\xe2\\x80\\xbc\",\n"
    "      10: what_who (bool) = false,\n"
    "      11: base64 (string) = \"\",\n"
    "      12: byte_list (list) = list<byte>[3] {\n"
    "        [0] = 0x01,\n"
    "        [1] = 0x02,\n"
    "        [2] = 0x03,\n"
    "      },\n"
    "      13: i16_list (list) = list<i16>[3] {\n"
    "        [0] = 1,\n"
    "        [1] = 2,\n"
    "        [2] = 3,\n"
    "      },\n"
    "      14: i64_list (list) = list<i64>[3] {\n"
    "        [0] = 1,\n"
    "        [1] = 2,\n"
    "        [2] = 3,\n"
    "      },\n"
    "    },\n"
    "  },\n"
    "  02: contain (set) = set<list>[3] {\n"
    "    list<string>[0] {\n"
    "    },\n"
    "    list<string>[2] {\n"
    "      [0] = \"and a one\",\n"
    "      [1] = \"and a two\",\n"
    "    },\n"
    "    list<string>[3] {\n"
    "      [0] = \"then a one, two\",\n"
    "      [1] = \"three!\",\n"
    "      [2] = \"FOUR!!\",\n"
    "    },\n"
    "  },\n"
    "  03: bonks (map) = map<string,list>[3] {\n"
    "    \"nothing\" -> list<struct>[0] {\n"
    "    },\n"
    "    \"poe\" -> list<struct>[3] {\n"
    "      [0] = Bonk {\n"
    "        01: type (i32) = 3,\n"
    "        02: message (string) = \"quoth\",\n"
    "      },\n"
    "      [1] = Bonk {\n"
    "        01: type (i32) = 4,\n"
    "        02: message (string) = \"the raven\",\n"
    "      },\n"
    "      [2] = Bonk {\n"
    "        01: type (i32) = 5,\n"
    "        02: message (string) = \"nevermore\",\n"
    "      },\n"
    "    },\n"
    "    \"something\" -> list<struct>[2] {\n"
    "      [0] = Bonk {\n"
    "        01: type (i32) = 1,\n"
    "        02: message (string) = \"Wait.\",\n"
    "      },\n"
    "      [1] = Bonk {\n"
    "        01: type (i32) = 2,\n"
    "        02: message (string) = \"What?\",\n"
    "      },\n"
    "    },\n"
    "  },\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(*hm));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}
