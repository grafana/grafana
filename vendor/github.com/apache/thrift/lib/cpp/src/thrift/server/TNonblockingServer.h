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

#ifndef _THRIFT_SERVER_TNONBLOCKINGSERVER_H_
#define _THRIFT_SERVER_TNONBLOCKINGSERVER_H_ 1

#include <thrift/Thrift.h>
#include <thrift/server/TServer.h>
#include <thrift/transport/PlatformSocket.h>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/transport/TSocket.h>
#include <thrift/concurrency/ThreadManager.h>
#include <climits>
#include <thrift/concurrency/Thread.h>
#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/concurrency/Mutex.h>
#include <stack>
#include <vector>
#include <string>
#include <cstdlib>
#ifdef HAVE_UNISTD_H
#include <unistd.h>
#endif
#include <event.h>
#include <event2/event_compat.h>
#include <event2/event_struct.h>

namespace apache {
namespace thrift {
namespace server {

using apache::thrift::transport::TMemoryBuffer;
using apache::thrift::transport::TSocket;
using apache::thrift::protocol::TProtocol;
using apache::thrift::concurrency::Runnable;
using apache::thrift::concurrency::ThreadManager;
using apache::thrift::concurrency::PlatformThreadFactory;
using apache::thrift::concurrency::ThreadFactory;
using apache::thrift::concurrency::Thread;
using apache::thrift::concurrency::Mutex;
using apache::thrift::concurrency::Guard;

#ifdef LIBEVENT_VERSION_NUMBER
#define LIBEVENT_VERSION_MAJOR (LIBEVENT_VERSION_NUMBER >> 24)
#define LIBEVENT_VERSION_MINOR ((LIBEVENT_VERSION_NUMBER >> 16) & 0xFF)
#define LIBEVENT_VERSION_REL ((LIBEVENT_VERSION_NUMBER >> 8) & 0xFF)
#else
// assume latest version 1 series
#define LIBEVENT_VERSION_MAJOR 1
#define LIBEVENT_VERSION_MINOR 14
#define LIBEVENT_VERSION_REL 13
#define LIBEVENT_VERSION_NUMBER                                                                    \
  ((LIBEVENT_VERSION_MAJOR << 24) | (LIBEVENT_VERSION_MINOR << 16) | (LIBEVENT_VERSION_REL << 8))
#endif

#if LIBEVENT_VERSION_NUMBER < 0x02000000
typedef THRIFT_SOCKET evutil_socket_t;
#endif

#ifndef SOCKOPT_CAST_T
#ifndef _WIN32
#define SOCKOPT_CAST_T void
#else
#define SOCKOPT_CAST_T char
#endif // _WIN32
#endif

template <class T>
inline const SOCKOPT_CAST_T* const_cast_sockopt(const T* v) {
  return reinterpret_cast<const SOCKOPT_CAST_T*>(v);
}

template <class T>
inline SOCKOPT_CAST_T* cast_sockopt(T* v) {
  return reinterpret_cast<SOCKOPT_CAST_T*>(v);
}

/**
 * This is a non-blocking server in C++ for high performance that
 * operates a set of IO threads (by default only one). It assumes that
 * all incoming requests are framed with a 4 byte length indicator and
 * writes out responses using the same framing.
 *
 * It does not use the TServerTransport framework, but rather has socket
 * operations hardcoded for use with select.
 *
 */

/// Overload condition actions.
enum TOverloadAction {
  T_OVERLOAD_NO_ACTION,       ///< Don't handle overload */
  T_OVERLOAD_CLOSE_ON_ACCEPT, ///< Drop new connections immediately */
  T_OVERLOAD_DRAIN_TASK_QUEUE ///< Drop some tasks from head of task queue */
};

class TNonblockingIOThread;

class TNonblockingServer : public TServer {
private:
  class TConnection;

  friend class TNonblockingIOThread;

private:
  /// Listen backlog
  static const int LISTEN_BACKLOG = 1024;

  /// Default limit on size of idle connection pool
  static const size_t CONNECTION_STACK_LIMIT = 1024;

  /// Default limit on frame size
  static const int MAX_FRAME_SIZE = 256 * 1024 * 1024;

  /// Default limit on total number of connected sockets
  static const int MAX_CONNECTIONS = INT_MAX;

  /// Default limit on connections in handler/task processing
  static const int MAX_ACTIVE_PROCESSORS = INT_MAX;

  /// Default size of write buffer
  static const int WRITE_BUFFER_DEFAULT_SIZE = 1024;

  /// Maximum size of read buffer allocated to idle connection (0 = unlimited)
  static const int IDLE_READ_BUFFER_LIMIT = 1024;

  /// Maximum size of write buffer allocated to idle connection (0 = unlimited)
  static const int IDLE_WRITE_BUFFER_LIMIT = 1024;

  /// # of calls before resizing oversized buffers (0 = check only on close)
  static const int RESIZE_BUFFER_EVERY_N = 512;

  /// # of IO threads to use by default
  static const int DEFAULT_IO_THREADS = 1;

  /// # of IO threads this server will use
  size_t numIOThreads_;

  /// Whether to set high scheduling priority for IO threads
  bool useHighPriorityIOThreads_;

  /// Server socket file descriptor
  THRIFT_SOCKET serverSocket_;

  /// Port server runs on. Zero when letting OS decide actual port
  int port_;

  /// Port server actually runs on
  int listenPort_;

  /// The optional user-provided event-base (for single-thread servers)
  event_base* userEventBase_;

  /// For processing via thread pool, may be NULL
  boost::shared_ptr<ThreadManager> threadManager_;

  /// Is thread pool processing?
  bool threadPoolProcessing_;

  // Factory to create the IO threads
  boost::shared_ptr<PlatformThreadFactory> ioThreadFactory_;

  // Vector of IOThread objects that will handle our IO
  std::vector<boost::shared_ptr<TNonblockingIOThread> > ioThreads_;

  // Index of next IO Thread to be used (for round-robin)
  uint32_t nextIOThread_;

  // Synchronizes access to connection stack and similar data
  Mutex connMutex_;

  /// Number of TConnection object we've created
  size_t numTConnections_;

  /// Number of Connections processing or waiting to process
  size_t numActiveProcessors_;

  /// Limit for how many TConnection objects to cache
  size_t connectionStackLimit_;

  /// Limit for number of connections processing or waiting to process
  size_t maxActiveProcessors_;

  /// Limit for number of open connections
  size_t maxConnections_;

  /// Limit for frame size
  size_t maxFrameSize_;

  /// Time in milliseconds before an unperformed task expires (0 == infinite).
  int64_t taskExpireTime_;

  /**
   * Hysteresis for overload state.  This is the fraction of the overload
   * value that needs to be reached before the overload state is cleared;
   * must be <= 1.0.
   */
  double overloadHysteresis_;

  /// Action to take when we're overloaded.
  TOverloadAction overloadAction_;

  /**
   * The write buffer is initialized (and when idleWriteBufferLimit_ is checked
   * and found to be exceeded, reinitialized) to this size.
   */
  size_t writeBufferDefaultSize_;

  /**
   * Max read buffer size for an idle TConnection.  When we place an idle
   * TConnection into connectionStack_ or on every resizeBufferEveryN_ calls,
   * we will free the buffer (such that it will be reinitialized by the next
   * received frame) if it has exceeded this limit.  0 disables this check.
   */
  size_t idleReadBufferLimit_;

  /**
   * Max write buffer size for an idle connection.  When we place an idle
   * TConnection into connectionStack_ or on every resizeBufferEveryN_ calls,
   * we insure that its write buffer is <= to this size; otherwise we
   * replace it with a new one of writeBufferDefaultSize_ bytes to insure that
   * idle connections don't hog memory. 0 disables this check.
   */
  size_t idleWriteBufferLimit_;

  /**
   * Every N calls we check the buffer size limits on a connected TConnection.
   * 0 disables (i.e. the checks are only done when a connection closes).
   */
  int32_t resizeBufferEveryN_;

  /// Set if we are currently in an overloaded state.
  bool overloaded_;

  /// Count of connections dropped since overload started
  uint32_t nConnectionsDropped_;

  /// Count of connections dropped on overload since server started
  uint64_t nTotalConnectionsDropped_;

  /**
   * This is a stack of all the objects that have been created but that
   * are NOT currently in use. When we close a connection, we place it on this
   * stack so that the object can be reused later, rather than freeing the
   * memory and reallocating a new object later.
   */
  std::stack<TConnection*> connectionStack_;

  /**
   * This container holds pointers to all active connections. This container
   * allows the server to clean up unlcosed connection objects at destruction,
   * which in turn allows their transports, protocols, processors and handlers
   * to deallocate and clean up correctly.
   */
  std::vector<TConnection*> activeConnections_;

  /**
   * Called when server socket had something happen.  We accept all waiting
   * client connections on listen socket fd and assign TConnection objects
   * to handle those requests.
   *
   * @param fd the listen socket.
   * @param which the event flag that triggered the handler.
   */
  void handleEvent(THRIFT_SOCKET fd, short which);

  void init(int port) {
    serverSocket_ = THRIFT_INVALID_SOCKET;
    numIOThreads_ = DEFAULT_IO_THREADS;
    nextIOThread_ = 0;
    useHighPriorityIOThreads_ = false;
    port_ = port;
    listenPort_ = port;
    userEventBase_ = NULL;
    threadPoolProcessing_ = false;
    numTConnections_ = 0;
    numActiveProcessors_ = 0;
    connectionStackLimit_ = CONNECTION_STACK_LIMIT;
    maxActiveProcessors_ = MAX_ACTIVE_PROCESSORS;
    maxConnections_ = MAX_CONNECTIONS;
    maxFrameSize_ = MAX_FRAME_SIZE;
    taskExpireTime_ = 0;
    overloadHysteresis_ = 0.8;
    overloadAction_ = T_OVERLOAD_NO_ACTION;
    writeBufferDefaultSize_ = WRITE_BUFFER_DEFAULT_SIZE;
    idleReadBufferLimit_ = IDLE_READ_BUFFER_LIMIT;
    idleWriteBufferLimit_ = IDLE_WRITE_BUFFER_LIMIT;
    resizeBufferEveryN_ = RESIZE_BUFFER_EVERY_N;
    overloaded_ = false;
    nConnectionsDropped_ = 0;
    nTotalConnectionsDropped_ = 0;
  }

public:
  TNonblockingServer(const boost::shared_ptr<TProcessorFactory>& processorFactory, int port)
    : TServer(processorFactory) {
    init(port);
  }

  TNonblockingServer(const boost::shared_ptr<TProcessor>& processor, int port)
    : TServer(processor) {
    init(port);
  }

  TNonblockingServer(const boost::shared_ptr<TProcessorFactory>& processorFactory,
                     const boost::shared_ptr<TProtocolFactory>& protocolFactory,
                     int port,
                     const boost::shared_ptr<ThreadManager>& threadManager
                     = boost::shared_ptr<ThreadManager>())
    : TServer(processorFactory) {

    init(port);

    setInputProtocolFactory(protocolFactory);
    setOutputProtocolFactory(protocolFactory);
    setThreadManager(threadManager);
  }

  TNonblockingServer(const boost::shared_ptr<TProcessor>& processor,
                     const boost::shared_ptr<TProtocolFactory>& protocolFactory,
                     int port,
                     const boost::shared_ptr<ThreadManager>& threadManager
                     = boost::shared_ptr<ThreadManager>())
    : TServer(processor) {

    init(port);

    setInputProtocolFactory(protocolFactory);
    setOutputProtocolFactory(protocolFactory);
    setThreadManager(threadManager);
  }

  TNonblockingServer(const boost::shared_ptr<TProcessorFactory>& processorFactory,
                     const boost::shared_ptr<TTransportFactory>& inputTransportFactory,
                     const boost::shared_ptr<TTransportFactory>& outputTransportFactory,
                     const boost::shared_ptr<TProtocolFactory>& inputProtocolFactory,
                     const boost::shared_ptr<TProtocolFactory>& outputProtocolFactory,
                     int port,
                     const boost::shared_ptr<ThreadManager>& threadManager
                     = boost::shared_ptr<ThreadManager>())
    : TServer(processorFactory) {

    init(port);

    setInputTransportFactory(inputTransportFactory);
    setOutputTransportFactory(outputTransportFactory);
    setInputProtocolFactory(inputProtocolFactory);
    setOutputProtocolFactory(outputProtocolFactory);
    setThreadManager(threadManager);
  }

  TNonblockingServer(const boost::shared_ptr<TProcessor>& processor,
                     const boost::shared_ptr<TTransportFactory>& inputTransportFactory,
                     const boost::shared_ptr<TTransportFactory>& outputTransportFactory,
                     const boost::shared_ptr<TProtocolFactory>& inputProtocolFactory,
                     const boost::shared_ptr<TProtocolFactory>& outputProtocolFactory,
                     int port,
                     const boost::shared_ptr<ThreadManager>& threadManager
                     = boost::shared_ptr<ThreadManager>())
    : TServer(processor) {

    init(port);

    setInputTransportFactory(inputTransportFactory);
    setOutputTransportFactory(outputTransportFactory);
    setInputProtocolFactory(inputProtocolFactory);
    setOutputProtocolFactory(outputProtocolFactory);
    setThreadManager(threadManager);
  }

  ~TNonblockingServer();

  void setThreadManager(boost::shared_ptr<ThreadManager> threadManager);

  int getListenPort() { return listenPort_; }

  boost::shared_ptr<ThreadManager> getThreadManager() { return threadManager_; }

  /**
   * Sets the number of IO threads used by this server. Can only be used before
   * the call to serve() and has no effect afterwards.  We always use a
   * PosixThreadFactory for the IO worker threads, because they must joinable
   * for clean shutdown.
   */
  void setNumIOThreads(size_t numThreads) {
    numIOThreads_ = numThreads;
    // User-provided event-base doesn't works for multi-threaded servers
    assert(numIOThreads_ <= 1 || !userEventBase_);
  }

  /** Return whether the IO threads will get high scheduling priority */
  bool useHighPriorityIOThreads() const { return useHighPriorityIOThreads_; }

  /** Set whether the IO threads will get high scheduling priority. */
  void setUseHighPriorityIOThreads(bool val) { useHighPriorityIOThreads_ = val; }

  /** Return the number of IO threads used by this server. */
  size_t getNumIOThreads() const { return numIOThreads_; }

  /**
   * Get the maximum number of unused TConnection we will hold in reserve.
   *
   * @return the current limit on TConnection pool size.
   */
  size_t getConnectionStackLimit() const { return connectionStackLimit_; }

  /**
   * Set the maximum number of unused TConnection we will hold in reserve.
   *
   * @param sz the new limit for TConnection pool size.
   */
  void setConnectionStackLimit(size_t sz) { connectionStackLimit_ = sz; }

  bool isThreadPoolProcessing() const { return threadPoolProcessing_; }

  void addTask(boost::shared_ptr<Runnable> task) {
    threadManager_->add(task, 0LL, taskExpireTime_);
  }

  /**
   * Return the count of sockets currently connected to.
   *
   * @return count of connected sockets.
   */
  size_t getNumConnections() const { return numTConnections_; }

  /**
   * Return the count of sockets currently connected to.
   *
   * @return count of connected sockets.
   */
  size_t getNumActiveConnections() const { return getNumConnections() - getNumIdleConnections(); }

  /**
   * Return the count of connection objects allocated but not in use.
   *
   * @return count of idle connection objects.
   */
  size_t getNumIdleConnections() const { return connectionStack_.size(); }

  /**
   * Return count of number of connections which are currently processing.
   * This is defined as a connection where all data has been received and
   * either assigned a task (when threading) or passed to a handler (when
   * not threading), and where the handler has not yet returned.
   *
   * @return # of connections currently processing.
   */
  size_t getNumActiveProcessors() const { return numActiveProcessors_; }

  /// Increment the count of connections currently processing.
  void incrementActiveProcessors() {
    Guard g(connMutex_);
    ++numActiveProcessors_;
  }

  /// Decrement the count of connections currently processing.
  void decrementActiveProcessors() {
    Guard g(connMutex_);
    if (numActiveProcessors_ > 0) {
      --numActiveProcessors_;
    }
  }

  /**
   * Get the maximum # of connections allowed before overload.
   *
   * @return current setting.
   */
  size_t getMaxConnections() const { return maxConnections_; }

  /**
   * Set the maximum # of connections allowed before overload.
   *
   * @param maxConnections new setting for maximum # of connections.
   */
  void setMaxConnections(size_t maxConnections) { maxConnections_ = maxConnections; }

  /**
   * Get the maximum # of connections waiting in handler/task before overload.
   *
   * @return current setting.
   */
  size_t getMaxActiveProcessors() const { return maxActiveProcessors_; }

  /**
   * Set the maximum # of connections waiting in handler/task before overload.
   *
   * @param maxActiveProcessors new setting for maximum # of active processes.
   */
  void setMaxActiveProcessors(size_t maxActiveProcessors) {
    maxActiveProcessors_ = maxActiveProcessors;
  }

  /**
   * Get the maximum allowed frame size.
   *
   * If a client tries to send a message larger than this limit,
   * its connection will be closed.
   *
   * @return Maxium frame size, in bytes.
   */
  size_t getMaxFrameSize() const { return maxFrameSize_; }

  /**
   * Set the maximum allowed frame size.
   *
   * @param maxFrameSize The new maximum frame size.
   */
  void setMaxFrameSize(size_t maxFrameSize) { maxFrameSize_ = maxFrameSize; }

  /**
   * Get fraction of maximum limits before an overload condition is cleared.
   *
   * @return hysteresis fraction
   */
  double getOverloadHysteresis() const { return overloadHysteresis_; }

  /**
   * Set fraction of maximum limits before an overload condition is cleared.
   * A good value would probably be between 0.5 and 0.9.
   *
   * @param hysteresisFraction fraction <= 1.0.
   */
  void setOverloadHysteresis(double hysteresisFraction) {
    if (hysteresisFraction <= 1.0 && hysteresisFraction > 0.0) {
      overloadHysteresis_ = hysteresisFraction;
    }
  }

  /**
   * Get the action the server will take on overload.
   *
   * @return a TOverloadAction enum value for the currently set action.
   */
  TOverloadAction getOverloadAction() const { return overloadAction_; }

  /**
   * Set the action the server is to take on overload.
   *
   * @param overloadAction a TOverloadAction enum value for the action.
   */
  void setOverloadAction(TOverloadAction overloadAction) { overloadAction_ = overloadAction; }

  /**
   * Get the time in milliseconds after which a task expires (0 == infinite).
   *
   * @return a 64-bit time in milliseconds.
   */
  int64_t getTaskExpireTime() const { return taskExpireTime_; }

  /**
   * Set the time in milliseconds after which a task expires (0 == infinite).
   *
   * @param taskExpireTime a 64-bit time in milliseconds.
   */
  void setTaskExpireTime(int64_t taskExpireTime) { taskExpireTime_ = taskExpireTime; }

  /**
   * Determine if the server is currently overloaded.
   * This function checks the maximums for open connections and connections
   * currently in processing, and sets an overload condition if they are
   * exceeded.  The overload will persist until both values are below the
   * current hysteresis fraction of their maximums.
   *
   * @return true if an overload condition exists, false if not.
   */
  bool serverOverloaded();

  /** Pop and discard next task on threadpool wait queue.
   *
   * @return true if a task was discarded, false if the wait queue was empty.
   */
  bool drainPendingTask();

  /**
   * Get the starting size of a TConnection object's write buffer.
   *
   * @return # bytes we initialize a TConnection object's write buffer to.
   */
  size_t getWriteBufferDefaultSize() const { return writeBufferDefaultSize_; }

  /**
   * Set the starting size of a TConnection object's write buffer.
   *
   * @param size # bytes we initialize a TConnection object's write buffer to.
   */
  void setWriteBufferDefaultSize(size_t size) { writeBufferDefaultSize_ = size; }

  /**
   * Get the maximum size of read buffer allocated to idle TConnection objects.
   *
   * @return # bytes beyond which we will dealloc idle buffer.
   */
  size_t getIdleReadBufferLimit() const { return idleReadBufferLimit_; }

  /**
   * [NOTE: This is for backwards compatibility, use getIdleReadBufferLimit().]
   * Get the maximum size of read buffer allocated to idle TConnection objects.
   *
   * @return # bytes beyond which we will dealloc idle buffer.
   */
  size_t getIdleBufferMemLimit() const { return idleReadBufferLimit_; }

  /**
   * Set the maximum size read buffer allocated to idle TConnection objects.
   * If a TConnection object is found (either on connection close or between
   * calls when resizeBufferEveryN_ is set) with more than this much memory
   * allocated to its read buffer, we free it and allow it to be reinitialized
   * on the next received frame.
   *
   * @param limit of bytes beyond which we will shrink buffers when checked.
   */
  void setIdleReadBufferLimit(size_t limit) { idleReadBufferLimit_ = limit; }

  /**
   * [NOTE: This is for backwards compatibility, use setIdleReadBufferLimit().]
   * Set the maximum size read buffer allocated to idle TConnection objects.
   * If a TConnection object is found (either on connection close or between
   * calls when resizeBufferEveryN_ is set) with more than this much memory
   * allocated to its read buffer, we free it and allow it to be reinitialized
   * on the next received frame.
   *
   * @param limit of bytes beyond which we will shrink buffers when checked.
   */
  void setIdleBufferMemLimit(size_t limit) { idleReadBufferLimit_ = limit; }

  /**
   * Get the maximum size of write buffer allocated to idle TConnection objects.
   *
   * @return # bytes beyond which we will reallocate buffers when checked.
   */
  size_t getIdleWriteBufferLimit() const { return idleWriteBufferLimit_; }

  /**
   * Set the maximum size write buffer allocated to idle TConnection objects.
   * If a TConnection object is found (either on connection close or between
   * calls when resizeBufferEveryN_ is set) with more than this much memory
   * allocated to its write buffer, we destroy and construct that buffer with
   * writeBufferDefaultSize_ bytes.
   *
   * @param limit of bytes beyond which we will shrink buffers when idle.
   */
  void setIdleWriteBufferLimit(size_t limit) { idleWriteBufferLimit_ = limit; }

  /**
   * Get # of calls made between buffer size checks.  0 means disabled.
   *
   * @return # of calls between buffer size checks.
   */
  int32_t getResizeBufferEveryN() const { return resizeBufferEveryN_; }

  /**
   * Check buffer sizes every "count" calls.  This allows buffer limits
   * to be enforced for persistent connections with a controllable degree
   * of overhead. 0 disables checks except at connection close.
   *
   * @param count the number of calls between checks, or 0 to disable
   */
  void setResizeBufferEveryN(int32_t count) { resizeBufferEveryN_ = count; }

  /**
   * Main workhorse function, starts up the server listening on a port and
   * loops over the libevent handler.
   */
  void serve();

  /**
   * Causes the server to terminate gracefully (can be called from any thread).
   */
  void stop();

  /// Creates a socket to listen on and binds it to the local port.
  void createAndListenOnSocket();

  /**
   * Takes a socket created by createAndListenOnSocket() and sets various
   * options on it to prepare for use in the server.
   *
   * @param fd descriptor of socket to be initialized/
   */
  void listenSocket(THRIFT_SOCKET fd);

  /**
   * Register the optional user-provided event-base (for single-thread servers)
   *
   * This method should be used when the server is running in a single-thread
   * mode, and the event base is provided by the user (i.e., the caller).
   *
   * @param user_event_base the user-provided event-base. The user is
   * responsible for freeing the event base memory.
   */
  void registerEvents(event_base* user_event_base);

  /**
   * Returns the optional user-provided event-base (for single-thread servers).
   */
  event_base* getUserEventBase() const { return userEventBase_; }

  /** Some transports, like THeaderTransport, require passing through
   * the framing size instead of stripping it.
   */
  bool getHeaderTransport();

private:
  /**
   * Callback function that the threadmanager calls when a task reaches
   * its expiration time.  It is needed to clean up the expired connection.
   *
   * @param task the runnable associated with the expired task.
   */
  void expireClose(boost::shared_ptr<Runnable> task);

  /**
   * Return an initialized connection object.  Creates or recovers from
   * pool a TConnection and initializes it with the provided socket FD
   * and flags.
   *
   * @param socket FD of socket associated with this connection.
   * @param addr the sockaddr of the client
   * @param addrLen the length of addr
   * @return pointer to initialized TConnection object.
   */
  TConnection* createConnection(THRIFT_SOCKET socket, const sockaddr* addr, socklen_t addrLen);

  /**
   * Returns a connection to pool or deletion.  If the connection pool
   * (a stack) isn't full, place the connection object on it, otherwise
   * just delete it.
   *
   * @param connection the TConection being returned.
   */
  void returnConnection(TConnection* connection);
};

class TNonblockingIOThread : public Runnable {
public:
  // Creates an IO thread and sets up the event base.  The listenSocket should
  // be a valid FD on which listen() has already been called.  If the
  // listenSocket is < 0, accepting will not be done.
  TNonblockingIOThread(TNonblockingServer* server,
                       int number,
                       THRIFT_SOCKET listenSocket,
                       bool useHighPriority);

  ~TNonblockingIOThread();

  // Returns the event-base for this thread.
  event_base* getEventBase() const { return eventBase_; }

  // Returns the server for this thread.
  TNonblockingServer* getServer() const { return server_; }

  // Returns the number of this IO thread.
  int getThreadNumber() const { return number_; }

  // Returns the thread id associated with this object.  This should
  // only be called after the thread has been started.
  Thread::id_t getThreadId() const { return threadId_; }

  // Returns the send-fd for task complete notifications.
  evutil_socket_t getNotificationSendFD() const { return notificationPipeFDs_[1]; }

  // Returns the read-fd for task complete notifications.
  evutil_socket_t getNotificationRecvFD() const { return notificationPipeFDs_[0]; }

  // Returns the actual thread object associated with this IO thread.
  boost::shared_ptr<Thread> getThread() const { return thread_; }

  // Sets the actual thread object associated with this IO thread.
  void setThread(const boost::shared_ptr<Thread>& t) { thread_ = t; }

  // Used by TConnection objects to indicate processing has finished.
  bool notify(TNonblockingServer::TConnection* conn);

  // Enters the event loop and does not return until a call to stop().
  virtual void run();

  // Exits the event loop as soon as possible.
  void stop();

  // Ensures that the event-loop thread is fully finished and shut down.
  void join();

  /// Registers the events for the notification & listen sockets
  void registerEvents();

private:
  /**
   * C-callable event handler for signaling task completion.  Provides a
   * callback that libevent can understand that will read a connection
   * object's address from a pipe and call connection->transition() for
   * that object.
   *
   * @param fd the descriptor the event occurred on.
   */
  static void notifyHandler(evutil_socket_t fd, short which, void* v);

  /**
   * C-callable event handler for listener events.  Provides a callback
   * that libevent can understand which invokes server->handleEvent().
   *
   * @param fd the descriptor the event occurred on.
   * @param which the flags associated with the event.
   * @param v void* callback arg where we placed TNonblockingServer's "this".
   */
  static void listenHandler(evutil_socket_t fd, short which, void* v) {
    ((TNonblockingServer*)v)->handleEvent(fd, which);
  }

  /// Exits the loop ASAP in case of shutdown or error.
  void breakLoop(bool error);

  /// Create the pipe used to notify I/O process of task completion.
  void createNotificationPipe();

  /// Unregisters our events for notification and listen sockets.
  void cleanupEvents();

  /// Sets (or clears) high priority scheduling status for the current thread.
  void setCurrentThreadHighPriority(bool value);

private:
  /// associated server
  TNonblockingServer* server_;

  /// thread number (for debugging).
  const int number_;

  /// The actual physical thread id.
  Thread::id_t threadId_;

  /// If listenSocket_ >= 0, adds an event on the event_base to accept conns
  THRIFT_SOCKET listenSocket_;

  /// Sets a high scheduling priority when running
  bool useHighPriority_;

  /// pointer to eventbase to be used for looping
  event_base* eventBase_;

  /// Set to true if this class is responsible for freeing the event base
  /// memory.
  bool ownEventBase_;

  /// Used with eventBase_ for connection events (only in listener thread)
  struct event serverEvent_;

  /// Used with eventBase_ for task completion notification
  struct event notificationEvent_;

  /// File descriptors for pipe used for task completion notification.
  evutil_socket_t notificationPipeFDs_[2];

  /// Actual IO Thread
  boost::shared_ptr<Thread> thread_;
};
}
}
} // apache::thrift::server

#endif // #ifndef _THRIFT_SERVER_TNONBLOCKINGSERVER_H_
