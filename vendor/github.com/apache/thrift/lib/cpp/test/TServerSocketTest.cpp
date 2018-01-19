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
#include <thrift/transport/TServerSocket.h>
#include "TTransportCheckThrow.h"
#include <iostream>

using apache::thrift::transport::TServerSocket;
using apache::thrift::transport::TSocket;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;

BOOST_AUTO_TEST_SUITE(TServerSocketTest)

BOOST_AUTO_TEST_CASE(test_bind_to_address) {
  TServerSocket sock1("localhost", 0);
  sock1.listen();
  int port = sock1.getPort();
  TSocket clientSock("localhost", port);
  clientSock.open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  accepted->close();
  sock1.close();

  std::cout << "An error message from getaddrinfo on the console is expected:" << std::endl;
  TServerSocket sock2("257.258.259.260", 0);
  BOOST_CHECK_THROW(sock2.listen(), TTransportException);
  sock2.close();
}

BOOST_AUTO_TEST_CASE(test_listen_valid_port) {
  TServerSocket sock1(-1);
  TTRANSPORT_CHECK_THROW(sock1.listen(), TTransportException::BAD_ARGS);

  TServerSocket sock2(65536);
  TTRANSPORT_CHECK_THROW(sock2.listen(), TTransportException::BAD_ARGS);
}

BOOST_AUTO_TEST_CASE(test_close_before_listen) {
  TServerSocket sock1("localhost", 0);
  sock1.close();
}

BOOST_AUTO_TEST_CASE(test_get_port) {
  TServerSocket sock1("localHost", 888);
  BOOST_CHECK_EQUAL(888, sock1.getPort());
}

BOOST_AUTO_TEST_SUITE_END()
