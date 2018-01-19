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

/*
 * This file contains tests that ensure TProcessorEventHandler and
 * TServerEventHandler are invoked properly by the various server
 * implementations.
 */

#include <boost/test/unit_test.hpp>

#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/concurrency/Monitor.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/server/TThreadedServer.h>
#include <thrift/server/TThreadPoolServer.h>
#include <thrift/server/TNonblockingServer.h>
#include <thrift/server/TSimpleServer.h>
#include <thrift/transport/TSocket.h>

#include "EventLog.h"
#include "ServerThread.h"
#include "Handlers.h"
#include "gen-cpp/ChildService.h"

using namespace std;
using namespace boost;
using namespace apache::thrift;
using namespace apache::thrift::concurrency;
using namespace apache::thrift::protocol;
using namespace apache::thrift::server;
using namespace apache::thrift::transport;

using namespace apache::thrift::test;

/*
 * Traits classes that encapsulate how to create various types of servers.
 */

class TSimpleServerTraits {
public:
  typedef TSimpleServer ServerType;

  boost::shared_ptr<TSimpleServer> createServer(
      const boost::shared_ptr<TProcessor>& processor,
      uint16_t port,
      const boost::shared_ptr<TTransportFactory>& transportFactory,
      const boost::shared_ptr<TProtocolFactory>& protocolFactory) {
    boost::shared_ptr<TServerSocket> socket(new TServerSocket(port));
    return boost::shared_ptr<TSimpleServer>(
        new TSimpleServer(processor, socket, transportFactory, protocolFactory));
  }
};

class TThreadedServerTraits {
public:
  typedef TThreadedServer ServerType;

  boost::shared_ptr<TThreadedServer> createServer(
      const boost::shared_ptr<TProcessor>& processor,
      uint16_t port,
      const boost::shared_ptr<TTransportFactory>& transportFactory,
      const boost::shared_ptr<TProtocolFactory>& protocolFactory) {
    boost::shared_ptr<TServerSocket> socket(new TServerSocket(port));
    return boost::shared_ptr<TThreadedServer>(
        new TThreadedServer(processor, socket, transportFactory, protocolFactory));
  }
};

class TThreadPoolServerTraits {
public:
  typedef TThreadPoolServer ServerType;

  boost::shared_ptr<TThreadPoolServer> createServer(
      const boost::shared_ptr<TProcessor>& processor,
      uint16_t port,
      const boost::shared_ptr<TTransportFactory>& transportFactory,
      const boost::shared_ptr<TProtocolFactory>& protocolFactory) {
    boost::shared_ptr<TServerSocket> socket(new TServerSocket(port));

    boost::shared_ptr<PlatformThreadFactory> threadFactory(new PlatformThreadFactory);
    boost::shared_ptr<ThreadManager> threadManager = ThreadManager::newSimpleThreadManager(8);
    threadManager->threadFactory(threadFactory);
    threadManager->start();

    return boost::shared_ptr<TThreadPoolServer>(
        new TThreadPoolServer(processor, socket, transportFactory, protocolFactory, threadManager));
  }
};

class TNonblockingServerTraits {
public:
  typedef TNonblockingServer ServerType;

  boost::shared_ptr<TNonblockingServer> createServer(
      const boost::shared_ptr<TProcessor>& processor,
      uint16_t port,
      const boost::shared_ptr<TTransportFactory>& transportFactory,
      const boost::shared_ptr<TProtocolFactory>& protocolFactory) {
    // TNonblockingServer automatically uses TFramedTransport.
    // Raise an exception if the supplied transport factory is not a
    // TFramedTransportFactory
    TFramedTransportFactory* framedFactory
        = dynamic_cast<TFramedTransportFactory*>(transportFactory.get());
    if (framedFactory == NULL) {
      throw TException("TNonblockingServer must use TFramedTransport");
    }

    boost::shared_ptr<PlatformThreadFactory> threadFactory(new PlatformThreadFactory);
    boost::shared_ptr<ThreadManager> threadManager = ThreadManager::newSimpleThreadManager(8);
    threadManager->threadFactory(threadFactory);
    threadManager->start();

    return boost::shared_ptr<TNonblockingServer>(
        new TNonblockingServer(processor, protocolFactory, port, threadManager));
  }
};

class TNonblockingServerNoThreadsTraits {
public:
  typedef TNonblockingServer ServerType;

  boost::shared_ptr<TNonblockingServer> createServer(
      const boost::shared_ptr<TProcessor>& processor,
      uint16_t port,
      const boost::shared_ptr<TTransportFactory>& transportFactory,
      const boost::shared_ptr<TProtocolFactory>& protocolFactory) {
    // TNonblockingServer automatically uses TFramedTransport.
    // Raise an exception if the supplied transport factory is not a
    // TFramedTransportFactory
    TFramedTransportFactory* framedFactory
        = dynamic_cast<TFramedTransportFactory*>(transportFactory.get());
    if (framedFactory == NULL) {
      throw TException("TNonblockingServer must use TFramedTransport");
    }

    // Use a NULL ThreadManager
    boost::shared_ptr<ThreadManager> threadManager;
    return boost::shared_ptr<TNonblockingServer>(
        new TNonblockingServer(processor, protocolFactory, port, threadManager));
  }
};

/*
 * Traits classes for controlling if we instantiate templated or generic
 * protocol factories, processors, clients, etc.
 *
 * The goal is to allow the outer test code to select which server type is
 * being tested, and whether or not we are testing the templated classes, or
 * the generic classes.
 *
 * Each specific test case can control whether we create a child or parent
 * server, and whether we use TFramedTransport or TBufferedTransport.
 */

class UntemplatedTraits {
public:
  typedef TBinaryProtocolFactory ProtocolFactory;
  typedef TBinaryProtocol Protocol;

  typedef ParentServiceProcessor ParentProcessor;
  typedef ChildServiceProcessor ChildProcessor;
  typedef ParentServiceClient ParentClient;
  typedef ChildServiceClient ChildClient;
};

class TemplatedTraits {
public:
  typedef TBinaryProtocolFactoryT<TBufferBase> ProtocolFactory;
  typedef TBinaryProtocolT<TBufferBase> Protocol;

  typedef ParentServiceProcessorT<Protocol> ParentProcessor;
  typedef ChildServiceProcessorT<Protocol> ChildProcessor;
  typedef ParentServiceClientT<Protocol> ParentClient;
  typedef ChildServiceClientT<Protocol> ChildClient;
};

template <typename TemplateTraits_>
class ParentServiceTraits {
public:
  typedef typename TemplateTraits_::ParentProcessor Processor;
  typedef typename TemplateTraits_::ParentClient Client;
  typedef ParentHandler Handler;

  typedef typename TemplateTraits_::ProtocolFactory ProtocolFactory;
  typedef typename TemplateTraits_::Protocol Protocol;
};

template <typename TemplateTraits_>
class ChildServiceTraits {
public:
  typedef typename TemplateTraits_::ChildProcessor Processor;
  typedef typename TemplateTraits_::ChildClient Client;
  typedef ChildHandler Handler;

  typedef typename TemplateTraits_::ProtocolFactory ProtocolFactory;
  typedef typename TemplateTraits_::Protocol Protocol;
};

// TODO: It would be nicer if the TTransportFactory types defined a typedef,
// to allow us to figure out the exact transport type without having to pass it
// in as a separate template parameter here.
//
// It would also be niec if they used covariant return types.  Unfortunately,
// since they return shared_ptr instead of raw pointers, covariant return types
// won't work.
template <typename ServerTraits_,
          typename ServiceTraits_,
          typename TransportFactory_ = TFramedTransportFactory,
          typename Transport_ = TFramedTransport>
class ServiceState : public ServerState {
public:
  typedef typename ServiceTraits_::Processor Processor;
  typedef typename ServiceTraits_::Client Client;
  typedef typename ServiceTraits_::Handler Handler;

  ServiceState()
    : port_(0),
      log_(new EventLog),
      handler_(new Handler(log_)),
      processor_(new Processor(handler_)),
      transportFactory_(new TransportFactory_),
      protocolFactory_(new typename ServiceTraits_::ProtocolFactory),
      serverEventHandler_(new ServerEventHandler(log_)),
      processorEventHandler_(new ProcessorEventHandler(log_)) {
    processor_->setEventHandler(processorEventHandler_);
  }

  boost::shared_ptr<TServer> createServer(uint16_t port) {
    ServerTraits_ serverTraits;
    return serverTraits.createServer(processor_, port, transportFactory_, protocolFactory_);
  }

  boost::shared_ptr<TServerEventHandler> getServerEventHandler() { return serverEventHandler_; }

  void bindSuccessful(uint16_t port) { port_ = port; }

  uint16_t getPort() const { return port_; }

  const boost::shared_ptr<EventLog>& getLog() const { return log_; }

  const boost::shared_ptr<Handler>& getHandler() const { return handler_; }

  boost::shared_ptr<Client> createClient() {
    typedef typename ServiceTraits_::Protocol Protocol;

    boost::shared_ptr<TSocket> socket(new TSocket("127.0.0.1", port_));
    boost::shared_ptr<Transport_> transport(new Transport_(socket));
    boost::shared_ptr<Protocol> protocol(new Protocol(transport));
    transport->open();

    boost::shared_ptr<Client> client(new Client(protocol));
    return client;
  }

private:
  uint16_t port_;
  boost::shared_ptr<EventLog> log_;
  boost::shared_ptr<Handler> handler_;
  boost::shared_ptr<Processor> processor_;
  boost::shared_ptr<TTransportFactory> transportFactory_;
  boost::shared_ptr<TProtocolFactory> protocolFactory_;
  boost::shared_ptr<TServerEventHandler> serverEventHandler_;
  boost::shared_ptr<TProcessorEventHandler> processorEventHandler_;
};

/**
 * Check that there are no more events in the log
 */
void checkNoEvents(const boost::shared_ptr<EventLog>& log) {
  // Wait for an event with a very short timeout period.  We don't expect
  // anything to be present, so we will normally wait for the full timeout.
  // On the other hand, a non-zero timeout is nice since it does give a short
  // window for events to arrive in case there is a problem.
  Event event = log->waitForEvent(10);
  BOOST_CHECK_EQUAL(EventLog::ET_LOG_END, event.type);
}

/**
 * Check for the events that should be logged when a new connection is created.
 *
 * Returns the connection ID allocated by the server.
 */
uint32_t checkNewConnEvents(const boost::shared_ptr<EventLog>& log) {
  // Check for an ET_CONN_CREATED event
  Event event = log->waitForEvent(2500);
  BOOST_CHECK_EQUAL(EventLog::ET_CONN_CREATED, event.type);

  // Some servers call the processContext() hook immediately.
  // Others (TNonblockingServer) only call it once a full request is received.
  // We don't check for it yet, to allow either behavior.

  return event.connectionId;
}

/**
 * Check for the events that should be logged when a connection is closed.
 */
void checkCloseEvents(const boost::shared_ptr<EventLog>& log, uint32_t connId) {
  // Check for an ET_CONN_DESTROYED event
  Event event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CONN_DESTROYED, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);

  // Make sure there are no more events
  checkNoEvents(log);
}

/**
 * Check for the events that should be logged when a call is received
 * and the handler is invoked.
 *
 * It does not check for anything after the handler invocation.
 *
 * Returns the call ID allocated by the server.
 */
uint32_t checkCallHandlerEvents(const boost::shared_ptr<EventLog>& log,
                                uint32_t connId,
                                EventType callType,
                                const string& callName) {
  // Call started
  Event event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CALL_STARTED, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callName, event.message);
  uint32_t callId = event.callId;

  // Pre-read
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_PRE_READ, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  // Post-read
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_POST_READ, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  // Handler invocation
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(callType, event.type);
  // The handler doesn't have any connection or call context,
  // so the connectionId and callId in this event aren't valid

  return callId;
}

/**
 * Check for the events that should be after a handler returns.
 */
void checkCallPostHandlerEvents(const boost::shared_ptr<EventLog>& log,
                                uint32_t connId,
                                uint32_t callId,
                                const string& callName) {
  // Pre-write
  Event event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_PRE_WRITE, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  // Post-write
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_POST_WRITE, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  // Call finished
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CALL_FINISHED, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  // It is acceptable for servers to call processContext() again immediately
  // to start waiting on the next request.  However, some servers wait before
  // getting either a partial request or the full request before calling
  // processContext().  We don't check for the next call to processContext()
  // yet.
}

/**
 * Check for the events that should be logged when a call is made.
 *
 * This just calls checkCallHandlerEvents() followed by
 * checkCallPostHandlerEvents().
 *
 * Returns the call ID allocated by the server.
 */
uint32_t checkCallEvents(const boost::shared_ptr<EventLog>& log,
                         uint32_t connId,
                         EventType callType,
                         const string& callName) {
  uint32_t callId = checkCallHandlerEvents(log, connId, callType, callName);
  checkCallPostHandlerEvents(log, connId, callId, callName);

  return callId;
}

/*
 * Test functions
 */

template <typename State_>
void testParentService(const boost::shared_ptr<State_>& state) {
  boost::shared_ptr<typename State_::Client> client = state->createClient();

  int32_t gen = client->getGeneration();
  int32_t newGen = client->incrementGeneration();
  BOOST_CHECK_EQUAL(gen + 1, newGen);
  newGen = client->getGeneration();
  BOOST_CHECK_EQUAL(gen + 1, newGen);

  client->addString("foo");
  client->addString("bar");
  client->addString("asdf");

  vector<string> strings;
  client->getStrings(strings);
  BOOST_REQUIRE_EQUAL(3, strings.size());
  BOOST_REQUIRE_EQUAL("foo", strings[0]);
  BOOST_REQUIRE_EQUAL("bar", strings[1]);
  BOOST_REQUIRE_EQUAL("asdf", strings[2]);
}

template <typename State_>
void testChildService(const boost::shared_ptr<State_>& state) {
  boost::shared_ptr<typename State_::Client> client = state->createClient();

  // Test calling some of the parent methids via the a child client
  int32_t gen = client->getGeneration();
  int32_t newGen = client->incrementGeneration();
  BOOST_CHECK_EQUAL(gen + 1, newGen);
  newGen = client->getGeneration();
  BOOST_CHECK_EQUAL(gen + 1, newGen);

  // Test some of the child methods
  client->setValue(10);
  BOOST_CHECK_EQUAL(10, client->getValue());
  BOOST_CHECK_EQUAL(10, client->setValue(99));
  BOOST_CHECK_EQUAL(99, client->getValue());
}

template <typename ServerTraits, typename TemplateTraits>
void testBasicService() {
  typedef ServiceState<ServerTraits, ParentServiceTraits<TemplateTraits> > State;

  // Start the server
  boost::shared_ptr<State> state(new State);
  ServerThread serverThread(state, true);

  testParentService(state);
}

template <typename ServerTraits, typename TemplateTraits>
void testInheritedService() {
  typedef ServiceState<ServerTraits, ChildServiceTraits<TemplateTraits> > State;

  // Start the server
  boost::shared_ptr<State> state(new State);
  ServerThread serverThread(state, true);

  testParentService(state);
  testChildService(state);
}

/**
 * Test to make sure that the TServerEventHandler and TProcessorEventHandler
 * methods are invoked in the correct order with the actual events.
 */
template <typename ServerTraits, typename TemplateTraits>
void testEventSequencing() {
  // We use TBufferedTransport for this test, instead of TFramedTransport.
  // This way the server will start processing data as soon as it is received,
  // instead of waiting for the full request.  This is necessary so we can
  // separate the preRead() and postRead() events.
  typedef ServiceState<ServerTraits,
                       ChildServiceTraits<TemplateTraits>,
                       TBufferedTransportFactory,
                       TBufferedTransport> State;

  // Start the server
  boost::shared_ptr<State> state(new State);
  ServerThread serverThread(state, true);

  const boost::shared_ptr<EventLog>& log = state->getLog();

  // Make sure we're at the end of the log
  checkNoEvents(log);

  state->getHandler()->prepareTriggeredCall();

  // Make sure createContext() is called after a connection has been
  // established.  We open a plain socket instead of creating a client.
  boost::shared_ptr<TSocket> socket(new TSocket("127.0.0.1", state->getPort()));
  socket->open();

  // Make sure the proper events occurred after a new connection
  uint32_t connId = checkNewConnEvents(log);

  // Send a message header.  We manually construct the request so that we
  // can test the timing for the preRead() call.
  string requestName = "getDataWait";
  string eventName = "ParentService.getDataWait";
  int32_t seqid = int32_t(time(NULL));
  TBinaryProtocol protocol(socket);
  protocol.writeMessageBegin(requestName, T_CALL, seqid);
  socket->flush();

  // Make sure we saw the call started and pre-read events
  Event event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CALL_STARTED, event.type);
  BOOST_CHECK_EQUAL(eventName, event.message);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  uint32_t callId = event.callId;

  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_PRE_READ, event.type);
  BOOST_CHECK_EQUAL(eventName, event.message);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);

  // Make sure there are no new events
  checkNoEvents(log);

  // Send the rest of the request
  protocol.writeStructBegin("ParentService_getDataNotified_pargs");
  protocol.writeFieldBegin("length", apache::thrift::protocol::T_I32, 1);
  protocol.writeI32(8 * 1024 * 1024);
  protocol.writeFieldEnd();
  protocol.writeFieldStop();
  protocol.writeStructEnd();
  protocol.writeMessageEnd();
  socket->writeEnd();
  socket->flush();

  // We should then see postRead()
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_POST_READ, event.type);
  BOOST_CHECK_EQUAL(eventName, event.message);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);

  // Then the handler should be invoked
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CALL_GET_DATA_WAIT, event.type);

  // The handler won't respond until we notify it.
  // Make sure there are no more events.
  checkNoEvents(log);

  // Notify the handler that it should return
  // We just use a global lock for now, since it is easiest
  state->getHandler()->triggerPendingCalls();

  // The handler will log a separate event before it returns
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_WAIT_RETURN, event.type);

  // We should then see preWrite()
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_PRE_WRITE, event.type);
  BOOST_CHECK_EQUAL(eventName, event.message);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);

  // We requested more data than can be buffered, and we aren't reading it,
  // so the server shouldn't be able to finish its write yet.
  // Make sure there are no more events.
  checkNoEvents(log);

  // Read the response header
  std::string responseName;
  int32_t responseSeqid = 0;
  apache::thrift::protocol::TMessageType responseType;
  protocol.readMessageBegin(responseName, responseType, responseSeqid);
  BOOST_CHECK_EQUAL(responseSeqid, seqid);
  BOOST_CHECK_EQUAL(requestName, responseName);
  BOOST_CHECK_EQUAL(responseType, T_REPLY);
  // Read the body.  We just ignore it for now.
  protocol.skip(T_STRUCT);

  // Now that we have read, the server should have finished sending the data
  // and called the postWrite() handler
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_POST_WRITE, event.type);
  BOOST_CHECK_EQUAL(eventName, event.message);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);

  // Call finished should be last
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CALL_FINISHED, event.type);
  BOOST_CHECK_EQUAL(eventName, event.message);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);

  // There should be no more events
  checkNoEvents(log);

  // Close the connection, and make sure we get a connection destroyed event
  socket->close();
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CONN_DESTROYED, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);

  // There should be no more events
  checkNoEvents(log);
}

template <typename ServerTraits, typename TemplateTraits>
void testSeparateConnections() {
  typedef ServiceState<ServerTraits, ChildServiceTraits<TemplateTraits> > State;

  // Start the server
  boost::shared_ptr<State> state(new State);
  ServerThread serverThread(state, true);

  const boost::shared_ptr<EventLog>& log = state->getLog();

  // Create a client
  boost::shared_ptr<typename State::Client> client1 = state->createClient();

  // Make sure the expected events were logged
  uint32_t client1Id = checkNewConnEvents(log);

  // Create a second client
  boost::shared_ptr<typename State::Client> client2 = state->createClient();

  // Make sure the expected events were logged
  uint32_t client2Id = checkNewConnEvents(log);

  // The two connections should have different IDs
  BOOST_CHECK_NE(client1Id, client2Id);

  // Make a call, and check for the proper events
  int32_t value = 5;
  client1->setValue(value);
  uint32_t call1
      = checkCallEvents(log, client1Id, EventLog::ET_CALL_SET_VALUE, "ChildService.setValue");

  // Make a call with client2
  int32_t v = client2->getValue();
  BOOST_CHECK_EQUAL(value, v);
  checkCallEvents(log, client2Id, EventLog::ET_CALL_GET_VALUE, "ChildService.getValue");

  // Make another call with client1
  v = client1->getValue();
  BOOST_CHECK_EQUAL(value, v);
  uint32_t call2
      = checkCallEvents(log, client1Id, EventLog::ET_CALL_GET_VALUE, "ChildService.getValue");
  BOOST_CHECK_NE(call1, call2);

  // Close the second client, and check for the appropriate events
  client2.reset();
  checkCloseEvents(log, client2Id);
}

template <typename ServerTraits, typename TemplateTraits>
void testOnewayCall() {
  typedef ServiceState<ServerTraits, ChildServiceTraits<TemplateTraits> > State;

  // Start the server
  boost::shared_ptr<State> state(new State);
  ServerThread serverThread(state, true);

  const boost::shared_ptr<EventLog>& log = state->getLog();

  // Create a client
  boost::shared_ptr<typename State::Client> client = state->createClient();
  uint32_t connId = checkNewConnEvents(log);

  // Make a oneway call
  // It should return immediately, even though the server's handler
  // won't return right away
  state->getHandler()->prepareTriggeredCall();
  client->onewayWait();
  string callName = "ParentService.onewayWait";
  uint32_t callId = checkCallHandlerEvents(log, connId, EventLog::ET_CALL_ONEWAY_WAIT, callName);

  // There shouldn't be any more events
  checkNoEvents(log);

  // Trigger the handler to return
  state->getHandler()->triggerPendingCalls();

  // The handler will log an ET_WAIT_RETURN event when it wakes up
  Event event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_WAIT_RETURN, event.type);

  // Now we should see the async complete event, then call finished
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_ASYNC_COMPLETE, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CALL_FINISHED, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  // Destroy the client, and check for connection closed events
  client.reset();
  checkCloseEvents(log, connId);

  checkNoEvents(log);
}

template <typename ServerTraits, typename TemplateTraits>
void testExpectedError() {
  typedef ServiceState<ServerTraits, ChildServiceTraits<TemplateTraits> > State;

  // Start the server
  boost::shared_ptr<State> state(new State);
  ServerThread serverThread(state, true);

  const boost::shared_ptr<EventLog>& log = state->getLog();

  // Create a client
  boost::shared_ptr<typename State::Client> client = state->createClient();
  uint32_t connId = checkNewConnEvents(log);

  // Send the exceptionWait() call
  state->getHandler()->prepareTriggeredCall();
  string message = "test 1234 test";
  client->send_exceptionWait(message);
  string callName = "ParentService.exceptionWait";
  uint32_t callId = checkCallHandlerEvents(log, connId, EventLog::ET_CALL_EXCEPTION_WAIT, callName);

  // There shouldn't be any more events
  checkNoEvents(log);

  // Trigger the handler to return
  state->getHandler()->triggerPendingCalls();

  // The handler will log an ET_WAIT_RETURN event when it wakes up
  Event event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_WAIT_RETURN, event.type);

  // Now receive the response
  try {
    client->recv_exceptionWait();
    BOOST_FAIL("expected MyError to be thrown");
  } catch (const MyError& e) {
    BOOST_CHECK_EQUAL(message, e.message);
    // Check if std::exception::what() is handled properly
    size_t message_pos = std::string(e.what()).find("TException - service has thrown: MyError");
    BOOST_CHECK_NE(message_pos, std::string::npos);
  }

  // Now we should see the events for a normal call finish
  checkCallPostHandlerEvents(log, connId, callId, callName);

  // There shouldn't be any more events
  checkNoEvents(log);

  // Destroy the client, and check for connection closed events
  client.reset();
  checkCloseEvents(log, connId);

  checkNoEvents(log);
}

template <typename ServerTraits, typename TemplateTraits>
void testUnexpectedError() {
  typedef ServiceState<ServerTraits, ChildServiceTraits<TemplateTraits> > State;

  // Start the server
  boost::shared_ptr<State> state(new State);
  ServerThread serverThread(state, true);

  const boost::shared_ptr<EventLog>& log = state->getLog();

  // Create a client
  boost::shared_ptr<typename State::Client> client = state->createClient();
  uint32_t connId = checkNewConnEvents(log);

  // Send the unexpectedExceptionWait() call
  state->getHandler()->prepareTriggeredCall();
  string message = "1234 test 5678";
  client->send_unexpectedExceptionWait(message);
  string callName = "ParentService.unexpectedExceptionWait";
  uint32_t callId
      = checkCallHandlerEvents(log, connId, EventLog::ET_CALL_UNEXPECTED_EXCEPTION_WAIT, callName);

  // There shouldn't be any more events
  checkNoEvents(log);

  // Trigger the handler to return
  state->getHandler()->triggerPendingCalls();

  // The handler will log an ET_WAIT_RETURN event when it wakes up
  Event event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_WAIT_RETURN, event.type);

  // Now receive the response
  try {
    client->recv_unexpectedExceptionWait();
    BOOST_FAIL("expected TApplicationError to be thrown");
  } catch (const TApplicationException&) {
  }

  // Now we should see a handler error event
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_HANDLER_ERROR, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  // pre-write and post-write events aren't generated after a handler error
  // (Even for non-oneway calls where a response is written.)
  //
  // A call finished event is logged when the call context is destroyed
  event = log->waitForEvent();
  BOOST_CHECK_EQUAL(EventLog::ET_CALL_FINISHED, event.type);
  BOOST_CHECK_EQUAL(connId, event.connectionId);
  BOOST_CHECK_EQUAL(callId, event.callId);
  BOOST_CHECK_EQUAL(callName, event.message);

  // There shouldn't be any more events
  checkNoEvents(log);

  // Destroy the client, and check for connection closed events
  client.reset();
  checkCloseEvents(log, connId);

  checkNoEvents(log);
}

// Macro to define simple tests that can be used with all server types
#define DEFINE_SIMPLE_TESTS(Server, Template)                                                      \
  BOOST_AUTO_TEST_CASE(Server##_##Template##_basicService) {                                       \
    testBasicService<Server##Traits, Template##Traits>();                                          \
  }                                                                                                \
  BOOST_AUTO_TEST_CASE(Server##_##Template##_inheritedService) {                                   \
    testInheritedService<Server##Traits, Template##Traits>();                                      \
  }                                                                                                \
  BOOST_AUTO_TEST_CASE(Server##_##Template##_oneway) {                                             \
    testOnewayCall<Server##Traits, Template##Traits>();                                            \
  }                                                                                                \
  BOOST_AUTO_TEST_CASE(Server##_##Template##_exception) {                                          \
    testExpectedError<Server##Traits, Template##Traits>();                                         \
  }                                                                                                \
  BOOST_AUTO_TEST_CASE(Server##_##Template##_unexpectedException) {                                \
    testUnexpectedError<Server##Traits, Template##Traits>();                                       \
  }

// Tests that require the server to process multiple connections concurrently
// (i.e., not TSimpleServer)
#define DEFINE_CONCURRENT_SERVER_TESTS(Server, Template)                                           \
  BOOST_AUTO_TEST_CASE(Server##_##Template##_separateConnections) {                                \
    testSeparateConnections<Server##Traits, Template##Traits>();                                   \
  }

// The testEventSequencing() test manually generates a request for the server,
// and doesn't work with TFramedTransport.  Therefore we can't test it with
// TNonblockingServer.
#define DEFINE_NOFRAME_TESTS(Server, Template)                                                     \
  BOOST_AUTO_TEST_CASE(Server##_##Template##_eventSequencing) {                                    \
    testEventSequencing<Server##Traits, Template##Traits>();                                       \
  }

#define DEFINE_TNONBLOCKINGSERVER_TESTS(Server, Template)                                          \
  DEFINE_SIMPLE_TESTS(Server, Template)                                                            \
  DEFINE_CONCURRENT_SERVER_TESTS(Server, Template)

#define DEFINE_ALL_SERVER_TESTS(Server, Template)                                                  \
  DEFINE_SIMPLE_TESTS(Server, Template)                                                            \
  DEFINE_CONCURRENT_SERVER_TESTS(Server, Template)                                                 \
  DEFINE_NOFRAME_TESTS(Server, Template)

DEFINE_ALL_SERVER_TESTS(TThreadedServer, Templated)
DEFINE_ALL_SERVER_TESTS(TThreadedServer, Untemplated)
DEFINE_ALL_SERVER_TESTS(TThreadPoolServer, Templated)
DEFINE_ALL_SERVER_TESTS(TThreadPoolServer, Untemplated)

DEFINE_TNONBLOCKINGSERVER_TESTS(TNonblockingServer, Templated)
DEFINE_TNONBLOCKINGSERVER_TESTS(TNonblockingServer, Untemplated)
DEFINE_TNONBLOCKINGSERVER_TESTS(TNonblockingServerNoThreads, Templated)
DEFINE_TNONBLOCKINGSERVER_TESTS(TNonblockingServerNoThreads, Untemplated)

DEFINE_SIMPLE_TESTS(TSimpleServer, Templated)
DEFINE_SIMPLE_TESTS(TSimpleServer, Untemplated)
DEFINE_NOFRAME_TESTS(TSimpleServer, Templated)
DEFINE_NOFRAME_TESTS(TSimpleServer, Untemplated)

// TODO: We should test TEventServer in the future.
// For now, it is known not to work correctly with TProcessorEventHandler.
#ifdef BOOST_TEST_DYN_LINK
bool init_unit_test_suite() {
  unit_test::framework::master_test_suite().p_name.value = "ProcessorTest";
  return true;
}

int main( int argc, char* argv[] ) {
  return ::boost::unit_test::unit_test_main(&init_unit_test_suite,argc,argv);
}
#else
unit_test::test_suite* init_unit_test_suite(int argc, char* argv[]) {
  THRIFT_UNUSED_VARIABLE(argc);
  THRIFT_UNUSED_VARIABLE(argv);
  unit_test::framework::master_test_suite().p_name.value = "ProcessorTest";
  return NULL;
}
#endif
