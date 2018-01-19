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

#define BOOST_TEST_MODULE TSocketInterruptTest
#include <boost/test/auto_unit_test.hpp>

#include <boost/bind.hpp>
#include <boost/chrono/duration.hpp>
#include <boost/date_time/posix_time/posix_time_duration.hpp>
#include <boost/thread/thread.hpp>
#include <thrift/transport/TSocket.h>
#include <thrift/transport/TServerSocket.h>

using apache::thrift::transport::TServerSocket;
using apache::thrift::transport::TSocket;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;

BOOST_AUTO_TEST_SUITE(TSocketInterruptTest)

void readerWorker(boost::shared_ptr<TTransport> tt, uint32_t expectedResult) {
  uint8_t buf[4];
  BOOST_CHECK_EQUAL(expectedResult, tt->read(buf, 4));
}

void readerWorkerMustThrow(boost::shared_ptr<TTransport> tt) {
  try {
    uint8_t buf[4];
    tt->read(buf, 4);
    BOOST_ERROR("should not have gotten here");
  } catch (const TTransportException& tx) {
    BOOST_CHECK_EQUAL(TTransportException::INTERRUPTED, tx.getType());
  }
}

BOOST_AUTO_TEST_CASE(test_interruptable_child_read) {
  TServerSocket sock1("localhost", 0);
  sock1.listen();
  int port = sock1.getPort();
  TSocket clientSock("localhost", port);
  clientSock.open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  boost::thread readThread(boost::bind(readerWorkerMustThrow, accepted));
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // readThread is practically guaranteed to be blocking now
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(readThread.try_join_for(boost::chrono::milliseconds(200)),
                      "server socket interruptChildren did not interrupt child read");
  clientSock.close();
  accepted->close();
  sock1.close();
}

BOOST_AUTO_TEST_CASE(test_non_interruptable_child_read) {
  TServerSocket sock1("localhost", 0);
  sock1.setInterruptableChildren(false); // returns to pre-THRIFT-2441 behavior
  sock1.listen();
  int port = sock1.getPort();
  TSocket clientSock("localhost", port);
  clientSock.open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  boost::thread readThread(boost::bind(readerWorker, accepted, 0));
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // readThread is practically guaranteed to be blocking here
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(!readThread.try_join_for(boost::chrono::milliseconds(200)),
                      "server socket interruptChildren interrupted child read");

  // only way to proceed is to have the client disconnect
  clientSock.close();
  readThread.join();
  accepted->close();
  sock1.close();
}

BOOST_AUTO_TEST_CASE(test_cannot_change_after_listen) {
  TServerSocket sock1("localhost", 0);
  sock1.listen();
  BOOST_CHECK_THROW(sock1.setInterruptableChildren(false), std::logic_error);
  sock1.close();
}

void peekerWorker(boost::shared_ptr<TTransport> tt, bool expectedResult) {
  BOOST_CHECK_EQUAL(expectedResult, tt->peek());
}

BOOST_AUTO_TEST_CASE(test_interruptable_child_peek) {
  TServerSocket sock1("localhost", 0);
  sock1.listen();
  int port = sock1.getPort();
  TSocket clientSock("localhost", port);
  clientSock.open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  // peek() will return false if child is interrupted
  boost::thread peekThread(boost::bind(peekerWorker, accepted, false));
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // peekThread is practically guaranteed to be blocking now
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(peekThread.try_join_for(boost::chrono::milliseconds(200)),
                      "server socket interruptChildren did not interrupt child peek");
  clientSock.close();
  accepted->close();
  sock1.close();
}

BOOST_AUTO_TEST_CASE(test_non_interruptable_child_peek) {
  TServerSocket sock1("localhost", 0);
  sock1.setInterruptableChildren(false); // returns to pre-THRIFT-2441 behavior
  sock1.listen();
  int port = sock1.getPort();
  TSocket clientSock("localhost", port);
  clientSock.open();
  boost::shared_ptr<TTransport> accepted = sock1.accept();
  // peek() will return false when remote side is closed
  boost::thread peekThread(boost::bind(peekerWorker, accepted, false));
  boost::this_thread::sleep(boost::posix_time::milliseconds(50));
  // peekThread is practically guaranteed to be blocking now
  sock1.interruptChildren();
  BOOST_CHECK_MESSAGE(!peekThread.try_join_for(boost::chrono::milliseconds(200)),
                      "server socket interruptChildren interrupted child peek");

  // only way to proceed is to have the client disconnect
  clientSock.close();
  peekThread.join();
  accepted->close();
  sock1.close();
}

BOOST_AUTO_TEST_SUITE_END()
