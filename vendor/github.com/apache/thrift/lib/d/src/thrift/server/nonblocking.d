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

/**
 * A non-blocking server implementation that operates a set of I/O threads (by
 * default only one) and either does processing »in-line« or off-loads it to a
 * task pool.
 *
 * It *requires* TFramedTransport to be used on the client side, as it expects
 * a 4 byte length indicator and writes out responses using the same framing.
 *
 * Because I/O is done asynchronous/event based, unfortunately
 * TServerTransport can't be used.
 *
 * This implementation is based on the C++ one, with the exception of request
 * timeouts and the drain task queue overload handling strategy not being
 * implemented yet.
 */
// This really should use a D non-blocking I/O library, once one becomes
// available.
module thrift.server.nonblocking;

import core.atomic : atomicLoad, atomicStore, atomicOp;
import core.exception : onOutOfMemoryError;
import core.memory : GC;
import core.sync.mutex;
import core.stdc.stdlib : free, realloc;
import core.time : Duration, dur;
import core.thread : Thread, ThreadGroup;
import deimos.event2.event;
import std.array : empty;
import std.conv : emplace, to;
import std.exception : enforce;
import std.parallelism : TaskPool, task;
import std.socket : Socket, socketPair, SocketAcceptException,
  SocketException, TcpSocket;
import std.variant : Variant;
import thrift.base;
import thrift.internal.endian;
import thrift.internal.socket;
import thrift.internal.traits;
import thrift.protocol.base;
import thrift.protocol.binary;
import thrift.protocol.processor;
import thrift.server.base;
import thrift.server.transport.socket;
import thrift.transport.base;
import thrift.transport.memory;
import thrift.transport.range;
import thrift.transport.socket;
import thrift.util.cancellation;

/**
 * Possible actions taken on new incoming connections when the server is
 * overloaded.
 */
enum TOverloadAction {
  /// Do not take any special actions while the server is overloaded, just
  /// continue accepting connections.
  NONE,

  /// Immediately drop new connections after they have been accepted if the
  /// server is overloaded.
  CLOSE_ON_ACCEPT
}

///
class TNonblockingServer : TServer {
  ///
  this(TProcessor processor, ushort port, TTransportFactory transportFactory,
    TProtocolFactory protocolFactory, TaskPool taskPool = null
  ) {
    this(new TSingletonProcessorFactory(processor), port, transportFactory,
      transportFactory, protocolFactory, protocolFactory, taskPool);
  }

  ///
  this(TProcessorFactory processorFactory, ushort port,
    TTransportFactory transportFactory, TProtocolFactory protocolFactory,
    TaskPool taskPool = null
  ) {
    this(processorFactory, port, transportFactory, transportFactory,
      protocolFactory, protocolFactory, taskPool);
  }

  ///
  this(
    TProcessor processor,
    ushort port,
    TTransportFactory inputTransportFactory,
    TTransportFactory outputTransportFactory,
    TProtocolFactory inputProtocolFactory,
    TProtocolFactory outputProtocolFactory,
    TaskPool taskPool = null
  ) {
    this(new TSingletonProcessorFactory(processor), port,
      inputTransportFactory, outputTransportFactory,
      inputProtocolFactory, outputProtocolFactory, taskPool);
  }

  ///
  this(
    TProcessorFactory processorFactory,
    ushort port,
    TTransportFactory inputTransportFactory,
    TTransportFactory outputTransportFactory,
    TProtocolFactory inputProtocolFactory,
    TProtocolFactory outputProtocolFactory,
    TaskPool taskPool = null
  ) {
    super(processorFactory, null, inputTransportFactory,
      outputTransportFactory, inputProtocolFactory, outputProtocolFactory);
    port_ = port;

    this.taskPool = taskPool;

    connectionMutex_ = new Mutex;

    connectionStackLimit = DEFAULT_CONNECTION_STACK_LIMIT;
    maxActiveProcessors = DEFAULT_MAX_ACTIVE_PROCESSORS;
    maxConnections = DEFAULT_MAX_CONNECTIONS;
    overloadHysteresis = DEFAULT_OVERLOAD_HYSTERESIS;
    overloadAction = DEFAULT_OVERLOAD_ACTION;
    writeBufferDefaultSize = DEFAULT_WRITE_BUFFER_DEFAULT_SIZE;
    idleReadBufferLimit = DEFAULT_IDLE_READ_BUFFER_LIMIT;
    idleWriteBufferLimit = DEFAULT_IDLE_WRITE_BUFFER_LIMIT;
    resizeBufferEveryN = DEFAULT_RESIZE_BUFFER_EVERY_N;
    maxFrameSize = DEFAULT_MAX_FRAME_SIZE;
    numIOThreads_ = DEFAULT_NUM_IO_THREADS;
  }

  override void serve(TCancellation cancellation = null) {
    if (cancellation && cancellation.triggered) return;

    // Initialize the listening socket.
    // TODO: SO_KEEPALIVE, TCP_LOW_MIN_RTO, etc.
    listenSocket_ = makeSocketAndListen(port_, TServerSocket.ACCEPT_BACKLOG,
      BIND_RETRY_LIMIT, BIND_RETRY_DELAY, 0, 0, ipv6Only_);
    listenSocket_.blocking = false;

    logInfo("Using %s I/O thread(s).", numIOThreads_);
    if (taskPool_) {
      logInfo("Using task pool with size: %s.", numIOThreads_, taskPool_.size);
    }

    assert(numIOThreads_ > 0);
    assert(ioLoops_.empty);
    foreach (id; 0 .. numIOThreads_) {
      // The IO loop on the first IO thread (this thread, i.e. the one serve()
      // is called from) also accepts new connections.
      auto listenSocket = (id == 0 ? listenSocket_ : null);
      ioLoops_ ~= new IOLoop(this, listenSocket);
    }

    if (cancellation) {
      cancellation.triggering.addCallback({
        foreach (i, loop; ioLoops_) loop.stop();

        // Stop accepting new connections right away.
        listenSocket_.close();
        listenSocket_ = null;
      });
    }

    // Start the IO helper threads for all but the first loop, which we will run
    // ourselves. Note that the threads run forever, only terminating if stop()
    // is called.
    auto threads = new ThreadGroup();
    foreach (loop; ioLoops_[1 .. $]) {
      auto t = new Thread(&loop.run);
      threads.add(t);
      t.start();
    }

    if (eventHandler) eventHandler.preServe();

    // Run the primary (listener) IO thread loop in our main thread; this will
    // block until the server is shutting down.
    ioLoops_[0].run();

    // Ensure all threads are finished before leaving serve().
    threads.joinAll();

    ioLoops_ = null;
  }

  /**
   * Returns the number of currently active connections, i.e. open sockets.
   */
  size_t numConnections() const @property {
    return numConnections_;
  }

  /**
   * Returns the number of connection objects allocated, but not in use.
   */
  size_t numIdleConnections() const @property {
    return connectionStack_.length;
  }

  /**
   * Return count of number of connections which are currently processing.
   *
   * This is defined as a connection where all data has been received, and the
   * processor was invoked but has not yet completed.
   */
  size_t numActiveProcessors() const @property {
    return numActiveProcessors_;
  }

  /// Number of bind() retries.
  enum BIND_RETRY_LIMIT = 0;

  /// Duration between bind() retries.
  enum BIND_RETRY_DELAY = dur!"hnsecs"(0);

  /// Whether to listen on IPv6 only, if IPv6 support is detected
  // (default: false).
  void ipv6Only(bool value) @property {
    ipv6Only_ = value;
  }

  /**
   * The task pool to use for processing requests. If null, no additional
   * threads are used and request are processed »inline«.
   *
   * Can safely be set even when the server is already running.
   */
  TaskPool taskPool() @property {
    return taskPool_;
  }

  /// ditto
  void taskPool(TaskPool pool) @property {
    taskPool_ = pool;
  }

  /**
   * Hysteresis for overload state.
   *
   * This is the fraction of the overload value that needs to be reached
   * before the overload state is cleared. It must be between 0 and 1,
   * practical choices probably lie between 0.5 and 0.9.
   */
  double overloadHysteresis() const @property {
    return overloadHysteresis_;
  }

  /// Ditto
  void overloadHysteresis(double value) @property {
    enforce(0 < value && value <= 1,
      "Invalid value for overload hysteresis: " ~ to!string(value));
    overloadHysteresis_ = value;
  }

  /// Ditto
  enum DEFAULT_OVERLOAD_HYSTERESIS = 0.8;

  /**
   * The action which will be taken on overload.
   */
  TOverloadAction overloadAction;

  /// Ditto
  enum DEFAULT_OVERLOAD_ACTION = TOverloadAction.NONE;

  /**
   * The write buffer is initialized (and when idleWriteBufferLimit_ is checked
   * and found to be exceeded, reinitialized) to this size.
   */
  size_t writeBufferDefaultSize;

  /// Ditto
  enum size_t DEFAULT_WRITE_BUFFER_DEFAULT_SIZE = 1024;

  /**
   * Max read buffer size for an idle Connection. When we place an idle
   * Connection into connectionStack_ or on every resizeBufferEveryN_ calls,
   * we will free the buffer (such that it will be reinitialized by the next
   * received frame) if it has exceeded this limit. 0 disables this check.
   */
  size_t idleReadBufferLimit;

  /// Ditto
  enum size_t DEFAULT_IDLE_READ_BUFFER_LIMIT = 1024;

  /**
   * Max write buffer size for an idle connection.  When we place an idle
   * Connection into connectionStack_ or on every resizeBufferEveryN_ calls,
   * we ensure that its write buffer is <= to this size; otherwise we
   * replace it with a new one of writeBufferDefaultSize_ bytes to ensure that
   * idle connections don't hog memory. 0 disables this check.
   */
  size_t idleWriteBufferLimit;

  /// Ditto
  enum size_t DEFAULT_IDLE_WRITE_BUFFER_LIMIT = 1024;

  /**
   * Every N calls we check the buffer size limits on a connected Connection.
   * 0 disables (i.e. the checks are only done when a connection closes).
   */
  uint resizeBufferEveryN;

  /// Ditto
  enum uint DEFAULT_RESIZE_BUFFER_EVERY_N = 512;

  /// Limit for how many Connection objects to cache.
  size_t connectionStackLimit;

  /// Ditto
  enum size_t DEFAULT_CONNECTION_STACK_LIMIT = 1024;

  /// Limit for number of open connections before server goes into overload
  /// state.
  size_t maxConnections;

  /// Ditto
  enum size_t DEFAULT_MAX_CONNECTIONS = int.max;

  /// Limit for number of connections processing or waiting to process
  size_t maxActiveProcessors;

  /// Ditto
  enum size_t DEFAULT_MAX_ACTIVE_PROCESSORS = int.max;

  /// Maximum frame size, in bytes.
  ///
  /// If a client tries to send a message larger than this limit, its
  /// connection will be closed. This helps to avoid allocating huge buffers
  /// on bogous input.
  uint maxFrameSize;

  /// Ditto
  enum uint DEFAULT_MAX_FRAME_SIZE = 256 * 1024 * 1024;


  size_t numIOThreads() @property {
    return numIOThreads_;
  }

  void numIOThreads(size_t value) @property {
    enforce(value >= 1, new TException("Must use at least one I/O thread."));
    numIOThreads_ = value;
  }

  enum DEFAULT_NUM_IO_THREADS = 1;

private:
  /**
   * C callback wrapper around acceptConnections(). Expects the custom argument
   * to be the this pointer of the associated server instance.
   */
  extern(C) static void acceptConnectionsCallback(int fd, short which,
    void* serverThis
  ) {
    (cast(TNonblockingServer)serverThis).acceptConnections(fd, which);
  }

  /**
   * Called by libevent (IO loop 0/serve() thread only) when something
   * happened on the listening socket.
   */
  void acceptConnections(int fd, short eventFlags) {
    if (atomicLoad(ioLoops_[0].shuttingDown_)) return;

    assert(!!listenSocket_,
      "Server should be shutting down if listen socket is null.");
    assert(fd == listenSocket_.handle);
    assert(eventFlags & EV_READ);

    // Accept as many new clients as possible, even though libevent signaled
    // only one. This helps the number of calls into libevent space.
    while (true) {
      // It is lame to use exceptions for regular control flow (failing is
      // excepted due to non-blocking mode of operation), but that's the
      // interface std.socket offers…
      Socket clientSocket;
      try {
        clientSocket = listenSocket_.accept();
      } catch (SocketAcceptException e) {
        if (e.errorCode != WOULD_BLOCK_ERRNO) {
          logError("Error accepting connection: %s", e);
        }
        break;
      }

      // If the server is overloaded, this is the point to take the specified
      // action.
      if (overloadAction != TOverloadAction.NONE && checkOverloaded()) {
        nConnectionsDropped_++;
        nTotalConnectionsDropped_++;
        if (overloadAction == TOverloadAction.CLOSE_ON_ACCEPT) {
          clientSocket.close();
          return;
        }
      }

      try {
        clientSocket.blocking = false;
      } catch (SocketException e) {
        logError("Couldn't set client socket to non-blocking mode: %s", e);
        clientSocket.close();
        return;
      }

      // Create a new Connection for this client socket.
      Connection conn = void;
      IOLoop loop = void;
      bool thisThread = void;
      synchronized (connectionMutex_) {
        // Assign an I/O loop to the connection (round-robin).
        assert(nextIOLoop_ >= 0);
        assert(nextIOLoop_ < ioLoops_.length);
        auto selectedThreadIdx = nextIOLoop_;
        nextIOLoop_ = (nextIOLoop_ + 1) % ioLoops_.length;

        loop = ioLoops_[selectedThreadIdx];
        thisThread = (selectedThreadIdx == 0);

        // Check the connection stack to see if we can re-use an existing one.
        if (connectionStack_.empty) {
          ++numConnections_;
          conn = new Connection(clientSocket, loop);

          // Make sure the connection does not get collected while it is active,
          // i.e. hooked up with libevent.
          GC.addRoot(cast(void*)conn);
        } else {
          conn = connectionStack_[$ - 1];
          connectionStack_ = connectionStack_[0 .. $ - 1];
          connectionStack_.assumeSafeAppend();
          conn.init(clientSocket, loop);
        }
      }

      loop.addConnection();

      // Either notify the ioThread that is assigned this connection to
      // start processing, or if it is us, we'll just ask this
      // connection to do its initial state change here.
      //
      // (We need to avoid writing to our own notification pipe, to
      // avoid possible deadlocks if the pipe is full.)
      if (thisThread) {
        conn.transition();
      } else {
        loop.notifyCompleted(conn);
      }
    }
  }

  /// Increment the count of connections currently processing.
  void incrementActiveProcessors() {
    atomicOp!"+="(numActiveProcessors_, 1);
  }

  /// Decrement the count of connections currently processing.
  void decrementActiveProcessors() {
    assert(numActiveProcessors_ > 0);
    atomicOp!"-="(numActiveProcessors_, 1);
  }

  /**
   * Determines if the server is currently overloaded.
   *
   * If the number of open connections or »processing« connections is over the
   * respective limit, the server will enter overload handling mode and a
   * warning will be logged. If below values are below the hysteresis curve,
   * this will cause the server to exit it again.
   *
   * Returns: Whether the server is currently overloaded.
   */
  bool checkOverloaded() {
    auto activeConnections = numConnections_ - connectionStack_.length;
    if (numActiveProcessors_ > maxActiveProcessors ||
        activeConnections > maxConnections) {
      if (!overloaded_) {
        logInfo("Entering overloaded state.");
        overloaded_ = true;
      }
    } else {
      if (overloaded_ &&
        (numActiveProcessors_ <= overloadHysteresis_ * maxActiveProcessors) &&
        (activeConnections <= overloadHysteresis_ * maxConnections))
      {
        logInfo("Exiting overloaded state, %s connection(s) dropped (% total).",
          nConnectionsDropped_, nTotalConnectionsDropped_);
        nConnectionsDropped_ = 0;
        overloaded_ = false;
      }
    }

    return overloaded_;
  }

  /**
   * Marks a connection as inactive and either puts it back into the
   * connection pool or leaves it for garbage collection.
   */
  void disposeConnection(Connection connection) {
    synchronized (connectionMutex_) {
      if (!connectionStackLimit ||
        (connectionStack_.length < connectionStackLimit))
      {
        connection.checkIdleBufferLimit(idleReadBufferLimit,
          idleWriteBufferLimit);
        connectionStack_ ~= connection;
      } else {
        assert(numConnections_ > 0);
        --numConnections_;

        // Leave the connection object for collection now.
        GC.removeRoot(cast(void*)connection);
      }
    }
  }

  /// Socket used to listen for connections and accepting them.
  Socket listenSocket_;

  /// Port to listen on.
  ushort port_;

  /// Whether to listen on IPv6 only.
  bool ipv6Only_;

  /// The total number of connections existing, both active and idle.
  size_t numConnections_;

  /// The number of connections which are currently waiting for the processor
  /// to return.
  shared size_t numActiveProcessors_;

  /// Hysteresis for leaving overload state.
  double overloadHysteresis_;

  /// Whether the server is currently overloaded.
  bool overloaded_;

  /// Number of connections dropped since the server entered the current
  /// overloaded state.
  uint nConnectionsDropped_;

  /// Number of connections dropped due to overload since the server started.
  ulong nTotalConnectionsDropped_;

  /// The task pool used for processing requests.
  TaskPool taskPool_;

  /// Number of IO threads this server will use (>= 1).
  size_t numIOThreads_;

  /// The IOLoops among which socket handling work is distributed.
  IOLoop[] ioLoops_;

  /// The index of the loop in ioLoops_ which will handle the next accepted
  /// connection.
  size_t nextIOLoop_;

  /// All the connection objects which have been created but are not currently
  /// in use. When a connection is closed, it it placed here to enable object
  /// (resp. buffer) reuse.
  Connection[] connectionStack_;

  /// This mutex protects the connection stack.
  Mutex connectionMutex_;
}

private {
  /*
   * Encapsulates a libevent event loop.
   *
   * The design is a bit of a mess, since the first loop is actually run on the
   * server thread itself and is special because it is the only instance for
   * which listenSocket_ is not null.
   */
  final class IOLoop {
    /**
     * Creates a new instance and set up the event base.
     *
     * If listenSocket is not null, the thread will also accept new
     * connections itself.
     */
    this(TNonblockingServer server, Socket listenSocket) {
      server_ = server;
      listenSocket_ = listenSocket;
      initMutex_ = new Mutex;
    }

    /**
     * Runs the event loop; only returns after a call to stop().
     */
    void run() {
      assert(!atomicLoad(initialized_), "IOLoop already running?!");

      synchronized (initMutex_) {
        if (atomicLoad(shuttingDown_)) return;
        atomicStore(initialized_, true);

        assert(!eventBase_);
        eventBase_ = event_base_new();

        if (listenSocket_) {
          // Log the libevent version and backend.
          logInfo("libevent version %s, using method %s.",
            to!string(event_get_version()), to!string(event_base_get_method(eventBase_)));

          // Register the event for the listening socket.
          listenEvent_ = event_new(eventBase_, listenSocket_.handle,
            EV_READ | EV_PERSIST | EV_ET,
            assumeNothrow(&TNonblockingServer.acceptConnectionsCallback),
            cast(void*)server_);
          if (event_add(listenEvent_, null) == -1) {
            throw new TException("event_add for the listening socket event failed.");
          }
        }

        auto pair = socketPair();
        foreach (s; pair) s.blocking = false;
        completionSendSocket_ = pair[0];
        completionReceiveSocket_ = pair[1];

        // Register an event for the task completion notification socket.
        completionEvent_ = event_new(eventBase_, completionReceiveSocket_.handle,
          EV_READ | EV_PERSIST | EV_ET, assumeNothrow(&completedCallback),
          cast(void*)this);

        if (event_add(completionEvent_, null) == -1) {
          throw new TException("event_add for the notification socket failed.");
        }
      }

      // Run libevent engine, returns only after stop().
      event_base_dispatch(eventBase_);

      if (listenEvent_) {
        event_free(listenEvent_);
        listenEvent_ = null;
      }

      event_free(completionEvent_);
      completionEvent_ = null;

      completionSendSocket_.close();
      completionSendSocket_ = null;

      completionReceiveSocket_.close();
      completionReceiveSocket_ = null;

      event_base_free(eventBase_);
      eventBase_ = null;

      atomicStore(shuttingDown_, false);

      initialized_ = false;
    }

    /**
     * Adds a new connection handled by this loop.
     */
    void addConnection() {
      ++numActiveConnections_;
    }

    /**
     * Disposes a connection object (typically after it has been closed).
     */
    void disposeConnection(Connection conn) {
      server_.disposeConnection(conn);
      assert(numActiveConnections_ > 0);
      --numActiveConnections_;
      if (numActiveConnections_ == 0) {
        if (atomicLoad(shuttingDown_)) {
          event_base_loopbreak(eventBase_);
        }
      }
    }

    /**
     * Notifies the event loop that the current step (initialization,
     * processing of a request) on a certain connection has been completed.
     *
     * This function is thread-safe, but should never be called from the
     * thread running the loop itself.
     */
    void notifyCompleted(Connection conn) {
      assert(!!completionSendSocket_);
      auto bytesSent = completionSendSocket_.send(cast(ubyte[])((&conn)[0 .. 1]));

      if (bytesSent != Connection.sizeof) {
        logError("Sending completion notification failed, connection will " ~
          "not be properly terminated.");
      }
    }

    /**
     * Exits the event loop after all currently active connections have been
     * closed.
     *
     * This function is thread-safe.
     */
    void stop() {
      // There is a bug in either libevent or its documentation, having no
      // events registered doesn't actually terminate the loop, because
      // event_base_new() registers some internal one by calling
      // evthread_make_base_notifiable().
      // Due to this, we can't simply remove all events and expect the event
      // loop to terminate. Instead, we ping the event loop using a null
      // completion message. This way, we make sure to wake up the libevent
      // thread if it not currently processing any connections. It will break
      // out of the loop in disposeConnection() after the last active
      // connection has been closed.
      synchronized (initMutex_) {
        atomicStore(shuttingDown_, true);
        if (atomicLoad(initialized_)) notifyCompleted(null);
      }
    }

  private:
    /**
     * C callback to call completed() from libevent.
     *
     * Expects the custom argument to be the this pointer of the associated
     * IOLoop instance.
     */
    extern(C) static void completedCallback(int fd, short what, void* loopThis) {
      assert(what & EV_READ);
      auto loop = cast(IOLoop)loopThis;
      assert(fd == loop.completionReceiveSocket_.handle);
      loop.completed();
    }

    /**
     * Reads from the completion receive socket and appropriately transitions
     * the connections and shuts down the loop if requested.
     */
    void completed() {
      Connection connection;
      ptrdiff_t bytesRead;
      while (true) {
        bytesRead = completionReceiveSocket_.receive(
          cast(ubyte[])((&connection)[0 .. 1]));
        if (bytesRead < 0) {
          auto errno = getSocketErrno();

          if (errno != WOULD_BLOCK_ERRNO) {
            logError("Reading from completion socket failed, some connection " ~
              "will never be properly terminated: %s", socketErrnoString(errno));
          }
        }

        if (bytesRead != Connection.sizeof) break;

        if (!connection) {
          assert(atomicLoad(shuttingDown_));
          if (numActiveConnections_ == 0) {
            event_base_loopbreak(eventBase_);
          }
          continue;
        }

        connection.transition();
      }

      if (bytesRead > 0) {
        logError("Unexpected partial read from completion socket " ~
          "(%s bytes instead of %s).", bytesRead, Connection.sizeof);
      }
    }

    /// associated server
    TNonblockingServer server_;

    /// The managed listening socket, if any.
    Socket listenSocket_;

    /// The libevent event base for the loop.
    event_base* eventBase_;

    /// Triggered on listen socket events.
    event* listenEvent_;

    /// Triggered on completion receive socket events.
    event* completionEvent_;

    /// Socket used to send completion notification messages. Paired with
    /// completionReceiveSocket_.
    Socket completionSendSocket_;

    /// Socket used to send completion notification messages. Paired with
    /// completionSendSocket_.
    Socket completionReceiveSocket_;

    /// Whether the server is currently shutting down (i.e. the cancellation has
    /// been triggered, but not all client connections have been closed yet).
    shared bool shuttingDown_;

    /// The number of currently active client connections.
    size_t numActiveConnections_;

    /// Guards loop startup so that the loop can be reliably shut down even if
    /// another thread has just started to execute run(). Locked during
    /// initialization in run(). When unlocked, the completion mechanism is
    /// expected to be fully set up.
    Mutex initMutex_;
    shared bool initialized_; /// Ditto
  }

  /*
   * I/O states a socket can be in.
   */
  enum SocketState {
    RECV_FRAME_SIZE, /// The frame size is received.
    RECV, /// The payload is received.
    SEND /// The response is written back out.
  }

  /*
   * States a connection can be in.
   */
  enum ConnectionState {
    INIT, /// The connection will be initialized.
    READ_FRAME_SIZE, /// The four frame size bytes are being read.
    READ_REQUEST, /// The request payload itself is being read.
    WAIT_PROCESSOR, /// The connection waits for the processor to finish.
    SEND_RESULT /// The result is written back out.
  }

  /*
   * A connection that is handled via libevent.
   *
   * Data received is buffered until the request is complete (returning back to
   * libevent if not), at which point the processor is invoked.
   */
  final class Connection {
    /**
     * Constructs a new instance.
     *
     * To reuse a connection object later on, the init() function can be used
     * to the same effect on the internal state.
     */
    this(Socket socket, IOLoop loop) {
      // The input and output transport objects are reused between clients
      // connections, so initialize them here rather than in init().
      inputTransport_ = new TInputRangeTransport!(ubyte[])([]);
      outputTransport_ = new TMemoryBuffer(loop.server_.writeBufferDefaultSize);

      init(socket, loop);
    }

    /**
     * Initializes the connection.
     *
     * Params:
     *   socket = The socket to work on.
     *   eventFlags = Any flags to pass to libevent.
     *   s = The server this connection is part of.
     */
    void init(Socket socket, IOLoop loop) {
      // TODO: This allocation could be avoided.
      socket_ = new TSocket(socket);

      loop_ = loop;
      server_ = loop_.server_;
      connState_ = ConnectionState.INIT;
      eventFlags_ = 0;

      readBufferPos_ = 0;
      readWant_ = 0;

      writeBuffer_ = null;
      writeBufferPos_ = 0;
      largestWriteBufferSize_ = 0;

      socketState_ = SocketState.RECV_FRAME_SIZE;
      callsSinceResize_ = 0;

      factoryInputTransport_ =
        server_.inputTransportFactory_.getTransport(inputTransport_);
      factoryOutputTransport_ =
        server_.outputTransportFactory_.getTransport(outputTransport_);

      inputProtocol_ =
        server_.inputProtocolFactory_.getProtocol(factoryInputTransport_);
      outputProtocol_ =
        server_.outputProtocolFactory_.getProtocol(factoryOutputTransport_);

      if (server_.eventHandler) {
        connectionContext_ =
          server_.eventHandler.createContext(inputProtocol_, outputProtocol_);
      }

      auto info = TConnectionInfo(inputProtocol_, outputProtocol_, socket_);
      processor_ = server_.processorFactory_.getProcessor(info);
    }

    ~this() {
      free(readBuffer_);
      if (event_) {
        event_free(event_);
        event_ = null;
      }
    }

    /**
     * Check buffers against the size limits and shrink them if exceeded.
     *
     * Params:
     *   readLimit = Read buffer size limit (in bytes, 0 to ignore).
     *   writeLimit = Write buffer size limit (in bytes, 0 to ignore).
     */
    void checkIdleBufferLimit(size_t readLimit, size_t writeLimit) {
      if (readLimit > 0 && readBufferSize_ > readLimit) {
        free(readBuffer_);
        readBuffer_ = null;
        readBufferSize_ = 0;
      }

      if (writeLimit > 0 && largestWriteBufferSize_ > writeLimit) {
        // just start over
        outputTransport_.reset(server_.writeBufferDefaultSize);
        largestWriteBufferSize_ = 0;
      }
    }

    /**
     * Transitions the connection to the next state.
     *
     * This is called e.g. when the request has been read completely or all
     * the data has been written back.
     */
    void transition() {
      assert(!!loop_);
      assert(!!server_);

      // Switch upon the state that we are currently in and move to a new state
      final switch (connState_) {
        case ConnectionState.READ_REQUEST:
          // We are done reading the request, package the read buffer into transport
          // and get back some data from the dispatch function
          inputTransport_.reset(readBuffer_[0 .. readBufferPos_]);
          outputTransport_.reset();

          // Prepend four bytes of blank space to the buffer so we can
          // write the frame size there later.
          // Strictly speaking, we wouldn't have to write anything, just
          // increment the TMemoryBuffer writeOffset_. This would yield a tiny
          // performance gain.
          ubyte[4] space = void;
          outputTransport_.write(space);

          server_.incrementActiveProcessors();

          taskPool_ = server_.taskPool;
          if (taskPool_) {
            // Create a new task and add it to the task pool queue.
            auto processingTask = task!processRequest(this);
            connState_ = ConnectionState.WAIT_PROCESSOR;
            taskPool_.put(processingTask);

            // We don't want to process any more data while the task is active.
            unregisterEvent();
            return;
          }

          // Just process it right now if there is no task pool set.
          processRequest(this);
          goto case;
        case ConnectionState.WAIT_PROCESSOR:
          // We have now finished processing the request, set the frame size
          // for the outputTransport_ contents and set everything up to write
          // it out via libevent.
          server_.decrementActiveProcessors();

          // Acquire the data written to the transport.
          // KLUDGE: To avoid copying, we simply cast the const away and
          // modify the internal buffer of the TMemoryBuffer – works with the
          // current implementation, but isn't exactly beautiful.
          writeBuffer_ = cast(ubyte[])outputTransport_.getContents();

          assert(writeBuffer_.length >= 4, "The write buffer should have " ~
            "least the initially added dummy length bytes.");
          if (writeBuffer_.length == 4) {
            // The request was one-way, no response to write.
            goto case ConnectionState.INIT;
          }

          // Write the frame size into the four bytes reserved for it.
          auto size = hostToNet(cast(uint)(writeBuffer_.length - 4));
          writeBuffer_[0 .. 4] = cast(ubyte[])((&size)[0 .. 1]);

          writeBufferPos_ = 0;
          socketState_ = SocketState.SEND;
          connState_ = ConnectionState.SEND_RESULT;
          registerEvent(EV_WRITE | EV_PERSIST);

          return;
        case ConnectionState.SEND_RESULT:
          // The result has been sent back to the client, we don't need the
          // buffers anymore.
          if (writeBuffer_.length > largestWriteBufferSize_) {
            largestWriteBufferSize_ = writeBuffer_.length;
          }

          if (server_.resizeBufferEveryN > 0 &&
              ++callsSinceResize_ >= server_.resizeBufferEveryN
          ) {
            checkIdleBufferLimit(server_.idleReadBufferLimit,
              server_.idleWriteBufferLimit);
            callsSinceResize_ = 0;
          }

          goto case;
        case ConnectionState.INIT:
          writeBuffer_ = null;
          writeBufferPos_ = 0;
          socketState_ = SocketState.RECV_FRAME_SIZE;
          connState_ = ConnectionState.READ_FRAME_SIZE;
          readBufferPos_ = 0;
          registerEvent(EV_READ | EV_PERSIST);

          return;
        case ConnectionState.READ_FRAME_SIZE:
          // We just read the request length, set up the buffers for reading
          // the payload.
          if (readWant_ > readBufferSize_) {
            // The current buffer is too small, exponentially grow the buffer
            // until it is big enough.

            if (readBufferSize_ == 0) {
              readBufferSize_ = 1;
            }

            auto newSize = readBufferSize_;
            while (readWant_ > newSize) {
              newSize *= 2;
            }

            auto newBuffer = cast(ubyte*)realloc(readBuffer_, newSize);
            if (!newBuffer) onOutOfMemoryError();

            readBuffer_ = newBuffer;
            readBufferSize_ = newSize;
          }

          readBufferPos_= 0;

          socketState_ = SocketState.RECV;
          connState_ = ConnectionState.READ_REQUEST;

          return;
      }
    }

  private:
    /**
     * C callback to call workSocket() from libevent.
     *
     * Expects the custom argument to be the this pointer of the associated
     * connection.
     */
    extern(C) static void workSocketCallback(int fd, short flags, void* connThis) {
      auto conn = cast(Connection)connThis;
      assert(fd == conn.socket_.socketHandle);
      conn.workSocket();
    }

    /**
     * Invoked by libevent when something happens on the socket.
     */
    void workSocket() {
      final switch (socketState_) {
        case SocketState.RECV_FRAME_SIZE:
          // If some bytes have already been read, they have been kept in
          // readWant_.
          auto frameSize = readWant_;

          try {
            // Read from the socket
            auto bytesRead = socket_.read(
              (cast(ubyte[])((&frameSize)[0 .. 1]))[readBufferPos_ .. $]);
            if (bytesRead == 0) {
              // Couldn't read anything, but we have been notified – client
              // has disconnected.
              close();
              return;
            }

            readBufferPos_ += bytesRead;
          } catch (TTransportException te) {
            logError("Failed to read frame size from client connection: %s", te);
            close();
            return;
          }

          if (readBufferPos_ < frameSize.sizeof) {
            // Frame size not complete yet, save the current buffer in
            // readWant_ so that the remaining bytes can be read later.
            readWant_ = frameSize;
            return;
          }

          auto size = netToHost(frameSize);
          if (size > server_.maxFrameSize) {
            logError("Frame size too large (%s > %s), client %s not using " ~
              "TFramedTransport?", size, server_.maxFrameSize,
              socket_.getPeerAddress().toHostNameString());
            close();
            return;
          }
          readWant_ = size;

          // Now we know the frame size, set everything up for reading the
          // payload.
          transition();
          return;

        case SocketState.RECV:
          // If we already got all the data, we should be in the SEND state.
          assert(readBufferPos_ < readWant_);

          size_t bytesRead;
          try {
            // Read as much as possible from the socket.
            bytesRead = socket_.read(readBuffer_[readBufferPos_ .. readWant_]);
          } catch (TTransportException te) {
            logError("Failed to read from client socket: %s", te);
            close();
            return;
          }

          if (bytesRead == 0) {
            // We were notified, but no bytes could be read -> the client
            // disconnected.
            close();
            return;
          }

          readBufferPos_ += bytesRead;
          assert(readBufferPos_ <= readWant_);

          if (readBufferPos_ == readWant_) {
            // The payload has been read completely, move on.
            transition();
          }

          return;
        case SocketState.SEND:
          assert(writeBufferPos_ <= writeBuffer_.length);

          if (writeBufferPos_ == writeBuffer_.length) {
            // Nothing left to send – this shouldn't happen, just move on.
            logInfo("WARNING: In send state, but no data to send.\n");
            transition();
            return;
          }

          size_t bytesSent;
          try {
            bytesSent = socket_.writeSome(writeBuffer_[writeBufferPos_ .. $]);
          } catch (TTransportException te) {
            logError("Failed to write to client socket: %s", te);
            close();
            return;
          }

          writeBufferPos_ += bytesSent;
          assert(writeBufferPos_ <= writeBuffer_.length);

          if (writeBufferPos_ == writeBuffer_.length) {
            // The whole response has been written out, we are done.
            transition();
          }

          return;
      }
    }

    /**
     * Registers a libevent event for workSocket() with the passed flags,
     * unregistering the previous one (if any).
     */
    void registerEvent(short eventFlags) {
      if (eventFlags_ == eventFlags) {
        // Nothing to do if flags are the same.
        return;
      }

      // Delete the previously existing event.
      unregisterEvent();

      eventFlags_ = eventFlags;

      if (eventFlags == 0) return;

      if (!event_) {
        // If the event was not already allocated, do it now.
        event_ = event_new(loop_.eventBase_, socket_.socketHandle,
          eventFlags_, assumeNothrow(&workSocketCallback), cast(void*)this);
      } else {
        event_assign(event_, loop_.eventBase_, socket_.socketHandle,
          eventFlags_, assumeNothrow(&workSocketCallback), cast(void*)this);
      }

      // Add the event
      if (event_add(event_, null) == -1) {
        logError("event_add() for client socket failed.");
      }
    }

    /**
     * Unregisters the current libevent event, if any.
     */
    void unregisterEvent() {
      if (event_ && eventFlags_ != 0) {
        eventFlags_ = 0;
        if (event_del(event_) == -1) {
          logError("event_del() for client socket failed.");
          return;
        }
      }
    }

    /**
     * Closes this connection and returns it back to the server.
     */
    void close() {
      unregisterEvent();

      if (server_.eventHandler) {
        server_.eventHandler.deleteContext(
          connectionContext_, inputProtocol_, outputProtocol_);
      }

      // Close the socket
      socket_.close();

      // close any factory produced transports.
      factoryInputTransport_.close();
      factoryOutputTransport_.close();

      // This connection object can now be reused.
      loop_.disposeConnection(this);
    }

    /// The server this connection belongs to.
    TNonblockingServer server_;

    /// The task pool used for this connection. This is cached instead of
    /// directly using server_.taskPool to avoid confusion if it is changed in
    /// another thread while the request is processed.
    TaskPool taskPool_;

    /// The I/O thread handling this connection.
    IOLoop loop_;

    /// The socket managed by this connection.
    TSocket socket_;

    /// The libevent object used for registering the workSocketCallback.
    event* event_;

    /// Libevent flags
    short eventFlags_;

    /// Socket mode
    SocketState socketState_;

    /// Application state
    ConnectionState connState_;

    /// The size of the frame to read. If still in READ_FRAME_SIZE state, some
    /// of the bytes might not have been written, and the value might still be
    /// in network byte order. An uint (not a size_t) because the frame size on
    /// the wire is specified as one.
    uint readWant_;

    /// The position in the read buffer, i.e. the number of payload bytes
    /// already received from the socket in READ_REQUEST state, resp. the
    /// number of size bytes in READ_FRAME_SIZE state.
    uint readBufferPos_;

    /// Read buffer
    ubyte* readBuffer_;

    /// Read buffer size
    size_t readBufferSize_;

    /// Write buffer
    ubyte[] writeBuffer_;

    /// How far through writing are we?
    size_t writeBufferPos_;

    /// Largest size of write buffer seen since buffer was constructed
    size_t largestWriteBufferSize_;

    /// Number of calls since the last time checkIdleBufferLimit has been
    /// invoked (see TServer.resizeBufferEveryN).
    uint callsSinceResize_;

    /// Base transports the processor reads from/writes to.
    TInputRangeTransport!(ubyte[]) inputTransport_;
    TMemoryBuffer outputTransport_;

    /// The actual transports passed to the processor obtained via the
    /// transport factory.
    TTransport factoryInputTransport_;
    TTransport factoryOutputTransport_; /// Ditto

    /// Input/output protocols, connected to factory{Input, Output}Transport.
    TProtocol inputProtocol_;
    TProtocol outputProtocol_; /// Ditto.

    /// Connection context optionally created by the server event handler.
    Variant connectionContext_;

    /// The processor used for this connection.
    TProcessor processor_;
  }
}

/*
 * The request processing function, which invokes the processor for the server
 * for all the RPC messages received over a connection.
 *
 * Must be public because it is passed as alias to std.parallelism.task().
 */
void processRequest(Connection connection) {
  try {
    while (true) {
      with (connection) {
        if (server_.eventHandler) {
          server_.eventHandler.preProcess(connectionContext_, socket_);
        }

        if (!processor_.process(inputProtocol_, outputProtocol_,
          connectionContext_) || !inputProtocol_.transport.peek()
        ) {
          // Something went fundamentally wrong or there is nothing more to
          // process, close the connection.
          break;
        }
      }
    }
  } catch (TTransportException ttx) {
    logError("Client died: %s", ttx);
  } catch (Exception e) {
    logError("Uncaught exception: %s", e);
  }

  if (connection.taskPool_) connection.loop_.notifyCompleted(connection);
}

unittest {
  import thrift.internal.test.server;

  // Temporarily disable info log output in order not to spam the test results
  // with startup info messages.
  auto oldInfoLogSink = g_infoLogSink;
  g_infoLogSink = null;
  scope (exit) g_infoLogSink = oldInfoLogSink;

  // Test in-line processing shutdown with one as well as several I/O threads.
  testServeCancel!(TNonblockingServer)();
  testServeCancel!(TNonblockingServer)((TNonblockingServer s) {
    s.numIOThreads = 4;
  });

  // Test task pool processing shutdown with one as well as several I/O threads.
  auto tp = new TaskPool(4);
  tp.isDaemon = true;
  testServeCancel!(TNonblockingServer)((TNonblockingServer s) {
    s.taskPool = tp;
  });
  testServeCancel!(TNonblockingServer)((TNonblockingServer s) {
    s.taskPool = tp;
    s.numIOThreads = 4;
  });
}
