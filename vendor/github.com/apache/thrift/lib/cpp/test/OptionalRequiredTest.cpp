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

#include <map>
#include <thrift/protocol/TDebugProtocol.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/transport/TBufferTransports.h>
#include "gen-cpp/OptionalRequiredTest_types.h"

#define BOOST_TEST_MODULE OptionalRequiredTest
#include <boost/test/unit_test.hpp>

using namespace thrift::test;
using namespace apache::thrift;
using namespace apache::thrift::transport;
using namespace apache::thrift::protocol;

/*
template<typename Struct>
void trywrite(const Struct& s, bool should_work) {
  bool worked;
  try {
    TBinaryProtocol protocol(boost::shared_ptr<TTransport>(new TMemoryBuffer));
    s.write(&protocol);
    worked = true;
  } catch (TProtocolException & ex) {
    worked = false;
  }
  BOOST_CHECK(worked == should_work);
}
*/

template <typename Struct1, typename Struct2>
void write_to_read(const Struct1& w, Struct2& r) {
  TBinaryProtocol protocol(boost::shared_ptr<TTransport>(new TMemoryBuffer));
  w.write(&protocol);
  r.read(&protocol);
}

BOOST_AUTO_TEST_CASE(test_optional_required_1) {
  OldSchool o;

  const std::string expected_result(
    "OldSchool {\n"
    "  01: im_int (i16) = 0,\n"
    "  02: im_str (string) = \"\",\n"
    "  03: im_big (list) = list<map>[0] {\n"
    "  },\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(o));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

BOOST_AUTO_TEST_CASE(test_optional_required_2_1) {
  Simple s;

  const std::string expected_result(
    "Simple {\n"
    "  01: im_default (i16) = 0,\n"
    "  02: im_required (i16) = 0,\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(s));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

BOOST_AUTO_TEST_CASE(test_optional_required_2_2) {
  Simple s;
  s.im_optional = 10;

  const std::string expected_result(
    "Simple {\n"
    "  01: im_default (i16) = 0,\n"
    "  02: im_required (i16) = 0,\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(s));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

BOOST_AUTO_TEST_CASE(test_optional_required_2_3) {
  Simple s;
  s.im_optional = 10;
  s.__isset.im_optional = true;

  const std::string expected_result(
    "Simple {\n"
    "  01: im_default (i16) = 0,\n"
    "  02: im_required (i16) = 0,\n"
    "  03: im_optional (i16) = 10,\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(s));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

BOOST_AUTO_TEST_CASE(test_optional_required_2_4) {
  Simple s;
  s.__isset.im_optional = true;

  const std::string expected_result(
    "Simple {\n"
    "  01: im_default (i16) = 0,\n"
    "  02: im_required (i16) = 0,\n"
    "  03: im_optional (i16) = 0,\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(s));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

BOOST_AUTO_TEST_CASE(test_optional_required_2_5) {
  Simple s;
  s.__isset.im_optional = true;
  s.im_optional = 10;

  const std::string expected_result(
    "Simple {\n"
    "  01: im_default (i16) = 0,\n"
    "  02: im_required (i16) = 0,\n"
    "  03: im_optional (i16) = 10,\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(s));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

BOOST_AUTO_TEST_CASE(test_optional_required_3) {
  // assign/copy-construct with non-required fields

  Simple s1, s2;
  s1.__isset.im_default = true;
  s1.__set_im_optional(10);
  BOOST_CHECK(s1.__isset.im_default);
  BOOST_CHECK(s1.__isset.im_optional);

  s2 = s1;

  BOOST_CHECK(s2.__isset.im_default);
  BOOST_CHECK(s2.__isset.im_optional);

  Simple s3(s1);

  BOOST_CHECK(s3.__isset.im_default);
  BOOST_CHECK(s3.__isset.im_optional);
}

BOOST_AUTO_TEST_CASE(test_optional_required_4) {
  // Write-to-read with optional fields.

  Simple s1, s2, s3;
  s1.im_optional = 10;
  BOOST_CHECK(!s1.__isset.im_default);
  // BOOST_CHECK(!s1.__isset.im_required);  // Compile error.
  BOOST_CHECK(!s1.__isset.im_optional);

  write_to_read(s1, s2);

  BOOST_CHECK(s2.__isset.im_default);
  // BOOST_CHECK( s2.__isset.im_required);  // Compile error.
  BOOST_CHECK(!s2.__isset.im_optional);
  BOOST_CHECK(s3.im_optional == 0);

  s1.__isset.im_optional = true;
  write_to_read(s1, s3);

  BOOST_CHECK(s3.__isset.im_default);
  // BOOST_CHECK( s3.__isset.im_required);  // Compile error.
  BOOST_CHECK(s3.__isset.im_optional);
  BOOST_CHECK(s3.im_optional == 10);
}

BOOST_AUTO_TEST_CASE(test_optional_required_5) {
  // Writing between optional and default.

  Tricky1 t1;
  Tricky2 t2;

  t2.im_optional = 10;
  write_to_read(t2, t1);
  write_to_read(t1, t2);
  BOOST_CHECK(!t1.__isset.im_default);
  BOOST_CHECK(t2.__isset.im_optional);
  BOOST_CHECK(t1.im_default == t2.im_optional);
  BOOST_CHECK(t1.im_default == 0);
}

BOOST_AUTO_TEST_CASE(test_optional_required_6) {
  // Writing between default and required.

  Tricky1 t1;
  Tricky3 t3;
  write_to_read(t1, t3);
  write_to_read(t3, t1);
  BOOST_CHECK(t1.__isset.im_default);
}

BOOST_AUTO_TEST_CASE(test_optional_required_7) {
  // Writing between optional and required.

  Tricky2 t2;
  Tricky3 t3;
  t2.__isset.im_optional = true;
  write_to_read(t2, t3);
  write_to_read(t3, t2);
}

BOOST_AUTO_TEST_CASE(test_optional_required_8) {
  // Mu-hu-ha-ha-ha!

  Tricky2 t2;
  Tricky3 t3;
  try {
    write_to_read(t2, t3);
    abort();
  } catch (const TProtocolException&) {
  }

  write_to_read(t3, t2);
  BOOST_CHECK(t2.__isset.im_optional);
}

BOOST_AUTO_TEST_CASE(test_optional_required_9) {
  Complex c;

  const std::string expected_result(
    "Complex {\n"
    "  01: cp_default (i16) = 0,\n"
    "  02: cp_required (i16) = 0,\n"
    "  04: the_map (map) = map<i16,struct>[0] {\n"
    "  },\n"
    "  05: req_simp (struct) = Simple {\n"
    "    01: im_default (i16) = 0,\n"
    "    02: im_required (i16) = 0,\n"
    "  },\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(c));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

BOOST_AUTO_TEST_CASE(test_optional_required_10) {
  Tricky1 t1;
  Tricky2 t2;
  // Compile error.
  //(void)(t1 == t2);
}

BOOST_AUTO_TEST_CASE(test_optional_required_11) {
  OldSchool o1, o2, o3;
  BOOST_CHECK(o1 == o2);
  o1.im_int = o2.im_int = 10;
  BOOST_CHECK(o1 == o2);
  o1.__isset.im_int = true;
  o2.__isset.im_int = false;
  BOOST_CHECK(o1 == o2);
  o1.im_int = 20;
  o1.__isset.im_int = false;
  BOOST_CHECK(o1 != o2);
  o1.im_int = 10;
  BOOST_CHECK(o1 == o2);
  o1.im_str = o2.im_str = "foo";
  BOOST_CHECK(o1 == o2);
  o1.__isset.im_str = o2.__isset.im_str = true;
  BOOST_CHECK(o1 == o2);
  std::map<int32_t, std::string> mymap;
  mymap[1] = "bar";
  mymap[2] = "baz";
  o1.im_big.push_back(std::map<int32_t, std::string>());
  BOOST_CHECK(o1 != o2);
  o2.im_big.push_back(std::map<int32_t, std::string>());
  BOOST_CHECK(o1 == o2);
  o2.im_big.push_back(mymap);
  BOOST_CHECK(o1 != o2);
  o1.im_big.push_back(mymap);
  BOOST_CHECK(o1 == o2);

  TBinaryProtocol protocol(boost::shared_ptr<TTransport>(new TMemoryBuffer));
  o1.write(&protocol);

  o1.im_big.push_back(mymap);
  mymap[3] = "qux";
  o2.im_big.push_back(mymap);
  BOOST_CHECK(o1 != o2);
  o1.im_big.back()[3] = "qux";
  BOOST_CHECK(o1 == o2);
  
  o3.read(&protocol);
  o3.im_big.push_back(mymap);
  BOOST_CHECK(o1 == o3);

  const std::string expected_result(
    "OldSchool {\n"
    "  01: im_int (i16) = 10,\n"
    "  02: im_str (string) = \"foo\",\n"
    "  03: im_big (list) = list<map>[3] {\n"
    "    [0] = map<i32,string>[0] {\n"
    "    },\n"
    "    [1] = map<i32,string>[2] {\n"
    "      1 -> \"bar\",\n"
    "      2 -> \"baz\",\n"
    "    },\n"
    "    [2] = map<i32,string>[3] {\n"
    "      1 -> \"bar\",\n"
    "      2 -> \"baz\",\n"
    "      3 -> \"qux\",\n"
    "    },\n"
    "  },\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(o3));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}

BOOST_AUTO_TEST_CASE(test_optional_required_12) {
  Tricky2 t1, t2;
  BOOST_CHECK(t1.__isset.im_optional == false);
  BOOST_CHECK(t2.__isset.im_optional == false);
  BOOST_CHECK(t1 == t2);
  t1.im_optional = 5;
  BOOST_CHECK(t1 == t2);
  t2.im_optional = 5;
  BOOST_CHECK(t1 == t2);
  t1.__isset.im_optional = true;
  BOOST_CHECK(t1 != t2);
  t2.__isset.im_optional = true;
  BOOST_CHECK(t1 == t2);
  t1.im_optional = 10;
  BOOST_CHECK(t1 != t2);
  t2.__isset.im_optional = false;
  BOOST_CHECK(t1 != t2);
}

BOOST_AUTO_TEST_CASE(test_optional_required_13) {
  OptionalDefault t1, t2;

  BOOST_CHECK(t1.__isset.opt_int == true);
  BOOST_CHECK(t1.__isset.opt_str == true);
  BOOST_CHECK(t1.opt_int == t2.opt_int);
  BOOST_CHECK(t1.opt_str == t2.opt_str);

  write_to_read(t1, t2);
  BOOST_CHECK(t2.__isset.opt_int == true);
  BOOST_CHECK(t2.__isset.opt_str == true);
  BOOST_CHECK(t1.opt_int == t2.opt_int);
  BOOST_CHECK(t1.opt_str == t2.opt_str);

  const std::string expected_result(
    "OptionalDefault {\n"
    "  01: opt_int (i16) = 1234,\n"
    "  02: opt_str (string) = \"default\",\n"
    "}");
  const std::string result(apache::thrift::ThriftDebugString(t2));

  BOOST_CHECK_MESSAGE(!expected_result.compare(result),
    "Expected:\n" << expected_result << "\nGotten:\n" << result);
}
