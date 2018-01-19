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

#include <cstdlib>
#include <stdexcept>
#include <thrift/Thrift.h>
#include <thrift/transport/TFDTransport.h>

#define BOOST_TEST_MODULE TFDTransportTest
#include <boost/test/unit_test.hpp>

// Disabled on MSVC because the RTL asserts on an invalid file descriptor
// in both debug and release mode; at least in MSVCR100 (Visual Studio 2010)
#if !defined(WIN32)

using apache::thrift::transport::TTransportException;
using apache::thrift::transport::TFDTransport;

BOOST_AUTO_TEST_CASE(test_tfdtransport_1) {
  BOOST_CHECK_NO_THROW(TFDTransport t(256, TFDTransport::CLOSE_ON_DESTROY));
}

BOOST_AUTO_TEST_CASE(test_tfdtransport_2) {
  TFDTransport t(256, TFDTransport::CLOSE_ON_DESTROY);
  BOOST_CHECK_THROW(t.close(), TTransportException);
}

#else

BOOST_AUTO_TEST_CASE(test_tfdtransport_dummy) {
  BOOST_CHECK(true);
}

#endif
