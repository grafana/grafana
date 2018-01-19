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

#include <stdio.h>

#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/protocol/TCompactProtocol.h>
#include <thrift/transport/TBufferTransports.h>

#define BOOST_TEST_MODULE AllProtocolTests
#include <boost/test/unit_test.hpp>

#include "AllProtocolTests.tcc"

using namespace apache::thrift;
using namespace apache::thrift::protocol;
using namespace apache::thrift::transport;

char errorMessage[ERR_LEN];

BOOST_AUTO_TEST_CASE(test_binary_protocol) {
  testProtocol<TBinaryProtocol>("TBinaryProtocol");
}

BOOST_AUTO_TEST_CASE(test_little_binary_protocol) {
  testProtocol<TLEBinaryProtocol>("TLEBinaryProtocol");
}

BOOST_AUTO_TEST_CASE(test_compact_protocol) {
  testProtocol<TCompactProtocol>("TCompactProtocol");
}
