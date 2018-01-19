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

#include <boost/test/auto_unit_test.hpp>
#include <thrift/protocol/TBase64Utils.h>

using apache::thrift::protocol::base64_encode;
using apache::thrift::protocol::base64_decode;

BOOST_AUTO_TEST_SUITE(Base64Test)

void setupTestData(int i, uint8_t* data, int& len) {
  len = 0;
  do {
    data[len] = (uint8_t)(i & 0xFF);
    i >>= 8;
    len++;
  } while ((len < 3) && (i != 0));

  BOOST_ASSERT(i == 0);
}

void checkEncoding(uint8_t* data, int len) {
  for (int i = 0; i < len; i++) {
    BOOST_ASSERT(isalnum(data[i]) || data[i] == '/' || data[i] == '+');
  }
}

BOOST_AUTO_TEST_CASE(test_Base64_Encode_Decode) {
  int len;
  uint8_t testInput[3];
  uint8_t testOutput[4];

  // Test all possible encoding / decoding cases given the
  // three byte limit for base64_encode.

  for (int i = 0xFFFFFF; i >= 0; i--) {

    // fill testInput based on i
    setupTestData(i, testInput, len);

    // encode the test data, then decode it again
    base64_encode(testInput, len, testOutput);

    // verify each byte has a valid Base64 value (alphanumeric or either + or /)
    checkEncoding(testOutput, len);

    // decode output and check that it matches input
    base64_decode(testOutput, len + 1);
    BOOST_ASSERT(0 == memcmp(testInput, testOutput, len));
  }
}

BOOST_AUTO_TEST_SUITE_END()
