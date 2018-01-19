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
module thrift.server.transport.socket;

import core.thread : dur, Duration, Thread;
import core.stdc.string : strerror;
import std.array : empty;
import std.conv : text, to;
import std.exception : enforce;
import std.socket;
import thrift.base;
import thrift.internal.socket;
import thrift.server.transport.base;
import thrift.transport.base;
import thrift.transport.socket;
import thrift.util.awaitable;
import thrift.util.cancellation;

private alias TServerTransportException STE;

/**
 * Server socket implementation of TServerTransport.
 *
 * Maps to std.socket listen()/accept(); only provides TCP/IP sockets (i.e. no
 * Unix sockets) for now, because they are not supported in std.socket.
 */
class TServerSocket : TServerTransport {
  /**
   * Constructs a new instance.
   *
   * Params:
   *   port = The TCP port to listen at (host is always 0.0.0.0).
   *   sendTimeout = The socket sending timeout.
   *   recvTimout = The socket receiving timeout.
   */
  this(ushort port, Duration sendTimeout = dur!"hnsecs"(0),
    Duration recvTimeout = dur!"hnsecs"(0))
  {
    port_ = port;
    sendTimeout_ = sendTimeout;
    recvTimeout_ = recvTimeout;

    cancellationNotifier_ = new TSocketNotifier;

    socketSet_ = new SocketSet;
  }

  /// The port the server socket listens at.
  ushort port() const @property {
    return port_;
  }

  /// The socket sending timeout, zero to block infinitely.
  void sendTimeout(Duration sendTimeout) @property {
    sendTimeout_ = sendTimeout;
  }

  /// The socket receiving timeout, zero to block infinitely.
  void recvTimeout(Duration recvTimeout) @property {
    recvTimeout_ = recvTimeout;
  }

  /// The maximum number of listening retries if it fails.
  void retryLimit(ushort retryLimit) @property {
    retryLimit_ = retryLimit;
  }

  /// The delay between a listening attempt failing and retrying it.
  void retryDelay(Duration retryDelay) @property {
    retryDelay_ = retryDelay;
  }

  /// The size of the TCP send buffer, in bytes.
  void tcpSendBuffer(int tcpSendBuffer) @property {
    tcpSendBuffer_ = tcpSendBuffer;
  }

  /// The size of the TCP receiving buffer, in bytes.
  void tcpRecvBuffer(int tcpRecvBuffer) @property {
    tcpRecvBuffer_ = tcpRecvBuffer;
  }

  /// Whether to listen on IPv6 only, if IPv6 support is detected
  /// (default: false).
  void ipv6Only(bool value) @property {
    ipv6Only_ = value;
  }

  override void listen() {
    enforce(!isListening, new STE(STE.Type.ALREADY_LISTENING));

    serverSocket_ = makeSocketAndListen(port_, ACCEPT_BACKLOG, retryLimit_,
      retryDelay_, tcpSendBuffer_, tcpRecvBuffer_, ipv6Only_);
  }

  override void close() {
    enforce(isListening, new STE(STE.Type.NOT_LISTENING));

    serverSocket_.shutdown(SocketShutdown.BOTH);
    serverSocket_.close();
    serverSocket_ = null;
  }

  override bool isListening() @property {
    return serverSocket_ !is null;
  }

  /// Number of connections listen() backlogs.
  enum ACCEPT_BACKLOG = 1024;

  override TTransport accept(TCancellation cancellation = null) {
    enforce(isListening, new STE(STE.Type.NOT_LISTENING));

    if (cancellation) cancellationNotifier_.attach(cancellation.triggering);
    scope (exit) if (cancellation) cancellationNotifier_.detach();


    // Too many EINTRs is a fault condition and would need to be handled
    // manually by our caller, but we can tolerate a certain number.
    enum MAX_EINTRS = 10;
    uint numEintrs;

    while (true) {
      socketSet_.reset();
      socketSet_.add(serverSocket_);
      socketSet_.add(cancellationNotifier_.socket);

      auto ret = Socket.select(socketSet_, null, null);
      enforce(ret != 0, new STE("Socket.select() returned 0.",
        STE.Type.RESOURCE_FAILED));

      if (ret < 0) {
        // Select itself failed, check if it was just due to an interrupted
        // syscall.
        if (getSocketErrno() == INTERRUPTED_ERRNO) {
          if (numEintrs++ < MAX_EINTRS) {
            continue;
          } else {
            throw new STE("Socket.select() was interrupted by a signal (EINTR) " ~
              "more than " ~ to!string(MAX_EINTRS) ~ " times.",
              STE.Type.RESOURCE_FAILED
            );
          }
        }
        throw new STE("Unknown error on Socket.select(): " ~
          socketErrnoString(getSocketErrno()), STE.Type.RESOURCE_FAILED);
      } else {
        // Check for a ping on the interrupt socket.
        if (socketSet_.isSet(cancellationNotifier_.socket)) {
          cancellation.throwIfTriggered();
        }

        // Check for the actual server socket having a connection waiting.
        if (socketSet_.isSet(serverSocket_)) {
          break;
        }
      }
    }

    try {
      auto client = createTSocket(serverSocket_.accept());
      client.sendTimeout = sendTimeout_;
      client.recvTimeout = recvTimeout_;
      return client;
    } catch (SocketException e) {
      throw new STE("Unknown error on accepting: " ~ to!string(e),
        STE.Type.RESOURCE_FAILED);
    }
  }

protected:
  /**
   * Allows derived classes to create a different TSocket type.
   */
  TSocket createTSocket(Socket socket) {
    return new TSocket(socket);
  }

private:
  ushort port_;
  Duration sendTimeout_;
  Duration recvTimeout_;
  ushort retryLimit_;
  Duration retryDelay_;
  uint tcpSendBuffer_;
  uint tcpRecvBuffer_;
  bool ipv6Only_;

  Socket serverSocket_;
  TSocketNotifier cancellationNotifier_;

  // Keep socket set between accept() calls to avoid reallocating.
  SocketSet socketSet_;
}

Socket makeSocketAndListen(ushort port, int backlog, ushort retryLimit,
  Duration retryDelay, uint tcpSendBuffer = 0, uint tcpRecvBuffer = 0,
  bool ipv6Only = false
) {
  Address localAddr;
  try {
    // null represents the wildcard address.
    auto addrInfos = getAddressInfo(null, to!string(port),
      AddressInfoFlags.PASSIVE, SocketType.STREAM, ProtocolType.TCP);
    foreach (i, ai; addrInfos) {
      // Prefer to bind to IPv6 addresses, because then IPv4 is listened to as
      // well, but not the other way round.
      if (ai.family == AddressFamily.INET6 || i == (addrInfos.length - 1)) {
        localAddr = ai.address;
        break;
      }
    }
  } catch (Exception e) {
    throw new STE("Could not determine local address to listen on.",
      STE.Type.RESOURCE_FAILED, __FILE__, __LINE__, e);
  }

  Socket socket;
  try {
    socket = new Socket(localAddr.addressFamily, SocketType.STREAM,
      ProtocolType.TCP);
  } catch (SocketException e) {
    throw new STE("Could not create accepting socket: " ~ to!string(e),
      STE.Type.RESOURCE_FAILED);
  }

  try {
    socket.setOption(SocketOptionLevel.IPV6, SocketOption.IPV6_V6ONLY, ipv6Only);
  } catch (SocketException e) {
    // This is somewhat expected on older systems (e.g. pre-Vista Windows),
    // which do not support the IPV6_V6ONLY flag yet. Racy flag just to avoid
    // log spew in unit tests.
    shared static warned = false;
    if (!warned) {
      logError("Could not set IPV6_V6ONLY socket option: %s", e);
      warned = true;
    }
  }

  alias SocketOptionLevel.SOCKET lvlSock;

  // Prevent 2 maximum segement lifetime delay on accept.
  try {
    socket.setOption(lvlSock, SocketOption.REUSEADDR, true);
  } catch (SocketException e) {
    throw new STE("Could not set REUSEADDR socket option: " ~ to!string(e),
      STE.Type.RESOURCE_FAILED);
  }

  // Set TCP buffer sizes.
  if (tcpSendBuffer > 0) {
    try {
      socket.setOption(lvlSock, SocketOption.SNDBUF, tcpSendBuffer);
    } catch (SocketException e) {
      throw new STE("Could not set socket send buffer size: " ~ to!string(e),
        STE.Type.RESOURCE_FAILED);
    }
  }

  if (tcpRecvBuffer > 0) {
    try {
      socket.setOption(lvlSock, SocketOption.RCVBUF, tcpRecvBuffer);
    } catch (SocketException e) {
      throw new STE("Could not set receive send buffer size: " ~ to!string(e),
        STE.Type.RESOURCE_FAILED);
    }
  }

  // Turn linger off to avoid blocking on socket close.
  try {
    Linger l;
    l.on = 0;
    l.time = 0;
    socket.setOption(lvlSock, SocketOption.LINGER, l);
  } catch (SocketException e) {
    throw new STE("Could not disable socket linger: " ~ to!string(e),
      STE.Type.RESOURCE_FAILED);
  }

  // Set TCP_NODELAY.
  try {
    socket.setOption(SocketOptionLevel.TCP, SocketOption.TCP_NODELAY, true);
  } catch (SocketException e) {
    throw new STE("Could not disable Nagle's algorithm: " ~ to!string(e),
      STE.Type.RESOURCE_FAILED);
  }

  ushort retries;
  while (true) {
    try {
      socket.bind(localAddr);
      break;
    } catch (SocketException) {}

    // If bind() worked, we breaked outside the loop above.
    retries++;
    if (retries < retryLimit) {
      Thread.sleep(retryDelay);
    } else {
      throw new STE(text("Could not bind to address: ", localAddr),
        STE.Type.RESOURCE_FAILED);
    }
  }

  socket.listen(backlog);
  return socket;
}

unittest {
  // Test interrupt().
  {
    auto sock = new TServerSocket(0);
    sock.listen();
    scope (exit) sock.close();

    auto cancellation = new TCancellationOrigin;

    auto intThread = new Thread({
      // Sleep for a bit until the socket is accepting.
      Thread.sleep(dur!"msecs"(50));
      cancellation.trigger();
    });
    intThread.start();

    import std.exception;
    assertThrown!TCancelledException(sock.accept(cancellation));
  }

  // Test receive() timeout on accepted client sockets.
  {
    immutable port = 11122;
    auto timeout = dur!"msecs"(500);
    auto serverSock = new TServerSocket(port, timeout, timeout);
    serverSock.listen();
    scope (exit) serverSock.close();

    auto clientSock = new TSocket("127.0.0.1", port);
    clientSock.open();
    scope (exit) clientSock.close();

    shared bool hasTimedOut;
    auto recvThread = new Thread({
      auto sock = serverSock.accept();
      ubyte[1] data;
      try {
        sock.read(data);
      } catch (TTransportException e) {
        if (e.type == TTransportException.Type.TIMED_OUT) {
          hasTimedOut = true;
        } else {
          import std.stdio;
          stderr.writeln(e);
        }
      }
    });
    recvThread.isDaemon = true;
    recvThread.start();

    // Wait for the timeout, with a little bit of spare time.
    Thread.sleep(timeout + dur!"msecs"(50));
    enforce(hasTimedOut,
      "Client socket receive() blocked for longer than recvTimeout.");
  }
}
