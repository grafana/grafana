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

#ifndef _THRIFT_SERVER_TSERVERFRAMEWORK_H_
#define _THRIFT_SERVER_TSERVERFRAMEWORK_H_ 1

#include <boost/shared_ptr.hpp>
#include <stdint.h>
#include <thrift/TProcessor.h>
#include <thrift/concurrency/Monitor.h>
#include <thrift/server/TConnectedClient.h>
#include <thrift/server/TServer.h>
#include <thrift/transport/TServerTransport.h>
#include <thrift/transport/TTransport.h>

namespace apache {
namespace thrift {
namespace server {

/**
 * TServerFramework provides a single consolidated processing loop for
 * servers.  By having a single processing loop, behavior between servers
 * is more predictable and maintenance cost is lowered.  Implementations
 * of TServerFramework must provide a method to deal with a client that
 * connects and one that disconnects.
 *
 * While this functionality could be rolled directly into TServer, and
 * probably should be, it would break the TServer interface contract so
 * to maintain backwards compatibility for third party servers, no TServers
 * were harmed in the making of this class.
 */
class TServerFramework : public TServer {
public:
  TServerFramework(
      const boost::shared_ptr<apache::thrift::TProcessorFactory>& processorFactory,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& transportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& protocolFactory);

  TServerFramework(
      const boost::shared_ptr<apache::thrift::TProcessor>& processor,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& transportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& protocolFactory);

  TServerFramework(
      const boost::shared_ptr<apache::thrift::TProcessorFactory>& processorFactory,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& inputTransportFactory,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& outputTransportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& inputProtocolFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& outputProtocolFactory);

  TServerFramework(
      const boost::shared_ptr<apache::thrift::TProcessor>& processor,
      const boost::shared_ptr<apache::thrift::transport::TServerTransport>& serverTransport,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& inputTransportFactory,
      const boost::shared_ptr<apache::thrift::transport::TTransportFactory>& outputTransportFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& inputProtocolFactory,
      const boost::shared_ptr<apache::thrift::protocol::TProtocolFactory>& outputProtocolFactory);

  virtual ~TServerFramework();

  /**
   * Accept clients from the TServerTransport and add them for processing.
   * Call stop() on another thread to interrupt processing
   * and return control to the caller.
   * Post-conditions (return guarantees):
   *   The serverTransport will be closed.
   */
  virtual void serve();

  /**
   * Interrupt serve() so that it meets post-conditions and returns.
   */
  virtual void stop();

  /**
   * Get the concurrent client limit.
   * \returns the concurrent client limit
   */
  virtual int64_t getConcurrentClientLimit() const;

  /**
   * Get the number of currently connected clients.
   * \returns the number of currently connected clients
   */
  virtual int64_t getConcurrentClientCount() const;

  /**
   * Get the highest number of concurrent clients.
   * \returns the highest number of concurrent clients
   */
  virtual int64_t getConcurrentClientCountHWM() const;

  /**
   * Set the concurrent client limit.  This can be changed while
   * the server is serving however it will not necessarily be
   * enforced until the next client is accepted and added.  If the
   * limit is lowered below the number of connected clients, no
   * action is taken to disconnect the clients.
   * The default value used if this is not called is INT64_MAX.
   * \param[in]  newLimit  the new limit of concurrent clients
   * \throws std::invalid_argument if newLimit is less than 1
   */
  virtual void setConcurrentClientLimit(int64_t newLimit);

protected:
  /**
   * A client has connected.  The implementation is responsible for managing the
   * lifetime of the client object.  This is called during the serve() thread,
   * therefore a failure to return quickly will result in new client connection
   * delays.
   *
   * \param[in]  pClient  the newly connected client
   */
  virtual void onClientConnected(const boost::shared_ptr<TConnectedClient>& pClient) = 0;

  /**
   * A client has disconnected.
   * When called:
   *   The server no longer tracks the client.
   *   The client TTransport has already been closed.
   *   The implementation must not delete the pointer.
   *
   * \param[in]  pClient  the disconnected client
   */
  virtual void onClientDisconnected(TConnectedClient* pClient) = 0;

private:
  /**
   * Common handling for new connected clients.  Implements concurrent
   * client rate limiting after onClientConnected returns by blocking the
   * serve() thread if the limit has been reached.
   */
  void newlyConnectedClient(const boost::shared_ptr<TConnectedClient>& pClient);

  /**
   * Smart pointer client deletion.
   * Calls onClientDisconnected and then deletes pClient.
   */
  void disposeConnectedClient(TConnectedClient* pClient);

  /**
   * Monitor for limiting the number of concurrent clients.
   */
  apache::thrift::concurrency::Monitor mon_;

  /**
   * The number of concurrent clients.
   */
  int64_t clients_;

  /**
   * The high water mark of concurrent clients.
   */
  int64_t hwm_;

  /**
   * The limit on the number of concurrent clients.
   */
  int64_t limit_;
};
}
}
} // apache::thrift::server

#endif // #ifndef _THRIFT_SERVER_TSERVERFRAMEWORK_H_
