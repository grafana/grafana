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
module thrift.transport.socket;

import core.thread : Thread;
import core.time : dur, Duration;
import std.array : empty;
import std.conv : text, to;
import std.exception : enforce;
import std.socket;
import thrift.base;
import thrift.transport.base;
import thrift.internal.socket;

/**
 * Common parts of a socket TTransport implementation, regardless of how the
 * actual I/O is performed (sync/async).
 */
abstract class TSocketBase : TBaseTransport {
  /**
   * Constructor that takes an already created, connected (!) socket.
   *
   * Params:
   *   socket = Already created, connected socket object.
   */
  this(Socket socket) {
    socket_ = socket;
    setSocketOpts();
  }

  /**
   * Creates a new unconnected socket that will connect to the given host
   * on the given port.
   *
   * Params:
   *   host = Remote host.
   *   port = Remote port.
   */
  this(string host, ushort port) {
    host_ = host;
    port_ = port;
  }

  /**
   * Checks whether the socket is connected.
   */
  override bool isOpen() @property {
    return socket_ !is null;
  }

  /**
   * Writes as much data to the socket as there can be in a single OS call.
   *
   * Params:
   *   buf = Data to write.
   *
   * Returns: The actual number of bytes written. Never more than buf.length.
   */
  abstract size_t writeSome(in ubyte[] buf) out (written) {
    // DMD @@BUG@@: Enabling this e.g. fails the contract in the
    // async_test_server, because buf.length evaluates to 0 here, even though
    // in the method body it correctly is 27 (equal to the return value).
    version (none) assert(written <= buf.length, text("Implementation wrote " ~
      "more data than requested to?! (", written, " vs. ", buf.length, ")"));
  } body {
    assert(0, "DMD bug? – Why would contracts work for interfaces, but not "
      "for abstract methods? "
      "(Error: function […] in and out contracts require function body");
  }

  /**
   * Returns the actual address of the peer the socket is connected to.
   *
   * In contrast, the host and port properties contain the address used to
   * establish the connection, and are not updated after the connection.
   *
   * The socket must be open when calling this.
   */
  Address getPeerAddress() {
    enforce(isOpen, new TTransportException("Cannot get peer host for " ~
      "closed socket.", TTransportException.Type.NOT_OPEN));

    if (!peerAddress_) {
      peerAddress_ = socket_.remoteAddress();
      assert(peerAddress_);
    }

    return peerAddress_;
  }

  /**
   * The host the socket is connected to or will connect to. Null if an
   * already connected socket was used to construct the object.
   */
  string host() const @property {
    return host_;
  }

  /**
   * The port the socket is connected to or will connect to. Zero if an
   * already connected socket was used to construct the object.
   */
  ushort port() const @property {
    return port_;
  }

  /// The socket send timeout.
  Duration sendTimeout() const @property {
    return sendTimeout_;
  }

  /// Ditto
  void sendTimeout(Duration value) @property {
    sendTimeout_ = value;
  }

  /// The socket receiving timeout. Values smaller than 500 ms are not
  /// supported on Windows.
  Duration recvTimeout() const @property {
    return recvTimeout_;
  }

  /// Ditto
  void recvTimeout(Duration value) @property {
    recvTimeout_ = value;
  }

  /**
   * Returns the OS handle of the underlying socket.
   *
   * Should not usually be used directly, but access to it can be necessary
   * to interface with C libraries.
   */
  typeof(socket_.handle()) socketHandle() @property {
    return socket_.handle();
  }

protected:
  /**
   * Sets the needed socket options.
   */
  void setSocketOpts() {
    try {
      alias SocketOptionLevel.SOCKET lvlSock;
      Linger l;
      l.on = 0;
      l.time = 0;
      socket_.setOption(lvlSock, SocketOption.LINGER, l);
    } catch (SocketException e) {
      logError("Could not set socket option: %s", e);
    }

    // Just try to disable Nagle's algorithm – this will fail if we are passed
    // in a non-TCP socket via the Socket-accepting constructor.
    try {
      socket_.setOption(SocketOptionLevel.TCP, SocketOption.TCP_NODELAY, true);
    } catch (SocketException e) {}
  }

  /// Remote host.
  string host_;

  /// Remote port.
  ushort port_;

  /// Timeout for sending.
  Duration sendTimeout_;

  /// Timeout for receiving.
  Duration recvTimeout_;

  /// Cached peer address.
  Address peerAddress_;

  /// Cached peer host name.
  string peerHost_;

  /// Cached peer port.
  ushort peerPort_;

  /// Wrapped socket object.
  Socket socket_;
}

/**
 * Socket implementation of the TTransport interface.
 *
 * Due to the limitations of std.socket, currently only TCP/IP sockets are
 * supported (i.e. Unix domain sockets are not).
 */
class TSocket : TSocketBase {
  ///
  this(Socket socket) {
    super(socket);
  }

  ///
  this(string host, ushort port) {
    super(host, port);
  }

  /**
   * Connects the socket.
   */
  override void open() {
    if (isOpen) return;

    enforce(!host_.empty, new TTransportException(
      "Cannot open socket to null host.", TTransportException.Type.NOT_OPEN));
    enforce(port_ != 0, new TTransportException(
      "Cannot open socket to port zero.", TTransportException.Type.NOT_OPEN));

    Address[] addrs;
    try {
      addrs = getAddress(host_, port_);
    } catch (SocketException e) {
      throw new TTransportException("Could not resolve given host string.",
        TTransportException.Type.NOT_OPEN, __FILE__, __LINE__, e);
    }

    Exception[] errors;
    foreach (addr; addrs) {
      try {
        socket_ = new TcpSocket(addr.addressFamily);
        setSocketOpts();
        socket_.connect(addr);
        break;
      } catch (SocketException e) {
        errors ~= e;
      }
    }
    if (errors.length == addrs.length) {
      socket_ = null;
      // Need to throw a TTransportException to abide the TTransport API.
      import std.algorithm, std.range;
      throw new TTransportException(
        text("Failed to connect to ", host_, ":", port_, "."),
        TTransportException.Type.NOT_OPEN,
        __FILE__, __LINE__,
        new TCompoundOperationException(
          text(
            "All addresses tried failed (",
            joiner(map!q{text(a._0, `: "`, a._1.msg, `"`)}(zip(addrs, errors)), ", "),
            ")."
          ),
          errors
        )
      );
    }
  }

  /**
   * Closes the socket.
   */
  override void close() {
    if (!isOpen) return;

    socket_.close();
    socket_ = null;
  }

  override bool peek() {
    if (!isOpen) return false;

    ubyte buf;
    auto r = socket_.receive((&buf)[0 .. 1], SocketFlags.PEEK);
    if (r == -1) {
      auto lastErrno = getSocketErrno();
      static if (connresetOnPeerShutdown) {
        if (lastErrno == ECONNRESET) {
          close();
          return false;
        }
      }
      throw new TTransportException("Peeking into socket failed: " ~
        socketErrnoString(lastErrno), TTransportException.Type.UNKNOWN);
    }
    return (r > 0);
  }

  override size_t read(ubyte[] buf) {
    enforce(isOpen, new TTransportException(
      "Cannot read if socket is not open.", TTransportException.Type.NOT_OPEN));

    typeof(getSocketErrno()) lastErrno;
    ushort tries;
    while (tries++ <= maxRecvRetries_) {
      auto r = socket_.receive(cast(void[])buf);

      // If recv went fine, immediately return.
      if (r >= 0) return r;

      // Something went wrong, find out how to handle it.
      lastErrno = getSocketErrno();

      if (lastErrno == INTERRUPTED_ERRNO) {
        // If the syscall was interrupted, just try again.
        continue;
      }

      static if (connresetOnPeerShutdown) {
        // See top comment.
        if (lastErrno == ECONNRESET) {
          return 0;
        }
      }

      // Not an error which is handled in a special way, just leave the loop.
      break;
    }

    if (isSocketCloseErrno(lastErrno)) {
      close();
      throw new TTransportException("Receiving failed, closing socket: " ~
        socketErrnoString(lastErrno), TTransportException.Type.NOT_OPEN);
    } else if (lastErrno == TIMEOUT_ERRNO) {
      throw new TTransportException(TTransportException.Type.TIMED_OUT);
    } else {
      throw new TTransportException("Receiving from socket failed: " ~
        socketErrnoString(lastErrno), TTransportException.Type.UNKNOWN);
    }
  }

  override void write(in ubyte[] buf) {
    size_t sent;
    while (sent < buf.length) {
      auto b = writeSome(buf[sent .. $]);
      if (b == 0) {
        // This should only happen if the timeout set with SO_SNDTIMEO expired.
        throw new TTransportException("send() timeout expired.",
          TTransportException.Type.TIMED_OUT);
      }
      sent += b;
    }
    assert(sent == buf.length);
  }

  override size_t writeSome(in ubyte[] buf) {
    enforce(isOpen, new TTransportException(
      "Cannot write if file is not open.", TTransportException.Type.NOT_OPEN));

    auto r = socket_.send(buf);

    // Everything went well, just return the number of bytes written.
    if (r > 0) return r;

    // Handle error conditions.
    if (r < 0) {
      auto lastErrno = getSocketErrno();

      if (lastErrno == WOULD_BLOCK_ERRNO) {
        // Not an exceptional error per se – even with blocking sockets,
        // EAGAIN apparently is returned sometimes on out-of-resource
        // conditions (see the C++ implementation for details). Also, this
        // allows using TSocket with non-blocking sockets e.g. in
        // TNonblockingServer.
        return 0;
      }

      auto type = TTransportException.Type.UNKNOWN;
      if (isSocketCloseErrno(lastErrno)) {
        type = TTransportException.Type.NOT_OPEN;
        close();
      }

      throw new TTransportException("Sending to socket failed: " ~
        socketErrnoString(lastErrno), type);
    }

    // send() should never return 0.
    throw new TTransportException("Sending to socket failed (0 bytes written).",
      TTransportException.Type.UNKNOWN);
  }

  override void sendTimeout(Duration value) @property {
    super.sendTimeout(value);
    setTimeout(SocketOption.SNDTIMEO, value);
  }

  override void recvTimeout(Duration value) @property {
    super.recvTimeout(value);
    setTimeout(SocketOption.RCVTIMEO, value);
  }

  /**
   * Maximum number of retries for receiving from socket on read() in case of
   * EAGAIN/EINTR.
   */
  ushort maxRecvRetries() @property const {
    return maxRecvRetries_;
  }

  /// Ditto
  void maxRecvRetries(ushort value) @property {
    maxRecvRetries_ = value;
  }

  /// Ditto
  enum DEFAULT_MAX_RECV_RETRIES = 5;

protected:
  override void setSocketOpts() {
    super.setSocketOpts();
    setTimeout(SocketOption.SNDTIMEO, sendTimeout_);
    setTimeout(SocketOption.RCVTIMEO, recvTimeout_);
  }

  void setTimeout(SocketOption type, Duration value) {
    assert(type == SocketOption.SNDTIMEO || type == SocketOption.RCVTIMEO);
    version (Win32) {
      if (value > dur!"hnsecs"(0) && value < dur!"msecs"(500)) {
        logError(
          "Socket %s timeout of %s ms might be raised to 500 ms on Windows.",
          (type == SocketOption.SNDTIMEO) ? "send" : "receive",
          value.total!"msecs"
        );
      }
    }

    if (socket_) {
      try {
        socket_.setOption(SocketOptionLevel.SOCKET, type, value);
      } catch (SocketException e) {
        throw new TTransportException(
          "Could not set timeout.",
          TTransportException.Type.UNKNOWN,
          __FILE__,
          __LINE__,
          e
        );
      }
    }
  }

  /// Maximum number of recv() retries.
  ushort maxRecvRetries_  = DEFAULT_MAX_RECV_RETRIES;
}
