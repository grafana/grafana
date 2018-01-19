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
#define BOOST_TEST_MODULE EnumTest
#include <boost/test/unit_test.hpp>
#include "gen-cpp/EnumTest_types.h"

BOOST_AUTO_TEST_SUITE(EnumTest)

BOOST_AUTO_TEST_CASE(test_enum) {
  // Check that all the enum values match what we expect
  BOOST_CHECK_EQUAL(MyEnum1::ME1_0, 0);
  BOOST_CHECK_EQUAL(MyEnum1::ME1_1, 1);
  BOOST_CHECK_EQUAL(MyEnum1::ME1_2, 2);
  BOOST_CHECK_EQUAL(MyEnum1::ME1_3, 3);
  BOOST_CHECK_EQUAL(MyEnum1::ME1_5, 5);
  BOOST_CHECK_EQUAL(MyEnum1::ME1_6, 6);

  BOOST_CHECK_EQUAL(MyEnum2::ME2_0, 0);
  BOOST_CHECK_EQUAL(MyEnum2::ME2_1, 1);
  BOOST_CHECK_EQUAL(MyEnum2::ME2_2, 2);

  BOOST_CHECK_EQUAL(MyEnum3::ME3_0, 0);
  BOOST_CHECK_EQUAL(MyEnum3::ME3_1, 1);
  BOOST_CHECK_EQUAL(MyEnum3::ME3_N2, -2);
  BOOST_CHECK_EQUAL(MyEnum3::ME3_N1, -1);
  BOOST_CHECK_EQUAL(MyEnum3::ME3_D0, 0);
  BOOST_CHECK_EQUAL(MyEnum3::ME3_D1, 1);
  BOOST_CHECK_EQUAL(MyEnum3::ME3_9, 9);
  BOOST_CHECK_EQUAL(MyEnum3::ME3_10, 10);

  BOOST_CHECK_EQUAL(MyEnum4::ME4_A, 0x7ffffffd);
  BOOST_CHECK_EQUAL(MyEnum4::ME4_B, 0x7ffffffe);
  BOOST_CHECK_EQUAL(MyEnum4::ME4_C, 0x7fffffff);
}

BOOST_AUTO_TEST_CASE(test_enum_constant) {
  MyStruct ms;
  BOOST_CHECK_EQUAL(ms.me2_2, 2);
  BOOST_CHECK_EQUAL(ms.me3_n2, -2);
  BOOST_CHECK_EQUAL(ms.me3_d1, 1);
}

BOOST_AUTO_TEST_SUITE_END()
