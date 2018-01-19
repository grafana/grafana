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

#ifndef _THRIFT_TRANSPORT_TSERVERSOCKET_H_
#define _THRIFT_TRANSPORT_TSERVERSOCKET_H_ 1

#include <thrift/transport/TServerTransport.h>
#include <thrift/transport/PlatformSocket.h>
#include <thrift/cxxfunctional.h>
#include <boost/shared_ptr.hpp>

namespace apache {
namespace thrift {
namespace transport {

class TSocket;

/**
 * Server socket implementation of TServerTransport. Wrapper around a unix
 * socket listen and accept calls.
 *
 */
class TServerSocket : public TServerTransport {
public:
  typedef apache::thrift::stdcxx::function<void(THRIFT_SOCKET fd)> socket_func_t;

  const static int DEFAULT_BACKLOG = 1024;

  /**
   * Constructor.
   *
   * @param port    Port number to bind to
   */
  TServerSocket(int port);

  /**
   * Constructor.
   *
   * @param port        Port number to bind to
   * @param sendTimeout Socket send timeout
   * @param recvTimeout Socket receive timeout
   */
  TServerSocket(int port, int sendTimeout, int recvTimeout);

  /**
   * Constructor.
   *
   * @param address Address to bind to
   * @param port    Port number to bind to
   */
  TServerSocket(const std::string& address, int port);

  /**
   * Constructor used for unix sockets.
   *
   * @param path Pathname for unix socket.
   */
  TServerSocket(const std::string& path);

  virtual ~TServerSocket();

  void setSendTimeout(int sendTimeout);
  void setRecvTimeout(int recvTimeout);

  void setAcceptTimeout(int accTimeout);
  void setAcceptBacklog(int accBacklog);

  void setRetryLimit(int retryLimit);
  void setRetryDelay(int retryDelay);

  void setKeepAlive(bool keepAlive) { keepAlive_ = keepAlive; }

  void setTcpSendBuffer(int tcpSendBuffer);
  void setTcpRecvBuffer(int tcpRecvBuffer);

  // listenCallback gets called just before listen, and after all Thrift
  // setsockopt calls have been made.  If you have custom setsockopt
  // things that need to happen on the listening socket, this is the place to do it.
  void setListenCallback(const socket_func_t& listenCallback) { listenCallback_ = listenCallback; }

  // acceptCallback gets called after each accept call, on the newly created socket.
  // It is called after all Thrift setsockopt calls have been made.  If you have
  // custom setsockopt things that need to happen on the accepted
  // socket, this is the place to do it.
  void setAcceptCallback(const socket_func_t& acceptCallback) { acceptCallback_ = acceptCallback; }

  // When enabled (the default), new children TSockets will be constructed so
  // they can be interrupted by TServerTransport::interruptChildren().
  // This is more expensive in terms of system calls (poll + recv) however
  // ensures a connected client cannot interfere with TServer::stop().
  //
  // When disabled, TSocket children do not incur an additional poll() call.
  // Server-side reads are more efficient, however a client can interfere with
  // the server's ability to shutdown properly by staying connected.
  //
  // Must be called before listen(); mode cannot be switched after that.
  // \throws std::logic_error if listen() has been called
  void setInterruptableChildren(bool enable);

  int getPort();

  void listen();
  void interrupt();
  void interruptChildren();
  void close();

protected:
  boost::shared_ptr<TTransport> acceptImpl();
  virtual boost::shared_ptr<TSocket> createSocket(THRIFT_SOCKET client);
  bool interruptableChildren_;
  boost::shared_ptr<THRIFT_SOCKET> pChildInterruptSockReader_; // if interruptableChildren_ this is shared with child TSockets

private:
  void notify(THRIFT_SOCKET notifySock);

  int port_;
  std::string address_;
  std::string path_;
  THRIFT_SOCKET serverSocket_;
  int acceptBacklog_;
  int sendTimeout_;
  int recvTimeout_;
  int accTimeout_;
  int retryLimit_;
  int retryDelay_;
  int tcpSendBuffer_;
  int tcpRecvBuffer_;
  bool keepAlive_;
  bool listening_;

  THRIFT_SOCKET interruptSockWriter_;                          // is notified on interrupt()
  THRIFT_SOCKET interruptSockReader_;                          // is used in select/poll with serverSocket_ for interruptability
  THRIFT_SOCKET childInterruptSockWriter_;                     // is notified on interruptChildren()

  socket_func_t listenCallback_;
  socket_func_t acceptCallback_;
};
}
}
} // apache::thrift::transport

#endif // #ifndef _THRIFT_TRANSPORT_TSERVERSOCKET_H_
