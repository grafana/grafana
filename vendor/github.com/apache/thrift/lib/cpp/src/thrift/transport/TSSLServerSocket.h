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

#ifndef _THRIFT_TRANSPORT_TSSLSERVERSOCKET_H_
#define _THRIFT_TRANSPORT_TSSLSERVERSOCKET_H_ 1

#include <boost/shared_ptr.hpp>
#include <thrift/transport/TServerSocket.h>

namespace apache {
namespace thrift {
namespace transport {

class TSSLSocketFactory;

/**
 * Server socket that accepts SSL connections.
 */
class TSSLServerSocket : public TServerSocket {
public:
  /**
   * Constructor.  Binds to all interfaces.
   *
   * @param port    Listening port
   * @param factory SSL socket factory implementation
   */
  TSSLServerSocket(int port, boost::shared_ptr<TSSLSocketFactory> factory);

  /**
   * Constructor.  Binds to the specified address.
   *
   * @param address Address to bind to
   * @param port    Listening port
   * @param factory SSL socket factory implementation
   */
  TSSLServerSocket(const std::string& address,
                   int port,
                   boost::shared_ptr<TSSLSocketFactory> factory);

  /**
   * Constructor.  Binds to all interfaces.
   *
   * @param port        Listening port
   * @param sendTimeout Socket send timeout
   * @param recvTimeout Socket receive timeout
   * @param factory     SSL socket factory implementation
   */
  TSSLServerSocket(int port,
                   int sendTimeout,
                   int recvTimeout,
                   boost::shared_ptr<TSSLSocketFactory> factory);

protected:
  boost::shared_ptr<TSocket> createSocket(THRIFT_SOCKET socket);
  boost::shared_ptr<TSSLSocketFactory> factory_;
};
}
}
}

#endif
