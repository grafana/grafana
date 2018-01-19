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

#ifndef _THRIFT_SERVER_TTHREADEDSERVER_H_
#define _THRIFT_SERVER_TTHREADEDSERVER_H_ 1

#include <map>
#include <thrift/concurrency/Monitor.h>
#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/concurrency/Thread.h>
#include <thrift/server/TServerFramework.h>

namespace apache {
namespace thrift {
namespace server {

/**
 * Manage clients using threads - threads are created one for each client and are
 * released when the client disconnects.  This server is used to make a dynamically
 * scalable server up to the concurrent connection limit.
 */
class TThreadedServer : public TServerFramework {
public:
  TThreadedServer(
      const boost::shared_ptr<apache::thrift::TProcessorFactory>& processorFactory,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& transportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& protocolFactory,
      const boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>& threadFactory
      = boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>(
          new apache::thrift::concurrency::PlatformThreadFactory(false)));

  TThreadedServer(
      const boost::shared_ptr<apache::thrift::TProcessor>& processor,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& transportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& protocolFactory,
      const boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>& threadFactory
      = boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>(
          new apache::thrift::concurrency::PlatformThreadFactory(false)));

  TThreadedServer(
      const boost::shared_ptr<apache::thrift::TProcessorFactory>& processorFactory,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& inputTransportFactory,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& outputTransportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& inputProtocolFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& outputProtocolFactory,
      const boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>& threadFactory
      = boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>(
          new apache::thrift::concurrency::PlatformThreadFactory(false)));

  TThreadedServer(
      const boost::shared_ptr<apache::thrift::TProcessor>& processor,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& inputTransportFactory,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& outputTransportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& inputProtocolFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& outputProtocolFactory,
      const boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>& threadFactory
      = boost::shared_ptr<apache::thrift::concurrency::ThreadFactory>(
          new apache::thrift::concurrency::PlatformThreadFactory(false)));

  virtual ~TThreadedServer();

  /**
   * Post-conditions (return guarantees):
   *   There will be no clients connected.
   */
  virtual void serve();

protected:
  /**
   * Drain recently connected clients by joining their threads - this is done lazily because
   * we cannot do it inside the thread context that is disconnecting.
   */
  virtual void drainDeadClients();

  /**
   * Implementation of TServerFramework::onClientConnected
   */
  virtual void onClientConnected(const boost::shared_ptr<TConnectedClient>& pClient) /* override */;

  /**
   * Implementation of TServerFramework::onClientDisconnected
   */
  virtual void onClientDisconnected(TConnectedClient *pClient) /* override */;

  boost::shared_ptr<apache::thrift::concurrency::ThreadFactory> threadFactory_;

  /**
   * A helper wrapper used to wrap the client in something we can use to maintain
   * the lifetime of the connected client within a detached thread.  We cannot simply
   * track the threads because a shared_ptr<Thread> hangs on to the Runnable it is
   * passed, and TServerFramework requires the runnable (TConnectedClient) to be
   * destroyed in order to work properly.
   */
  class TConnectedClientRunner : public apache::thrift::concurrency::Runnable
  {
  public:
    TConnectedClientRunner(const boost::shared_ptr<TConnectedClient>& pClient);
    virtual ~TConnectedClientRunner();
    void run() /* override */;
  private:
    boost::shared_ptr<TConnectedClient> pClient_;
  };

  apache::thrift::concurrency::Monitor clientMonitor_;

  typedef std::map<TConnectedClient *, boost::shared_ptr<apache::thrift::concurrency::Thread> > ClientMap;

  /**
   * A map of active clients
   */
  ClientMap activeClientMap_;

  /**
   * A map of clients that have disconnected but their threads have not been joined
   */
  ClientMap deadClientMap_;
};

}
}
} // apache::thrift::server

#endif // #ifndef _THRIFT_SERVER_TTHREADEDSERVER_H_
