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
 * Defines the interface used for client-side handling of asynchronous
 * I/O operations, based on coroutines.
 *
 * The main piece of the »client side« (e.g. for TAsyncClient users) of the
 * API is TFuture, which represents an asynchronously executed operation,
 * which can have a return value, throw exceptions, and which can be waited
 * upon.
 *
 * On the »implementation side«, the idea is that by using a TAsyncTransport
 * instead of a normal TTransport and executing the work through a
 * TAsyncManager, the same code as for synchronous I/O can be used for
 * asynchronous operation as well, for example:
 *
 * ---
 * auto socket = new TAsyncSocket(someTAsyncSocketManager(), host, port);
 * // …
 * socket.asyncManager.execute(socket, {
 *   SomeThriftStruct s;
 *
 *   // Waiting for socket I/O will not block an entire thread but cause
 *   // the async manager to execute another task in the meantime, because
 *   // we are using TAsyncSocket instead of TSocket.
 *   s.read(socket);
 *
 *   // Do something with s, e.g. set a TPromise result to it.
 *   writeln(s);
 * });
 * ---
 */
module thrift.async.base;

import core.time : Duration, dur;
import std.socket/+ : Socket+/; // DMD @@BUG314@@
import thrift.base;
import thrift.transport.base;
import thrift.util.cancellation;

/**
 * Manages one or more asynchronous transport resources (e.g. sockets in the
 * case of TAsyncSocketManager) and allows work items to be submitted for them.
 *
 * Implementations will typically run one or more background threads for
 * executing the work, which is one of the reasons for a TAsyncManager to be
 * used. Each work item is run in its own fiber and is expected to yield() away
 * while waiting for time-consuming operations.
 *
 * The second important purpose of TAsyncManager is to serialize access to
 * the transport resources – without taking care of that, e.g. issuing multiple
 * RPC calls over the same connection in rapid succession would likely lead to
 * more than one request being written at the same time, causing only garbage
 * to arrive at the remote end.
 *
 * All methods are thread-safe.
 */
interface TAsyncManager {
  /**
   * Submits a work item to be executed asynchronously.
   *
   * Access to asnyc transports is serialized – if two work items associated
   * with the same transport are submitted, the second delegate will not be
   * invoked until the first has returned, even it the latter context-switches
   * away (because it is waiting for I/O) and the async manager is idle
   * otherwise.
   *
   * Optionally, a TCancellation instance can be specified. If present,
   * triggering it will be considered a request to cancel the work item, if it
   * is still waiting for the associated transport to become available.
   * Delegates which are already being processed (i.e. waiting for I/O) are not
   * affected because this would bring the connection into an undefined state
   * (as probably half-written request or a half-read response would be left
   * behind).
   *
   * Params:
   *   transport = The TAsyncTransport the work delegate will operate on. Must
   *     be associated with this TAsyncManager instance.
   *   work = The operations to execute on the given transport. Must never
   *     throw, errors should be handled in another way. nothrow semantics are
   *     difficult to enforce in combination with fibres though, so currently
   *     exceptions are just swallowed by TAsyncManager implementations.
   *   cancellation = If set, can be used to request cancellatinon of this work
   *     item if it is still waiting to be executed.
   *
   * Note: The work item will likely be executed in a different thread, so make
   *   sure the code it relies on is thread-safe. An exception are the async
   *   transports themselves, to which access is serialized as noted above.
   */
  void execute(TAsyncTransport transport, void delegate() work,
    TCancellation cancellation = null
  ) in {
    assert(transport.asyncManager is this,
      "The given transport must be associated with this TAsyncManager.");
  }

  /**
   * Submits a delegate to be executed after a certain amount of time has
   * passed.
   *
   * The actual amount of time elapsed can be higher if the async manager
   * instance is busy and thus should not be relied on. The
   *
   * Params:
   *   duration = The amount of time to wait before starting to execute the
   *     work delegate.
   *   work = The code to execute after the specified amount of time has passed.
   *
   * Example:
   * ---
   * // A very basic example – usually, the actuall work item would enqueue
   * // some async transport operation.
   * auto asyncMangager = someAsyncManager();
   *
   * TFuture!int calculate() {
   *   // Create a promise and asynchronously set its value after three
   *   // seconds have passed.
   *   auto promise = new TPromise!int;
   *   asyncManager.delay(dur!"seconds"(3), {
   *     promise.succeed(42);
   *   });
   *
   *   // Immediately return it to the caller.
   *   return promise;
   * }
   *
   * // This will wait until the result is available and then print it.
   * writeln(calculate().waitGet());
   * ---
   */
  void delay(Duration duration, void delegate() work);

  /**
   * Shuts down all background threads or other facilities that might have
   * been started in order to execute work items. This function is typically
   * called during program shutdown.
   *
   * If there are still tasks to be executed when the timeout expires, any
   * currently executed work items will never receive any notifications
   * for async transports managed by this instance, queued work items will
   * be silently dropped, and implementations are allowed to leak resources.
   *
   * Params:
   *   waitFinishTimeout = If positive, waits for all work items to be
   *     finished for the specified amount of time, if negative, waits for
   *     completion without ever timing out, if zero, immediately shuts down
   *     the background facilities.
   */
  bool stop(Duration waitFinishTimeout = dur!"hnsecs"(-1));
}

/**
 * A TTransport which uses a TAsyncManager to schedule non-blocking operations.
 *
 * The actual type of device is not specified; typically, implementations will
 * depend on an interface derived from TAsyncManager to be notified of changes
 * in the transport state.
 *
 * The peeking, reading, writing and flushing methods must always be called
 * from within the associated async manager.
 */
interface TAsyncTransport : TTransport {
  /**
   * The TAsyncManager associated with this transport.
   */
  TAsyncManager asyncManager() @property;
}

/**
 * A TAsyncManager providing notificiations for socket events.
 */
interface TAsyncSocketManager : TAsyncManager {
  /**
   * Adds a listener that is triggered once when an event of the specified type
   * occurs, and removed afterwards.
   *
   * Params:
   *   socket = The socket to listen for events at.
   *   eventType = The type of the event to listen for.
   *   timeout = The period of time after which the listener will be called
   *     with TAsyncEventReason.TIMED_OUT if no event happened.
   *   listener = The delegate to call when an event happened.
   */
  void addOneshotListener(Socket socket, TAsyncEventType eventType,
    Duration timeout, TSocketEventListener listener);

  /// Ditto
  void addOneshotListener(Socket socket, TAsyncEventType eventType,
    TSocketEventListener listener);
}

/**
 * Types of events that can happen for an asynchronous transport.
 */
enum TAsyncEventType {
  READ, /// New data became available to read.
  WRITE /// The transport became ready to be written to.
}

/**
 * The type of the delegates used to register socket event handlers.
 */
alias void delegate(TAsyncEventReason callReason) TSocketEventListener;

/**
 * The reason a listener was called.
 */
enum TAsyncEventReason : byte {
  NORMAL, /// The event listened for was triggered normally.
  TIMED_OUT /// A timeout for the event was set, and it expired.
}
