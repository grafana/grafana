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
module thrift.server.transport.ssl;

import std.datetime : Duration;
import std.exception : enforce;
import std.socket : Socket;
import thrift.server.transport.socket;
import thrift.transport.base;
import thrift.transport.socket;
import thrift.transport.ssl;

/**
 * A server transport implementation using SSL-encrypted sockets.
 *
 * Note:
 * On Posix systems which do not have the BSD-specific SO_NOSIGPIPE flag, you
 * might want to ignore the SIGPIPE signal, as OpenSSL might try to write to
 * a closed socket if the peer disconnects abruptly:
 * ---
 * import core.stdc.signal;
 * import core.sys.posix.signal;
 * signal(SIGPIPE, SIG_IGN);
 * ---
 *
 * See: thrift.transport.ssl.
 */
class TSSLServerSocket : TServerSocket {
  /**
   * Creates a new TSSLServerSocket.
   *
   * Params:
   *   port = The port on which to listen.
   *   sslContext = The TSSLContext to use for creating client
   *     sockets. Must be in server-side mode.
   */
  this(ushort port, TSSLContext sslContext) {
    super(port);
    setSSLContext(sslContext);
  }

  /**
   * Creates a new TSSLServerSocket.
   *
   * Params:
   *   port = The port on which to listen.
   *   sendTimeout = The send timeout to set on the client sockets.
   *   recvTimeout = The receive timeout to set on the client sockets.
   *   sslContext = The TSSLContext to use for creating client
   *     sockets. Must be in server-side mode.
   */
  this(ushort port, Duration sendTimeout, Duration recvTimeout,
    TSSLContext sslContext)
  {
    super(port, sendTimeout, recvTimeout);
    setSSLContext(sslContext);
  }

protected:
  override TSocket createTSocket(Socket socket) {
    return new TSSLSocket(sslContext_, socket);
  }

private:
  void setSSLContext(TSSLContext sslContext) {
    enforce(sslContext.serverSide, new TTransportException(
      "Need server-side SSL socket factory for TSSLServerSocket"));
    sslContext_ = sslContext;
  }

  TSSLContext sslContext_;
}
