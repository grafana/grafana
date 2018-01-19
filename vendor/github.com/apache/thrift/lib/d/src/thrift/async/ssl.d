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
module thrift.async.ssl;

import core.thread : Fiber;
import core.time : Duration;
import std.array : empty;
import std.conv : to;
import std.exception : enforce;
import std.socket;
import deimos.openssl.err;
import deimos.openssl.ssl;
import thrift.base;
import thrift.async.base;
import thrift.async.socket;
import thrift.internal.ssl;
import thrift.internal.ssl_bio;
import thrift.transport.base;
import thrift.transport.ssl;

/**
 * Provides SSL/TLS encryption for async sockets.
 *
 * This implementation should be considered experimental, as it context-switches
 * between fibers from within OpenSSL calls, and the safety of this has not yet
 * been verified.
 *
 * For obvious reasons (the SSL connection is stateful), more than one instance
 * should never be used on a given socket at the same time.
 */
// Note: This could easily be extended to other transports in the future as well.
// There are only two parts of the implementation which don't work with a generic
// TTransport: 1) the certificate verification, for which peer name/address are
// needed from the socket, and 2) the connection shutdown, where the associated
// async manager is needed because close() is not usually called from within a
// work item.
final class TAsyncSSLSocket : TBaseTransport {
  /**
   * Constructor.
   *
   * Params:
   *   context = The SSL socket context to use. A reference to it is stored so
   *     that it does not get cleaned up while the socket is used.
   *   transport = The underlying async network transport to use for
   *     communication.
   */
  this(TAsyncSocket underlyingSocket, TSSLContext context) {
    socket_ = underlyingSocket;
    context_ = context;
    serverSide_ = context.serverSide;
    accessManager_ = context.accessManager;
  }

  override bool isOpen() @property {
    if (ssl_ is null || !socket_.isOpen) return false;

    auto shutdown = SSL_get_shutdown(ssl_);
    bool shutdownReceived = (shutdown & SSL_RECEIVED_SHUTDOWN) != 0;
    bool shutdownSent = (shutdown & SSL_SENT_SHUTDOWN) != 0;
    return !(shutdownReceived && shutdownSent);
  }

  override bool peek() {
    if (!isOpen) return false;
    checkHandshake();

    byte bt = void;
    auto rc = SSL_peek(ssl_, &bt, bt.sizeof);
    sslEnforce(rc >= 0, "SSL_peek");

    if (rc == 0) {
      ERR_clear_error();
    }
    return (rc > 0);
  }

  override void open() {
    enforce(!serverSide_, "Cannot open a server-side SSL socket.");
    if (isOpen) return;

    if (ssl_) {
      // If the underlying socket was automatically closed because of an error
      // (i.e. close() was called from inside a socket method), we can land
      // here with the SSL object still allocated; delete it here.
      cleanupSSL();
    }

    socket_.open();
  }

  override void close() {
    if (!isOpen) return;

    if (ssl_ !is null) {
      // SSL needs to send/receive data over the socket as part of the shutdown
      // protocol, so we must execute the calls in the context of the associated
      // async manager. On the other hand, TTransport clients expect the socket
      // to be closed when close() returns, so we have to block until the
      // shutdown work item has been executed.
      import core.sync.condition;
      import core.sync.mutex;

      int rc = void;
      auto doneMutex = new Mutex;
      auto doneCond = new Condition(doneMutex);
      synchronized (doneMutex) {
        socket_.asyncManager.execute(socket_, {
          rc = SSL_shutdown(ssl_);
          if (rc == 0) {
            rc = SSL_shutdown(ssl_);
          }
          synchronized (doneMutex) doneCond.notifyAll();
        });
        doneCond.wait();
      }

      if (rc < 0) {
        // Do not throw an exception here as leaving the transport "open" will
        // probably produce only more errors, and the chance we can do
        // something about the error e.g. by retrying is very low.
        logError("Error while shutting down SSL: %s", getSSLException());
      }

      cleanupSSL();
    }

    socket_.close();
  }

  override size_t read(ubyte[] buf) {
    checkHandshake();
    auto rc = SSL_read(ssl_, buf.ptr, cast(int)buf.length);
    sslEnforce(rc >= 0, "SSL_read");
    return rc;
  }

  override void write(in ubyte[] buf) {
    checkHandshake();

    // Loop in case SSL_MODE_ENABLE_PARTIAL_WRITE is set in SSL_CTX.
    size_t written = 0;
    while (written < buf.length) {
      auto bytes = SSL_write(ssl_, buf.ptr + written,
        cast(int)(buf.length - written));
      sslEnforce(bytes > 0, "SSL_write");
      written += bytes;
    }
  }

  override void flush() {
    checkHandshake();

    auto bio = SSL_get_wbio(ssl_);
    enforce(bio !is null, new TSSLException("SSL_get_wbio returned null"));

    auto rc = BIO_flush(bio);
    sslEnforce(rc == 1, "BIO_flush");
  }

  /**
   * Whether to use client or server side SSL handshake protocol.
   */
  bool serverSide() @property const {
    return serverSide_;
  }

  /// Ditto
  void serverSide(bool value) @property {
    serverSide_ = value;
  }

  /**
   * The access manager to use.
   */
  void accessManager(TAccessManager value) @property {
    accessManager_ = value;
  }

private:
  /**
   * If the condition is false, cleans up the SSL connection and throws the
   * exception for the last SSL error.
   */
  void sslEnforce(bool condition, string location) {
    if (!condition) {
      // We need to fetch the error first, as the error stack will be cleaned
      // when shutting down SSL.
      auto e = getSSLException(location);
      cleanupSSL();
      throw e;
    }
  }

  /**
   * Frees the SSL connection object and clears the SSL error state.
   */
  void cleanupSSL() {
    SSL_free(ssl_);
    ssl_ = null;
    ERR_remove_state(0);
  }

  /**
   * Makes sure the SSL connection is up and running, and initializes it if not.
   */
  void checkHandshake() {
    enforce(socket_.isOpen, new TTransportException(
      TTransportException.Type.NOT_OPEN));

    if (ssl_ !is null) return;
    ssl_ = context_.createSSL();

    auto bio = createTTransportBIO(socket_, false);
    SSL_set_bio(ssl_, bio, bio);

    int rc = void;
    if (serverSide_) {
      rc = SSL_accept(ssl_);
    } else {
      rc = SSL_connect(ssl_);
    }
    enforce(rc > 0, getSSLException());

    auto addr = socket_.getPeerAddress();
    authorize(ssl_, accessManager_, addr,
      (serverSide_ ? addr.toHostNameString() : socket_.host));
  }

  TAsyncSocket socket_;
  bool serverSide_;
  SSL* ssl_;
  TSSLContext context_;
  TAccessManager accessManager_;
}

/**
 * Wraps passed TAsyncSocket instances into TAsyncSSLSockets.
 *
 * Typically used with TAsyncClient. As an unfortunate consequence of the
 * async client design, the passed transports cannot be statically verified to
 * be of type TAsyncSocket. Instead, the type is verified at runtime – if a
 * transport of an unexpected type is passed to getTransport(), it fails,
 * throwing a TTransportException.
 *
 * Example:
 * ---
 * auto context = nwe TSSLContext();
 * ... // Configure SSL context.
 * auto factory = new TAsyncSSLSocketFactory(context);
 *
 * auto socket = new TAsyncSocket(someAsyncManager, host, port);
 * socket.open();
 *
 * auto client = new TAsyncClient!Service(transport, factory,
 *   new TBinaryProtocolFactory!());
 * ---
 */
class TAsyncSSLSocketFactory : TTransportFactory {
  ///
  this(TSSLContext context) {
    context_ = context;
  }

  override TAsyncSSLSocket getTransport(TTransport transport) {
    auto socket = cast(TAsyncSocket)transport;
    enforce(socket, new TTransportException(
      "TAsyncSSLSocketFactory requires a TAsyncSocket to work on, not a " ~
      to!string(typeid(transport)) ~ ".",
      TTransportException.Type.INTERNAL_ERROR
    ));
    return new TAsyncSSLSocket(socket, context_);
  }

private:
  TSSLContext context_;
}
