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
#include <thrift/transport/TSocket.h>
#include <thrift/transport/TServerTransport.h>

using apache::thrift::transport::TServerTransport;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;

BOOST_AUTO_TEST_SUITE(TServerTransportTest)

class TestTTransport : public TTransport {};

class TestTServerTransport : public TServerTransport {
public:
  TestTServerTransport() : valid_(true) {}
  void close() {}
  bool valid_;

protected:
  boost::shared_ptr<TTransport> acceptImpl() {
    return valid_ ? boost::shared_ptr<TestTTransport>(new TestTTransport)
                  : boost::shared_ptr<TestTTransport>();
  }
};

BOOST_AUTO_TEST_CASE(test_positive_accept) {
  TestTServerTransport uut;
  BOOST_CHECK(uut.accept());
}

BOOST_AUTO_TEST_CASE(test_negative_accept) {
  TestTServerTransport uut;
  uut.valid_ = false;
  BOOST_CHECK_THROW(uut.accept(), TTransportException);
}

BOOST_AUTO_TEST_SUITE_END()
