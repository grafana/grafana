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

#include <vector>
#include <map>

#include <boost/test/auto_unit_test.hpp>

#include <thrift/TToString.h>

#include "gen-cpp/ThriftTest_types.h"
#include "gen-cpp/OptionalRequiredTest_types.h"
#include "gen-cpp/DebugProtoTest_types.h"

using apache::thrift::to_string;

BOOST_AUTO_TEST_SUITE(ToStringTest)

BOOST_AUTO_TEST_CASE(base_types_to_string) {
  BOOST_CHECK_EQUAL(to_string(10), "10");
  BOOST_CHECK_EQUAL(to_string(true), "1");
  BOOST_CHECK_EQUAL(to_string('a'), "a");
  BOOST_CHECK_EQUAL(to_string(1.2), "1.2");
  BOOST_CHECK_EQUAL(to_string("abc"), "abc");
}

BOOST_AUTO_TEST_CASE(empty_vector_to_string) {
  std::vector<int> l;
  BOOST_CHECK_EQUAL(to_string(l), "[]");
}

BOOST_AUTO_TEST_CASE(single_item_vector_to_string) {
  std::vector<int> l;
  l.push_back(100);
  BOOST_CHECK_EQUAL(to_string(l), "[100]");
}

BOOST_AUTO_TEST_CASE(multiple_item_vector_to_string) {
  std::vector<int> l;
  l.push_back(100);
  l.push_back(150);
  BOOST_CHECK_EQUAL(to_string(l), "[100, 150]");
}

BOOST_AUTO_TEST_CASE(empty_map_to_string) {
  std::map<int, std::string> m;
  BOOST_CHECK_EQUAL(to_string(m), "{}");
}

BOOST_AUTO_TEST_CASE(single_item_map_to_string) {
  std::map<int, std::string> m;
  m[12] = "abc";
  BOOST_CHECK_EQUAL(to_string(m), "{12: abc}");
}

BOOST_AUTO_TEST_CASE(multi_item_map_to_string) {
  std::map<int, std::string> m;
  m[12] = "abc";
  m[31] = "xyz";
  BOOST_CHECK_EQUAL(to_string(m), "{12: abc, 31: xyz}");
}

BOOST_AUTO_TEST_CASE(empty_set_to_string) {
  std::set<char> s;
  BOOST_CHECK_EQUAL(to_string(s), "{}");
}

BOOST_AUTO_TEST_CASE(single_item_set_to_string) {
  std::set<char> s;
  s.insert('c');
  BOOST_CHECK_EQUAL(to_string(s), "{c}");
}

BOOST_AUTO_TEST_CASE(multi_item_set_to_string) {
  std::set<char> s;
  s.insert('a');
  s.insert('z');
  BOOST_CHECK_EQUAL(to_string(s), "{a, z}");
}

BOOST_AUTO_TEST_CASE(generated_empty_object_to_string) {
  thrift::test::EmptyStruct e;
  BOOST_CHECK_EQUAL(to_string(e), "EmptyStruct()");
}

BOOST_AUTO_TEST_CASE(generated_single_basic_field_object_to_string) {
  thrift::test::StructA a;
  a.__set_s("abcd");
  BOOST_CHECK_EQUAL(to_string(a), "StructA(s=abcd)");
}

BOOST_AUTO_TEST_CASE(generated_two_basic_fields_object_to_string) {
  thrift::test::Bonk a;
  a.__set_message("abcd");
  a.__set_type(1234);
  BOOST_CHECK_EQUAL(to_string(a), "Bonk(message=abcd, type=1234)");
}

BOOST_AUTO_TEST_CASE(generated_optional_fields_object_to_string) {
  thrift::test::Tricky2 a;
  BOOST_CHECK_EQUAL(to_string(a), "Tricky2(im_optional=<null>)");
  a.__set_im_optional(123);
  BOOST_CHECK_EQUAL(to_string(a), "Tricky2(im_optional=123)");
}

BOOST_AUTO_TEST_CASE(generated_nested_object_to_string) {
  thrift::test::OneField a;
  BOOST_CHECK_EQUAL(to_string(a), "OneField(field=EmptyStruct())");
}

BOOST_AUTO_TEST_CASE(generated_nested_list_object_to_string) {
  thrift::test::ListBonks l;
  l.bonk.assign(2, thrift::test::Bonk());
  l.bonk[0].__set_message("a");
  l.bonk[1].__set_message("b");

  BOOST_CHECK_EQUAL(to_string(l),
                    "ListBonks(bonk=[Bonk(message=a, type=0), Bonk(message=b, type=0)])");
}

BOOST_AUTO_TEST_SUITE_END()
