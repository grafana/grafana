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

#define BOOST_TEST_MODULE TServerIntegrationTest
#include <boost/test/auto_unit_test.hpp>
#include <boost/atomic.hpp>
#include <boost/bind.hpp>
#include <boost/date_time/posix_time/ptime.hpp>
#include <boost/foreach.hpp>
#include <boost/format.hpp>
#include <boost/make_shared.hpp>
#include <boost/shared_ptr.hpp>
#include <boost/thread.hpp>
#include <thrift/server/TSimpleServer.h>
#include <thrift/server/TThreadPoolServer.h>
#include <thrift/server/TThreadedServer.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/transport/TServerSocket.h>
#include <thrift/transport/TSocket.h>
#include <thrift/transport/TTransport.h>
#include "gen-cpp/ParentService.h"
#include <string>
#include <vector>

using apache::thrift::concurrency::Guard;
using apache::thrift::concurrency::Monitor;
using apache::thrift::concurrency::Mutex;
using apache::thrift::concurrency::Synchronized;
using apache::thrift::protocol::TBinaryProtocol;
using apache::thrift::protocol::TBinaryProtocolFactory;
using apache::thrift::protocol::TProtocol;
using apache::thrift::protocol::TProtocolFactory;
using apache::thrift::transport::TServerSocket;
using apache::thrift::transport::TServerTransport;
using apache::thrift::transport::TSocket;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportException;
using apache::thrift::transport::TTransportFactory;
using apache::thrift::server::TServer;
using apache::thrift::server::TServerEventHandler;
using apache::thrift::server::TSimpleServer;
using apache::thrift::server::TThreadPoolServer;
using apache::thrift::server::TThreadedServer;
using apache::thrift::test::ParentServiceClient;
using apache::thrift::test::ParentServiceIf;
using apache::thrift::test::ParentServiceIfFactory;
using apache::thrift::test::ParentServiceIfSingletonFactory;
using apache::thrift::test::ParentServiceProcessor;
using apache::thrift::test::ParentServiceProcessorFactory;
using apache::thrift::TProcessor;
using apache::thrift::TProcessorFactory;
using boost::posix_time::milliseconds;

/**
 * preServe runs after listen() is successful, when we can connect
 */
class TServerReadyEventHandler : public TServerEventHandler, public Monitor {
public:
  TServerReadyEventHandler() : isListening_(false), accepted_(0) {}
  virtual ~TServerReadyEventHandler() {}
  virtual void preServe() {
    Synchronized sync(*this);
    isListening_ = true;
    notify();
  }
  virtual void* createContext(boost::shared_ptr<TProtocol> input,
                              boost::shared_ptr<TProtocol> output) {
    Synchronized sync(*this);
    ++accepted_;
    notify();

    (void)input;
    (void)output;
    return NULL;
  }
  bool isListening() const { return isListening_; }
  uint64_t acceptedCount() const { return accepted_; }

private:
  bool isListening_;
  uint64_t accepted_;
};

/**
 * Reusing another generated test, just something to serve up
 */
class ParentHandler : public ParentServiceIf {
public:
  ParentHandler() : generation_(0) {}

  int32_t incrementGeneration() {
    Guard g(mutex_);
    return ++generation_;
  }

  int32_t getGeneration() {
    Guard g(mutex_);
    return generation_;
  }

  void addString(const std::string& s) {
    Guard g(mutex_);
    strings_.push_back(s);
  }

  void getStrings(std::vector<std::string>& _return) {
    Guard g(mutex_);
    _return = strings_;
  }

  void getDataWait(std::string& _return, const int32_t length) {
    THRIFT_UNUSED_VARIABLE(_return);
    THRIFT_UNUSED_VARIABLE(length);
  }

  void onewayWait() {}

  void exceptionWait(const std::string& message) { THRIFT_UNUSED_VARIABLE(message); }

  void unexpectedExceptionWait(const std::string& message) { THRIFT_UNUSED_VARIABLE(message); }

protected:
  Mutex mutex_;
  int32_t generation_;
  std::vector<std::string> strings_;
};

void autoSocketCloser(TSocket* pSock) {
  pSock->close();
  delete pSock;
}

template <class TServerType>
class TServerIntegrationTestFixture {
public:
  TServerIntegrationTestFixture(const boost::shared_ptr<TProcessorFactory>& _processorFactory)
    : pServer(new TServerType(_processorFactory,
                              boost::shared_ptr<TServerTransport>(
                                  new TServerSocket("localhost", 0)),
                              boost::shared_ptr<TTransportFactory>(new TTransportFactory),
                              boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory))),
      pEventHandler(boost::shared_ptr<TServerReadyEventHandler>(new TServerReadyEventHandler)),
    bStressDone(false),
    bStressConnectionCount(0),
    bStressRequestCount(0) {
    pServer->setServerEventHandler(pEventHandler);
  }

  TServerIntegrationTestFixture(const boost::shared_ptr<TProcessor>& _processor)
    : pServer(
          new TServerType(_processor,
                          boost::shared_ptr<TServerTransport>(new TServerSocket("localhost", 0)),
                          boost::shared_ptr<TTransportFactory>(new TTransportFactory),
                          boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory))),
      pEventHandler(boost::shared_ptr<TServerReadyEventHandler>(new TServerReadyEventHandler)),
      bStressDone(false),
    bStressConnectionCount(0),
    bStressRequestCount(0) {
    pServer->setServerEventHandler(pEventHandler);
  }

  void startServer() {
    pServerThread.reset(new boost::thread(boost::bind(&TServerType::serve, pServer.get())));

    // block until listen() completes so clients will be able to connect
    Synchronized sync(*(pEventHandler.get()));
    while (!pEventHandler->isListening()) {
      pEventHandler->wait();
    }

    BOOST_TEST_MESSAGE("  server is listening");
  }

  void blockUntilAccepted(uint64_t numAccepted) {
    Synchronized sync(*(pEventHandler.get()));
    while (pEventHandler->acceptedCount() < numAccepted) {
      pEventHandler->wait();
    }

    BOOST_TEST_MESSAGE(boost::format("  server has accepted %1%") % numAccepted);
  }

  void stopServer() {
    if (pServerThread) {
      pServer->stop();
      BOOST_TEST_MESSAGE("  server stop completed");

      pServerThread->join();
      BOOST_TEST_MESSAGE("  server thread joined");
      pServerThread.reset();
    }
  }

  ~TServerIntegrationTestFixture() { stopServer(); }

  /**
   * Performs a baseline test where some clients are opened and issue a single operation
   * and then disconnect at different intervals.
   * \param[in]  numToMake  the number of concurrent clients
   * \param[in]  expectedHWM  the high water mark we expect of concurrency
   * \param[in]  purpose  a description of the test for logging purposes
   */
  void baseline(int64_t numToMake, int64_t expectedHWM, const std::string& purpose) {
    BOOST_TEST_MESSAGE(boost::format("Testing %1%: %2% with %3% clients, expect %4% HWM")
            % typeid(TServerType).name() % purpose % numToMake % expectedHWM);

    startServer();

    std::vector<boost::shared_ptr<TSocket> > holdSockets;
    std::vector<boost::shared_ptr<boost::thread> > holdThreads;

    for (int64_t i = 0; i < numToMake; ++i) {
      boost::shared_ptr<TSocket> pClientSock(new TSocket("localhost", getServerPort()),
                                             autoSocketCloser);
      holdSockets.push_back(pClientSock);
      boost::shared_ptr<TProtocol> pClientProtocol(new TBinaryProtocol(pClientSock));
      ParentServiceClient client(pClientProtocol);
      pClientSock->open();
      client.incrementGeneration();
      holdThreads.push_back(boost::shared_ptr<boost::thread>(
          new boost::thread(boost::bind(&TServerIntegrationTestFixture::delayClose,
                                        this,
                                        pClientSock,
                                        milliseconds(10 * numToMake)))));
    }

    BOOST_CHECK_EQUAL(expectedHWM, pServer->getConcurrentClientCountHWM());

    BOOST_FOREACH (boost::shared_ptr<boost::thread> pThread, holdThreads) { pThread->join(); }
    holdThreads.clear();
    holdSockets.clear();

    stopServer();
  }

  /**
   * Helper method used to close a connection after a delay.
   * \param[in]  toClose  the connection to close
   * \param[in]  after  the delay to impose
   */
  void delayClose(boost::shared_ptr<TTransport> toClose, boost::posix_time::time_duration after) {
    boost::this_thread::sleep(after);
    toClose->close();
  }

  /**
   * \returns  the server port number
   */
  int getServerPort() {
    TServerSocket* pSock = dynamic_cast<TServerSocket*>(pServer->getServerTransport().get());
    return pSock->getPort();
  }

  /**
   * Performs a stress test by spawning threads that connect, do a number of operations
   * and disconnect, then a random delay, then do it over again.  This is done for a fixed
   * period of time to test for concurrency correctness.
   * \param[in]  numToMake  the number of concurrent clients
   */
  void stress(int64_t numToMake, const boost::posix_time::time_duration& duration) {
    BOOST_TEST_MESSAGE(boost::format("Stress testing %1% with %2% clients for %3% seconds")
        % typeid(TServerType).name() % numToMake % duration.total_seconds());

    startServer();

    std::vector<boost::shared_ptr<boost::thread> > holdThreads;
    for (int64_t i = 0; i < numToMake; ++i) {
      holdThreads.push_back(boost::shared_ptr<boost::thread>(
        new boost::thread(boost::bind(&TServerIntegrationTestFixture::stressor, this))));
    }

    boost::this_thread::sleep(duration);
    bStressDone = true;

    BOOST_TEST_MESSAGE(boost::format("  serviced %1% connections (HWM %2%) totaling %3% requests")
        % bStressConnectionCount % pServer->getConcurrentClientCountHWM() % bStressRequestCount);

    BOOST_FOREACH (boost::shared_ptr<boost::thread> pThread, holdThreads) { pThread->join(); }
    holdThreads.clear();

    BOOST_CHECK(bStressRequestCount > 0);

    stopServer();
  }

  /**
   * Helper method to stress the system
   */
  void stressor() {
  while (!bStressDone) {
      boost::shared_ptr<TSocket> pSocket(new TSocket("localhost", getServerPort()), autoSocketCloser);
      boost::shared_ptr<TProtocol> pProtocol(new TBinaryProtocol(pSocket));
      ParentServiceClient client(pProtocol);
      pSocket->open();
      bStressConnectionCount.fetch_add(1, boost::memory_order_relaxed);
      for (int i = 0; i < rand() % 1000; ++i) {
      client.incrementGeneration();
        bStressRequestCount.fetch_add(1, boost::memory_order_relaxed);
      }
    }
  }

  boost::shared_ptr<TServerType> pServer;
  boost::shared_ptr<TServerReadyEventHandler> pEventHandler;
  boost::shared_ptr<boost::thread> pServerThread;
  bool bStressDone;
  boost::atomic_int64_t bStressConnectionCount;
  boost::atomic_int64_t bStressRequestCount;
};

template <class TServerType>
class TServerIntegrationProcessorFactoryTestFixture
    : public TServerIntegrationTestFixture<TServerType> {
public:
  TServerIntegrationProcessorFactoryTestFixture()
    : TServerIntegrationTestFixture<TServerType>(boost::make_shared<ParentServiceProcessorFactory>(
          boost::make_shared<ParentServiceIfSingletonFactory>(
              boost::make_shared<ParentHandler>()))) {}
};

template <class TServerType>
class TServerIntegrationProcessorTestFixture : public TServerIntegrationTestFixture<TServerType> {
public:
  TServerIntegrationProcessorTestFixture()
    : TServerIntegrationTestFixture<TServerType>(
          boost::make_shared<ParentServiceProcessor>(boost::make_shared<ParentHandler>())) {}
};

BOOST_AUTO_TEST_SUITE(constructors)

BOOST_FIXTURE_TEST_CASE(test_simple_factory,
                        TServerIntegrationProcessorFactoryTestFixture<TSimpleServer>) {
  baseline(3, 1, "factory");
}

BOOST_FIXTURE_TEST_CASE(test_simple, TServerIntegrationProcessorTestFixture<TSimpleServer>) {
  baseline(3, 1, "processor");
}

BOOST_FIXTURE_TEST_CASE(test_threaded_factory,
                        TServerIntegrationProcessorFactoryTestFixture<TThreadedServer>) {
  baseline(10, 10, "factory");
}

BOOST_FIXTURE_TEST_CASE(test_threaded, TServerIntegrationProcessorTestFixture<TThreadedServer>) {
  baseline(10, 10, "processor");
}

BOOST_FIXTURE_TEST_CASE(test_threaded_bound,
                        TServerIntegrationProcessorTestFixture<TThreadedServer>) {
  pServer->setConcurrentClientLimit(4);
  baseline(10, 4, "limit by server framework");
}

BOOST_FIXTURE_TEST_CASE(test_threaded_stress,
                        TServerIntegrationProcessorFactoryTestFixture<TThreadedServer>) {
  stress(10, boost::posix_time::seconds(3));
}

BOOST_FIXTURE_TEST_CASE(test_threadpool_factory,
                        TServerIntegrationProcessorFactoryTestFixture<TThreadPoolServer>) {
  pServer->getThreadManager()->threadFactory(
      boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>(
          new apache::thrift::concurrency::PlatformThreadFactory));
  pServer->getThreadManager()->start();

  // thread factory has 4 threads as a default
  // thread factory however is a bad way to limit concurrent clients
  // as accept() will be called to grab a 5th client socket, in this case
  // and then the thread factory will block adding the thread to manage
  // that client.
  baseline(10, 5, "limit by thread manager");
}

BOOST_FIXTURE_TEST_CASE(test_threadpool,
                        TServerIntegrationProcessorTestFixture<TThreadPoolServer>) {
  pServer->getThreadManager()->threadFactory(
      boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>(
          new apache::thrift::concurrency::PlatformThreadFactory));
  pServer->getThreadManager()->start();

  // thread factory has 4 threads as a default
  // thread factory however is a bad way to limit concurrent clients
  // as accept() will be called to grab a 5th client socket, in this case
  // and then the thread factory will block adding the thread to manage
  // that client.
  baseline(10, 5, "limit by thread manager");
}

BOOST_FIXTURE_TEST_CASE(test_threadpool_bound,
                        TServerIntegrationProcessorTestFixture<TThreadPoolServer>) {
  pServer->getThreadManager()->threadFactory(
      boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>(
          new apache::thrift::concurrency::PlatformThreadFactory));
  pServer->getThreadManager()->start();
  pServer->setConcurrentClientLimit(4);

  baseline(10, 4, "server framework connection limit");
}

BOOST_FIXTURE_TEST_CASE(test_threadpool_stress,
                        TServerIntegrationProcessorTestFixture<TThreadPoolServer>) {
  pServer->getThreadManager()->threadFactory(
      boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>(
          new apache::thrift::concurrency::PlatformThreadFactory));
  pServer->getThreadManager()->start();

  stress(10, boost::posix_time::seconds(3));
}

BOOST_AUTO_TEST_SUITE_END()

BOOST_FIXTURE_TEST_SUITE(TServerIntegrationTest,
                         TServerIntegrationProcessorTestFixture<TThreadedServer>)

BOOST_AUTO_TEST_CASE(test_stop_with_interruptable_clients_connected) {
  // This tests THRIFT-2441 new behavior: stopping the server disconnects clients
  BOOST_TEST_MESSAGE("Testing stop with interruptable clients");

  startServer();

  boost::shared_ptr<TSocket> pClientSock1(new TSocket("localhost", getServerPort()),
                                          autoSocketCloser);
  pClientSock1->open();

  boost::shared_ptr<TSocket> pClientSock2(new TSocket("localhost", getServerPort()),
                                          autoSocketCloser);
  pClientSock2->open();

  // Ensure they have been accepted
  blockUntilAccepted(2);

  // The test fixture destructor will force the sockets to disconnect
  // Prior to THRIFT-2441, pServer->stop() would hang until clients disconnected
  stopServer();

  // extra proof the server end disconnected the clients
  uint8_t buf[1];
  BOOST_CHECK_EQUAL(0, pClientSock1->read(&buf[0], 1)); // 0 = disconnected
  BOOST_CHECK_EQUAL(0, pClientSock2->read(&buf[0], 1)); // 0 = disconnected
}

BOOST_AUTO_TEST_CASE(test_stop_with_uninterruptable_clients_connected) {
  // This tests pre-THRIFT-2441 behavior: stopping the server blocks until clients
  // disconnect.
    BOOST_TEST_MESSAGE("Testing stop with uninterruptable clients");

  boost::dynamic_pointer_cast<TServerSocket>(pServer->getServerTransport())
      ->setInterruptableChildren(false); // returns to pre-THRIFT-2441 behavior

  startServer();

  boost::shared_ptr<TSocket> pClientSock1(new TSocket("localhost", getServerPort()),
                                          autoSocketCloser);
  pClientSock1->open();

  boost::shared_ptr<TSocket> pClientSock2(new TSocket("localhost", getServerPort()),
                                          autoSocketCloser);
  pClientSock2->open();

  // Ensure they have been accepted
  blockUntilAccepted(2);

  boost::thread t1(boost::bind(&TServerIntegrationTestFixture::delayClose,
                               this,
                               pClientSock1,
                               milliseconds(250)));
  boost::thread t2(boost::bind(&TServerIntegrationTestFixture::delayClose,
                               this,
                               pClientSock2,
                               milliseconds(250)));

  // Once the clients disconnect the server will stop
  stopServer();
  BOOST_CHECK(pServer->getConcurrentClientCountHWM() > 0);
  t1.join();
  t2.join();
}

BOOST_AUTO_TEST_CASE(test_concurrent_client_limit) {
  startServer();
  BOOST_TEST_MESSAGE("Testing the concurrent client limit");

  BOOST_CHECK_EQUAL(INT64_MAX, pServer->getConcurrentClientLimit());
  pServer->setConcurrentClientLimit(2);
  BOOST_CHECK_EQUAL(0, pServer->getConcurrentClientCount());
  BOOST_CHECK_EQUAL(2, pServer->getConcurrentClientLimit());

  boost::shared_ptr<TSocket> pClientSock1(new TSocket("localhost", getServerPort()),
                                          autoSocketCloser);
  pClientSock1->open();
  blockUntilAccepted(1);
  BOOST_CHECK_EQUAL(1, pServer->getConcurrentClientCount());

  boost::shared_ptr<TSocket> pClientSock2(new TSocket("localhost", getServerPort()),
                                          autoSocketCloser);
  pClientSock2->open();
  blockUntilAccepted(2);
  BOOST_CHECK_EQUAL(2, pServer->getConcurrentClientCount());

  // a third client cannot connect until one of the other two closes
  boost::thread t2(boost::bind(&TServerIntegrationTestFixture::delayClose,
                               this,
                               pClientSock2,
                               milliseconds(250)));
  boost::shared_ptr<TSocket> pClientSock3(new TSocket("localhost", getServerPort()),
                                          autoSocketCloser);
  pClientSock2->open();
  blockUntilAccepted(2);
  BOOST_CHECK_EQUAL(2, pServer->getConcurrentClientCount());
  BOOST_CHECK_EQUAL(2, pServer->getConcurrentClientCountHWM());

  stopServer();
  BOOST_CHECK(pServer->getConcurrentClientCountHWM() > 0);
  t2.join();
}

BOOST_AUTO_TEST_SUITE_END()
