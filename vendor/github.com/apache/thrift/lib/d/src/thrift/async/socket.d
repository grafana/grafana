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
module thrift.async.socket;

import core.thread : Fiber;
import core.time : dur, Duration;
import std.array : empty;
import std.conv : to;
import std.exception : enforce;
import std.socket;
import thrift.base;
import thrift.async.base;
import thrift.transport.base;
import thrift.transport.socket : TSocketBase;
import thrift.internal.endian;
import thrift.internal.socket;

version (Windows) {
  import std.c.windows.winsock : connect;
} else version (Posix) {
  import core.sys.posix.sys.socket : connect;
} else static assert(0, "Don't know connect on this platform.");

/**
 * Non-blocking socket implementation of the TTransport interface.
 *
 * Whenever a socket operation would block, TAsyncSocket registers a callback
 * with the specified TAsyncSocketManager and yields.
 *
 * As for thrift.transport.socket, due to the limitations of std.socket,
 * currently only TCP/IP sockets are supported (i.e. Unix domain sockets are
 * not).
 */
class TAsyncSocket : TSocketBase, TAsyncTransport {
  /**
   * Constructor that takes an already created, connected (!) socket.
   *
   * Params:
   *   asyncManager = The TAsyncSocketManager to use for non-blocking I/O.
   *   socket = Already created, connected socket object. Will be switched to
   *     non-blocking mode if it isn't already.
   */
  this(TAsyncSocketManager asyncManager, Socket socket) {
    asyncManager_ = asyncManager;
    socket.blocking = false;
    super(socket);
  }

  /**
   * Creates a new unconnected socket that will connect to the given host
   * on the given port.
   *
   * Params:
   *   asyncManager = The TAsyncSocketManager to use for non-blocking I/O.
   *   host = Remote host.
   *   port = Remote port.
   */
  this(TAsyncSocketManager asyncManager, string host, ushort port) {
    asyncManager_ = asyncManager;
    super(host, port);
  }

  override TAsyncManager asyncManager() @property {
    return asyncManager_;
  }

  /**
   * Asynchronously connects the socket.
   *
   * Completes without blocking and defers further operations on the socket
   * until the connection is established. If connecting fails, this is
   * currently not indicated in any way other than every call to read/write
   * failing.
   */
  override void open() {
    if (isOpen) return;

    enforce(!host_.empty, new TTransportException(
      "Cannot open null host.", TTransportException.Type.NOT_OPEN));
    enforce(port_ != 0, new TTransportException(
      "Cannot open with null port.", TTransportException.Type.NOT_OPEN));


    // Cannot use std.socket.Socket.connect here because it hides away
    // EINPROGRESS/WSAWOULDBLOCK.
    Address addr;
    try {
      // Currently, we just go with the first address returned, could be made
      // more intelligent though – IPv6?
      addr = getAddress(host_, port_)[0];
    } catch (Exception e) {
      throw new TTransportException(`Unable to resolve host "` ~ host_ ~ `".`,
        TTransportException.Type.NOT_OPEN, __FILE__, __LINE__, e);
    }

    socket_ = new TcpSocket(addr.addressFamily);
    socket_.blocking = false;
    setSocketOpts();

    auto errorCode = connect(socket_.handle, addr.name(), addr.nameLen());
    if (errorCode == 0) {
      // If the connection could be established immediately, just return. I
      // don't know if this ever happens.
      return;
    }

    auto errno = getSocketErrno();
    if (errno != CONNECT_INPROGRESS_ERRNO) {
      throw new TTransportException(`Could not establish connection to "` ~
        host_ ~ `": ` ~ socketErrnoString(errno),
        TTransportException.Type.NOT_OPEN);
    }

    // This is the expected case: connect() signalled that the connection
    // is being established in the background. Queue up a work item with the
    // async manager which just defers any other operations on this
    // TAsyncSocket instance until the socket is ready.
    asyncManager_.execute(this,
      {
        auto fiber = Fiber.getThis();
        TAsyncEventReason reason = void;
        asyncManager_.addOneshotListener(socket_, TAsyncEventType.WRITE,
          connectTimeout,
          scopedDelegate((TAsyncEventReason r){ reason = r; fiber.call(); })
        );
        Fiber.yield();

        if (reason == TAsyncEventReason.TIMED_OUT) {
          // Close the connection, so that subsequent work items fail immediately.
          closeImmediately();
          return;
        }

        int errorCode = void;
        socket_.getOption(SocketOptionLevel.SOCKET, cast(SocketOption)SO_ERROR,
          errorCode);

        if (errorCode) {
          logInfo("Could not connect TAsyncSocket: %s",
            socketErrnoString(errorCode));

          // Close the connection, so that subsequent work items fail immediately.
          closeImmediately();
          return;
        }

      }
    );
  }

  /**
   * Closes the socket.
   *
   * Will block until all currently active operations are finished before the
   * socket is closed.
   */
  override void close() {
    if (!isOpen) return;

    import core.sync.condition;
    import core.sync.mutex;

    auto doneMutex = new Mutex;
    auto doneCond = new Condition(doneMutex);
    synchronized (doneMutex) {
      asyncManager_.execute(this,
        scopedDelegate(
          {
            closeImmediately();
            synchronized (doneMutex) doneCond.notifyAll();
          }
        )
      );
      doneCond.wait();
    }
  }

  override bool peek() {
    if (!isOpen) return false;

    ubyte buf;
    auto r = socket_.receive((&buf)[0..1], SocketFlags.PEEK);
    if (r == Socket.ERROR) {
      auto lastErrno = getSocketErrno();
      static if (connresetOnPeerShutdown) {
        if (lastErrno == ECONNRESET) {
          closeImmediately();
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

    auto r = yieldOnBlock(socket_.receive(cast(void[])buf),
      TAsyncEventType.READ);

    // If recv went fine, immediately return.
    if (r >= 0) return r;

    // Something went wrong, find out how to handle it.
    lastErrno = getSocketErrno();

    static if (connresetOnPeerShutdown) {
      // See top comment.
      if (lastErrno == ECONNRESET) {
        return 0;
      }
    }

    throw new TTransportException("Receiving from socket failed: " ~
      socketErrnoString(lastErrno), TTransportException.Type.UNKNOWN);
  }

  override void write(in ubyte[] buf) {
    size_t sent;
    while (sent < buf.length) {
      sent += writeSome(buf[sent .. $]);
    }
    assert(sent == buf.length);
  }

  override size_t writeSome(in ubyte[] buf) {
    enforce(isOpen, new TTransportException(
      "Cannot write if socket is not open.", TTransportException.Type.NOT_OPEN));

    auto r = yieldOnBlock(socket_.send(buf), TAsyncEventType.WRITE);

    // Everything went well, just return the number of bytes written.
    if (r > 0) return r;

    // Handle error conditions.
    if (r < 0) {
      auto lastErrno = getSocketErrno();

      auto type = TTransportException.Type.UNKNOWN;
      if (isSocketCloseErrno(lastErrno)) {
        type = TTransportException.Type.NOT_OPEN;
        closeImmediately();
      }

      throw new TTransportException("Sending to socket failed: " ~
        socketErrnoString(lastErrno), type);
    }

    // send() should never return 0.
    throw new TTransportException("Sending to socket failed (0 bytes written).",
      TTransportException.Type.UNKNOWN);
  }

  /// The amount of time in which a conncetion must be established before the
  /// open() call times out.
  Duration connectTimeout = dur!"seconds"(5);

private:
  void closeImmediately() {
    socket_.close();
    socket_ = null;
  }

  T yieldOnBlock(T)(lazy T call, TAsyncEventType eventType) {
    while (true) {
      auto result = call();
      if (result != Socket.ERROR || getSocketErrno() != WOULD_BLOCK_ERRNO) return result;

      // We got an EAGAIN result, register a callback to return here once some
      // event happens and yield.

      Duration timeout = void;
      final switch (eventType) {
        case TAsyncEventType.READ:
          timeout = recvTimeout_;
          break;
        case TAsyncEventType.WRITE:
          timeout = sendTimeout_;
          break;
      }

      auto fiber = Fiber.getThis();
      assert(fiber, "Current fiber null – not running in TAsyncManager?");
      TAsyncEventReason eventReason = void;
      asyncManager_.addOneshotListener(socket_, eventType, timeout,
        scopedDelegate((TAsyncEventReason reason) {
          eventReason = reason;
          fiber.call();
        })
      );

      // Yields execution back to the async manager, will return back here once
      // the above listener is called.
      Fiber.yield();

      if (eventReason == TAsyncEventReason.TIMED_OUT) {
        // If we are cancelling the request due to a timed out operation, the
        // connection is in an undefined state, because the server could decide
        // to send the requested data later, or we could have already been half-
        // way into writing a request. Thus, we close the connection to make any
        // possibly queued up work items fail immediately. Besides, the server
        // is not very likely to immediately recover after a socket-level
        // timeout has expired anyway.
        closeImmediately();

        throw new TTransportException("Timed out while waiting for socket " ~
          "to get ready to " ~ to!string(eventType) ~ ".",
          TTransportException.Type.TIMED_OUT);
      }
    }
  }

  /// The TAsyncSocketManager to use for non-blocking I/O.
  TAsyncSocketManager asyncManager_;
}

private {
  // std.socket doesn't include SO_ERROR for reasons unknown.
  version (linux) {
    enum SO_ERROR = 4;
  } else version (OSX) {
    enum SO_ERROR = 0x1007;
  } else version (FreeBSD) {
    enum SO_ERROR = 0x1007;
  } else version (Win32) {
    import std.c.windows.winsock : SO_ERROR;
  } else static assert(false, "Don't know SO_ERROR on this platform.");

  // This hack forces a delegate literal to be scoped, even if it is passed to
  // a function accepting normal delegates as well. DMD likes to allocate the
  // context on the heap anyway, but it seems to work for LDC.
  import std.traits : isDelegate;
  auto scopedDelegate(D)(scope D d) if (isDelegate!D) {
    return d;
  }
}
