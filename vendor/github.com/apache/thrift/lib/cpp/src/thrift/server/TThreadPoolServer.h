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

#ifndef _THRIFT_SERVER_TTHREADPOOLSERVER_H_
#define _THRIFT_SERVER_TTHREADPOOLSERVER_H_ 1

#include <boost/atomic.hpp>
#include <thrift/concurrency/ThreadManager.h>
#include <thrift/server/TServerFramework.h>

namespace apache {
namespace thrift {
namespace server {

/**
 * Manage clients using a thread pool.
 */
class TThreadPoolServer : public TServerFramework {
public:
  TThreadPoolServer(
      const boost::shared_ptr<apache::thrift::TProcessorFactory>& processorFactory,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& transportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& protocolFactory,
      const boost::shared_ptr<apache::thrift::concurrency::ThreadManager>& threadManager
      = apache::thrift::concurrency::ThreadManager::newSimpleThreadManager());

  TThreadPoolServer(
      const boost::shared_ptr<apache::thrift::TProcessor>& processor,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& transportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& protocolFactory,
      const boost::shared_ptr<apache::thrift::concurrency::ThreadManager>& threadManager
      = apache::thrift::concurrency::ThreadManager::newSimpleThreadManager());

  TThreadPoolServer(
      const boost::shared_ptr<apache::thrift::TProcessorFactory>& processorFactory,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& inputTransportFactory,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& outputTransportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& inputProtocolFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& outputProtocolFactory,
      const boost::shared_ptr<apache::thrift::concurrency::ThreadManager>& threadManager
      = apache::thrift::concurrency::ThreadManager::newSimpleThreadManager());

  TThreadPoolServer(
      const boost::shared_ptr<apache::thrift::TProcessor>& processor,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& inputTransportFactory,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& outputTransportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& inputProtocolFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& outputProtocolFactory,
      const boost::shared_ptr<apache::thrift::concurrency::ThreadManager>& threadManager
      = apache::thrift::concurrency::ThreadManager::newSimpleThreadManager());

  virtual ~TThreadPoolServer();

  /**
   * Post-conditions (return guarantees):
   *   There will be no clients connected.
   */
  virtual void serve();

  virtual int64_t getTimeout() const;
  virtual void setTimeout(int64_t value);

  virtual int64_t getTaskExpiration() const;
  virtual void setTaskExpiration(int64_t value);

  virtual boost::shared_ptr<apache::thrift::concurrency::ThreadManager> getThreadManager() const;

protected:
  virtual void onClientConnected(const boost::shared_ptr<TConnectedClient>& pClient) /* override */;
  virtual void onClientDisconnected(TConnectedClient* pClient) /* override */;

  boost::shared_ptr<apache::thrift::concurrency::ThreadManager> threadManager_;
  boost::atomic<int64_t> timeout_;
  boost::atomic<int64_t> taskExpiration_;
};

}
}
} // apache::thrift::server

#endif // #ifndef _THRIFT_SERVER_TTHREADPOOLSERVER_H_
