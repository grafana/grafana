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

#define BOOST_TEST_MODULE TNonblockingServerTest
#include <boost/test/unit_test.hpp>
#include <boost/smart_ptr.hpp>

#include "thrift/concurrency/Thread.h"
#include "thrift/server/TNonblockingServer.h"

#include "gen-cpp/ParentService.h"

#include <event.h>

using namespace apache::thrift;

struct Handler : public test::ParentServiceIf {
  void addString(const std::string& s) { strings_.push_back(s); }
  void getStrings(std::vector<std::string>& _return) { _return = strings_; }
  std::vector<std::string> strings_;

  // dummy overrides not used in this test
  int32_t incrementGeneration() { return 0; }
  int32_t getGeneration() { return 0; }
  void getDataWait(std::string&, const int32_t) {}
  void onewayWait() {}
  void exceptionWait(const std::string&) {}
  void unexpectedExceptionWait(const std::string&) {}
};

class Fixture {
private:
  struct Runner : public apache::thrift::concurrency::Runnable {
    int port;
    boost::shared_ptr<event_base> userEventBase;
    boost::shared_ptr<TProcessor> processor;
    boost::shared_ptr<server::TNonblockingServer> server;

    virtual void run() {
      // When binding to explicit port, allow retrying to workaround bind failures on ports in use
      int retryCount = port ? 10 : 0;
      startServer(retryCount);
    }

  private:
    void startServer(int retry_count) {
      try {
        server.reset(new server::TNonblockingServer(processor, port));
        if (userEventBase) {
          server->registerEvents(userEventBase.get());
        }
        server->serve();
      } catch (const transport::TTransportException&) {
        if (retry_count > 0) {
          ++port;
          startServer(retry_count - 1);
        } else {
          throw;
        }
      }
    }
  };

  struct EventDeleter {
    void operator()(event_base* p) { event_base_free(p); }
  };

protected:
  Fixture() : processor(new test::ParentServiceProcessor(boost::make_shared<Handler>())) {}

  ~Fixture() {
    if (server) {
      server->stop();
    }
    if (thread) {
      thread->join();
    }
  }

  void setEventBase(event_base* user_event_base) {
    userEventBase_.reset(user_event_base, EventDeleter());
  }

  int startServer(int port) {
    boost::shared_ptr<Runner> runner(new Runner);
    runner->port = port;
    runner->processor = processor;
    runner->userEventBase = userEventBase_;

    boost::scoped_ptr<apache::thrift::concurrency::ThreadFactory> threadFactory(
        new apache::thrift::concurrency::PlatformThreadFactory(
#if !USE_BOOST_THREAD && !USE_STD_THREAD
            concurrency::PlatformThreadFactory::OTHER, concurrency::PlatformThreadFactory::NORMAL,
            1,
#endif
            false));
    thread = threadFactory->newThread(runner);
    thread->start();
    // wait 100 ms for the server to begin listening
    THRIFT_SLEEP_USEC(100000);
    server = runner->server;
    return runner->port;
  }

  bool canCommunicate(int serverPort) {
    boost::shared_ptr<transport::TSocket> socket(new transport::TSocket("localhost", serverPort));
    socket->open();
    test::ParentServiceClient client(boost::make_shared<protocol::TBinaryProtocol>(
        boost::make_shared<transport::TFramedTransport>(socket)));
    client.addString("foo");
    std::vector<std::string> strings;
    client.getStrings(strings);
    return strings.size() == 1 && !(strings[0].compare("foo"));
  }

private:
  boost::shared_ptr<event_base> userEventBase_;
  boost::shared_ptr<test::ParentServiceProcessor> processor;
protected:
  boost::shared_ptr<server::TNonblockingServer> server;
private:
  boost::shared_ptr<apache::thrift::concurrency::Thread> thread;

};

BOOST_AUTO_TEST_SUITE(TNonblockingServerTest)

BOOST_FIXTURE_TEST_CASE(get_specified_port, Fixture) {
  int specified_port = startServer(12345);
  BOOST_REQUIRE_GE(specified_port, 12345);
  BOOST_REQUIRE_EQUAL(server->getListenPort(), specified_port);
  BOOST_CHECK(canCommunicate(specified_port));

  server->stop();
  BOOST_CHECK_EQUAL(server->getListenPort(), specified_port);
}

BOOST_FIXTURE_TEST_CASE(get_assigned_port, Fixture) {
  int specified_port = startServer(0);
  BOOST_REQUIRE_EQUAL(specified_port, 0);
  int assigned_port = server->getListenPort();
  BOOST_REQUIRE_NE(assigned_port, 0);
  BOOST_CHECK(canCommunicate(assigned_port));

  server->stop();
  BOOST_CHECK_EQUAL(server->getListenPort(), 0);
}

BOOST_FIXTURE_TEST_CASE(provide_event_base, Fixture) {
  event_base* eb = event_base_new();
  setEventBase(eb);
  startServer(0);

  // assert that the server works
  BOOST_CHECK(canCommunicate(server->getListenPort()));
#if LIBEVENT_VERSION_NUMBER > 0x02010400
  // also assert that the event_base is actually used when it's easy
  BOOST_CHECK_GT(event_base_get_num_events(eb, EVENT_BASE_COUNT_ADDED), 0);
#endif
}

BOOST_AUTO_TEST_SUITE_END()
