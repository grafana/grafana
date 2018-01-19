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

#ifndef _THRIFT_SERVER_TSERVER_H_
#define _THRIFT_SERVER_TSERVER_H_ 1

#include <thrift/TProcessor.h>
#include <thrift/transport/TServerTransport.h>
#include <thrift/protocol/TBinaryProtocol.h>
#include <thrift/concurrency/Thread.h>

#include <boost/shared_ptr.hpp>

namespace apache {
namespace thrift {
namespace server {

using apache::thrift::TProcessor;
using apache::thrift::protocol::TBinaryProtocolFactory;
using apache::thrift::protocol::TProtocol;
using apache::thrift::protocol::TProtocolFactory;
using apache::thrift::transport::TServerTransport;
using apache::thrift::transport::TTransport;
using apache::thrift::transport::TTransportFactory;

/**
 * Virtual interface class that can handle events from the server core. To
 * use this you should subclass it and implement the methods that you care
 * about. Your subclass can also store local data that you may care about,
 * such as additional "arguments" to these methods (stored in the object
 * instance's state).
 */
class TServerEventHandler {
public:
  virtual ~TServerEventHandler() {}

  /**
   * Called before the server begins.
   */
  virtual void preServe() {}

  /**
   * Called when a new client has connected and is about to being processing.
   */
  virtual void* createContext(boost::shared_ptr<TProtocol> input,
                              boost::shared_ptr<TProtocol> output) {
    (void)input;
    (void)output;
    return NULL;
  }

  /**
   * Called when a client has finished request-handling to delete server
   * context.
   */
  virtual void deleteContext(void* serverContext,
                             boost::shared_ptr<TProtocol> input,
                             boost::shared_ptr<TProtocol> output) {
    (void)serverContext;
    (void)input;
    (void)output;
  }

  /**
   * Called when a client is about to call the processor.
   */
  virtual void processContext(void* serverContext, boost::shared_ptr<TTransport> transport) {
    (void)serverContext;
    (void)transport;
  }

protected:
  /**
   * Prevent direct instantiation.
   */
  TServerEventHandler() {}
};

/**
 * Thrift server.
 *
 */
class TServer : public concurrency::Runnable {
public:
  virtual ~TServer() {}

  virtual void serve() = 0;

  virtual void stop() {}

  // Allows running the server as a Runnable thread
  virtual void run() { serve(); }

  boost::shared_ptr<TProcessorFactory> getProcessorFactory() { return processorFactory_; }

  boost::shared_ptr<TServerTransport> getServerTransport() { return serverTransport_; }

  boost::shared_ptr<TTransportFactory> getInputTransportFactory() { return inputTransportFactory_; }

  boost::shared_ptr<TTransportFactory> getOutputTransportFactory() {
    return outputTransportFactory_;
  }

  boost::shared_ptr<TProtocolFactory> getInputProtocolFactory() { return inputProtocolFactory_; }

  boost::shared_ptr<TProtocolFactory> getOutputProtocolFactory() { return outputProtocolFactory_; }

  boost::shared_ptr<TServerEventHandler> getEventHandler() { return eventHandler_; }

protected:
  TServer(const boost::shared_ptr<TProcessorFactory>& processorFactory)
    : processorFactory_(processorFactory) {
    setInputTransportFactory(boost::shared_ptr<TTransportFactory>(new TTransportFactory()));
    setOutputTransportFactory(boost::shared_ptr<TTransportFactory>(new TTransportFactory()));
    setInputProtocolFactory(boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory()));
    setOutputProtocolFactory(boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory()));
  }

  TServer(const boost::shared_ptr<TProcessor>& processor)
    : processorFactory_(new TSingletonProcessorFactory(processor)) {
    setInputTransportFactory(boost::shared_ptr<TTransportFactory>(new TTransportFactory()));
    setOutputTransportFactory(boost::shared_ptr<TTransportFactory>(new TTransportFactory()));
    setInputProtocolFactory(boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory()));
    setOutputProtocolFactory(boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory()));
  }

  TServer(const boost::shared_ptr<TProcessorFactory>& processorFactory,
          const boost::shared_ptr<TServerTransport>& serverTransport)
    : processorFactory_(processorFactory), serverTransport_(serverTransport) {
    setInputTransportFactory(boost::shared_ptr<TTransportFactory>(new TTransportFactory()));
    setOutputTransportFactory(boost::shared_ptr<TTransportFactory>(new TTransportFactory()));
    setInputProtocolFactory(boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory()));
    setOutputProtocolFactory(boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory()));
  }

  TServer(const boost::shared_ptr<TProcessor>& processor,
          const boost::shared_ptr<TServerTransport>& serverTransport)
    : processorFactory_(new TSingletonProcessorFactory(processor)),
      serverTransport_(serverTransport) {
    setInputTransportFactory(boost::shared_ptr<TTransportFactory>(new TTransportFactory()));
    setOutputTransportFactory(boost::shared_ptr<TTransportFactory>(new TTransportFactory()));
    setInputProtocolFactory(boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory()));
    setOutputProtocolFactory(boost::shared_ptr<TProtocolFactory>(new TBinaryProtocolFactory()));
  }

  TServer(const boost::shared_ptr<TProcessorFactory>& processorFactory,
          const boost::shared_ptr<TServerTransport>& serverTransport,
          const boost::shared_ptr<TTransportFactory>& transportFactory,
          const boost::shared_ptr<TProtocolFactory>& protocolFactory)
    : processorFactory_(processorFactory),
      serverTransport_(serverTransport),
      inputTransportFactory_(transportFactory),
      outputTransportFactory_(transportFactory),
      inputProtocolFactory_(protocolFactory),
      outputProtocolFactory_(protocolFactory) {}

  TServer(const boost::shared_ptr<TProcessor>& processor,
          const boost::shared_ptr<TServerTransport>& serverTransport,
          const boost::shared_ptr<TTransportFactory>& transportFactory,
          const boost::shared_ptr<TProtocolFactory>& protocolFactory)
    : processorFactory_(new TSingletonProcessorFactory(processor)),
      serverTransport_(serverTransport),
      inputTransportFactory_(transportFactory),
      outputTransportFactory_(transportFactory),
      inputProtocolFactory_(protocolFactory),
      outputProtocolFactory_(protocolFactory) {}

  TServer(const boost::shared_ptr<TProcessorFactory>& processorFactory,
          const boost::shared_ptr<TServerTransport>& serverTransport,
          const boost::shared_ptr<TTransportFactory>& inputTransportFactory,
          const boost::shared_ptr<TTransportFactory>& outputTransportFactory,
          const boost::shared_ptr<TProtocolFactory>& inputProtocolFactory,
          const boost::shared_ptr<TProtocolFactory>& outputProtocolFactory)
    : processorFactory_(processorFactory),
      serverTransport_(serverTransport),
      inputTransportFactory_(inputTransportFactory),
      outputTransportFactory_(outputTransportFactory),
      inputProtocolFactory_(inputProtocolFactory),
      outputProtocolFactory_(outputProtocolFactory) {}

  TServer(const boost::shared_ptr<TProcessor>& processor,
          const boost::shared_ptr<TServerTransport>& serverTransport,
          const boost::shared_ptr<TTransportFactory>& inputTransportFactory,
          const boost::shared_ptr<TTransportFactory>& outputTransportFactory,
          const boost::shared_ptr<TProtocolFactory>& inputProtocolFactory,
          const boost::shared_ptr<TProtocolFactory>& outputProtocolFactory)
    : processorFactory_(new TSingletonProcessorFactory(processor)),
      serverTransport_(serverTransport),
      inputTransportFactory_(inputTransportFactory),
      outputTransportFactory_(outputTransportFactory),
      inputProtocolFactory_(inputProtocolFactory),
      outputProtocolFactory_(outputProtocolFactory) {}

  /**
   * Get a TProcessor to handle calls on a particular connection.
   *
   * This method should only be called once per connection (never once per
   * call).  This allows the TProcessorFactory to return a different processor
   * for each connection if it desires.
   */
  boost::shared_ptr<TProcessor> getProcessor(boost::shared_ptr<TProtocol> inputProtocol,
                                             boost::shared_ptr<TProtocol> outputProtocol,
                                             boost::shared_ptr<TTransport> transport) {
    TConnectionInfo connInfo;
    connInfo.input = inputProtocol;
    connInfo.output = outputProtocol;
    connInfo.transport = transport;
    return processorFactory_->getProcessor(connInfo);
  }

  // Class variables
  boost::shared_ptr<TProcessorFactory> processorFactory_;
  boost::shared_ptr<TServerTransport> serverTransport_;

  boost::shared_ptr<TTransportFactory> inputTransportFactory_;
  boost::shared_ptr<TTransportFactory> outputTransportFactory_;

  boost::shared_ptr<TProtocolFactory> inputProtocolFactory_;
  boost::shared_ptr<TProtocolFactory> outputProtocolFactory_;

  boost::shared_ptr<TServerEventHandler> eventHandler_;

public:
  void setInputTransportFactory(boost::shared_ptr<TTransportFactory> inputTransportFactory) {
    inputTransportFactory_ = inputTransportFactory;
  }

  void setOutputTransportFactory(boost::shared_ptr<TTransportFactory> outputTransportFactory) {
    outputTransportFactory_ = outputTransportFactory;
  }

  void setInputProtocolFactory(boost::shared_ptr<TProtocolFactory> inputProtocolFactory) {
    inputProtocolFactory_ = inputProtocolFactory;
  }

  void setOutputProtocolFactory(boost::shared_ptr<TProtocolFactory> outputProtocolFactory) {
    outputProtocolFactory_ = outputProtocolFactory;
  }

  void setServerEventHandler(boost::shared_ptr<TServerEventHandler> eventHandler) {
    eventHandler_ = eventHandler;
  }
};

/**
 * Helper function to increase the max file descriptors limit
 * for the current process and all of its children.
 * By default, tries to increase it to as much as 2^24.
 */
#ifdef HAVE_SYS_RESOURCE_H
int increase_max_fds(int max_fds = (1 << 24));
#endif
}
}
} // apache::thrift::server

#endif // #ifndef _THRIFT_SERVER_TSERVER_H_
